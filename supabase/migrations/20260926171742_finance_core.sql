-- TRAKYA CATERING ERP — 6: müşteri, sipariş, günlük üretim maliyeti ve finans çekirdeği
--   Gelir/gider tek defterde (finance_entries). Gelen fatura onaylanınca, sipariş teslim edilince
--   deftere otomatik kayıt düşer. Gider kategorileri "ucu açık": kullanıcı yenisini ekleyebilir.

-- ---------------------------------------------------------------------
-- Yeni roller: diyetisyen (menü/gramaj/üretim), pazarlamaci (müşteri/teklif/saha)
-- ---------------------------------------------------------------------
alter table public.team_members drop constraint if exists team_members_role_check;
alter table public.team_members add constraint team_members_role_check
  check (role in ('yonetici','asci_basi','diyetisyen','depo','satinalma','muhasebe','pazarlamaci','sofor','musteri'));

-- Diyetisyen reçete ve menü yazabilir
do $$
declare t text;
begin
  foreach t in array array['recipes','recipe_ingredients','menus','menu_items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_role(array[''yonetici'',''asci_basi'',''diyetisyen'']))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(array[''yonetici'',''asci_basi'',''diyetisyen''])) with check (public.has_role(array[''yonetici'',''asci_basi'',''diyetisyen'']))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_role(array[''yonetici'',''asci_basi'',''diyetisyen'']))', t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Müşteriler (cari)
-- ---------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'kurum' check (kind in ('kurum','sahis')),
  tax_no text check (tax_no is null or tax_no ~ '^[0-9]{10,11}$'),   -- VKN (10) / TCKN (11)
  tax_office text,
  address text,
  city text,
  district text,
  contact_name text,
  phone text,
  email text,
  default_meal_price numeric(12,2) check (default_meal_price is null or default_meal_price >= 0), -- kişi başı, KDV hariç
  vat_rate numeric(5,2) not null default 10 check (vat_rate >= 0),
  payment_term_days int not null default 30 check (payment_term_days >= 0),
  e_invoice boolean not null default false,   -- e-fatura mükellefi mi (değilse e-arşiv)
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists customers_name_uidx on public.customers (lower(name));
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();

alter table public.team_members
  add constraint team_members_customer_fk foreign key (customer_id) references public.customers(id) on delete restrict;

-- ---------------------------------------------------------------------
-- Siparişler (D-1 yemek sayıları + organizasyon/özel gün siparişleri)
-- ---------------------------------------------------------------------
create table if not exists public.meal_orders (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  meal text not null default 'ogle' check (meal in ('kahvalti','ogle','aksam','gece')),
  customer_id uuid not null references public.customers(id) on delete restrict,
  menu_id uuid references public.menus(id) on delete set null,
  kind text not null default 'sozlesmeli' check (kind in ('sozlesmeli','organizasyon')),
  ordered_qty int not null check (ordered_qty >= 0),
  delivered_qty int check (delivered_qty is null or delivered_qty >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),   -- kişi başı, KDV hariç
  vat_rate numeric(5,2) not null default 10 check (vat_rate >= 0),
  status text not null default 'bekliyor' check (status in ('bekliyor','onaylandi','teslim_edildi','iptal')),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists meal_orders_slot_uidx
  on public.meal_orders (service_date, meal, customer_id, coalesce(menu_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status <> 'iptal';
create index if not exists meal_orders_date_idx on public.meal_orders (service_date);
create trigger meal_orders_updated_at before update on public.meal_orders for each row execute function public.set_updated_at();

-- Müşteri portalı kesim saati: ertesi günün siparişi en geç bugün 16:00 (İstanbul)
create or replace function public.order_is_open(p_service_date date) returns boolean
language sql stable set search_path = public as $$
  select p_service_date > (now() at time zone 'Europe/Istanbul')::date + 1
      or (p_service_date = (now() at time zone 'Europe/Istanbul')::date + 1
          and (now() at time zone 'Europe/Istanbul')::time < time '16:00');
$$;

-- ---------------------------------------------------------------------
-- Günlük üretim: o gün hangi reçeteden kaç porsiyon çıktı + o günkü maliyet (fotoğraf)
-- ---------------------------------------------------------------------
create table if not exists public.production_logs (
  id uuid primary key default gen_random_uuid(),
  prod_date date not null,
  meal text not null default 'ogle' check (meal in ('kahvalti','ogle','aksam','gece')),
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  menu_id uuid references public.menus(id) on delete set null,
  portions numeric(10,2) not null check (portions > 0),
  unit_cost numeric(14,4) not null default 0,   -- kayıt anındaki porsiyon maliyeti (sonraki fiyat değişimi geçmişi bozmaz)
  source text not null default 'manuel' check (source in ('manuel','siparis')),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prod_date, meal, recipe_id)
);
create index if not exists production_logs_date_idx on public.production_logs (prod_date);
create trigger production_logs_updated_at before update on public.production_logs for each row execute function public.set_updated_at();

create or replace function public.snapshot_production_cost() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.recipe_id is distinct from old.recipe_id then
    select coalesce(rc.cost_last, 0) into new.unit_cost from public.v_recipe_costs rc where rc.recipe_id = new.recipe_id;
    new.unit_cost := coalesce(new.unit_cost, 0);
  end if;
  return new;
end $$;
create trigger production_logs_cost before insert or update on public.production_logs
  for each row execute function public.snapshot_production_cost();

-- Günün siparişlerinden üretim listesini kur (menü kapları × kişi sayısı × porsiyon katsayısı)
create or replace function public.plan_production_from_orders(p_date date, p_meal text)
returns int
language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  delete from public.production_logs where prod_date = p_date and meal = p_meal and source = 'siparis';
  insert into public.production_logs (prod_date, meal, recipe_id, menu_id, portions, source)
  select p_date, p_meal, mi.recipe_id, min(o.menu_id::text)::uuid,
         sum(coalesce(o.delivered_qty, o.ordered_qty) * mi.portion_factor), 'siparis'
  from public.meal_orders o
  join public.menu_items mi on mi.menu_id = o.menu_id
  where o.service_date = p_date and o.meal = p_meal and o.status <> 'iptal'
  group by mi.recipe_id
  having sum(coalesce(o.delivered_qty, o.ordered_qty) * mi.portion_factor) > 0
  on conflict (prod_date, meal, recipe_id) do nothing;   -- elle girilmiş satır korunur
  get diagnostics n = row_count;
  return n;
end $$;

-- Bir günün maliyet fotoğrafını güncel fiyatlarla yenile
create or replace function public.refresh_production_costs(p_date date)
returns int
language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  update public.production_logs pl
     set unit_cost = coalesce(rc.cost_last, 0)
    from public.v_recipe_costs rc
   where rc.recipe_id = pl.recipe_id and pl.prod_date = p_date;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Finans: kategoriler (ucu açık), hesaplar (kasa/banka), defter
-- ---------------------------------------------------------------------
create table if not exists public.finance_categories (
  code text primary key,
  name text not null,
  kind text not null check (kind in ('gelir','gider')),
  group_name text not null,
  keywords text[] not null default '{}',   -- gelen faturada otomatik tespit için
  sort int not null default 100,
  active boolean not null default true,
  unique (code, kind)
);
insert into public.finance_categories (code, name, kind, group_name, keywords, sort) values
  ('tabldot_satis',   'Tabldot / sözleşmeli yemek', 'gelir', 'Satış', '{}', 10),
  ('organizasyon',    'Organizasyon & özel gün (mevlüt, düğün…)', 'gelir', 'Satış', '{}', 20),
  ('diger_gelir',     'Diğer gelir (atık yağ, hurda…)', 'gelir', 'Diğer', '{}', 90),

  ('gida_hammadde',   'Gıda & hammadde', 'gider', 'Mutfak', '{kasap,et,tavuk,piliç,manav,sebze,meyve,bakliyat,pirinç,bulgur,un,yağ,süt,yoğurt,peynir,toptan,gıda,market}', 10),
  ('mutfak_sarf',     'Ambalaj, sefer tası & hijyen', 'gider', 'Mutfak', '{ambalaj,kap,folyo,streç,eldiven,bone,deterjan,hijyen,temizlik,dezenfektan,peçete}', 20),
  ('elektrik',        'Elektrik', 'gider', 'İşletme', '{elektrik,enerjisa,ck enerji,boğaziçi,aydem,uludağ elektrik,trakya elektrik,edaş,tedaş,kwh}', 30),
  ('su',              'Su', 'gider', 'İşletme', '{su idaresi,iski,aski,izsu,buski,tesk,su ve kanalizasyon,m3}', 40),
  ('dogalgaz',        'Doğalgaz / LPG', 'gider', 'İşletme', '{doğalgaz,dogalgaz,igdaş,igdas,başkentgaz,trakya gaz,palgaz,lpg,aygaz,ipragaz}', 50),
  ('kira',            'Kira', 'gider', 'İşletme', '{kira,kiralama bedeli,stopaj}', 60),
  ('iletisim',        'İnternet & telefon', 'gider', 'İşletme', '{türk telekom,turkcell,vodafone,superonline,internet,fiber,gsm}', 70),
  ('akaryakit',       'Akaryakıt (mazot)', 'gider', 'Araç & Sevkiyat', '{akaryakıt,akaryakit,motorin,mazot,benzin,shell,opet,petrol ofisi,bp,total,aytemiz,lukoil}', 80),
  ('arac_bakim',      'Araç bakım & onarım', 'gider', 'Araç & Sevkiyat', '{oto,servis,lastik,yedek parça,araç bakım,muayene}', 90),
  ('arac_sigorta',    'Araç sigorta, MTV & HGS', 'gider', 'Araç & Sevkiyat', '{sigorta,kasko,trafik sigortası,mtv,hgs,ogs}', 100),
  ('ekipman_bakim',   'Mutfak ekipman bakım', 'gider', 'Bakım & Demirbaş', '{kazan,fırın,soğuk hava,klima,teknik servis,bakım}', 110),
  ('demirbas',        'Demirbaş alımı', 'gider', 'Bakım & Demirbaş', '{demirbaş,makine,ekipman}', 120),
  ('personel_maas',   'Personel maaş', 'gider', 'Personel', '{maaş,ücret}', 130),
  ('personel_sgk',    'SGK & vergi (personel)', 'gider', 'Personel', '{sgk,muhtasar,damga}', 140),
  ('muhasebe_hukuk',  'Muhasebe & danışmanlık', 'gider', 'Diğer', '{muhasebe,mali müşavir,avukat,danışmanlık}', 150),
  ('vergi_harc',      'Vergi, harç & belediye', 'gider', 'Diğer', '{belediye,harç,vergi dairesi,çevre temizlik}', 160),
  ('diger_gider',     'Diğer gider', 'gider', 'Diğer', '{}', 900)
on conflict (code) do nothing;

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('kasa','banka','kredi_karti')),
  opening_balance numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.finance_accounts (name, kind) values ('Nakit Kasa', 'kasa'), ('Banka', 'banka') on conflict (name) do nothing;

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  kind text not null check (kind in ('gelir','gider')),
  category_code text not null,
  description text not null,
  net_amount numeric(14,2) not null check (net_amount >= 0),
  vat_amount numeric(14,2) not null default 0 check (vat_amount >= 0),
  total_amount numeric(14,2) generated always as (net_amount + vat_amount) stored,
  counterparty text,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'odendi' check (status in ('odendi','bekliyor')),   -- bekliyor = alacak/borç
  account_id uuid references public.finance_accounts(id) on delete restrict,
  due_date date,
  paid_at date,
  source text not null default 'manuel' check (source in ('manuel','gelen_fatura','siparis','maas')),
  source_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_code, kind) references public.finance_categories(code, kind) on update cascade,
  constraint finance_entries_paid_account check (status = 'bekliyor' or account_id is not null)
);
create unique index if not exists finance_entries_source_uidx on public.finance_entries (source, source_id) where source_id is not null;
create index if not exists finance_entries_date_idx on public.finance_entries (entry_date desc);
create index if not exists finance_entries_cat_idx on public.finance_entries (category_code, entry_date);
create trigger finance_entries_updated_at before update on public.finance_entries for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Gelen faturalar (e-fatura UBL-TR / manuel) ve tedarikçi → kategori hafızası
-- ---------------------------------------------------------------------
create table if not exists public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null,
  supplier_tax_no text,
  invoice_no text not null,
  invoice_date date not null,
  ettn uuid unique,                          -- e-fatura evrensel tekil numarası
  category_code text not null,
  kind text not null default 'gider' check (kind = 'gider'),
  net_amount numeric(14,2) not null check (net_amount >= 0),
  vat_amount numeric(14,2) not null default 0 check (vat_amount >= 0),
  total_amount numeric(14,2) not null check (total_amount >= 0),   -- ödenecek tutar (tevkifat sonrası)
  due_date date,
  status text not null default 'taslak' check (status in ('taslak','onaylandi','reddedildi')),
  source text not null default 'manuel' check (source in ('manuel','ubl_xml','entegrator')),
  lines jsonb not null default '[]',
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_code, kind) references public.finance_categories(code, kind) on update cascade,
  unique (supplier_tax_no, invoice_no)
);
create index if not exists purchase_invoices_date_idx on public.purchase_invoices (invoice_date desc);
create trigger purchase_invoices_updated_at before update on public.purchase_invoices for each row execute function public.set_updated_at();

