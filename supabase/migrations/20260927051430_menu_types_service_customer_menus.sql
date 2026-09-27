-- Faz 3D — menü tipi, sunum şekli (tabla/küvet), müşteri menü tanımı, aylık sipariş, portal v2, hassasiyet/şikâyet,
-- kalori verisi (menü kartı). Yalnızca eklemeli; başka ajanın açtığı customer_menus / customer_feedback genişletilir.
-- Portal fonksiyonları: mantık API'ye kapalı `private` şemasında (SECURITY DEFINER, jetonla doğrulama); public ad invoker sarmalayıcı.

-- 1) Menü tipleri
create table if not exists public.menu_types (
  code text primary key check (code ~ '^[a-z0-9_]{2,30}$'),
  name text not null, course_count smallint check (course_count is null or course_count between 1 and 12),
  sort smallint not null default 0, active boolean not null default true);
insert into public.menu_types (code, name, course_count, sort) values
  ('3_cesit', '3 çeşit', 3, 1), ('4_cesit', '4 çeşit', 4, 2), ('5_cesit', '5 çeşit', 5, 3),
  ('kahvalti', 'Kahvaltı', null, 4), ('diyet', 'Diyet', null, 5)
on conflict (code) do nothing;
alter table public.menus add column if not exists menu_type_code text references public.menu_types(code);
create index if not exists menus_menu_type_idx on public.menus (menu_type_code);

-- 2) Sunum şekli ve ambalaj maliyeti
create table if not exists public.service_styles (
  code text primary key check (code ~ '^[a-z0-9_]{2,30}$'),
  name text not null, pack_mode text not null check (pack_mode in ('kisi_basi', 'kap_basi')),
  people_per_container int not null default 1 check (people_per_container >= 1),
  sort smallint not null default 0, active boolean not null default true);
insert into public.service_styles (code, name, pack_mode, people_per_container, sort) values
  ('tabla_3goz', '3 gözlü tabla', 'kisi_basi', 1, 1), ('kuvet', 'Gastronom küvet', 'kap_basi', 25, 2), ('sefer_tasi', 'Sefer tası', 'kisi_basi', 1, 3)
on conflict (code) do nothing;
create table if not exists public.service_style_items (
  id uuid primary key default gen_random_uuid(),
  style_code text not null references public.service_styles(code) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  qty_per_person numeric(12,4) check (qty_per_person is null or qty_per_person > 0),
  qty_per_container numeric(12,4) check (qty_per_container is null or qty_per_container > 0),
  check (qty_per_person is not null or qty_per_container is not null),
  unique (style_code, ingredient_id));
create index if not exists service_style_items_ing_idx on public.service_style_items (ingredient_id);
-- Kişi başı ambalaj maliyeti: kişi başı kalem + (kap başı kalem ÷ kaptaki kişi). Miktar stok biriminde.
create or replace view public.v_service_style_costs with (security_invoker = true) as
  select s.code, s.name, s.pack_mode, s.people_per_container,
         round(coalesce(sum(coalesce(i.avg_cost, i.last_price, 0)
               * (coalesce(it.qty_per_person, 0) + coalesce(it.qty_per_container, 0) / s.people_per_container)), 0), 4) as pack_cost_per_person,
         count(it.id) as item_count,
         count(it.id) filter (where coalesce(i.avg_cost, i.last_price) is null) as unpriced_count
    from public.service_styles s
    left join public.service_style_items it on it.style_code = s.code
    left join public.ingredients i on i.id = it.ingredient_id
   group by s.code, s.name, s.pack_mode, s.people_per_container;

-- 3) Müşteri menü tanımı (başka ajanın tablosu genişletilir)
alter table public.customer_menus alter column menu_id drop not null;
alter table public.customer_menus add column if not exists menu_type_code text references public.menu_types(code);
alter table public.customer_menus add column if not exists service_style text not null default 'tabla_3goz' references public.service_styles(code);
alter table public.customer_menus add column if not exists unit_price numeric(12,2) check (unit_price is null or unit_price >= 0);
alter table public.customer_menus add column if not exists vat_rate numeric(5,2) check (vat_rate is null or vat_rate >= 0);
alter table public.customer_menus add column if not exists name text;
create index if not exists customer_menus_type_idx on public.customer_menus (menu_type_code);
create index if not exists customer_menus_style_idx on public.customer_menus (service_style);
-- Fiyat da burada tutulduğu için satış/muhasebe de yazar (tek politika, çoklu izinli politika yok)
drop policy if exists customer_menus_insert on public.customer_menus;
drop policy if exists customer_menus_update on public.customer_menus;
drop policy if exists customer_menus_delete on public.customer_menus;
create policy customer_menus_insert on public.customer_menus for insert to authenticated
  with check ((select public.has_role(array['yonetici','asci_basi','diyetisyen','muhasebe','pazarlamaci'])));
