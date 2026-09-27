-- EK-1 / Not 8: sipariş linki yenileme — yalnız yönetici, eski link geçersiz, denetim kaydı, son kullanım. begin … rollback.
begin;
do $$
declare u_mgr uuid := gen_random_uuid(); u_mkt uuid := gen_random_uuid(); c uuid; t_old uuid; t_new uuid; n int; ts timestamptz;
begin
  insert into auth.users (id, email) values (u_mgr, 'm@x.test'), (u_mkt, 'p@x.test');
  insert into public.team_members (user_id, role) values (u_mgr, 'yonetici'), (u_mkt, 'pazarlamaci') on conflict (user_id) do update set role = excluded.role;
  insert into public.customers (name, default_meal_price) values ('L Fabrika', 150) returning id, order_token into c, t_old;
  -- link çalışır, son kullanım yazılır (anonim)
  perform set_config('role', 'anon', true);
  perform public.portal_set_order(t_old, (now() at time zone 'Europe/Istanbul')::date + 3, 'ogle', 120, null);
  perform set_config('role', 'none', true);
  select order_link_used_at into ts from public.customers where id = c;
  assert ts is not null, 'son kullanım yazılmalı';
  -- pazarlamacı yenileyemez
  perform set_config('request.jwt.claims', json_build_object('sub', u_mkt, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.rotate_order_token(c);
    assert false, 'pazarlamacı yenileyememeli';
  exception when insufficient_privilege then null;
  end;
  -- yönetici yeniler
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgr, 'role', 'authenticated')::text, true);
  t_new := public.rotate_order_token(c);
  assert t_new is not null and t_new <> t_old, 'yeni link üretilmeli';
  perform set_config('role', 'anon', true);
  begin
    perform public.portal_info(t_old);
    assert false, 'eski link geçersiz olmalı';
  exception when insufficient_privilege then null;
  end;
  perform public.portal_info(t_new);
  perform set_config('role', 'none', true);
  select count(*) into n from public.audit_log where entity_type = 'customers' and entity_id = c::text and action = 'update';
  assert n >= 1, 'yenileme denetim kaydına düşmeli';
  raise notice 'order_link OK';
end $$;
rollback;