create table if not exists public.supplier_categories (
  supplier_key text primary key,            -- VKN, yoksa küçük harf unvan
  supplier_name text not null,
  category_code text not null references public.finance_categories(code) on update cascade,
  updated_at timestamptz not null default now()
);

-- Fatura onaylanınca deftere gider (borç) olarak düşer, tedarikçinin kategorisi hatırlanır
create or replace function public.sync_invoice_entry() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.finance_entries where source = 'gelen_fatura' and source_id = old.id and status = 'bekliyor';
    return old;
  end if;
  if new.status = 'onaylandi' then
    insert into public.finance_entries (entry_date, kind, category_code, description, net_amount, vat_amount,
                                        counterparty, status, due_date, source, source_id, created_by)
    values (new.invoice_date, 'gider', new.category_code, format('Fatura %s', new.invoice_no),
            new.net_amount, greatest(new.total_amount - new.net_amount, 0),
            new.supplier_name, 'bekliyor', coalesce(new.due_date, new.invoice_date), 'gelen_fatura', new.id, auth.uid())
    on conflict (source, source_id) where source_id is not null do update set
      entry_date = excluded.entry_date, category_code = excluded.category_code, description = excluded.description,
      net_amount = excluded.net_amount, vat_amount = excluded.vat_amount, counterparty = excluded.counterparty,
      due_date = excluded.due_date;
    insert into public.supplier_categories (supplier_key, supplier_name, category_code)
    values (coalesce(nullif(new.supplier_tax_no, ''), lower(new.supplier_name)), new.supplier_name, new.category_code)
    on conflict (supplier_key) do update set category_code = excluded.category_code, supplier_name = excluded.supplier_name, updated_at = now();
  else
    delete from public.finance_entries where source = 'gelen_fatura' and source_id = new.id and status = 'bekliyor';
  end if;
  return new;
