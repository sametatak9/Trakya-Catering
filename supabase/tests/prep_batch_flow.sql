-- Günlük hazırlık: siparişlerden yemek başlıkları → reçeteden öneri → aşçının gerçek miktarı
-- → 1 porsiyon maliyeti/gramajı → elle yan malzeme → hazırlıktan reçete türetme → yetkiler. ROLLBACK ile biter.
begin;
do $$
declare
  u_cook uuid := gen_random_uuid(); u_drv uuid := gen_random_uuid();
  c uuid; i_et uuid; i_tuz uuid; r uuid; m uuid; b uuid; it_et uuid; v numeric; n int; d date := current_date + 3; r2 uuid;
begin
  insert into auth.users (id, email) values (gen_random_uuid(), 'boss@x.test');
  insert into auth.users (id, email) values (u_cook, 'cook@x.test'), (u_drv, 'drv@x.test');
  insert into public.team_members (user_id, role) values (u_cook, 'asci_basi'), (u_drv, 'sofor');
  insert into public.customers (name, default_meal_price) values ('P Fabrika', 150) returning id into c;
  insert into public.ingredients (name, stock_unit, waste_pct, last_price) values ('P Dana Kuşbaşı', 'kg', 10, 600) returning id into i_et;
  insert into public.ingredients (name, stock_unit, last_price) values ('P Tuz', 'kg', 10) returning id into i_tuz;
  insert into public.recipes (name, category_code) values ('P Orman Kebabı', 'ana_yemek') returning id into r;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, net_qty) values (r, i_et, 120), (r, i_tuz, 5);
  insert into public.menus (name, kind) values ('P Öğle', 'standart') returning id into m;
  insert into public.menu_items (menu_id, recipe_id, course) values (m, r, 'ana');
  -- Genel menü planı; sipariş menüsüz girilir → plandan gelir
  insert into public.menu_plans (plan_date, meal, menu_id) values (d, 'ogle', m);
  insert into public.meal_orders (service_date, customer_id, ordered_qty, unit_price) values (d, c, 1200, 150);

  perform set_config('request.jwt.claims', json_build_object('sub', u_cook, 'role', 'authenticated')::text, true);
  set local role authenticated;

  n := public.plan_prep_from_orders(d, 'ogle');
  select id into b from public.prep_batches where prep_date = d and recipe_id = r;
  assert b is not null, 'siparişten (menü planıyla) yemek başlığı oluşmalı';
  assert (select portions from public.prep_batches where id = b) = 1200, 'kişi sayısı 1200 olmalı';

  n := public.prep_fill_from_recipe(b);
  assert n = 2, 'reçeteden 2 malzeme gelmeli';
  select qty into v from public.prep_batch_items where batch_id = b and ingredient_id = i_et;
  assert v = 160, format('reçete önerisi 160 kg brüt olmalı: %s', v);

  -- Aşçı gerçekte 144 kg et kullandı
  update public.prep_batch_items set qty = 144 where batch_id = b and ingredient_id = i_et returning id into it_et;
  select cost_per_portion into v from public.v_prep_batch_costs where batch_id = b;
  assert round(v, 4) = 72.05, format('porsiyon maliyeti 144×600/1200 + 6×10/1200 = 72,05 olmalı: %s', v);
  select round(qty_base / 1200, 1) into v from public.v_prep_items where id = it_et;
  assert v = 120, format('porsiyon başı et 120 g olmalı: %s', v);
  select variance_pct into v from public.v_prep_batch_costs where batch_id = b;
  assert v = -10.0, format('reçeteye göre sapma %%-10 olmalı: %s', v);

  -- Elle yan malzeme: fiyatsız olamaz
  begin
    insert into public.prep_batch_items (batch_id, manual_name, qty, unit, is_side) values (b, 'Maydanoz', 30, 'adet', true);
    raise exception 'fiyatsız elle malzeme kaydedildi';
  exception when check_violation then null;
  end;
  insert into public.prep_batch_items (batch_id, manual_name, qty, unit, unit_price, is_side) values (b, 'Maydanoz (demet)', 30, 'adet', 15, true);
  select cost_per_portion, side_cost into v, n from public.v_prep_batch_costs where batch_id = b;
  assert round(v, 4) = 72.425, format('yan malzemeyle 72,425 olmalı: %s', v);

  -- Birim uyumsuzluğu reddedilir (kg'lık malzemeye litre)
  begin
    insert into public.prep_batch_items (batch_id, ingredient_id, qty, unit) values (b, i_tuz, 1, 'lt');
    raise exception 'birim uyumsuzluğu kabul edildi';
  exception when check_violation then null;
  end;

  -- Hazırlıktan reçete türet: net = 144000 g / 1200 × (1 − %10) = 108 g
  r2 := public.recipe_from_prep(b);
  assert r2 = r, 'bağlı reçete güncellenmeli';
  select net_qty into v from public.recipe_ingredients where recipe_id = r and ingredient_id = i_et;
  assert v = 108, format('türetilen net gramaj 108 olmalı: %s', v);
  select cost_last into v from public.v_recipe_costs where recipe_id = r;
  assert round(v, 2) = 72.05, format('türetilen reçete maliyeti hazırlıkla aynı (72,05) olmalı: %s', v);

  -- Stoktan düş (hazırlık): aynı yemek iki kez düşülmez (tek kapı, Faz 3A)
  insert into public.stock_movements (ingredient_id, kind, qty, source, source_id) values (i_et, 'cikis', -144, 'hazirlik', b);
  begin
    insert into public.stock_movements (ingredient_id, kind, qty, source, source_id) values (i_et, 'cikis', -144, 'hazirlik', b);
    raise exception 'hazırlık iki kez stoktan düşüldü';
  exception when unique_violation then null;
  end;

  -- Reçetesi olmayan yeni yemek, çalışırken oluşur
  insert into public.prep_batches (prep_date, meal, dish_name, course, portions) values (d, 'ogle', 'P Mercimek Çorbası', 'corba', 1200) returning id into b;
  insert into public.prep_batch_items (batch_id, ingredient_id, qty, unit) values (b, i_tuz, 2400, 'g');
  select cost_per_portion into v from public.v_prep_batch_costs where batch_id = b;
  assert round(v, 4) = 0.02, format('2,4 kg tuz / 1200 = 0,02 ₺ olmalı: %s', v);
  r2 := public.recipe_from_prep(b);
  assert (select category_code from public.recipes where id = r2) = 'corba', 'yeni reçete çorba kategorisinde oluşmalı';

  -- Şoför hazırlık yazamaz
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_drv, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.prep_batches (prep_date, meal, dish_name) values (d, 'ogle', 'X');
    raise exception 'şoför hazırlık yazabildi';
  exception when insufficient_privilege then null;
  end;
  reset role;
  raise notice 'HAZIRLIK TESTLERİ GEÇTİ';
end $$;
rollback;
