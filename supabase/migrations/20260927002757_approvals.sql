-- Faz 3C-0 — Onay merkezi, değişmez karar kaydı (ANA-PROMPT §3.8, §8 Faz 3C-0)
-- Kural: talep eden kendi talebini onaylayamaz; talep anındaki veri payload'da saklanır; her karar
-- değiştirilemez olay kaydına (hash zinciri) ve audit_log'a yazılır. RPC'ler SECURITY INVOKER; kurallar RLS + tetikleyicide.

create table if not exists public.approval_policies (
  code text primary key,
  name text not null,
  approver_roles text[] not null,          -- eşik altı (veya eşik yoksa) karar veren roller
  threshold numeric,                       -- tutar eşiği (₺); null = eşik yok
  above_roles text[],                      -- eşik üstünde karar veren roller
  active boolean not null default true
);
alter table public.approval_policies enable row level security;
drop policy if exists approval_policies_read on public.approval_policies;
create policy approval_policies_read on public.approval_policies for select to authenticated using ((select public.is_staff()));
drop policy if exists approval_policies_write on public.approval_policies;
create policy approval_policies_write on public.approval_policies for all to authenticated
  using ((select public.has_role(array['kurucu']))) with check ((select public.has_role(array['kurucu'])));
revoke all on public.approval_policies from anon;

insert into public.approval_policies (code, name, approver_roles, threshold, above_roles) values
  ('avans', 'Personel avansı', array['yonetici'], null, null),
  ('izin', 'İzin talebi', array['yonetici'], null, null),
  ('mesai', 'Fazla mesai', array['yonetici'], null, null),
  ('satinalma_plani', 'Satınalma planı', array['yonetici'], null, null),
  ('maliyet_duzenleme', 'Maliyet düzenleme', array['yonetici'], null, null),
  ('gider', 'Gider', array['muhasebe', 'yonetici'], 20000, array['yonetici']),
  ('odeme', 'Ödeme', array['muhasebe', 'yonetici'], 20000, array['yonetici']),
  ('stok_duzeltme', 'Stok düzeltme', array['yonetici'], null, null),
  ('modul_kapat', 'Modül kapatma', array['kurucu'], null, null),
  ('kullanici_sil', 'Kullanıcı silme', array['kurucu'], null, null),
  ('bug_fix', 'Hata düzeltme önerisi', array['kurucu'], null, null)
on conflict (code) do nothing;

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  policy_code text not null references public.approval_policies(code),
  subject_table text,
  subject_id uuid,
  title text not null,
  amount numeric,
  payload jsonb not null default '{}'::jsonb,   -- talep anındaki veri (değişmez)
  status text not null default 'bekliyor' check (status in ('bekliyor', 'onaylandi', 'reddedildi', 'iptal')),
  requested_by uuid,                            -- talebin sahibi (kendi talebini onaylayamaz)
  entered_by uuid default auth.uid(),           -- kaydı giren (yönetici başkası adına girebilir)
  requested_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  decision jsonb not null default '{}'::jsonb   -- karar ekleri (ör. avans için ödeme hesabı)
);
create index if not exists approval_requests_status_idx on public.approval_requests (status, requested_at desc);
create index if not exists approval_requests_policy_idx on public.approval_requests (policy_code);
create index if not exists approval_requests_subject_idx on public.approval_requests (subject_table, subject_id);
create index if not exists approval_requests_requested_by_idx on public.approval_requests (requested_by);
create index if not exists approval_requests_entered_by_idx on public.approval_requests (entered_by);
create unique index if not exists approval_requests_open_subject_uidx on public.approval_requests (subject_table, subject_id)
  where status = 'bekliyor' and subject_id is not null;

-- Karar yetkisi: eşik altı approver_roles, eşik üstü above_roles (kurucu her zaman)
create or replace function public.can_decide(p_policy text, p_amount numeric)
returns boolean language sql stable security invoker set search_path = public as $$
  select coalesce((
    select public.has_role(case when p.threshold is not null and coalesce(p_amount, 0) > p.threshold
                                then coalesce(p.above_roles, p.approver_roles) else p.approver_roles end)
      from public.approval_policies p where p.code = p_policy and p.active), false);
$$;

alter table public.approval_requests enable row level security;
drop policy if exists approval_requests_read on public.approval_requests;
create policy approval_requests_read on public.approval_requests for select to authenticated
  using (requested_by = (select auth.uid()) or entered_by = (select auth.uid()) or public.can_decide(policy_code, amount));
