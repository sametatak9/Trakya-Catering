-- Faz 3B: eski yetki anahtarları yeni modül/sekme anahtarına taşınır (begin … rollback)
begin;
do $$
declare n int;
begin
  insert into public.role_permissions (role, module, level) values ('depo', '/hammaddeler', 'yok'), ('muhasebe', '/giderler', 'yok');
  create temporary table nav_key_map (old text primary key, new text not null);
  insert into nav_key_map values ('/hammaddeler', '/stok#hammaddeler'), ('/giderler', '/finans#giderler');
  insert into public.role_permissions (role, module, level)
    select rp.role, m.new, rp.level from public.role_permissions rp join nav_key_map m on m.old = rp.module on conflict (role, module) do nothing;
  delete from public.role_permissions rp using nav_key_map m where rp.module = m.old;
  select count(*) into n from public.role_permissions where module in ('/stok#hammaddeler', '/finans#giderler') and level = 'yok';
  assert n = 2, format('iki anahtar taşınmalı: %s', n);
  select count(*) into n from public.role_permissions where module in ('/hammaddeler', '/giderler');
  assert n = 0, 'eski anahtar kalmamalı';
end $$;
rollback;
