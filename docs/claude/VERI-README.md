# Ana Stok Listesi ve Yemek Adı Listesi — Trakya Catering

Bu klasördeki listeler ERP'ye toplu yüklenmek için hazırlanmış bir **iskelettir**. Stok ve yemek adları sade tutuldu. Faturalarda karşılaşılan farklı yazımlar yalnız `es_anlamlar` sütununda yer alır. Adlar uygulamadan sonradan değiştirilebilir. Hiçbir şey veritabanına yazılmadı.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `ana-stok-listesi.csv` / `.xlsx` | 564 stok kalemi (xlsx'te "Özet" sayfası var) |
| `yemek-listesi.csv` / `.xlsx` | 331 yemek adı: yalnız ad, kategori ve öğün (malzeme yok) |
| `ice-aktarim-ornegi.sql` | İçe aktarma ve takma ad eşleştirme taslağı (**çalıştırılmadı**) |
| `kaynak/` | İndirilen kaynaklar: İzmir hal bültenleri (JSON), şartname ve KDV kararı (PDF ve metin) |
| `src/` | Listeyi üreten betik (`build.py`, `rename.py`, `items_*.txt`, `yemekler.txt`) |

## Stok listesi sütunları
- `kod`: kategori öneki + sıra numarası. Önekler: SM sebze-meyve, ET et-tavuk, BL balık, SU süt ürünleri, BT bakliyat-tahıl, EU ekmek-unlu, YG yağ, BS baharat-sos, KG kuru gıda, IC içecek, TS temizlik-sarf, DG diğer. Değer `ingredients.code` (unique) sütununa yazılır.
- `standart_ad`: sade ve kanonik ad, marka içermez (ör. Domates, Kıyma, Dana Kuşbaşı).
- `kategori`: canlı şemadaki `ingredients_category_check` değerleriyle birebir aynı. Değerler: et_tavuk, balik, sebze_meyve, bakliyat_tahil, sut_urunleri, yag, baharat_sos, kuru_gida, icecek, ekmek_unlu, temizlik_sarf, diger. Ambalaj, hijyen ve küvet kalemleri `temizlik_sarf` altında; enerji kalemleri `diger` altında durur.
- `alt_kategori`: şemada karşılığı yok. İçe aktarmada `notes` alanına yazılır; ileride ayrı bir sütun olabilir.
- `birim`: canlı `units` tablosunda yalnız g, kg, ml, lt ve adet var; paket ve koli yok. Bu yüzden paketle satılan ürünlerde birim `adet` alındı (ör. peçetede 1 adet = 1 paket).
- `alternatif_birim` + `donusum_katsayisi`: koli, kasa, teneke, çuval, bidon, demet gibi ambalajlar. 1 ambalaj = katsayı × birim. **Değerler sektörde yaygın örneklerdir; tedarikçiye göre değişir.** SQL taslağında bu nedenle tedarikçiye özgü tanım yapılabiliyor.
- `es_anlamlar`: `|` ile ayrılmış fatura ve hal yazımları. İzmir hal bülteninden birebir alınan yazımlar da buradadır ("DOMATES SALÇALIK(RİO)", "BİBER KÖY(MAZO)" gibi). Aksansız büyük harf biçimleri otomatik eklendi. Aynı yazımın iki farklı stoğa gitmediği betikle doğrulandı (çakışma: 0).
- `kdv_orani`: yüzde olarak verildi (şemadaki `vat_rate` de yüzde tutuyor; varsayılanı 1).
- `alerjen`: şemadaki 14 AB alerjeni kodu. Hazır ve karışım ürünlerde değerler **tipik içeriği** yansıtır; kesin bilgi etiketten doğrulanmalıdır.
- `kaynak`: aşağıdaki kaynak kodları.
- `not`: KDV varsayımı ya da teyit gereken durumlar.

### Kategori dağılımı (564)
| Kategori | Adet |
|---|---|
| sebze_meyve | 96 |
| et_tavuk | 50 |
| balik | 30 |
| sut_urunleri (yumurta dahil) | 29 |
| bakliyat_tahil (makarna ve bulgur dahil) | 35 |
| ekmek_unlu | 22 |
| yag | 11 |
| baharat_sos (saşeler dahil) | 73 |
| kuru_gida (konserve, donuk, tatlı malzemesi, kuruyemiş) | 85 |
| icecek | 24 |
| temizlik_sarf (temizlik, hijyen, ambalaj, küvet, servis seti) | 100 |
| diger (LPG, akaryakıt, jel yakıt) | 9 |

