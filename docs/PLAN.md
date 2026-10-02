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
| 3C | Üretim emri (taslak → kontrol → onay → kapanış), kalibrasyon, 1 kişilik reçete, basılı iş emri | ✅ (rapor: `raporlar/faz-3C.md`; Grok UI denetlendi) |
| 3D | Menü tipi, tabla/küvet sunum, müşteri menüsü, aylık sipariş, portal v2, hassasiyet/şikâyet, menü kartı HTML/PDF | ✅ (rapor: `raporlar/faz-3D.md`) |
| 3E | Stok partileri (FIFO), tek giriş kapısı, fatura eşleştirme (takma ad), 564 stok + 331 yemek iskeleti, depolar/etiketler/sayım, güncellenen stoklar, satınalma talep formu | ✅ (rapor: `raporlar/faz-3E.md`; sayım/depolar 3F-3G) |
| 3F | Finans › Maliyet (gün/ay/yıl, sürümlü), menüden sürümlü satınalma planı, teklif analizi | ⏳ |
| 3H | Üretimden öğrenen reçete, öğün bazlı genel gider dağıtımı | ⏳ |
| 3G | Kurucu paneli: kullanıcı sil/kısıtla, modül aç/kapat | ⏳ |
| 4 | Cari & kasa: tahsilat tahsisi, çek-senet, kredi, ekstre, hatırlatma, belge merkezi, irsaliye → satış faturası (UBL-TR) | ⏳ |
| 5 | Lojistik: rota & harita, araç uyarıları, şoför ekranı ve masrafı, canlı takip, filo kartviziti | ⏳ |
| 6 | Personel: XLSX puantaj, bordro dönemi, izin bakiyesi, İK rolü | ⏳ |
| 7 | Kârlılık, teklif & sunum, marka şablonu | ⏳ |
| 8A · 8 · 8B | CRM + hedef kitle botu, Bugün kartları + sosyal medya, Hata Merkezi | ⏳ |
| 9 · 10 | Rehber/turlar · uçtan uca doğrulama | ⏳ |

## EK-1 notları (kaynak: `docs/claude/CLAUDE-EK-NOTLAR-1.md`; çakışmada §17 tablosu)
Her not ilgili fazın **içinde** uygulanır; ayrı faz açılmaz. Durum: ✅ bitti · 🗄️ veritabanı hazır, ekran bekliyor · ⏳ sırada.

| Faz | EK-1 / Not | İş | Durum |
|---|---|---|---|
| Hemen | EK-1 / Not 12 | Logo seçenek 1: favicon, PWA manifest, `Logo.tsx`, giriş ve kenar çubuğu |✅ |
| Hemen | EK-1 / Not 13 | Girişsiz iletişim sayfası `public/iletisim.html` + uygulama içi link |✅ |
| Hemen | EK-1 / Not 8 | Cari › müşteri › "Sipariş linki" sekmesi (kopyala, WhatsApp, QR, yenile) |✅ |
| Hemen | EK-1 / Not 2 | "Hammadde" → **Stok kartı**; `/stok/kartlar` (eski adres yönlenir); sarf kategorileri |✅ |
| 3D | EK-1 / Not 1 · 3 | Aylık menü (sürümlü), müşteri yasak/tercih kuralları, yemek etiketleri, `publish_monthly_menu` | ✅ |
| 3D | EK-1 / Not 14 | `<MonthMenuCalendar mode="menu">`, maket birebir (sürükle/kopyala, undo, mobil ajanda) | ✅ |
| 3D | EK-1 / Not 1 | AI menü önerisi (`menu-suggest` 🔌 + kural motoru yedeği), `ai_budget`/`ai_usage` freni | ✅ kural motoru · ⏳ AI 🔌 |
| 3D | EK-1 / Not 7 · 8 | Portal v2: Sipariş, Aylık menü, Geri bildirim (`customer_feedback`), PIN; portal yetkilisi TC+telefon | ✅ (Vault anahtarı kullanıcıda) |
| 3D | Kullanıcı notu D · E · H | Müşteriye menü atama (`customer_menus`), kap tipi/maliyeti, tepsi/küvet, Bugün öğün geçiş saatleri | ✅ |
| 3E | EK-1 / Not 4 | Depolar, açılış sayımı, 15 günde bir kör sayım, fark = zayiat | ⏳ |
| 3E | EK-1 / Not 5 | FEFO (Ç-2), haftalık SKT bildirimi, onaylı imha | ✅ FEFO + SKT listesi · ⏳ bildirim/onaylı imha |
| 3E | Kullanıcı notu B · C | Elle stok nedeni zorunlu, faturasız pazar alımı → tedarikçiye borç | 🗄️ (canlıda, test ✅) |
| 3F | EK-1 / Not 14 | Takvim `mode="satinalma"` + ihtiyaç paneli | ⏳ |
| 3F | EK-1 / Not 6 | Tedarikçi teklif isteme (RFQ, tokenlı link) — **MUST** (Ç-3) | ⏳ |
| 3F | Kullanıcı notu G | Toptan referans fiyatı botu (`market_reference_prices`) | 🗄️ (tablo canlıda) |
| 4 | EK-1 / Not 9 · 10 · 11 | Portal bakiye (giriş/PIN), bekleyen KDV, banka/kasa/kart mutabakatı, canlı bakiyeler (G-1) | ⏳ |
| 5 | EK-1 / Not 15b · 16 | Filo (km, belge, hatırlatma, kartvizit), `route_stops` (Ç-5), müşteri sarf, `<OpsMap>` | ⏳ |
| 6 | EK-1 / Not 15a | Personel ödemeleri, belgeler, personel kartviziti (maket) | ⏳ |
| 7 | EK-1 / Not 12 | Logolar marka kitinde ve antette | ⏳ |
| 8A | EK-1 / Not 16 | Harita pazarlama katmanı, kement → aday | ⏳ |
| 8 | EK-1 / Not 17 | Sosyal medya: Embay modülünün uyarlanması (§15; Ç-4, Ç-6, Ç-7, Ç-11) | ⏳ |
| Her faz | EK-1 / G-1 | Canlı ekranlar: bakiye yalnız defterden, Realtime + önbellek yenileme | sürekli |

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
- **Başka ajanların canlıya uyguladığı migration'lar:** Canlıdaki içerik birebir dosyaya alınır (yeniden uygulanmaz); eksik test/güvenlik düzeltmesi ayrı, eklemeli migration ile yapılır.
- **Üretim kapanışı:** Sipariş teslimi ve gelir varsayılan açık; kutu yalnız istisna.
- **Main dalı:** Belge gereği her faz testleri geçince `main`'e ve canlı dala aynı commit gönderilir.

## Açık notlar
- E-fatura KDV oranı (%10) ve tevkifat (5/10) mali müşavirle teyit edilmeli; tabloda parametre.
- Bordro net↔brüt hesabı yapılmaz; işveren maliyeti bordrodan girdi olarak alınır.
