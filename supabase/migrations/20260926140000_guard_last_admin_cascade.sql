-- TRAKYA CATERING ERP — 5: son yönetici koruması, auth hesabının kendisi silinirken (cascade) devreye girmez.
-- Uygulama içinden rol düşürme / pasife alma / üyelik silme yine engellenir.
create or replace function public.guard_last_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = old.user_id) then
    return old;
  end if;
  if old.role = 'yonetici' and old.active
     and (tg_op = 'DELETE' or new.role <> 'yonetici' or not new.active)
     and not exists (select 1 from public.team_members
                     where role = 'yonetici' and active and user_id <> old.user_id) then
    raise exception 'Son aktif yönetici kaldırılamaz' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.guard_last_admin() from public, anon, authenticated;
