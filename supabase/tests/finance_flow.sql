-- Teslim = gelir ; gelen fatura onayı = gider ; ödeme = kasa bakiyesi ; portal kesim saati
begin;
do $$
declare
  u_acc uuid := gen_random_uuid(); u_cook uuid := gen_random_uuid(); u_cust uuid := gen_random_uuid();
  c uuid; c2 uuid; i1 uuid; r uuid; m uuid; o uuid; inv uuid; acc uuid; e uuid; v numeric; n int; d date;
begin
  -- Tablo boşsa ilk kullanıcı yönetici olur; test kullanıcılarından önce bir yönetici oluştur
  insert into auth.users (id, email) values (gen_random_uuid(), 'boss@x.test');
  insert into auth.users (id, email) values (u_acc, 'a@x.test'), (u_cook, 'k@x.test'), (u_cust, 'm@x.test');
  insert into public.customers (name, default_meal_price, payment_term_days) values ('F Fabrika', 150, 30) returning id into c;
  insert into public.customers (name) values ('F Başka Firma') returning id into c2;
  insert into public.team_members (user_id, role) values (u_acc, 'muhasebe'), (u_cook, 'asci_basi');
  insert into public.team_members (user_id, role, customer_id) values (u_cust, 'musteri', c);
  insert into public.ingredients (name, stock_unit, waste_pct, last_price) values ('F Et', 'kg', 10, 600) returning id into i1;
  insert into public.recipes (name, category_code) values ('F Kebap', 'ana_yemek') returning id into r;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, net_qty) values (r, i1, 120);  -- 80 ₺/porsiyon
  insert into public.menus (name) values ('F Menü') returning id into m;
  insert into public.menu_items (menu_id, recipe_id, portion_factor) values (m, r, 1);
  d := (now() at time zone 'Europe/Istanbul')::date;

  -- Sipariş ve üretim planı
  insert into public.meal_orders (service_date, customer_id, menu_id, ordered_qty, unit_price) values (d, c, m, 100, 150) returning id into o;
  perform set_config('request.jwt.claims', json_build_object('sub', u_cook, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- Aşçıbaşı finans defterini göremez
  select count(*) into n from public.finance_entries;
  assert n = 0, 'aşçıbaşı defteri görmemeli';
  reset role;


  -- Teslim → gelir (alacak)
  update public.meal_orders set status = 'teslim_edildi', delivered_qty = 98 where id = o;
  select count(*) into n from public.finance_entries where source = 'siparis' and source_id = o and net_amount = 14700 and vat_amount = 1470 and status = 'bekliyor' and due_date = d + 30;
  assert n = 1, 'teslim edilen 98 kişi × 150 = 14.700 + %10 KDV alacak olmalı';
  update public.meal_orders set status = 'onaylandi' where id = o;
  select count(*) into n from public.finance_entries where source = 'siparis' and source_id = o;
  assert n = 0, 'teslim geri alınınca gelir kaydı kalkmalı';

  -- Gelen fatura (elektrik) → onay → gider borcu → ödeme → kasa
  insert into public.purchase_invoices (supplier_name, supplier_tax_no, invoice_no, invoice_date, category_code, net_amount, vat_amount, total_amount, status, source)
  values ('Trakya Elektrik Perakende', '1234567890', 'TEP2026000001', d, 'elektrik', 10000, 2000, 12000, 'onaylandi', 'ubl_xml') returning id into inv;
  select id into e from public.finance_entries where source = 'gelen_fatura' and source_id = inv and kind = 'gider' and category_code = 'elektrik' and status = 'bekliyor';
  assert e is not null, 'onaylı fatura gider borcu oluşturmalı';
  assert (select category_code from public.supplier_categories where supplier_key = '1234567890') = 'elektrik', 'tedarikçi kategorisi hatırlanmalı';

  select id into acc from public.finance_accounts where name = 'Banka';
  perform set_config('request.jwt.claims', json_build_object('sub', u_acc, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.finance_entries set status = 'odendi', account_id = acc, paid_at = d where id = e;
  insert into public.finance_entries (entry_date, kind, category_code, description, net_amount, status, account_id)
  values (d, 'gelir', 'organizasyon', 'Mevlüt yemeği 200 kişi', 30000, 'odendi', acc);
  select balance into v from public.v_account_balances where id = acc;
  assert v = 18000, format('banka bakiyesi 30000 - 12000 = 18000 olmalı: %s', v);
  begin
    insert into public.finance_entries (entry_date, kind, category_code, description, net_amount, status) values (d, 'gider', 'tabldot_satis', 'x', 1, 'bekliyor');
    raise exception 'gider kaydı gelir kategorisine yazılabildi';
  exception when foreign_key_violation then null;
  end;
  reset role;

  -- Müşteri portalı: kendi siparişini görür, başkasınınkini görmez, bugüne sipariş giremez (kesim geçti)
  insert into public.meal_orders (service_date, customer_id, ordered_qty) values (d, c2, 10);
  perform set_config('request.jwt.claims', json_build_object('sub', u_cust, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.meal_orders;
  assert n = 1, format('müşteri yalnız kendi siparişini görmeli: %s', n);
  begin
    insert into public.meal_orders (service_date, customer_id, ordered_qty, meal) values (d, c, 5, 'aksam');
    raise exception 'müşteri kesim sonrası sipariş girebildi';
  exception when insufficient_privilege then null;
  end;
  insert into public.meal_orders (service_date, customer_id, ordered_qty, meal) values (d + 2, c, 120, 'ogle');
  begin
    insert into public.meal_orders (service_date, customer_id, ordered_qty, meal) values (d + 2, c2, 5, 'aksam');
    raise exception 'müşteri başka firmaya sipariş girebildi';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.finance_entries;
  assert n = 0, 'müşteri defteri görmemeli';
  reset role;
  raise notice 'FİNANS AKIŞI TESTLERİ GEÇTİ';
end $$;
rollback;
