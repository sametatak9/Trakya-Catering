-- TRAKYA CATERING ERP — 7: esnek menü modeli, menü planı, firma bilgileri ve GÜNLÜK HAZIRLIK
--
-- Mutfak kültürü: porsiyon tek tek tartılmaz. O günün her yemeği için hazırlanan toplam miktar
-- (stoktan seçilen veya elle yazılan malzeme + fiyat) girilir; siparişlerdeki kişi sayısına bölünerek
-- 1 porsiyonun gramajı ve maliyeti bulunur. Reçete varsa öneri (plan) olarak gelir, fark izlenir;
-- reçete yoksa hazırlıktan türetilir.
--
-- Önceki "production_logs" (reçeteden teorik üretim) bu modelle değiştirilir (tablo boştu).

-- ---------------------------------------------------------------------
-- 0) Eski teorik üretim kaydını kaldır
-- ---------------------------------------------------------------------
drop function if exists public.plan_production_from_orders(date, text);
drop function if exists public.refresh_production_costs(date);
drop table if exists public.production_logs;
drop function if exists public.snapshot_production_cost();

-- ---------------------------------------------------------------------
-- 1) Menü modeli: serbest kap sayısı, kap türü (kurs), firma bazlı menü
-- ---------------------------------------------------------------------
alter table public.menus drop constraint if exists menus_kind_check;
update public.menus set kind = 'standart' where kind in ('3_kap', '4_kap');
alter table public.menus alter column kind set default 'standart';
alter table public.menus add constraint menus_kind_check
  check (kind in ('standart','kahvalti','soguk_mezeli','diyet','ozel'));
alter table public.menus add column if not exists customer_id uuid references public.customers(id) on delete cascade;
create index if not exists menus_customer_idx on public.menus (customer_id);

alter table public.menu_items add column if not exists course text not null default 'ana'
  check (course in ('corba','ana','yardimci','salata','meze','tatli','icecek','ekmek','kahvalti'));

create or replace view public.v_menu_costs with (security_invoker = true) as
select
  m.id as menu_id, m.code, m.name, m.kind, m.meal, m.target_price, m.active,
  count(mi.id)::int as item_count,
  coalesce(sum(rc.cost_last * mi.portion_factor), 0)::numeric(14,4) as cost_last,
  coalesce(sum(rc.cost_avg * mi.portion_factor), 0)::numeric(14,4) as cost_avg,
  coalesce(sum(rc.missing_price_count), 0)::int as missing_price_count,
  case when m.target_price > 0
       then round(((m.target_price - coalesce(sum(rc.cost_last * mi.portion_factor), 0)) / m.target_price * 100)::numeric, 2)
  end as food_margin_pct,
  m.customer_id
from public.menus m
left join public.menu_items mi on mi.menu_id = m.id
left join public.v_recipe_costs rc on rc.recipe_id = mi.recipe_id
group by m.id;

