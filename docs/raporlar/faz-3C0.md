# Faz 3C-0 raporu — Onay merkezi ve canlı avans → bakiye

27 Eylül 2026

## Sizin yapmanız gereken
Yeni panel ayarı yok. Faz 3A raporundaki ayarlar hâlâ geçerli.

## Ne yapıldı
- **Onay merkezi** (Bugün › Onaylar):
  - Avans, izin, fazla mesai, gider/ödeme ve ileride satınalma planı gibi işler tek yerde karara bağlanır.
  - Liste canlıdır: yeni talep gelince sayfa yenilemeden görünür.
  - Sekmede bekleyen sayısı yazar.
- **Kurallar veritabanında:**
  - Talep eden kendi talebini onaylayamaz.
  - Reddetmek için açıklama zorunludur.
  - Karar verilmiş talep bir daha değişmez.
  - Talebin içeriği (tutar, tarih) sonradan değiştirilemez; gerekirse iptal edilip yeniden açılır.
  - Talebi yalnız açan kişi iptal edebilir.
- **Kim onaylar?**

  | İş | Onaylayan |
  |---|---|
  | Avans, izin, mesai, satınalma planı, maliyet düzenleme, stok düzeltme | Yönetici |
  | Gider ve ödeme — 20.000 ₺'ye kadar | Muhasebe (yönetici de onaylayabilir) |
  | Gider ve ödeme — 20.000 ₺ üstü | Yalnız yönetici; muhasebe bu talepleri görmez |
  | Modül kapatma, kullanıcı silme, hata düzeltme | Kurucu |

  Kurucu bu kuralları değiştirebilir.
- **Değiştirilemez kayıt:** Her talep ve karar (kim, ne zaman, not, ek) ayrı bir olay kaydına yazılır. Bu kayıt silinemez ve değiştirilemez; hash zinciriyle mühürlüdür. Karar ayrıca denetim kaydına da düşer. Talep anındaki veri saklanır.
- **Canlı avans → bakiye:**
  1. Personel avans talep eder (ya da yönetici personel adına girer).
  2. Onaylar'da ödeme hesabı (kasa/banka) seçilip onaylanır.
  3. Aynı anda personel defterine avans yazılır, kasadan gider düşer ve personel bakiyesi değişir.
  4. Bakiyeler ve Kasa ekranları açıksa kendiliğinden güncellenir.
  5. Yöneticinin Bakiyeler ekranından doğrudan girdiği avans da eskisi gibi anında yansır.
- Personel › Kartlar & talepler ekranında bekleyen talep aynı onay satırıyla (hesap seçimi, gerekçeli red) karara bağlanır. Talep durumunu doğrudan değiştirmek artık mümkün değil; yalnız onay merkezinden değişir.
- Diğer rollerin Bugün ekranına **"Taleplerim"** kartı eklendi (avans/izin taleplerinin durumu).

## Uygulanan migration (canlı sürüm)
- `20260927002757_approvals`. Bu migration şunları ekledi:
  - `approval_policies` (11 kural), `approval_requests`, `approval_events` (değişmez, hash zinciri);
  - `request_approval`, `decide_approval`, `can_decide`, `verify_approval_chain` (hepsi SECURITY INVOKER; kurallar RLS ve tetikleyicide);
  - personel talebi → onay tetikleyicisi, onay → defter/kasa tetikleyicisi;
  - `employee_ledger.request_id` (aynı talep iki kez ödenmez);
  - Realtime yayınına `approval_requests`.

  Önce `begin … rollback` içinde uçtan uca testle denendi.

## Test sonuçları
- **SQL** — `approvals.sql`, tüm adımlar geçti:
  - personel kendi avansını onaylayamaz;
  - talep durumu doğrudan değiştirilemez;
  - hesapsız avans onayı reddedilir;
  - onayda defter 3.000 ₺ avans ve kasadan 3.000 ₺ gider oluşur;
  - karar sonradan değişmez;
  - yönetici kendi izin talebini onaylayamaz, başka yönetici onaylar;
  - notsuz red olmaz;
  - 5.000 ₺ gideri muhasebe onaylar; 50.000 ₺'yi göremez ve onaylayamaz, yönetici onaylar;
  - talep tutarı değiştirilemez; iptal edilebilir;
  - 6 olay kaydı oluşur; olaylar değiştirilemez ve silinemez; zincir doğrulanır; denetim kaydı yazılır.
- **Birim testleri:** 122/122 geçti (rol kart setleri "Taleplerim" ile güncellendi).
- **Tarayıcı:**
  - 390 px'te tüm modüller açıldı;
  - Onaylar ekranında bekleyen avans, hesap seçimi ve red alanı taşmadan görünüyor.
- **Advisor:** yeni WARN yok.

## Bilinen eksikler
- İzin onayının puantaja otomatik "izinli" yazması Faz 6'da (bordro dönemi ile) gelecek.
- Gider/ödeme eşik onayının ekranlara bağlanması Faz 4'te (tahsilat/ödeme) gelecek. Kural ve test şimdiden hazır.

## Sıradaki
**Faz 3C — Üretim emri:**
- taslak → kontrol → onay → kapanış;
- kapanışta stok düşer, gider yazılmaz;
- sipariş teslim edilir, gelir oluşur;
- gramaj kalibrasyonu, 1 kişilik reçete, basılı iş emri.
