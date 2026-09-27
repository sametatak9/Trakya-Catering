-- TRAKYA CATERING ERP — 10: müşteri sipariş linki
-- Her firmaya gizli bir link (order_token). Firma giriş yapmadan önümüzdeki günlerin kişi sayısını girer.
-- Kural: yarının sayısı 16:00'ya kadar (order_is_open). Link yenilenirse eskisi geçersiz olur.

alter table public.customers add column if not exists order_token uuid not null default gen_random_uuid();
create unique index if not exists customers_order_token_uidx on public.customers (order_token);

-- Firma adı + önümüzdeki 7 günün siparişleri (yalnız bu firmanın)
create or replace function public.portal_info(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c record; d date := (now() at time zone 'Europe/Istanbul')::date;
begin
  select id, name, default_meal_price into c from public.customers where order_token = p_token and active;
  if not found then raise exception 'Link geçersiz' using errcode = '42501'; end if;
  return jsonb_build_object(
    'customer', c.name,
    'today', d,
    'orders', coalesce((select jsonb_agg(jsonb_build_object('date', o.service_date, 'meal', o.meal, 'qty', o.ordered_qty, 'status', o.status,
                                                            'open', public.order_is_open(o.service_date)) order by o.service_date, o.meal)
                        from public.meal_orders o
                        where o.customer_id = c.id and o.service_date between d and d + 7 and o.status <> 'iptal'), '[]'::jsonb),
    'meals', coalesce((select jsonb_agg(distinct o.meal) from public.meal_orders o
                        where o.customer_id = c.id and o.service_date > d - 60 and o.status <> 'iptal'), '["ogle"]'::jsonb)
  );
end $$;

-- Sayı gir / güncelle (kesim saatine kadar)
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
  return public.portal_info(p_token);
end $$;

revoke execute on function public.portal_info(uuid), public.portal_set_order(uuid, date, text, int, text) from public;
grant execute on function public.portal_info(uuid), public.portal_set_order(uuid, date, text, int, text) to anon, authenticated;