create policy customer_menus_update on public.customer_menus for update to authenticated
  using ((select public.has_role(array['yonetici','asci_basi','diyetisyen','muhasebe','pazarlamaci'])))
  with check ((select public.has_role(array['yonetici','asci_basi','diyetisyen','muhasebe','pazarlamaci'])));
create policy customer_menus_delete on public.customer_menus for delete to authenticated
  using ((select public.has_role(array['yonetici','muhasebe','pazarlamaci'])));

-- 4) Sipariş: müşteri menüsü, sunum şekli, kaynak
alter table public.meal_orders add column if not exists customer_menu_id uuid references public.customer_menus(id) on delete set null;
alter table public.meal_orders add column if not exists service_style text not null default 'tabla_3goz' references public.service_styles(code);
alter table public.meal_orders add column if not exists source text not null default 'elle';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'meal_orders_source_check') then
    alter table public.meal_orders add constraint meal_orders_source_check check (source in ('elle', 'portal', 'aylik', 'kopya'));
  end if;
end $$;
create index if not exists meal_orders_customer_menu_idx on public.meal_orders (customer_menu_id);
create index if not exists meal_orders_style_idx on public.meal_orders (service_style);
-- Müşteri menüsü seçilince fiyat/KDV/sunum/menü oradan gelir (personel sonradan elle değiştirebilir)
create or replace function public.meal_orders_apply_customer_menu()
returns trigger language plpgsql security invoker set search_path = public as $$
declare cm record;
begin
  if new.customer_menu_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.customer_menu_id is not distinct from old.customer_menu_id then return new; end if;
  select * into cm from public.customer_menus where id = new.customer_menu_id;
  if cm.id is null or cm.customer_id <> new.customer_id then raise exception 'Menü tanımı bu müşteriye ait değil' using errcode = '23514'; end if;
  if cm.meal <> new.meal then raise exception 'Menü tanımı bu öğün için değil' using errcode = '23514'; end if;
  new.service_style := cm.service_style;
  if cm.unit_price is not null then new.unit_price := cm.unit_price; end if;
  if cm.vat_rate is not null then new.vat_rate := cm.vat_rate; end if;
  if new.menu_id is null and cm.menu_id is not null then new.menu_id := cm.menu_id; end if;
  return new;
end $$;
revoke execute on function public.meal_orders_apply_customer_menu() from public, anon, authenticated;
drop trigger if exists meal_orders_customer_menu on public.meal_orders;
create trigger meal_orders_customer_menu before insert or update on public.meal_orders
  for each row execute function public.meal_orders_apply_customer_menu();
-- Portal (musteri rolü) fiyatı değiştiremez: müşteri menüsü varsa onun, yoksa müşteri kartının fiyatı (S-2 genişletildi)
create or replace function public.enforce_portal_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_c record; v_cm record;
begin
  if public.current_app_role() is distinct from 'musteri' then return new; end if;
  select default_meal_price, vat_rate into v_c from public.customers where id = new.customer_id;
  select unit_price, vat_rate, service_style into v_cm from public.customer_menus
   where id = new.customer_menu_id and customer_id = new.customer_id and active;
  if not found then new.customer_menu_id := null; end if;
  new.unit_price := coalesce(v_cm.unit_price, v_c.default_meal_price, 0);
  new.vat_rate := coalesce(v_cm.vat_rate, v_c.vat_rate, 10);
  new.service_style := coalesce(v_cm.service_style, 'tabla_3goz');
  new.kind := 'sozlesmeli';
  new.delivered_qty := null;
  new.source := 'portal';
  if tg_op = 'INSERT' then
    new.menu_id := null;
    new.status := 'bekliyor';
  else
    new.menu_id := old.menu_id;
    new.customer_id := old.customer_id;
    new.status := old.status;
  end if;
  return new;
end $$;

-- 5) Aylık (sürekli) sipariş şablonu
create table if not exists public.standing_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  customer_menu_id uuid references public.customer_menus(id) on delete set null,
  meal text not null default 'ogle' check (meal in ('kahvalti','ogle','aksam','gece')),
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  default_qty int not null default 0 check (default_qty >= 0),
  weekday_qty jsonb not null default '{}'::jsonb,
  skip_dates date[] not null default '{}',
  status text not null default 'taslak' check (status in ('taslak', 'onayli')),
  generated_count int, generated_at timestamptz,
  note text, created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists standing_orders_customer_idx on public.standing_orders (customer_id, period);
create index if not exists standing_orders_cm_idx on public.standing_orders (customer_menu_id);
create trigger standing_orders_updated_at before update on public.standing_orders for each row execute function public.set_updated_at();
create trigger standing_orders_audit after insert or update or delete on public.standing_orders for each row execute function public.log_audit();
alter table public.standing_orders enable row level security;
create policy standing_orders_read on public.standing_orders for select to authenticated using ((select public.is_staff()));
create policy standing_orders_insert on public.standing_orders for insert to authenticated
  with check ((select public.has_role(array['yonetici','muhasebe','asci_basi','pazarlamaci'])));