## Kaynaklar (gerçekten kullanılanlar)
| Kod | Kaynak | Ne için kullanıldı |
|---|---|---|
| IZM-HAL | İzmir Büyükşehir Belediyesi açık API, sebze-meyve hal bülteni 25.09.2026 — `https://openapi.izmir.bel.tr/api/ibb/halfiyatlari/sebzemeyve/2026-09-25` (98 ürün) | Sebze ve meyve adları, hal yazımları, KG/ADET/BAĞ birimleri |
| IZM-BALIK | Aynı API, balık hali bülteni 24.09.2026 — `.../halfiyatlari/balik/2026-09-24` (67 ürün) | Balık ve deniz ürünü adları, hal yazımları |
| SART-HALIC | Haliç Üniversitesi Yemek Hizmeti Alımı Teknik Şartnamesi 2025/003, Ek-3 "Malzemelerin Evsafı" ve yemek grupları — `https://halic.edu.tr/wp-content/uploads/universitemiz/ihaleler/2025/003/2025-003-teknik-sartname.pdf` | Kuru gıda, yağ, baharat ve süt ürünü kalemleri; yemek adları |
| SART-EOSB | EOSB Yemek Hizmeti Alımı Teknik Şartnamesi 2026, Madde 8 ve EK-C — `https://mobil.eosb.org.tr/upload/vUpload/2026/07/EOSB_yemek_alim_sartnamesi_2026.pdf` | Kahvaltı içeriği, ayran/meyve suyu/su/ekmek ambalajları, servis seti, termobox; yemek adları |
| KDV-KARAR | 2007/13033 sayılı KDV Oranları Kararı, konsolide metin (güncelleme 06.01.2026) — `https://www.dengeakademi.com/Files/Info/K.D.V%20Oranlar%C4%B1%202026.pdf` | KDV oranları (aşağıya bakın) |
| AMB-KATALOG | Ambalaj katalogları: `https://policap.com.tr/uc-bolmeli-mikrodalga-yemek-servis-kabi/` (PP, koli 200), `https://ambalajkurye.com/gida-kaplari/kopuk-kap-ve-tabaklar/prd-dy-3-goz-kapakli-tabldot-100-adet` (köpük, paket 100 / koli 1000), `https://www.ambalaj365.com/urun/siyah-plastik-3-gozlu-kapkapak/` | 3 bölmeli kap adları ve koli içi adetleri |
| (birim kodları) | UBL-TR Kod Listeleri (GİB), ör. `https://birfatura.com/e-fatura-birim-kodlari-nelerdir/` | e-Fatura birim eşlemesi: KGM→kg, GRM→g, LTR→lt, MLT→ml, C62→adet (SQL taslağında) |
| SEKTOR | Kamu kaynağından satır satır doğrulanmamış, sektörde yaygın kalemler | Kaynağı dürüst göstermek için ayrı işaretlendi |

Denenip kullanılamayanlar: İBB açık veri (data.ibb.gov.tr) hal veri seti API'si yanıt vermedi; bu veri seti 2022'den beri güncellenmiyor. TÜİK, Metro ve Bizim Toptan kataloglarından veri alınmadı. Bu kaynaklara dayanan hiçbir satır yok.

## KDV oranları nasıl belirlendi
Karar md.1'e göre: (I) sayılı liste %1, (II) sayılı liste %10, listelerde yer almayanlar %20.
- **%1:** (I) sayılı listenin A bölümü; GTİP 2, 3, 4, 7–12, 15–21. fasıllar (et, balık, süt, yumurta, sebze-meyve, bakliyat, un, yağ, şeker, kakao, unlu mamul, konserve, sos). Ayrıca 22.01 su, 2501 tuz ve B-2/B-3 bentleri (kimyon, kekik, susam, bulgur, pirinç…).
- **%10:** gazlı içecekler (kola, gazoz). Karar md.1/(3) uyarınca, ÖTV'ye tabi olduğu varsayımıyla. LPG tüp ve dökme LPG ((II) sayılı liste 31. sıra; otogaz hariç).
- **%20:** temizlik, hijyen, ambalaj, servis malzemesi, akaryakıt, kömür (listelerde yok).
- **Boş (teyit gerekli):** karbonat, limon tuzu, jelatin, gıda boyası, vanilin, meyveli soda, soğuk çay, şalgam, limonata. Bu ürünlerin GTİP'i veya ÖTV durumu ürüne göre değişir.
- Uyarı: oran ürünün GTİP'ine ve teslim şekline bağlıdır; son kontrol muhasebeciye aittir. İçe aktarmada boş KDV şema varsayılanı olan %1'e düşer; bu satırları yükleme sonrası düzeltin.

## Yemek listesi
- Sütunlar: `kod, yemek_adi, kategori, alt_kategori, ogun, kaynak`.
- `kategori` canlı `recipe_categories` kodlarıyla aynı: corba, ana_yemek, sebze, pilav_makarna, salata_meze, tatli, icecek, kahvalti, ekmek. Değerler `recipes.category_code` sütununa gider.
- `ogun`: kahvalti, ogle ve aksam; birden fazlası `|` ile yazılır. Canlı şemada `menus.meal`, `meal_orders.meal`, `menu_plans.meal` ve `prep_batches.meal` sütunları zaten kahvalti/ogle/aksam/gece değerlerini kullanıyor.
- Dağılım (331):

| Kategori | Adet |
|---|---|
| ana_yemek | 96 |
| corba | 42 |
| sebze | 41 |
| pilav_makarna | 39 |
| salata_meze | 36 |
| tatli | 34 |
| kahvalti | 30 |
| icecek | 8 |
| ekmek | 5 |

- Kaynak dağılımı: SART-HALIC 115, SART-EOSB 21, SEKTOR 195.
- Reçete içeriği bilerek yok. Malzeme ve miktarlar mutfakta gerçek üretimden girilecek ("X kişilik üretimde Y kullanıldı"; bkz. claude-is-plani.md, Faz 3H).

## İçe aktarma kuralı (özet)
1. Kanonik ad sabittir. Faturadaki ürün mevcut bir stoğa eşleşirse o stoğa yazılır, stok güncellenir ve tedarikçi etiketi (parti / `supplier_id`) kaydedilir.
2. Eşleşme sırası: önce tedarikçiye özgü takma ad, sonra genel takma ad, sonra benzerlik önerisi (pg_trgm; kullanıcı onaylar). Onaylanan yazım yeni takma ad olur, bir sonraki faturada otomatik eşleşir.
3. Hiç eşleşme yoksa yeni stok oluşturulur (`diger` kategorisi ve "gözden geçir" notuyla), fatura yazımı takma ad olarak eklenir.
4. Ayrıntı ve SQL: `ice-aktarim-ornegi.sql`.
