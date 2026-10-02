# Faz 3E raporu — Stok partileri, fatura eşleştirme, 564 stok + 331 yemek iskeleti

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

## Ekranlar (2. bölüm)
- **Gelen faturalar › fatura detayı:**
  - Her satır için veritabanından en fazla 5 aday gelir. Renk durumu gösterir:
    - **yeşil:** otomatik eşleşti (satıcı kodu, bu tedarikçinin adı, aynı ad veya bilinen ad);
    - **sarı:** benzerlik var, kontrol edin;
    - **kırmızı:** eşleşme yok.
  - Kırmızı satırda **"Yeni kart"** açılmadan önce benzer 5 kart gösterilir. Aynı adla ikinci kart açılamaz.
  - "Fiyat ve stoğa işle":
    - onaylanan adları tedarikçi adı olarak öğrenir;
    - fiyatı tedarikçi + fatura + satır no ile kaydeder;
    - stoğu `receive_stock` ile partiye sokar.
  - Sipariş teslimiyle zaten girmiş mal ikinci kez girmez; partisi faturaya bağlanır.
- **Stok kartı:** dört sekme eklendi:
  - **Tedarikçi adları:** ekle/kaldır, ürün kodu; koli/kasa birimleri de burada görünür.
  - **Fiyat geçmişi:** tarih · fiyat · tedarikçi · belge, %3 üstü değişim işaretli.
  - **Teklifler:** en uygun fiyat kupayla işaretli.
  - **Verim:** brüt → net test, tedarikçiye göre ortalama verim ve net maliyet.
- **Stok › Partiler & izleme (yeni sekme):** tedarikçi bazında kalan, SKT yaklaşan, lot geri izleme (parti → firma), partisiz çıkışlar. Elle girişte SKT ve lot no alanları var.
- **Satınalma:** sekmeler Bu ay ihtiyaç / Geçen ay / Talepler & siparişler / Fiyat sapması.
  - **Geçen ay:** günlük kişi tablosu, aylık toplam, tüketilen hammadde, rapor/Excel.
  - **Siparişe talep gönderme:** WhatsApp, e-posta veya PDF; her gönderim kayıt altına alınır ve son gönderim görünür.
  - **Fiyat sapması:** kabul/red; red için gerekçe zorunlu, kimin karar verdiği kayıtlı.
  - **"En uygun fiyat" sekmesi kaldırıldı:** en uygun tedarikçi ihtiyaç satırında (kupa) ve stok kartının "Teklifler" sekmesinde. Teklif girişi "Teklif / fiyat kaydı" butonunda.
  - Sipariş teslimi `receive_stock` ile partiye girer.

## Faz 3E'den sonraki fazlara kalanlar
- e-Fatura XML'indeki satıcı ürün kodunun otomatik okunması: kod şimdilik stok kartında elle girilir.
- Fiyat değişiminin SMM etkisi raporu: Faz 3F (maliyet sekmesi).
- Depolar, kör sayım ve onaylı imha akışı (EK-1 Not 4–5): FEFO ve SKT listesi bu fazda hazır; sayım ekranı Faz 3F/3G'de.
