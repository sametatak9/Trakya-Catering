-- TRAKYA CATERING ERP — 2: hammadde, birim, reçete (gramaj), menü ve maliyet motoru
-- Matematik:
--   Reçete satırı NET miktar tutar (temizlenmiş, tencereye giren; g / ml / adet).
--   BRÜT (depodan çıkan) = NET / (1 - fire% / 100)
--   Satır maliyeti = BRÜT (stok biriminde) × birim fiyat
--   Porsiyon maliyeti = Σ satır maliyeti ; Menü maliyeti = Σ (reçete maliyeti × porsiyon katsayısı)

-- ---------------------------------------------------------------------
-- Birimler (referans veri). Temel birimler: g, ml, adet
-- ---------------------------------------------------------------------
create table if not exists public.units (
  code text primary key,
  name text not null,
  dimension text not null check (dimension in ('kutle','hacim','adet')),
  to_base numeric(14,4) not null check (to_base > 0)
);
insert into public.units (code, name, dimension, to_base) values
  ('g', 'Gram', 'kutle', 1), ('kg', 'Kilogram', 'kutle', 1000),
  ('ml', 'Mililitre', 'hacim', 1), ('lt', 'Litre', 'hacim', 1000),
  ('adet', 'Adet', 'adet', 1)
on conflict (code) do nothing;

create or replace function public.base_unit(p_dimension text) returns text
language sql immutable as $$
  select case p_dimension when 'kutle' then 'g' when 'hacim' then 'ml' else 'adet' end;
$$;

-- ---------------------------------------------------------------------
-- Hammaddeler
-- ---------------------------------------------------------------------
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  category text not null default 'diger'
    check (category in ('et_tavuk','balik','sebze_meyve','bakliyat_tahil','sut_urunleri','yag','baharat_sos','kuru_gida','icecek','ekmek_unlu','temizlik_sarf','diger')),
  stock_unit text not null references public.units(code),
  -- Temizleme / ayıklama firesi (%). Brüt = Net / (1 - fire/100)
  waste_pct numeric(5,2) not null default 0 check (waste_pct >= 0 and waste_pct < 100),
  -- Fiyatlar stok birimi başına, KDV hariç
  last_price numeric(14,4) check (last_price is null or last_price >= 0),
  avg_cost numeric(14,4) check (avg_cost is null or avg_cost >= 0),
  price_updated_at timestamptz,
  vat_rate numeric(5,2) not null default 1 check (vat_rate >= 0),
  -- AB/TGK 14 alerjen
  allergens text[] not null default '{}' check (allergens <@ array[
    'gluten','kabuklu_deniz','yumurta','balik','yer_fistigi','soya','sut',
    'sert_kabuklu','kereviz','hardal','susam','sulfit','aci_bakla','yumusakca']::text[]),
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ingredients_name_uidx on public.ingredients (lower(name));
create trigger ingredients_updated_at before update on public.ingredients
  for each row execute function public.set_updated_at();

