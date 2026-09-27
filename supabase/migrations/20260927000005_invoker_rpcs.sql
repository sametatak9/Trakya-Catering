-- Faz 3A: yeni RPC'ler SECURITY INVOKER (advisor 0029 uyarısı bırakılmaz).
-- Hata kaydı: kural ve maskeleme tabloda (tetikleyici) — doğrudan tabloya yazan da atlatamaz.

create or replace function public.error_events_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  if new.user_id is null then return null; end if;
  if (select count(*) from public.error_events where user_id = new.user_id and at > now() - interval '1 minute') >= 20 then
    return null;  -- dakikada en çok 20 kayıt; fazlası sessizce atılır
  end if;
  new.at := now();
  new.resolved := false;
  new.message := left(public.mask_pii(new.message), 1000);
  new.stack := left(public.mask_pii(new.stack), 4000);
  new.route := left(new.route, 300);
  new.user_agent := left(new.user_agent, 300);
  new.context := case when new.context is null or new.context = '{}'::jsonb then '{}'::jsonb
                      else jsonb_build_object('metin', left(public.mask_pii(new.context::text), 2000)) end;
  new.fingerprint := md5(coalesce(new.kind, '') || left(new.message, 200));
  if coalesce(new.message, '') = '' then return null; end if;
  return new;
end $$;
revoke execute on function public.error_events_guard() from public, anon, authenticated;
drop trigger if exists error_events_guard on public.error_events;
create trigger error_events_guard before insert on public.error_events for each row execute function public.error_events_guard();

drop policy if exists error_events_insert on public.error_events;
create policy error_events_insert on public.error_events for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists error_events_read on public.error_events;
create policy error_events_read on public.error_events for select to authenticated
  using ((select public.has_role(array['yonetici'])) or user_id = (select auth.uid()));
revoke all on public.error_events from anon;
revoke update, delete on public.error_events from authenticated;
grant select, insert on public.error_events to authenticated;
grant update (resolved) on public.error_events to authenticated;

create or replace function public.log_client_error(p jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or coalesce(p->>'message', '') = '' then return; end if;
  insert into public.error_events (user_id, kind, message, stack, route, user_agent, context)
  values (auth.uid(),
          case when p->>'kind' in ('ekran','pencere','soz','istek','hata') then p->>'kind' else 'hata' end,
          p->>'message', p->>'stack', p->>'route', p->>'user_agent',
          case when p ? 'context' then p->'context' else '{}'::jsonb end);
exception when others then
  return; -- hata kaydı asla kullanıcı işini bozmaz
end $$;
revoke execute on function public.log_client_error(jsonb) from public, anon;
grant execute on function public.log_client_error(jsonb) to authenticated;

-- Zincir doğrulama: okuma yetkisi audit_log politikasından gelir (yönetici/muhasebe)
create or replace function public.verify_audit_chain()
returns boolean language plpgsql stable security invoker set search_path = public as $$
declare r public.audit_log; v_prev text := null;
begin
  if auth.uid() is not null and not public.has_role(array['yonetici','muhasebe']) then
    raise exception 'Yetki yok' using errcode = '42501';
  end if;
  for r in select * from public.audit_log order by chain_seq loop
    if r.prev_hash is distinct from v_prev or r.hash is distinct from public.audit_row_hash(v_prev, r) then return false; end if;
    v_prev := r.hash;
  end loop;
  return true;
end $$;
