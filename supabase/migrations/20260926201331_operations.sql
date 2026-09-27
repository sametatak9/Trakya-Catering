-- TRAKYA CATERING ERP — 9: işletmenin geri kalanı
-- Kurucu paneli (yetki matrisi) · Personel, puantaj, personel defteri (canlı bakiye), izin/avans talepleri, kartvizit
-- Stok hareketleri (alış faturasından giriş, hazırlıktan çıkış, firmalara sevk) · Tedarikçiler, fiyat teklifleri, satınalma siparişleri
-- Cari: irsaliye/makbuz → satış faturası (e-fatura entegratörü sonra) · Çek & senet
-- Filo: araç, yakıt/bakım/km kaydı, rota (harita) · Kurumsal teklif · Pazarlama: aday firma, saha ziyareti · Sosyal medya içerik havuzu
--
-- İlke: yeni tablolar düz tablodur; bakiye/özet hesapları istemcide (src/lib/*) testli fonksiyonlarla yapılır.
-- Finansa dokunan kayıtlar (personel ödemesi, araç gideri) tetikleyiciyle finance_entries'e yazılır.

-- ---------------------------------------------------------------------
-- 0) Kurucu rolü: her şeye tam yetki; üyeliklerin görebileceği modülleri belirler
-- ---------------------------------------------------------------------
alter table public.team_members drop constraint if exists team_members_role_check;
alter table public.team_members add constraint team_members_role_check
  check (role in ('kurucu','yonetici','asci_basi','diyetisyen','depo','satinalma','muhasebe','pazarlamaci','sofor','musteri'));

create or replace function public.has_role(p_roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'kurucu' or public.current_app_role() = any(p_roles), false);
$$;

create or replace function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = old.user_id) then
    return old;  -- auth kullanıcısı silinirken (cascade) engelleme
  end if;
  if old.role in ('kurucu','yonetici') and old.active
     and (tg_op = 'DELETE' or new.role not in ('kurucu','yonetici') or not new.active)
     and not exists (select 1 from public.team_members
                     where role in ('kurucu','yonetici') and active and user_id <> old.user_id) then
    raise exception 'Son aktif kurucu/yönetici kaldırılamaz' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.bootstrap_first_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.team_members) then
    insert into public.team_members (user_id, full_name, role)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'kurucu');
  end if;
  return new;
end $$;

-- Rol × modül yetkisi ve kişiye özel istisna. level: yok | gor | yaz
create table if not exists public.role_permissions (
  role text not null,
  module text not null,
  level text not null check (level in ('yok','gor','yaz')),
  updated_at timestamptz not null default now(),
  primary key (role, module)
);
create table if not exists public.member_permissions (
  user_id uuid not null references public.team_members(user_id) on delete cascade,
  module text not null,
  level text not null check (level in ('yok','gor','yaz')),
  updated_at timestamptz not null default now(),
  primary key (user_id, module)
);

-- ---------------------------------------------------------------------
-- 1) Personel
-- ---------------------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  title text,
  department text not null default 'mutfak' check (department in ('mutfak','servis','sevkiyat','depo','idari','satis','temizlik')),
  phone text,
  email text,
  pay_type text not null default 'aylik' check (pay_type in ('aylik','yevmiye')),
  monthly_salary numeric(12,2) check (monthly_salary is null or monthly_salary >= 0),
  daily_wage numeric(12,2) check (daily_wage is null or daily_wage >= 0),
  daily_hours numeric(4,1) not null default 10 check (daily_hours > 0 and daily_hours <= 16),
  overtime_rate numeric(4,2) not null default 1.5 check (overtime_rate >= 1),
  device_user_id text unique,                -- parmak izi cihazındaki (ZKTeco) kullanıcı no
  iban text,
  start_date date,
  user_id uuid references public.team_members(user_id) on delete set null,
  card_slug text unique check (card_slug ~ '^[a-z0-9-]{3,60}$'),
  card_public boolean not null default true,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger employees_updated_at before update on public.employees for each row execute function public.set_updated_at();

-- Günlük yoklama: cihazdan (ZKTeco dışa aktarım) veya elle. Kaydı olmayan iş günü = yok.
create table if not exists public.attendance_days (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  first_in time,
  last_out time,
  worked_minutes int check (worked_minutes is null or worked_minutes between 0 and 1440),
  status text not null default 'var' check (status in ('var','yok','izinli','raporlu','tatil')),
  source text not null default 'elle' check (source in ('zkteco','elle')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);
create trigger attendance_days_updated_at before update on public.attendance_days for each row execute function public.set_updated_at();

-- Personel defteri: hakediş (+), prim (+), avans (−), kesinti (−), ödeme (−) → canlı bakiye = firmanın personele borcu
create table if not exists public.employee_ledger (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  entry_date date not null,
  kind text not null check (kind in ('hakedis','prim','avans','kesinti','odeme')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  period text,                               -- ör. 2026-09 (hakediş dönemi)
  account_id uuid references public.finance_accounts(id) on delete restrict,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint employee_ledger_cash check (kind not in ('avans','odeme') or account_id is not null)
);
create index if not exists employee_ledger_emp_idx on public.employee_ledger (employee_id, entry_date);

create table if not exists public.employee_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  kind text not null check (kind in ('izin','avans','mesai')),
  start_date date,
  end_date date,
  amount numeric(12,2),
  status text not null default 'bekliyor' check (status in ('bekliyor','onaylandi','reddedildi')),
  note text,
  decided_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger employee_requests_updated_at before update on public.employee_requests for each row execute function public.set_updated_at();

-- Kartvizit: herkese açık sayfa (/kart/:slug) yalnız bu fonksiyonla okur
create or replace function public.public_card(p_slug text)
returns table (full_name text, title text, department text, phone text, email text,
               company text, company_phone text, website text, address text)
language sql stable security definer set search_path = public as $$
  select e.full_name, e.title, e.department, e.phone, e.email,
         c.legal_name, c.phone, c.website, concat_ws(', ', c.address, c.city)
  from public.employees e cross join public.company_settings c
  where e.card_slug = p_slug and e.card_public and e.active;
$$;
revoke execute on function public.public_card(text) from public;
grant execute on function public.public_card(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Stok, sevk, tedarik
-- ---------------------------------------------------------------------
alter table public.customers add column if not exists lat numeric(9,6);
alter table public.customers add column if not exists lng numeric(9,6);

-- qty işaretli ve hammaddenin stok biriminde: + giriş, − çıkış
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  move_date date not null default current_date,
  kind text not null check (kind in ('giris','cikis','sevk','fire','sayim')),
  qty numeric(14,3) not null check (qty <> 0),
  unit_cost numeric(14,4) check (unit_cost is null or unit_cost >= 0),
  source text not null default 'elle' check (source in ('fatura','hazirlik','sevk','elle','sayim','siparis')),
  source_id uuid,
  customer_id uuid references public.customers(id) on delete set null,  -- sevk: hangi firmaya
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint stock_sign check ((kind = 'giris' and qty > 0) or (kind in ('cikis','sevk','fire') and qty < 0) or kind = 'sayim'),
  constraint stock_sevk_customer check (kind <> 'sevk' or customer_id is not null)
);
create index if not exists stock_movements_ing_idx on public.stock_movements (ingredient_id, move_date);
create index if not exists stock_movements_cust_idx on public.stock_movements (customer_id, move_date) where customer_id is not null;

-- Girişte ağırlıklı ortalama maliyet güncellenir
create or replace function public.apply_stock_cost() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_on_hand numeric; v_avg numeric;
begin
  if new.kind = 'giris' and new.unit_cost is not null then
    select coalesce(sum(qty), 0) - new.qty into v_on_hand from public.stock_movements where ingredient_id = new.ingredient_id;
    select avg_cost into v_avg from public.ingredients where id = new.ingredient_id;
    update public.ingredients set avg_cost = case
      when v_on_hand <= 0 or v_avg is null then new.unit_cost
      else round((v_on_hand * v_avg + new.qty * new.unit_cost) / (v_on_hand + new.qty), 4) end
    where id = new.ingredient_id;
  end if;
  return new;
end $$;
revoke execute on function public.apply_stock_cost() from public, anon, authenticated;
create trigger stock_movements_cost after insert on public.stock_movements for each row execute function public.apply_stock_cost();

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_no text,
  contact_name text,
  phone text,
  email text,
  city text,
  categories text[] not null default '{}',
  payment_term_days int not null default 30 check (payment_term_days >= 0),
  rating int check (rating between 1 and 5),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists suppliers_name_uidx on public.suppliers (lower(name));
create trigger suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();

-- Tedarikçi fiyat kayıtları (teklif, telefon, fatura) — "en uygun mal" buradan
create table if not exists public.supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  price numeric(14,4) not null check (price >= 0),        -- hammaddenin stok birimi başına, KDV hariç
  quoted_at date not null default current_date,
  source text not null default 'teklif' check (source in ('teklif','telefon','fatura','web')),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists supplier_quotes_ing_idx on public.supplier_quotes (ingredient_id, quoted_at desc);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  order_date date not null default current_date,
  delivery_date date,
  status text not null default 'taslak' check (status in ('taslak','verildi','teslim','iptal')),
  lines jsonb not null default '[]',         -- [{ingredient_id, qty, unit_price}]
  total numeric(14,2) not null default 0,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger purchase_orders_updated_at before update on public.purchase_orders for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3) Cari: irsaliye / makbuz ve satış faturası
-- ---------------------------------------------------------------------
create table if not exists public.delivery_notes (
  id uuid primary key default gen_random_uuid(),
  doc_no text not null unique,
  doc_type text not null default 'irsaliye' check (doc_type in ('irsaliye','makbuz')),
  customer_id uuid not null references public.customers(id) on delete restrict,
  note_date date not null,
  lines jsonb not null default '[]',         -- [{order_id, meal, qty, unit_price, vat_rate}]
  net_amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  status text not null default 'acik' check (status in ('acik','faturalandi','iptal')),
  sales_invoice_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger delivery_notes_updated_at before update on public.delivery_notes for each row execute function public.set_updated_at();

create table if not exists public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_date date not null,
  period_from date,
  period_to date,
  lines jsonb not null default '[]',
  net_amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  status text not null default 'taslak' check (status in ('taslak','gonderildi','iptal')),
  einvoice_status text not null default 'bekliyor' check (einvoice_status in ('bekliyor','gonderildi','hata','e_arsiv')),
  ettn uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sales_invoices_updated_at before update on public.sales_invoices for each row execute function public.set_updated_at();
alter table public.delivery_notes drop constraint if exists delivery_notes_invoice_fk;
alter table public.delivery_notes add constraint delivery_notes_invoice_fk foreign key (sales_invoice_id) references public.sales_invoices(id) on delete set null;

-- ---------------------------------------------------------------------
-- 4) Çek & senet
-- ---------------------------------------------------------------------
create table if not exists public.cheques (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'cek' check (kind in ('cek','senet')),
  direction text not null check (direction in ('alinan','verilen')),
  counterparty text not null,
  customer_id uuid references public.customers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  bank text,
  serial_no text,
  amount numeric(14,2) not null check (amount > 0),
  issue_date date not null default current_date,
  due_date date not null,
  status text not null default 'portfoy' check (status in ('portfoy','tahsil','odendi','ciro','karsiliksiz','iade')),
  account_id uuid references public.finance_accounts(id) on delete restrict,
  endorsed_to text,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger cheques_updated_at before update on public.cheques for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5) Filo ve rota
-- ---------------------------------------------------------------------
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  name text not null,
  kind text not null default 'frigorifik' check (kind in ('frigorifik','panelvan','kamyonet','binek','diger')),
  driver_id uuid references public.employees(id) on delete set null,
  current_km int not null default 0 check (current_km >= 0),
  inspection_due date,
  insurance_due date,
  service_every_km int default 15000,
  last_service_km int,
  tracker text check (tracker in ('arvento','mobiliz')),
  tracker_ref text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger vehicles_updated_at before update on public.vehicles for each row execute function public.set_updated_at();

create table if not exists public.vehicle_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  log_date date not null default current_date,
  kind text not null check (kind in ('yakit','bakim','km','ariza','sigorta','diger')),
  km int check (km is null or km >= 0),
  liters numeric(8,2),
  amount numeric(12,2) check (amount is null or amount >= 0),
  place text,
  note text,
  source text not null default 'elle' check (source in ('elle','arvento','mobiliz','fis')),
  account_id uuid references public.finance_accounts(id) on delete restrict,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists vehicle_logs_idx on public.vehicle_logs (vehicle_id, log_date);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  route_date date not null,
  name text not null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  driver_id uuid references public.employees(id) on delete set null,
  status text not null default 'plan' check (status in ('plan','yolda','tamam')),
  stops jsonb not null default '[]',         -- [{customer_id, eta, done, done_at, note}]
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger routes_updated_at before update on public.routes for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6) Satış: kurumsal teklif, aday firma, saha ziyareti, sosyal medya
-- ---------------------------------------------------------------------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_no text not null unique,
  company_name text not null,
  customer_id uuid references public.customers(id) on delete set null,
  lead_id uuid,
  contact_name text,
  phone text,
  quote_date date not null default current_date,
  valid_until date,
  people_per_day int not null check (people_per_day > 0),
  days_per_month int not null default 26 check (days_per_month between 1 and 31),
  menu_id uuid references public.menus(id) on delete set null,
  food_cost numeric(12,4) not null default 0,     -- kişi başı hammadde
  overhead_cost numeric(12,4) not null default 0, -- kişi başı genel gider payı
  margin_pct numeric(5,2) not null default 20,
  unit_price numeric(12,2) not null,              -- kişi başı teklif, KDV hariç
  vat_rate numeric(5,2) not null default 10,
  status text not null default 'taslak' check (status in ('taslak','gonderildi','kabul','red')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger quotes_updated_at before update on public.quotes for each row execute function public.set_updated_at();

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,
  city text,
  district text,
  address text,
  phone text,
  website text,
  employees_est int,
  source text not null default 'elle' check (source in ('bot','elle','referans','liste')),
  source_note text,
  status text not null default 'yeni' check (status in ('yeni','arandi','ziyaret','teklif','kazanildi','kaybedildi')),
  assigned_to uuid references public.team_members(user_id) on delete set null,
  lat numeric(9,6),
  lng numeric(9,6),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists leads_name_uidx on public.leads (lower(name), coalesce(district, ''));
create trigger leads_updated_at before update on public.leads for each row execute function public.set_updated_at();
alter table public.quotes drop constraint if exists quotes_lead_fk;
alter table public.quotes add constraint quotes_lead_fk foreign key (lead_id) references public.leads(id) on delete set null;

create table if not exists public.field_visits (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null default current_date,
  planned boolean not null default true,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  user_id uuid references public.team_members(user_id) on delete set null,
  user_name text,
  photo_path text,                           -- depolama yolu (visit-photos) veya küçük görsel
  feedback text,
  outcome text check (outcome in ('olumlu','dusunuyor','olumsuz','tekrar')),
  next_date date,
  done boolean not null default false,
  manager_checked boolean not null default false,
  manager_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_visit_target check (lead_id is not null or customer_id is not null)
);
create trigger field_visits_updated_at before update on public.field_visits for each row execute function public.set_updated_at();

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  platforms text[] not null default '{instagram}',
  media_note text,
  planned_at timestamptz,
  status text not null default 'havuz' check (status in ('havuz','taslak','onay','planlandi','yayinlandi')),
  source text not null default 'elle' check (source in ('elle','bot')),
  tags text[] not null default '{}',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger social_posts_updated_at before update on public.social_posts for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 7) Finansa bağlantılar: personel ödemesi/avansı ve araç gideri kasa/bankadan düşer
-- ---------------------------------------------------------------------
alter table public.finance_entries drop constraint if exists finance_entries_source_check;
alter table public.finance_entries add constraint finance_entries_source_check
  check (source in ('manuel','gelen_fatura','siparis','maas','personel','arac'));

create or replace function public.sync_ledger_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if tg_op = 'DELETE' then
    delete from public.finance_entries where source = 'personel' and source_id = old.id;
    return old;
  end if;
  if new.kind in ('avans','odeme') then
    select full_name into v_name from public.employees where id = new.employee_id;
    insert into public.finance_entries (entry_date, kind, category_code, description, net_amount, vat_amount,
                                        counterparty, status, account_id, paid_at, source, source_id, created_by)
    values (new.entry_date, 'gider', 'personel_maas',
            case new.kind when 'avans' then 'Personel avansı' else 'Personel ödemesi' end || coalesce(' · ' || new.description, ''),
            new.amount, 0, v_name, 'odendi', new.account_id, new.entry_date, 'personel', new.id, auth.uid())
    on conflict (source, source_id) where source_id is not null do update set
      entry_date = excluded.entry_date, net_amount = excluded.net_amount, account_id = excluded.account_id,
      paid_at = excluded.paid_at, description = excluded.description;
  else
    delete from public.finance_entries where source = 'personel' and source_id = new.id;
  end if;
  return new;
end $$;
revoke execute on function public.sync_ledger_entry() from public, anon, authenticated;
create trigger employee_ledger_sync after insert or update or delete on public.employee_ledger
  for each row execute function public.sync_ledger_entry();

create or replace function public.sync_vehicle_entry() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_plate text;
begin
  if tg_op = 'DELETE' then
    delete from public.finance_entries where source = 'arac' and source_id = old.id;
    return old;
  end if;
  if new.km is not null then
    update public.vehicles set current_km = greatest(current_km, new.km),
      last_service_km = case when new.kind = 'bakim' then new.km else last_service_km end
    where id = new.vehicle_id;
  end if;
  if coalesce(new.amount, 0) > 0 then
    select plate into v_plate from public.vehicles where id = new.vehicle_id;
    insert into public.finance_entries (entry_date, kind, category_code, description, net_amount, vat_amount,
                                        counterparty, status, account_id, paid_at, due_date, source, source_id, created_by)
    values (new.log_date, 'gider',
            case new.kind when 'yakit' then 'akaryakit' when 'sigorta' then 'arac_sigorta' else 'arac_bakim' end,
            v_plate || ' · ' || case new.kind when 'yakit' then 'Yakıt' || coalesce(' ' || new.liters || ' lt', '') when 'bakim' then 'Bakım' when 'ariza' then 'Arıza' when 'sigorta' then 'Sigorta' else 'Araç gideri' end,
            new.amount, 0, coalesce(new.place, v_plate),
            case when new.account_id is null then 'bekliyor' else 'odendi' end, new.account_id,
            case when new.account_id is null then null else new.log_date end, new.log_date, 'arac', new.id, auth.uid())
    on conflict (source, source_id) where source_id is not null do update set
      entry_date = excluded.entry_date, category_code = excluded.category_code, description = excluded.description,
      net_amount = excluded.net_amount, status = excluded.status, account_id = excluded.account_id, paid_at = excluded.paid_at;
  else
    delete from public.finance_entries where source = 'arac' and source_id = new.id;
  end if;
  return new;
end $$;
revoke execute on function public.sync_vehicle_entry() from public, anon, authenticated;
create trigger vehicle_logs_sync after insert or update or delete on public.vehicle_logs
  for each row execute function public.sync_vehicle_entry();

-- ---------------------------------------------------------------------
-- 8) RLS
-- ---------------------------------------------------------------------
do $$
declare spec record;
begin
  for spec in
    select * from (values
      -- tablo,               okuyanlar (null = tüm personel),                               yazanlar
      ('role_permissions',    null::text[],                                                  array['kurucu']),
      ('member_permissions',  null::text[],                                                  array['kurucu']),
      ('employees',           null::text[],                                                  array['yonetici','muhasebe']),
      ('attendance_days',     array['yonetici','muhasebe'],                                  array['yonetici','muhasebe']),
      ('employee_ledger',     array['yonetici','muhasebe'],                                  array['yonetici','muhasebe']),
      ('employee_requests',   null::text[],                                                  array['yonetici','muhasebe']),
      ('stock_movements',     null::text[],                                                  array['yonetici','depo','asci_basi','satinalma','sofor']),
      ('suppliers',           null::text[],                                                  array['yonetici','satinalma','muhasebe']),
      ('supplier_quotes',     null::text[],                                                  array['yonetici','satinalma']),
      ('purchase_orders',     null::text[],                                                  array['yonetici','satinalma']),
      ('delivery_notes',      null::text[],                                                  array['yonetici','muhasebe','sofor']),
      ('sales_invoices',      array['yonetici','muhasebe'],                                  array['yonetici','muhasebe']),
      ('cheques',             array['yonetici','muhasebe'],                                  array['yonetici','muhasebe']),
      ('vehicles',            null::text[],                                                  array['yonetici','sofor']),
      ('vehicle_logs',        null::text[],                                                  array['yonetici','sofor','muhasebe']),
      ('routes',              null::text[],                                                  array['yonetici','sofor']),
      ('quotes',              array['yonetici','muhasebe','pazarlamaci'],                    array['yonetici','pazarlamaci']),
      ('leads',               array['yonetici','pazarlamaci'],                               array['yonetici','pazarlamaci']),
      ('field_visits',        array['yonetici','pazarlamaci'],                               array['yonetici','pazarlamaci']),
      ('social_posts',        array['yonetici','pazarlamaci'],                               array['yonetici','pazarlamaci'])
    ) as s(tbl, readers, writers)
  loop
    execute format('alter table public.%I enable row level security', spec.tbl);
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

-- Personel kendi talebini açabilir; şoför kendi rotasındaki durağı işaretler (rota yazma yetkisi sofor'da)
create policy employee_requests_self_insert on public.employee_requests for insert to authenticated
  with check (exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()));
-- Pazarlamacı kendi ziyaretini görür/yazar (yukarıdaki rol politikası zaten kapsıyor); yönetici hepsini

-- Ziyaret fotoğrafları için özel depolama alanı
insert into storage.buckets (id, name, public) values ('visit-photos', 'visit-photos', false) on conflict (id) do nothing;
create policy visit_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'visit-photos' and public.has_role(array['yonetici','pazarlamaci']));
create policy visit_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'visit-photos' and public.has_role(array['yonetici','pazarlamaci']));
