-- Faz 3E-2c: fatura satırı eşleştirme (en çok 5 aday), takma ad onayı, kopya stok kartı birleştirme (yalnız yönetici).
create or replace function public.match_invoice_line(p_supplier_id uuid, p_raw text, p_seller_code text default null)
returns table (ingredient_id uuid, name text, score numeric, kaynak text, factor_to_stock numeric)
language sql stable set search_path = public, extensions as $$
  with q as (select public.norm_tr(p_raw) as n),
  c as (
    select a.ingredient_id, 1.0::numeric as score, 'kod'::text as kaynak, a.factor_to_stock
      from public.ingredient_aliases a where p_seller_code is not null and a.seller_item_code = p_seller_code and a.supplier_id is not distinct from p_supplier_id
    union all
    select a.ingredient_id, 0.99, 'alias_tedarikci', a.factor_to_stock from public.ingredient_aliases a, q
     where p_supplier_id is not null and a.supplier_id = p_supplier_id and a.alias_norm = q.n
    union all
    select a.ingredient_id, 0.95, 'alias_genel', a.factor_to_stock from public.ingredient_aliases a, q
     where a.supplier_id is null and a.alias_norm = q.n
    union all
    select i.id, case when public.norm_tr(i.name) = q.n then 0.95 else round(extensions.similarity(public.norm_tr(i.name), q.n)::numeric, 3) end, 'benzerlik', 1::numeric
      from public.ingredients i, q where i.active and q.n is not null and public.norm_tr(i.name) operator(extensions.%) q.n
    union all
    select a.ingredient_id, round(extensions.similarity(a.alias_norm, q.n)::numeric * 0.98, 3), 'benzerlik', a.factor_to_stock
      from public.ingredient_aliases a, q where q.n is not null and a.alias_norm operator(extensions.%) q.n
  ),
  best as (select distinct on (c.ingredient_id) c.* from c order by c.ingredient_id, c.score desc)
  select b.ingredient_id, i.name, b.score, b.kaynak, b.factor_to_stock
    from best b join public.ingredients i on i.id = b.ingredient_id where i.active
   order by b.score desc, i.name limit 5;
$$;
grant execute on function public.match_invoice_line(uuid, text, text) to authenticated;

create or replace function public.confirm_alias(p_ingredient uuid, p_supplier uuid, p_raw text, p_seller_code text default null,
                                                p_unit text default null, p_factor numeric default 1)
returns uuid language plpgsql set search_path = 'public' as $$
declare v_id uuid;
begin
  if public.norm_tr(p_raw) is null then raise exception 'Takma ad boş olamaz' using errcode = '23514'; end if;
  insert into public.ingredient_aliases (ingredient_id, supplier_id, alias_raw, seller_item_code, unit_code, factor_to_stock, confirmed)
  values (p_ingredient, p_supplier, btrim(p_raw), nullif(btrim(coalesce(p_seller_code, '')), ''), p_unit, coalesce(p_factor, 1), true)
  on conflict (coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), alias_norm)
  do update set ingredient_id = excluded.ingredient_id, seller_item_code = coalesce(excluded.seller_item_code, ingredient_aliases.seller_item_code),
                unit_code = coalesce(excluded.unit_code, ingredient_aliases.unit_code), factor_to_stock = excluded.factor_to_stock, confirmed = true
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.confirm_alias(uuid, uuid, text, text, text, numeric) to authenticated;

-- Birleştirme: bağlı kayıtlar keep kartına taşınır; aynı satır keep'te zaten varsa (benzersizlik) düşen kartta kalır ve raporlanır.
-- Düşen kart pasiflenir, adı keep kartına takma ad olur. private şeması API'ye açık değil; public sarmalayıcı invoker.
create or replace function private.merge_ingredients(p_keep uuid, p_drop uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; n int; v_total int := 0; v_name text; v_moved jsonb := '{}'::jsonb; v_kept jsonb := '[]'::jsonb;
begin
  if not public.has_role(array['yonetici']) then raise exception 'Birleştirmeyi yalnız yönetici yapar' using errcode = '42501'; end if;
  if p_keep = p_drop then raise exception 'Aynı kart birleştirilemez' using errcode = '23514'; end if;
  if (select u1.dimension <> u2.dimension from public.ingredients a join public.units u1 on u1.code = a.stock_unit,
                                              public.ingredients b join public.units u2 on u2.code = b.stock_unit where a.id = p_keep and b.id = p_drop) then
    raise exception 'Farklı ölçü türündeki kartlar birleştirilemez' using errcode = '23514';
  end if;
  select name into v_name from public.ingredients where id = p_drop;
  if v_name is null then raise exception 'Kart bulunamadı' using errcode = '23503'; end if;
  for r in select c.conrelid::regclass::text as tbl, a.attname as col
             from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
            where c.contype = 'f' and c.confrelid = 'public.ingredients'::regclass and array_length(c.conkey, 1) = 1 loop
    begin
      execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col) using p_keep, p_drop;
      get diagnostics n = row_count;
      if n > 0 then v_moved := v_moved || jsonb_build_object(r.tbl, n); v_total := v_total + n; end if;
    exception when unique_violation then
      v_kept := v_kept || to_jsonb(r.tbl);
    end;
  end loop;
  insert into public.ingredient_aliases (ingredient_id, supplier_id, alias_raw, confirmed)
  values (p_keep, null, v_name, true) on conflict do nothing;
  update public.ingredients set active = false, notes = concat_ws(' · ', notes, 'Birleştirildi → ' || p_keep::text) where id = p_drop;
  return jsonb_build_object('tasinan', v_total, 'tablolar', v_moved, 'cakisan', v_kept);
end $$;
grant execute on function private.merge_ingredients(uuid, uuid) to authenticated;
create or replace function public.merge_ingredients(p_keep uuid, p_drop uuid) returns jsonb
language sql set search_path = '' as $$ select private.merge_ingredients(p_keep, p_drop); $$;
grant execute on function public.merge_ingredients(uuid, uuid) to authenticated;