create policy standing_orders_update on public.standing_orders for update to authenticated
  using ((select public.has_role(array['yonetici','muhasebe','asci_basi','pazarlamaci'])))
  with check ((select public.has_role(array['yonetici','muhasebe','asci_basi','pazarlamaci'])));
create policy standing_orders_delete on public.standing_orders for delete to authenticated
  using ((select public.has_role(array['yonetici','muhasebe','asci_basi','pazarlamaci'])));
revoke all on public.standing_orders from anon;
-- Ay günleri için sipariş üretir; var olan siparişi ezmez (source = 'aylik'). Dönen: eklenen satır sayısı.
create or replace function public.standing_order_generate(p_id uuid)
returns int language plpgsql security invoker set search_path = public as $$
declare s record; d date; q int; n int := 0; v_price numeric; v_vat numeric;
begin
  if not public.has_role(array['yonetici','muhasebe','asci_basi','pazarlamaci']) then
    raise exception 'Aylık siparişi yalnız yönetici, muhasebe, aşçıbaşı veya pazarlama üretir' using errcode = '42501';
  end if;
  select * into s from public.standing_orders where id = p_id for update;
  if not found then raise exception 'Aylık sipariş bulunamadı' using errcode = 'P0002'; end if;
  select default_meal_price, vat_rate into v_price, v_vat from public.customers where id = s.customer_id;
  for d in select generate_series(to_date(s.period || '-01', 'YYYY-MM-DD'), (to_date(s.period || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date, interval '1 day')::date loop
    if d = any(s.skip_dates) then continue; end if;
    q := coalesce((s.weekday_qty ->> extract(isodow from d)::int::text)::int, s.default_qty);
    if coalesce(q, 0) <= 0 then continue; end if;
    if exists (select 1 from public.meal_orders o where o.customer_id = s.customer_id and o.service_date = d and o.meal = s.meal
                 and o.status <> 'iptal' and o.customer_menu_id is not distinct from s.customer_menu_id) then continue; end if;
    insert into public.meal_orders (service_date, meal, customer_id, customer_menu_id, kind, ordered_qty, unit_price, vat_rate, source, note)
    values (d, s.meal, s.customer_id, s.customer_menu_id, 'sozlesmeli', q, coalesce(v_price, 0), coalesce(v_vat, 10), 'aylik', 'Aylık sipariş');
    n := n + 1;
  end loop;
  update public.standing_orders set status = 'onayli', generated_count = coalesce(generated_count, 0) + n, generated_at = now() where id = p_id;
  return n;
end $$;
revoke execute on function public.standing_order_generate(uuid) from public, anon;
grant execute on function public.standing_order_generate(uuid) to authenticated;

-- 6) Portal jetonları (PIN'li bakiye Faz 4'te; order_token geriye uyumlu ve senkron)
create table if not exists public.customer_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id) on delete cascade,
  token uuid not null unique,
  pin_hash text, pin_failed int not null default 0 check (pin_failed >= 0), pin_locked_until timestamptz,
  expires_at timestamptz, revoked_at timestamptz, last_used_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger customer_portal_tokens_updated_at before update on public.customer_portal_tokens for each row execute function public.set_updated_at();
alter table public.customer_portal_tokens enable row level security;
create policy customer_portal_tokens_read on public.customer_portal_tokens for select to authenticated
  using ((select public.has_role(array['yonetici','muhasebe','pazarlamaci'])));
revoke all on public.customer_portal_tokens from anon, authenticated;
grant select (id, customer_id, token, expires_at, revoked_at, last_used_at, pin_failed, pin_locked_until, created_at, updated_at) on public.customer_portal_tokens to authenticated;
insert into public.customer_portal_tokens (customer_id, token, last_used_at)
  select id, order_token, order_link_used_at from public.customers
  on conflict (customer_id) do update set token = excluded.token;
create or replace function public.sync_portal_token()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.customer_portal_tokens (customer_id, token, last_used_at) values (new.id, new.order_token, new.order_link_used_at)
  on conflict (customer_id) do update set token = excluded.token, last_used_at = excluded.last_used_at,
    revoked_at = null, pin_failed = case when public.customer_portal_tokens.token <> excluded.token then 0 else public.customer_portal_tokens.pin_failed end;
  return new;
end $$;
revoke execute on function public.sync_portal_token() from public, anon, authenticated;
drop trigger if exists customers_sync_portal_token on public.customers;
create trigger customers_sync_portal_token after insert or update of order_token, order_link_used_at on public.customers
  for each row execute function public.sync_portal_token();
