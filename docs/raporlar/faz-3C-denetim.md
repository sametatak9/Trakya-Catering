# Denetim raporu — başka ajanların çalışması (27 Eylül 2026)

## Sizin yapmanız gereken (portal yetkilisi özelliğini kullanmadan önce)
1. **Supabase Dashboard → Project Settings → Vault → New secret.**
   - Ad: `portal_tc_pepper`
   - Değer: en az 32 karakterlik rastgele bir metin (bir parola yöneticisiyle üretin).
   - Bu değeri hiçbir yere yazmayın ve repoya koymayın.
   - Bu anahtar olmadan "müşteri portalı yetkilisi (TC + telefon)" kaydı açıkça hata verir: *Portal gizli anahtarı yapılandırılmamış*.
2. Diğer panel ayarları Faz 3A raporundaki gibidir. Özellikle "leaked password protection" hâlâ kapalı.

## Ne bulundu

### 1) Grok — `grok/gece-calismasi`
Push'u sorunsuz; CI yeşil, Render'da yayında. Yalnız istemci kodu yazmış (üretim emri ve kalibrasyon ekranları). İki hatası `faz-3C.md`'de düzeltildi.

### 2) İkinci ajan — yalnız canlı veritabanı
Canlıya 6 migration uygulanmış (01:08–01:43 UTC). Repoda dosyası, testi ve ekranı yoktu.

| Migration | İçerik | Durum |
|---|---|---|
| `monthly_menus` | aylık menü (sürümlü), müşteri yasak/tercih kuralları, yemek etiketleri, müşteri geri bildirimi, AI harcama freni | ✅ Repoda, test edildi. Ekran Faz 3D'de. |
| `stock_manual_reason` | elle stok hareketinde neden; faturasız pazar alımı → tedarikçiye borç | ✅ Repoda, test edildi |
| `menu_assign_containers` | müşteriye menü atama, kap tipi ve kap maliyeti (plastikte zorunlu, maliyet değişikliği loglanır) | ✅ Repoda, test edildi. Ekran Faz 3D'de. |
| `market_reference_prices` | toptan referans fiyatı (bot yazar, kaynak URL zorunlu) | ✅ Repoda. Bot Faz 3F'de. |
| `home_meal_switch` | Bugün ekranı öğün geçiş saatleri, kapta tepsi/küvet | ✅ Repoda. Ekran Faz 3D'de. |
| `portal_contacts` | müşteri portalı yetkilisi (TC HMAC + telefon, 5 hatada kilit, bağlantı onay merkezinden) | ⚠️ Güvenlik düzeltildi (aşağıda). Vault anahtarı sizde. |

### 3) Bulunan sorunlar ve düzeltmeler
- **Repo canlıyı kuramıyordu (M-1):** 8 migration dosyası eksikti. Canlıdaki içerik birebir alındı (md5 eşit). Şimdi 24 canlı sürüm = 24 dosya.
- **Yeni güvenlik uyarısı (advisor 0029):** `portal_contact_save` SECURITY DEFINER olup API'den çağrılabiliyordu.
  - Düzeltme `20260927045357_portal_contact_save_private`: mantık API'ye kapalı `private` şemasına taşındı. `public` adıyla aynı imzada invoker sarmalayıcı kaldı.
  - Yetki kontrolü değişmedi: yalnız yönetici.
  - Uyarı sayısı 11 → 10'a döndü; kalanların hepsi önceden bilinen, bilinçli uyarılar.
- **Vault anahtarı yok:** Portal yetkilisi kaydı çalışmıyordu. Kod doğru davranıyor (açık hata veriyor). Anahtarı sizin eklemeniz gerekiyor (yukarıda).
- **Tek gider kuralı ile ilişki:** Faturasız pazar alımında tedarikçiye "bekliyor" durumunda gider yazılıyor. Fatura olmadığı için belge stok hareketinin kendisidir. Kural "gider yalnız faturadan" olduğundan bu, bilinçli bir istisna olarak kabul edildi. Aynı hareket iki kez borç yazamaz.

## Testler
Yeni test dosyası `supabase/tests/external_tables.sql`, canlıda `begin … rollback` içinde çalıştırıldı ✅. Doğrulananlar:
- **Portal:**
  - yalnız yönetici kayıt açabilir;
  - geçersiz TC reddedilir;
  - anahtar yoksa açık hata verilir;
  - TC özeti istemciye görünmez;
  - eşleştirme yalnız sunucuda yapılır;
  - doğru ve yanlış TC ayrılır.
- **Aylık menü:**
  - müşteri kuralı (baklagil yasağı) yayını durdurur, gerekçe yazılınca yayınlanır;
  - menü planına yazılır;
  - yayındaki sürüm kilitlidir;
  - depo yayınlayamaz;
  - müşteri yalnız kendi menüsünü ve kurallarını görür;
  - geri bildirim yalnız kendi firması adına yazılabilir.
- **Elle stok:**
  - "diğer" açıklamasız kaydedilemez;
  - pazar alımı tedarikçisiz kaydedilemez;
  - borç 30 × 15 = 450 ₺ olarak yazılır.
- **Kap tipi:**
  - plastik kapta maliyet zorunludur;
  - aşçıbaşı maliyetli kap açamaz;
  - maliyet değişikliği loglanır.
