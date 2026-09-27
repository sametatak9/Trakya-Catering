-- Faz 3A düzeltmesi: yetki koruyucuları SECURITY INVOKER çalışmalı.
-- SECURITY DEFINER tetikleyicide current_user her zaman sahip (postgres) olur; koruma hiç devreye girmez.
-- Invoker tetikleyicide current_user: API çağrısında 'authenticated', güvenilen (definer) fonksiyon içinden gelen yazımda sahip.

create or replace function public.ingredients_price_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.last_price is distinct from old.last_price or new.avg_cost is distinct from old.avg_cost
          or new.price_updated_at is distinct from old.price_updated_at) then
    raise exception 'Fiyat doğrudan değiştirilemez; fiyat kaydı veya fatura ile güncelleyin' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.ingredients_price_guard() from public, anon, authenticated;
-- "a" ile başlar: birim çevirisinden (ingredients_guard) önce çalışır; çeviri kendi yazdığı fiyatı değiştirir
drop trigger if exists ingredients_a_price_guard on public.ingredients;
create trigger ingredients_a_price_guard before update on public.ingredients
  for each row execute function public.ingredients_price_guard();

-- Birim çevirisi definer kalır (başka tablolara yazar); fiyat kontrolü yukarıdaki invoker tetikleyicide
create or replace function public.ingredients_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare f numeric; o record; n record; v_hist boolean;
begin
  if new.stock_unit is distinct from old.stock_unit then
    select * into o from public.units where code = old.stock_unit;
    select * into n from public.units where code = new.stock_unit;
    v_hist := exists (select 1 from public.stock_movements where ingredient_id = old.id)
           or exists (select 1 from public.ingredient_prices where ingredient_id = old.id)
           or old.last_price is not null or old.avg_cost is not null;
    if o.dimension <> n.dimension then
      if v_hist then
        raise exception 'Birim % → % çevrilemez (farklı ölçü türü). Yeni bir hammadde açın.', old.stock_unit, new.stock_unit using errcode = '23514';
      end if;
      return new;
    end if;
    -- 1 eski birim = f yeni birim
    f := o.to_base / n.to_base;
    new.last_price := round(old.last_price / f, 6);
    new.avg_cost := round(old.avg_cost / f, 6);
    new.min_stock := case when old.min_stock is null then null else round(old.min_stock * f, 4) end;
    update public.ingredient_prices set price = round(price / f, 6) where ingredient_id = old.id;
    update public.supplier_quotes set price = round(price / f, 6) where ingredient_id = old.id;
    update public.stock_movements set qty = round(qty * f, 4), unit_cost = round(unit_cost / f, 6) where ingredient_id = old.id;
  end if;
  return new;
end $$;

create or replace function public.stock_movements_immutable()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.has_role(array['yonetici']) then
    raise exception 'Stok hareketi değiştirilemez; ters kayıtla düzeltin' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.verify_audit_chain()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare r public.audit_log; v_prev text := null;
begin
  if auth.uid() is not null and not public.has_role(array['yonetici','muhasebe']) then
    raise exception 'Yetki yok' using errcode = '42501';
  end if;
  for r in select * from public.audit_log order by chain_seq loop
    if r.prev_hash is distinct from v_prev or r.hash is distinct from public.audit_row_hash(v_prev, r) then return false; end if;
    v_prev := r.hash;
  end loop;
  return true;
end $$;
