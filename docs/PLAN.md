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
| Mutfak | Günlük Üretim & Maliyet | Siparişlerden üretim listesi, porsiyon maliyeti (o günün fiyatıyla sabit), kişi başı hammadde ve tam maliyet, 14 günlük trend |
| Mutfak | Reçeteler & Gramaj | Net/brüt gramaj, fire, canlı porsiyon maliyeti, üretim ön-hesabı |
| Mutfak | Menüler | 3-4 kap, porsiyon katsayısı, food cost % |
| Mutfak | Hammaddeler | Birim, fire, fiyat geçmişi, alerjen |
| Satış | Siparişler | Gün × öğün × müşteri kişi sayısı, önceki günü kopyala, toplu teslim → gelir kaydı |
| Satış | Müşteriler | Kişi başı fiyat, KDV, vade, e-fatura bilgisi |
| Finans | Finans Özeti | Gelir/gider/net kâr, 1 kişilik öğün maliyet ayrışımı, hammadde kontrolü (reçete vs fatura), 12 ay |
| Finans | Giderler | Elektrik, su, doğalgaz, kira, mazot, bakım… yan yana; bu ay/geçen ay artış-azalış, 6 aylık grafik; kategori eklenebilir |
| Finans | Gelen Faturalar | UBL-TR XML yükleme, otomatik gider kalemi tespiti (tedarikçi hafızası + anahtar kelime), gıda faturası fiyatlarını hammaddelere aktarma |
| Finans | Kasa & Gelirler | Kasa/banka bakiyesi, tahsil edilecek/ödenecek, günlük giriş-çıkış ve bakiye |
| Sistem | Ekip & Yetkiler | Roller: yönetici, aşçıbaşı, diyetisyen, muhasebe, satınalma, pazarlama, depo, şoför, müşteri |

## Sıradaki fazlar
1. **Personel, puantaj & maaş** — Kibritçi deneyiminden tek kural: günlük = maaş/30, tam ay = 30 gün, 7,5 saatlik gün, mesai ×1,5; ücretli durumlar açıkça listelenir (Geldi, İzinli, Pazar, Tatil; Raporlu ayrı karar). Avans kesinti kaydı olarak bağlanır (isimle eşleştirme yok). Mobil yoklama (Geldi/Yok/Diğer + mesai ±0,5 sa). Maaş ödemesi → Kasa gideri.
2. **Menü planı & diyetisyen ekranı** — Firma bazlı haftalık menü, üretim emirleri (mutfak/tatlı), gramaj kontrolü, alerjen etiketi.
3. **Depo & stok + satınalma** — Üretime çıkış, sayım, SKT; eksik hammadde listesi; tedarikçi fiyat geçmişinden en uygun tedarikçi önerisi.
4. **Müşteri portalı** — Firmalar ertesi günün sayısını 16:00’ya kadar kendisi girer (veritabanı kuralı hazır).
5. **Sevkiyat & araçlar** — Rota, şoför mobil irsaliyesi (imza, sıcaklık), araç yakıt/bakım giderleri araca bağlı.
6. **Satış e-faturası** — Ay sonu teslimlerden toplu fatura; özel entegratör (Paraşüt/Uyumsoft/Logo) adaptörü; gelen faturaların otomatik çekimi.
7. **Teklifler** — Kurumsal teklif şablonu; menü maliyeti + genel gider payı + hedef marjla kişi başı fiyat hesaplayıcı.
8. **Müşteri bulma & saha** — Bölgesel firma botu (yalnız izinli/resmi kaynaklar), pazarlamacı günlük rotası, ziyaret fotoğrafı ve dönüş notu, yönetici kontrolü.
9. **Sosyal medya** — Embay deneyiminden: günün menüsü paylaşımı, içerik takvimi, onay kuyruğu.
10. **Gıda güvenliği** — Şahit numune (72 saat), lot/SKT, sevkiyat sıcaklığı.

## Açık notlar
- E-fatura KDV oranı (%10) ve tevkifat (5/10) mali müşavirle teyit edilmeli; tabloda parametre.
- Bordro net↔brüt hesabı yapılmaz; işveren maliyeti bordrodan girdi olarak alınır.
