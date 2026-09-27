-- Faz 3B: navigasyon 30 → 14 modül. Yetki anahtarları artık modül yolu ('/finans') veya sekme ('/finans#giderler').
-- Eski anahtarlar yeni anahtara taşınır (idempotent; hedef varsa korunur, eski satır kaldırılır).
comment on column public.role_permissions.module is 'Modül yolu (/finans) veya sekme anahtarı (/finans#giderler). Yalnız menü görünürlüğü; yazma yetkisi RLS ile.';
comment on column public.member_permissions.module is 'Modül yolu (/finans) veya sekme anahtarı (/finans#giderler). Kişiye özel görünürlük istisnası.';

create temporary table nav_key_map (old text primary key, new text not null) on commit drop;
insert into nav_key_map values
  ('/kahvalti', '/uretim#gunluk'), ('/mutfak-ekrani', '/uretim#mutfak'),
  ('/menu-plani', '/menuler#plan'),
  ('/sevk', '/stok#sevk'), ('/hammaddeler', '/stok#hammaddeler'),
  ('/musteriler', '/cari#musteriler'), ('/tedarikciler', '/cari#tedarikciler'),
  ('/puantaj', '/personel#puantaj'), ('/personel-bakiye', '/personel#bakiye'),
  ('/giderler', '/finans#giderler'), ('/gelen-faturalar', '/finans#faturalar'),
  ('/ekip', '/ayarlar#ekip'), ('/rota', '/lojistik'), ('/filo', '/lojistik'), ('/pazarlama', '/teklifler');

insert into public.role_permissions (role, module, level)
  select rp.role, m.new, rp.level from public.role_permissions rp join nav_key_map m on m.old = rp.module
  on conflict (role, module) do nothing;
delete from public.role_permissions rp using nav_key_map m where rp.module = m.old;

insert into public.member_permissions (user_id, module, level)
  select mp.user_id, m.new, mp.level from public.member_permissions mp join nav_key_map m on m.old = mp.module
  on conflict (user_id, module) do nothing;
delete from public.member_permissions mp using nav_key_map m where mp.module = m.old;
