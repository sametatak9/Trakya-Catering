# Trakya Catering ERP — Yol Haritası

Hedef: bir yemekhanenin **mutfak** ve **finans/idari** tarafını tek, sade sistemde toplamak.
Foodsoft gibi eski sistemlerin yerine: az ekran, açıklayıcı sekme adları, her ekranda “ne yapmalıyım” yönlendirmesi.

## İlkeler
- **En önemli soru:** 1 porsiyon / 1 menü / 1 kişilik öğün bugün kaça mal oldu?
- Sahte veri yok. Menüde yalnızca çalışan modüller görünür; planlananlar yol haritasında durur.
- Hesaplar veritabanında (tek doğruluk kaynağı), yetkiler RLS ile.
- Tutar analizleri KDV hariç, tahakkuk esaslı (teslim = gelir, onaylı fatura = gider).

## Tamamlanan
| Alan | Ekran | Ne yapar |
|---|---|---|
| Genel | Bugün | Bugünkü kişi/maliyet, yarının siparişleri ve 16:00 kesimi, kasa, vadesi gelenler |
| Mutfak | Günlük Hazırlık & Maliyet | Yemek başlıkları siparişlerden/menü planından gelir; aşçı hazırlanan toplam miktarı girer (stoktan veya elle + fiyat, çiğ yan malzemeler dahil) → kişi sayısına bölünüp 1 porsiyon gramajı ve maliyeti; reçeteden öneri ve sapma; hazırlıktan reçete türetme; üretim emri ve maliyet raporu |
| Mutfak | Kahvaltı | Kahvaltı hazırlığı ve maliyeti (aynı akış) |
| Mutfak | Menü Planı | Haftalık gün × öğün planı, firmaya özel plan, geçen haftayı kopyala, haftalık menü raporu |
| Mutfak | Reçeteler & Gramaj | Net/brüt gramaj, fire, canlı porsiyon maliyeti, üretim ön-hesabı |
| Mutfak | Menüler | Serbest kap sayısı ve kap türü (çorba, ana, yardımcı, salata, meze, tatlı…), kahvaltı / soğuk mezeli / diyet, firmaya özel menü, maliyet kartı |
| Mutfak | Hammaddeler | Birim, fire, fiyat geçmişi, alerjen |
| Satış | Siparişler | Gün × öğün × müşteri kişi sayısı, önceki günü kopyala, toplu teslim → gelir kaydı |
| Satış | Müşteriler | Kişi başı fiyat, KDV, vade, e-fatura bilgisi |
| Finans | Finans Özeti | Gelir/gider/net kâr, 1 kişilik öğün maliyet ayrışımı, hammadde kontrolü (reçete vs fatura), 12 ay |
| Finans | Giderler | Elektrik, su, doğalgaz, kira, mazot, bakım… yan yana; bu ay/geçen ay artış-azalış, 6 aylık grafik; kategori eklenebilir |
| Finans | Gelen Faturalar | UBL-TR XML yükleme, otomatik gider kalemi tespiti (tedarikçi hafızası + anahtar kelime), gıda faturası fiyatlarını hammaddelere aktarma |
| Finans | Kasa & Gelirler | Kasa/banka bakiyesi, tahsil edilecek/ödenecek, günlük giriş-çıkış ve bakiye |
| Sistem | Ekip & Yetkiler | Roller: yönetici, aşçıbaşı, diyetisyen, muhasebe, satınalma, pazarlama, depo, şoför, müşteri |

| Tümü | Raporlar | Her sekmede logolu, holografik mühürlü antetli rapor: Yazdır/PDF, Excel (CSV), WhatsApp ile gönder |

| Personel | Personel · Puantaj & Maaş · Bakiyeler | Kart, kartvizit, ZKTeco dosyasıyla yoklama (10 saat kuralı, mesai ×1,5), hakediş, canlı bakiye, toplu ödeme |
| Depo | Stok · Firmalara Giden · Satınalma · Tedarikçiler | Eldeki miktar, sayım (fark), menüye göre aylık ihtiyaç, tedarikçi fiyat kaydı, satınalma siparişi |
| Sistem | Kurucu paneli · Asistan · Sohbet | Rol × sekme görünürlüğü, hatırlatmalar, ekip sohbeti |

## Fazlar (bağlayıcı sıra: `docs/claude/CLAUDE-ANA-PROMPT.md` §8)
Her faz: migration (önce `begin … rollback` denemesi) → SQL testi → istemci → vitest → build → push (`main` + canlı dal) → faz raporu (`docs/raporlar/`).

