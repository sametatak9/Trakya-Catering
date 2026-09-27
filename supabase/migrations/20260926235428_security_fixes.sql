-- Faz 3A — güvenlik, bütünlük ve temizlik (ANA-PROMPT §2, §8 Faz 3A)
-- Yalnız eklemeli: mevcut tablo/sütun silinmez; politikalar aynı adlarla yeniden yazılır.

-- ─────────────────────────────────────────────────────────────
-- S-1: maaş / IBAN sızıntısı. Personel kartını yalnız yönetici, muhasebe ve kişinin kendisi okur.
-- Diğer personel için yalnız ad, unvan, bölüm, telefon içeren rehber görünümü.
-- ─────────────────────────────────────────────────────────────
drop policy if exists employees_read on public.employees;
create policy employees_read on public.employees for select to authenticated
  using ((select public.has_role(array['yonetici','muhasebe'])) or user_id = (select auth.uid()));

-- Rehber ayrı tabloda tutulur (tetikleyiciyle eşitlenir); böylece SECURITY DEFINER görünüm gerekmez.
create table if not exists public.employee_directory (
  id uuid primary key references public.employees(id) on delete cascade,
  full_name text not null,
  title text,
  department text,
  phone text,
  active boolean not null default true
);
alter table public.employee_directory enable row level security;
drop policy if exists employee_directory_read on public.employee_directory;
create policy employee_directory_read on public.employee_directory for select to authenticated
  using ((select public.is_staff()));
revoke all on public.employee_directory from anon;
revoke insert, update, delete, truncate, trigger, references on public.employee_directory from authenticated;

create or replace function public.sync_employee_directory()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.employee_directory where id = old.id;
    return old;
  end if;
  insert into public.employee_directory (id, full_name, title, department, phone, active)
  values (new.id, new.full_name, new.title, new.department, new.phone, new.active)
  on conflict (id) do update set full_name = excluded.full_name, title = excluded.title,
    department = excluded.department, phone = excluded.phone, active = excluded.active;
  return new;
end $$;
revoke execute on function public.sync_employee_directory() from public, anon, authenticated;
drop trigger if exists employees_directory_sync on public.employees;
create trigger employees_directory_sync after insert or update or delete on public.employees
  for each row execute function public.sync_employee_directory();
insert into public.employee_directory (id, full_name, title, department, phone, active)
  select id, full_name, title, department, phone, active from public.employees
  on conflict (id) do nothing;

create or replace view public.v_employee_directory with (security_invoker = true) as
  select id, full_name, title, department, phone, active from public.employee_directory;
comment on view public.v_employee_directory is 'Personel rehberi: maaş/IBAN içermez. Tüm personel okur (is_staff).';
revoke all on public.v_employee_directory from anon;
grant select on public.v_employee_directory to authenticated;

-- ─────────────────────────────────────────────────────────────
-- S-4: yönetici kendini/başkasını kurucu yapamaz, kendi rolünü değiştiremez.
-- ─────────────────────────────────────────────────────────────
drop policy if exists team_members_insert on public.team_members;
create policy team_members_insert on public.team_members for insert to authenticated
  with check ((select public.has_role(array['yonetici']))
              and (role <> 'kurucu' or (select public.current_app_role()) = 'kurucu'));
drop policy if exists team_members_update on public.team_members;
create policy team_members_update on public.team_members for update to authenticated
  using ((select public.has_role(array['yonetici']))
         and (role <> 'kurucu' or (select public.current_app_role()) = 'kurucu')
         and (user_id <> (select auth.uid()) or (select public.current_app_role()) = 'kurucu'))
  with check ((select public.has_role(array['yonetici']))
              and (role <> 'kurucu' or (select public.current_app_role()) = 'kurucu')
              and (user_id <> (select auth.uid()) or (select public.current_app_role()) = 'kurucu'));
