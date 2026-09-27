-- Kullanıcı notu I (1. adım): müşteri portalı yetkilisi = TC + telefon eşleşmesi; bağlantı onay merkezinden geçer. Yalnızca eklemeli.
create or replace function public.portal_tc_valid(p_tc text)
returns boolean language plpgsql immutable set search_path = public as $$
declare d int[]; i int; odd int := 0; even int := 0;
begin
  if p_tc is null or p_tc !~ '^[1-9][0-9]{10}$' then return false; end if;
  for i in 1..11 loop d[i] := substr(p_tc, i, 1)::int; end loop;
  odd := d[1] + d[3] + d[5] + d[7] + d[9];
  even := d[2] + d[4] + d[6] + d[8];
  if ((odd * 7 - even) % 10 + 10) % 10 <> d[10] then return false; end if;
  if (odd + even + d[10]) % 10 <> d[11] then return false; end if;
  return true;
end $$;

create or replace function public.portal_tc_hmac(p_tc text)
returns text language plpgsql stable security definer set search_path = public, extensions as $$
declare v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'portal_tc_pepper' limit 1;
  if v_key is null or length(v_key) < 32 then
    raise exception 'Portal gizli anahtarı (Vault: portal_tc_pepper, en az 32 karakter) yapılandırılmamış' using errcode = '55000';
  end if;
  return encode(extensions.hmac(p_tc, v_key, 'sha256'), 'hex');
end $$;
revoke execute on function public.portal_tc_hmac(text) from public, anon, authenticated;

create table if not exists public.portal_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) >= 2),
  phone_e164 text not null unique check (phone_e164 ~ '^\+90[0-9]{10}$'),
  tc_hmac text not null check (tc_hmac ~ '^[0-9a-f]{64}$'),
  tc_hint text not null check (tc_hint ~ '^[0-9]{2}$'),
  active boolean not null default true,
  failed_count int not null default 0 check (failed_count >= 0),
  locked_until timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portal_contacts_customer_idx on public.portal_contacts (customer_id);
create trigger portal_contacts_updated_at before update on public.portal_contacts for each row execute function public.set_updated_at();
alter table public.portal_contacts enable row level security;
create policy portal_contacts_read on public.portal_contacts for select to authenticated using ((select public.has_role(array['yonetici'])));
revoke all on public.portal_contacts from anon, authenticated;
grant select (id, customer_id, full_name, phone_e164, tc_hint, active, failed_count, locked_until, created_by, created_at, updated_at) on public.portal_contacts to authenticated;

create table if not exists public.portal_attempts (
  id bigint generated always as identity primary key,
  phone_e164 text,
  contact_id uuid references public.portal_contacts(id) on delete set null,
  ok boolean not null,
  reason text not null,
  client_ip text,
  at timestamptz not null default now()
);
create index if not exists portal_attempts_phone_idx on public.portal_attempts (phone_e164, at desc);
create index if not exists portal_attempts_contact_idx on public.portal_attempts (contact_id);
alter table public.portal_attempts enable row level security;
create policy portal_attempts_read on public.portal_attempts for select to authenticated using ((select public.has_role(array['yonetici'])));
revoke all on public.portal_attempts from anon;
revoke insert, update, delete, truncate on public.portal_attempts from authenticated;