drop policy if exists approval_requests_insert on public.approval_requests;
create policy approval_requests_insert on public.approval_requests for insert to authenticated
  with check ((select public.is_staff()) and status = 'bekliyor');
drop policy if exists approval_requests_update on public.approval_requests;
create policy approval_requests_update on public.approval_requests for update to authenticated
  using (public.can_decide(policy_code, amount) or requested_by = (select auth.uid()) or entered_by = (select auth.uid()))
  with check (public.can_decide(policy_code, amount) or requested_by = (select auth.uid()) or entered_by = (select auth.uid()));
revoke all on public.approval_requests from anon;
revoke delete, truncate, trigger, references on public.approval_requests from authenticated;

-- Talep ve karar kuralları (değişmezlik + talep eden ≠ onaylayan)
create or replace function public.approval_requests_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_api boolean := current_user in ('authenticated', 'anon');
begin
  if tg_op = 'INSERT' then
    new.status := 'bekliyor';
    new.requested_at := now();
    new.decided_by := null; new.decided_at := null; new.decision_note := null; new.decision := '{}'::jsonb;
    -- API'den açan talebin sahibidir (başkası adına sahiplik yazılamaz); personel talebi tetikleyicisi sahibi kendisi belirler
    if v_api then new.entered_by := auth.uid(); new.requested_by := auth.uid(); end if;
    return new;
  end if;
  -- Karar verilmiş talep bir daha değişmez
  if old.status <> 'bekliyor' then
    raise exception 'Karar verilmiş talep değiştirilemez' using errcode = '42501';
  end if;
  if new.policy_code is distinct from old.policy_code or new.subject_table is distinct from old.subject_table
     or new.subject_id is distinct from old.subject_id or new.title is distinct from old.title or new.amount is distinct from old.amount
     or new.payload is distinct from old.payload or new.requested_by is distinct from old.requested_by
     or new.entered_by is distinct from old.entered_by or new.requested_at is distinct from old.requested_at then
    raise exception 'Talebin içeriği değiştirilemez; iptal edip yeni talep açın' using errcode = '42501';
  end if;
  if new.status = 'iptal' then
    if v_api and auth.uid() is distinct from old.requested_by and auth.uid() is distinct from old.entered_by then
      raise exception 'Talebi yalnız açan iptal edebilir' using errcode = '42501';
    end if;
  elsif new.status in ('onaylandi', 'reddedildi') then
    if v_api and not public.can_decide(old.policy_code, old.amount) then
      raise exception 'Bu talep için karar yetkiniz yok' using errcode = '42501';
    end if;
    if v_api and auth.uid() is not distinct from old.requested_by then
      raise exception 'Kendi talebinizi onaylayamaz veya reddedemezsiniz' using errcode = '42501';
    end if;
    if new.status = 'reddedildi' and coalesce(trim(new.decision_note), '') = '' then
      raise exception 'Reddetmek için açıklama yazın' using errcode = '23514';
    end if;
  elsif new.status = 'bekliyor' then
    return new;
  end if;
  new.decided_by := coalesce(auth.uid(), new.decided_by);
  new.decided_at := now();
  return new;
end $$;
revoke execute on function public.approval_requests_guard() from public, anon, authenticated;
drop trigger if exists approval_requests_guard on public.approval_requests;
create trigger approval_requests_guard before insert or update on public.approval_requests
  for each row execute function public.approval_requests_guard();
drop trigger if exists approval_requests_audit on public.approval_requests;
create trigger approval_requests_audit after insert or update on public.approval_requests
  for each row execute function public.log_audit();

-- Değişmez olay kaydı (hash zinciri)
create table if not exists public.approval_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.approval_requests(id),
  action text not null check (action in ('talep', 'onay', 'red', 'iptal')),
  actor uuid,
  at timestamptz not null default now(),
  note text,
  snapshot jsonb not null default '{}'::jsonb,
  chain_seq bigint unique,
  prev_hash text,
  hash text
);
create index if not exists approval_events_request_idx on public.approval_events (request_id);
alter table public.approval_events enable row level security;
drop policy if exists approval_events_read on public.approval_events;
create policy approval_events_read on public.approval_events for select to authenticated
  using (exists (select 1 from public.approval_requests r where r.id = request_id));
revoke all on public.approval_events from anon;
revoke insert, update, delete, truncate, trigger, references on public.approval_events from authenticated;
revoke update, delete, truncate on public.approval_events from service_role;