drop policy if exists team_members_delete on public.team_members;
create policy team_members_delete on public.team_members for delete to authenticated
  using ((select public.has_role(array['yonetici']))
         and (role <> 'kurucu' or (select public.current_app_role()) = 'kurucu'));
drop policy if exists team_members_read on public.team_members;
create policy team_members_read on public.team_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_role(array['yonetici'])));

-- ─────────────────────────────────────────────────────────────
-- S-2: portal müşterisi fiyat, KDV, tür, menü ve teslim miktarı yazamaz.
-- ─────────────────────────────────────────────────────────────
create or replace function public.enforce_portal_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_c record;
begin
  if public.current_app_role() is distinct from 'musteri' then return new; end if;
  select default_meal_price, vat_rate into v_c from public.customers where id = new.customer_id;
  new.unit_price := coalesce(v_c.default_meal_price, 0);
  new.vat_rate := coalesce(v_c.vat_rate, 10);
  new.kind := 'sozlesmeli';
  new.delivered_qty := null;
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
revoke execute on function public.enforce_portal_order() from public, anon, authenticated;
drop trigger if exists meal_orders_enforce_portal on public.meal_orders;
create trigger meal_orders_enforce_portal before insert or update on public.meal_orders
  for each row execute function public.enforce_portal_order();

-- Birleşik politikalar (advisor 0006): personel + portal tek politika
drop policy if exists meal_orders_read on public.meal_orders;
drop policy if exists meal_orders_portal_read on public.meal_orders;
create policy meal_orders_read on public.meal_orders for select to authenticated
  using ((select public.is_staff()) or customer_id = (select public.current_customer_id()));
drop policy if exists meal_orders_insert on public.meal_orders;
drop policy if exists meal_orders_portal_insert on public.meal_orders;
create policy meal_orders_insert on public.meal_orders for insert to authenticated
  with check ((select public.has_role(array['yonetici','muhasebe','asci_basi','pazarlamaci']))
              or (customer_id = (select public.current_customer_id()) and status = 'bekliyor' and public.order_is_open(service_date)));
drop policy if exists meal_orders_update on public.meal_orders;
drop policy if exists meal_orders_portal_update on public.meal_orders;
create policy meal_orders_update on public.meal_orders for update to authenticated
  using ((select public.has_role(array['yonetici','muhasebe','asci_basi','pazarlamaci']))
         or (customer_id = (select public.current_customer_id()) and status = 'bekliyor' and public.order_is_open(service_date)))
  with check ((select public.has_role(array['yonetici','muhasebe','asci_basi','pazarlamaci']))
              or (customer_id = (select public.current_customer_id()) and status = 'bekliyor' and public.order_is_open(service_date)));

drop policy if exists customers_read on public.customers;
drop policy if exists customers_portal_read on public.customers;
create policy customers_read on public.customers for select to authenticated
  using ((select public.is_staff()) or id = (select public.current_customer_id()));

-- ─────────────────────────────────────────────────────────────
-- S-3: personel kendi talebini onaylı ekleyemez. (Birleşik insert politikası)
-- ─────────────────────────────────────────────────────────────
drop policy if exists employee_requests_insert on public.employee_requests;
drop policy if exists employee_requests_self_insert on public.employee_requests;
create policy employee_requests_insert on public.employee_requests for insert to authenticated
  with check ((select public.has_role(array['yonetici','muhasebe']))
              or (status = 'bekliyor' and decided_by is null
                  and exists (select 1 from public.employees e where e.id = employee_id and e.user_id = (select auth.uid()))));

drop policy if exists chat_messages_delete on public.chat_messages;
create policy chat_messages_delete on public.chat_messages for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.has_role(array['yonetici'])));