-- Fiyat geçmişi: her fiyat girişi kalıcı; son fiyat kartta tutulur
create table if not exists public.ingredient_prices (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  price numeric(14,4) not null check (price >= 0),
  source text not null default 'manuel' check (source in ('manuel','alis_faturasi')),
  supplier_name text,
  noted_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists ingredient_prices_ing_idx on public.ingredient_prices (ingredient_id, noted_at desc);

create or replace function public.apply_ingredient_price() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.ingredients i
     set last_price = new.price,
         price_updated_at = new.noted_at,
         -- Alış faturası modülü gelene kadar ortalama maliyet, ilk fiyatla başlar
         avg_cost = coalesce(i.avg_cost, new.price)
   where i.id = new.ingredient_id
     and (i.price_updated_at is null or i.price_updated_at <= new.noted_at);
  return new;
end $$;
revoke execute on function public.apply_ingredient_price() from public, anon, authenticated;
create trigger ingredient_prices_apply after insert on public.ingredient_prices
  for each row execute function public.apply_ingredient_price();

-- ---------------------------------------------------------------------
-- Reçeteler
-- ---------------------------------------------------------------------
create table if not exists public.recipe_categories (
  code text primary key,
  name text not null,
  sort int not null default 0
);
insert into public.recipe_categories (code, name, sort) values
  ('corba', 'Çorbalar', 10), ('ana_yemek', 'Ana Yemekler', 20), ('sebze', 'Sebze Yemekleri', 30),
  ('pilav_makarna', 'Pilav / Makarna', 40), ('salata_meze', 'Salata / Meze', 50), ('tatli', 'Tatlılar', 60),
  ('icecek', 'İçecekler', 70), ('kahvalti', 'Kahvaltılık', 80), ('ekmek', 'Ekmek / Unlu', 90)
on conflict (code) do nothing;

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  category_code text not null references public.recipe_categories(code),
  portion_label text,               -- ör. "1 kepçe (250 ml)"
  portion_served_g numeric(10,2),   -- tabağa giden pişmiş porsiyon (kontrol için)
  instructions text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists recipes_name_uidx on public.recipes (lower(name));
create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  -- 1 porsiyon NET miktar, hammaddenin temel biriminde (g / ml / adet)
  net_qty numeric(12,3) not null check (net_qty > 0),
  -- Boşsa hammadde kartındaki fire kullanılır
  waste_pct_override numeric(5,2) check (waste_pct_override is null or (waste_pct_override >= 0 and waste_pct_override < 100)),
  note text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, ingredient_id)
);
create index if not exists recipe_ingredients_ing_idx on public.recipe_ingredients (ingredient_id);
create trigger recipe_ingredients_updated_at before update on public.recipe_ingredients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Menüler (3 kap / 4 kap kombinasyonları)
-- ---------------------------------------------------------------------
create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  kind text not null default '4_kap' check (kind in ('3_kap','4_kap','kahvalti','diyet','ozel')),
  meal text not null default 'ogle' check (meal in ('kahvalti','ogle','aksam','gece')),
  -- Kişi başı hedef satış fiyatı, KDV hariç
  target_price numeric(12,2) check (target_price is null or target_price >= 0),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger menus_updated_at before update on public.menus
  for each row execute function public.set_updated_at();

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  portion_factor numeric(5,2) not null default 1 check (portion_factor > 0),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (menu_id, recipe_id)
);
create index if not exists menu_items_recipe_idx on public.menu_items (recipe_id);

-- ---------------------------------------------------------------------
-- Maliyet motoru
-- ---------------------------------------------------------------------
create or replace function public.gross_qty(p_net numeric, p_waste_pct numeric) returns numeric
language sql immutable as $$
  select p_net / (1 - coalesce(p_waste_pct, 0) / 100.0);
$$;

-- Reçete satırı: net → brüt → stok birimi → maliyet (son fiyat ve ortalama maliyet)
create or replace view public.v_recipe_lines with (security_invoker = true) as
select
  ri.id,
  ri.recipe_id,
  ri.ingredient_id,
  ri.sort,
  ri.note,
  i.name as ingredient_name,
  i.stock_unit,
  public.base_unit(u.dimension) as base_unit,
  ri.net_qty,
  coalesce(ri.waste_pct_override, i.waste_pct) as waste_pct,
  ri.waste_pct_override,
  public.gross_qty(ri.net_qty, coalesce(ri.waste_pct_override, i.waste_pct)) as gross_qty,
  public.gross_qty(ri.net_qty, coalesce(ri.waste_pct_override, i.waste_pct)) / u.to_base as gross_stock_qty,
  i.last_price,
  coalesce(i.avg_cost, i.last_price) as avg_cost,
  public.gross_qty(ri.net_qty, coalesce(ri.waste_pct_override, i.waste_pct)) / u.to_base * i.last_price as line_cost_last,
  public.gross_qty(ri.net_qty, coalesce(ri.waste_pct_override, i.waste_pct)) / u.to_base * coalesce(i.avg_cost, i.last_price) as line_cost_avg,
  i.allergens
from public.recipe_ingredients ri
join public.ingredients i on i.id = ri.ingredient_id
join public.units u on u.code = i.stock_unit;

