-- Faz 3C-0: onay merkezi — talep eden kendini onaylayamaz, eşik/rol ayrımı, değişmez olay kaydı,
-- personel avans talebi → yönetici onayı → defter + kasa (canlı bakiye). begin … rollback.
begin;
do $$
declare
  u_emp uuid := gen_random_uuid(); u_mgr uuid := gen_random_uuid(); u_mgr2 uuid := gen_random_uuid(); u_acc uuid := gen_random_uuid();
  emp uuid; emp_mgr uuid; req uuid; ar uuid; ar2 uuid; acc uuid; n int; v numeric; t text;
begin
  insert into auth.users (id, email) values (u_emp, 'p@x.test'), (u_mgr, 'y@x.test'), (u_mgr2, 'y2@x.test'), (u_acc, 'm@x.test');
  insert into public.team_members (user_id, role) values (u_emp, 'sofor'), (u_mgr, 'yonetici'), (u_mgr2, 'yonetici'), (u_acc, 'muhasebe')
    on conflict (user_id) do update set role = excluded.role;
  insert into public.employees (full_name, pay_type, daily_wage, user_id) values ('T Şoför', 'yevmiye', 1500, u_emp) returning id into emp;
  insert into public.employees (full_name, pay_type, monthly_salary, user_id) values ('T Yönetici', 'aylik', 60000, u_mgr) returning id into emp_mgr;
  select id into acc from public.finance_accounts where name = 'Nakit Kasa';

  -- 1) Personel kendi hesabından avans talep eder → onay talebi otomatik açılır
  perform set_config('request.jwt.claims', json_build_object('sub', u_emp, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.employee_requests (employee_id, kind, amount, note) values (emp, 'avans', 3000, 'bayram') returning id into req;
  select id into ar from public.approval_requests where subject_table = 'employee_requests' and subject_id = req;
  assert ar is not null, 'onay talebi açılmalı';
  select count(*) into n from public.approval_requests where id = ar and requested_by = u_emp and status = 'bekliyor' and amount = 3000;
  assert n = 1, 'talep sahibi personel, tutar 3000';
  -- personel onaylayamaz (yetki yok ve kendi talebi)
  begin
    perform public.decide_approval(ar, 'onaylandi', null, jsonb_build_object('account_id', acc));
    assert false, 'personel kendi talebini onaylayamamalı';
  exception when insufficient_privilege then null;
  end;
  -- doğrudan durum değiştiremez
  begin
    update public.employee_requests set status = 'onaylandi' where id = req;
    get diagnostics n = row_count;
    assert n = 0, 'doğrudan güncelleme olmamalı';
  exception when insufficient_privilege then null;
  end;

  -- 2) Yönetici: hesap seçmeden avans onayı reddedilir; hesapla onaylanınca defter + kasa gideri
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgr, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    update public.employee_requests set status = 'onaylandi' where id = req;
    assert false, 'yönetici de doğrudan değiştirememeli';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.decide_approval(ar, 'onaylandi');
    assert false, 'hesapsız avans onayı reddedilmeli';
  exception when check_violation then null;
  end;
  perform public.decide_approval(ar, 'onaylandi', 'uygundur', jsonb_build_object('account_id', acc));
  perform set_config('role', 'none', true);
  select status into t from public.employee_requests where id = req;
  assert t = 'onaylandi', format('personel talebi onaylanmalı: %s', t);
  select coalesce(sum(amount), 0) into v from public.employee_ledger where employee_id = emp and kind = 'avans' and request_id = req;
  assert v = 3000, format('deftere 3000 avans yazılmalı: %s', v);
  select count(*) into n from public.finance_entries f join public.employee_ledger l on l.id = f.source_id
   where f.source = 'personel' and l.request_id = req and f.account_id = acc and f.status = 'odendi' and f.net_amount = 3000;
  assert n = 1, 'kasadan 3000 gider düşmeli';
  -- karar bir daha değişmez
  perform set_config('role', 'authenticated', true);
  begin
    perform public.decide_approval(ar, 'reddedildi', 'vazgeçtim');
    assert false, 'karar verilmiş talep değişmemeli';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'none', true);

  -- 3) Yönetici kendi talebini onaylayamaz; başka yönetici onaylar. Red için not zorunlu.
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgr, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  insert into public.employee_requests (employee_id, kind, start_date, end_date) values (emp_mgr, 'izin', current_date + 5, current_date + 6);
  select id into ar2 from public.approval_requests where subject_table = 'employee_requests' and policy_code = 'izin' and requested_by = u_mgr;
  begin
    perform public.decide_approval(ar2, 'onaylandi');
    assert false, 'yönetici kendi talebini onaylayamamalı';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgr2, 'role', 'authenticated')::text, true);
  begin
    perform public.decide_approval(ar2, 'reddedildi', '  ');
    assert false, 'red notsuz olmamalı';
  exception when check_violation then null;
  end;
  perform public.decide_approval(ar2, 'reddedildi', 'yoğun hafta');
  perform set_config('role', 'none', true);

  -- 4) Eşik: 20.000 ₺ altı gideri muhasebe onaylar, üstünü yalnız yönetici
  perform set_config('request.jwt.claims', json_build_object('sub', u_emp, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  ar := public.request_approval('gider', 'Fırın bakımı', 5000);
  ar2 := public.request_approval('gider', 'Yeni kazan', 50000);
  perform set_config('request.jwt.claims', json_build_object('sub', u_acc, 'role', 'authenticated')::text, true);
  perform public.decide_approval(ar, 'onaylandi');
  begin
    perform public.decide_approval(ar2, 'onaylandi');
    assert false, 'muhasebe eşik üstünü onaylayamamalı';
  exception when insufficient_privilege then null;
  end;
  -- muhasebe eşik üstü talebi göremez bile
  select count(*) into n from public.approval_requests where id = ar2;
  assert n = 0, 'muhasebe eşik üstü talebi görmemeli';
  perform set_config('request.jwt.claims', json_build_object('sub', u_mgr, 'role', 'authenticated')::text, true);
  perform public.decide_approval(ar2, 'onaylandi');
  -- talep içeriği değiştirilemez
  perform set_config('request.jwt.claims', json_build_object('sub', u_emp, 'role', 'authenticated')::text, true);
  ar := public.request_approval('gider', 'Boya', 1000);
  begin
    update public.approval_requests set amount = 1 where id = ar;
    assert false, 'tutar değişmemeli';
  exception when insufficient_privilege then null;
  end;
  perform public.decide_approval(ar, 'iptal');
  perform set_config('role', 'none', true);

  -- 5) Olay kaydı: her adım yazıldı, değiştirilemez, zincir sağlam
  select count(*) into n from public.approval_events e join public.approval_requests r on r.id = e.request_id where r.title in ('Fırın bakımı', 'Yeni kazan', 'Boya');
  assert n = 6, format('3 talep + 3 karar = 6 olay: %s', n);
  begin
    update public.approval_events set note = 'x' where id = (select max(id) from public.approval_events);
    assert false, 'olay kaydı değişmemeli';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.approval_events where id = (select max(id) from public.approval_events);
    assert false, 'olay kaydı silinmemeli';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', '{}', true);
  assert public.verify_approval_chain(), 'onay zinciri doğrulanmalı';
  select count(*) into n from public.audit_log where entity_type = 'approval_requests' and entity_id = ar2::text;
  assert n >= 2, 'onay talebi denetim kaydında olmalı';
  raise notice 'approvals OK';
end $$;
rollback;
