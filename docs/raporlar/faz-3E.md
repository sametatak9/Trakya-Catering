# Faz 3E raporu (1. bölüm: veritabanı) — Stok partileri, fatura eşleştirme, 564 stok + 331 yemek iskeleti

2 Ekim 2026

## Sizin yapmanız gereken
Yeni panel ayarı yok. Faz 3D raporundaki iki ayar (Vault `portal_tc_pepper`, sızdırılmış parola koruması) hâlâ bekliyor.

## Ne yapıldı (canlıda)
- **Tedarikçi etiketli stok partileri:** her stok girişi tedarikçi, fatura, sipariş, SKT ve lot no ile bir parti açar.
- **Çıkış sırası:** son kullanma tarihi en yakın parti önce (FEFO), SKT yoksa en eski parti önce (FIFO).
- **Stok yetmezse:** çıkış yine yazılır, "partisiz çıkış" olarak işaretlenir ve uyarı verilir.
- **Tek giriş kapısı:**
  - Sipariş teslimi ile fatura aynı malı **iki kez stoğa sokmaz**; sonradan gelen, var olan partiyi tamamlar.
  - Fatura sonra gelirse partinin fiyatı faturaya göre düzeltilir ve ortalama maliyet yeniden hesaplanır.
  - Eskiden bu durumda hata veriyordu.
- **Muhasebe kuralı korunuyor:** gider yalnız fatura onayından yazılır. Parti, sevk ve üretim çıkışı gider yazmaz (test ✅).
- **Mevcut ekranlar değişmeden partili çalışır:** fatura, sipariş teslimi, üretim, hazırlık, sevk, elle giriş. Partiler veritabanında otomatik açılır.
  - Yeni ekranlar için `receive_stock` / `consume_stock` hazır.
- **Görünümler:**
  - kalem × tedarikçi × kalan (`v_stock_by_supplier`);
  - lot geri izleme: parti → üretim/sevk → müşteri (`v_lot_trace`).
- **Fatura satırı eşleştirme:**
  - "DANA KUŞBAŞI 1.SINIF KG" → "Dana Kuşbaşı".
  - En fazla 5 aday sunulur. Öncelik sırası: satıcı kodu → tedarikçi takma adı → birebir ad → genel takma ad → benzerlik.
  - Onaylanan tedarikçi adı ikinci faturada otomatik eşleşir.
  - Kopya kartlar birleştirilebilir (yalnız yönetici).
- **Satınalma altyapısı (tablolar):**
  - fiyat geçmişinde tedarikçi ve fatura bağı;
  - %3 üstü fiyat sapması listesi ve kabul/red kaydı;
  - tedarikçiye göre verim (brüt → net) testi;
  - sipariş satırları tablosu (eski liste alanıyla senkron);
  - tedarikçiye talep gönderim kaydı.
- **Ana stok iskeleti yüklendi:**
  - 563 yeni stok kartı, 1.724 tedarikçi/fatura adı, 209 koli/kasa/teneke birimi;
  - 330 yemek, öğün bilgisiyle.
  - "Dana Kuşbaşı" ve "Orman Kebabı" zaten vardı; korundu, kopyası açılmadı.
- **KDV teyidi gereken 9 kalem** %1 ile açıldı, kartlarında "KDV teyit edilmeli" yazıyor: Vanilya, Limon Tuzu, Karbonat, Meyveli Soda, Soğuk Çay, Şalgam Suyu, Limonata, Jelatin, Gıda Boyası.

## Varsayımlar
- Veri paketi `/workspace/stok-datasi` yerine repodaki `docs/claude/ana-stok-listesi.csv` ve `yemek-listesi.csv` kullanıldı.
- Teklif fiyatları ayrı tabloda (`supplier_quotes`) kalıyor; fiyat geçmişine "teklif" kaynağı eklenmedi, çünkü mevcut kısıtı değiştirmek gerekirdi.
- Birleştirmede aynı satır hedef kartta zaten varsa (ör. aynı reçetede iki kart), satır silinmez, eski kartta kalır ve sonuçta listelenir.
- Yönetici bir stok hareketini sonradan silerse partiler otomatik geri hesaplanmaz. Düzeltme ters kayıtla yapılır (mevcut kural).

## Doğrulama
- SQL: `stock_lots.sql` (tek giriş/tek gider, FEFO, sevk gider yazmaz, partisiz uyarı, birim çevrimi, doğrudan yazım yasağı), `ingredient_aliases.sql` (eşleştirme, otomatik ikinci fatura, birleştirme yetkisi) ve `security_fixes.sql` stok bölümleri canlıda `begin…rollback` ile geçti.
- Vitest 154 ✅ (`normTr` veritabanıyla aynı sonuç), tsc ✅.
- Advisor: 0028 = 4, 0029 = 10 (önceden bilinen) ve leaked password uyarısı; yeni uyarı yok. Tetikleyici fonksiyonları `private` şemasına taşındı.

## Sırada (Faz 3E, 2. bölüm: ekranlar)
- Fatura içe aktarma sihirbazı: satır başına yeşil/sarı/kırmızı aday; "yeni kart" açmadan önce benzer 5 kalem gösterilir.
- Stok kartında "Tedarikçi adları" ve "Fiyat geçmişi" sekmeleri.
- Satınalma: Geçen ay / Bu ay ihtiyaç / Talepler & siparişler (PDF, WhatsApp, e-posta ile talep gönderimi).
- Düzensiz fiyat listesi, lot geri izleme raporu, verim testi formu.
