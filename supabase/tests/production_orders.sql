-- Faz 3C: sipariş → üretim emri (taslak → kontrol → onay → kapanış) → stok düşer, gider yazılmaz, sipariş teslim → gelir;
-- kalibrasyon (1200 kişi / 100 kg → 75 g net, fire %10), aykırı değer, öneri/otomatik mod, iş emri anlık görüntüsü. begin … rollback.
begin;
do $$
declare
  u_cook uuid := gen_random_uuid(); u_depo uuid := gen_random_uuid(); u_diet uuid := gen_random_uuid();
  c uuid; i_et uuid; i_tuz uuid; r uuid; m uuid; po uuid; po2 uuid; wo uuid; b uuid; d date := current_date + 3;
  n int; v numeric; j jsonb; t text; gider_once int; gider_sonra int;
begin
  insert into auth.users (id, email) values (u_cook, 'c@x.test'), (u_depo, 'd@x.test'), (u_diet, 'y@x.test');
  insert into public.team_members (user_id, role) values (u_cook, 'asci_basi'), (u_depo, 'depo'), (u_diet, 'diyetisyen')
    on conflict (user_id) do update set role = excluded.role;
  insert into public.customers (name, default_meal_price, payment_term_days) values ('Ü Fabrika', 150, 30) returning id into c;
  insert into public.ingredients (name, stock_unit, waste_pct) values ('Ü Dana Kuşbaşı', 'kg', 10) returning id into i_et;
  insert into public.ingredients (name, stock_unit) values ('Ü Tuz', 'kg') returning id into i_tuz;
  insert into public.ingredient_prices (ingredient_id, price, source) values (i_et, 600, 'manuel'), (i_tuz, 10, 'manuel');
  insert into public.stock_movements (ingredient_id, kind, qty, unit_cost, source) values (i_et, 'giris', 200, 600, 'elle'), (i_tuz, 'giris', 10, 10, 'elle');
  -- 1 kişilik reçete: 90 g net et (fire %10 → 100 g brüt), 5 g tuz
  insert into public.recipes (name, category_code) values ('Ü Orman Kebabı', 'ana_yemek') returning id into r;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, net_qty, cut_style) values (r, i_et, 90, 'küp'), (r, i_tuz, 5, null);
  insert into public.recipe_steps (recipe_id, sort, station, body, minutes, temp_c, ccp) values (r, 1, 'pisirme', 'Eti mühürle', 20, 180, false), (r, 2, 'pisirme', 'Çekirdek ısı kontrolü', null, 75, true);
  insert into public.menus (name, kind) values ('Ü Öğle', 'standart') returning id into m;
  insert into public.menu_items (menu_id, recipe_id, course) values (m, r, 'ana');
  insert into public.menu_plans (plan_date, meal, menu_id) values (d, 'ogle', m);
  insert into public.meal_orders (service_date, customer_id, ordered_qty, unit_price) values (d, c, 1200, 150);
  select count(*) into gider_once from public.finance_entries where kind = 'gider';

  -- ── Aşçıbaşı emri oluşturur: 1200 kişi, reçeteden 120 kg et planlanır
  perform set_config('request.jwt.claims', json_build_object('sub', u_cook, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  po := public.po_build(d, 'ogle');
  select total_people into v from public.production_orders where id = po;
  assert v = 1200, format('1200 kişi olmalı: %s', v);
  select id into b from public.prep_batches where production_order_id = po and recipe_id = r;
  select qty into v from public.prep_batch_items where batch_id = b and ingredient_id = i_et;
  assert v = 120, format('1 kişilik reçete × 1200 = 120 kg brüt et: %s', v);
  select count(*) into n from public.prep_batches where id = b and recipe_snapshot is not null;
  assert n = 1, 'reçete anlık görüntüsü tutulmalı';

  -- ── Kontrol: uyarı yok (stok yeterli, kesim geçmedi)
  j := public.po_check(po);
  assert jsonb_array_length(j) = 0, format('uyarı olmamalı: %s', j);
  -- ── Depo onaylayamaz; kapatma ve durum değişikliği doğrudan yapılamaz
  perform set_config('request.jwt.claims', json_build_object('sub', u_depo, 'role', 'authenticated')::text, true);
  begin
    perform public.po_approve(po);
    assert false, 'depo onaylayamamalı';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', u_cook, 'role', 'authenticated')::text, true);
  begin
    update public.production_orders set status = 'onaylandi' where id = po;
    assert false, 'onay yalnız RPC ile';
  exception when insufficient_privilege then null;
  end;

  -- ── Onay → iş emri (revizyon 1, adımlar ve doğrama dahil)
  wo := public.po_approve(po);
  select snapshot into j from public.work_orders where id = wo and revision = 1;
  assert j->'yemekler'->0->>'yemek' = 'Ü Orman Kebabı', format('iş emrinde yemek olmalı: %s', j);
  assert jsonb_array_length(j->'yemekler'->0->'adimlar') = 2, 'iki adım olmalı';
  assert (j->'yemekler'->0->'malzemeler') @> '[{"dograma": "küp"}]', 'doğrama biçimi iş emrinde olmalı';
  assert (j->'firmalar') @> jsonb_build_array(jsonb_build_object('firma', 'Ü Fabrika', 'kisi', 1200)), 'firma × kişi olmalı';
  begin
    update public.work_orders set snapshot = '{}' where id = wo;
    assert false, 'iş emri değişmemeli';
  exception when insufficient_privilege then null;
  end;
  update public.work_orders set print_count = print_count + 1, printed_at = now() where id = wo;  -- basım sayacı serbest

  -- ── Mutfakta gerçekte 100 kg et, 6 kg tuz kullanıldı → kapanış
  update public.prep_batch_items set qty = 100 where batch_id = b and ingredient_id = i_et;
  j := public.po_close(po, true);
  assert (j->>'stok_kalem')::int = 2, format('iki stok çıkışı: %s', j);
  assert (j->>'teslim')::int = 1, format('bir sipariş teslim: %s', j);
  perform set_config('role', 'none', true);
  select sum(qty) into v from public.stock_movements where ingredient_id = i_et;
  assert v = 100, format('200 − 100 = 100 kg kalmalı: %s', v);
  select count(*) into n from public.stock_movements where source = 'uretim' and source_id = b;
  assert n = 2, 'üretim çıkışı yazılmalı';
  -- muhasebe kuralı: üretim gider yazmaz; teslim gelir yazar
  select count(*) into gider_sonra from public.finance_entries where kind = 'gider';
  assert gider_sonra = gider_once, 'üretim gider yazmamalı';
  select net_amount into v from public.finance_entries where kind = 'gelir' and customer_id = c;
  assert v = 180000, format('1200 × 150 = 180.000 gelir: %s', v);
  -- kalibrasyon: 100 kg / 1200 = 83,3 g brüt → 75 g net (fire %10); manuel modda reçete değişmez, öneri yazılır
  select calib_qty, net_qty into v, n from public.recipe_ingredients where recipe_id = r and ingredient_id = i_et;
  assert v = 75, format('öneri 75 g net olmalı: %s', v);
  assert n = 90, 'manuel modda reçete değişmemeli';
  select status into t from public.production_orders where id = po;
  assert t = 'kapandi', t;

  -- ── İki kez kapatılamaz, stok iki kez düşmez
  perform set_config('role', 'authenticated', true);
  begin
    perform public.po_close(po, true);
    assert false, 'ikinci kapanış olmamalı';
  exception when check_violation then null;
  end;
  perform set_config('role', 'none', true);
  select count(*) into n from public.stock_movements where source = 'uretim' and source_id = b;
  assert n = 2, 'stok iki kez düşmemeli';

  -- ── İkinci gün 900 kişi / 70 kg → porsiyon ağırlıklı medyan hâlâ 83,3 g; üçüncü gün 3 kat (aykırı) hariç
  perform set_config('role', 'authenticated', true);
  insert into public.recipe_calibrations (recipe_id, ingredient_id, prep_date, portions, used_qty_base) values
    (r, i_et, d + 1, 900, 70000), (r, i_et, d + 2, 500, 125000);
  perform public.recalibrate_recipe(r);
  select calib_qty, calib_n into v, n from public.recipe_ingredients where recipe_id = r and ingredient_id = i_et;
  assert v = 75, format('ağırlıklı medyan 83,3 g → 75 g net: %s', v);
  assert n = 2, format('aykırı değer hariç 2 kayıt: %s', n);
  select count(*) into n from public.recipe_calibrations where recipe_id = r and reason = 'aykırı';
  assert n = 1, 'aykırı işaretlenmeli';
  -- öneriyi uygula → reçete 75 g, maliyet fotoğrafı
  n := public.apply_calibration(r);
  select net_qty into v from public.recipe_ingredients where recipe_id = r and ingredient_id = i_et;
  assert v = 75, format('uygulanınca 75 g: %s', v);
  -- kilitli satır değişmez
  update public.recipe_ingredients set calib_mode = 'kilitli', net_qty = 80 where recipe_id = r and ingredient_id = i_et;
  perform public.apply_calibration(r);
  select net_qty into v from public.recipe_ingredients where recipe_id = r and ingredient_id = i_et;
  assert v = 80, 'kilitli satır değişmemeli';

  -- ── Reçetesiz yemek uyarısı: gerekçesiz onay yok, gerekçeyle onay var
  insert into public.meal_orders (service_date, customer_id, ordered_qty, unit_price, meal) values (d, c, 50, 150, 'aksam');
  po2 := public.po_build(d, 'aksam');
  insert into public.prep_batches (prep_date, meal, dish_name, portions) values (d, 'aksam', 'Ü Mercimek', 50);
  perform public.po_build(d, 'aksam');
  j := public.po_check(po2);
  assert j @> '[{"tur": "recetesiz"}]', format('reçetesiz uyarısı: %s', j);
  begin
    perform public.po_approve(po2);
    assert false, 'uyarılı emir gerekçesiz onaylanmamalı';
  exception when check_violation then null;
  end;
  begin
    perform public.po_approve(po2, true, ' ');
    assert false, 'gerekçe boş olmamalı';
  exception when check_violation then null;
  end;
  perform public.po_approve(po2, true, 'mercimek reçetesi yarın girilecek');
  select status into t from public.production_orders where id = po2;
  assert t = 'onaylandi', t;

  -- ── Diyetisyen kontrol edebilir, onaylayamaz
  perform set_config('request.jwt.claims', json_build_object('sub', u_diet, 'role', 'authenticated')::text, true);
  begin
    perform public.po_close(po2, false);
    assert false, 'diyetisyen kapatamamalı';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'none', true);
  raise notice 'production_orders OK';
end $$;
rollback;
