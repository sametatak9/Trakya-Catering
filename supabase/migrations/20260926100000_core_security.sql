-- TRAKYA CATERING ERP — 1: kimlik, roller, RLS yardımcıları, audit log
-- Kural: hiçbir tabloda `using (true)` yok. Her tablo rol bazlı RLS ile açılır.

-- Ortak: updated_at
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Ekip üyeleri ve roller
-- yonetici: her şey · asci_basi: reçete/menü/üretim · depo: stok · satinalma: tedarik/fiyat
-- muhasebe: cari/fatura/maliyet · sofor: sevkiyat/irsaliye · musteri: portal (yalnız kendi carisi)
-- ---------------------------------------------------------------------
create table if not exists public.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null check (role in ('yonetici','asci_basi','depo','satinalma','muhasebe','sofor','musteri')),
  -- Müşteri portalı kullanıcısının bağlı olduğu cari (FK, customers tablosu gelince eklenecek)
  customer_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_members_customer_role check ((role = 'musteri') = (customer_id is not null))
);
create trigger team_members_updated_at before update on public.team_members
  for each row execute function public.set_updated_at();

create or replace function public.current_app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.team_members where user_id = auth.uid() and active;
$$;

create or replace function public.has_role(p_roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = any(p_roles), false);
$$;

-- Personel = aktif üye ve müşteri değil
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() <> 'musteri', false);
$$;

create or replace function public.current_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select customer_id from public.team_members where user_id = auth.uid() and active and role = 'musteri';
$$;

revoke execute on function public.current_app_role(), public.has_role(text[]), public.is_staff(), public.current_customer_id() from public, anon;
grant execute on function public.current_app_role(), public.has_role(text[]), public.is_staff(), public.current_customer_id() to authenticated;

alter table public.team_members enable row level security;
create policy team_members_read on public.team_members for select to authenticated
  using (user_id = auth.uid() or public.has_role(array['yonetici']));
create policy team_members_insert on public.team_members for insert to authenticated
  with check (public.has_role(array['yonetici']));
create policy team_members_update on public.team_members for update to authenticated
  using (public.has_role(array['yonetici'])) with check (public.has_role(array['yonetici']));
create policy team_members_delete on public.team_members for delete to authenticated
  using (public.has_role(array['yonetici']));

-- Son aktif yönetici silinemez / düşürülemez (sistem kilitlenmesin)
create or replace function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'yonetici' and old.active
     and (tg_op = 'DELETE' or new.role <> 'yonetici' or not new.active)
     and not exists (select 1 from public.team_members
                     where role = 'yonetici' and active and user_id <> old.user_id) then
    raise exception 'Son aktif yönetici kaldırılamaz' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger team_members_guard_last_admin before update or delete on public.team_members
  for each row execute function public.guard_last_admin();

-- İlk kayıt olan kullanıcı otomatik yönetici olur; sonrakiler rol atanana kadar erişimsiz bekler.
create or replace function public.bootstrap_first_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.team_members) then
    insert into public.team_members (user_id, full_name, role)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'yonetici');
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created_bootstrap on auth.users;
create trigger on_auth_user_created_bootstrap after insert on auth.users
  for each row execute function public.bootstrap_first_user();

-- Giriş ekranı: kurulum yapılmış mı? (anon çağırabilir, yalnız boolean döner)
create or replace function public.needs_bootstrap() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.team_members);
$$;
revoke execute on function public.needs_bootstrap() from public;
grant execute on function public.needs_bootstrap() to anon, authenticated;

-- Yönetici: kayıt olmuş ama rol atanmamış kullanıcılar
create or replace function public.list_pending_users()
returns table (user_id uuid, email text, full_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(array['yonetici']) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name', '')::text, u.created_at
    from auth.users u
    where not exists (select 1 from public.team_members m where m.user_id = u.id)
    order by u.created_at desc;
end $$;
revoke execute on function public.list_pending_users() from public, anon;
grant execute on function public.list_pending_users() to authenticated;

-- Yönetici: üye listesi e-postasıyla birlikte
create or replace function public.list_team()
returns table (user_id uuid, email text, full_name text, role text, customer_id uuid, active boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(array['yonetici']) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, m.full_name, m.role, m.customer_id, m.active, m.created_at
    from public.team_members m join auth.users u on u.id = m.user_id
    order by m.created_at;
end $$;
revoke execute on function public.list_team() from public, anon;
grant execute on function public.list_team() to authenticated;

-- ---------------------------------------------------------------------
-- Audit log: kim, neyi, ne zaman değiştirdi
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  actor_kind text not null default 'user' check (actor_kind in ('user','system')),
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text,
  diff jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id, at desc);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
create policy audit_log_admin_read on public.audit_log for select to authenticated
  using (public.has_role(array['yonetici','muhasebe']));
-- Yazma politikası yok: yalnızca trigger ve security definer fonksiyonlar yazar.

create or replace function public.log_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_diff jsonb := '{}'::jsonb;
  v_new jsonb;
  v_old jsonb;
  k text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old); v_id := coalesce(v_old->>'id', v_old->>'user_id', v_old->>'code');
    v_diff := jsonb_build_object('old', v_old);
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_id := coalesce(v_new->>'id', v_new->>'user_id', v_new->>'code');
    v_diff := jsonb_build_object('new', v_new);
  else
    v_new := to_jsonb(new); v_old := to_jsonb(old); v_id := coalesce(v_new->>'id', v_new->>'user_id', v_new->>'code');
    for k in select jsonb_object_keys(v_new) loop
      if k <> 'updated_at' and (v_new->k) is distinct from (v_old->k) then
        v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('from', v_old->k, 'to', v_new->k));
      end if;
    end loop;
    if v_diff = '{}'::jsonb then return new; end if;
  end if;
  insert into public.audit_log (actor, actor_kind, action, entity_type, entity_id, diff)
  values (auth.uid(), case when auth.uid() is null then 'system' else 'user' end, lower(tg_op), tg_table_name, v_id, v_diff);
  return coalesce(new, old);
end $$;
revoke execute on function public.log_audit() from public, anon, authenticated;

create trigger team_members_audit after insert or update or delete on public.team_members
  for each row execute function public.log_audit();