create or replace function public.save_menu(p_id uuid, p_header jsonb, p_items jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := p_id;
begin
  if coalesce(trim(p_header->>'name'), '') = '' then
    raise exception 'Menü adı zorunlu' using errcode = '23514';
  end if;

  if v_id is null then
    insert into public.menus (code, name, kind, meal, target_price, notes, active, customer_id)
    values (
      nullif(trim(p_header->>'code'), ''), trim(p_header->>'name'), coalesce(p_header->>'kind', 'standart'),
      coalesce(p_header->>'meal', 'ogle'), (p_header->>'target_price')::numeric,
      nullif(p_header->>'notes', ''), coalesce((p_header->>'active')::boolean, true),
      nullif(p_header->>'customer_id', '')::uuid
    ) returning id into v_id;
  else
    update public.menus set
      code = nullif(trim(p_header->>'code'), ''),
      name = trim(p_header->>'name'),
      kind = coalesce(p_header->>'kind', 'standart'),
      meal = coalesce(p_header->>'meal', 'ogle'),
      target_price = (p_header->>'target_price')::numeric,
      notes = nullif(p_header->>'notes', ''),
      active = coalesce((p_header->>'active')::boolean, true),
      customer_id = nullif(p_header->>'customer_id', '')::uuid
    where id = v_id;
    if not found then raise exception 'Menü bulunamadı veya yetkiniz yok' using errcode = '42501'; end if;
  end if;

  delete from public.menu_items mi
  where mi.menu_id = v_id
    and mi.recipe_id not in (select (x->>'recipe_id')::uuid from jsonb_array_elements(coalesce(p_items, '[]')) x);

  insert into public.menu_items (menu_id, recipe_id, portion_factor, course, sort)
  select v_id, (x->>'recipe_id')::uuid, coalesce((x->>'portion_factor')::numeric, 1), coalesce(x->>'course', 'ana'), ord::int
  from jsonb_array_elements(coalesce(p_items, '[]')) with ordinality as t(x, ord)
  on conflict (menu_id, recipe_id) do update set
    portion_factor = excluded.portion_factor,
    course = excluded.course,
    sort = excluded.sort;

  return v_id;
end $$;
revoke execute on function public.save_menu(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_menu(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 2) Menü planı: gün × öğün × (genel | firma) → menü
-- ---------------------------------------------------------------------
create table if not exists public.menu_plans (
  id uuid primary key default gen_random_uuid(),
  plan_date date not null,
  meal text not null default 'ogle' check (meal in ('kahvalti','ogle','aksam','gece')),
  customer_id uuid references public.customers(id) on delete cascade,   -- null = genel menü
  menu_id uuid not null references public.menus(id) on delete cascade,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists menu_plans_slot_uidx
  on public.menu_plans (plan_date, meal, coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid));
create trigger menu_plans_updated_at before update on public.menu_plans for each row execute function public.set_updated_at();

-- Bir siparişin geçerli menüsü: siparişte seçili → firmaya özel plan → genel plan
create or replace function public.effective_menu(p_date date, p_meal text, p_customer uuid, p_order_menu uuid)
returns uuid
language sql stable security invoker set search_path = public as $$
  select coalesce(
    p_order_menu,
    (select menu_id from public.menu_plans where plan_date = p_date and meal = p_meal and customer_id = p_customer),
    (select menu_id from public.menu_plans where plan_date = p_date and meal = p_meal and customer_id is null)
  );
$$;

-- ---------------------------------------------------------------------
-- 3) Firma bilgileri (rapor anteti)
-- ---------------------------------------------------------------------
create table if not exists public.company_settings (
  id int primary key default 1 check (id = 1),
  legal_name text not null default 'Trakya Catering',
  short_name text not null default 'Trakya Catering',
  slogan text default 'Toplu yemek üretimi',
  tax_office text,
  tax_no text,
  address text,
  city text,
  phone text,
  email text,
  website text,
  report_footer text default 'Bu rapor Trakya Catering ERP tarafından oluşturulmuştur.',
  updated_at timestamptz not null default now()
);
insert into public.company_settings (id) values (1) on conflict (id) do nothing;
create trigger company_settings_updated_at before update on public.company_settings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4) Günlük hazırlık
-- ---------------------------------------------------------------------
create table if not exists public.prep_batches (
  id uuid primary key default gen_random_uuid(),
  prep_date date not null,
  meal text not null default 'ogle' check (meal in ('kahvalti','ogle','aksam','gece')),
  dish_name text not null check (length(trim(dish_name)) > 0),
  recipe_id uuid references public.recipes(id) on delete set null,
  menu_id uuid references public.menus(id) on delete set null,
  course text not null default 'ana'
    check (course in ('corba','ana','yardimci','salata','meze','tatli','icecek','ekmek','kahvalti')),
  customer_id uuid references public.customers(id) on delete set null,   -- firmaya özel hazırlık
  portions numeric(10,2) check (portions is null or portions > 0),
  portions_source text not null default 'elle' check (portions_source in ('siparis','elle')),
  status text not null default 'taslak' check (status in ('taslak','pisti','kapandi')),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists prep_batches_slot_uidx
  on public.prep_batches (prep_date, meal, lower(dish_name), coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists prep_batches_date_idx on public.prep_batches (prep_date);
create trigger prep_batches_updated_at before update on public.prep_batches for each row execute function public.set_updated_at();

create table if not exists public.prep_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.prep_batches(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete restrict,
  manual_name text,
  qty numeric(14,3) not null check (qty > 0),
  unit text not null references public.units(code),
  unit_price numeric(14,4) check (unit_price is null or unit_price >= 0),  -- girilen birim başına, KDV hariç
  planned_qty numeric(14,3) check (planned_qty is null or planned_qty >= 0), -- reçeteden öneri (aynı birimde)
  is_side boolean not null default false,  -- çiğ yan malzeme (garnitür, sos, baharat…)
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prep_item_source check (
    (ingredient_id is not null and manual_name is null)
    or (ingredient_id is null and length(trim(coalesce(manual_name, ''))) > 0)
  )
);
create index if not exists prep_batch_items_batch_idx on public.prep_batch_items (batch_id);
create index if not exists prep_batch_items_ing_idx on public.prep_batch_items (ingredient_id);
create trigger prep_batch_items_updated_at before update on public.prep_batch_items for each row execute function public.set_updated_at();

-- Stoktaki malzemenin fiyatı (girilmemişse) son alış fiyatından, birime çevrilerek yazılır.
-- Elle yazılan malzemenin fiyatı zorunludur — yoksa maliyet çıkmaz.
create or replace function public.fill_prep_item_price() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  v_price numeric; v_stock_unit text; v_su record; v_iu record;
begin
  select dimension, to_base into v_iu from public.units where code = new.unit;
  if new.ingredient_id is not null then
    select i.last_price, i.stock_unit into v_price, v_stock_unit from public.ingredients i where i.id = new.ingredient_id;
    select dimension, to_base into v_su from public.units where code = v_stock_unit;
    if v_su.dimension <> v_iu.dimension then
      raise exception 'Birim uyumsuz: malzemenin stok birimi % , girilen birim %', v_stock_unit, new.unit using errcode = '23514';
    end if;
    if new.unit_price is null and v_price is not null then
      new.unit_price := round(v_price * v_iu.to_base / v_su.to_base, 4);
    end if;
  elsif new.unit_price is null then
    raise exception 'Elle yazılan malzemenin birim fiyatı zorunlu' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger prep_batch_items_price before insert or update of ingredient_id, unit, unit_price on public.prep_batch_items
  for each row execute function public.fill_prep_item_price();

-- Hazırlık satırları: temel birime çevrilmiş miktar ve maliyet
create or replace view public.v_prep_items with (security_invoker = true) as
select
  it.*,
  coalesce(i.name, it.manual_name) as item_name,
  u.dimension,
  public.base_unit(u.dimension) as base_unit,
  it.qty * u.to_base as qty_base,
  it.planned_qty * u.to_base as planned_qty_base,
  it.qty * it.unit_price as line_cost,
  it.planned_qty * it.unit_price as planned_cost,
  coalesce(i.allergens, '{}') as allergens
from public.prep_batch_items it
join public.units u on u.code = it.unit
left join public.ingredients i on i.id = it.ingredient_id;

create or replace view public.v_prep_batch_costs with (security_invoker = true) as
select
  b.id as batch_id, b.prep_date, b.meal, b.dish_name, b.recipe_id, b.menu_id, b.course, b.customer_id,
  b.portions, b.portions_source, b.status,
  count(it.id)::int as item_count,
  count(it.id) filter (where it.unit_price is null)::int as missing_price_count,
  coalesce(sum(it.line_cost), 0)::numeric(14,4) as total_cost,
  coalesce(sum(it.line_cost) filter (where it.is_side), 0)::numeric(14,4) as side_cost,
  case when b.portions > 0 then (coalesce(sum(it.line_cost), 0) / b.portions)::numeric(14,4) end as cost_per_portion,
  coalesce(sum(it.planned_cost), 0)::numeric(14,4) as planned_cost,
  case when coalesce(sum(it.planned_cost), 0) > 0
       then round(((coalesce(sum(it.line_cost) filter (where it.planned_qty is not null), 0) - sum(it.planned_cost)) / sum(it.planned_cost) * 100)::numeric, 1)
  end as variance_pct,
  coalesce(sum(it.qty_base) filter (where it.base_unit = 'g'), 0)::numeric(14,2) as total_g
from public.prep_batches b
left join public.v_prep_items it on it.batch_id = b.id
group by b.id;

-- Siparişlerden günün yemek başlıklarını kur (geçerli menü × kap × kişi sayısı).
-- Mevcut başlıkların kişi sayısı yalnız sipariş kaynaklıysa güncellenir; elle girilen korunur.
create or replace function public.plan_prep_from_orders(p_date date, p_meal text)
returns int
language plpgsql security invoker set search_path = public as $$
declare n int := 0; r record;
begin
  for r in
    with o as (
      select public.effective_menu(o.service_date, o.meal, o.customer_id, o.menu_id) as menu_id,
             coalesce(o.delivered_qty, o.ordered_qty) as people
      from public.meal_orders o
      where o.service_date = p_date and o.meal = p_meal and o.status <> 'iptal'
    )
    select mi.recipe_id, rc.name, mi.course, sum(o.people * mi.portion_factor) as portions, min(o.menu_id::text)::uuid as menu_id
    from o
    join public.menu_items mi on mi.menu_id = o.menu_id
    join public.recipes rc on rc.id = mi.recipe_id
    group by mi.recipe_id, rc.name, mi.course
    having sum(o.people * mi.portion_factor) > 0
  loop
    insert into public.prep_batches (prep_date, meal, dish_name, recipe_id, menu_id, course, portions, portions_source)
    values (p_date, p_meal, r.name, r.recipe_id, r.menu_id, r.course, r.portions, 'siparis')
    on conflict (prep_date, meal, lower(dish_name), coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid))
    do update set portions = excluded.portions, recipe_id = coalesce(public.prep_batches.recipe_id, excluded.recipe_id)
      where public.prep_batches.portions_source = 'siparis';
    n := n + 1;
  end loop;
  return n;
end $$;

-- Reçeteden doldur: reçete brüt miktarı × porsiyon → hem plan hem başlangıç miktarı (aşçı gerçekle değiştirir)
create or replace function public.prep_fill_from_recipe(p_batch_id uuid)
returns int
language plpgsql security invoker set search_path = public as $$
declare b record; n int;
begin
  select * into b from public.prep_batches where id = p_batch_id;
  if not found then raise exception 'Hazırlık bulunamadı' using errcode = '42501'; end if;
  if b.recipe_id is null then raise exception 'Bu yemeğe bağlı reçete yok' using errcode = '23514'; end if;
  if b.portions is null then raise exception 'Önce kişi/porsiyon sayısını girin' using errcode = '23514'; end if;
  insert into public.prep_batch_items (batch_id, ingredient_id, qty, unit, planned_qty, sort)
  select p_batch_id, l.ingredient_id, round(l.gross_stock_qty * b.portions, 3), l.stock_unit,
         round(l.gross_stock_qty * b.portions, 3), l.sort
  from public.v_recipe_lines l
  where l.recipe_id = b.recipe_id
    and not exists (select 1 from public.prep_batch_items x where x.batch_id = p_batch_id and x.ingredient_id = l.ingredient_id);
  get diagnostics n = row_count;
  -- Zaten eklenmiş malzemelerin plan miktarını da güncelle
  update public.prep_batch_items x set planned_qty = round(l.gross_stock_qty * b.portions * us.to_base / ux.to_base, 3)
  from public.v_recipe_lines l, public.units us, public.units ux
  where x.batch_id = p_batch_id and l.recipe_id = b.recipe_id and x.ingredient_id = l.ingredient_id
    and us.code = l.stock_unit and ux.code = x.unit;
  return n;
end $$;

-- Hazırlıktan standart 1 porsiyon reçete türet (yalnız stoktan seçilen malzemeler).
-- net (reçete) = brüt/porsiyon × (1 − fire%)  → reçetenin maliyet motoru aynı brütü geri üretir.
create or replace function public.recipe_from_prep(p_batch_id uuid, p_category text default null)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare b record; v_recipe uuid; v_cat text;
begin
  select * into b from public.prep_batches where id = p_batch_id;
  if not found then raise exception 'Hazırlık bulunamadı' using errcode = '42501'; end if;
  if b.portions is null then raise exception 'Porsiyon sayısı olmadan reçete türetilemez' using errcode = '23514'; end if;

  v_cat := coalesce(p_category, case b.course
    when 'corba' then 'corba' when 'ana' then 'ana_yemek' when 'yardimci' then 'pilav_makarna'
    when 'salata' then 'salata_meze' when 'meze' then 'salata_meze' when 'tatli' then 'tatli'
    when 'icecek' then 'icecek' when 'ekmek' then 'ekmek' when 'kahvalti' then 'kahvalti' else 'ana_yemek' end);

  v_recipe := b.recipe_id;
  if v_recipe is null then
    select id into v_recipe from public.recipes where lower(name) = lower(trim(b.dish_name));
  end if;
  if v_recipe is null then
    insert into public.recipes (name, category_code) values (trim(b.dish_name), v_cat) returning id into v_recipe;
  end if;

  delete from public.recipe_ingredients where recipe_id = v_recipe;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, net_qty, sort, note)
  select v_recipe, it.ingredient_id,
         round(sum(it.qty * u.to_base) / b.portions * (1 - i.waste_pct / 100), 3),
         min(it.sort), 'Hazırlıktan türetildi'
  from public.prep_batch_items it
  join public.units u on u.code = it.unit
  join public.ingredients i on i.id = it.ingredient_id
  where it.batch_id = p_batch_id and it.ingredient_id is not null
  group by it.ingredient_id, i.waste_pct
  having sum(it.qty) > 0;

  update public.prep_batches set recipe_id = v_recipe where id = p_batch_id;
  return v_recipe;
