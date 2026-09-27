# Trakya Catering — İş Listesi (tek kaynak)

Kullanıcının tüm notları burada toplanır; yeni not gelince bu listeye eklenir ve sırayla uygulanır.
Durum: ✅ yapıldı · 🔨 yapılıyor · ⏳ sırada · 🔌 dış bağlantı bekliyor (anahtar/hesap gerekir)

Son güncelleme: 27 Eylül 2026 · Faz sırası ve ayrıntı: `docs/PLAN.md` ve `docs/claude/CLAUDE-ANA-PROMPT.md` §8 (her maddenin yanında hangi fazda yapılacağı yazılı)

## 0. Genel kurallar (her ekran için)
- ✅ Uydurma veri yok: tüm rakamlar veritabanından (Supabase). Demo yalnız ayrı derlemeyle.
- ✅ Girişte rol belli; menü role göre açılır. Kurucu her şeyi görür, üyeliklerin görebileceğini belirler.
- ✅ Sayı kartlarına tıklayınca rakamın kaynağı logolu rapor penceresinde (ana sayfa, personel, puantaj, bakiyeler). ⏳ kalan ekranların kartları
- ✅ Her sekmede Rapor + WhatsApp; raporlarda logo + hologram mühürlü antet; Excel (CSV), Yazdır/PDF
- ✅ Kaydet / güncelle / sil, arama, filtre, tarih aralığı, çoklu seçim + toplu işlem
- ✅ Hologram butonlar ve açılış geçişleri; uygulama içi onay penceresi
- ✅ Mobilde taşma yok (tüm mevcut sekmeler 390 px'te denendi). ⏳ yeni sekmelerde de kontrol
- ✅ Hata yakalayıcı: bir ekranda sorun olursa sayfa boş kalmaz
- ⏳ Pencere başlıklarında (çekmece, rapor) logo

## 1. Mutfak — en büyük beklenti: 1 porsiyon / 1 menü kaça mal oluyor
- ✅ Reçete: 1 porsiyon gramajı, fire, çiğ yan malzemeler; stoktan veya elle + fiyat
- ✅ Reçetede "Güncelle": son alış fiyatlarıyla maliyeti yeniler, geçmişe yazar
- ✅ Günlük hazırlık: diyetisyen yemeğe "içerik ekle", hazırlanan kg/adet girer; siparişteki kişiye bölünür → 1 porsiyon
- ✅ Reçetesi olmayan yemek çalışırken oluşur; hazırlıktan reçete türetilir
- ✅ Menü modeli: kaç çeşitse (5, 6…), salata, soğuk mezeli, kahvaltı, diyet, firma bazlı menü
- ✅ Menü planı (haftalık, firmaya özel), kahvaltı ekranı
- ✅ Üretim emri + malzeme çıkış raporu (karnıyarık 850 kişi → kaç kg patlıcan), istasyon bazlı
- ✅ Mutfak ekranı: ilkokul seviyesine uygun büyük yazı, simge, adım adım, sesli okuma
- ✅ Hazırlıktan malzemeleri stoktan düşme (tek tuş; aynı yemek iki kez düşülmez)
- ⏳ **Üretim emri ver → son onay → stok düşer, sipariş teslim olur, gelir oluşur** (Faz 3C; gider yalnız faturadan)
- ⏳ **Menü formatı tasarımı — ÇOK ÖNEMLİ:** firmalara gönderilecek HTML + PDF menü; 2 tip: standart ve kalori hesaplı; ayrıca kahvaltı menüsü (Faz 3D, kalori verisi 3H)
- ⏳ 1 kişilik reçete, gramaj kalibrasyonu, basılı iş emri (Faz 3C)

## 2. Finans — işletmenin finansal yönetim ekranları
- ✅ Gider ekranı: elektrik, su, kira, mazot, bakım… yan yana, artış/azalışa duyarlı, ucu açık kategoriler
- ✅ Gelen e-fatura (UBL XML): gider kalemi otomatik tespit; hammadde fiyatı + stok girişi
- ✅ Gelirler: teslim edilen sipariş → alacak; organizasyon (mevlüt vb.) geliri
- ✅ Kasa & banka, tahsilat/ödeme, finans özeti (kişi başı tam maliyet, hammadde kontrolü)
- ✅ Personel maliyeti: avans/maaş ödemesi kasadan gider olarak düşer
- ✅ Araç giderleri tabloda (yakıt/bakım → gider) — 🔨 ekranı
- ✅ Tek gider kuralı: hammadde gideri yalnız faturada bir kez; üretim/sevk gider yazmaz (veritabanı testli)
- 🔨 Çek & senet (portföy, vade, tahsil) (Faz 4)
- 🔨 Cari ekstre (müşteri + tedarikçi) (Faz 4)

## 3. Satış & müşteri
- ✅ Günlük sipariş ekranı, 16:00 kesim
- ✅ Müşteri sipariş linki (giriş gerektirmez) — veritabanı + sayfa hazır; ⏳ Müşteriler ekranına "linki kopyala / WhatsApp"
- ⏳ **Firmalar birer cari:** siparişlerden irsaliye/makbuz → carinin altında → aylık satış faturası → UBL-TR XML; fatura kesme metotları (Faz 4)
- 🔌 e-Fatura/e-Arşiv entegratörü ile otomatik gönderim (entegratör API bilgisi gerekir)
- 🔨 Kurumsal teklif (kişi başı fiyat hesabı: menü maliyeti + genel gider + kâr marjı), logolu teklif formu
- 🔨 Pazarlama: aday firmalar, günlük ziyaret rotası, fotoğraf + geri dönüş, yöneticinin kontrolü
- 🔌 Bölgesel müşteri bulma botu (Google Haritalar/Places API anahtarı gerekir); o zamana kadar liste içe aktarma
- 🔨 Sosyal medya (Embay yöntemi): içerik havuzu, aylık takvim, onay akışı, menüden içerik önerisi
- 🔌 Otomatik paylaşım (Meta / Google İşletme hesabı bağlantısı gerekir)

## 4. Depo & satınalma
- ✅ Stok & depo v1: eldeki miktar, giriş/çıkış, fire, sayım (fark), kritik seviye, kaç gün yeter
- ✅ Tek kapı stok girişi: sipariş teslimi ile fatura aynı malı iki kez stoğa sokmaz; girişte tedarikçi etiketi
- ⏳ **Depo modülü v2:** açılış sayımı → faturalarla güncelleme → yemekte düşme; 15 günde bir teyit sayımı; depolar (soğuk, kuru gıda, derin dondurucu); stok etiket grupları (kahvaltı, kuru gıda, et…) ve gruba göre fire ve pişme dönüşümü (Faz 3E)
- ⏳ **Güncellenen stoklar listesi:** en güncel fiyat, bir önceki fiyat, getiren tedarikçi, benzer tedarikçinin fiyatı (Faz 3E)
- ⏳ Ana stok listesi (564) + yemek listesi (331) iskeletinin yüklenmesi, fatura adı eşleştirme (Faz 3E)
- 🔨 Firmalara giden malzeme (tuz, baharat, ketçap, mayonez, yağ): stoktan düşer, müşteri maliyetine girer
- ✅ Satınalma: menü planına göre aylık ihtiyaç (neyden ne kadar alınacak), stok düşülür
- ⏳ **Satınalma talep/sipariş formu:** tedarikçi seç → stoktan ürün seç → HTML ve Excel (XLSX) → tedarikçinin e-posta / WhatsApp hattına gönder (Faz 3E–3F)
- ✅ Tedarikçi ağı: fiyat kayıtları (loglar), en uygun malı bulma, satınalma siparişi

## 5. Sevkiyat & filo
- 🔨 Araçlar: km, yakıt fişi, bakım, muayene/sigorta hatırlatma (Faz 5)
- ⏳ **Filo içinde kartvizit** (şoför/araç), personeldeki gibi (Faz 5)
- 🔨 Rota & harita: her firma (cari) haritada; baş şoför rota çizer, şoföre gider
- 🔨 Şoför ekranı: duraklar, navigasyonda yol tarifi (Google Haritalar / Yandex), teslim, talepler (tuzluk vb.)
- ✅ Sohbet paneli ve hazır talepler ("firma tuzluk istedi")
- 🔌 Arvento / Mobiliz: km ve yakıtın otomatik çekilmesi (API anahtarı gerekir)

## 6. Personel
- ✅ Personel listesi ve kartları (aylık / yevmiye, 10 saat, mesai ×1,5, cihaz no, IBAN)
- ✅ Parmak izi (ZKTeco) dosyasıyla yoklama: gelmeyen "yok", 10 saatten eksik kesilir, fazlası ×1,5, raporlu ücretsiz
- ✅ Maaş hesabı + hakedişi deftere yazma; canlı bakiye (yevmiye/avans/ödeme), toplu ödeme
- ✅ Dijital kartvizit (herkese açık link, rehbere kaydet)
- ✅ İzin / avans / mesai talepleri (kendi talebini onaylayamaz — veritabanı kuralı)
- ✅ **Canlı bağlantılar:** personel avans talep eder → yönetici Onaylar'da ödeme hesabını seçip onaylar → defter + kasa + personel bakiyesi anında değişir; yönetici doğrudan avans girişi de bakiyeye canlı yansır (uçtan uca SQL testi)
- ✅ Maaş/IBAN yalnız yönetici ve muhasebe görür; diğerleri yalnız rehber (ad, unvan, telefon)
- 🔌 Parmak izi cihazına doğrudan bağlantı (işyerinde aktarım programı)

## 7. Sistem
- ✅ Kurucu paneli: rol × sekme görünürlüğü (sekme düzeyinde), kişiye özel istisna, bağlantı durumları
- ✅ Sade menü: 30 ekran → 14 modül + sekmeler; eski adresler yönlendirilir
- ✅ Bugün = rol iş masası (aşçıbaşı, diyetisyen, depo, satınalma, muhasebe, pazarlama, şoför için kartlar); yönetici: Özet · Onaylar
- ✅ Ekip & firma bilgileri (antet), logo
- ✅ Asistan / bildirim merkezi: zam, vadesi geçen alacak, yaklaşan ödeme, eksik fiyat, gelmeyen sipariş
- ✅ Asistan: fiyatsız sipariş uyarısı
- ⏳ Asistan: çek vadesi, kritik stok, araç muayene, teyit sayımı hatırlatmaları
- ✅ Denetim kaydı değiştirilemez, hash zinciriyle mühürlü; istemci hataları Hata Merkezi'ne düşer (kişisel veri maskeli)
- ✅ CI: tip kontrolü, birim testleri, derleme

## Sıra (şu an) — ANA-PROMPT §8
1. ✅ Faz 3A — güvenlik ve bütünlük
2. ✅ Faz 3B — navigasyon 30 → 14, rol çalışma alanı
3. ✅ Faz 3C-0 — onay merkezi + avans → bakiye canlı bağlantısı
4. 🔨 Faz 3C — üretim emri onayı → stok/sipariş/gelir
5. ⏳ Faz 3D — menü tipleri, müşteri menüsü, **menü kartı HTML/PDF (standart, kalorili, kahvaltı)**
6. ⏳ Faz 3E — stok partileri, depolar, sayım, güncellenen stoklar, satınalma talep formu, stok/yemek iskeleti
7. ⏳ 3F → 3H → 3G → 4 (cari/fatura) → 5 (lojistik, filo kartviziti) → 6 → 7 → 8A → 8 → 8B → 9 → 10
