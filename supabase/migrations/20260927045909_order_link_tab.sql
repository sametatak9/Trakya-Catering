-- EK-1 / Not 8: müşteri kartında "Sipariş linki" sekmesi. Linki yenileme (eski link geçersiz, denetim kaydına düşer)
-- ve son kullanım zamanı. Yalnızca eklemeli: yeni nullable sütun + invoker RPC; portal_set_order imzası aynı kalır.
alter table public.customers add column if not exists order_link_used_at timestamptz;
comment on column public.customers.order_link_used_at is 'Sipariş linkinden son sayı girişi (portal_set_order)';

create or replace function public.rotate_order_token(p_customer uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_token uuid;
begin
  if not public.has_role(array['yonetici']) then raise exception 'Sipariş linkini yalnız yönetici yeniler' using errcode = '42501'; end if;
  update public.customers set order_token = gen_random_uuid(), order_link_used_at = null where id = p_customer returning order_token into v_token;
  if v_token is null then raise exception 'Müşteri bulunamadı' using errcode = 'P0002'; end if;
  return v_token;
end $$;
revoke execute on function public.rotate_order_token(uuid) from public, anon;
grant execute on function public.rotate_order_token(uuid) to authenticated;

create or replace function public.portal_set_order(p_token uuid, p_date date, p_meal text, p_qty int, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare c record; o record;
begin
  select id, name, default_meal_price, vat_rate into c from public.customers where order_token = p_token and active;
  if not found then raise exception 'Link geçersiz' using errcode = '42501'; end if;
  if p_meal not in ('kahvalti','ogle','aksam','gece') then raise exception 'Geçersiz öğün' using errcode = '23514'; end if;
  if p_qty is null or p_qty < 0 or p_qty > 20000 then raise exception 'Kişi sayısı geçersiz' using errcode = '23514'; end if;
  if not public.order_is_open(p_date) then raise exception 'Bu gün için sipariş süresi doldu (önceki gün 16:00)' using errcode = '42501'; end if;
  select * into o from public.meal_orders
   where customer_id = c.id and service_date = p_date and meal = p_meal and status <> 'iptal' and kind = 'sozlesmeli'
   order by created_at limit 1;
  if found then
    if o.status not in ('bekliyor','onaylandi') then raise exception 'Sipariş kilitli' using errcode = '42501'; end if;
    update public.meal_orders set ordered_qty = p_qty, note = coalesce(nullif(trim(p_note), ''), note), status = 'bekliyor' where id = o.id;
  else
    insert into public.meal_orders (service_date, meal, customer_id, kind, ordered_qty, unit_price, vat_rate, note)
    values (p_date, p_meal, c.id, 'sozlesmeli', p_qty, coalesce(c.default_meal_price, 0), c.vat_rate, nullif(trim(p_note), ''));
  end if;
  update public.customers set order_link_used_at = now() where id = c.id;
  return public.portal_info(p_token);
end $$;
revoke execute on function public.portal_set_order(uuid, date, text, int, text) from public;
grant execute on function public.portal_set_order(uuid, date, text, int, text) to anon, authenticated;
