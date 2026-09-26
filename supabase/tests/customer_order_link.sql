-- Müşteri sipariş linki: kaydet, güncelle, kesim saati, geçersiz link
begin;
do $$
declare c uuid; t uuid; r jsonb; d date := (now() at time zone 'Europe/Istanbul')::date; n int;
begin
  insert into public.customers (name, default_meal_price) values ('P Test Firma', 150) returning id, order_token into c, t;
  r := public.portal_set_order(t, d + 2, 'ogle', 120, 'test');
  assert jsonb_array_length(r->'orders') = 1, 'sipariş görünmeli';
  r := public.portal_set_order(t, d + 2, 'ogle', 130, null);
  select ordered_qty into n from public.meal_orders where customer_id = c and service_date = d + 2;
  assert n = 130, 'güncellenmeli';
  begin
    perform public.portal_set_order(t, d, 'ogle', 10, null);
    assert false, 'bugün için kapalı olmalı';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.portal_info(gen_random_uuid());
    assert false, 'geçersiz link';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
