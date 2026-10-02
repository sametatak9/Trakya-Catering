-- Faz 3E-2: kanonik stok adları, tedarikçi takma adları, fatura satırı eşleştirme, birleştirme, PO satırları, talep kaydı.
-- Kural: kanonik ad sabit; faturadaki aynı ürün o stoğa yazılır ve tedarikçi adı kaydedilir; yeni ürün ancak benzerleri gösterildikten sonra açılır.
-- Yalnızca eklemeli. Definer gereken tek iş (merge) private şemada; public taraf invoker sarmalayıcı.

create extension if not exists pg_trgm with schema extensions;

-- 1) Türkçe normalleştirme (istemci eşleniği: src/lib/normTr.ts — iki taraf aynı kuralı uygular)
create or replace function public.norm_tr(p text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select nullif(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
           lower(translate(coalesce(p, ''), 'ÇĞİIÖŞÜÂÎÛçğıöşüâîû', 'cgiiosuaiucgiosuaiu')),
           '[^a-z0-9]+', ' ', 'g'),
           '(^| )1 ?sinif(?= |$)', ' ', 'g'),
           '(^| )[0-9]+(kg|gr|g|lt|l|ml|cl|li|lu|luk)?(?= |$)', ' ', 'g'),
           '(^| )(birinci sinif|sinif|ekstra|extra|kg|kilo|gr|g|lt|l|ml|cl|adet|ad|ade|koli|kasa|pkt|paket|kutu|cuval|bidon|teneke|demet|rulo|kova|li|lu|luk)(?= |$)', ' ', 'g'),
           ' +', ' ', 'g')), '');
$$;
comment on function public.norm_tr(text) is 'Türkçe karakter → ASCII, küçük harf, noktalama ve birim/gürültü sözcükleri atılır. "DANA KUŞBAŞI 1.SINIF KG" → "dana kusbasi"';

-- 2) Takma adlar (tedarikçiye özel veya genel)
create table if not exists public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  alias_raw text not null check (length(btrim(alias_raw)) > 0),
  alias_norm text generated always as (public.norm_tr(alias_raw)) stored,
  seller_item_code text,
  unit_code text references public.units(code),
  factor_to_stock numeric(14,6) not null default 1 check (factor_to_stock > 0),
  confirmed boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists ingredient_aliases_uidx on public.ingredient_aliases
  (coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), alias_norm);
create index if not exists ingredient_aliases_trgm on public.ingredient_aliases using gin (alias_norm extensions.gin_trgm_ops);
create index if not exists ingredient_aliases_code on public.ingredient_aliases (supplier_id, seller_item_code) where seller_item_code is not null;
create index if not exists ingredients_name_norm_trgm on public.ingredients using gin (public.norm_tr(name) extensions.gin_trgm_ops);
alter table public.ingredient_aliases enable row level security;
drop policy if exists ingredient_aliases_read on public.ingredient_aliases;
create policy ingredient_aliases_read on public.ingredient_aliases for select to authenticated using ((select public.is_staff()));
drop policy if exists ingredient_aliases_write on public.ingredient_aliases;
create policy ingredient_aliases_write on public.ingredient_aliases for insert to authenticated with check ((select public.has_role(array['yonetici', 'satinalma', 'muhasebe'])));
drop policy if exists ingredient_aliases_update on public.ingredient_aliases;
create policy ingredient_aliases_update on public.ingredient_aliases for update to authenticated
  using ((select public.has_role(array['yonetici', 'satinalma', 'muhasebe']))) with check ((select public.has_role(array['yonetici', 'satinalma', 'muhasebe'])));
drop policy if exists ingredient_aliases_delete on public.ingredient_aliases;
create policy ingredient_aliases_delete on public.ingredient_aliases for delete to authenticated using ((select public.has_role(array['yonetici', 'satinalma'])));
drop trigger if exists ingredient_aliases_audit on public.ingredient_aliases;
create trigger ingredient_aliases_audit after insert or update or delete on public.ingredient_aliases for each row execute function public.log_audit();

