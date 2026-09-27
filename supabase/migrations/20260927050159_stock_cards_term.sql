-- EK-1 / Not 2: "Hammadde" yerine "Stok kartı". Tablo adı (ingredients) değişmez. Yalnızca eklemeli:
-- 1) Stok kartı kategorileri genişler (temizlik/deterjan, ambalaj/tek kullanımlık, gaz/yakıt, mutfak sarfı; Not 16 müşteri sarfı için).
-- 2) Sekme yetki anahtarı /stok#hammaddeler → /stok#kartlar (hedef varsa korunur, eski satır kaldırılır).
alter table public.ingredients drop constraint if exists ingredients_category_check;
alter table public.ingredients add constraint ingredients_category_check check (category = any (array[
  'et_tavuk', 'balik', 'sebze_meyve', 'bakliyat_tahil', 'sut_urunleri', 'yag', 'baharat_sos', 'kuru_gida', 'icecek', 'ekmek_unlu',
  'temizlik_sarf', 'temizlik_deterjan', 'ambalaj', 'gaz_yakit', 'mutfak_sarf', 'diger']));
comment on table public.ingredients is 'Stok kartları (gıda ve sarf). Ekranda "Stok kartı" adıyla görünür.';

insert into public.role_permissions (role, module, level)
  select role, '/stok#kartlar', level from public.role_permissions where module = '/stok#hammaddeler'
  on conflict (role, module) do nothing;
delete from public.role_permissions where module = '/stok#hammaddeler';
insert into public.member_permissions (user_id, module, level)
  select user_id, '/stok#kartlar', level from public.member_permissions where module = '/stok#hammaddeler'
  on conflict (user_id, module) do nothing;
delete from public.member_permissions where module = '/stok#hammaddeler';