end $$;
revoke execute on function public.sync_invoice_entry() from public, anon, authenticated;
create trigger purchase_invoices_sync after insert or update or delete on public.purchase_invoices
  for each row execute function public.sync_invoice_entry();

-- Sipariş teslim edilince deftere gelir (alacak) olarak düşer; teslim geri alınırsa kalkar
create or replace function public.sync_order_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_qty int;
  v_cust record;
begin
  if tg_op = 'DELETE' then
    delete from public.finance_entries where source = 'siparis' and source_id = old.id and status = 'bekliyor';
    return old;
  end if;
  v_qty := coalesce(new.delivered_qty, new.ordered_qty);
  if new.status = 'teslim_edildi' and v_qty > 0 and new.unit_price > 0 then
    select name, payment_term_days into v_cust from public.customers where id = new.customer_id;
    insert into public.finance_entries (entry_date, kind, category_code, description, net_amount, vat_amount,
                                        counterparty, customer_id, status, due_date, source, source_id, created_by)
    values (new.service_date, 'gelir',
            case when new.kind = 'organizasyon' then 'organizasyon' else 'tabldot_satis' end,
            format('%s kişi × %s ₺', v_qty, new.unit_price),
            round(v_qty * new.unit_price, 2), round(v_qty * new.unit_price * new.vat_rate / 100, 2),
            v_cust.name, new.customer_id, 'bekliyor', new.service_date + v_cust.payment_term_days, 'siparis', new.id, auth.uid())
    on conflict (source, source_id) where source_id is not null do update set
      entry_date = excluded.entry_date, category_code = excluded.category_code, description = excluded.description,
      net_amount = excluded.net_amount, vat_amount = excluded.vat_amount, counterparty = excluded.counterparty,
      customer_id = excluded.customer_id, due_date = excluded.due_date;
  else
    delete from public.finance_entries where source = 'siparis' and source_id = new.id and status = 'bekliyor';
  end if;
  return new;