-- 3) Alternatif birimler (koli, kasa, teneke… → stok birimi katsayısı)
create table if not exists public.ingredient_pack_units (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  pack_name text not null check (length(btrim(pack_name)) > 0),
  factor_to_stock numeric(14,6) not null check (factor_to_stock > 0),
  unique (ingredient_id, pack_name)
);
alter table public.ingredient_pack_units enable row level security;
drop policy if exists ingredient_pack_units_read on public.ingredient_pack_units;
create policy ingredient_pack_units_read on public.ingredient_pack_units for select to authenticated using ((select public.is_staff()));
drop policy if exists ingredient_pack_units_write on public.ingredient_pack_units;
create policy ingredient_pack_units_write on public.ingredient_pack_units for all to authenticated
  using ((select public.has_role(array['yonetici', 'satinalma', 'asci_basi']))) with check ((select public.has_role(array['yonetici', 'satinalma', 'asci_basi'])));

-- 4) Yemek öğünleri (yemek listesindeki ogun bilgisi)
alter table public.recipes add column if not exists meals text[] not null default '{}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_meals_check') then
    alter table public.recipes add constraint recipes_meals_check check (meals <@ array['kahvalti', 'ogle', 'aksam', 'gece']::text[]);
  end if;
end $$;

-- 5) Fiyat geçmişi kaynağı ve tedarikçi bağlantıları
alter table public.ingredient_prices add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.ingredient_prices add column if not exists purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null;
alter table public.ingredient_prices add column if not exists invoice_line_no int;
alter table public.ingredient_prices drop constraint if exists ingredient_prices_source_check;
alter table public.ingredient_prices add constraint ingredient_prices_source_check check (source in ('manuel', 'alis_faturasi', 'teklif'));
create index if not exists ingredient_prices_hist_idx on public.ingredient_prices (ingredient_id, noted_at desc);

alter table public.purchase_invoices add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
update public.purchase_invoices pi set supplier_id = s.id
  from public.suppliers s where pi.supplier_id is null and pi.supplier_tax_no is not null and s.tax_no = pi.supplier_tax_no;
alter table public.suppliers add column if not exists default_category_code text;

-- 6) Düzensiz fiyat: son alıştan / teklif medyanından eşik (%3) üstü sapma; kabul/red kaydı
create table if not exists public.price_variance_decisions (
  id uuid primary key default gen_random_uuid(),
  price_id uuid not null unique references public.ingredient_prices(id) on delete cascade,
  decision text not null check (decision in ('kabul', 'red')),
  note text,
  decided_by uuid default auth.uid(),
  decided_at timestamptz not null default now()
);
alter table public.price_variance_decisions enable row level security;
drop policy if exists pvd_read on public.price_variance_decisions;
create policy pvd_read on public.price_variance_decisions for select to authenticated using ((select public.is_staff()));
drop policy if exists pvd_write on public.price_variance_decisions;
create policy pvd_write on public.price_variance_decisions for insert to authenticated with check ((select public.has_role(array['yonetici', 'satinalma', 'muhasebe'])));
drop trigger if exists price_variance_decisions_audit on public.price_variance_decisions;
create trigger price_variance_decisions_audit after insert or update or delete on public.price_variance_decisions for each row execute function public.log_audit();

create or replace view public.v_price_variances with (security_invoker = true) as
with p as (
  select ip.*, lag(ip.price) over (partition by ip.ingredient_id order by ip.noted_at) as prev_price
    from public.ingredient_prices ip where ip.source <> 'teklif'
)
select p.id as price_id, p.ingredient_id, i.name as ingredient_name, i.stock_unit, p.noted_at, p.price, p.prev_price,
       round((p.price - p.prev_price) / nullif(p.prev_price, 0) * 100, 2) as change_pct,
       p.supplier_id, coalesce(s.name, p.supplier_name) as supplier_name, p.purchase_invoice_id,
       d.decision, d.note as decision_note, d.decided_at
  from p join public.ingredients i on i.id = p.ingredient_id
  left join public.suppliers s on s.id = p.supplier_id
  left join public.price_variance_decisions d on d.price_id = p.id
 where p.prev_price is not null and abs(p.price - p.prev_price) / nullif(p.prev_price, 0) > 0.03;