-- ─────────────────────────────────────────────────────────────
-- Birim değişimi (devir 2) + fiyat sütunu yetkisi (devir 4)
-- last_price / avg_cost yalnız fiyat ve stok tetikleyicileriyle (SECURITY DEFINER) değişir.
-- stock_unit değişirse aynı boyutta tüm fiyat/miktarlar çevrilir; farklı boyut reddedilir.
-- ─────────────────────────────────────────────────────────────
create or replace function public.ingredients_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare f numeric; o record; n record; v_hist boolean;
begin
  if current_user in ('authenticated', 'anon')
     and (new.last_price is distinct from old.last_price or new.avg_cost is distinct from old.avg_cost
          or new.price_updated_at is distinct from old.price_updated_at) then
    raise exception 'Fiyat doğrudan değiştirilemez; fiyat kaydı veya fatura ile güncelleyin' using errcode = '42501';
  end if;
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
    -- SECURITY DEFINER içinde çalışır; değişmezlik tetikleyicisi yalnız API rollerini durdurur
    update public.stock_movements set qty = round(qty * f, 4), unit_cost = round(unit_cost / f, 6) where ingredient_id = old.id;
  end if;
  return new;
end $$;
revoke execute on function public.ingredients_guard() from public, anon, authenticated;

-- B-4: fiyat girişi yalnız last_price'ı değiştirir; avg_cost yalnız stok girişinden hesaplanır.
create or replace function public.apply_ingredient_price()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.ingredients i
     set last_price = new.price,
         price_updated_at = new.noted_at
   where i.id = new.ingredient_id
     and (i.price_updated_at is null or i.price_updated_at <= new.noted_at);
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────
-- B-3 + muhasebe kuralı: stok girişi tek kapıdan; tedarikçi etiketi.
-- ─────────────────────────────────────────────────────────────
alter table public.purchase_invoices add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null;
alter table public.stock_movements add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
create index if not exists purchase_invoices_po_idx on public.purchase_invoices (purchase_order_id);
create index if not exists stock_movements_supplier_idx on public.stock_movements (supplier_id);
create index if not exists stock_movements_source_idx on public.stock_movements (source, source_id);
create unique index if not exists stock_movements_src_uidx on public.stock_movements (source, source_id, ingredient_id)
  where source in ('fatura', 'siparis', 'hazirlik', 'uretim') and source_id is not null;
comment on column public.stock_movements.qty is 'Stok biriminde işaretli miktar. giris > 0; cikis/sevk/fire < 0; sayim = sayım farkı (delta), sayılan miktar değil.';

create or replace function public.stock_single_entry()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_po uuid; v_tax text;
begin
  if new.kind <> 'giris' then return new; end if;
  if new.source = 'fatura' and new.source_id is not null then
    select purchase_order_id, supplier_tax_no into v_po, v_tax from public.purchase_invoices where id = new.source_id;
    if v_po is not null and exists (select 1 from public.stock_movements
         where source = 'siparis' and source_id = v_po and ingredient_id = new.ingredient_id) then
      raise exception 'Bu mal satınalma siparişi teslim alınırken stoğa girdi; fatura yalnız fiyatı günceller' using errcode = '23505';
    end if;
    if new.supplier_id is null then
      new.supplier_id := coalesce((select supplier_id from public.purchase_orders where id = v_po),
                                  (select id from public.suppliers where v_tax is not null and tax_no = v_tax limit 1));
    end if;
  elsif new.source = 'siparis' and new.source_id is not null then
    if exists (select 1 from public.stock_movements m join public.purchase_invoices pi on pi.id = m.source_id
                where m.source = 'fatura' and pi.purchase_order_id = new.source_id and m.ingredient_id = new.ingredient_id) then
      raise exception 'Bu mal faturayla zaten stoğa girdi; sipariş teslimi ikinci kez stok eklemez' using errcode = '23505';
    end if;
    if new.supplier_id is null then
      new.supplier_id := (select supplier_id from public.purchase_orders where id = new.source_id);
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.stock_single_entry() from public, anon, authenticated;
drop trigger if exists stock_movements_single_entry on public.stock_movements;
create trigger stock_movements_single_entry before insert on public.stock_movements
  for each row execute function public.stock_single_entry();

