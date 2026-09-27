-- Denetim düzeltmesi (başka ajanın canlıya uyguladığı portal_contacts): portal_contact_save SECURITY DEFINER olup
-- API'den çağrılabiliyordu (advisor 0029). Mantık API'ye açık olmayan `private` şemasına taşınır; public ad aynı
-- imzayla SECURITY INVOKER sarmalayıcı olur. Yetki kontrolü (yalnız yönetici) iç fonksiyonda kalır. Yalnızca eklemeli.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.portal_contact_save(p_id uuid, p_customer uuid, p_name text, p_phone text, p_tc text, p_active boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tc text := nullif(regexp_replace(coalesce(p_tc, ''), '\s', '', 'g'), '');
begin
  if not public.has_role(array['yonetici']) then raise exception 'Yetkiliyi yalnız yönetici tanımlar' using errcode = '42501'; end if;
  if coalesce(length(btrim(p_name)), 0) < 2 then raise exception 'Ad soyad zorunlu' using errcode = '23514'; end if;
  if p_phone is null or p_phone !~ '^\+90[0-9]{10}$' then raise exception 'Telefon +90 ile 10 hane olmalı' using errcode = '23514'; end if;
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
revoke execute on function private.portal_contact_save(uuid, uuid, text, text, text, boolean) from public, anon;
grant execute on function private.portal_contact_save(uuid, uuid, text, text, text, boolean) to authenticated;

create or replace function public.portal_contact_save(p_id uuid, p_customer uuid, p_name text, p_phone text, p_tc text default null, p_active boolean default true)
returns uuid language sql security invoker set search_path = public as $$
  select private.portal_contact_save(p_id, p_customer, p_name, p_phone, p_tc, p_active);
$$;
revoke execute on function public.portal_contact_save(uuid, uuid, text, text, text, boolean) from public, anon;
grant execute on function public.portal_contact_save(uuid, uuid, text, text, text, boolean) to authenticated;
