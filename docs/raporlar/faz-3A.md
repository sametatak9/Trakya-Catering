# Faz 3A raporu — Güvenlik, bütünlük ve temizlik

27 Eylül 2026

## Sizin yapmanız gerekenler (Supabase ve Render panelinde; beklemeden devam ettim)
1. **Sızdırılmış parola koruması:**
   - Supabase Dashboard → Authentication → *Sign In / Providers* → *Password* bölümüne gidin.
   - **Leaked password protection** seçeneğini açın.
   - Bunu ben yapamıyorum; güvenlik uyarı listesindeki son madde budur.
2. **Giriş adresi:**
   - Supabase Dashboard → Authentication → *URL Configuration* bölümüne gidin.
   - **Site URL** = `https://trakya-catering.onrender.com` yazın.
   - **Redirect URLs** listesine `https://trakya-catering.onrender.com/**` ekleyin.
   - Bu ayar olmadan e-posta doğrulama ve parola sıfırlama linkleri yanlış adrese gider.
3. **Render yönlendirme:** Uygulama `#/` adresleriyle çalıştığı için şart değil. Yine de ekleyebilirsiniz:
   - Render → *trakya-catering* → *Redirects/Rewrites* bölümüne gidin.
   - Kaynak `/*`, hedef `/index.html`, tür **Rewrite** olan bir kural ekleyin.

## Ne yapıldı
| Kod | Sorun | Çözüm |
|---|---|---|
| M-1 | Repo'daki migration dosya adları canlı sürümlerle uyuşmuyordu | 10 dosya canlı sürüm numarasına göre yeniden adlandırıldı; yeni dosyalar da canlı sürümle adlandırılıyor |
| S-1 | Her personel başkasının maaşını/IBAN'ını okuyabiliyordu | Yalnız yönetici, muhasebe ve kişinin kendisi okur. Diğerleri yalnız **rehberi** (ad, unvan, bölüm, telefon) görür |
| S-2 | Portal müşterisi siparişte fiyatı kendisi yazabiliyordu | Fiyat, KDV, tür ve teslim miktarı müşteri kartından zorlanır |
| S-3 | Personel kendi talebini "onaylandı" olarak ekleyebiliyordu | Talep yalnız "bekliyor" olarak açılır |
| S-4 | Yönetici kendini/başkasını kurucu yapabiliyordu | Yalnız kurucu kurucu atar; yönetici kendi rolünü değiştiremez, kurucuyu düşüremez |
| S-6 | Gereksiz tablo yetkileri | `truncate/trigger/references` geri alındı |
| Devir 2 | Birim değişince fiyat/miktar bozuluyordu | Aynı ölçü türünde (kg ↔ g, lt ↔ ml) fiyat, ortalama maliyet, en az stok, fiyat geçmişi, teklif ve stok hareketleri otomatik çevrilir. kg → adet gibi değişiklik geçmişi olan kalemde reddedilir. Ekranda onay penceresi çıkar |
| Devir 3 | `1.250` sayısı 1,25 okunuyordu | Türkçe sayı okuma yeniden yazıldı: `1.250` → 1250, `1,25` → 1,25, `1.250,5` → 1250,5. 27 tablo testi yazıldı. "Pişmiş porsiyon" alanı artık virgülü kabul ediyor |
| Devir 4 | Aşçıbaşı fiyatı doğrudan değiştirebiliyordu | Son fiyat ve ortalama maliyet yalnız fiyat kaydı, fatura ve stok girişiyle değişir |
| Devir 5 | Çıkışta önbellek kalıyordu | Çıkışta tüm veri önbelleği ve kullanıcıya özel yerel kayıtlar silinir |
| Devir 6 | `.env.example` canlı projeyi gösteriyordu | Yer tutucu yazıldı; canlı değerler yalnız Render'da |
| Devir 7 | CI yoktu | GitHub Actions eklendi: tip kontrolü, birim testleri, derleme, veritabanı tipleri güncel mi kontrolü |
| B-1 | Fiyatsız teslim sessizce gelirsiz kalıyordu | Veritabanı reddeder ve açıklama gösterir. Asistan "N siparişte kişi başı fiyat yok" diye önceden uyarır |
| B-3 | Aynı mal sipariş teslimi ve faturayla iki kez stoğa girebiliyordu | **Tek kapı:** faturada "Bağlı satınalma siparişi" seçilir. Mal teslimde girdiyse fatura yalnız fiyatı günceller (tersi de geçerli). Aynı belge aynı malı ikinci kez sokamaz. Her girişte tedarikçi etiketi tutulur |
| Muhasebe kuralı | — | Test: sipariş teslimi + fatura + üretim çıkışı → **tam 1** gıda gideri kaydı |
| B-4 | Fiyat girişi ortalama maliyeti bozuyordu | Ortalama maliyet yalnız stok girişinden hesaplanır |
| B-5 | Stok hareketleri silinip değiştirilebiliyordu | Yalnız yönetici düzeltir/siler; diğerleri **ters kayıt** ("geri al") kullanır. Şoför yalnız firmaya sevk yazabilir. Sayım = fark |
| Denetim | — | Denetim kaydı değiştirilemez ve silinemez; **hash zinciriyle mühürlüdür** (`verify_audit_chain`) |
| Hata kaydı | — | Ekran/pencere/istek hataları **Hata Merkezi** tablosuna düşer. Kişi başı dakikada en çok 20 kayıt alınır; e-posta, telefon, IBAN ve anahtarlar maskelenir |
| Canlı | — | Siparişler, hazırlık, personel defteri, stok, finans ve talepler Realtime yayınında (canlı ekranlar için) |
| Performans | — | 39 indekssiz yabancı anahtara indeks eklendi. Politikalar `(select auth.uid())` kalıbıyla yazıldı; çift politikalar birleştirildi |

