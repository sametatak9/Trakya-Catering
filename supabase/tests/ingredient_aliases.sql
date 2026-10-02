-- Faz 3E-2: fatura satırı eşleştirme, takma ad onayı, kopya kart birleştirme (begin … rollback)
begin;
do $$
declare u_mgr uuid := gen_random_uuid(); u_buy uuid := gen_random_uuid(); sup uuid; ing uuid; ing2 uuid; dup uuid; r record; j jsonb; n int;
begin
  insert into auth.users (id, email) values (u_mgr, 'y@al.test'), (u_buy, 'b@al.test');
  insert into public.team_members (user_id, role) values (u_mgr, 'yonetici'), (u_buy, 'satinalma') on conflict (user_id) do update set role = excluded.role;
  insert into public.suppliers (name, tax_no) values ('T AL Kasap', '3333333333') returning id into sup;
  insert into public.ingredients (name, stock_unit, category) values ('T Dana kuşbaşı', 'kg', 'et_tavuk') returning id into ing;
  insert into public.ingredients (name, stock_unit, category) values ('T Dana kıyma', 'kg', 'et_tavuk') returning id into ing2;
  insert into public.ingredients (name, stock_unit, category) values ('T Kuşbaşı dana', 'kg', 'et_tavuk') returning id into dup;
  insert into public.ingredient_prices (ingredient_id, price, source) values (dup, 410, 'manuel');
  perform set_config('request.jwt.claims', json_build_object('sub', u_buy, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  -- "T DANA KUŞBAŞI 1.SINIF KG" → "T Dana kuşbaşı" (birebir ad, kelime sırası farklı olan kart önüne geçmez)
  select * into r from public.match_invoice_line(sup, 'T DANA KUŞBAŞI 1.SINIF KG') limit 1;
  assert r.ingredient_id = ing and r.kaynak = 'ad', format('ad eşleşmesi: %s %s %s', r.name, r.score, r.kaynak);
  -- onaylanan tedarikçi adı ikinci faturada otomatik eşleşir; satıcı kodu en güçlü eşleşme
  perform public.confirm_alias(ing, sup, 'TDANAKSB EXTRA', 'K-77');
  select * into r from public.match_invoice_line(sup, 'TDANAKSB EXTRA 5 KG') limit 1;
  assert r.ingredient_id = ing and r.kaynak = 'alias_tedarikci', format('ikinci fatura otomatik: %s %s', r.name, r.kaynak);
  select * into r from public.match_invoice_line(sup, 'bambaşka ad', 'K-77') limit 1;
  assert r.ingredient_id = ing and r.kaynak = 'kod', 'satıcı kodu';
  select count(*) into n from public.match_invoice_line(sup, 'T Dana');
  assert n between 2 and 5, format('benzerlik adayları %s', n);
  -- birleştirme yalnız yönetici; bağlı kayıtlar taşınır, düşen kart pasif, eski adı takma ad olur
  begin
    perform public.merge_ingredients(ing, dup);
    assert false, 'satınalma birleştirememeli';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgr, 'role', 'authenticated')::text, true);
  j := public.merge_ingredients(ing, dup);
  select count(*) into n from public.ingredient_prices where ingredient_id = ing and price = 410;
  assert n = 1, format('fiyat taşınmalı: %s', j);
  select count(*) into n from public.ingredients where id = dup and not active;
  assert n = 1, 'düşen kart pasif';
  select * into r from public.match_invoice_line(null, 'T Kuşbaşı dana') limit 1;
  assert r.ingredient_id = ing, format('eski ad keep kartına gider: %s', r.name);
  perform set_config('role', 'none', true);
  raise notice 'ingredient_aliases OK';
end $$;
rollback;
