# Faz 3C raporu — Üretim emri, gramaj kalibrasyonu, 1 kişilik reçete, basılı iş emri

27 Eylül 2026

## Sizin yapmanız gereken
Yeni panel ayarı yok. Faz 3A raporundaki ayarlar hâlâ geçerli.

## Diğer yapay zekâ çalışmalarının denetimi
Bu fazın bir kısmı başka ajanlar tarafından yapıldı. Hepsi incelendi.

### Grok (`grok/gece-calismasi`, commit `5569e23` + `e2efe2f`)
- **Push:** `main`, Claude dalı ve Grok dalı aynı commit'te. GitHub CI ✅, Render'da yayında.
- **Yaptığı:**
  - `Üretim › Üretim emri` ve `Gramaj kalibrasyonu` sekmeleri, A4 iş emri çıktısı;
  - `ordersApi.ts`, canlıdan üretilmiş tipler;
  - devir notu: `docs/guncellenen/DEVIR-CLAUDE-2026-09-27.md`.
- Veritabanına yazmadı.
- **Düzeltilen hatalar:**
  1. Kapanışta "sipariş teslim → gelir" **varsayılan kapalıydı**. Kural "onay → stok düşer, sipariş teslim olur, gelir oluşur" olduğu için artık **varsayılan açık**. Kutu yalnız teslim ayrı yapılacaksa kaldırılır.
  2. Gramaj önizlemesinin medyanı, eşitlikte iki değerin ortalamasını alıyordu; veritabanı ise ilk değeri alıyor. Ekran ile gerçek hesap farklı sonuç verebiliyordu. İstemci artık veritabanıyla aynı kuralı kullanıyor (test eklendi).

### İkinci ajan (canlı veritabanında, repoda iz yok)
- 01:08–01:43 UTC arasında canlıya 6 migration uygulanmış: `monthly_menus`, `stock_manual_reason`, `menu_assign_containers`, `market_reference_prices`, `home_meal_switch`, `portal_contacts`. Repoda dosyası, testi ve ekranı yoktu.
- **Bu fazda:** 6 migration canlıdaki içerikle **birebir** (md5 eşit) repoya alındı. 23 canlı migration = 23 dosya; hiçbiri yeniden uygulanmadı.
- Güvenlik uyarısı (`portal_contact_save`), eksik Vault anahtarı ve testler bir sonraki commit'te ele alınıyor (rapor: `raporlar/faz-3C-denetim.md`).

## Ne yapıldı (Faz 3C)
- **Üretim emri akışı:** taslak → kontrol → onay → kapanış.
  - **Taslak:** Siparişlerden ve menü planından yemekler gelir; 1 kişilik reçete kişi sayısıyla çarpılıp brüte (fire dahil) çevrilir.
  - **Kontrol:** Şu uyarıları verir: reçetesiz, malzemesiz, fiyatsız, kişi sayısı yok, stok yetersiz, alışılmış gramajdan %25 sapma, 16:00 kesiminden sonra değişen sipariş.
  - **Onay:** Yalnız yönetici veya aşçıbaşı onaylar. Uyarı varsa gerekçe zorunludur. Onay, değişmez iş emri (revizyonlu) oluşturur.
  - **Kapanış:** Stoktan bir kez düşer, sipariş teslim olur ve gelir yazılır. **Gider yazılmaz; gider yalnız faturadan.** Kalibrasyon ölçümleri de kaydedilir.
  - Durum değişikliği yalnız bu adımlarla olur; tabloda elle değiştirilemez.
- **Gramaj kalibrasyonu:**
  - Son 10 üretimin porsiyon ağırlıklı medyanı alınır; ±%30 dışı ölçümler aykırı sayılır.
  - Reçete varsayılan olarak değişmez ("manuel" mod): öneri gösterilir, "uygula" ile reçeteye yazılır. Kilitli satır hiç değişmez.
  - Örnek: 1200 kişi / 100 kg et, fire %10 → 1 kişilik 75 g net.
- **Reçete:** doğrama biçimi, saklama bilgisi (kap, sıcaklık, raf ömrü), istasyonlu adımlar (süre, derece, kritik kontrol noktası).
- **A4 iş emri:** antet, firma × kişi dağılımı, yemek adımları, doğrama, çekme listesi, revizyon ve basım sayacı.

## Testler
| Kontrol | Sonuç |
|---|---|
| `tsc --noEmit` | ✅ |
| vitest | ✅ 130/130 |
| build | ✅ |
| `supabase/tests/production_orders.sql` (canlıda `begin … rollback`) | ✅ |
| `supabase/tests/approvals.sql` (yeni portal tetikleyicisiyle yeniden) | ✅ |
| `supabase/tests/prep_batch_flow.sql` (öneri 108 g, uygulanınca 108 g, maliyet 72,05) | ✅ |
| Playwright 390 px — kurucu, aşçıbaşı, depo × `/uretim`, `/uretim/emir`, `/uretim/kalibrasyon` | ✅ Hata yok, yatay taşma yok. Depo rolü yeni sekmeleri görmüyor. |

## Kabul maddeleri
- ✅ Sipariş → üretim emri → onay → stok, sipariş ve gelir birlikte değişir; gider yazılmaz.
- ✅ İki kez kapanmaz, stok iki kez düşmez.
- ✅ 1 kişilik reçete × kişi sayısı = brüt ihtiyaç.
- ✅ Kalibrasyon: aykırı ölçüm hariç tutulur, öneri/otomatik/kilitli modlar çalışır.
- ✅ İş emri değişmez; değişiklik yeni revizyondur.
- ⏳ İş emrinde kap/ambalaj sayısı ve istasyona göre sayfa bölme. Kap tipi tablosu (`container_types`) canlıda var; Faz 3D'de menü kap ataması ile eklenecek.

## Varsayımlar
- Depo rolü üretim emrini görmez; stok çıkışını kapanış yapar.
- Diyetisyen kontrol edebilir ama onaylayamaz ve kapatamaz.
