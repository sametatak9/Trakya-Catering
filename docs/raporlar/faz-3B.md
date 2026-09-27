# Faz 3B raporu — Sade navigasyon ve rol çalışma alanı

27 Eylül 2026

## Sizin yapmanız gereken
Bu fazda panel ayarı yok. Faz 3A raporundaki üç ayar hâlâ geçerli: sızdırılmış parola koruması, giriş adresi ve Render yönlendirmesi.

## Ne yapıldı
- **30 ekran → 14 modül + sekmeler.** Menü artık: Bugün · Üretim · Menüler · Reçeteler · Stok · Satınalma · Siparişler · Cari Hesaplar · Personel · Finans · Kasa & Banka · Ayarlar. Yapımı süren modüller hazır olunca menüye eklenecek: Teklifler & Sunum, Sosyal Medya, Lojistik, Şoför Ekranı.
- **Sekmeler:**
  - Üretim: Günlük üretim (öğün seçimli) · Mutfak ekranı;
  - Menüler: Menü kartları · Menü planı;
  - Stok: Stok durumu · Firmalara giden · Hammadde kartları;
  - Cari: Müşteriler · Tedarikçiler;
  - Personel: Kartlar & talepler · Puantaj & maaş · Bakiye & ödemeler;
  - Finans: Özet · Giderler · Gelen faturalar;
  - Ayarlar: Kullanıcılar & firma · Yetkiler (yalnız kurucu).
- **Eski adresler çalışmaya devam ediyor.** 18 eski adres yeni yerine yönlendirilir; tarayıcı geçmişinde iz kalmaz. Örnekler: `/kahvalti` → Üretim (kahvaltı seçili), `/giderler` → Finans › Giderler, `/kurucu` → Ayarlar › Yetkiler.
- **Yetki sekme düzeyinde.** Kurucu panelindeki matris artık her sekmeyi ayrı satır gösterir (ör. "Finans › Gelen faturalar"). Satınalma Finans'ta yalnız gelen faturaları, şoför Stok'ta yalnız firmalara gideni görür. Kişiye özel istisna rol ayarını ezer. Bir modülün bütün sekmeleri gizlenirse modül menüden kalkar.
- **Bugün = rolünüzün iş masası.** Kartlara dokununca ilgili ekran açılır:

  | Rol | Kartlar |
  |---|---|
  | Aşçıbaşı | yarının üretimi, reçetesi olmayan yemekler, malzemesi eksik yemekler, kritik stok, menü planı boş günler |
  | Diyetisyen | yarının üretimi, boş menü günleri, reçetesiz ve eksik yemekler |
  | Depo | kritik stok, bugünkü hareketler, firmalara giden, yarının üretimi |
  | Satınalma | açık satınalma siparişleri, kritik stok, fiyatı eskiyenler, onay bekleyen faturalar |
  | Muhasebe | 7 gün içinde vadesi gelenler, onay bekleyen faturalar, fiyatsız siparişler, bekleyen personel talepleri |
  | Pazarlama | yarın sayı vermeyen firmalar, fiyatsız siparişler, aktif müşteriler |
  | Şoför | bugünkü teslimler (firma, öğün, kişi), bugün firmalara giden |

  Tüm rollerde altta asistan uyarıları gösterilir. Bir kartın hedef ekranı o rolde gizliyse kart da gösterilmez.
- **Yönetici ve kurucu:** Bugün ekranı **Özet · Onaylar** sekmelerinden oluşur. Onaylar'da bekleyen personel talepleri (izin, avans, mesai) onaylanır veya reddedilir; karar veren kaydedilir. Faz 3C-0'da bu sekme genel onay merkezine dönüşecek.

## Uygulanan migration (canlı sürüm)
- `20260927001737_navigation_tabs`: Eski yetki anahtarları yeni modül/sekme anahtarlarına taşınır. Taşıma idempotenttir; tablolar boş olduğu için veri etkisi olmadı. Önce `begin … rollback` ile denendi.

## Test sonuçları
- **Birim testleri:** 122/122 geçti. Yeniler:
  - `modules.test.ts`: rollerin modül listesi, sekme görünürlüğü, kurucu ve kişiye özel ayar, 18 eski adresin yönlendirmesi, yol çözümü;
  - `workspaces.test.ts`: her rolün kart seti, kart hedeflerinin açılabilirliği, gizlenen hedefin kartı gizlemesi.
- **SQL:** `navigation_tabs.sql` (eski anahtar taşıma) geçti.
- **Tarayıcı:** Gerçek derleme 390 px'te denendi:
  - kurucu: 30 adres (yeni sekmeler + eski adres yönlendirmeleri) açıldı; hata ve yatay taşma yok;
  - 7 rol (yönetici, aşçıbaşı, depo, şoför, muhasebe, satınalma, pazarlama): yetkili ekranlar açıldı, yetkisiz ekranlar "görme yetkiniz yok" gösterdi.
- **Tip kontrolü ve derleme:** temiz.

## Advisor farkı
Yeni WARN yok (bu fazda veritabanı nesnesi eklenmedi).

## Bilinen eksikler
- Üretim emri ve kalibrasyon sekmeleri Faz 3C'de gelecek.
- Menüler'deki hammadde ihtiyacı ve kârlılık Faz 3F ve 7'de gelecek.
- Kasa'daki çek-senet ve krediler Faz 4'te gelecek.
- İK rolü Faz 6'da eklenecek.

## Sıradaki
**Faz 3C-0 — Onay merkezi:**
- onay kuralları;
- değiştirilemez karar kaydı;
- personel avans talebi → yönetici onayı → personel bakiyesi canlı;
- yönetici avans girişi → bakiye.
