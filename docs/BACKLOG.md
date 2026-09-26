# Trakya Catering — İş Listesi (tek kaynak)

Kullanıcının tüm notları burada toplanır; yeni not gelince bu listeye eklenir ve sırayla uygulanır.
Durum: ✅ yapıldı · 🔨 yapılıyor · ⏳ sırada · 🔌 dış bağlantı bekliyor (anahtar/hesap gerekir)

Son güncelleme: 26 Eylül 2026

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
- ⏳ Hazırlık kapanınca malzemeleri stoktan düşme (tek tuş)

## 2. Finans — işletmenin finansal yönetim ekranları
- ✅ Gider ekranı: elektrik, su, kira, mazot, bakım… yan yana, artış/azalışa duyarlı, ucu açık kategoriler
- ✅ Gelen e-fatura (UBL XML): gider kalemi otomatik tespit; hammadde fiyatı + stok girişi
- ✅ Gelirler: teslim edilen sipariş → alacak; organizasyon (mevlüt vb.) geliri
- ✅ Kasa & banka, tahsilat/ödeme, finans özeti (kişi başı tam maliyet, hammadde kontrolü)
- ✅ Personel maliyeti: avans/maaş ödemesi kasadan gider olarak düşer
- ✅ Araç giderleri tabloda (yakıt/bakım → gider) — 🔨 ekranı
- 🔨 Çek & senet (portföy, vade, tahsil)
- 🔨 Cari ekstre (müşteri + tedarikçi)

## 3. Satış & müşteri
- ✅ Günlük sipariş ekranı, 16:00 kesim
- ✅ Müşteri sipariş linki (giriş gerektirmez) — veritabanı + sayfa hazır; ⏳ Müşteriler ekranına "linki kopyala / WhatsApp"
- 🔨 Siparişlerden irsaliye/makbuz → carinin altında → aylık satış faturası → UBL-TR XML
- 🔌 e-Fatura/e-Arşiv entegratörü ile otomatik gönderim (entegratör API bilgisi gerekir)
- 🔨 Kurumsal teklif (kişi başı fiyat hesabı: menü maliyeti + genel gider + kâr marjı), logolu teklif formu
- 🔨 Pazarlama: aday firmalar, günlük ziyaret rotası, fotoğraf + geri dönüş, yöneticinin kontrolü
- 🔌 Bölgesel müşteri bulma botu (Google Haritalar/Places API anahtarı gerekir); o zamana kadar liste içe aktarma
- 🔨 Sosyal medya (Embay yöntemi): içerik havuzu, aylık takvim, onay akışı, menüden içerik önerisi
- 🔌 Otomatik paylaşım (Meta / Google İşletme hesabı bağlantısı gerekir)

## 4. Depo & satınalma
- 🔨 Stok & depo: eldeki miktar, giriş/çıkış, fire, sayım, kritik seviye, kaç gün yeter
- 🔨 Firmalara giden malzeme (tuz, baharat, ketçap, mayonez, yağ): stoktan düşer, müşteri maliyetine girer
- 🔨 Satınalma: menü planına göre aylık ihtiyaç (neyden ne kadar alınacak), stok düşülür
- 🔨 Tedarikçi ağı: fiyat kayıtları (loglar), en uygun malı bulma, satınalma siparişi

## 5. Sevkiyat & filo
- 🔨 Araçlar: km, yakıt fişi, bakım, muayene/sigorta hatırlatma
- 🔨 Rota & harita: her firma (cari) haritada; baş şoför rota çizer, şoföre gider
- 🔨 Şoför ekranı: duraklar, navigasyonda yol tarifi (Google Haritalar / Yandex), teslim, talepler (tuzluk vb.)
- ✅ Sohbet paneli ve hazır talepler ("firma tuzluk istedi")
- 🔌 Arvento / Mobiliz: km ve yakıtın otomatik çekilmesi (API anahtarı gerekir)

## 6. Personel
- ✅ Personel listesi ve kartları (aylık / yevmiye, 10 saat, mesai ×1,5, cihaz no, IBAN)
- ✅ Parmak izi (ZKTeco) dosyasıyla yoklama: gelmeyen "yok", 10 saatten eksik kesilir, fazlası ×1,5, raporlu ücretsiz
- ✅ Maaş hesabı + hakedişi deftere yazma; canlı bakiye (yevmiye/avans/ödeme), toplu ödeme
- ✅ Dijital kartvizit (herkese açık link, rehbere kaydet)
- ✅ İzin / avans / mesai talepleri
- 🔌 Parmak izi cihazına doğrudan bağlantı (işyerinde aktarım programı)

## 7. Sistem
- ✅ Kurucu paneli: rol × sekme görünürlüğü, kişiye özel istisna, bağlantı durumları
- ✅ Ekip & firma bilgileri (antet), logo
- ✅ Asistan / bildirim merkezi: zam, vadesi geçen alacak, yaklaşan ödeme, eksik fiyat, gelmeyen sipariş
- ⏳ Asistan: çek vadesi, kritik stok, araç muayene hatırlatmaları

## Sıra (şu an)
1. 🔨 Depo & satınalma ekranları (Stok, Firmalara giden, Satınalma, Tedarikçiler)
2. ⏳ İrsaliye & satış faturası (UBL-TR XML), Çek & senet, cari ekstre, müşteri sipariş linki butonu
3. ⏳ Filo, Rota & harita, Şoför ekranı
4. ⏳ Teklif, Pazarlama & saha, Sosyal medya
5. ⏳ Kalan kartlara kaynak raporu, pencerelerde logo, asistan hatırlatmaları, mobil kontrol
