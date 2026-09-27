-- Faz 3D / EK-1 Not 8: müşteri hesabıyla giriş yapan kullanıcı portal v2'yi kendi firmasının jetonuyla açar.
-- Mantık private şemada (definer; yalnız musteri rolü ve kendi firması), public ad invoker sarmalayıcı.
create or replace function private.portal_my_token()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_c uuid; v_t uuid;
begin
  if public.current_app_role() is distinct from 'musteri' then raise exception 'Yalnız müşteri hesabı' using errcode = '42501'; end if;
  v_c := public.current_customer_id();
  if v_c is null then raise exception 'Hesap bir firmaya bağlı değil' using errcode = '42501'; end if;
  select token into v_t from public.customer_portal_tokens where customer_id = v_c and revoked_at is null;
  return v_t;
end $$;
revoke execute on function private.portal_my_token() from public, anon;
grant execute on function private.portal_my_token() to authenticated;
create or replace function public.portal_my_token()
returns uuid language sql stable security invoker set search_path = public as $$ select private.portal_my_token(); $$;
revoke execute on function public.portal_my_token() from public, anon;
grant execute on function public.portal_my_token() to authenticated;