end $$;
revoke execute on function public.sync_order_entry() from public, anon, authenticated;
create trigger meal_orders_sync after insert or update or delete on public.meal_orders
  for each row execute function public.sync_order_entry();

-- Hesap bakiyeleri
create or replace view public.v_account_balances with (security_invoker = true) as
select a.id, a.name, a.kind, a.opening_balance,
       a.opening_balance
       + coalesce(sum(e.total_amount) filter (where e.kind = 'gelir' and e.status = 'odendi'), 0)
       - coalesce(sum(e.total_amount) filter (where e.kind = 'gider' and e.status = 'odendi'), 0) as balance
from public.finance_accounts a
left join public.finance_entries e on e.account_id = a.id
where a.active
group by a.id;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.meal_orders enable row level security;
alter table public.production_logs enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_entries enable row level security;
alter table public.purchase_invoices enable row level security;
alter table public.supplier_categories enable row level security;

do $$
declare spec record;
begin
  for spec in
    select * from (values
      -- tablo,               okuyanlar (null = tüm personel),                         yazanlar
      ('customers',           null::text[],                                            array['yonetici','muhasebe','pazarlamaci']),
      ('meal_orders',         null::text[],                                            array['yonetici','muhasebe','asci_basi','pazarlamaci']),
      ('production_logs',     null::text[],                                            array['yonetici','asci_basi','diyetisyen']),
      ('finance_categories',  null::text[],                                            array['yonetici','muhasebe']),
      ('finance_accounts',    array['yonetici','muhasebe'],                            array['yonetici','muhasebe']),
      ('finance_entries',     array['yonetici','muhasebe'],                            array['yonetici','muhasebe']),
      ('purchase_invoices',   array['yonetici','muhasebe','satinalma'],                array['yonetici','muhasebe','satinalma']),
      ('supplier_categories', array['yonetici','muhasebe','satinalma'],                array['yonetici','muhasebe','satinalma'])
    ) as s(tbl, readers, writers)
  loop
    if spec.readers is null then
      execute format('create policy %I on public.%I for select to authenticated using (public.is_staff())', spec.tbl || '_read', spec.tbl);
    else
      execute format('create policy %I on public.%I for select to authenticated using (public.has_role(%L))', spec.tbl || '_read', spec.tbl, spec.readers);
    end if;
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_role(%L))', spec.tbl || '_insert', spec.tbl, spec.writers);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_role(%L)) with check (public.has_role(%L))', spec.tbl || '_update', spec.tbl, spec.writers, spec.writers);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_role(%L))', spec.tbl || '_delete', spec.tbl, spec.writers);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.log_audit()', spec.tbl || '_audit', spec.tbl);
  end loop;
end $$;

-- Müşteri portalı: yalnız kendi kartı ve kendi siparişleri; kesim saatinden önce ekleyip değiştirebilir
create policy customers_portal_read on public.customers for select to authenticated
  using (id = public.current_customer_id());
create policy meal_orders_portal_read on public.meal_orders for select to authenticated
  using (customer_id = public.current_customer_id());
create policy meal_orders_portal_insert on public.meal_orders for insert to authenticated
  with check (customer_id = public.current_customer_id() and status = 'bekliyor' and public.order_is_open(service_date));
create policy meal_orders_portal_update on public.meal_orders for update to authenticated
  using (customer_id = public.current_customer_id() and status = 'bekliyor' and public.order_is_open(service_date))
  with check (customer_id = public.current_customer_id() and status = 'bekliyor' and public.order_is_open(service_date));

revoke execute on function public.plan_production_from_orders(date, text), public.refresh_production_costs(date) from public, anon;
grant execute on function public.plan_production_from_orders(date, text), public.refresh_production_costs(date) to authenticated;
revoke execute on function public.snapshot_production_cost() from public, anon, authenticated;