end $$;

revoke execute on function public.effective_menu(date, text, uuid, uuid), public.plan_prep_from_orders(date, text),
  public.prep_fill_from_recipe(uuid), public.recipe_from_prep(uuid, text) from public, anon;
grant execute on function public.effective_menu(date, text, uuid, uuid), public.plan_prep_from_orders(date, text),
  public.prep_fill_from_recipe(uuid), public.recipe_from_prep(uuid, text) to authenticated;
revoke execute on function public.fill_prep_item_price() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------
alter table public.menu_plans enable row level security;
alter table public.company_settings enable row level security;
alter table public.prep_batches enable row level security;
alter table public.prep_batch_items enable row level security;

do $$
declare spec record;
begin
  for spec in
    select * from (values
      ('menu_plans',       array['yonetici','asci_basi','diyetisyen']),
      ('company_settings', array['yonetici']),
      ('prep_batches',     array['yonetici','asci_basi','diyetisyen']),
      ('prep_batch_items', array['yonetici','asci_basi','diyetisyen'])
    ) as s(tbl, writers)
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_staff())', spec.tbl || '_read', spec.tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_role(%L))', spec.tbl || '_insert', spec.tbl, spec.writers);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(%L)) with check (public.has_role(%L))', spec.tbl || '_update', spec.tbl, spec.writers, spec.writers);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_role(%L))', spec.tbl || '_delete', spec.tbl, spec.writers);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.log_audit()', spec.tbl || '_audit', spec.tbl);
  end loop;
end $$;
-- Firma bilgisi tek satır: silinemez
drop policy if exists company_settings_delete on public.company_settings;
drop policy if exists company_settings_insert on public.company_settings;