-- 7) Verim (brüt → net) testi, tedarikçiye göre
create table if not exists public.yield_tests (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  test_date date not null default current_date,
  gross_qty numeric(14,4) not null check (gross_qty > 0),
  net_qty numeric(14,4) not null check (net_qty > 0),
  yield_pct numeric(6,2) generated always as (round(net_qty / gross_qty * 100, 2)) stored,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (net_qty <= gross_qty)
);
alter table public.yield_tests enable row level security;
drop policy if exists yield_tests_read on public.yield_tests;
create policy yield_tests_read on public.yield_tests for select to authenticated using ((select public.is_staff()));
drop policy if exists yield_tests_write on public.yield_tests;
create policy yield_tests_write on public.yield_tests for insert to authenticated with check ((select public.has_role(array['yonetici', 'satinalma', 'asci_basi'])));

-- 8) PO satırları (jsonb okunmaya devam eder; satır tablosu tetikleyiciyle jsonb'yi senkron tutar)
create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  qty numeric(14,4) not null check (qty > 0),
  unit_price numeric(14,6) not null default 0 check (unit_price >= 0),
  received_qty numeric(14,4),
  unique (po_id, ingredient_id)
);
alter table public.purchase_order_lines enable row level security;
drop policy if exists pol_read on public.purchase_order_lines;
create policy pol_read on public.purchase_order_lines for select to authenticated using ((select public.is_staff()));
drop policy if exists pol_write on public.purchase_order_lines;
create policy pol_write on public.purchase_order_lines for all to authenticated
  using ((select public.has_role(array['yonetici', 'satinalma']))) with check ((select public.has_role(array['yonetici', 'satinalma'])));
create or replace function public.po_lines_sync() returns trigger
language plpgsql set search_path = 'public' as $$
declare v_po uuid := coalesce(new.po_id, old.po_id);
begin
  update public.purchase_orders set
    lines = coalesce((select jsonb_agg(jsonb_build_object('ingredient_id', l.ingredient_id, 'qty', l.qty, 'unit_price', l.unit_price) order by l.id)
                        from public.purchase_order_lines l where l.po_id = v_po), '[]'::jsonb),
    total = coalesce((select round(sum(l.qty * l.unit_price), 2) from public.purchase_order_lines l where l.po_id = v_po), 0)
   where id = v_po;
  return null;
end $$;
drop trigger if exists purchase_order_lines_sync on public.purchase_order_lines;
create trigger purchase_order_lines_sync after insert or update or delete on public.purchase_order_lines for each row execute function public.po_lines_sync();
-- mevcut jsonb satırlarını tabloya taşı (idempotent)
insert into public.purchase_order_lines (po_id, ingredient_id, qty, unit_price)
select po.id, (l->>'ingredient_id')::uuid, sum((l->>'qty')::numeric), max(coalesce((l->>'unit_price')::numeric, 0))
  from public.purchase_orders po cross join lateral jsonb_array_elements(coalesce(po.lines, '[]'::jsonb)) l
 where (l->>'ingredient_id') is not null and (l->>'qty')::numeric > 0
   and exists (select 1 from public.ingredients i where i.id = (l->>'ingredient_id')::uuid)
 group by po.id, (l->>'ingredient_id')::uuid
on conflict (po_id, ingredient_id) do nothing;

-- 9) Tedarikçiye talep gönderim kaydı
create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  po_id uuid references public.purchase_orders(id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'eposta', 'pdf')),
  message text,
  sent_at timestamptz not null default now(),
  sent_by uuid default auth.uid()
);
alter table public.purchase_requests enable row level security;
drop policy if exists purchase_requests_read on public.purchase_requests;
create policy purchase_requests_read on public.purchase_requests for select to authenticated using ((select public.is_staff()));
drop policy if exists purchase_requests_write on public.purchase_requests;
create policy purchase_requests_write on public.purchase_requests for insert to authenticated with check ((select public.has_role(array['yonetici', 'satinalma'])));