## Uygulanan migration'lar (canlı sürüm)
- `20260926235428_security_fixes`
- `20260926235710_security_guards_invoker`: yetki koruyucularının SECURITY INVOKER düzeltmesi. İlk sürümde fiyat koruması test sırasında çalışmadı; bulundu ve düzeltildi.
- `20260927000005_invoker_rpcs`: yeni RPC'ler invoker; hata kaydı kuralları tetikleyicide.

Her biri önce `begin … rollback` içinde test senaryosuyla denendi, sonra uygulandı.

## Test sonuçları
- **SQL:** 7 dosya, hepsi geçti:
  - `security_fixes.sql` (yeni; S-1…S-4, B-1, B-3, B-4, B-5, fiyat koruması, birim çevirisi, denetim, hata kaydı);
  - `customer_order_link`, `save_rpcs`, `finance_flow`, `prep_batch_flow`, `recipes_math_and_rls`, `operations_flow`.
  - İki eski testteki geçersiz menü türü (`3_kap`, `4_kap`) güncellendi. Hazırlık testine "aynı yemek iki kez düşülmez" eklendi.
- **Birim testleri:** 92/92 geçti. Yeniler: Türkçe sayı okuma (27 durum), belge × malzeme birleştirme, fiyatsız sipariş uyarısı.
- **Tip kontrolü ve derleme:** temiz.

## Advisor farkı
- **Performance:** WARN yok. Yalnız "kullanılmayan indeks" bilgisi var; veritabanı boş olduğu için beklenen durum, indeksler silinmez.
- **Security:** Yeni WARN yok. Kalanlar bilinçli:
  - giriş ekranı, sipariş linki ve kartvizit fonksiyonları anonim çağrılabilir;
  - rol yardımcı fonksiyonları;
  - sızdırılmış parola ayarı (yukarıdaki 1. madde).

## Bilinen eksikler / 🔌 bekleyenler
- CI'da SQL testleri için yerel Supabase adımı henüz yok. SQL testleri her fazda Supabase üzerinde `begin … rollback` ile çalıştırılıyor.
- Portal bağlantı anahtarının ayrı tabloya taşınması ve hız sınırı (S-5) Faz 3D'de portal v2 ile yapılacak.
- Stok partileri (FIFO) ve fatura adı eşleştirme Faz 3E'de gelecek.

## Sıradaki
**Faz 3B:**
- navigasyon 30 → 14 modül ve sekmeler; eski adresler yönlendirilir;
- her rol için "Bugün" çalışma alanı;
- yönetici için Onaylar sekmesinin yeri.
