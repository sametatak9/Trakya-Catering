-- save_recipe / save_menu RPC'leri ve rol yetkileri. Transaction içinde, sonunda ROLLBACK.
begin;
do $$
declare
  u_cook uuid := gen_random_uuid(); u_depo uuid := gen_random_uuid();
  i1 uuid; i2 uuid; r uuid; r2 uuid; m uuid; v numeric; n int;
begin
  insert into auth.users (id, email) values (u_cook, 'c@x.test'), (u_depo, 'd@x.test');
  insert into public.team_members (user_id, role) values (u_cook, 'asci_basi'), (u_depo, 'depo');
  insert into public.ingredients (name, stock_unit, waste_pct, last_price) values ('Z Et', 'kg', 10, 600) returning id into i1;
  insert into public.ingredients (name, stock_unit, last_price) values ('Z Tuz', 'kg', 10) returning id into i2;

  perform set_config('request.jwt.claims', json_build_object('sub', u_cook, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.save_recipe(null, '{"name":"Z Kebap","category_code":"ana_yemek","portion_served_g":"180"}',
        jsonb_build_array(jsonb_build_object('ingredient_id', i1, 'net_qty', 120), jsonb_build_object('ingredient_id', i2, 'net_qty', 5, 'waste_pct_override', null)));
  select cost_last into v from public.v_recipe_costs where recipe_id = r;
  assert round(v, 2) = 80.05, format('kayıt sonrası maliyet 80.05 olmalı: %s', v);
  perform public.save_recipe(r, '{"name":"Z Kebap","category_code":"ana_yemek"}', jsonb_build_array(jsonb_build_object('ingredient_id', i1, 'net_qty', 150)));
  select count(*) into n from public.recipe_ingredients where recipe_id = r;
  assert n = 1, 'silinen satır kalmamalı';
  select cost_last into v from public.v_recipe_costs where recipe_id = r;
  assert round(v, 2) = 100, format('güncel maliyet 100 olmalı: %s', v);
  m := public.save_menu(null, '{"name":"Z Menü","kind":"3_kap","target_price":"200"}', jsonb_build_array(jsonb_build_object('recipe_id', r, 'portion_factor', 1.2)));
  select cost_last into v from public.v_menu_costs where menu_id = m;
  assert round(v, 2) = 120, format('menü 120 olmalı: %s', v);
  select food_margin_pct into v from public.v_menu_costs where menu_id = m;
  assert v = 40, format('marj %%40 olmalı: %s', v);

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_depo, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    r2 := public.save_recipe(null, '{"name":"Z Yasak","category_code":"corba"}', '[]');
    raise exception 'depo reçete yazabildi';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_recipe(r, '{"name":"Z Hack","category_code":"corba"}', '[]');
    raise exception 'depo reçete güncelleyebildi';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.v_recipe_costs where recipe_id = r;
  assert n = 1, 'depo reçeteyi okuyabilmeli';
  reset role;
  raise notice 'RPC TESTLERİ GEÇTİ';
end $$;
rollback;