create or replace function public.approval_event_hash(p_prev text, e public.approval_events)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(p_prev, '') || '|' || e.id::text || '|' || e.request_id::text || '|' || e.action
    || '|' || coalesce(e.actor::text, '') || '|' || extract(epoch from e.at)::text || '|' || coalesce(e.note, '')
    || '|' || e.snapshot::text, 'sha256'), 'hex');
$$;

create or replace function public.approval_events_chain()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform pg_advisory_xact_lock(hashtext('approval_events_chain'));
  select hash, chain_seq + 1 into new.prev_hash, new.chain_seq from public.approval_events order by chain_seq desc nulls last limit 1;
  new.chain_seq := coalesce(new.chain_seq, 1);
  new.at := coalesce(new.at, now());
  new.hash := public.approval_event_hash(new.prev_hash, new);
  return new;
end $$;
revoke execute on function public.approval_events_chain() from public, anon, authenticated;
drop trigger if exists approval_events_chain on public.approval_events;
create trigger approval_events_chain before insert on public.approval_events for each row execute function public.approval_events_chain();
drop trigger if exists approval_events_immutable on public.approval_events;
create trigger approval_events_immutable before update or delete on public.approval_events for each row execute function public.forbid_mutation();
drop trigger if exists approval_events_no_truncate on public.approval_events;
create trigger approval_events_no_truncate before truncate on public.approval_events for each statement execute function public.forbid_mutation();

create or replace function public.verify_approval_chain()
returns boolean language plpgsql stable security invoker set search_path = public as $$
declare e public.approval_events; v_prev text := null;
begin
  if auth.uid() is not null and not public.has_role(array['yonetici']) then
    raise exception 'Yetki yok' using errcode = '42501';
  end if;
  for e in select * from public.approval_events order by chain_seq loop
    if e.prev_hash is distinct from v_prev or e.hash is distinct from public.approval_event_hash(v_prev, e) then return false; end if;
    v_prev := e.hash;
  end loop;
  return true;
end $$;

-- Talep/karar → olay kaydı + konuya (ör. personel talebi) yansıma. Definer: olay tablosuna ve konu tablosuna yazar.
create or replace function public.approval_requests_after()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_req public.employee_requests; v_acc uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.approval_events (request_id, action, actor, note, snapshot)
    values (new.id, 'talep', coalesce(new.entered_by, auth.uid()), null,
            jsonb_build_object('policy', new.policy_code, 'title', new.title, 'amount', new.amount, 'payload', new.payload));
    return new;
  end if;
  if old.status = new.status then return new; end if;
  insert into public.approval_events (request_id, action, actor, note, snapshot)
  values (new.id, case new.status when 'onaylandi' then 'onay' when 'reddedildi' then 'red' else 'iptal' end,
          new.decided_by, new.decision_note, jsonb_build_object('decision', new.decision));

  if new.subject_table = 'employee_requests' and new.subject_id is not null then
    select * into v_req from public.employee_requests where id = new.subject_id;
    if v_req.id is not null then
      update public.employee_requests
         set status = case new.status when 'onaylandi' then 'onaylandi' when 'reddedildi' then 'reddedildi' else 'reddedildi' end,
             decided_by = new.decided_by,
             note = case when new.status = 'iptal' then coalesce(note || ' · ', '') || 'iptal edildi' else note end
       where id = v_req.id;
      -- Onaylı avans: seçilen hesaptan ödenir → personel bakiyesi ve kasa anında değişir
      if new.status = 'onaylandi' and v_req.kind = 'avans' and coalesce(v_req.amount, 0) > 0 then
        v_acc := nullif(new.decision->>'account_id', '')::uuid;
        if v_acc is null then
          raise exception 'Avansı onaylamak için ödemenin yapılacağı kasa/banka hesabını seçin' using errcode = '23514';
        end if;
        insert into public.employee_ledger (employee_id, entry_date, kind, amount, description, account_id, request_id, created_by)
        values (v_req.employee_id, (now() at time zone 'Europe/Istanbul')::date, 'avans', v_req.amount,
                'Onaylı avans talebi' || coalesce(' · ' || v_req.note, ''), v_acc, v_req.id, new.decided_by);
      end if;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.approval_requests_after() from public, anon, authenticated;
drop trigger if exists approval_requests_after on public.approval_requests;
create trigger approval_requests_after after insert or update on public.approval_requests
  for each row execute function public.approval_requests_after();

