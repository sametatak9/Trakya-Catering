-- Faz 3A güvenlik testleri: daha önce açık olan her yol artık kapalı olmalı (begin … rollback)
begin;
do $$
declare
  u_boss uuid := gen_random_uuid(); u_mgr uuid := gen_random_uuid(); u_mgr2 uuid := gen_random_uuid();
  u_drv uuid := gen_random_uuid(); u_chef uuid := gen_random_uuid(); u_cust uuid := gen_random_uuid(); u_depo uuid := gen_random_uuid();
  emp uuid; emp_self uuid; cust uuid; ord uuid; ing uuid; ing2 uuid; sup uuid; po uuid; inv uuid; mv uuid;
  n int; v numeric; t text; ok boolean;
begin
  insert into auth.users (id, email) values (u_boss, 'k@x.test'), (u_mgr, 'y@x.test'), (u_mgr2, 'y2@x.test'),
    (u_drv, 's@x.test'), (u_chef, 'a@x.test'), (u_cust, 'm@x.test'), (u_depo, 'd@x.test');
  insert into public.customers (name, default_meal_price, vat_rate) values ('T Fabrika', 250, 10) returning id into cust;
  insert into public.team_members (user_id, role, customer_id) values (u_boss, 'kurucu', null), (u_mgr, 'yonetici', null), (u_mgr2, 'yonetici', null),
    (u_drv, 'sofor', null), (u_chef, 'asci_basi', null), (u_cust, 'musteri', cust), (u_depo, 'depo', null)
    on conflict (user_id) do update set role = excluded.role, customer_id = excluded.customer_id;
  insert into public.employees (full_name, pay_type, monthly_salary, iban) values ('T Muhasebe Kişi', 'aylik', 50000, 'TR000000000000000000000001') returning id into emp;
  insert into public.employees (full_name, pay_type, daily_wage, user_id) values ('T Şoför', 'yevmiye', 1500, u_drv) returning id into emp_self;
  insert into public.ingredients (name, stock_unit) values ('T Kıyma', 'kg') returning id into ing;
  insert into public.suppliers (name, tax_no) values ('T Kasap', '1234567890') returning id into sup;

  -- ── S-1: şoför başkasının maaşını/IBAN'ını göremez, rehberden adını görür; kendi kartını görür
  perform set_config('request.jwt.claims', json_build_object('sub', u_drv, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.employees where id = emp;
  assert n = 0, 'S-1: şoför başkasının personel kartını görmemeli';
  select count(*) into n from public.employees where id = emp_self;
  assert n = 1, 'S-1: şoför kendi kartını görmeli';
  select count(*) into n from public.v_employee_directory where id = emp;
  assert n = 1, 'S-1: rehberde ad görünmeli';

  -- ── S-3: kendi talebini onaylı ekleyemez; bekleyen talep ekleyebilir
  begin
    insert into public.employee_requests (employee_id, kind, amount, status) values (emp_self, 'avans', 1000, 'onaylandi');
    assert false, 'S-3: kendini onaylama engellenmeli';
  exception when insufficient_privilege then null;
  end;
  insert into public.employee_requests (employee_id, kind, amount) values (emp_self, 'avans', 1000);

  -- ── B-5: şoför yalnız sevk yazar
  begin
    insert into public.stock_movements (ingredient_id, kind, qty, source) values (ing, 'giris', 5, 'elle');
    assert false, 'B-5: şoför stok girişi yapamamalı';
  exception when insufficient_privilege then null;
  end;
  insert into public.stock_movements (ingredient_id, kind, qty, source, customer_id) values (ing, 'sevk', -1, 'sevk', cust);

  -- ── S-4: yönetici başkasını kurucu yapamaz, kendi rolünü değiştiremez
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgr, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    update public.team_members set role = 'kurucu' where user_id = u_mgr2;
    assert false, 'S-4: yönetici başkasını kurucu yapamamalı';
  exception when insufficient_privilege then null;
  end;
  update public.team_members set role = 'kurucu' where user_id = u_mgr;
  get diagnostics n = row_count;
  assert n = 0, 'S-4: yönetici kendi satırını değiştirememeli';
  begin
    insert into public.team_members (user_id, role) values (gen_random_uuid(), 'kurucu');
    assert false, 'S-4: yönetici kurucu ekleyememeli';
  exception when insufficient_privilege or foreign_key_violation then null;
  end;
  update public.team_members set role = 'depo' where user_id = u_boss;
  get diagnostics n = row_count;
  assert n = 0, 'S-4: yönetici kurucuyu düşüremez';

  -- ── S-2: portal müşterisi fiyatı 1 ₺ yazsa bile 250 ₺'ye zorlanır
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_cust, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.meal_orders (service_date, meal, customer_id, ordered_qty, unit_price, vat_rate, kind, delivered_qty, status)
    values (current_date + 3, 'ogle', cust, 100, 1, 0, 'organizasyon', 999, 'bekliyor') returning id into ord;
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '{}', true);
  select unit_price into v from public.meal_orders where id = ord;
  assert v = 250, format('S-2: fiyat 250 olmalı, %s', v);
  select count(*) into n from public.meal_orders where id = ord and kind = 'sozlesmeli' and delivered_qty is null and vat_rate = 10;
  assert n = 1, 'S-2: tür, teslim ve KDV zorlanmalı';

  -- ── B-1: fiyatsız teslim reddedilir
  update public.customers set default_meal_price = 0 where id = cust;
  insert into public.meal_orders (service_date, meal, customer_id, ordered_qty, unit_price) values (current_date, 'aksam', cust, 50, 0) returning id into ord;
  begin
    update public.meal_orders set status = 'teslim_edildi' where id = ord;
    assert false, 'B-1: fiyatsız teslim engellenmeli';
  exception when check_violation then null;
  end;

  -- ── B-4: fiyat girişi ortalama maliyete dokunmaz; ortalama yalnız stok girişinden
  insert into public.ingredient_prices (ingredient_id, price, source) values (ing, 400, 'manuel');
  select avg_cost into v from public.ingredients where id = ing;
  assert v is null, 'B-4: fiyat girişi avg_cost yazmamalı';

  -- ── Fiyat sütunu: aşçıbaşı last_price/avg_cost'u doğrudan değiştiremez
  perform set_config('request.jwt.claims', json_build_object('sub', u_chef, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    update public.ingredients set last_price = 1 where id = ing;
    assert false, 'fiyat doğrudan değişmemeli';
  exception when insufficient_privilege then null;
  end;
  update public.ingredients set waste_pct = 5 where id = ing;  -- diğer alanlar serbest
  perform set_config('role', 'none', true);

  -- ── B-3 / muhasebe: sipariş teslimi + bağlı fatura → tek stok girişi, tek gider
  insert into public.purchase_orders (supplier_id, status, lines) values (sup, 'teslim', '[]') returning id into po;
  insert into public.stock_movements (ingredient_id, kind, qty, unit_cost, source, source_id) values (ing, 'giris', 10, 380, 'siparis', po) returning id into mv;
  select supplier_id into sup from public.stock_movements where id = mv;
  assert sup is not null, 'B-3: sipariş girişi tedarikçi etiketi taşımalı';
  insert into public.purchase_invoices (supplier_name, supplier_tax_no, invoice_no, invoice_date, category_code, kind, net_amount, vat_amount, total_amount, status, source, purchase_order_id)
    values ('T Kasap', '1234567890', 'TK-1', current_date, 'gida_hammadde', 'gider', 3800, 38, 3838, 'onaylandi', 'manuel', po) returning id into inv;
  begin
    insert into public.stock_movements (ingredient_id, kind, qty, unit_cost, source, source_id) values (ing, 'giris', 10, 380, 'fatura', inv);
    assert false, 'B-3: aynı mal faturayla ikinci kez stoğa girmemeli';
  exception when unique_violation then null;
  end;
  begin
    insert into public.stock_movements (ingredient_id, kind, qty, unit_cost, source, source_id) values (ing, 'giris', 1, 380, 'siparis', po);
    assert false, 'B-3: aynı sipariş aynı malı iki kez sokmamalı';
  exception when unique_violation then null;
  end;
  -- üretim çıkışı gider yazmaz
  insert into public.stock_movements (ingredient_id, kind, qty, source) values (ing, 'cikis', -4, 'elle');
  select count(*) into n from public.finance_entries f where f.kind = 'gider' and f.category_code = 'gida_hammadde' and f.counterparty = 'T Kasap';
  assert n = 1, format('muhasebe kuralı: gıda gideri tam 1 kayıt olmalı, %s', n);
  select avg_cost into v from public.ingredients where id = ing;
  assert v = 380, format('ortalama 380 olmalı, %s', v);

  -- ── B-5: depo hareketi silemez/değiştiremez (ters kayıt), yönetici düzeltebilir
  perform set_config('request.jwt.claims', json_build_object('sub', u_depo, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  delete from public.stock_movements where id = mv;
  get diagnostics n = row_count;
  assert n = 0, 'B-5: depo hareket silememeli';
  perform set_config('role', 'none', true);

  -- ── Birim değişimi: kg → g aynı boyutta çevrilir; kg → adet reddedilir
  update public.ingredients set stock_unit = 'g' where id = ing;
  select last_price into v from public.ingredients where id = ing;
  assert v = 0.4, format('400 ₺/kg → 0,4 ₺/g olmalı, %s', v);
  select sum(qty) into v from public.stock_movements where ingredient_id = ing;
  assert v = 5000, format('eldeki 5 kg → 5000 g olmalı, %s', v);
  begin
    update public.ingredients set stock_unit = 'adet' where id = ing;
    assert false, 'farklı boyut reddedilmeli';
  exception when check_violation then null;
  end;
  insert into public.ingredients (name, stock_unit) values ('T Yeni Kalem', 'kg') returning id into ing2;
  update public.ingredients set stock_unit = 'adet' where id = ing2;  -- geçmişi yoksa serbest

  -- ── Denetim kaydı değişmez ve zincirli
  begin
    update public.audit_log set summary = 'x' where id = (select max(id) from public.audit_log);
    assert false, 'denetim kaydı güncellenmemeli';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.audit_log where id = (select max(id) from public.audit_log);
    assert false, 'denetim kaydı silinmemeli';
  exception when insufficient_privilege then null;
  end;
  assert public.verify_audit_chain(), 'denetim zinciri doğrulanmalı';

  -- ── Hata kaydı: dakikada en çok 20, kişisel veri maskelenir
  perform set_config('request.jwt.claims', json_build_object('sub', u_chef, 'role', 'authenticated')::text, true);
  for n in 1..25 loop
    perform public.log_client_error(jsonb_build_object('kind', 'ekran', 'message', 'Hata ali@firma.com 0532 123 45 67'));
  end loop;
  select count(*) into n from public.error_events where user_id = u_chef;
  assert n = 20, format('hız sınırı 20 olmalı, %s', n);
  select message into t from public.error_events where user_id = u_chef limit 1;
  assert t not like '%ali@firma.com%' and t not like '%0532%', format('kişisel veri maskelenmeli: %s', t);

  raise notice 'security_fixes OK';
end $$;
rollback;