create table if not exists public.portal_link_requests (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.portal_contacts(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'bekliyor' check (status in ('bekliyor','onaylandi','reddedildi','iptal')),
  approval_request_id uuid references public.approval_requests(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists portal_link_requests_contact_idx on public.portal_link_requests (contact_id);
create index if not exists portal_link_requests_customer_idx on public.portal_link_requests (customer_id);
create index if not exists portal_link_requests_user_idx on public.portal_link_requests (user_id);
create index if not exists portal_link_requests_approval_idx on public.portal_link_requests (approval_request_id);
create unique index if not exists portal_link_requests_open_uidx on public.portal_link_requests (user_id) where status = 'bekliyor';
alter table public.portal_link_requests enable row level security;
create policy portal_link_requests_read on public.portal_link_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_role(array['yonetici'])));
revoke all on public.portal_link_requests from anon;
revoke insert, update, delete, truncate on public.portal_link_requests from authenticated;

insert into public.approval_policies (code, name, approver_roles, threshold, above_roles)
values ('portal_baglanti', 'Müşteri portalı bağlantısı', array['yonetici'], null, null)
on conflict (code) do nothing;

create or replace function public.portal_contact_save(p_id uuid, p_customer uuid, p_name text, p_phone text, p_tc text default null, p_active boolean default true)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tc text := nullif(regexp_replace(coalesce(p_tc, ''), '\s', '', 'g'), '');
begin
  if not public.has_role(array['yonetici']) then raise exception 'Yetkiliyi yalnız yönetici tanımlar' using errcode = '42501'; end if;
  if p_phone !~ '^\+90[0-9]{10}$' then raise exception 'Telefon +90 ile 10 hane olmalı' using errcode = '23514'; end if;
  if v_tc is not null and not public.portal_tc_valid(v_tc) then raise exception 'TC kimlik no geçersiz' using errcode = '23514'; end if;
  if p_id is null then
    if v_tc is null then raise exception 'TC kimlik no zorunlu' using errcode = '23514'; end if;
    insert into public.portal_contacts (customer_id, full_name, phone_e164, tc_hmac, tc_hint, active, created_by)
    values (p_customer, btrim(p_name), p_phone, public.portal_tc_hmac(v_tc), right(v_tc, 2), coalesce(p_active, true), auth.uid())
    returning id into v_id;
  else
    update public.portal_contacts set customer_id = p_customer, full_name = btrim(p_name), phone_e164 = p_phone, active = coalesce(p_active, true),
      tc_hmac = case when v_tc is null then tc_hmac else public.portal_tc_hmac(v_tc) end,
      tc_hint = case when v_tc is null then tc_hint else right(v_tc, 2) end,
      failed_count = 0, locked_until = null
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Yetkili bulunamadı' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;
revoke execute on function public.portal_contact_save(uuid, uuid, text, text, text, boolean) from public, anon;
grant execute on function public.portal_contact_save(uuid, uuid, text, text, text, boolean) to authenticated;

create or replace function public.portal_claim_check(p_phone text, p_tc text, p_ip text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.portal_contacts; v_fails int; v_tc text := regexp_replace(coalesce(p_tc, ''), '\s', '', 'g');
begin
  select count(*) into v_fails from public.portal_attempts where phone_e164 = p_phone and not ok and at > now() - interval '15 minutes';
  if v_fails >= 5 then
    insert into public.portal_attempts (phone_e164, ok, reason, client_ip) values (p_phone, false, 'hiz_siniri', p_ip);
    return jsonb_build_object('ok', false, 'error', 'cok_deneme');
  end if;
  select * into c from public.portal_contacts where phone_e164 = p_phone;
  if c.id is not null and c.locked_until is not null and c.locked_until > now() then
    insert into public.portal_attempts (phone_e164, contact_id, ok, reason, client_ip) values (p_phone, c.id, false, 'kilitli', p_ip);
    return jsonb_build_object('ok', false, 'error', 'kilitli', 'until', c.locked_until);
  end if;
  if c.id is null or not c.active or not public.portal_tc_valid(v_tc) or c.tc_hmac <> public.portal_tc_hmac(v_tc) then
    insert into public.portal_attempts (phone_e164, contact_id, ok, reason, client_ip)
    values (p_phone, c.id, false, case when c.id is null then 'telefon_yok' when not c.active then 'pasif' when not public.portal_tc_valid(v_tc) then 'tc_gecersiz' else 'tc_uyusmuyor' end, p_ip);
    if c.id is not null then
      update public.portal_contacts set failed_count = failed_count + 1,
        locked_until = case when failed_count + 1 >= 5 then now() + interval '30 minutes' else locked_until end
      where id = c.id;
    end if;
    return jsonb_build_object('ok', false, 'error', 'eslesmedi');
  end if;
  update public.portal_contacts set failed_count = 0, locked_until = null where id = c.id;
  insert into public.portal_attempts (phone_e164, contact_id, ok, reason, client_ip) values (p_phone, c.id, true, 'eslesti', p_ip);
  return jsonb_build_object('ok', true, 'contact_id', c.id, 'customer_id', c.customer_id);
end $$;
revoke execute on function public.portal_claim_check(text, text, text) from public, anon, authenticated;
grant execute on function public.portal_claim_check(text, text, text) to service_role;

create or replace function public.portal_link_open(p_contact uuid, p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.portal_contacts; v_link uuid; v_req uuid; v_cust text;
begin
  select * into c from public.portal_contacts where id = p_contact and active;
  if c.id is null then raise exception 'Yetkili bulunamadı' using errcode = 'P0002'; end if;
  select name into v_cust from public.customers where id = c.customer_id;
  select id into v_link from public.portal_link_requests where user_id = p_user and status = 'bekliyor';
  if v_link is not null then return v_link; end if;
  insert into public.portal_link_requests (contact_id, customer_id, user_id) values (c.id, c.customer_id, p_user) returning id into v_link;
  insert into public.approval_requests (policy_code, subject_table, subject_id, title, payload)
  values ('portal_baglanti', 'portal_link_requests', v_link, 'Portal bağlantısı: ' || coalesce(v_cust, '—') || ' · ' || c.full_name,
    jsonb_build_object('customer_id', c.customer_id, 'customer', v_cust, 'contact', c.full_name,
      'phone', left(c.phone_e164, 5) || '*****' || right(c.phone_e164, 2), 'tc', '*********' || c.tc_hint))
  returning id into v_req;
  update public.portal_link_requests set approval_request_id = v_req where id = v_link;
  return v_link;
end $$;
revoke execute on function public.portal_link_open(uuid, uuid) from public, anon, authenticated;
grant execute on function public.portal_link_open(uuid, uuid) to service_role;

create or replace function public.portal_link_decided()
returns trigger language plpgsql security definer set search_path = public as $$
declare l public.portal_link_requests; v_name text;
begin
  if new.subject_table is distinct from 'portal_link_requests' or new.subject_id is null or old.status = new.status then return new; end if;
  select * into l from public.portal_link_requests where id = new.subject_id;
  if l.id is null then return new; end if;
  update public.portal_link_requests set status = new.status, decided_at = now() where id = l.id;
  if new.status = 'onaylandi' then
    if exists (select 1 from public.team_members where user_id = l.user_id and role <> 'musteri') then
      raise exception 'Bu hesap personel hesabı; portal bağlantısı yapılamaz' using errcode = '42501';
    end if;
    select full_name into v_name from public.portal_contacts where id = l.contact_id;
    insert into public.team_members (user_id, full_name, role, customer_id, active)
    values (l.user_id, coalesce(v_name, ''), 'musteri', l.customer_id, true)
    on conflict (user_id) do update set customer_id = excluded.customer_id, active = true, full_name = excluded.full_name;
  end if;
  insert into public.portal_attempts (contact_id, ok, reason) values (l.contact_id, new.status = 'onaylandi', 'karar_' || new.status);
  return new;
end $$;
revoke execute on function public.portal_link_decided() from public, anon, authenticated;
drop trigger if exists portal_link_decided on public.approval_requests;
create trigger portal_link_decided after update on public.approval_requests
  for each row execute function public.portal_link_decided();
