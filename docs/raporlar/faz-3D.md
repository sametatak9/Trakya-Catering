# Faz 3D raporu — Menü tipi, sunum şekli, müşteri menüsü, aylık menü ve sipariş, portal v2, menü kartı

2 Ekim 2026

## Sizin yapmanız gereken (Supabase paneli)
1. **Vault › Secrets:** `portal_tc_pepper` adında rastgele, uzun bir değer ekleyin (ör. 48 karakter).
   - Portal yetkilisinin TC kimlik numarası bu anahtarla özetlenip saklanır; anahtar yoksa portal yetkilisi kaydı hata verir.
   - Anahtarı hiçbir yere yazmayın.
2. **Authentication › Sign In / Providers › Password:** "Leaked password protection" seçeneğini açın. Advisor'daki tek güvenlik uyarısı budur.
3. Portal PIN'leri yalnız yönetici belirler: Cari › müşteri › Sipariş linki › "PIN belirle".

## Ne yapıldı
| Konu | Durum | Nerede |
|---|---|---|
| Menü tipleri (`menu_types`) ve menü kartında tip seçimi | ✅ | Menüler › Menü kartları |
| Sunum şekli (tabla/küvet/sefer tası) ve kişi başı ambalaj maliyeti | ✅ | Menüler › Sunum şekilleri; kartta "gıda" ve "gıda + ambalaj" |
| Müşteri menü tanımları (öğün, tip, sunum, fiyat/KDV, geçerlilik, varsayılan) | ✅ | Cari › müşteri › Menü tanımları |
| Hassasiyet notları (14 alerjen) ve şikâyet (kategori, önem, çözüm, durum) | ✅ | Cari › müşteri › Hassasiyet & şikâyet |
| ⚠ rozeti (hassasiyet), son şikâyet, sipariş kaynağı | ✅ | Siparişler, Üretim emri kırılımı |
| Üretim kırılımı: firma × menü × sunum × kişi × kap | ✅ | Üretim emri |
| Aylık sipariş (`standing_orders`), "Üret", gün × firma ızgarası | ✅ | Siparişler › Aylık |
| Müşteri × öğün adet raporu (Excel) | ✅ | Siparişler › Rapor |
| **EK-1 / Not 14** — aylık menü takvimi, maket birebir: sürükle = taşı, Alt/Ctrl = kopyala; gün/hafta kopyala; geçen aydan başlat; 100 adım geri al; mobil ajanda | ✅ | Menüler › Aylık menü |
| **EK-1 / Not 1 · 3** — yasak/tercih kuralları, yemek etiketleri, 7 gün tekrar, ihlal paneli, sürümlü yayın | ✅ | Aylık menü + reçete editöründe etiketler |
| **EK-1 / Not 1** — menü önerisi | ✅ kural motoru · ⏳ AI 🔌 | Takvimde "Öneri" |
| **EK-1 / Not 7 · 8** — portal v2: sipariş (menü seçimi), aylık menü, geri bildirim (5 yıldız, şikâyet/öneri), PIN | ✅ | Sipariş linki / müşteri girişi |
| Yeni geri bildirim personele anında bildirim olarak düşer | ✅ | Bildirim merkezi (Realtime) |
| **Menü kartı HTML/PDF:** standart, kalori hesaplı, kahvaltı; A4 yazdır/PDF, Excel, WhatsApp | ✅ | Aylık menü › "Menü kartı" |
| Stok kartında enerji alanı (kcal/100 g-ml veya kcal/adet) | ✅ | Stok › Stok kartları |
| **Kullanıcı notu H** — Bugün ekranı "şimdiki öğün" kartları ve şirket geneli geçiş saatleri | ✅ | Bugün; Ayarlar › Firma bilgileri |

## Sıradaki fazlara bırakılanlar
- ⏳ "X şu an düzenliyor" uyarısı (presence): takvim kayıtları sürümlü olduğu için veri kaybı yok. Uyarı Faz 8'de Realtime presence ile eklenecek.
- ⏳ AI menü önerisi Edge Function `menu-suggest` 🔌: API anahtarı gerekir. Anahtar yokken kural motoru öneriyi yapar. `ai_budget` / `ai_usage` tabloları hazır.
- ⏳ Takvimin satınalma modu ve ihtiyaç paneli: Faz 3F.
- ⏳ Portal bakiye sekmesi: Faz 4. Portalda "yakında" olarak görünür.
- ⏳ Basılı iş emrinde kap/ambalaj adedi: kırılım ekranda var, A4 çıktıya Faz 3F'de eklenecek.
- ⏳ Kalori verisi: stok kartlarına kcal girildikçe kart dolar. Eksik kalemler kartta "—" ve dipnotla gösterilir. Toplu kalori verisi Faz 3H'de.

## Varsayımlar
- Şikâyet için ayrı tablo açılmadı. `customer_feedback` (kind = `sikayet`) genişletildi; başka ajanın tablosuyla çift kayıt oluşmasın diye.
- Portal fonksiyonları `private` şemasında (security definer). Dışarıya yalnız public invoker sarmalayıcılar açık; yeni advisor uyarısı çıkmadı.
- Başka ajanın eklediği `container_types.service_style` (tepsi/küvet) alanı korunuyor; siparişte kaynak `service_styles`.
- Kalori, 1 kişilik net gramaj × stok kartındaki enerji değeri ile hesaplanır. Pişirme kaybı ve yağ emilimi dahil değildir; kartın dipnotunda yazar.
- Öğün geçiş saatleri varsayılanı: kahvaltı 07:00, öğle → akşam 11:00, akşam → yarın öğle 23:59 (İstanbul saati).

## Doğrulama
- Migration: `20260927051430_menu_types_service_customer_menus`. Canlı içerik ile repo dosyası birebir (md5 eşit).
- SQL: `customer_menus.sql`, `order_link.sql`, `external_tables.sql`, `production_orders.sql` canlıda `begin…rollback` ile geçti.
- Vitest: 152 test geçti (takvim kuralları, undo, ay ızgarası, uyarılar, öğün odağı). tsc ve build temiz.
- Playwright (390 px): aylık menü, menü kartı butonu, stok kartı kalori alanı, müşteri sekmeleri, aylık sipariş, portal. Hiçbirinde yatay taşma yok.
- Advisor: 0028 = 4, 0029 = 10 (önceden bilinen) ve leaked password uyarısı. Yeni WARN yok.

## Açık sorular (işi durdurmuyor)
- Menü kartında logonun yanında firma logosu da olsun mu? Şimdilik yalnız Trakya Catering anteti.
- Kahvaltı menüsü haftalık mı aylık mı gönderiliyor? Şimdilik seçili ay.
