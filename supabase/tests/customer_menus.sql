-- Faz 3D: menü tanımı, sunum şekli maliyeti, aylık sipariş, portal v2, müşteri fiyatı, hassasiyet → üretim uyarısı,
-- geri bildirim, PIN. begin … rollback.
begin;
do $$
declare
  u_mgr uuid := gen_random_uuid(); u_cook uuid := gen_random_uuid(); u_cust uuid := gen_random_uuid(); u_cust2 uuid := gen_random_uuid();
  c uuid; c2 uuid; tok uuid; cm uuid; so uuid; i_tabla uuid; i_kapak uuid; i_sut uuid; r uuid; m uuid; po uuid; o uuid;
  d date := (now() at time zone 'Europe/Istanbul')::date + 3; per text; n int; exp int; v numeric; j jsonb; t text;
begin
  insert into auth.users (id, email) values (u_mgr, 'm@x.test'), (u_cook, 'c@x.test'), (u_cust, 'k@x.test'), (u_cust2, 'k2@x.test');
  insert into public.customers (name, default_meal_price, vat_rate) values ('M Fabrika', 150, 10) returning id, order_token into c, tok;
  insert into public.customers (name, default_meal_price) values ('M Diğer', 120) returning id into c2;
  insert into public.team_members (user_id, role, customer_id) values (u_mgr, 'yonetici', null), (u_cook, 'asci_basi', null), (u_cust, 'musteri', c), (u_cust2, 'musteri', c2)
    on conflict (user_id) do update set role = excluded.role, customer_id = excluded.customer_id;

  -- ── Jeton senkron: müşteri açılınca portal jetonu oluşur
  select count(*) into n from public.customer_portal_tokens where customer_id = c and token = tok;
  assert n = 1, 'portal jetonu senkron olmalı';

  -- ── Sunum şekli maliyeti: tabla kişi başı 1 × 4 ₺ = 4; küvet (25 kişilik) kapak 50 ₺ → 2 ₺
  insert into public.service_styles (code, name, pack_mode, people_per_container) values ('t_tabla', 'T tabla', 'kisi_basi', 1), ('t_kuvet', 'T küvet', 'kap_basi', 25);
  insert into public.ingredients (name, stock_unit, category, last_price) values ('M Tabla', 'adet', 'ambalaj', 4) returning id into i_tabla;
  insert into public.ingredients (name, stock_unit, category, last_price) values ('M Küvet kapağı', 'adet', 'ambalaj', 50) returning id into i_kapak;
  insert into public.service_style_items (style_code, ingredient_id, qty_per_person) values ('t_tabla', i_tabla, 1);
  insert into public.service_style_items (style_code, ingredient_id, qty_per_container) values ('t_kuvet', i_kapak, 1);
  select pack_cost_per_person into v from public.v_service_style_costs where code = 't_tabla';
  assert v = 4, format('tabla 4 ₺: %s', v);
  select pack_cost_per_person into v from public.v_service_style_costs where code = 't_kuvet';
  assert v = 2, format('küvet 50/25 = 2 ₺: %s', v);

  -- ── Müşteri menüsü (4 çeşit, küvet, 180 ₺): sipariş fiyatı ve sunum oradan gelir
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgr, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.customer_menus (customer_id, meal, menu_type_code, service_style, unit_price, vat_rate, name, is_default)
    values (c, 'ogle', '4_cesit', 't_kuvet', 180, 10, 'Öğle 4 çeşit', true) returning id into cm;
  insert into public.meal_orders (service_date, meal, customer_id, customer_menu_id, ordered_qty, unit_price) values (d, 'ogle', c, cm, 60, 1) returning id into o;
  select unit_price, service_style into v, t from public.meal_orders where id = o;
  assert v = 180 and t = 't_kuvet', format('fiyat/sunum menü tanımından: %s %s', v, t);
  begin
    insert into public.meal_orders (service_date, meal, customer_id, customer_menu_id, ordered_qty) values (d, 'ogle', c2, cm, 10);
    assert false, 'başka müşterinin menü tanımı kullanılamaz';
  exception when check_violation then null;
  end;
  -- üretim kırılımı: 60 kişi küvette 3 kap
  perform set_config('role', 'none', true);
  select people, containers, menu_label into n, exp, t from public.v_production_breakdown where customer_id = c and service_date = d and meal = 'ogle';
  assert n = 60 and exp = 3 and t = 'Öğle 4 çeşit', format('kırılım 60 kişi / 3 küvet: %s %s %s', n, exp, t);

  -- ── Aylık sipariş: iki ay sonrası, her gün 40 kişi, pazar yok → gün sayısı − pazar sayısı satır; ikinci üretim 0
  per := to_char(date_trunc('month', current_date) + interval '2 month', 'YYYY-MM');
  select count(*) filter (where extract(isodow from g) <> 7) into exp
    from generate_series(to_date(per || '-01', 'YYYY-MM-DD'), (to_date(per || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date, interval '1 day') g;
  perform set_config('role', 'authenticated', true);
  insert into public.standing_orders (customer_id, customer_menu_id, meal, period, default_qty, weekday_qty) values (c, cm, 'ogle', per, 40, '{"7": 0}') returning id into so;
  n := public.standing_order_generate(so);
  assert n = exp, format('aylık üretim %s satır olmalı: %s', exp, n);
  n := public.standing_order_generate(so);
  assert n = 0, 'var olan siparişler ezilmemeli';
  select count(*) into n from public.meal_orders where customer_id = c and source = 'aylik' and unit_price = 180;
  assert n = exp, 'aylık siparişler menü fiyatıyla';
  perform set_config('request.jwt.claims', json_build_object('sub', u_cook, 'role', 'authenticated')::text, true);
  begin
    perform public.set_portal_pin(c, '1234');
    assert false, 'aşçıbaşı PIN belirleyemez';
  exception when insufficient_privilege then null;
  end;

  -- ── Müşteri (giriş yapmış) fiyat değiştiremez
  perform set_config('request.jwt.claims', json_build_object('sub', u_cust, 'role', 'authenticated')::text, true);
  insert into public.meal_orders (service_date, meal, customer_id, customer_menu_id, ordered_qty, unit_price, vat_rate) values (d + 1, 'ogle', c, cm, 50, 1, 0) returning id into o;
  perform set_config('role', 'none', true);
  select unit_price, source into v, t from public.meal_orders where id = o;
  assert v = 180 and t = 'portal', format('müşteri fiyatı değiştiremez: %s %s', v, t);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.customer_portal_tokens;
  assert n = 0, 'müşteri jeton tablosunu görmemeli';
  perform set_config('request.jwt.claims', json_build_object('sub', u_cust2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.customer_menus where customer_id = c;
  assert n = 0, 'müşteri başkasının menü tanımını görmemeli';

  -- ── Portal v2 (anonim, jetonla): kesim sonrası red; menü seçimi; geri bildirim
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{}', true);
  j := public.portal_info_v2(tok);
  assert jsonb_array_length(j->'menus') = 1 and (j->>'balance_available')::boolean = false, format('portal menüleri: %s', j->'menus');
  begin
    perform public.portal_set_order_v2(tok, (now() at time zone 'Europe/Istanbul')::date, 'ogle', 10, cm, null);
    assert false, 'kesim sonrası değişiklik reddedilmeli';
  exception when insufficient_privilege then null;
  end;
  j := public.portal_set_order_v2(tok, d + 2, 'ogle', 70, cm, 'portal');
  assert j->'orders' @> jsonb_build_array(jsonb_build_object('qty', 70, 'customer_menu_id', cm)), format('portal siparişi: %s', j->'orders');
  begin
    perform public.portal_set_order_v2(tok, d + 2, 'aksam', 10, cm, null);
    assert false, 'öğlen menüsü akşama seçilemez';
  exception when check_violation then null;
  end;
  begin
    perform public.portal_feedback(tok, current_date, 'ogle', 'sikayet', null, 'x');
    assert false, 'şikâyet açıklamasız olmamalı';
  exception when check_violation then null;
  end;
  perform public.portal_feedback(tok, current_date, 'ogle', 'sikayet', 2, 'Pilav soğuktu', 'sicaklik');
  perform public.portal_feedback(tok, current_date, 'ogle', 'begeni', 5, null);
  begin
    perform public.portal_info_v2(gen_random_uuid());
    assert false, 'geçersiz jeton';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.customer_feedback;
    assert false, 'anonim geri bildirim tablosunu okuyamaz';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'none', true);
  select count(*) into n from public.customer_feedback where customer_id = c and source = 'portal';
  assert n = 2, 'iki geri bildirim';

  -- ── Alerji: süt alerjisi olan firmaya sütlü yemek → üretim kontrolünde "alerji" uyarısı
  insert into public.ingredients (name, stock_unit, allergens, last_price) values ('M Süt', 'lt', array['sut'], 30) returning id into i_sut;
  insert into public.recipes (name, category_code) values ('M Sütlaç', 'tatli') returning id into r;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, net_qty) values (r, i_sut, 150);
  insert into public.menus (name, kind) values ('M Menü', 'standart') returning id into m;
  insert into public.menu_items (menu_id, recipe_id, course) values (m, r, 'tatli');
  insert into public.menu_plans (plan_date, meal, customer_id, menu_id) values (d, 'ogle', c, m);
  insert into public.customer_notes (customer_id, kind, allergen, text, people) values (c, 'alerji', 'sut', 'Süt alerjisi', 3);
  select count(*) into n from public.v_menu_allergen_conflicts where customer_id = c and service_date = d;
  assert n >= 1, 'alerji çakışması görünmeli';
  perform set_config('request.jwt.claims', json_build_object('sub', u_cook, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  po := public.po_build(d, 'ogle');
  j := public.po_check(po);
  assert j @> '[{"tur": "alerji"}]', format('alerji uyarısı: %s', j);

  -- ── PIN: yönetici belirler, özet okunamaz
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgr, 'role', 'authenticated')::text, true);
  perform public.set_portal_pin(c, '4821');
  begin
    select pin_hash into t from public.customer_portal_tokens where customer_id = c;
    assert false, 'PIN özeti okunamamalı';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'none', true);
  select count(*) into n from public.customer_portal_tokens where customer_id = c and pin_hash = extensions.crypt('4821', pin_hash);
  assert n = 1, 'PIN bcrypt ile doğrulanmalı';

  -- ── Kalori: 150 ml süt, 100 ml = 64 kcal → 96 kcal
  update public.ingredients set kcal_100 = 64 where id = i_sut;
  select kcal_per_portion into v from public.v_recipe_kcal where recipe_id = r;
  assert v = 96, format('96 kcal: %s', v);
  raise notice 'customer_menus OK';
end $$;
rollback;