| Faz | Konu | Durum |
|---|---|---|
| 3A | Güvenlik, bütünlük, migration sürümleri, parseNum, çıkış önbelleği, hata kaydı, CI | ✅ (rapor: `raporlar/faz-3A.md`) |
| 3B | Navigasyon 30 → 14 modül, sekmeler, eski yolların yönlendirmesi, rol çalışma alanı | ✅ (rapor: `raporlar/faz-3B.md`) |
| 3C-0 | Onay merkezi (talep → karar, değişmez kayıt, sürüm altyapısı); avans/izin talebi → onay → canlı bakiye | ✅ (rapor: `raporlar/faz-3C0.md`) |
| 3C | Üretim emri (taslak → kontrol → onay → kapanış), kalibrasyon, 1 kişilik reçete, basılı iş emri | ⏳ sıradaki |
| 3D | Menü tipi, tabla/küvet sunum, müşteri menüsü, aylık sipariş, portal v2, hassasiyet/şikâyet, menü kartı HTML/PDF | ⏳ |
| 3E | Stok partileri (FIFO), tek giriş kapısı, fatura eşleştirme (takma ad), 564 stok + 331 yemek iskeleti, depolar/etiketler/sayım, güncellenen stoklar, satınalma talep formu | ⏳ |
| 3F | Finans › Maliyet (gün/ay/yıl, sürümlü), menüden sürümlü satınalma planı, teklif analizi | ⏳ |
| 3H | Üretimden öğrenen reçete, öğün bazlı genel gider dağıtımı | ⏳ |
| 3G | Kurucu paneli: kullanıcı sil/kısıtla, modül aç/kapat | ⏳ |
| 4 | Cari & kasa: tahsilat tahsisi, çek-senet, kredi, ekstre, hatırlatma, belge merkezi, irsaliye → satış faturası (UBL-TR) | ⏳ |
| 5 | Lojistik: rota & harita, araç uyarıları, şoför ekranı ve masrafı, canlı takip, filo kartviziti | ⏳ |
| 6 | Personel: XLSX puantaj, bordro dönemi, izin bakiyesi, İK rolü | ⏳ |
| 7 | Kârlılık, teklif & sunum, marka şablonu | ⏳ |
| 8A · 8 · 8B | CRM + hedef kitle botu, Bugün kartları + sosyal medya, Hata Merkezi | ⏳ |
| 9 · 10 | Rehber/turlar · uçtan uca doğrulama | ⏳ |

## Varsayımlar (belge "soru sorma, makul varsayımla devam et" diyor)
- **Test ortamı:** Ayrı Supabase projesi/branch ücretli olduğundan migration'lar önce canlı projede `begin … rollback` içinde (hiçbir şey kalıcı olmadan) test senaryosuyla denenir, geçince uygulanır. CI'da SQL testleri için yerel Supabase ileride eklenecek.
- **Migration adları:** Dosya adı canlı sürüm numarasıdır (M-1). `apply_migration` sürümü uygulama anında verir; uygulamadan sonra dosya adı eşitlenir.
- **Personel rehberi:** `v_employee_directory` tetikleyiciyle eşitlenen ayrı tablodan okunur (SECURITY DEFINER görünüm advisor'da hata verdiği için).
- **Stok düzeltme:** Stok hareketi silinmez/değiştirilmez; yönetici dışındaki roller "ters kayıt" ile düzeltir. Sayım hareketi = fark (delta).
- **Fiyatsız teslim:** Veritabanı reddeder (kişi başı fiyat 0 iken teslim → hata); asistan önceden uyarır.
- **Mesai kuralı:** Günlük çalışma 10 saat (kartta değiştirilebilir), üstü ×1,5.
- **Sekme adresleri:** Hash yönlendiricide ikinci `#` kullanılamadığı için sekme adresi `/modul/sekme` (ör. `/finans/giderler`); yetki anahtarı belgedeki gibi `/finans#giderler`.
- **Avans onayı = ödeme:** Personel defterinde avans ödenmiş para demektir (hesap zorunlu). Bu yüzden avans onaylanırken ödeme hesabı seçilir; onay anında deftere ve kasaya yazılır. Personel adına yönetici talep girerse talebin sahibi personeldir (girişi yapan ayrıca kaydedilir).
- **Onay kuralları:** Avans, izin, mesai, satınalma planı, maliyet düzenleme, stok düzeltme → yönetici; gider/ödeme 20.000 ₺'ye kadar muhasebe, üstü yönetici; modül kapatma, kullanıcı silme, hata düzeltme → kurucu. Kurucu kuralları değiştirebilir (`approval_policies`).
- **Main dalı:** Belge gereği her faz testleri geçince `main`'e ve canlı dala aynı commit gönderilir.

## Açık notlar
- E-fatura KDV oranı (%10) ve tevkifat (5/10) mali müşavirle teyit edilmeli; tabloda parametre.
- Bordro net↔brüt hesabı yapılmaz; işveren maliyeti bordrodan girdi olarak alınır.