-- PIN (4–6 hane) yalnız yönetici belirler; bcrypt. Kullanımı (bakiye) Faz 4'te.
create or replace function private.set_portal_pin(p_customer uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.has_role(array['yonetici']) then raise exception 'PIN''i yalnız yönetici belirler' using errcode = '42501'; end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN 4–6 haneli rakam olmalı' using errcode = '23514'; end if;
  update public.customer_portal_tokens set pin_hash = case when p_pin is null then null else extensions.crypt(p_pin, extensions.gen_salt('bf')) end,
         pin_failed = 0, pin_locked_until = null where customer_id = p_customer;
  if not found then raise exception 'Müşteri bulunamadı' using errcode = 'P0002'; end if;
end $$;
revoke execute on function private.set_portal_pin(uuid, text) from public, anon;
grant execute on function private.set_portal_pin(uuid, text) to authenticated;
create or replace function public.set_portal_pin(p_customer uuid, p_pin text)
returns void language sql security invoker set search_path = public as $$ select private.set_portal_pin(p_customer, p_pin); $$;
revoke execute on function public.set_portal_pin(uuid, text) from public, anon;
grant execute on function public.set_portal_pin(uuid, text) to authenticated;

-- 7) Hassasiyet notları, şikâyet alanları, alerjen çakışması
create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  kind text not null check (kind in ('alerji', 'hassasiyet', 'dikkat', 'tercih')),
  allergen text check (allergen is null or allergen in ('gluten','kabuklu_deniz','yumurta','balik','yer_fistigi','soya','sut','sert_kabuklu','kereviz','hardal','susam','sulfit','aci_bakla','yumusakca')),
  text text not null check (length(btrim(text)) >= 2),
  people int check (people is null or people > 0),
  active boolean not null default true,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (kind <> 'alerji' or allergen is not null));
create index if not exists customer_notes_customer_idx on public.customer_notes (customer_id) where active;
create trigger customer_notes_updated_at before update on public.customer_notes for each row execute function public.set_updated_at();
create trigger customer_notes_audit after insert or update or delete on public.customer_notes for each row execute function public.log_audit();
alter table public.customer_notes enable row level security;
create policy customer_notes_read on public.customer_notes for select to authenticated
  using ((select public.is_staff()) or customer_id = (select public.current_customer_id()));
create policy customer_notes_insert on public.customer_notes for insert to authenticated
  with check ((select public.has_role(array['yonetici','asci_basi','diyetisyen','pazarlamaci','muhasebe'])));
create policy customer_notes_update on public.customer_notes for update to authenticated
  using ((select public.has_role(array['yonetici','asci_basi','diyetisyen','pazarlamaci','muhasebe'])))
  with check ((select public.has_role(array['yonetici','asci_basi','diyetisyen','pazarlamaci','muhasebe'])));
create policy customer_notes_delete on public.customer_notes for delete to authenticated
  using ((select public.has_role(array['yonetici','asci_basi','diyetisyen'])));
revoke all on public.customer_notes from anon;
-- Şikâyet = customer_feedback (kind = 'sikayet'): kategori, önem, çözüm eklenir (ayrı tablo açılmaz)
alter table public.customer_feedback add column if not exists category text;
alter table public.customer_feedback add column if not exists severity text;
alter table public.customer_feedback add column if not exists resolution text;
alter table public.customer_feedback add column if not exists source text not null default 'personel';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'customer_feedback_category_check') then
    alter table public.customer_feedback add constraint customer_feedback_category_check
      check (category is null or category in ('lezzet','gramaj','hijyen','sicaklik','gec_teslim','eksik','yabanci_madde','servis','diger'));
    alter table public.customer_feedback add constraint customer_feedback_severity_check check (severity is null or severity in ('dusuk','orta','yuksek'));
    alter table public.customer_feedback add constraint customer_feedback_source_check check (source in ('personel','portal','musteri'));
    alter table public.customer_feedback add constraint customer_feedback_resolved_check check (status <> 'cozuldu' or kind <> 'sikayet' or length(btrim(coalesce(resolution, ''))) >= 3);
  end if;
end $$;
-- Sipariş (müşteri × gün × öğün) → geçerli menü (sipariş menüsü → firma planı → genel plan) → reçete alerjenleri ∩ müşteri alerjileri
create or replace view public.v_menu_allergen_conflicts with (security_invoker = true) as
  with o as (
    select mo.id as order_id, mo.service_date, mo.meal, mo.customer_id,
           coalesce(mo.menu_id,
                    (select mp.menu_id from public.menu_plans mp where mp.plan_date = mo.service_date and mp.meal = mo.meal and mp.customer_id = mo.customer_id),
                    (select mp.menu_id from public.menu_plans mp where mp.plan_date = mo.service_date and mp.meal = mo.meal and mp.customer_id is null)) as menu_id
      from public.meal_orders mo where mo.status <> 'iptal')
  select distinct o.order_id, o.service_date, o.meal, o.customer_id, c.name as customer_name, r.id as recipe_id, r.name as recipe_name,
         n.allergen, n.text as note, n.people
    from o
    join public.customers c on c.id = o.customer_id
    join public.menu_items mi on mi.menu_id = o.menu_id
    join public.recipes r on r.id = mi.recipe_id
    join public.recipe_ingredients ri on ri.recipe_id = r.id
    join public.ingredients i on i.id = ri.ingredient_id
    join public.customer_notes n on n.customer_id = o.customer_id and n.active and n.kind = 'alerji' and n.allergen = any(i.allergens);

