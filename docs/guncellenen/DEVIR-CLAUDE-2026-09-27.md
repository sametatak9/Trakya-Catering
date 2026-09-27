# Claude Devir Notu — Faz 3C Üretim Emri

**Tarih:** 27 Eylül 2026
**Durum:** Uygulama kodu tamamlandı ve yerel kontroller temiz. `main` ve Render'ın izlediği dal aynı commit'e alınacak/alındı; canlı dağıtım sonucu aşağıda güncellenecek.
**Kapsam:** Üretim emri akışı, kalibrasyon ekranı, A4 iş emri çıktısı ve doğrulanmış Supabase RPC bağlantıları.

> Bu teslim, Faz 3C'nin tüm kabul maddelerinin tamamlandığı anlamına gelmez. Canlı Supabase şemasının bir bölümü repodaki migration geçmişinde bulunmuyor; veritabanına bu oturumda yazma yapılmadı. Claude'un önce migration boşluğunu ve gerçek iş akışını kontrol etmesi gerekiyor.

## 1. Önceki durum ve repo farkı

- Başlangıç dalı: `claude/catering-erp-transformation-lxyhbx` (`6092d0f`). `origin/main` bunun üç commit gerisindeydi; `main`'in ek commit'i yoktu.
- Önceden eklenmiş Grok/Claude çalışma içeriği `docs/claude/` altında tasarım maketleri, logo seçenekleri ve `CLAUDE-EK-NOTLAR-1.md` idi. Bunlar korunmuştur.
- Çalışma dalı: `grok/gece-calismasi`.
- `docs/claude/CLAUDE-ANA-PROMPT.md` Faz 3C ve kullanıcı notları okundu; teslim bu belgelerin yerine geçmez.

## 2. Bu turda yapılanlar

### Faz A — repo, canlı şema ve yetki akışı incelemesi

- Canlı ana URL `https://trakya-catering.onrender.com/` HTTP 200 döndürüyor.
- Render statik sitesi (`trakya-catering`, service ID `srv-darvuv0jo6nc739lrns0`) otomatik deploy açık ve şu an `claude/catering-erp-transformation-lxyhbx` dalını izliyor; bu nedenle canlı yayın için o dala da aynı commit gönderilmesi gerekir.
- Supabase projesinde mevcut `production_orders`, `recipe_calibrations`, `work_orders` tabloları ve `po_build`, `po_check`, `po_approve`, `po_close`, `po_cancel`, `po_snapshot`, `recalibrate_recipe`, `apply_calibration` fonksiyonları salt-okunur metadata ile doğrulandı.
- Üretim RPC'lerinin gerçek imzaları, anomalilerin JSONB alanları ve rol sınırları canlı katalogdan doğrulandı. `po_approve` ve `po_close` yalnız yönetici/aşçıbaşı içindir. Sipariş teslimi `po_close` içinde varsayılan olarak açık olsa da UI bunu **varsayılan kapalı** ve açık onay kutusu yaptı.
- Canlı migration listesinde `20260927004314_production_orders` ve 3C-0 sonrasındaki ek migration'lar mevcut; repodaki `supabase/migrations/` içinde bunlar yok. Bu, canlı DB ile repo arasında önemli bir yeniden-kurulum/CI boşluğudur.
- İş verisi okunmadı, hiçbir migration uygulanmadı, tablo/izin/veri değiştirilmedi, deneme kaydı yazılıp silinmedi.

### Faz B — üretim emri ekranı

- `Üretim > Üretim emri` sekmesi; gün/öğün seçimi, firma × etkin menü kişi dağılımı, siparişten emir oluşturma/yenileme, hazırlık yemek-malzemelerini gösterme, durum çizgisi, kontrol anomalileri, yönetici/aşçıbaşı onayı ve kapanış.
- Gerçek menü seçimi mevcut `effectiveMenu` zincirinden (sipariş → firma planı → genel plan) çözülüyor.
- Mevcut üretim taslağını yeniden oluşturma, gerekçeli anomalili onay, iptal ve kapanış için etkiyi anlatan onaylar var. Force-onayda saklanacak not, iptalde gerekçe kullanıcıya tekrar gösterilir.
- Kapanışta sipariş teslimi/otomatik gelir oluşumu ayrıca bir checkbox ile açılıyor; ilk değer `false`. Kapanış stok çıkışı ve reçete kalibrasyonunu işler, üretim maliyeti de ayrı gider olarak yazılmaz.
- Mevcut `v_prep_batch_costs` ve `v_prep_items` okumaları kullanılır; bu sayfada üretim/sipariş için uydurma veri üretilmez.

### Faz C — gramaj kalibrasyonu

- `Üretim > Gramaj kalibrasyonu` reçete seçimi, malzeme bazında mevcut net miktar / üretim ölçümlerinden gelen porsiyon-ağırlıklı medyan karşılaştırması, son ölçüm trendi ve dahil/hariç geçmişi sunar.
- Malzeme satırları kendi stok/base birimleri içinde karşılaştırılır; farklı malzemelerin birimleri tek bir medyanda karıştırılmaz.
- Ölçüm dışlama, canlı fonksiyonun elle girilen kayıtları koruduğu `reason='elle'` işaretini kullanır. “Öneriyi reçeteye uygula” önce `recalibrate_recipe`, ardından açık onaydan sonra `apply_calibration` çağırır. Kilitli reçete satırlarını DB fonksiyonu güncellemez.

### Faz D — A4 iş emri

- Onay RPC'sinin oluşturduğu değişmez `work_orders.snapshot` basılır; antet, logo, tarih/öğün, porsiyon, firma dağılımı, yemek adımları, malzeme/çekme listesi ve revizyon bilgisi vardır.
- A4, 12 mm kenar boşluğu ve yazdırmada yalnız rapor içeriğini gösterecek print düzeni eklendi. Yazdırma sayacı/son yazdırma bilgisi mevcut izinli `work_orders` update'i ile kaydedilir.