-- 10) Fatura satırı eşleştirme: en çok 5 aday (invoker; okuma yetkisi RLS'ten)
create or replace function public.match_invoice_line(p_supplier_id uuid, p_raw text, p_seller_code text default null)
returns table (ingredient_id uuid, name text, score numeric, kaynak text, factor_to_stock numeric)
language sql stable set search_path = 'public, extensions' as $$
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
    select i.id, case when public.norm_tr(i.name) = q.n then 0.95 else round(similarity(public.norm_tr(i.name), q.n)::numeric, 3) end, 'benzerlik', 1::numeric
      from public.ingredients i, q where i.active and q.n is not null and public.norm_tr(i.name) % q.n
    union all
    select a.ingredient_id, round(similarity(a.alias_norm, q.n)::numeric * 0.98, 3), 'benzerlik', a.factor_to_stock
      from public.ingredient_aliases a, q where q.n is not null and a.alias_norm % q.n
  ),
  best as (select distinct on (c.ingredient_id) c.* from c order by c.ingredient_id, c.score desc)
  select b.ingredient_id, i.name, b.score, b.kaynak, b.factor_to_stock
    from best b join public.ingredients i on i.id = b.ingredient_id where i.active
   order by b.score desc, i.name limit 5;
$$;
revoke all on function public.match_invoice_line(uuid, text, text) from public, anon;
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
revoke all on function public.confirm_alias(uuid, uuid, text, text, text, numeric) from public, anon;
grant execute on function public.confirm_alias(uuid, uuid, text, text, text, numeric) to authenticated;

-- 11) Kopya stok kartlarını birleştir (yalnız yönetici). Tüm bağlı kayıtlar taşınır, düşen kart pasiflenir ve adı takma ad olur.
create or replace function private.merge_ingredients(p_keep uuid, p_drop uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; n int; v_total int := 0; v_name text; v_moved jsonb := '{}'::jsonb;
begin
  if not public.has_role(array['yonetici']) then raise exception 'Birleştirmeyi yalnız yönetici yapar' using errcode = '42501'; end if;
  if p_keep = p_drop then raise exception 'Aynı kart birleştirilemez' using errcode = '23514'; end if;
  if (select u1.dimension <> u2.dimension from public.ingredients a join public.units u1 on u1.code = a.stock_unit,
                                              public.ingredients b join public.units u2 on u2.code = b.stock_unit where a.id = p_keep and b.id = p_drop) then
    raise exception 'Farklı ölçü türündeki kartlar birleştirilemez' using errcode = '23514';
  end if;
  select name into v_name from public.ingredients where id = p_drop;
  if v_name is null then raise exception 'Kart bulunamadı' using errcode = '23503'; end if;
  perform set_config('trakya.merge', 'on', true);
  for r in select c.conrelid::regclass::text as tbl, a.attname as col
             from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
            where c.contype = 'f' and c.confrelid = 'public.ingredients'::regclass and array_length(c.conkey, 1) = 1 loop
    begin
      execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col) using p_keep, p_drop;
    exception when unique_violation then
      execute format('delete from %s where %I = $1', r.tbl, r.col) using p_drop;
    end;
    get diagnostics n = row_count;
    if n > 0 then v_moved := v_moved || jsonb_build_object(r.tbl, n); v_total := v_total + n; end if;
  end loop;
  insert into public.ingredient_aliases (ingredient_id, supplier_id, alias_raw, confirmed)
  values (p_keep, null, v_name, true) on conflict do nothing;
  update public.ingredients set active = false, notes = concat_ws(' · ', notes, 'Birleştirildi → ' || p_keep::text) where id = p_drop;
  return jsonb_build_object('tasinan', v_total, 'tablolar', v_moved);
end $$;
revoke all on function private.merge_ingredients(uuid, uuid) from public, anon, authenticated;
grant execute on function private.merge_ingredients(uuid, uuid) to authenticated;
create or replace function public.merge_ingredients(p_keep uuid, p_drop uuid) returns jsonb
language sql set search_path = '' as $$ select private.merge_ingredients(p_keep, p_drop); $$;
revoke all on function public.merge_ingredients(uuid, uuid) from public, anon;
grant execute on function public.merge_ingredients(uuid, uuid) to authenticated;
