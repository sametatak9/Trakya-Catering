-- Kurucu yetkisi · personel avansı → kasa gideri · araç yakıtı → gider + km · stok girişi → ağırlıklı ortalama maliyet · kartvizit
begin;
do $$
declare
  u_boss uuid := gen_random_uuid(); u_drv uuid := gen_random_uuid();
  acc uuid; emp uuid; led uuid; veh uuid; vl uuid; ing uuid; n int; v numeric; k int;
begin
  insert into auth.users (id, email) values (u_boss, 'kurucu@x.test'), (u_drv, 'sofor@x.test');
  delete from public.team_members where user_id in (u_boss, u_drv);
  insert into public.team_members (user_id, role) values (u_boss, 'kurucu'), (u_drv, 'sofor')
    on conflict (user_id) do update set role = excluded.role;
  select id into acc from public.finance_accounts where name = 'Nakit Kasa';

  -- Kurucu her role geçer; şoför personel defterini göremez
  perform set_config('request.jwt.claims', json_build_object('sub', u_boss, 'role', 'authenticated')::text, true);
  assert public.has_role(array['muhasebe']), 'kurucu her yetkiye sahip olmalı';
  perform set_config('request.jwt.claims', json_build_object('sub', u_drv, 'role', 'authenticated')::text, true);
  assert not public.has_role(array['muhasebe']), 'şoför muhasebe değil';
  perform set_config('request.jwt.claims', '{}', true);

  -- Personel avansı: deftere yazılır, kasadan gider düşer; silinince gider kalkar
  insert into public.employees (full_name, pay_type, daily_wage, card_slug) values ('T Usta', 'yevmiye', 1500, 't-usta') returning id into emp;
  insert into public.employee_ledger (employee_id, entry_date, kind, amount, account_id) values (emp, current_date, 'avans', 2000, acc) returning id into led;
  select count(*) into n from public.finance_entries where source = 'personel' and source_id = led and status = 'odendi' and account_id = acc and net_amount = 2000 and category_code = 'personel_maas';
  assert n = 1, 'avans kasadan gider olmalı';
  delete from public.employee_ledger where id = led;
  select count(*) into n from public.finance_entries where source = 'personel' and source_id = led;
  assert n = 0, 'silinen avansın gideri kalkmalı';

  -- Araç yakıtı: km güncellenir, gider açılır (hesap yoksa borç)
  insert into public.vehicles (plate, name, current_km) values ('59 T 001', 'Test Frigo', 100000) returning id into veh;
  insert into public.vehicle_logs (vehicle_id, kind, km, liters, amount) values (veh, 'yakit', 100450, 60, 2784) returning id into vl;
  select current_km into k from public.vehicles where id = veh;
  assert k = 100450, 'km güncellenmeli';
  select count(*) into n from public.finance_entries where source = 'arac' and source_id = vl and category_code = 'akaryakit' and status = 'bekliyor' and net_amount = 2784;
  assert n = 1, 'yakıt gideri borç olarak açılmalı';

  -- Stok: 10 kg × 100 + 10 kg × 130 → ortalama 115
  insert into public.ingredients (name, stock_unit) values ('T Pirinç', 'kg') returning id into ing;
  insert into public.stock_movements (ingredient_id, kind, qty, unit_cost, source) values (ing, 'giris', 10, 100, 'fatura');
  insert into public.stock_movements (ingredient_id, kind, qty, unit_cost, source) values (ing, 'giris', 10, 130, 'fatura');
  select avg_cost into v from public.ingredients where id = ing;
  assert v = 115, format('ağırlıklı ortalama 115 olmalı, %s', v);
  begin
    insert into public.stock_movements (ingredient_id, kind, qty) values (ing, 'cikis', 5);
    assert false, 'çıkış pozitif miktarla kaydedilmemeli';
  exception when check_violation then null;
  end;

  -- Kartvizit herkese açık fonksiyonla okunur
  select count(*) into n from public.public_card('t-usta');
  assert n = 1, 'kartvizit okunmalı';
  raise notice 'operations_flow OK';
end $$;
rollback;
