-- Faz 3E-1: tedarikçi etiketli partiler, FEFO/FIFO çıkış, fatura ↔ sipariş teslimi eşleştirme, tek gider (begin … rollback)
begin;
do $$
declare
  u_mgr uuid := gen_random_uuid(); u_depo uuid := gen_random_uuid(); u_drv uuid := gen_random_uuid();
  cust uuid; ing uuid; sup uuid; sup2 uuid; po uuid; inv uuid; inv2 uuid; r jsonb; n int; v numeric; l1 uuid; l2 uuid;
begin
  insert into auth.users (id, email) values (u_mgr, 'y@lot.test'), (u_depo, 'd@lot.test'), (u_drv, 's@lot.test');
  insert into public.team_members (user_id, role) values (u_mgr, 'yonetici'), (u_depo, 'depo'), (u_drv, 'sofor')
    on conflict (user_id) do update set role = excluded.role;
  insert into public.customers (name, default_meal_price, vat_rate) values ('T Lot Fabrika', 250, 10) returning id into cust;
  insert into public.ingredients (name, stock_unit) values ('T Lot Kıyma', 'kg') returning id into ing;
  insert into public.suppliers (name, tax_no) values ('T Lot Kasap', '1111111111') returning id into sup;
  insert into public.suppliers (name, tax_no) values ('T Lot Toptan', '2222222222') returning id into sup2;

  perform set_config('request.jwt.claims', json_build_object('sub', u_depo, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- 1) Sipariş teslimi → parti (tedarikçi etiketli); sonra gelen fatura aynı partiyi tamamlar, yeni stok/parti açmaz
  perform set_config('role', 'none', true);
  insert into public.purchase_orders (supplier_id, status, lines) values (sup, 'teslim', '[]') returning id into po;
  perform set_config('role', 'authenticated', true);
  r := public.receive_stock(ing, 10, 380, 'siparis', po, null, current_date - 5);
  assert r->>'durum' = 'giris', format('sipariş teslimi giriş olmalı: %s', r);
  select id into l1 from public.stock_lots where purchase_order_id = po and ingredient_id = ing;
  assert l1 is not null, 'sipariş partisi açılmalı';
  select count(*) into n from public.stock_lots where id = l1 and supplier_id = sup and source = 'pok' and qty_remaining = 10;
  assert n = 1, 'parti tedarikçi etiketli ve 10 kg olmalı';

  perform set_config('role', 'none', true);
  insert into public.purchase_invoices (supplier_name, supplier_tax_no, invoice_no, invoice_date, category_code, kind, net_amount, vat_amount, total_amount, status, source, purchase_order_id)
    values ('T Lot Kasap', '1111111111', 'TL-1', current_date, 'gida_hammadde', 'gider', 4000, 40, 4040, 'onaylandi', 'manuel', po) returning id into inv;
  perform set_config('role', 'authenticated', true);
  r := public.receive_stock(ing, 10, 400, 'fatura', inv);
  assert r->>'durum' = 'eslesti', format('fatura sipariş partisiyle eşleşmeli: %s', r);
  select count(*) into n from public.stock_movements where ingredient_id = ing and kind = 'giris';
  assert n = 1, format('aynı mal tek giriş olmalı, %s', n);
  select count(*) into n from public.stock_lots where ingredient_id = ing;
  assert n = 1, format('tek parti olmalı, %s', n);
  select unit_cost into v from public.stock_lots where id = l1;
  assert v = 400, format('fatura fiyatı partiye yazılmalı, %s', v);
  select avg_cost into v from public.ingredients where id = ing;
  assert v = 400, format('ortalama maliyet faturaya göre yenilenmeli, %s', v);
  select count(*) into n from public.stock_lots where id = l1 and purchase_invoice_id = inv;
  assert n = 1, 'parti faturaya bağlanmalı';

  -- 2) İkinci tedarikçiden faturalı giriş (SKT daha yakın) → FEFO önce bunu tüketir
  perform set_config('role', 'none', true);
  insert into public.purchase_invoices (supplier_name, supplier_tax_no, invoice_no, invoice_date, category_code, kind, net_amount, vat_amount, total_amount, status, source)
    values ('T Lot Toptan', '2222222222', 'TT-9', current_date, 'gida_hammadde', 'gider', 1800, 18, 1818, 'onaylandi', 'manuel') returning id into inv2;
  perform set_config('role', 'authenticated', true);
  r := public.receive_stock(ing, 5, 360, 'fatura', inv2, null, current_date, 'LOT-A', current_date + 2);
  select (r->>'lot_id')::uuid into l2;
  select count(*) into n from public.stock_lots where id = l2 and supplier_id = sup2 and expiry_date = current_date + 2;
  assert n = 1, 'fatura partisi tedarikçiyi VKN ile bulmalı ve SKT taşımalı';

  -- muhasebe kuralı: iki fatura → tam 2 gıda gideri; sipariş teslimi ve partiler gider yazmaz
  perform set_config('role', 'none', true);
  select count(*) into n from public.finance_entries where kind = 'gider' and category_code = 'gida_hammadde' and counterparty like 'T Lot %';
  assert n = 2, format('gider yalnız faturadan: 2 olmalı, %s', n);
  perform set_config('role', 'authenticated', true);

  -- 3) Üretim çıkışı 8 kg: önce SKT'si yakın 5 kg (l2), sonra 3 kg (l1)
  r := public.consume_stock(ing, 8, 'elle', null, 'cikis');
  assert (r->>'partisiz')::numeric = 0, format('stok yeterli, partisiz çıkış olmamalı: %s', r);
  select qty_remaining into v from public.stock_lots where id = l2;
  assert v = 0, format('FEFO: SKT yakın parti önce bitmeli, %s', v);
  select count(*) into n from public.stock_lots where id = l2 and status = 'bitti';
  assert n = 1, 'biten parti "bitti" olmalı';
  select qty_remaining into v from public.stock_lots where id = l1;
  assert v = 7, format('eski parti 7 kg kalmalı, %s', v);

  -- 4) Sevk müşteri etiketli ve gider yazmaz; v_stock_by_supplier doğru
  perform set_config('request.jwt.claims', json_build_object('sub', u_drv, 'role', 'authenticated')::text, true);
  r := public.consume_stock(ing, 2, 'sevk', null, 'sevk', cust);
  perform set_config('request.jwt.claims', json_build_object('sub', u_depo, 'role', 'authenticated')::text, true);
  select count(*) into n from public.v_lot_trace where lot_id = l1 and customer_id = cust and kind = 'sevk' and qty = 2;
  assert n = 1, 'lot geri izleme: parti → müşteri görünmeli';
  perform set_config('role', 'none', true);
  select count(*) into n from public.finance_entries where kind = 'gider' and category_code = 'gida_hammadde' and counterparty like 'T Lot %';
  assert n = 2, format('sevk ve üretim gider yazmamalı, %s', n);
  perform set_config('role', 'authenticated', true);
  select qty_remaining into v from public.v_stock_by_supplier where ingredient_id = ing and supplier_id = sup;
  assert v = 5, format('kalem × tedarikçi kalan 5 kg olmalı, %s', v);
  select count(*) into n from public.v_stock_by_supplier where ingredient_id = ing and supplier_id = sup2;
  assert n = 0, 'biten parti kalan listesinde olmamalı';

  -- 5) Yetersiz stok: partisiz çıkış uyarısı
  r := public.consume_stock(ing, 7, 'elle', null, 'fire');
  assert (r->>'partisiz')::numeric = 2 and r->>'uyari' is not null, format('2 kg partisiz çıkış uyarısı beklenir: %s', r);

  -- 6) Aynı sipariş aynı malı ikinci kez sokamaz
  begin
    perform public.receive_stock(ing, 1, 380, 'siparis', po);
    assert false, 'aynı sipariş ikinci kez stok eklememeli';
  exception when unique_violation then null;
  end;

  -- 7) İstemci partiye doğrudan yazamaz
  begin
    insert into public.stock_lots (ingredient_id, qty_in, qty_remaining, source) values (ing, 1, 1, 'elle');
    assert false, 'parti doğrudan yazılamamalı';
  exception when insufficient_privilege then null;
  end;

  -- 8) Birim değişimi partileri de çevirir (kg → g)
  perform set_config('role', 'none', true);
  update public.ingredients set stock_unit = 'g' where id = ing;
  select qty_remaining into v from public.stock_lots where id = l1;
  assert v = 0, format('l1 tükendi (0), %s', v);
  select qty_in into v from public.stock_lots where id = l1;
  assert v = 10000, format('10 kg → 10000 g, %s', v);
  select unit_cost into v from public.stock_lots where id = l1;
  assert v = 0.4, format('400 ₺/kg → 0,4 ₺/g, %s', v);

  raise notice 'stock_lots OK';
end $$;
rollback;