## 3. Kod ve test sonucu

Yeni/ana dosyalar:

- `src/features/production/ProductionOrderPage.tsx`
- `src/features/production/CalibrationPage.tsx`
- `src/features/production/ordersApi.ts`
- `src/lib/calibration.ts` ve `src/lib/calibration.test.ts`
- `src/lib/database.types.ts` (canlı şemadan üretilmiş; yerel insert akışını korumak için iki `p_id` parametresi `string | null` bırakıldı)
- `src/app/App.tsx`, `src/app/modules.ts`, `src/app/modules.test.ts`

Doğrulama:

- `npm run lint` — geçti.
- `npm test` — 15 dosya, **128/128 test** geçti (kalibrasyon için 6 yeni saf test dahil).
- `npm run build` — geçti.
- `git diff --check` — geçti.
- Build, mevcut büyük JavaScript chunk (>500 kB) uyarısını gösteriyor; build hatası değildir ve bu çalışmada kod bölme optimizasyonu yapılmadı.
- Canlı DB'de RPC mutation testi bilerek yapılmadı; iş verisi/üretim emri oluşturmadan bu akış güvenli biçimde doğrulanamaz. Gerçek rol hesaplarıyla veya izole DB testinde uçtan uca doğrulayın.

## 4. Claude'un ilk yapması gerekenler

1. Bu dalın son commit'ini incele; özellikle production action koşullarını/role ayrımını ve A4 yazdırma CSS'ini gözden geçir. `main` üzerindeki değişiklikleri ezme/revert etme.
2. Repo migration'larını canlı Supabase migration listesiyle eşleştir. `production_orders` ve sonraki canlı migration SQL kaynaklarını kontrollü biçimde repoya geri kazandır; var olan canlı migration'ı yeniden uygulama. Bu oturum DB'ye yazmadı.
3. Canlı `po_check`, `po_approve`, `po_close`, `recalibrate_recipe` kodu ile istemciyi satır satır doğrula; izole/rollback testlerinde rol, stok tekilleştirme, teslim varsayılanı, eşik/uyarı ve idempotency koşullarını test et. Gerçek müşteri/üretim verisini test verisi olarak kullanma.
4. Proje yönergesine göre SQL senaryo testi `supabase/tests/production_orders.sql` ve UI entegrasyon testlerini tamamla; devam eden akışta çıkan hataları düzelt.
5. Canlı iş emri snapshot'ında kullanıcı isteğinin tüm ayrıntıları var mı doğrula: firma × menü × sunum/kap sayıları, ambalaj sarfı, birim dönüşümü, istasyon/sayfa bölünmesi ve revizyon arşivi. Mevcut `po_snapshot` fonksiyonu bunların hepsini göstermiyor olabilir; eksikse gerekli migration + güvenli RPC güncellemesi ve test ekle.
6. Kabul tam değilse BACKLOG/PLAN durumunu açık tut; Faz 3D'ye ancak Faz 3C onay/DB testleri geçtikten sonra ilerle.

## 5. Dış tasarım araçları

- Mobbin referansı için arama denendi ancak bu oturumda kullanılabilirlik ücretli erişim/plan kısıtına takıldı; ek tasarım ekranı alınamadı.
- Mevcut Canva MCP kullanılabilir bir uygulama-içi kaynak akışına uygun olmadığından Canva'dan dışa alınmış içerik kopyalanmadı. Arayüz projedeki Trakya kiremit/ayçiçeği/krem tokenları ve mevcut logo/rapor sistemine göre tasarlandı.

## Claude Code için hazır mesaj

```text
Trakya-Catering için bu devir dosyasını oku: docs/guncellenen/DEVIR-CLAUDE-2026-09-27.md.
Önce son main commit'ini ve canlı Supabase migration boşluğunu incele. Bu turda UI kodu, gerçek RPC imzalarına bağlandı ve tip/test/build kontrolleri geçti; Supabase'e hiç yazılmadı. Çalışmayı geri alma. Önce eksik production_orders/sonraki migration SQL kaynaklarını güvenli şekilde repoya kazandır ve live schema ile eşleştir; mevcut migration'ı yeniden çalıştırma. Ardından izole/rollback SQL ve gerçek rol uçtan uca testlerini yaz/çalıştır; iş emri snapshot kapsamı, stokun iki kez düşmemesi, varsayılan sipariş-teslim davranışı, reçete kalibrasyonu ve A4 çıktısını kontrol et. Bulduğun hataları düzelt, Faz 3C kabul maddelerini tamamlamadan Faz 3D'ye geçme. Her yeni işi docs/guncellenen/ altına tarihli raporla.
```

## Yayın durumu

- Uygulama commit'i `5569e2302fbda61dbf4cbd5cbe9b93d163313516` aynı anda `main`, `claude/catering-erp-transformation-lxyhbx` ve `grok/gece-calismasi` dallarına push edildi; push anında üç uzak ref de bu SHA idi. GitHub CI, bu commit için `main` ve Claude dalında başarılı oldu.
- Render `main`'i değil, `claude/catering-erp-transformation-lxyhbx` dalını otomatik yayınlıyor (`autoDeploy=yes`); dal, uygulama commit'iyle eşitlendi. Son kontrol anında Render'ın yeni deployment kaydı/public HTML asset'i henüz görünmedi. Bu yüzden push/CI tamam, fakat **yeni sürümün canlıda açıldığı doğrulanmış değil**. Claude `Render` deployment listesi ve public URL'deki Vite asset hash'ini kontrol etmeli; deployment başarısızsa log nedenini incelemeli.
