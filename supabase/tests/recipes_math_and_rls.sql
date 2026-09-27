-- Reçete maliyet motoru + RLS senaryo testi. Tümü transaction içinde, sonunda ROLLBACK.
-- Çalıştırma: psql "$DATABASE_URL" -f supabase/tests/recipes_math_and_rls.sql  (veya Supabase SQL editörü)
begin;

do $$
declare
  u_admin uuid := gen_random_uuid();
  u_cook uuid := gen_random_uuid();
  u_cust uuid := gen_random_uuid();
  i_et uuid; i_havuc uuid; i_bezelye uuid; i_yag uuid; i_tuz uuid;
  r_kebap uuid; m_menu uuid; cst uuid;
  v_cost numeric; v_net numeric; v_gross numeric; v_count int;
begin
  -- İlk kullanıcı otomatik yönetici olmalı (tablo boşsa)
  if exists (select 1 from public.team_members) then
    raise notice 'team_members dolu; bootstrap kontrolü atlandı';
    insert into auth.users (id, email) values (u_admin, 'admin-test@example.com');
    insert into public.team_members (user_id, role) values (u_admin, 'yonetici');
  else
    insert into auth.users (id, email) values (u_admin, 'admin-test@example.com');
    assert (select role from public.team_members where user_id = u_admin) = 'yonetici', 'ilk kullanıcı yönetici olmalı';
  end if;
  insert into auth.users (id, email) values (u_cook, 'cook-test@example.com'), (u_cust, 'cust-test@example.com');
  assert not exists (select 1 from public.team_members where user_id = u_cook), 'ikinci kullanıcı rolsüz beklemeli';
  insert into public.team_members (user_id, role) values (u_cook, 'asci_basi');
  insert into public.customers (name) values ('T Cari') returning id into cst;
  insert into public.team_members (user_id, role, customer_id) values (u_cust, 'musteri', cst);

  -- Hammaddeler
  insert into public.ingredients (name, stock_unit, waste_pct) values ('T Dana Kuşbaşı', 'kg', 10) returning id into i_et;
  insert into public.ingredients (name, stock_unit, waste_pct) values ('T Havuç', 'kg', 15) returning id into i_havuc;
  insert into public.ingredients (name, stock_unit, waste_pct) values ('T Bezelye', 'kg', 0) returning id into i_bezelye;
  insert into public.ingredients (name, stock_unit, waste_pct) values ('T Ayçiçek Yağı', 'lt', 0) returning id into i_yag;
  insert into public.ingredients (name, stock_unit, waste_pct) values ('T Tuz', 'kg', 0) returning id into i_tuz;
  insert into public.ingredient_prices (ingredient_id, price) values
    (i_et, 600), (i_havuc, 20), (i_bezelye, 60), (i_yag, 80), (i_tuz, 10);
  assert (select last_price from public.ingredients where id = i_et) = 600, 'fiyat trigger son fiyatı yazmalı';

  -- 1 porsiyon Orman Kebabı
  insert into public.recipes (name, category_code) values ('T Orman Kebabı', 'ana_yemek') returning id into r_kebap;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, net_qty) values
    (r_kebap, i_et, 120), (r_kebap, i_havuc, 40), (r_kebap, i_bezelye, 30), (r_kebap, i_yag, 15), (r_kebap, i_tuz, 5);

  -- Porsiyon maliyeti: 120/0.9*0.6 + 40/0.85*0.02 + 30*0.06 + 15*0.08 + 5*0.01 = 83.9912
  select cost_last into v_cost from public.v_recipe_costs where recipe_id = r_kebap;
  assert round(v_cost, 2) = 83.99, format('porsiyon maliyeti 83.99 olmalı, %s', v_cost);

  -- 1.200 porsiyon: net 144 kg kuşbaşı, brüt 160 kg
  select net_total, gross_stock_total into v_net, v_gross from public.recipe_scale(r_kebap, 1200) where ingredient_id = i_et;
  assert v_net = 144000, format('net 144000 g olmalı, %s', v_net);
  assert round(v_gross, 3) = 160, format('brüt 160 kg olmalı, %s', v_gross);

  -- Menü: 1.2 porsiyon katsayısı ile
  insert into public.menus (name, kind, target_price) values ('T Menü', 'standart', 200) returning id into m_menu;
  insert into public.menu_items (menu_id, recipe_id, portion_factor) values (m_menu, r_kebap, 1.2);
  assert round((select cost_last from public.v_menu_costs where menu_id = m_menu), 2) = round(83.9912 * 1.2, 2), 'menü maliyeti katsayılı olmalı';

  -- RLS: aşçıbaşı okur, fiyat yazamaz
  perform set_config('request.jwt.claims', json_build_object('sub', u_cook, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_count from public.ingredients where name like 'T %';
  assert v_count = 5, 'aşçıbaşı hammaddeleri görmeli';
  begin
    insert into public.ingredient_prices (ingredient_id, price) values (i_et, 1);
    raise exception 'aşçıbaşı fiyat yazamamalıydı';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.audit_log (action, entity_type) values ('x', 'y');
    raise exception 'audit_log doğrudan yazılamamalı';
  exception when insufficient_privilege then null;
  end;

  -- RLS: müşteri reçete/hammadde göremez
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_cust, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_count from public.ingredients;
  assert v_count = 0, 'müşteri hammadde görmemeli';
  select count(*) into v_count from public.v_recipe_costs;
  assert v_count = 0, 'müşteri reçete maliyeti görmemeli';

  -- RLS: rolsüz / anonim hiçbir şey göremez
  reset role;
  set local role anon;
  select count(*) into v_count from public.recipes;
  assert v_count = 0, 'anon reçete görmemeli';
  reset role;

  -- Son yönetici kaldırılamaz
  begin
    update public.team_members set role = 'asci_basi' where user_id = u_admin
      and not exists (select 1 from public.team_members where role = 'yonetici' and user_id <> u_admin);
    if found then raise exception 'son yönetici düşürülebildi'; end if;
  exception when insufficient_privilege then null;
  end;

  raise notice 'TÜM TESTLER GEÇTİ';
end $$;

rollback;