-- 8) Üretim kırılımı: hangi firma, hangi menü tanımı, hangi sunum, kaç kişi
create or replace view public.v_production_breakdown with (security_invoker = true) as
  select po.id as production_order_id, o.service_date, o.meal, o.customer_id, c.name as customer_name,
         o.customer_menu_id, coalesce(cm.name, mt.name, m.name) as menu_label, mt.name as menu_type_name,
         o.service_style, ss.name as service_style_name, ss.pack_mode, ss.people_per_container,
         sum(coalesce(o.delivered_qty, o.ordered_qty))::int as people,
         case when ss.pack_mode = 'kap_basi' then ceil(sum(coalesce(o.delivered_qty, o.ordered_qty))::numeric / ss.people_per_container)::int end as containers,
         bool_or(exists (select 1 from public.customer_notes n where n.customer_id = o.customer_id and n.active and n.kind in ('alerji','hassasiyet'))) as has_sensitivity
    from public.meal_orders o
    join public.customers c on c.id = o.customer_id
    left join public.customer_menus cm on cm.id = o.customer_menu_id
    left join public.menu_types mt on mt.code = cm.menu_type_code
    left join public.menus m on m.id = coalesce(o.menu_id, cm.menu_id)
    left join public.service_styles ss on ss.code = o.service_style
    left join public.production_orders po on po.prod_date = o.service_date and po.meal = o.meal
   where o.status <> 'iptal'
   group by po.id, o.service_date, o.meal, o.customer_id, c.name, o.customer_menu_id, cm.name, mt.name, m.name, o.service_style, ss.name, ss.pack_mode, ss.people_per_container;

-- 9) Kalori (menü kartı "kalori hesaplı" sürümü): stok kartında kcal; reçetede 1 kişilik kcal
alter table public.ingredients add column if not exists kcal_100 numeric(8,2) check (kcal_100 is null or kcal_100 >= 0);
alter table public.ingredients add column if not exists kcal_unit numeric(8,2) check (kcal_unit is null or kcal_unit >= 0);
comment on column public.ingredients.kcal_100 is 'Enerji: 100 g veya 100 ml başına kcal (kütle/hacim birimli stok kartı)';
comment on column public.ingredients.kcal_unit is 'Enerji: 1 adet başına kcal (adet birimli stok kartı)';
create or replace view public.v_recipe_kcal with (security_invoker = true) as
  select ri.recipe_id,
         round(sum(case when u.dimension = 'adet' then ri.net_qty * i.kcal_unit else ri.net_qty / 100 * i.kcal_100 end), 0) as kcal_per_portion,
         count(*) as line_count,
         count(*) filter (where (u.dimension = 'adet' and i.kcal_unit is null) or (u.dimension <> 'adet' and i.kcal_100 is null)) as missing_kcal
    from public.recipe_ingredients ri
    join public.ingredients i on i.id = ri.ingredient_id
    join public.units u on u.code = i.stock_unit
   group by ri.recipe_id;

-- 10) Portal v2 (jetonla, girişsiz): tanımlı menüler, 7 günlük sipariş, ay menüsü, geri bildirim
create or replace function private.portal_customer(p_token uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  select t.customer_id into v from public.customer_portal_tokens t join public.customers c on c.id = t.customer_id
   where t.token = p_token and t.revoked_at is null and (t.expires_at is null or t.expires_at > now()) and c.active;
  if v is null then raise exception 'Link geçersiz' using errcode = '42501'; end if;
  return v;
end $$;
revoke execute on function private.portal_customer(uuid) from public, anon, authenticated;
create or replace function private.portal_info_v2(p_token uuid, p_month date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c uuid; d date := (now() at time zone 'Europe/Istanbul')::date; m0 date; v_name text;
begin
  v_c := private.portal_customer(p_token);
  m0 := date_trunc('month', coalesce(p_month, d))::date;
  select name into v_name from public.customers where id = v_c;
  return jsonb_build_object(
    'customer', v_name, 'today', d, 'month', m0,
    'menus', coalesce((select jsonb_agg(jsonb_build_object('id', cm.id, 'meal', cm.meal, 'name', coalesce(cm.name, mt.name, m.name, 'Menü'),
                         'type', mt.name, 'style', ss.name, 'is_default', cm.is_default) order by cm.meal, cm.is_default desc, cm.created_at)
                       from public.customer_menus cm left join public.menu_types mt on mt.code = cm.menu_type_code
                       left join public.menus m on m.id = cm.menu_id left join public.service_styles ss on ss.code = cm.service_style
                      where cm.customer_id = v_c and cm.active and cm.valid_from <= d + 7 and (cm.valid_to is null or cm.valid_to >= d)), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('date', o.service_date, 'meal', o.meal, 'qty', o.ordered_qty, 'status', o.status,
                          'customer_menu_id', o.customer_menu_id, 'open', public.order_is_open(o.service_date)) order by o.service_date, o.meal)
                        from public.meal_orders o where o.customer_id = v_c and o.service_date between d and d + 7 and o.status <> 'iptal'), '[]'::jsonb),
    'meals', coalesce((select jsonb_agg(distinct x.meal) from (
                         select o.meal from public.meal_orders o where o.customer_id = v_c and o.service_date > d - 60 and o.status <> 'iptal'
                         union select cm.meal from public.customer_menus cm where cm.customer_id = v_c and cm.active) x), '["ogle"]'::jsonb),
    'month_menu', coalesce((select jsonb_agg(jsonb_build_object('date', p.plan_date, 'meal', p.meal, 'own', p.customer_id is not null,
                             'dishes', (select coalesce(jsonb_agg(jsonb_build_object('name', r.name, 'course', mi.course, 'recipe_id', r.id) order by mi.sort, mi.course), '[]'::jsonb)
                                          from public.menu_items mi join public.recipes r on r.id = mi.recipe_id where mi.menu_id = p.menu_id)) order by p.plan_date, p.meal)
                           from public.menu_plans p
                          where p.plan_date >= m0 and p.plan_date < (m0 + interval '1 month')::date
                            and (p.customer_id = v_c or (p.customer_id is null and not exists (
                                   select 1 from public.menu_plans p2 where p2.plan_date = p.plan_date and p2.meal = p.meal and p2.customer_id = v_c)))), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(jsonb_build_object('date', f.menu_date, 'meal', f.meal, 'kind', f.kind, 'rating', f.rating, 'text', f.text, 'status', f.status,
                            'at', f.created_at) order by f.created_at desc)
                          from (select * from public.customer_feedback where customer_id = v_c order by created_at desc limit 20) f), '[]'::jsonb),
    'balance_available', false
  );