-- B-5: stok hareketleri değişmez (düzeltme = ters kayıt). Yalnız yönetici düzeltir/siler; şoför yalnız sevk yazar.
create or replace function public.stock_movements_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(array['yonetici']) and current_user in ('authenticated', 'anon') then
    raise exception 'Stok hareketi değiştirilemez; ters kayıtla düzeltin' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.stock_movements_immutable() from public, anon, authenticated;
drop trigger if exists stock_movements_immutable on public.stock_movements;
create trigger stock_movements_immutable before update or delete on public.stock_movements
  for each row execute function public.stock_movements_immutable();

drop trigger if exists ingredients_guard on public.ingredients;
create trigger ingredients_guard before update on public.ingredients
  for each row execute function public.ingredients_guard();

drop policy if exists stock_movements_insert on public.stock_movements;
create policy stock_movements_insert on public.stock_movements for insert to authenticated
  with check ((select public.has_role(array['yonetici','depo','asci_basi','satinalma']))
              or ((select public.current_app_role()) = 'sofor' and kind = 'sevk'));
drop policy if exists stock_movements_update on public.stock_movements;
create policy stock_movements_update on public.stock_movements for update to authenticated
  using ((select public.has_role(array['yonetici']))) with check ((select public.has_role(array['yonetici'])));
drop policy if exists stock_movements_delete on public.stock_movements;
create policy stock_movements_delete on public.stock_movements for delete to authenticated
  using ((select public.has_role(array['yonetici'])));

-- ─────────────────────────────────────────────────────────────
-- B-1: fiyatsız teslim sessizce gelirsiz kalmasın.
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_order_entry()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_qty int;
  v_cust record;
begin
  if tg_op = 'DELETE' then
    delete from public.finance_entries where source = 'siparis' and source_id = old.id and status = 'bekliyor';
    return old;
  end if;
  v_qty := coalesce(new.delivered_qty, new.ordered_qty);
  select name, payment_term_days into v_cust from public.customers where id = new.customer_id;
  if new.status = 'teslim_edildi' and v_qty > 0 and coalesce(new.unit_price, 0) = 0 then
    raise exception 'Kişi başı fiyat girilmemiş: % (müşteri kartına veya siparişe fiyat yazın)', v_cust.name using errcode = '23514';
  end if;
  if new.status = 'teslim_edildi' and v_qty > 0 then
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

-- ─────────────────────────────────────────────────────────────
-- Denetim kaydı değişmezliği + hash zinciri
-- ─────────────────────────────────────────────────────────────
alter table public.audit_log add column if not exists prev_hash text;
alter table public.audit_log add column if not exists hash text;
alter table public.audit_log add column if not exists chain_seq bigint;
create unique index if not exists audit_log_chain_seq_uidx on public.audit_log (chain_seq);

create or replace function public.audit_row_hash(p_prev text, p public.audit_log)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(p_prev, '') || '|' || p.id::text || '|' || extract(epoch from p.at)::text || '|' || coalesce(p.actor::text, '')
    || '|' || coalesce(p.actor_kind, '') || '|' || coalesce(p.action, '') || '|' || coalesce(p.entity_type, '') || '|'
    || coalesce(p.entity_id, '') || '|' || coalesce(p.summary, '') || '|' || coalesce(p.diff::text, ''), 'sha256'), 'hex');
$$;

-- Mevcut satırlar için zincir başlangıcı (tetikleyiciden önce)
do $$
declare r public.audit_log; v_prev text := null; v_h text;
begin
  for r in select * from public.audit_log where chain_seq is null order by id loop
    v_h := public.audit_row_hash(v_prev, r);
    update public.audit_log set prev_hash = v_prev, hash = v_h,
      chain_seq = coalesce((select max(chain_seq) from public.audit_log), 0) + 1 where id = r.id;
    v_prev := v_h;
  end loop;
end $$;