create or replace view public.v_recipe_costs with (security_invoker = true) as
select
  r.id as recipe_id,
  r.code,
  r.name,
  r.category_code,
  r.active,
  count(l.id)::int as line_count,
  coalesce(sum(l.line_cost_last), 0)::numeric(14,4) as cost_last,
  coalesce(sum(l.line_cost_avg), 0)::numeric(14,4) as cost_avg,
  count(l.id) filter (where l.last_price is null)::int as missing_price_count,
  coalesce(sum(l.net_qty) filter (where l.base_unit = 'g'), 0)::numeric(12,2) as total_net_g,
  coalesce((select array_agg(distinct a order by a) from public.v_recipe_lines l2, unnest(l2.allergens) a
            where l2.recipe_id = r.id), '{}') as allergens
from public.recipes r
left join public.v_recipe_lines l on l.recipe_id = r.id
group by r.id;

create or replace view public.v_menu_costs with (security_invoker = true) as
select
  m.id as menu_id,
  m.code,
  m.name,
  m.kind,
  m.meal,
  m.target_price,
  m.active,
  count(mi.id)::int as item_count,
  coalesce(sum(rc.cost_last * mi.portion_factor), 0)::numeric(14,4) as cost_last,
  coalesce(sum(rc.cost_avg * mi.portion_factor), 0)::numeric(14,4) as cost_avg,
  coalesce(sum(rc.missing_price_count), 0)::int as missing_price_count,
  case when m.target_price > 0
       then round(((m.target_price - coalesce(sum(rc.cost_last * mi.portion_factor), 0)) / m.target_price * 100)::numeric, 2)
  end as food_margin_pct
from public.menus m
left join public.menu_items mi on mi.menu_id = m.id
left join public.v_recipe_costs rc on rc.recipe_id = mi.recipe_id
group by m.id;

-- N porsiyon için hammadde ihtiyacı (MRP patlatmanın temel taşı)
create or replace function public.recipe_scale(p_recipe_id uuid, p_portions numeric)
returns table (
  ingredient_id uuid, ingredient_name text, stock_unit text,
  net_total numeric, gross_total numeric, base_unit text,
  gross_stock_total numeric, cost_last numeric
)
language sql stable set search_path = public as $$
  select l.ingredient_id, l.ingredient_name, l.stock_unit,
         l.net_qty * p_portions, l.gross_qty * p_portions, l.base_unit,
         l.gross_stock_qty * p_portions, l.line_cost_last * p_portions
  from public.v_recipe_lines l
  where l.recipe_id = p_recipe_id
  order by l.sort, l.ingredient_name;
$$;
revoke execute on function public.recipe_scale(uuid, numeric) from public, anon;
grant execute on function public.recipe_scale(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- RLS: personel okur; yazma rol bazlı. Müşteri bu tablolara erişemez.
-- ---------------------------------------------------------------------
alter table public.units enable row level security;
alter table public.recipe_categories enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_prices enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.menus enable row level security;
alter table public.menu_items enable row level security;

do $$
declare
  t text;
  spec record;
begin
  for spec in
    select * from (values
      ('units',              array['yonetici']),
      ('recipe_categories',  array['yonetici']),
      ('ingredients',        array['yonetici','asci_basi','satinalma']),
      ('ingredient_prices',  array['yonetici','satinalma','muhasebe']),
      ('recipes',            array['yonetici','asci_basi']),
      ('recipe_ingredients', array['yonetici','asci_basi']),
      ('menus',              array['yonetici','asci_basi']),
      ('menu_items',         array['yonetici','asci_basi'])
    ) as s(tbl, writers)
  loop
    t := spec.tbl;
    execute format('create policy %I on public.%I for select to authenticated using (public.is_staff())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_role(%L))', t || '_insert', t, spec.writers);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(%L)) with check (public.has_role(%L))', t || '_update', t, spec.writers, spec.writers);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_role(%L))', t || '_delete', t, spec.writers);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.log_audit()', t || '_audit', t);
  end loop;
end $$;

-- Fiyat geçmişi değişmez: güncelleme/silme kapalı (yanlış fiyat yeni kayıtla düzeltilir)
drop policy if exists ingredient_prices_update on public.ingredient_prices;
drop policy if exists ingredient_prices_delete on public.ingredient_prices;