-- Personel defteri: onaylı talepten gelen satır izlenebilir, iki kez yazılamaz
alter table public.employee_ledger add column if not exists request_id uuid references public.employee_requests(id) on delete set null;
create unique index if not exists employee_ledger_request_uidx on public.employee_ledger (request_id) where request_id is not null;

-- Personel talebi açılınca onay talebi otomatik açılır
create or replace function public.employee_requests_to_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_emp record;
begin
  if new.status <> 'bekliyor' then return new; end if;
  select full_name, user_id into v_emp from public.employees where id = new.employee_id;
  insert into public.approval_requests (policy_code, subject_table, subject_id, title, amount, payload, requested_by, entered_by)
  values (new.kind, 'employee_requests', new.id,
          format('%s · %s', v_emp.full_name, case new.kind when 'avans' then 'Avans' when 'izin' then 'İzin' else 'Fazla mesai' end),
          new.amount, to_jsonb(new) - 'created_at' - 'updated_at', v_emp.user_id, auth.uid())
  on conflict do nothing;
  return new;
end $$;
revoke execute on function public.employee_requests_to_approval() from public, anon, authenticated;
drop trigger if exists employee_requests_to_approval on public.employee_requests;
create trigger employee_requests_to_approval after insert on public.employee_requests
  for each row execute function public.employee_requests_to_approval();

-- Personel talebinin durumu artık yalnız Onaylar'dan değişir (doğrudan güncelleme kapalı)
create or replace function public.employee_requests_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and (new.status is distinct from old.status or new.decided_by is distinct from old.decided_by) then
    raise exception 'Talep kararı Onaylar ekranından verilir' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.employee_requests_guard() from public, anon, authenticated;
drop trigger if exists employee_requests_guard on public.employee_requests;
create trigger employee_requests_guard before update on public.employee_requests
  for each row execute function public.employee_requests_guard();

-- Mevcut bekleyen personel talepleri için onay talebi (idempotent)
insert into public.approval_requests (policy_code, subject_table, subject_id, title, amount, payload, requested_by, entered_by)
select r.kind, 'employee_requests', r.id, format('%s · %s', e.full_name, case r.kind when 'avans' then 'Avans' when 'izin' then 'İzin' else 'Fazla mesai' end),
       r.amount, to_jsonb(r) - 'created_at' - 'updated_at', e.user_id, null
  from public.employee_requests r join public.employees e on e.id = r.employee_id
 where r.status = 'bekliyor'
   and not exists (select 1 from public.approval_requests a where a.subject_table = 'employee_requests' and a.subject_id = r.id);

-- RPC'ler (SECURITY INVOKER; kurallar RLS ve tetikleyicide)
create or replace function public.request_approval(p_policy text, p_title text, p_amount numeric default null,
  p_payload jsonb default '{}'::jsonb, p_subject_table text default null, p_subject_id uuid default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into public.approval_requests (policy_code, title, amount, payload, subject_table, subject_id)
  values (p_policy, p_title, p_amount, coalesce(p_payload, '{}'::jsonb), p_subject_table, p_subject_id)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.decide_approval(p_id uuid, p_decision text, p_note text default null, p_extra jsonb default '{}'::jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if p_decision not in ('onaylandi', 'reddedildi', 'iptal') then
    raise exception 'Geçersiz karar: %', p_decision using errcode = '22023';
  end if;
  update public.approval_requests
     set status = p_decision, decision_note = nullif(trim(p_note), ''), decision = coalesce(p_extra, '{}'::jsonb)
   where id = p_id and status = 'bekliyor';
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'Talep bulunamadı, karar verilmiş ya da yetkiniz yok' using errcode = '42501';
  end if;
end $$;
revoke execute on function public.request_approval(text, text, numeric, jsonb, text, uuid) from public, anon;
revoke execute on function public.decide_approval(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.can_decide(text, numeric) from public, anon;
revoke execute on function public.verify_approval_chain() from public, anon;
grant execute on function public.request_approval(text, text, numeric, jsonb, text, uuid) to authenticated;
grant execute on function public.decide_approval(uuid, text, text, jsonb) to authenticated;
grant execute on function public.can_decide(text, numeric) to authenticated;
grant execute on function public.verify_approval_chain() to authenticated;

-- Canlı rozet
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'approval_requests') then
    alter publication supabase_realtime add table public.approval_requests;
  end if;
end $$;