end $$;
revoke execute on function private.portal_info_v2(uuid, date) from public;
grant execute on function private.portal_info_v2(uuid, date) to anon, authenticated;
create or replace function public.portal_info_v2(p_token uuid, p_month date default null)
returns jsonb language sql stable security invoker set search_path = public as $$ select private.portal_info_v2(p_token, p_month); $$;
revoke execute on function public.portal_info_v2(uuid, date) from public;
grant execute on function public.portal_info_v2(uuid, date) to anon, authenticated;
create or replace function private.portal_set_order_v2(p_token uuid, p_date date, p_meal text, p_qty int, p_customer_menu_id uuid default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c uuid; o record; cm record; v_price numeric; v_vat numeric;
begin
  v_c := private.portal_customer(p_token);
  if p_meal not in ('kahvalti','ogle','aksam','gece') then raise exception 'Geçersiz öğün' using errcode = '23514'; end if;
  if p_qty is null or p_qty < 0 or p_qty > 20000 then raise exception 'Kişi sayısı geçersiz' using errcode = '23514'; end if;
  if not public.order_is_open(p_date) then raise exception 'Bu gün için sipariş süresi doldu (önceki gün 16:00)' using errcode = '42501'; end if;
  if p_customer_menu_id is not null then
    select * into cm from public.customer_menus where id = p_customer_menu_id and customer_id = v_c and active and meal = p_meal;
    if cm.id is null then raise exception 'Menü seçimi geçersiz' using errcode = '23514'; end if;
  end if;
  select default_meal_price, vat_rate into v_price, v_vat from public.customers where id = v_c;
  select * into o from public.meal_orders
   where customer_id = v_c and service_date = p_date and meal = p_meal and status <> 'iptal' and kind = 'sozlesmeli'
     and customer_menu_id is not distinct from p_customer_menu_id
   order by created_at limit 1;
  if o.id is not null then
    if o.status not in ('bekliyor','onaylandi') then raise exception 'Sipariş kilitli' using errcode = '42501'; end if;
    update public.meal_orders set ordered_qty = p_qty, note = coalesce(nullif(trim(p_note), ''), note), status = 'bekliyor', source = 'portal' where id = o.id;
  else
    insert into public.meal_orders (service_date, meal, customer_id, customer_menu_id, kind, ordered_qty, unit_price, vat_rate, note, source)
    values (p_date, p_meal, v_c, p_customer_menu_id, 'sozlesmeli', p_qty, coalesce(cm.unit_price, v_price, 0), coalesce(cm.vat_rate, v_vat, 10), nullif(trim(p_note), ''), 'portal');
  end if;
  update public.customers set order_link_used_at = now() where id = v_c;
  return private.portal_info_v2(p_token, null);
end $$;
revoke execute on function private.portal_set_order_v2(uuid, date, text, int, uuid, text) from public;
grant execute on function private.portal_set_order_v2(uuid, date, text, int, uuid, text) to anon, authenticated;
create or replace function public.portal_set_order_v2(p_token uuid, p_date date, p_meal text, p_qty int, p_customer_menu_id uuid default null, p_note text default null)
returns jsonb language sql security invoker set search_path = public as $$ select private.portal_set_order_v2(p_token, p_date, p_meal, p_qty, p_customer_menu_id, p_note); $$;
revoke execute on function public.portal_set_order_v2(uuid, date, text, int, uuid, text) from public;
grant execute on function public.portal_set_order_v2(uuid, date, text, int, uuid, text) to anon, authenticated;
-- Geri bildirim / şikâyet (portaldan). Günde en fazla 20 kayıt (kötüye kullanım sınırı).
create or replace function private.portal_feedback(p_token uuid, p_date date, p_meal text, p_kind text, p_rating int default null, p_text text default null,
                                                   p_category text default null, p_recipe_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_c uuid; v_id uuid;
begin
  v_c := private.portal_customer(p_token);
  if (select count(*) from public.customer_feedback where customer_id = v_c and source = 'portal' and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Bugün için çok fazla geri bildirim gönderildi' using errcode = '54000';
  end if;
  if p_date > (now() at time zone 'Europe/Istanbul')::date + 31 or p_date < (now() at time zone 'Europe/Istanbul')::date - 31 then
    raise exception 'Tarih son bir ay içinde olmalı' using errcode = '23514';
  end if;
  if p_kind in ('sikayet','revizyon','oneri') and length(btrim(coalesce(p_text, ''))) < 3 then
    raise exception 'Lütfen kısa bir açıklama yazın' using errcode = '23514';
  end if;
  insert into public.customer_feedback (customer_id, menu_date, meal, recipe_id, kind, rating, text, category, source, created_by)
  values (v_c, p_date, coalesce(p_meal, 'ogle'), p_recipe_id, p_kind, p_rating, left(nullif(btrim(p_text), ''), 2000), p_category, 'portal', null)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function private.portal_feedback(uuid, date, text, text, int, text, text, uuid) from public;
grant execute on function private.portal_feedback(uuid, date, text, text, int, text, text, uuid) to anon, authenticated;
create or replace function public.portal_feedback(p_token uuid, p_date date, p_meal text, p_kind text, p_rating int default null, p_text text default null,
                                                  p_category text default null, p_recipe_id uuid default null)
returns uuid language sql security invoker set search_path = public as $$ select private.portal_feedback(p_token, p_date, p_meal, p_kind, p_rating, p_text, p_category, p_recipe_id); $$;
revoke execute on function public.portal_feedback(uuid, date, text, text, int, text, text, uuid) from public;
grant execute on function public.portal_feedback(uuid, date, text, text, int, text, text, uuid) to anon, authenticated;
grant usage on schema private to anon;

-- 11) Üretim emri kontrolü: alerji çakışması uyarısı (3C mantığı aynen + 1 madde)
create or replace function public.po_check(p_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare po record; v jsonb := '[]'::jsonb; v_cutoff timestamptz;
begin
  select * into po from public.production_orders where id = p_id;
  if not found then raise exception 'Üretim emri bulunamadı' using errcode = '42501'; end if;
  if po.status not in ('taslak', 'kontrol') then raise exception 'Bu emir kontrol aşamasını geçti' using errcode = '23514'; end if;
  select v || coalesce(jsonb_agg(jsonb_build_object('tur', t.tur, 'yemek', t.dish, 'mesaj', t.msg)), '[]'::jsonb) into v from (
    select 'recetesiz' tur, c.dish_name dish, 'Reçetesi yok: maliyet ve kalibrasyon çıkmaz' msg from public.v_prep_batch_costs c where c.prep_date = po.prod_date and c.meal = po.meal and c.recipe_id is null
    union all select 'bos', c.dish_name, 'Malzemesi girilmedi' from public.v_prep_batch_costs c where c.prep_date = po.prod_date and c.meal = po.meal and coalesce(c.item_count, 0) = 0
    union all select 'fiyatsiz', c.dish_name, format('%s malzemenin fiyatı yok', c.missing_price_count) from public.v_prep_batch_costs c where c.prep_date = po.prod_date and c.meal = po.meal and coalesce(c.missing_price_count, 0) > 0
    union all select 'kisi_yok', c.dish_name, 'Kişi sayısı yok' from public.v_prep_batch_costs c where c.prep_date = po.prod_date and c.meal = po.meal and c.portions is null
  ) t;
  select v || coalesce(jsonb_agg(jsonb_build_object('tur', 'stok_yetersiz', 'malzeme', s.name, 'mesaj', format('Gereken %s %s, depoda %s %s', round(s.need, 2), s.unit, round(s.on_hand, 2), s.unit))), '[]'::jsonb) into v from (
    select i.name, i.stock_unit unit, sum(it.qty * u.to_base / su.to_base) need, coalesce((select sum(m.qty) from public.stock_movements m where m.ingredient_id = i.id), 0) on_hand
      from public.prep_batch_items it join public.prep_batches pb on pb.id = it.batch_id join public.ingredients i on i.id = it.ingredient_id
      join public.units u on u.code = it.unit join public.units su on su.code = i.stock_unit
     where pb.prep_date = po.prod_date and pb.meal = po.meal and exists (select 1 from public.stock_movements m where m.ingredient_id = i.id)
       and not exists (select 1 from public.stock_movements m where m.source in ('hazirlik', 'uretim') and m.source_id = pb.id)
     group by i.id, i.name, i.stock_unit) s where s.need > s.on_hand;
  select v || coalesce(jsonb_agg(jsonb_build_object('tur', 'gramaj_sapma', 'yemek', k.dish, 'malzeme', k.name,
           'mesaj', format('Kişi başı %s g/ml planlandı, alışılmış %s (%%%s)', round(k.planned, 1), round(k.norm, 1), round((k.planned / k.norm - 1) * 100)))), '[]'::jsonb) into v from (
    select pb.dish_name dish, i.name, sum(it.qty * u.to_base) / pb.portions planned, ri.calib_qty / (1 - coalesce(ri.waste_pct_override, i.waste_pct) / 100) norm
      from public.prep_batch_items it join public.prep_batches pb on pb.id = it.batch_id join public.units u on u.code = it.unit
      join public.ingredients i on i.id = it.ingredient_id join public.recipe_ingredients ri on ri.recipe_id = pb.recipe_id and ri.ingredient_id = it.ingredient_id
     where pb.prep_date = po.prod_date and pb.meal = po.meal and pb.portions > 0 and ri.calib_n >= 3 and ri.calib_qty > 0
     group by pb.id, pb.dish_name, pb.portions, i.name, ri.calib_qty, ri.waste_pct_override, i.waste_pct) k where abs(k.planned / k.norm - 1) > 0.25;
  v_cutoff := ((po.prod_date - 1)::timestamp + time '16:00') at time zone 'Europe/Istanbul';
  select v || coalesce(jsonb_agg(jsonb_build_object('tur', 'kesim_sonrasi', 'yemek', c.name, 'mesaj', format('%s siparişi kesimden sonra değişti', c.name))), '[]'::jsonb) into v
    from public.meal_orders o join public.customers c on c.id = o.customer_id where o.service_date = po.prod_date and o.meal = po.meal and o.updated_at > v_cutoff and o.status <> 'iptal';
  -- Faz 3D: müşteri alerjisi ile menüdeki yemek çakışıyorsa kırmızı uyarı
  select v || coalesce(jsonb_agg(jsonb_build_object('tur', 'alerji', 'yemek', a.recipe_name, 'firma', a.customer_name,
           'mesaj', format('%s: %s alerjisi — %s içeriyor%s', a.customer_name, a.allergen, a.recipe_name, case when a.people is not null then format(' (%s kişi)', a.people) else '' end))), '[]'::jsonb) into v
    from (select distinct customer_name, allergen, recipe_name, people from public.v_menu_allergen_conflicts where service_date = po.prod_date and meal = po.meal) a;
  update public.production_orders set anomalies = v, status = 'kontrol', checked_by = auth.uid(), checked_at = now() where id = p_id;
  return v;
end $$;

-- 12) RLS (referans tabloları), gerçek zamanlı yayın
alter table public.menu_types enable row level security;
alter table public.service_styles enable row level security;
alter table public.service_style_items enable row level security;
create policy menu_types_read on public.menu_types for select to authenticated using ((select public.is_staff()) or (select public.current_customer_id()) is not null);
create policy menu_types_write on public.menu_types for insert to authenticated with check ((select public.has_role(array['yonetici','asci_basi'])));
create policy menu_types_update on public.menu_types for update to authenticated
  using ((select public.has_role(array['yonetici','asci_basi']))) with check ((select public.has_role(array['yonetici','asci_basi'])));
create policy service_styles_read on public.service_styles for select to authenticated using ((select public.is_staff()) or (select public.current_customer_id()) is not null);
create policy service_styles_write on public.service_styles for insert to authenticated with check ((select public.has_role(array['yonetici'])));
create policy service_styles_update on public.service_styles for update to authenticated
  using ((select public.has_role(array['yonetici']))) with check ((select public.has_role(array['yonetici'])));
create policy service_style_items_read on public.service_style_items for select to authenticated using ((select public.is_staff()));
create policy service_style_items_insert on public.service_style_items for insert to authenticated with check ((select public.has_role(array['yonetici','satinalma'])));
create policy service_style_items_update on public.service_style_items for update to authenticated
  using ((select public.has_role(array['yonetici','satinalma']))) with check ((select public.has_role(array['yonetici','satinalma'])));
create policy service_style_items_delete on public.service_style_items for delete to authenticated using ((select public.has_role(array['yonetici','satinalma'])));
revoke all on public.menu_types, public.service_styles, public.service_style_items from anon;
revoke delete, truncate on public.menu_types, public.service_styles from authenticated;
create trigger service_style_items_audit after insert or update or delete on public.service_style_items for each row execute function public.log_audit();
do $$
declare t text;
begin
  foreach t in array array['customer_feedback', 'monthly_menus', 'monthly_menu_days', 'customer_notes'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
