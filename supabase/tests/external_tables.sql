-- Denetim: başka ajanın canlıya uyguladığı tablolar (portal yetkilisi, aylık menü, elle stok nedeni, müşteri menüsü, kap tipi).
-- Rol matrisi ve kurallar. Vault anahtarı yalnız işlem içinde oluşturulur. begin … rollback.
begin;
do $$
declare
  u_mgr uuid := gen_random_uuid(); u_cook uuid := gen_random_uuid(); u_depo uuid := gen_random_uuid(); u_cust uuid := gen_random_uuid();
  c uuid; c2 uuid; r uuid; r2 uuid; mm uuid; pc uuid; sup uuid; ing uuid; mv uuid; n int; j jsonb; t text; v numeric;
begin
  insert into auth.users (id, email) values (u_mgr, 'm@x.test'), (u_cook, 'c@x.test'), (u_depo, 'd@x.test'), (u_cust, 'k@x.test');
  insert into public.customers (name, default_meal_price) values ('D Fabrika', 150) returning id into c;
  insert into public.customers (name, default_meal_price) values ('D Diğer', 150) returning id into c2;
  insert into public.team_members (user_id, role, customer_id) values (u_mgr, 'yonetici', null), (u_cook, 'asci_basi', null), (u_depo, 'depo', null), (u_cust, 'musteri', c)
    on conflict (user_id) do update set role = excluded.role, customer_id = excluded.customer_id;
  insert into public.recipes (name, category_code) values ('D Kuru Fasulye', 'ana_yemek') returning id into r;
  insert into public.recipes (name, category_code) values ('D Tavuk Sote', 'ana_yemek') returning id into r2;
  insert into public.recipe_tags (recipe_id, tag) values (r, 'baklagil');
  insert into public.customer_dish_rules (customer_id, rule, tag) values (c, 'yasak_etiket', 'baklagil');

  -- ── Portal yetkilisi: yalnız yönetici; Vault anahtarı yoksa net hata; TC özeti okunamaz
  perform set_config('request.jwt.claims', json_build_object('sub', u_cook, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.portal_contact_save(null, c, 'Ali Veli', '+905551112233', '10000000146', true);
    assert false, 'aşçıbaşı yetkili tanımlayamamalı';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgr, 'role', 'authenticated')::text, true);
  begin
    perform public.portal_contact_save(null, c, 'Ali Veli', '+905551112233', '12345678901', true);
    assert false, 'geçersiz TC reddedilmeli';
  exception when check_violation then null;
  end;
  perform set_config('role', 'none', true);
  if not exists (select 1 from vault.secrets where name = 'portal_tc_pepper') then
    perform set_config('role', 'authenticated', true);
    begin
      perform public.portal_contact_save(null, c, 'Ali Veli', '+905551112233', '10000000146', true);
      assert false, 'anahtarsız kayıt olmamalı';
    exception when object_not_in_prerequisite_state then null;
    end;
    perform set_config('role', 'none', true);
    perform vault.create_secret(repeat('t', 40), 'portal_tc_pepper');
  end if;
  perform set_config('role', 'authenticated', true);
  pc := public.portal_contact_save(null, c, 'Ali Veli', '+905551112233', '10000000146', true);
  select tc_hint into t from public.portal_contacts where id = pc;
  assert t = '46', format('TC ipucu son 2 hane: %s', t);
  begin
    select tc_hmac into t from public.portal_contacts where id = pc;
    assert false, 'TC özeti istemciye açılmamalı';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.portal_claim_check('+905551112233', '10000000146', null);
    assert false, 'eşleştirme yalnız sunucuda';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'none', true);
  j := public.portal_claim_check('+905551112233', '10000000146', null);
  assert (j->>'ok')::boolean, format('doğru TC eşleşmeli: %s', j);
  j := public.portal_claim_check('+905551112233', '10000000070', null);
  assert not (j->>'ok')::boolean, 'yanlış TC eşleşmemeli';

  -- ── Aylık menü: kural ihlali yayını durdurur; gerekçeyle yayınlanır; yayındaki sürüm kilitli; müşteri yalnız kendi yayınını görür
  perform set_config('request.jwt.claims', json_build_object('sub', u_cook, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.monthly_menus (period, customer_id, kind) values (date_trunc('month', current_date + 40)::date, c, '4_kap') returning id into mm;
  insert into public.monthly_menu_days (monthly_menu_id, day, meal, position, recipe_id, course)
    values (mm, date_trunc('month', current_date + 40)::date + 2, 'ogle', 1, r, 'ana'), (mm, date_trunc('month', current_date + 40)::date + 3, 'ogle', 1, r2, 'ana');
  j := public.publish_monthly_menu(mm);
  assert not (j->>'ok')::boolean and j->'violations' @> '[{"rule": "yasak_etiket"}]', format('baklagil yasağı yakalanmalı: %s', j);
  update public.monthly_menu_days set override_reason = 'müşteri bu hafta onay verdi' where monthly_menu_id = mm and recipe_id = r;
  j := public.publish_monthly_menu(mm);
  assert (j->>'ok')::boolean and (j->>'slots')::int = 2, format('iki öğün yayınlanmalı: %s', j);
  select count(*) into n from public.menu_plans where customer_id = c and note = 'Aylık menü';
  assert n = 2, 'menü planına yazılmalı';
  begin
    insert into public.monthly_menu_days (monthly_menu_id, day, meal, position, recipe_id) values (mm, date_trunc('month', current_date + 40)::date + 4, 'ogle', 1, r2);
    assert false, 'yayındaki sürüm kilitli olmalı';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', u_depo, 'role', 'authenticated')::text, true);
  begin
    perform public.publish_monthly_menu(mm);
    assert false, 'depo yayınlayamamalı';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', u_cust, 'role', 'authenticated')::text, true);
  select count(*) into n from public.monthly_menus where id = mm;
  assert n = 1, 'müşteri kendi yayınını görmeli';
  select count(*) into n from public.customer_dish_rules where customer_id = c2;
  assert n = 0, 'müşteri başkasının kuralını görmemeli';
  insert into public.customer_feedback (customer_id, menu_date, kind, rating, text) values (c, current_date, 'begeni', 5, 'Çok güzeldi');
  begin
    insert into public.customer_feedback (customer_id, menu_date, kind, text) values (c2, current_date, 'sikayet', 'x');
    assert false, 'müşteri başka firma adına yazamamalı';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'none', true);

  -- ── Elle stok: "diğer" açıklamasız olmaz; pazar alımı tedarikçisiz olmaz; pazar alımı tedarikçiye borç yazar (tek sefer)
  insert into public.suppliers (name, payment_term_days) values ('D Pazarcı', 7) returning id into sup;
  insert into public.ingredients (name, stock_unit) values ('D Maydanoz', 'adet') returning id into ing;
  begin
    insert into public.stock_movements (ingredient_id, kind, qty, source, reason) values (ing, 'fire', -2, 'elle', 'diger');
    assert false, 'diğer açıklamasız olmamalı';
  exception when check_violation then null;
  end;
  begin
    insert into public.stock_movements (ingredient_id, kind, qty, unit_cost, source, reason) values (ing, 'giris', 30, 15, 'elle', 'pazar_alisverisi');
    assert false, 'pazar alımı tedarikçisiz olmamalı';
  exception when check_violation then null;
  end;
  insert into public.stock_movements (ingredient_id, kind, qty, unit_cost, source, reason, supplier_id) values (ing, 'giris', 30, 15, 'elle', 'pazar_alisverisi', sup) returning id into mv;
  select net_amount into v from public.finance_entries where source = 'manuel' and source_id = mv and kind = 'gider' and status = 'bekliyor';
  assert v = 450, format('30 × 15 = 450 ₺ borç: %s', v);

  -- ── Kap tipi: plastik kapta maliyet zorunlu; maliyetli kabı yalnız yönetici açar; maliyet değişikliği loglanır
  begin
    insert into public.container_types (name, is_plastic) values ('D Plastik kase', true);
    assert false, 'plastik kap maliyetsiz olmamalı';
  exception when check_violation then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', u_cook, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    insert into public.container_types (name, is_plastic, unit_cost) values ('D Plastik kase', true, 2.5);
    assert false, 'aşçıbaşı maliyetli kap açamamalı';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgr, 'role', 'authenticated')::text, true);
  insert into public.container_types (name, is_plastic, unit_cost, service_style) values ('D Plastik kase', true, 2.5, 'tepsi');
  update public.container_types set unit_cost = 3 where name = 'D Plastik kase';
  select count(*) into n from public.container_cost_log l join public.container_types k on k.id = l.container_type_id where k.name = 'D Plastik kase';
  assert n = 2, format('iki maliyet kaydı: %s', n);
  perform set_config('role', 'none', true);
  raise notice 'external_tables OK';
end $$;
rollback;