create or replace function public.audit_chain()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  -- Zincir sırası kilit altında verilir: eşzamanlı yazımlarda id sırası değil chain_seq geçerlidir
  perform pg_advisory_xact_lock(hashtext('audit_log_chain'));
  select hash, chain_seq + 1 into new.prev_hash, new.chain_seq from public.audit_log order by chain_seq desc nulls last limit 1;
  new.chain_seq := coalesce(new.chain_seq, 1);
  new.at := coalesce(new.at, now());
  new.hash := public.audit_row_hash(new.prev_hash, new);
  return new;
end $$;
drop trigger if exists audit_log_chain on public.audit_log;
create trigger audit_log_chain before insert on public.audit_log for each row execute function public.audit_chain();

create or replace function public.forbid_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Denetim kaydı değiştirilemez (%)', tg_table_name using errcode = '42501';
end $$;
drop trigger if exists audit_log_immutable on public.audit_log;
create trigger audit_log_immutable before update or delete on public.audit_log for each row execute function public.forbid_mutation();
drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate before truncate on public.audit_log for each statement execute function public.forbid_mutation();
revoke update, delete, truncate on public.audit_log from public, anon, authenticated, service_role;

create or replace function public.verify_audit_chain()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare r public.audit_log; v_prev text := null;
begin
  if not public.has_role(array['yonetici','muhasebe']) and current_user in ('authenticated','anon') then
    raise exception 'Yetki yok' using errcode = '42501';
  end if;
  for r in select * from public.audit_log order by chain_seq loop
    if r.prev_hash is distinct from v_prev or r.hash is distinct from public.audit_row_hash(v_prev, r) then return false; end if;
    v_prev := r.hash;
  end loop;
  return true;
end $$;
revoke execute on function public.verify_audit_chain() from public, anon;
grant execute on function public.verify_audit_chain() to authenticated;
revoke execute on function public.audit_chain() from public, anon, authenticated;
revoke execute on function public.forbid_mutation() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- İstemci hata yakalama
-- ─────────────────────────────────────────────────────────────
create table if not exists public.error_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  kind text not null default 'hata' check (kind in ('ekran','pencere','soz','istek','hata')),
  message text not null,
  stack text,
  route text,
  user_agent text,
  context jsonb not null default '{}'::jsonb,
  fingerprint text,
  resolved boolean not null default false
);
create index if not exists error_events_at_idx on public.error_events (at desc);
create index if not exists error_events_user_idx on public.error_events (user_id, at desc);
alter table public.error_events enable row level security;
drop policy if exists error_events_read on public.error_events;
create policy error_events_read on public.error_events for select to authenticated
  using ((select public.has_role(array['yonetici'])));
drop policy if exists error_events_update on public.error_events;
create policy error_events_update on public.error_events for update to authenticated
  using ((select public.has_role(array['yonetici']))) with check ((select public.has_role(array['yonetici'])));

create or replace function public.mask_pii(p text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[e-posta]', 'g'),
    'TR\d{2}[ ]?(\d{4}[ ]?){5}\d{2}', '[iban]', 'gi'),
    '(\+?90[ ]?)?0?5\d{2}[ ]?\d{3}[ ]?\d{2}[ ]?\d{2}', '[telefon]', 'g'),
    '(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', '[anahtar]', 'gi');
$$;

create or replace function public.log_client_error(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_msg text;
begin
  if v_uid is null then return; end if;
  if (select count(*) from public.error_events where user_id = v_uid and at > now() - interval '1 minute') >= 20 then return; end if;
  v_msg := left(public.mask_pii(p->>'message'), 1000);
  if coalesce(v_msg, '') = '' then return; end if;
  insert into public.error_events (user_id, kind, message, stack, route, user_agent, context, fingerprint)
  values (v_uid,
          case when p->>'kind' in ('ekran','pencere','soz','istek','hata') then p->>'kind' else 'hata' end,
          v_msg, left(public.mask_pii(p->>'stack'), 4000), left(p->>'route', 300), left(p->>'user_agent', 300),
          case when p ? 'context' then jsonb_build_object('metin', left(public.mask_pii((p->'context')::text), 2000)) else '{}'::jsonb end,
          md5(coalesce(p->>'kind','') || left(v_msg, 200)));
exception when others then
  return; -- hata kaydı asla kullanıcı işini bozmaz
end $$;
revoke execute on function public.log_client_error(jsonb) from public, anon;
grant execute on function public.log_client_error(jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Realtime: canlı ekranlar (bakiye, sipariş, hazırlık, stok)
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['meal_orders','prep_batches','employee_ledger','stock_movements','finance_entries','employee_requests'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Advisor: indekssiz yabancı anahtarlar
-- ─────────────────────────────────────────────────────────────
create index if not exists chat_messages_author_idx on public.chat_messages (author_id);
create index if not exists cheques_customer_idx on public.cheques (customer_id);
create index if not exists cheques_account_idx on public.cheques (account_id);
create index if not exists cheques_supplier_idx on public.cheques (supplier_id);
create index if not exists delivery_notes_invoice_idx on public.delivery_notes (sales_invoice_id);
create index if not exists delivery_notes_customer_idx on public.delivery_notes (customer_id);
create index if not exists employee_ledger_account_idx on public.employee_ledger (account_id);
create index if not exists employee_requests_employee_idx on public.employee_requests (employee_id);
create index if not exists employees_user_idx on public.employees (user_id);
create index if not exists field_visits_lead_idx on public.field_visits (lead_id);
create index if not exists field_visits_customer_idx on public.field_visits (customer_id);
create index if not exists field_visits_user_idx on public.field_visits (user_id);
create index if not exists finance_entries_catkind_idx on public.finance_entries (category_code, kind);
create index if not exists finance_entries_account_idx on public.finance_entries (account_id);
create index if not exists finance_entries_customer_idx on public.finance_entries (customer_id);
create index if not exists ingredients_unit_idx on public.ingredients (stock_unit);
create index if not exists leads_assigned_idx on public.leads (assigned_to);
create index if not exists meal_orders_customer_idx on public.meal_orders (customer_id, service_date);
create index if not exists meal_orders_menu_idx on public.meal_orders (menu_id);
create index if not exists menu_plans_menu_idx on public.menu_plans (menu_id);
create index if not exists menu_plans_customer_idx on public.menu_plans (customer_id);
create index if not exists prep_batch_items_unit_idx on public.prep_batch_items (unit);
create index if not exists prep_batches_customer_idx on public.prep_batches (customer_id);
create index if not exists prep_batches_recipe_idx on public.prep_batches (recipe_id);
create index if not exists prep_batches_menu_idx on public.prep_batches (menu_id);
create index if not exists purchase_invoices_catkind_idx on public.purchase_invoices (category_code, kind);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index if not exists quotes_lead_idx on public.quotes (lead_id);
create index if not exists quotes_customer_idx on public.quotes (customer_id);
create index if not exists quotes_menu_idx on public.quotes (menu_id);
create index if not exists recipes_category_idx on public.recipes (category_code);
create index if not exists routes_vehicle_idx on public.routes (vehicle_id);
create index if not exists routes_driver_idx on public.routes (driver_id);
create index if not exists sales_invoices_customer_idx on public.sales_invoices (customer_id);
create index if not exists supplier_categories_category_idx on public.supplier_categories (category_code);
create index if not exists supplier_quotes_supplier_idx on public.supplier_quotes (supplier_id);
create index if not exists team_members_customer_idx on public.team_members (customer_id);
create index if not exists vehicle_logs_account_idx on public.vehicle_logs (account_id);
create index if not exists vehicles_driver_idx on public.vehicles (driver_id);

-- ─────────────────────────────────────────────────────────────
-- S-6: derinlemesine savunma — gereksiz tablo yetkileri
-- ─────────────────────────────────────────────────────────────
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
