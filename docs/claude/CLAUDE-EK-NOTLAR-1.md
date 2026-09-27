# CLAUDE EK NOTLAR 1 — Trakya Catering ERP (ana prompta ek)

> **Elindeki işi bölmeden bitir; bu maddeleri docs/PLAN.md içinde ilgili fazlara yerleştir ve sırası gelince uygula; ana prompttaki kurallar (test, push, faz raporu) aynen geçerli.**

### ⚠️ Önce bunu oku: çalışma kuralları (bağlayıcı)
1. **Şu an hangi fazdaysan onu bitir.** Fazın testlerini, faz raporunu ve push'unu ana prompttaki gibi tamamla. Bu eki okumak için elindeki işi yarıda bırakma.
2. **Baştan başlama, bitmiş işi yeniden yazma ya da refactor etme.** Bitmiş fazlara yalnızca bu ekte **açıkça "değişir"** diye yazılan küçük değişiklikler yapılır: Not 2 terim/rota, Not 8 sekmesi, Not 12 logo, Not 13 iletişim sayfası. Başka hiçbir bitmiş ekranı "iyileştirme" amacıyla elleme.
3. Fazı bitirince **ilk iş**: bu ekteki maddeleri `docs/PLAN.md`'de ilgili fazların altına **"EK-1 / Not N"** etiketiyle ekle. Bunu ayrı bir commit olarak yap: `docs: EK-1 notlarını PLAN.md'ye yerleştir`.
4. Ardından **"Hemen" işleri** yap: Not 12 → Not 13 → Not 8 (sekme) → Not 2. Her biri ayrı küçük commit olur, testleri ve push'u yapılır.
5. Sonra ana promptun faz sırasıyla devam et (3C-0 → 3C → 3D → 3E → 3F → 3H → 3G → 4 → 5 → 6 → 7 → 8A → 8 → 8B → 9 → 10). Her fazda bu ekin o faza düşen notlarını **fazın içinde** uygula; ayrı bir faz açma.
6. **Öncelik kuralı:** Ana prompt geçerlidir. Bu ek ana promptu **yalnızca §17'deki "Çakışma ve öncelik" tablosunda yazan yerlerde** değiştirir. Tabloda olmayan her konuda ana prompt kazanır.
7. Belirsiz görünen bir konuda durup soru sorma. Bu ekte her konu için bir **varsayılan** yazılı; onunla devam et, soruyu faz raporuna yaz (ana prompt §10 düzeni).
8. Gizli bilgi: hiçbir token, anahtar ya da parola repo'ya, migration'a, `.env.example` dışındaki dosyalara ya da bu belgelere yazılmaz. Anahtarlar Supabase secrets / Vault'ta tutulur.
9. Her not bölümü **kendi içinde tamamdır**: nerede bağlanır, bağımlılık, kapsam, veri modeli, ekranlar, kurallar ve numaralı kabul kriterleri. Kabul kriterlerinin tamamı sağlanmadan not "bitti" sayılmaz. Faz raporunda not bazında ✅/⏳ yazılır.

Bu belge `CLAUDE-ANA-PROMPT.md` dosyasına **ektir**. Ana prompttaki kurallar değişmez: tek gider kuralı (§3.1/§3.9), lot/FIFO (§3.2), 1 kişilik reçete (§3.3), menünün siparişle ölçeklenmesi (§3.4), 3 öğün (§3.5), sürüm/onay/log (§3.8), Hasat 2.0 tasarımı (§6), faz raporu, vitest/tsc/build ve push (§8.A), uçtan uca testler (§9). Burada anlatılan konular ana promptta zaten varsa tekrar yazılmadı, yalnızca **§ numarasıyla** gösterildi. Burada yalnızca **yeni olan ya da değişen** kısımlar var.

Kullanıcı notları 1–17'yi kapsar. Bunlara ek olarak logo, iletişim sayfası ve Embay sosyal medya modülünün taşınması da burada.

---

## 0) Bu klasördeki dosyalar (tasarım hedefleri)

Kullanıcı bu klasörü repo'da `docs/tasarim/ek-1/` altına koyar. Klasör repo'da yoksa beklemeden buradaki metinle ilerle ve faz raporunda "ek-1 dosyaları repo'da yok" diye yaz. Logo ve iletişim dosyaları (Not 12, 13) klasör gelene kadar ⏳ kalır; diğer notlar metinle uygulanır.

| Dosya | Ne işe yarar |
|---|---|
| `CLAUDE-EK-NOTLAR-1.md` | Bu belge |
| `aylik-menu-mockup.html` (+ `aylik-menu-masaustu.png`, `aylik-menu-satinalma-masaustu.png`, `aylik-menu-mobil.png`) | Etkileşimli **aylık menü takvimi** maketi. Aynı bileşen iki modda çalışır: `?mod=menu` (varsayılan) ve `?mod=satinalma`. Bileşenin adı: `<MonthMenuCalendar mode="menu\|satinalma">` (Not 1, 6, 14) |
| `kartvizit-mockup.html` (+ `.png`) | **Personel** ve **araç** kartvizit kartları: canlı bakiyeler, yoklama şeridi, belge çipleri (Not 15, 16) |
| `iletisim.html` (+ `iletisim-mobil.png`, `iletisim-mobil-tam.png`, `iletisim-masaustu.png`) | Kendi içinde çalışan, girişsiz **iletişim sayfası** (Not 13) |
| `logo/` | 3 logo seçeneği, her biri için yatay, yatay-koyu, ikon ve işaret SVG'leri ile PNG'leri. Seçenek 1'in PWA seti `logo/pwa-secenek-1/` klasöründe. Üretim betiği: `logo/_gen.py` |
| `logo-secenekleri.png` | 3 seçeneğin yan yana önizlemesi (Not 12) |
| `_src/` | Maket şablonları ve ekran görüntüsü betiği (`shot.py`). Yalnızca üretim için |

**Maketler bağlayıcı tasarım hedefidir.** Düzeni, bilgi hiyerarşisini, renkleri (#B4432A, #E9A822, #221F1B, #FBF8F2) ve Outfit/Inter/JetBrains Mono yazı tiplerini birebir uygula. Demo veriler ise gerçek sorgularla değiştirilecek.

---

## 1) Eşleştirme tablosu (not → faz → ana prompt § → öncelik)

| # | Konu | Faz (PLAN.md) | Ana prompt referansı | Öncelik |
|---|---|---|---|---|
| 1 | Aylık menü (müşteri bazlı, 3 öğün, AI önerili) | **3D** (genişletilir) | §3.4, §3.5, §5.C #12, §8 3D | MUST |
| 2 | "Hammadde" yerine tek terim: **Stok kartı** | **Hemen** (mevcut faz bitince, küçük iş) | §4.1 Stok sekmeleri, §3.2 | MUST |
| 3 | Müşteri yasak/tercih kuralları, yemek etiketleri | **3D** | §5.C #12 | MUST |
| 4 | Depolar, açılış sayımı, 15 günde bir sayım, fark = zayiat | **3E** | §3.2, §8 3E | MUST |
| 5 | SKT/FEFO, haftalık SKT bildirimi, onaylı imha kaydı | **3E** | §3.2, §3.8 | MUST |
| 6 | Tedarikçi teklif isteme (RFQ): tokenlı link, karşılaştırma, onay, PO | **3F** (SHOULD → **MUST**) | §3.7, §8 3F, §11 (Çözbim E-Talep) | MUST |
| 7 | Müşteri portalında aylık menü, geri bildirim (revizyon, öneri, şikâyet, beğeni), puan | **3D** (portal v2) | §5.C #12, §8 3D | MUST |
| 8 | Müşteri sipariş linki nerede? (cevap aşağıda, ayrıca "Sipariş linki" sekmesi) | **Hemen** (küçük iş) + 3D | §5.C #12 | MUST |
| 9 | Portalda canlı bakiye (PIN veya girişle) | **3D + 4** | §5.C #12, #13 | SHOULD |
| 10 | KDV tahakkuku: "bekleyen KDV" yükümlülüğü, gider ödeme anında | **4** | §3.1, §3.9, §5.C #13 | MUST |
| 11 | Gerçekçi banka/kasa/kredi kartı bakiyeleri, ekstre içe aktarma, mutabakat | **4** | §5.C #13 | MUST |
| 12 | Logo (favicon, sidebar, giriş, PWA) | **Hemen** (bağımsız küçük iş) → 7'de marka kiti | §8 Faz 7 | MUST |
| 13 | Girişsiz iletişim sayfası (telefon, WhatsApp, adres, harita, vCard) | **Hemen** (bağımsız küçük iş) | §6 | MUST |
| 14 | Satınalma ekranında da aylık menü takvimi, ortak bileşen, hızlı düzenleme | **3D** (bileşen) + **3F** (satınalma modu) | §3.7 | MUST |
| 15 | Personel ödemeleri + kartvizit; filo (km, rota, gider, belge, hatırlatma); **canlı ekranlar ilkesi G-1** | **5, 6** + kesişen kural **G-1** (her faz) | §5.C #7, #8 | MUST |
| 16 | Şoför-araç-rota-müşteri; müşteri mutfak sarf malzemeleri; tüketim ortalaması; harita (rota + pazarlama) | **5** + **8A** | §5.C #7, §18.1 | MUST (harita pazarlama katmanı SHOULD) |
| 17 | Sosyal medya paneli (Embay modülünün taşınması) | **8** (8A'dan sonra) | §5.C #5, §8 Faz 8 | SHOULD (düşük risk, sonraki faz) |

**Yerleşim (PLAN.md'ye aynen yaz):**
- 3D: Not 1, 3, 7, 14 (bileşen), 8 (sekme), 9 (portal tarafı).
- 3E: Not 4, 5.
- 3F: Not 6, 14 (satınalma modu).
- 4: Not 9 (bakiye), 10, 11.
- 5: Not 15b, 16.
- 6: Not 15a.
- 8A: Not 16 (pazarlama haritası).
- 8: Not 17.
- G-1 kuralı her fazın kabul kriterine eklenir.
- **Hemen (mevcut faz bitince, bu sırayla):** Not 12 → Not 13 → Not 8 (Sipariş linki sekmesi) → Not 2. Bunlar küçük ve bağımsız işlerdir.

---
## 2) Not 1 + 3 + 14 — Aylık menü takvimi (müşteri bazlı, 3 öğün, AI önerili), ortak bileşen

> **Nerede bağlanır:** Faz 3D (menü tipi ve portal v2 ile birlikte). Satınalma modu Faz 3F'de etkinleşir; bileşen 3D'de yazılır, 3F'de `mode="satinalma"` bağlanır.
>
> **Bağımlılık:** `menus`, `menu_items`, `menu_plans`, `recipes` (mevcut). §3.6 FIFO maliyet görünümü (hücre maliyeti için; yoksa hücrede maliyet "—" gösterilir, iş durmaz). 3E lotları yalnızca SKT girdisi için gerekir; 3E gelmeden AI önerisi bu girdiyi atlar.
>
> **Kapsam içi:** aylık plan tabloları, yayınlama RPC'si, müşteri kuralları, yemek etiketleri, ortak takvim bileşeni (menü + satınalma modu), AI önerisi + kural motoru yedeği, portal salt okunur görünümü.
>
> **Kapsam dışı:** `menus`/`menu_plans` şemasını değiştirmek ya da silmek; üretim emri mantığını değiştirmek (3C aynen kalır); besin değeri hesabı (§11'deki ayrı madde).
>
> **Ana promptla ilişki:** §3.4 ve §3.5 aynen geçerlidir. Bu bölüm yalnızca aylık planlama katmanını **ekler**. `menu_plans` tek doğruluk kaynağı olarak kalır; aylık plan yayınlandığında oraya yazar.

### 2.1 İstek
- Menü ay bazında planlanır. Her gün kahvaltı, öğle ve akşam için ayrı satır olur. Genel menü ile müşteriye özel menü bir arada görünür. Kap tipi (3 kap, 4 kap, kahvaltı, diyet, özel) filtrelenebilir.
- **Not 14:** Satınalma ekranında da menü **her zaman aylık görünümde** yer alır. Takvim **tek bir ortak bileşendir** ve hem Menü hem Satınalma ekranında kullanılır. Satınalma modunda takvimin yanında malzeme ihtiyacı durur.
- Kolaylıklar zorunlu:
  - Hücrede ekle, çıkar, düzenle.
  - Sürükle-bırak: sürükleyince taşır, **Alt/Ctrl ile sürükleyince kopyalar**.
  - Günü veya haftayı kopyala.
  - Hızlı arama seçici.
  - **Geri al** (Ctrl+Z).
  - Tekrar uyarısı.
  - Satınalma kalemlerinin satır içinde düzenlenmesi.
- **Not 3:** Müşteriye özel yasaklar ve tercihler olur, örneğin "patlıcan yok", "sakatat yok", "cuma balık yok", "haftada 2 kez tatlı". Seçici ve AI bu kurallara uyar.

### 2.2 Mevcut durum
- `menus` (kind, meal), `menu_items` ve `menu_plans` tabloları var. `menu_plans` şu kolonlara sahip: plan_date, meal, customer_id null = genel, menu_id; slot başına unique.
- Ana prompt §3.4 ve §3.5 menünün 1 kişilik olmasını ve 3 öğünü zaten tanımlıyor. §8 3D menü tipi, portal v2 ve hassasiyet/şikâyet işlerini içeriyor.
- **Eksik olanlar:** aylık plan kaydı, yayınlama akışı, müşteri kuralları, yemek etiketleri, ortak takvim bileşeni ve AI önerisi.

### 2.3 Veri modeli (additive; mevcut tablolar bozulmaz)
```sql
-- Aylık plan başlığı (sürümlü, §3.8)
create table public.monthly_menus (
  id uuid primary key default gen_random_uuid(),
  period date not null,                       -- ayın 1'i
  customer_id uuid references public.customers(id), -- null = genel menü
  kind text not null check (kind in ('3_kap','4_kap','kahvalti','diyet','ozel')),
  status text not null default 'taslak' check (status in ('taslak','onay','yayinda','arsiv')),
  version int not null default 1,
  published_at timestamptz, published_by uuid,
  notes text, created_by uuid default auth.uid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (period, customer_id, kind, version)
);
-- Gün × öğün × sıra (hücre içeriği)
create table public.monthly_menu_days (
  id uuid primary key default gen_random_uuid(),
  monthly_menu_id uuid not null references public.monthly_menus(id) on delete cascade,
  day date not null,
  meal text not null check (meal in ('kahvalti','ogle','aksam')),
  position smallint not null default 1,        -- çorba=1, ana=2, yardımcı=3, tatlı/salata=4 …
  recipe_id uuid not null references public.recipes(id),
  course text check (course in ('corba','ana','yardimci','salata','tatli','icecek','kahvalti')),
  note text,
  unique (monthly_menu_id, day, meal, position)
);
-- Yemek etiketleri (kurallar ve AI için)
create table public.recipe_tags (
  recipe_id uuid references public.recipes(id) on delete cascade,
  tag text not null,                            -- 'patlican','sakatat','balik','kirmizi_et','tavuk','bakliyat','kizartma','tatli','vegan','glutensiz','acili'…
  primary key (recipe_id, tag)
);
-- Müşteri kuralları
create table public.customer_dish_rules (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  rule text not null check (rule in ('yasak_etiket','yasak_yemek','tercih_etiket','gun_yasak','haftalik_en_fazla','haftalik_en_az')),
  tag text, recipe_id uuid references public.recipes(id), weekday smallint, qty smallint,
  note text, active boolean default true, created_at timestamptz default now()
);
```
- **`publish_monthly_menu(p_id uuid)` RPC** (security definer, rol `yonetici` / `asci_basi`):
  1. Kuralları doğrular. İhlal varsa hata listesiyle döner.
  2. Her gün × öğün için `menus` + `menu_items` kaydını oluşturur ya da günceller.
  3. `menu_plans` slotunu (plan_date, meal, customer_id, menu_id) doldurur.
  4. Status değerini `yayinda` yapar, sürümü kilitler ve `audit_log` kaydı yazar.

  Bu yaklaşımla 3C/3D'nin aşağı akışı (üretim emri, sipariş, satınalma planı §3.7) **hiç değişmeden** çalışır. Yayınlanmış ay düzenlenirse yeni sürüm açılır (§3.8).
- RLS:
  - Okuma: staff.
  - Yazma: `yonetici`, `asci_basi`.
  - `musteri` rolü yalnızca kendi `customer_id` değerine ait **yayında** olan kaydı ve genel menüyü `current_customer_id()` üzerinden okur.
  - Kurallar tablosu: müşteri okur, yazamaz.

### 2.4 Ortak bileşen `<MonthMenuCalendar>` (maket: `aylik-menu-mockup.html`)
- Konum: `src/features/production/menu-calendar/`. Dosyalar: `MonthMenuCalendar.tsx`, `CalendarCell.tsx`, `DishPicker.tsx`, `useCalendarHistory.ts` (undo yığını), `rules.ts` (saf fonksiyonlar, vitest).
- Props: `mode: 'menu' | 'satinalma'`, `period`, `customerId | null`, `kind`, `readOnly`.
- Masaüstü düzeni:
  - Pzt–Cmt sütunları geniştir, **Pazar sütunu dardır** (servis yoksa gri).
  - Her gün hücresinde 3 öğün bandı bulunur.
  - Hücre içinde yemek çipleri ve öğün başına kişi maliyeti (§3.6 FIFO maliyet) gösterilir.
- Mobil: **ajanda görünümü** (gün kartları alt alta). Filtreler katlanır.
- Etkileşimler (hepsi zorunlu):
  - Hücrede **+** hızlı seçici. Arama yemek adı ve etiket üzerinden yapılır. Müşteri yasağına takılan yemek kırmızı uyarıyla gösterilir, seçilebilir ama gerekçe istenir.
  - Sürükle = taşı, Alt/Ctrl + sürükle = kopyala. Klavye eşdeğeri: seç, sonra Ctrl+C / Ctrl+V.
  - "Günü kopyala", "Haftayı kopyala" (hedef hafta seçilir) ve "Geçen aydan başlat".
  - **Geri al / yinele** (Ctrl+Z / Ctrl+Shift+Z). Yığın en az 50 adım tutar ve kayıttan önce yerelde çalışır.
  - **Tekrar uyarısı:** aynı çorba veya ana yemek 7 gün içinde tekrar ederse turuncu rozet çıkar. Eşik Ayarlar'dan değiştirilebilir.
  - Çakışmalar kaydetmeden önce yan panelde listelenir.
  - İyimser güncelleme + TanStack Query invalidation uygulanır. İki kişi aynı ayı düzenliyorsa Realtime ile "X düzenliyor" uyarısı görünür.
- **Satınalma modu (Not 14):**
  - Takvim sağında **ihtiyaç paneli** yer alır. Seçili gün aralığının (varsayılan: gelecek 7 gün) malzeme ihtiyacı depo bazında gruplanır. Hesap: reçete × sipariş/tahmini kişi × (1 + fire) − mevcut stok.
  - Satırda miktar değiştirme, kalem çıkarma ve kalem ekleme yapılabilir. Değişiklikler **sürümlü satınalma planına** (§3.7) yazılır ve menüyü değiştirmez.
  - Menü değişirse plan "güncel değil" rozetiyle yeniden hesaplanmayı önerir.
  - Buradan "Teklif iste" (Not 6) ve "Sipariş oluştur" aksiyonları çıkar.

### 2.5 AI öneri (Edge Function `menu-suggest`)
- Girdi: ay, müşteri, kap tipi, bütçe (kişi başı hedef maliyet), kurallar, son 60 günün geçmişi, mevsim, stoktaki SKT'si yakın ürünler (Not 5).
- Çıktı: yalnızca **öneri taslağıdır** (`monthly_menu_days` taslak sürümüne yazılır). Onay insandadır.
- **Deterministik yedek:** LLM anahtarı yoksa ya da bütçe dolduysa `rules.ts` tabanlı kural motoru çalışır. Bu motor etiket rotasyonuyla ve maliyet sınırıyla açgözlü (greedy) seçim yapar. Anahtar Supabase secrets'ta tutulur, **repo'ya girmez**.
- **AI harcama freni bu fazda kurulur:** `ai_budget` ve `ai_usage` tabloları (şema §15.3'te) 3D migration'ında oluşturulur ve Faz 8 bunları yeniden kullanır. Varsayılan sınırlar günlük $1, aylık $15, çağrı başı $0,10. Sınır dolunca kural motoru devreye girer.
- Maketteki "AI öneri kartı": "Bu hafta 3 kez tavuk var, 1'ini bakliyatla değiştir?" gibi öneriler. Kabul edilince uygulanır, istenirse geri alınır.

### 2.6 Kabul kriterleri
1. Genel ve müşteriye özel ay oluşturulabilir. Yayınlanınca `menu_plans` slotları dolar ve mevcut üretim/sipariş ekranları değişmeden o menüyü görür.
2. Sürükle-bırak taşıma ve kopyalama, gün/hafta kopyalama ve undo (en az 50 adım) çalışır.
3. Yasak kural ihlali olan ay yayınlanamaz (gerekçeli istisna hariç). Tekrar uyarısı görünür.
4. Satınalma modunda ihtiyaç paneli menü ve sipariş değiştikçe güncellenir. Satır içi düzenleme plan sürümüne yazılır.
5. Mobilde ajanda görünümü 390 px genişlikte yatay kaydırma olmadan çalışır.
6. vitest ile şunlar test edilir: `rules.ts` (yasak, gün yasağı, haftalık limit, 7 gün tekrar), undo yığını, ihtiyaç hesabı.

### 2.7 Alınan yöntemler
- Nutrislice: günlük/haftalık/aylık görünümler, alerjen filtresi, 5 yıldız puan. https://nutrislice.com/products/essentials/ · https://info.nutrislice.com/hubfs/General%20-%20How%20To%20Guide%20-%20Menus%20Features_v3.pdf
- JAMIX: sürükle-bırak döngü menüsü, menü planından satınalma siparişi, eMenu geri bildirimi. https://www.jamix.com/menu-management-software-system/
- Galley: günler ve döngüler arasında taşıma/kopyalama, Galley Assist (AI). https://support.galleysolutions.com/how-do-i-build-a-menu-plan · https://www.galleysolutions.com/galley-assist-for-menus
- Apicbase: kısıt ve mevsim tabanlı AI menü döngüsü. https://get.apicbase.com/menu-planning/

---

## 3) Not 2 — Terim birliği: "Hammadde" yerine **Stok kartı**

> **Nerede bağlanır:** Mevcut fazın hemen sonunda, 3E'ye başlamadan önce (tek commit). **Bağımlılık:** yok. **Kapsam dışı:** tablo, kolon ya da tip adlarını DB'de değiştirmek.
>
> **Ana promptla ilişki:** §4.1'deki "Hammadde kartları" sekme adı **bu ekle değişir:** "Stok kartları".
- Stok modülündeki `hammaddeler` sekmesinin adı **"Stok kartları"** olur. Rota `/stok/kartlar` şeklindedir ve eski `/stok/hammaddeler` yolu buraya **yönlendirilir** (alias, kırık link olmaz).
- Tüm ekran metinleri, rapor başlıkları ve bildirimler bu terimi kullanır. DB tablosu `ingredients` **yeniden adlandırılmaz**. Tip seviyesinde `StockItem` takma adı yeterlidir. Ana prompt §4.1'deki "Hammadde kartları" ifadesi de "Stok kartları" olarak okunur.
- Stok kartı kategorileri şunları kapsar: gıda, temizlik/deterjan, ambalaj/tek kullanımlık, gaz/yakıt, mutfak sarfı. Mevcut check listesi additive olarak genişletilir. Bunlar Not 16'daki müşteri sarf malzemeleri için gerekir.
- **Kabul:**
  1. `rg -i hammadde src` yalnızca yorum ve alias satırı döndürür. Kullanıcıya görünen metinlerde bu kelime geçmez.
  2. `/stok/hammaddeler` adresi `/stok/kartlar` adresine yönlenir (hash modunda da).
  3. Stok kartı formunda temizlik, ambalaj, gaz ve mutfak sarfı kategorileri seçilebilir.

---

## 4) Not 4 — Depolar, açılış sayımı, periyodik (15 gün) sayım, fark = zayiat (Faz 3E)

> **Nerede bağlanır:** Faz 3E (lotlar, depolar/etiketler, sayımlar, alias). **Bağımlılık:** `stock_movements`, `ingredients` (mevcut); 3E lot tablosu (aynı fazda önce lotlar). **Kapsam dışı:** barkod etiketi basma (yalnızca okuma).
>
> **Ana promptla ilişki:** §3.2 aynen geçerlidir. Bu bölüm sayım ve fark kurallarını **kesinleştirir**. Zayiatın gider sayılmaması §3.1 gereğidir.

### 4.1 İstek
- Birden çok depo olabilir: ana depo, soğuk oda, dondurucu, kuru gıda, temizlik ve araç.
- İlk kurulumda **açılış sayımı** yapılır, sonrasında **15 günde bir** sayım yapılır.
- Sayım ile sistem arasındaki fark zayiat olarak raporlanır. Aylık tüketim kategori bazında görülür.

### 4.2 Mevcut durum
`stock_movements` tablosunda `sayim` hareket tipi zaten var (delta olarak). §3.2 ve §8 3E lot, depo, etiket, sayım ve alias konularını kapsıyor. Bu not onları **somutlaştırır**.

### 4.3 Veri modeli
```sql
create table public.warehouses (id uuid pk default gen_random_uuid(), name text not null unique,
  kind text check (kind in ('ana','soguk','dondurucu','kuru','temizlik','arac','musteri')), vehicle_id uuid references public.vehicles(id),
  active boolean default true);
alter table public.stock_movements add column if not exists warehouse_id uuid references public.warehouses(id);
create table public.stock_counts (id uuid pk, warehouse_id uuid not null references public.warehouses(id),
  kind text not null check (kind in ('acilis','periyodik','spot')), blind boolean not null default true,
  status text not null default 'acik' check (status in ('acik','sayiliyor','onay','kapandi')),
  started_at timestamptz default now(), closed_at timestamptz, counted_by uuid[], approved_by uuid);
create table public.stock_count_lines (count_id uuid references public.stock_counts(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id), lot_id uuid null, expected_qty numeric, counted_qty numeric,
  variance_qty numeric generated always as (counted_qty - expected_qty) stored, unit_cost numeric, note text,
  primary key (count_id, ingredient_id, coalesce_lot));   -- lot yoksa tek satır
```

### 4.4 Kurallar
- **Kör sayım** varsayılandır: sayan kişi beklenen miktarı görmez. Onaylayan kişi farkı görür.
- Sayım kapanınca her fark satırı için tek bir `stock_movements(kind='sayim', delta)` kaydı düşer. Negatif fark "kontrolsüz tüketim / zayiat" olarak değerlenir (FIFO birim maliyetiyle). Zayiat **gider değildir**; §3.1 tek gider kuralı gereği gider satınalmada oluşur, zayiat yalnızca rapor ve KPI'dır.
- pg_cron her gün 08:00'de, son sayımı 15 günü geçmiş depolar için yönetici ve depo sorumlusuna bildirim oluşturur.
- Açılış sayımı yapılmamış depoda stok çıkışı yapılabilir ama "açılış sayımı bekleniyor" uyarısı gösterilir.
- Görünüm `v_monthly_usage_by_category`: ay × kategori × depo bazında giriş, çıkış, sevk, fire, sayım farkı ve TL karşılığı.

### 4.5 Ekranlar
- Stok > **Sayımlar**: liste, yeni sayım sihirbazı (depo + tür) ve mobil sayım ekranı. Mobil ekranda raf sırasıyla ilerlenir, büyük sayı klavyesi ve barkod/QR kullanılır, çevrimdışı taslak tutulur.
- Stok > **Raporlar**: iki sayım arası fark raporu, en çok fark veren 10 kalem, kategori bazlı aylık tüketim.

### 4.6 Kabul
1. Kör sayımda sayan kişi beklenen miktarı görmez.
2. Kapanışta hareketler oluşur ve stok eşitlenir.
3. Fark raporu TL karşılığını gösterir.
4. 15 gün hatırlatması oluşur.

### 4.7 Kaynaklar
- Apicbase fark analizi ve depolama lokasyonları: https://support.apicbase.com/help/how-can-i-analyze-my-inventory-count-variance · https://support.apicbase.com/help/which-items-had-the-most-stock-variance-in-a-certain-period · https://support.apicbase.com/help/create-storage-locations-per-outlet
- MarketMan storage areas / shelf-to-sheet sayım ve sayım denetimi: https://mealticket.my.site.com/helpcenter/s/article/StorageareasandShelftoSheetinventorycounts65d62cb18f4e9?language=en_US · https://mealticket.my.site.com/helpcenter/s/article/MarketMan-Inventory-Actions-Inventory-Counts-Audit

---

## 5) Not 5 — SKT / FEFO, haftalık SKT bildirimi, onaylı imha (Faz 3E)

> **Nerede bağlanır:** Faz 3E, Not 4'ten hemen sonra. **Bağımlılık:** 3E lot tablosunda `expiry_date`; §3.8 onay politikaları. **Kapsam dışı:** tedarikçiye iade süreci.
>
> **Ana promptla ilişki:** §3.2'deki FIFO **bu ekle FEFO-önce-FIFO** olarak değişir (yalnızca seçim sırası; maliyet yine lot maliyetidir).

### 5.1 Kurallar
- Lotlarda `expiry_date` alanı vardır (§3.2 lot yapısı). `consume_stock` seçim sırası şöyledir: önce **FEFO** (en yakın SKT), eşitlikte FIFO. Maliyet yine lotun kendi maliyetidir.
- pg_cron her **pazartesi 08:00**'de SKT'si 7 gün içinde dolacak ve dolmuş lotların listesini bildirim olarak gönderir. Liste depo sorumlusuna, aşçıbaşına ve yöneticiye gider. SKT'si yakın ürünler AI menü önerisine (§2.5) "öncelikli kullan" girdisi olarak verilir.
- **İmha:**
  - İmha kaydı `stock_disposals` tablosuna yazılır (lot, miktar, neden: skt/bozulma/kontaminasyon/diğer, fotoğraf, talep eden, onaylayan).
  - Onay politikası `stok_imha` uygulanır (yönetici).
  - Onaylanınca `stock_movements(kind='fire', source='imha')` kaydı düşer.
  - Kayıt **değiştirilemez**: update/delete yok, iptal ters kayıtla yapılır, audit tutulur.
  - **Gider yazılmaz** (§3.1). Yalnızca fire KPI'sına ve aylık tüketim raporuna girer.

### 5.2 Kabul
1. FEFO seçimi test edilir (vitest + SQL).
2. Onaysız imha stoktan düşmez.
3. İmha kaydı düzenlenemez.
4. Haftalık bildirim oluşur.

### 5.3 Kaynaklar
- FEFO ve SKT takibi: https://fiddle.io/solutions/expiration-tracking · https://www.fastinventorysoftware.com/food-beverage-inventory-software
- MarketMan waste events: https://mealticket.my.site.com/helpcenter/s/article/Wasteevents65d6296176133

---

## 6) Not 6 — Tedarikçi teklif isteme (RFQ): tokenlı link, karşılaştırma, onay, PO (Faz 3F, **MUST**)

> **Nerede bağlanır:** Faz 3F, sürümlü satınalma planından sonra. **Bağımlılık:** §3.7 plan sürümleri, `suppliers`, `supplier_categories`, `purchase_orders`, `ingredient_prices` (mevcut), §3.8 onay. **Kapsam dışı:** tedarikçi hesabı/girişi, e-fatura.
>
> **Ana promptla ilişki:** §8 3F'deki "tokenlı tedarikçi teklif linki (SHOULD)" **bu ekle MUST olur.**

### 6.1 Akış
1. Satınalma planından (§3.7, takvimin satınalma modu) kalemler seçilir ve **"Teklif iste"** tıklanır. Kalemler, tedarikçi kategorisine göre önerilen tedarikçilere gönderilir.
2. Her tedarikçiye **tokenlı, girişsiz link** gider: `/#/teklif/<token>` (hash router, Not 8 notuna bakın). Gönderim WhatsApp, e-posta veya kopyala ile yapılır.
3. Tedarikçi linkte kalem bazında birim fiyat, marka, teslim tarihi, minimum miktar, not ve geçerlilik girer. Kısmi teklif verebilir. Göndermeden önce taslak kaydedebilir. Son tarih geçince link salt okunur olur.
4. Yönetici veya satınalma **karşılaştırma matrisini** görür: kalem × tedarikçi, en düşük fiyat vurgusu, son alış fiyatı (`ingredient_prices`) ile fark ve teslim süresi. Kalem bazında kazanan seçilir (bölünmüş sipariş olabilir).
5. Kazananlar onaya gider (`approval_policies: satinalma_teklif`, tutar eşiği). Onaylanınca **PO** (`purchase_orders`) oluşur. Teklif fiyatı `ingredient_prices` tablosuna "teklif" kaynağıyla yazılır.

### 6.2 Veri modeli
```sql
rfq_requests(id, title, due_at, status taslak|gonderildi|kapandi|iptal, plan_version_id, created_by, created_at)
rfq_lines(id, rfq_id, ingredient_id, qty, unit, needed_by, note)
rfq_invites(id, rfq_id, supplier_id, token uuid unique default gen_random_uuid(), sent_via, opened_at, submitted_at, revoked_at)
rfq_quotes(id, invite_id, line_id, unit_price, brand, lead_days, min_qty, valid_until, note, is_awarded bool)
```
- Tedarikçi tarafı **yalnızca security-definer RPC'lerle** çalışır: `rfq_portal_info(token)`, `rfq_portal_save(token, lines jsonb, submit bool)`. `anon` rolü tablolara doğrudan erişemez. Token iptal edilebilir. Hız sınırı uygulanır (token başına dakikada 30 çağrı). Tedarikçi diğer tedarikçilerin fiyatlarını asla göremez.
- Mevcut `supplier_quotes` tablosu **korunur ve taşınmaz**: RFQ dışı elle girilen teklifler orada kalır. Karşılaştırma ekranı ikisini `v_supplier_offers` görünümüyle (union) okur.

### 6.3 Kabul
1. Tokenlı link girişsiz açılır.
2. Başka bir token ile başka bir teklife erişilemez (SQL testi).
3. Son tarihten sonra kayıt yapılamaz.
4. Kazanan seçimi → onay → PO zinciri çalışır.
5. Karşılaştırma matrisi mobilde kalem kartlarına dönüşür.

### 6.4 Kaynaklar
- AuraVMS girişsiz teklif portalı: https://www.auravms.com/supplier-quote-response-portal
- Tradogram teklif karşılaştırma → PO: https://www.tradogram.com/sourcing-management
- Çözbim E-Talep (§11.4)

---

## 7) Not 7 + 9 — Müşteri portalı v2: aylık menü, geri bildirim, puan, canlı bakiye (Faz 3D, 4)

> **Nerede bağlanır:** Menü ve geri bildirim sekmeleri Faz 3D'de. Bakiye sekmesi Faz 4'te (cari hareketleri geldikten sonra); 3D'de sekme "Faz 4'te açılacak" boş durumuyla görünür. Sarf sekmesi Faz 5'te (Not 16).
>
> **Bağımlılık:** Not 1 (yayınlanmış ay), Not 8 (`customer_portal_tokens`), Faz 4 cari görünümü (`v_customer_balances`).
>
> **Kapsam dışı:** online ödeme.
>
> **Ana promptla ilişki:** §5.C #12 aynen geçerlidir; bu bölüm portal sekmelerini ve PIN kuralını **ekler**.

### 7.1 Portal içeriği
- Mevcut `/siparis/:token` portalı (6 günlük kişi sayısı girişi, bir gün önce 16:00 kesim) **korunur**. Üstüne sekmeler eklenir:
  - **Sipariş:** mevcut ekran.
  - **Aylık menü:** `<MonthMenuCalendar readOnly>`, müşterinin yayındaki ayı ve genel menü.
  - **Geri bildirim.**
  - **Bakiye.**
  - **Sarf malzemesi** (Not 16).
- **Geri bildirim** tablosu `customer_feedback` (customer_id, menu_date, meal, recipe_id null, kind, rating 1–5 null, text, photo_path, status yeni|incelendi|cozuldu, handled_by). Kind değerleri:
  - `revizyon`: bu yemeği değiştirin.
  - `oneri`
  - `sikayet`: 3D'deki hassasiyet/şikâyet akışına bağlanır.
  - `begeni`

  Kayıt düşünce **`yonetici` ve `asci_basi`** Realtime bildirim alır. Ayrı bir diyetisyen rolü eklenmez; diyetisyen `asci_basi` rolüyle çalışır. Her servis gününden sonra portalda 5 yıldız puan ve tek tıkla "beğendik / beğenmedik" kutusu gösterilir. Müşterinin puan vermesi zorunlu değildir.
- Puanlar menü mühendisliği matrisine (§8 Faz 7 SHOULD) popülerlik girdisi olarak akar.
- **Bakiye (Not 9):**
  - Görünen kalemler: faturalanmamış teslimatlar (irsaliye toplamı), faturalanmış açık bakiye, vadesi gelen ve son ödemeler.
  - **Yalnızca** müşteri girişiyle (`musteri` rolü) ya da sipariş linkinde müşteri **PIN**'i ile görünür. PIN `customer_portal_tokens.pin_hash` alanında bcrypt ile tutulur, 5 hatalı denemede 15 dakika kilitlenir.
  - PIN olmadan sadece token ile bakiye **asla** görünmez.
  - Bakiye elle yazılmaz; defterden türetilir (G-1).

### 7.2 Kabul
1. Geri bildirim kaydı bildirim üretir.
2. Token ile bakiye görünmez, PIN veya girişle görünür.
3. Müşteri başka bir müşterinin menüsünü veya bakiyesini göremez (RLS/RPC testi).

---

## 8) Not 8 — "Müşteri sipariş linki nerede?" (cevap + küçük iş)

> **Nerede bağlanır:** "Sipariş linki" sekmesi **hemen** yapılır (mevcut fazın sonunda, küçük iş). `customer_portal_tokens` ve `musteri` rolü ataması Faz 3D'de. **Bağımlılık:** `customers.order_token` (mevcut). **Kapsam dışı:** mevcut `portal_info` / `portal_set_order` RPC imzalarını değiştirmek.

**Cevap (kod incelemesiyle doğrulandı):**
- Her müşterinin otomatik bir linki var. Token kaynağı `customers.order_token uuid default gen_random_uuid()` (unique). Kaynak migration: `supabase/migrations/20260926202527_customer_order_link.sql`.
- Canlı Render derlemesi **hash router** kullanıyor (`VITE_ROUTER=hash`). Bu yüzden çalışan link şu:
  **`https://trakya-catering.onrender.com/#/siparis/<order_token>`**
  `#` olmadan yazılan `/siparis/...` yolu uygulamayı açar ama router bu yolu yakalamaz.
- **Arayüzde linki gösteren ya da kopyalayan bir yer yok.** Şu an linki almanın tek yolu Supabase'de `select name, order_token from customers order by name;` sorgusunu çalıştırmak.
- `musteri` rolüyle giriş yapan kullanıcı şu an `PortalComingSoon` ekranını görüyor ("Portal, sipariş modülüyle birlikte açılıyor").

**Yapılacaklar (hemen, küçük iş; BACKLOG'daki ⏳ maddesi):**
1. Cari > müşteri detayına **"Sipariş linki"** sekmesi eklenir. İçerik:
   - Tam link. Router moduna göre üretilir; `import.meta.env.VITE_ROUTER === 'hash'` ise `#/` eklenir.
   - **Kopyala** düğmesi.
   - **WhatsApp ile gönder** düğmesi: `https://wa.me/<müşteri tel>?text=` ve hazır metin.
   - **QR** (PNG indir, yazdırılabilir).
   - **Linki yenile**: eski token geçersiz olur, onay istenir, audit kaydı düşer.
   - Son kullanım zamanı.
2. Faz 3D'de `customer_portal_tokens` (customer_id, token, pin_hash, expires_at null, revoked_at, last_used_at) tablosu gelir. `order_token` ondan beslenir (geriye uyumlu).
3. Ekip ekranında `musteri` rolü atanabilir hale gelir (TeamPage'deki "Faz 3" notu). Müşteri giriş yaptığında `PortalComingSoon` yerine portal v2 açılır.

**Kabul:**
1. Yönetici, müşteri detayındaki "Sipariş linki" sekmesinden linki tek tıkla kopyalar. Link hash modunda `/#/siparis/<token>` biçimindedir ve açıldığında sipariş ekranı gelir.
2. WhatsApp düğmesi müşterinin telefonuna hazır metinle açılır. Telefon yoksa düğme pasif görünür ve "telefon ekleyin" ipucu gösterir.
3. QR PNG olarak indirilir ve okutulunca aynı linke gider.
4. "Linki yenile" işleminden sonra eski link "geçersiz link" ekranı verir, yeni link çalışır. İşlem audit kaydına düşer.
5. `musteri` rolüne atanmış kullanıcı giriş yapınca portal v2'yi görür (3D'de).

---
## 9) Not 10 — KDV tahakkuku: "bekleyen KDV" yükümlülüğü (Faz 4)

> **Nerede bağlanır:** Faz 4 (cari/kasa/çek). **Bağımlılık:** `sales_invoices`, `purchase_invoices` KDV alanları, `finance_entries`, `finance_categories` (mevcut). **Kapsam dışı:** beyanname dosyası üretimi ve GİB entegrasyonu.
>
> **Ana promptla ilişki:** §3.1 ve §3.9 aynen geçerlidir; KDV ödemesi gider değil "vergi ödemesi" kategorisidir. Bu ek bunu **kesinleştirir**.

- **Kural:**
  - Satış faturasındaki hesaplanan KDV (391) ile alış faturasındaki indirilecek KDV (191) farkı her ay **tahakkuk eder** ve "bekleyen KDV" yükümlülüğü olur (360 Ödenecek Vergi mantığı).
  - Devreden KDV (190) sonraki aya taşınır.
  - Tahakkuk **gider değildir**. Kasa/bankadan düşen **ödeme anında** vergi ödemesi olarak kaydedilir; bu ödeme `finance_entries` içinde gider kategorisinde değil, "vergi ödemesi" kategorisinde durur. KDV gelir-gider tablosunu şişirmez (§3.1 ile tutarlı).
- **Veri:**
  - `tax_obligations` tablosu: period, kind (kdv|muhtasar|sgk|gecici), hesaplanan, indirilecek, devreden_onceki, devreden_sonraki, odenecek, due_date, status (tahakkuk|odendi|gecikti), paid_entry_id.
  - Hesaplama RPC'si: `accrue_vat(p_period)`. Kaynaklar `sales_invoices` ve `purchase_invoices` KDV alanları.
- **Hatırlatma:**
  - KDV-1 ve muhtasar için her ayın **28'i**, KDV-2 için **25'i** (tevkifatlı işlemler).
  - Örnek: Ağustos 2026 dönemi 28 Eylül 2026'da vadelenir.
  - Hatırlatmalar 5 gün ve 1 gün önce Kasa & vadeler kartına ve bildirimlere düşer.
- **Ekran:** Finans > **Vergiler**. Ay bazında KDV özeti (391 / 191 / devreden / ödenecek) ve "Ödendi" düğmesi (hesap seçilir, finance_entry oluşur).
- **Kabul:**
  1. `accrue_vat` bilinen satış ve alış KDV'siyle doğru `odenecek` ve `devreden` değerlerini üretir (SQL testi).
  2. Tahakkuk gelir-gider raporunda görünmez.
  3. "Ödendi" işlemi seçilen hesabın bakiyesini düşürür ve kaydı "vergi ödemesi" kategorisine yazar.
  4. Devreden KDV sonraki ayın hesabına girer.
  5. Vadeden 5 gün ve 1 gün önce bildirim oluşur.
- **Kaynaklar:** http://www.muhasebedersleri.com/genel-muhasebe-2/kdv-tahakkuk.html · https://vergidosyasi.com/2021/04/19/360-odenecek-vergi-ve-fonlar-hesabi-isleyisi-muhasebe-kayit-ornegi/ · https://defteran.com/kaynaklar/vergi-takvimi · https://www.alobilgi.com.tr/eylul-2026-kdv-takvimi-25-ve-28-eylul-tarihlerine-dikkat

---

## 10) Not 11 — Gerçekçi banka / kasa / kredi kartı bakiyeleri ve mutabakat (Faz 4)

> **Nerede bağlanır:** Faz 4, Not 10 ile aynı fazda ondan önce. **Bağımlılık:** `finance_accounts`, `finance_entries`, `cheques` (mevcut). **Kapsam dışı:** canlı banka API'si (ÖHVPS 🔌, sonraki sürüm).

- **Hesaplar:** `finance_accounts` içinde kasa, banka ve **kredi kartı** bulunur. Kredi kartı hesabı **eksi bakiyeli borç hesabı** olarak tutulur ve kesim tarihi, son ödeme tarihi, limit alanlarına sahiptir. Bakiye = açılış + hareketler; asla elle yazılmaz (G-1).
- **Bağlayıcı soyutlaması** `bank_connectors`: kind alanı manual | csv | excel | mt940 | camt053 | ohvps. İlk sürümde **manual + CSV/Excel** çalışır. Her banka için kolon eşleme şablonu kaydedilir (tarih, açıklama, tutar, bakiye). MT940/CAMT.053 ayrıştırıcı SHOULD önceliğinde. TCMB ÖHVPS/HBH (açık bankacılık) daha sonra, 🔌 işaretiyle gelir.
- **Ekstre satırları** `bank_statement_lines` tablosunda tutulur: account_id, date, amount, description, balance_after, external_ref, hash (tekrar içe aktarmayı engeller), matched_entry_id, status (eslesmedi|onerildi|eslesti|yok_sayildi).
- **Eşleştirme kuralları** (`bank_match_rules`, sırayla uygulanır):
  1. Tutar ve tarih ±2 gün tutuyorsa ve açıklamada cari adı ya da IBAN geçiyorsa **öneri** üretilir.
  2. Çek numarası `cheques` ile eşleşirse öneri üretilir.
  3. Kural tabanlı otomatik kategorilendirme (örn. "HGS" → araç gideri, "POS komisyon" → banka masrafı).

  Kullanıcı onaylayınca eşleşme yapılır. Eşleşmeyen satırdan tek tıkla `finance_entry` oluşturulur.
- **Mutabakat ekranı** Finans > Hesaplar > [hesap] > **Mutabakat** altında: sol tarafta ekstre, sağ tarafta sistem kayıtları, üstte "ekstre bakiyesi vs sistem bakiyesi" farkı. Fark sıfır olunca dönem kilitlenir.
- **Kabul:**
  1. Aynı CSV ikinci kez içe aktarıldığında yeni satır oluşmaz (hash).
  2. Kredi kartı hesabının borcu eksi bakiye olarak görünür.
  3. Tutar ve tarih ±2 gün tutan satır için eşleştirme önerisi çıkar.
  4. Mutabakat farkı = ekstre bakiyesi − sistem bakiyesi doğru hesaplanır. Fark sıfır olunca dönem kilitlenir, kilitli döneme kayıt eklenemez.
- **Kaynaklar:**
  - Paraşüt banka mutabakatı ve entegrasyonu: https://www.parasut.com/kullanim-kilavuzu/banka-mutabakati-yapmak · https://www.parasut.com/banka-entegrasyonu
  - D365 eşleştirme kuralları: https://learn.microsoft.com/en-us/dynamics365/finance/cash-bank-management/set-up-bank-reconciliation-matching-rules · https://learn.microsoft.com/en-us/dynamics365/finance/cash-bank-management/advanced-bank-reconciliation-overview
  - TCMB ÖHVPS rehberi: https://tcmb.gov.tr/wps/wcm/connect/d60cc679-ce04-4941-b310-b3788b6f3540/%C3%96HVPS-Rehber-2023-04-30.pdf?MOD=AJPERES
  - BKM GEÇİT: https://bkm.com.tr/urunler-ve-hizmetler/odeme-hizmetleri-veri-paylasim-servisleri/

---

## 11) Not 12 — Logo (hemen, bağımsız küçük iş; Faz 7'de marka kiti)

> **Nerede bağlanır:** **Hemen**, mevcut fazın sonunda, bağımsız tek commit. Faz 7'deki marka kiti ve antet işleri bu dosyaları kullanır. **Bağımlılık:** yok. **Kapsam dışı:** renk token'larını değiştirmek (§6 aynen geçerli).

- Klasör `logo/` içinde 3 seçenek var:
  1. **Kapaklı servis (cloche) + başak** (serif "Trakya" + "CATERING"). **Varsayılan budur.**
  2. **TC monogram** (tabak halkası C + çatal).
  3. **Ayçiçeği tabak + çatal bıçak** ("trakya catering").
- Kullanıcı başka bir seçenek seçerse o uygulanır. Seçim gelene kadar Seçenek 1 kullanılır.
- **Uygula:**
  - `public/logo.svg` ← `logo-1-yatay.svg`
  - `public/logo-mark.svg` ← `logo-1-ikon.svg`
  - `public/favicon.svg` ve `favicon-16/32/48.png`, `apple-touch-icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` ← `logo/pwa-secenek-1/`
  - `index.html` içine `<link rel="icon" …>`, `apple-touch-icon` ve `manifest` eklenir. theme-color #B4432A kalır.
  - `public/manifest.webmanifest`: name "Trakya Catering", short_name "Trakya", background #FBF8F2, theme #B4432A, display standalone. İkonların biri `purpose: "maskable"` olur.
  - `src/ui/Logo.tsx` yeni SVG'yi kullanır (varyantlar: `full`, `mark`, `dark`). Sidebar dar modda `mark` gösterir. Giriş ekranında büyük `full` görünür. Raporlarda (`ReportFrame`) ve PDF antetinde de bu logo kullanılır.
- Metinler SVG'de path'e çevrildi; yazı tipi bağımlılığı yok. Koyu tema için `-yatay-koyu.svg` kullanılır.
- **Kabul:**
  1. Tarayıcı sekmesinde yeni favicon görünür.
  2. iOS "Ana ekrana ekle" 180 px ikonu kullanır.
  3. Android maskable ikon kırpılmadan görünür.
  4. Sidebar (geniş ve dar), giriş ekranı ve rapor anteti yeni logoyu gösterir.
  5. Lighthouse "installable" koşulu sağlanır.

---

## 12) Not 13 — Girişsiz iletişim sayfası (hemen, bağımsız küçük iş)

> **Nerede bağlanır:** **Hemen**, Not 12'den hemen sonra ayrı bir commit olarak. **Bağımlılık:** Not 12 logosu (sayfada logo zaten satır içi SVG olarak var). **Kapsam dışı:** iletişim formu ve e-posta gönderimi.

- `iletisim.html` hazır ve kendi içinde çalışıyor. İçinde logo, telefon, WhatsApp, e-posta, adres, harita linki, hizmetler, hizmet bölgeleri, **vCard indir** düğmesi, JSON-LD `FoodEstablishment` ve kaydırınca beliren alt "Ara / WhatsApp" çubuğu var.
- **Yerleşim (karar: (a)):**
  - (a) `public/iletisim.html` olarak statik dosya. Render'da `https://trakya-catering.onrender.com/iletisim.html` adresinden girişsiz açılır.
  - (b) Uygulama içinde girişsiz `/iletisim` rotası. Hash modunda `/#/iletisim` olur. App.tsx'teki `/siparis/:token` gibi auth kapısından önce eşlenir.

  Uygulanacak olan (a)'dır. (b) yapılmaz. Uygulama içinde "İletişim kartı" linki olarak da verilir.
- **Doğrulanmış bilgiler** (trakyacatering.com, Yandex):
  - Tel/WhatsApp: **0505 036 49 36** (+905050364936)
  - E-posta: **info@trakyacatering.com**
  - Hizmetler: Kurumsal catering, Davet ve organizasyon, Günlük sıcak yemek, Kahvaltı ve ikram, Yerinde servis desteği, Özel menü çalışması
  - Bölgeler: Çatalca (İzzettin, Ferhatpaşa, Muratbey), Silivri, Beylikdüzü, Büyükçekmece, Çerkezköy
- **Adres uyuşmazlığı var:** sitede "İzzettin, Umut Sok. No: 4, 34540 Çatalca / İstanbul", Yandex'te "Kaleiçi Mah., Köprü Sok. 4A, Çatalca" yazıyor. Varsayılan olarak sitedeki adres kullanılır. Doğru adres §10 açık sorular düzeninde faz raporunda sorulur, iş durmaz.
- **Eksik olanlar** (sayfada kesik çizgili "EKLENECEK" rozetleriyle işaretli): Instagram kullanıcı adı (doğrulanmadı), Google Business profil linki, çalışma saatleri. Bu değerler `company_settings` alanlarına yazılınca sayfa güncellenir. Statik sürümde bilgiler dosya başındaki yorum bloğunda listelenmiş; HTML ve JSON-LD içindeki ilgili yerler değiştirilir. Uygulama içi sürüm `company_settings`'ten okur.
- **Kabul:**
  1. Oturum açmadan `https://trakya-catering.onrender.com/iletisim.html` adresi 200 döner.
  2. Mobilde "Ara" `tel:+905050364936`, "WhatsApp" `https://wa.me/905050364936` açar.
  3. vCard dosyası iPhone ve Android rehberine eklenir.
  4. JSON-LD, Google Rich Results testinde hatasız geçer.
  5. 390 px genişlikte yatay kaydırma olmaz.

---
## 13) Not 15 — Personel ödemeleri + kartvizit, Filo, **Canlı ekranlar ilkesi G-1**

> **Nerede bağlanır:**
> - G-1 kesişen kuraldır. **Bu ekin onaylandığı andan itibaren yapılan her fazın** kabul kriterine eklenir.
> - 15a (personel) Faz 6'da yapılır.
> - 15b (filo) Faz 5'te yapılır.
>
> **Bağımlılık:**
> - 15a için `employee_ledger`, `finance_accounts` ve `finance_entries` gerekir (hepsi mevcut) ve Faz 4'teki hesap bakiyeleri kuralı geçerlidir.
> - 15b için `vehicles`, `vehicle_logs` ve `routes` gerekir (mevcut). Ayrıca Faz 3E'nin `warehouses` tablosunda `arac` tipi olmalıdır; bu Not 16 için gereklidir.
>
> **Kapsam dışı:**
> - Bordro/SGK beyannamesi üretimi (yalnızca tutar kaydı tutulur).
> - Araç takip cihazından (Arvento/Mobiliz) canlı konum. Bu 🔌 olarak kalır, ana prompt §5.C #7 geçerlidir.

### 13.1 G-1 — Canlı ekranlar ilkesi (bağlayıcı, ana promptu **genişletir**)
1. **Kasa, banka, kredi kartı, personel bakiyesi, araç gider/km toplamı, müşteri cari bakiyesi ve stok miktarı hiçbir yerde elle yazılmaz.** Hepsi defterden (ledger) türetilir. Kaynaklar: `finance_entries`, `employee_ledger`, `vehicle_logs`, müşteri cari hareketleri, `stock_movements`. Türetme yeri SQL görünümü ya da RPC'dir (`v_account_balances`, `v_employee_balances`, `v_vehicle_month`, `v_customer_balances`, `v_stock_on_hand`). Açılış bakiyesi yalnızca bir "açılış" hareketi olarak girilir.
2. Bu tablolar `supabase_realtime` yayınına eklenir: `finance_entries`, `employee_ledger`, `attendance_days`, `vehicle_logs`, `stock_movements`, `meal_orders`, `delivery_notes`, `customer_feedback` ve bu ekteki yeni hareket tabloları.
3. İstemcide tek bir `useLiveInvalidate(table, queryKeys[])` kancası (`src/lib/realtime.ts`) kullanılır. Bu kanca Realtime değişikliğinde ilgili TanStack Query anahtarlarını **invalidate eder**. Doğrudan state yamalamak yok. Kanal adları tablo bazındadır, bileşen unmount olunca kanal kapatılır.
4. **Kabul (her faz için):**
   - (a) Bir sekmede yapılan kayıt, aynı ekranı açık tutan ikinci oturumda sayfa yenilemeden en geç 3 saniyede görünür (Playwright iki bağlamla test edilir).
   - (b) Bakiye kolonları için `update ... set balance` benzeri kod yoktur (`rg` kontrolü).
   - (c) Görünüm toplamı hareket toplamına eşittir (SQL testi).

### 13.2 15a — Personel ödemeleri ve personel kartviziti (Faz 6)
- **Ödeme türleri:** maaş, avans, yevmiye, prim, kesinti ve ödeme. Mevcut `employee_ledger` kind değerleri (hakedis/prim/avans/kesinti/odeme) korunur, `yevmiye` hakediş alt tipi olarak eklenir (`subkind`).
  - Ödeme bir hesaptan (`account_id`: kasa/banka) yapılır ve mevcut `sync_ledger_entry` trigger'ı ile `finance_entries` kaydını oluşturur. Maaş gideri bu kayıttır (§3.1 tek gider).
  - Avans gider değildir; alacak olarak tutulur ve sonraki hakedişten mahsup edilir.
- **Yevmiye akışı:** `attendance_days` kaydı (geldi/yarım/gelmedi) ve günlük ücret otomatik `hakedis/yevmiye` satırı üretir. Yoklama düzeltilirse satır da güncellenir (trigger, idempotent).
- **Kartvizit** (maket: `kartvizit-mockup.html`, sol kart). İçerik:
  - Trakya logolu başlık, fotoğraf, ad, görev, telefon (tel:/WhatsApp).
  - **Canlı bakiyeler:** Bu ay hak edilen / Ödenen / Kalan / Avans bakiyesi.
  - Bu ayın yoklama şeridi (gün kareleri).
  - Son 10 hareket akışı.
  - Hızlı aksiyonlar: "Avans ver", "Ödeme yap", "Yevmiye gir".

  Kart Personel listesinde çekmece olarak açılır. Mobilde tam ekran açılır.
- **RLS:** Maaş, IBAN, TCKN ve bakiye alanlarını **yalnızca `yonetici` ve `muhasebe`** görür. Diğer roller kartı bu alanlar maskelenmiş halde görür (kilit ikonu). Her personel kendi kartını görür. Hassas olmayan alanlar `employee_directory` üzerinden okunur. Hassas alanlar `employees` tablosunda kalır ve RLS ile yalnızca `yonetici`, `muhasebe` ve kişinin kendisi tarafından okunur. Mevcut yapı korunur.
- **Kabul:**
  1. Yoklama girilince kart 3 saniye içinde güncellenir (G-1).
  2. Ödeme kasa bakiyesini düşürür.
  3. `sofor` rolü başka bir personelin maaşını ve IBAN'ını göremez (RLS testi).
  4. Avans gider raporunda görünmez.

### 13.3 15b — Filo (Faz 5)
- **Araç başına:**
  - Aylık km (km okumalarından fark, `vehicle_logs kind='km'`).
  - Rota ataması (bkz. Not 16).
  - Gider girişi: yakıt, **HGS/köprü-otoyol**, bakım, onarım, lastik, sigorta, muayene, ceza ve diğer. `vehicle_logs.kind` check listesi additive olarak genişletilir, `hgs` ve `onarim` eklenir. Gider mevcut senkronla `finance_entries` tablosuna düşer (source='arac').
- **Tarihler ve hatırlatma:**
  - Muayene (`inspection_due`), sigorta/kasko (`insurance_due`, `kasko_due` eklenir), bakım (`service_every_km` ile son bakım km'si karşılaştırılır).
  - pg_cron her gün 08:00'de 30, 7 ve 1 gün kala bildirim üretir. Bakım km'sine 500 km kala da bildirim üretir.
- **Belgeler:**
  - Storage bucket `vehicle-documents` (private). Belge türleri: ruhsat, sigorta poliçesi, kasko, muayene raporu, fatura.
  - Tablo `vehicle_documents` (vehicle_id, kind, path, valid_until, uploaded_by).
  - Personel için de aynı yapı kurulur: bucket `employee-documents` (private) ve tablo `employee_documents`. Belge türleri: kimlik, sözleşme, sağlık raporu, ehliyet, SRC.
  - İndirme imzalı URL ile yapılır (60 sn).
- **Araç kartviziti** (maket sağ kart):
  - Plaka (TR plaka görünümü), marka/model, **atanmış şoför** (avatar + telefon), bugünkü rota ve müşteri sayısı.
  - Km sayacı.
  - Muayene/sigorta/bakım çipleri: yeşil = 30 günden fazla, sarı = 30 gün ve altı, kırmızı = gecikmiş.
  - Bu ay km / gider / **km başı maliyet**.
  - Gider dağılımı (yakıt, HGS, bakım…).
  - Belgeler.
  - Hareket akışı.
- **Kabul:**
  1. Gider girişi kasa/banka bakiyesini ve araç aylık giderini canlı günceller.
  2. Muayeneye 7 gün kalan araç için bildirim oluşur.
  3. Belge yalnızca `yonetici` ve `muhasebe` tarafından yüklenir. Şoför kendi aracının belgelerini görür.
  4. Km başı maliyet = ay gideri ÷ ay km (sıfıra bölme durumunda "—" gösterilir).

---

## 14) Not 16 — Şoför·araç·rota·müşteri, müşteri mutfak sarf malzemeleri, tüketim ortalaması, harita

> **Nerede bağlanır:**
> - Rota, sarf malzemesi ve tüketim: **Faz 5**.
> - Pazarlama harita katmanı ve aday (lead) teklif hattı: **Faz 8A**.
>
> **Bağımlılık:**
> - Not 2 (sarf kategorileri stok kartında olmalı).
> - Not 4 (`warehouses`: `arac` ve `musteri` tipleri).
> - Faz 4 müşteri cari hareketleri.
> - Not 7 portal v2 (sekme yeri).
>
> **Kapsam dışı:**
> - Araçtan canlı GPS (🔌).
> - Tam otomatik rota optimizasyonu zorunlu değildir. İlk sürümde sıralama elle sürüklenir. Optimizasyon düğmesi ORS/VROOM ile SHOULD önceliğindedir.

### 14.1 Şoför · araç · rota · müşteri
- `routes` genişletilir: `vehicle_id`, `driver_id`, `weekday[]` (hangi günler), `active`.
- `stops jsonb` alanı yerine normalize **`route_stops`** tablosu kullanılır (route_id, seq, customer_id | lead_id, planned_time, service_minutes). §5.C #7'deki öneri bu şekilde kesinleşir. Mevcut `stops` verisi migration ile taşınır, kolon silinmez ve okunmaz olarak işaretlenir.
- Araç kartında ve Lojistik > Rotalar ekranında görünenler: "Şoför X · Araç 34 ABC 123 · Rota Silivri-Sabah · 7 müşteri (liste)".
- Şoför uygulaması (mobil): bugünün durakları sırayla, her durakta "Navigasyon" (Google Maps / Yandex Navi derin linki, §5.C #7), "Teslim ettim" (irsaliye) ve "Sarf teslimi" (aşağıda).

### 14.2 Müşteri mutfak sarf malzemeleri (deterjan, tek kullanımlık, tüp gaz…)
- **`customer_supply_items`** (customer_id, ingredient_id [stok kartı], billing: `fiyata_dahil` | `ayri_faturali`, unit_price null, par_level [hedef stok], active).
- **Portal siparişi:** Müşteri portalın "Sarf malzemesi" sekmesinde eksikleri seçer ve `supply_requests` kaydı oluşur (customer_id, lines jsonb, status yeni|yolda|teslim|iptal). Rotadaki şoföre ve depoya bildirim gider. Talep, müşterinin bir sonraki rota durağına bağlanır.
- **Teslim (şoför):** Durakta "Sarf teslimi" ekranı açılır.
  1. Şoför cariyi seçer (durağın müşterisi otomatik gelir), kalemleri ve miktarları girer.
  2. Kaydedince araç deposundan (`warehouses.kind='arac'`) `stock_movements(kind='sevk', source='sarf_teslim')` kaydı düşer.
  3. **Ayrı faturalı** kalemler müşteri cari hareketine borç olarak yazılır (birim fiyat × miktar) ve fatura kuyruğuna girer.
  4. **Fiyata dahil** kalemler cariye yazılmaz, yalnızca müşteri maliyet raporuna girer (§3.6 müşteri kârlılığı).
  5. Talep status değeri `teslim` olur.
- **Tüketim ortalaması ve öneri:** `v_customer_supply_usage` görünümü müşteri × kalem × ay teslim miktarını ve **son 3 ayın ortalamasını** verir. Müşteri kartında ve portalda "Tahmini ihtiyaç" gösterilir: ortalama ve son teslimden bu yana geçen gün ile par_level karşılaştırılır ve "Bu hafta 2 koli deterjan önerilir" gibi bir öneri çıkar. Öneri, şoförün o haftaki yükleme listesine eklenir.
- **Kabul:**
  1. Portal talebi şoföre bildirim olarak düşer.
  2. Teslim stoktan düşer.
  3. Ayrı faturalı kalem cariye borç yazar, fiyata dahil kalem yazmaz.
  4. 3 aylık ortalama doğru hesaplanır (SQL testi).

### 14.3 Harita (Lojistik + Pazarlama, tek bileşen)
- **Teknoloji (karar):** **Leaflet + react-leaflet + OpenStreetMap karoları.** Anahtar gerekmez.
  - OSM karo kullanım politikasına uyulur: atıf gösterilir, yoğun kullanımda kendi karo sağlayıcısına geçilir. Karo URL'si `VITE_TILE_URL` ile değiştirilebilir.
  - Ek bağımlılık olarak yalnızca `leaflet` ve `react-leaflet` eklenir.
- **Geocoding:**
  - Nominatim kullanılır, **sunucu tarafında** Edge Function `geocode` ile çağrılır. Saniyede en fazla 1 istek gönderilir, User-Agent'ta uygulama adı ve e-posta bulunur.
  - Sonuçlar `geocode_cache` tablosunda tutulur (normalized_address unique, lat, lng, source, updated_at).
  - **Otomatik tamamlama ve toplu tarama yapılmaz** (Nominatim politikası). Adres kaydedilirken bir kez sorgulanır. Kullanıcı pin'i sürükleyerek konumu düzeltebilir.
  - `customers` ve `leads` tablolarına `lat` ve `lng` kolonları eklenir.
- **Bileşen** `<OpsMap layers={['routes','customers','leads']}>` (`src/features/map/`):
  - Rota polylines, sıralı durak numaraları ve müşteri pin'leri (kiremit #B4432A) gösterilir.
  - Pazarlama modunda **müşteri olmayan işletmeler / adaylar** ayçiçeği #E9A822 renginde gösterilir.
  - **Rota koridoru filtresi:** rotaya X km'den yakın adaylar (varsayılan 2 km; hesap istemcide haversine ile yapılır).
  - **Kement (lasso) seçimi** ile seçilen adaylar toplu olarak `leads` pipeline'ına eklenir, şoför veya pazarlamacıya "ziyaret" görevi (`field_visits`) atanır ve teklif (`quotes`) başlatılır.
- **Aday hattı (8A):** aday (yeni) → ziyaret edildi → teklif verildi → kazanıldı (müşteriye dönüş sihirbazı, §8 Faz 7 2b) / kaybedildi. Ana prompt §18.1 ve Faz 8A'daki `crm_*` tabloları kullanılır. Bu ek yalnızca harita girişini ve rota koridorunu ekler.
- **Rota optimizasyonu (SHOULD):** OpenRouteService Optimization (VROOM) çağrısı Edge Function içinden yapılır; anahtar secrets'ta durur. Anahtar yoksa en yakın komşu sezgisi kullanılır. Sonuç önerisi elle onaylanır.
- **Kabul:**
  1. Müşteri adresi kaydedilince pin görünür, ikinci kayıtta Nominatim çağrılmaz (cache).
  2. Rota polylines ve durak sırası doğrudur.
  3. Pazarlama modunda koridor filtresi ve kement ile aday oluşturma çalışır.
  4. Şoför/depo rolü pazarlama katmanını göremez.
- **Kaynaklar:**
  - Nominatim kullanım politikası: https://operations.osmfoundation.org/policies/nominatim/
  - OpenRouteService: https://openrouteservice.org/
  - VROOM: https://github.com/VROOM-Project/vroom
  - Badger Maps (müşteri/aday renklendirme, kement, rota üzerinden aday bulma): https://www.badgermapping.com/features/ · https://www.badgermapping.com/knowledgebase/what-is-lasso/

---
## 15) Not 17 — Sosyal medya paneli: **Embay modülünün Trakya'ya taşınması** (Faz 8)

> **Nerede bağlanır:** Faz 8'dir ve Faz 8A'dan sonra gelir. Ana prompttaki "Faz 8 — Ana sayfa ve sosyal medya merkezi" bölümünün 2. maddesi ("Embay deposu bulunamadı…") **bu bölümle değiştirilir.** Depo bulundu: `sametatak9/sahin-manitou-kiralama`. Faz 8'in geri kalanı (Bugün kartları, `dashboard_notes`) aynen geçerlidir.
>
> **Bağımlılık:**
> - Not 12 (logo, marka kiti).
> - Faz 8A'daki `social_post_metrics` tanımı: iki yerde aynı tablo geçiyor, **tek tablo** olarak `social_post_metrics` kullanılır (aşağıdaki şema geçerlidir).
> - Not 1'in yayınlanmış aylık menüsü (menü içerik kaynağı).
>
> **Risk:** Düşük. Tamamen ayrı bir sekmedir, mevcut modüllere yazmaz.
>
> **Gizli bilgi kuralı:** Token ve anahtarlar **asla** repo'ya, `.env` dosyasına veya tabloya düz metin olarak girmez. Uygulama anahtarları **Supabase Edge Function secrets** içinde, kullanıcı OAuth token'ları **Supabase Vault** içinde (`store_connector_secret` / `read_connector_secret` deseni) tutulur. Tarayıcıya yalnızca publishable key gider.

### 15.1 Kaynak depo incelemesi (salt okunur, 27.09.2026, HEAD `6d01876`)
Embay "AI Operations Center" şu yapıda:
- **Panel (React + Vite):** `src/ops/`
  - Kabuk: `src/ops/OpsApp.tsx`, `src/ops/Shell.tsx` (navigasyon), `src/ops/session.tsx`, `src/ops/ui.tsx`, `src/ops/ErrorBoundary.tsx`.
- **Ekranlar:** `src/ops/screens/`
  - `Planner.tsx`: İçerik Takvimi (ay/hafta/gün/kanban/liste).
  - `Queue.tsx`: Yayın Kuyruğu (medya yükle, saatinde paylaş).
  - `Studio.tsx`: İçerik Stüdyosu (AI + tasarım + önizleme).
  - `Approvals.tsx`: Onay Merkezi.
  - `Connections.tsx`: uygulama bağlantıları.
  - `Pools.tsx`: havuzlar.
  - `VideoStudio.tsx`
  - `Bots.tsx`: Bot Merkezi.
  - `Reports.tsx`
  - `Home.tsx`
  - `Settings.tsx`
  - `System.tsx`
  - `Skills.tsx`
  - `Leads.tsx`, `Customers.tsx`, `Portfolio.tsx`: Embay'e özel CRM.
- **Bileşenler:** `src/ops/components/`
  - `PostPreview.tsx`: platforma özel önizleme.
  - `Schedules.tsx`
  - `AutopilotCard.tsx`
  - `Pools.tsx`
  - `VideoPool.tsx`
  - `DesignCanvas.tsx`
  - `MontageStudio.tsx`
  - `AppDetail.tsx`
  - `ConnectorActivity.tsx`: gelen olaylar ve işlem günlüğü.
  - `ConnectionArchive.tsx`
  - `AiBudget.tsx`
  - `AiKeys.tsx`
  - `LearningLog.tsx`
  - `PageGuide.tsx`
  - `DriveSources.tsx`
- **Panel kütüphaneleri:** `src/ops/lib/`
  - `api.ts`: edge function köprüsü, yalnızca kullanıcı JWT'si gönderir.
  - `hooks.ts`: kendi `useQuery` kancası + realtime.
  - `types.ts`
  - `format.ts`
  - `media.ts`
  - `montage.ts`
  - `share.ts`: "Telefondan paylaş" (Web Share API).
  - `appLinks.ts`
- **Edge Functions:**
  - `supabase/functions/ops/index.ts` + `ops/main.ts`. Uçlar:
    - `POST /ops/worker`: yalnızca pg_cron, Vault'taki worker secret ile.
    - `POST /ops/api`: panel; JWT + ekip rolü.
    - `GET /ops/oauth/callback`
    - `GET|POST /ops/webhook/meta`: imza doğrulamalı.
    
    API aksiyonları: `generate_post`, `plan_month`, `publish_content`, `sync_metrics`, `execute_approval`, `oauth_start`, `disconnect`, `verify_app`, `banner_render`, `content_factory_run`, `canva_*`, `status`, `system_check`, `test_telegram`…
  - `supabase/functions/missions/index.ts`: bot görevleri.
  - `supabase/functions/_shared/`:
    - `publisher.ts`: onaylı yayın, token yenileme.
    - `planner.ts`: `planWeek`.
    - `factory.ts`: İçerik Fabrikası, banner render.
    - `engine.ts`: `executeTask`.
    - `mission.ts`
    - `context.ts`
    - `activity.ts`: `logActivity`.
    - `secrets.ts`
    - `search.ts`
    - `drive.ts`
    - `ai/`: `anthropic.ts`, `others.ts`, `budget.ts`, `keys.ts`, `index.ts`, `types.ts`. Sağlayıcıdan bağımsız, bütçe freni var.
    - `connectors/`:
      - `registry.ts`, `types.ts`
      - `meta.ts`: IG + FB publish/metrics, IG login, token refresh, business discovery.
      - `youtube.ts`
      - `canva.ts`
      - `messaging.ts`: WhatsApp/Telegram/e-posta.
    - `tools/registry.ts`
    - `pure/schedule.ts`: saat dilimi doğru zamanlayıcı, Deno + Vite ortak.
    - `pure/rules.ts`: onay durumları, normalizasyon.
- **Testler:** `tests/pure.test.ts`
- **Migration'lar** (hepsi additive, `supabase/migrations/2026092310*` … `20260926160000_*`). Sosyal modül için önemli olanlar:
  - `…100000_ops_security_audit`: `team_role()`, `audit_log`.
  - `…100100_ops_ai_bot_engine`: `ai_agents`, `ai_generations`, `automation_*`, `claim_due_tasks` (SKIP LOCKED + lease).
  - `…100200_ops_approvals`: `approval_requests` (9 durum), `decide_approval()`.
  - `…100300_ops_content_design_publish`: `content_campaigns`, `brand_kits`, `design_templates`, `designs`, `social_publications`, `social_post_metrics`, `oauth_states`, Vault sarmalayıcıları `store_connector_secret`/`read_connector_secret`, `design-exports` bucket.
  - `…100600_ops_scheduler_worker`: Vault worker secret, `verify_worker_secret`, pg_cron her dakika worker çağrısı.
  - `…100700_ops_realtime`
  - `…150000_ops_media_queue_youtube`: `media-uploads` bucket.
  - `…230000_ops_media_library`
  - `…240000_ops_ai_budget`: `ai_budget`, `ai_usage`, `ai_spend_status()`.
  - `…270000_ops_connector_activity`: `connector_activity`, `bot_accounts`, `connector_events` (webhook gelen kutusu), `webhook_verify_token`.
  - `20260925120000_ops_content_factory`: `content_quota`, `content_factory_days`, `content_quota_today()`.
  - `20260925130000_ops_content_pools`: `post_templates`, `media_library` alanları.
  - `20260926150000_ops_autopilot`: `ops_autopilot`, mesai penceresi.
  - `20260926160000_ops_agency_clients`: `agency_clients`, `bot_learning_log`.
- **Repo'da migration'ı olmayan temel tablolar:** `social_accounts`, `social_drafts`, `automation_skills`, `automation_tasks`, `social_prospects`, `team_members`. Bunlar Embay projesine önceki oturumlarda doğrudan uygulanmış (bkz. `supabase/README.md`). Trakya'da **baştan tanımlanacaklar** (aşağıda).
- **Durum notu:**
  - Google Business connector'ı Embay'de `implemented: false`.
  - Yorum/DM **gelen kutusu yalnızca olay kaydı** olarak var: `connector_events` + `ConnectorActivity.tsx`. Yanıtlama arayüzü yok.
  
  Trakya'da bu ikisi **yeni yazılacak**, taşınmayacak.

### 15.2 Taşıma kararı: ne alınır, ne alınmaz
**Mimariyle alınanlar (uyarlanarak yeniden yazılır; kopyala-yapıştır yapılmaz, Trakya kod stiline, TanStack Query'ye ve `src/features/` yapısına çevrilir):**

| Embay kaynağı | Trakya hedefi | Uyarlama |
|---|---|---|
| `supabase/functions/_shared/pure/schedule.ts` | `supabase/functions/_shared/pure/schedule.ts` + `src/features/social/lib/schedule.ts` (aynı dosya) | **Neredeyse aynen alınır** (saf, bağımsız, Europe/Istanbul). Testleri de alınır. |
| `supabase/functions/_shared/pure/rules.ts` (onay durumları) | `…/_shared/pure/social-rules.ts` | Durumlar Trakya diline çevrilir (aşağıya bakın). |
| `supabase/functions/_shared/connectors/{types,registry,meta}.ts` | `supabase/functions/social/connectors/…` | Yalnızca **instagram**, **facebook** ve **google_business** (yeni) alınır. YouTube, Canva, listing ve search connector'ları alınmaz. |
| `supabase/functions/_shared/publisher.ts` | `supabase/functions/social/publisher.ts` | Kuyruktan yayın, 60 günlük IG token yenileme, `logActivity`. |
| `supabase/functions/_shared/ai/*` | `supabase/functions/_shared/ai/*` | Sağlayıcıdan bağımsız çağrı + **bütçe freni** (`ai_budget`/`ai_usage`). Varsayılan sağlayıcı: env'de hangi anahtar varsa o. Hiç anahtar yoksa şablon tabanlı metin üretilir. |
| `supabase/functions/ops/main.ts` (worker/api/oauth/webhook yönlendirme deseni) | `supabase/functions/social/index.ts` | Tek fonksiyon ve aynı 4 uç: `/social/worker`, `/social/api`, `/social/oauth/callback`, `/social/webhook/meta`. Aksiyonlar: `generate_caption`, `plan_month`, `publish`, `sync_metrics`, `oauth_start`, `disconnect`, `reply` (yeni). |
| `…100300` Vault sarmalayıcıları `store_connector_secret`/`read_connector_secret` | Aynı adla Trakya migration'ı | Yalnızca service role çalıştırır (revoke public/anon/authenticated). |
| `…100600` worker secret + pg_cron | `trakya-social-worker` pg_cron (her dakika) | Worker secret Vault'ta **üretilir** (`gen_random_bytes`). Elle girilmez. |
| `…100200` `approval_requests` / `decide_approval` | **Alınmaz.** Trakya'nın mevcut/planlanan `approval_policies` yapısı (§3.8) kullanılır. Politika adı `sosyal_yayin`. | Çift onay motoru olmaz. |
| `…270000` `connector_activity`, `connector_events`, `webhook_verify_token` | `social_activity`, `social_inbox` (aşağıda) | Gelen kutusu yanıtlanabilir hale gelir. |
| `…240000` `ai_budget`, `ai_usage` | Aynı adla (Faz 3D'de oluşturulmuş olur) | Varsayılan sınırlar: günlük $1, aylık $15. |
| `…120000` `content_quota` + `factory.ts` İçerik Fabrikası | `social_quota` + sade fabrika | Günde en fazla 1 taslak (catering için yeterli). Yalnızca **taslak** üretir. |
| `…150000` `media-uploads` bucket | `social-media` bucket | **Public okuma** zorunludur, çünkü IG Graph medyayı herkese açık URL'den çeker. Yazma yalnızca yetkili rollerde. Dosya adları tahmin edilemez UUID olur. |
| `src/ops/screens/Planner.tsx` | `src/features/social/SocialCalendarPage.tsx` | Ay/hafta/liste görünümü. Görsel dil Hasat 2.0'dır; hücre stili `<MonthMenuCalendar>` ile ortak `CalendarCell` stil token'larını kullanır (Not 14). |
| `src/ops/screens/Queue.tsx` + `components/PostPreview.tsx` | `SocialQueuePage.tsx` + `PostPreview.tsx` | IG kare/dikey, FB ve GBP önizlemeleri. |
| `src/ops/screens/Studio.tsx` | `SocialComposer.tsx` (çekmece) | AI metin, varyant ve hashtag. Tasarım tuvali (`DesignCanvas`) alınmaz. |
| `src/ops/screens/Approvals.tsx` | Mevcut Trakya onay ekranına `sosyal_yayin` tipi eklenir | — |
| `src/ops/screens/Connections.tsx` + `components/AppDetail.tsx` | `SocialAccountsPage.tsx` | Bağlan/kes, son doğrulama, token bitiş tarihi, izinler. |
| `src/ops/components/ConnectorActivity.tsx` | `SocialInboxPage.tsx` | Yorum/DM listesi ve **yanıtla** (yeni). |
| `src/ops/components/AiBudget.tsx` | Ayarlar > AI bütçesi | — |
| `src/ops/lib/share.ts` | `src/features/social/lib/share.ts` | Bağlantı yoksa "Telefondan paylaş" (Web Share API) + metni kopyala. |
| `src/ops/lib/hooks.ts` (özel `useQuery`) | **Alınmaz.** TanStack Query + G-1'deki `useLiveInvalidate` kullanılır. | — |

**Alınmayanlar (kapsam dışı):** Bot Merkezi, missions, Skills, Academy, Portfolio, Embay CRM ekranları (Trakya'nın kendi CRM'i 8A'da), VideoStudio/Montage, Canva/Drive, YouTube/TikTok/X/LinkedIn, ajans çoklu müşteri modeli (`agency_clients`), otopilot mesai penceresi (yerine basit "yayın açık/kapalı" anahtarı konur), `social_prospects` rakip keşfi.

### 15.3 Trakya veri modeli (`social_` ön ekiyle; mevcut `social_posts` tablosu genişletilir)
Mevcut `social_posts` tablosu **ana içerik tablosu olarak kalır**. Embay'deki `social_drafts` karşılığı budur; ikinci bir taslak tablosu açılmaz.
```sql
-- 1) Ana içerik (mevcut tablo; additive kolonlar)
alter table public.social_posts
  add column if not exists caption_variants jsonb default '{}'::jsonb,   -- {instagram:"…", facebook:"…", google_business:"…"}
  add column if not exists media_paths text[] default '{}',
  add column if not exists format text default 'post' check (format in ('post','reel','story','carousel','gbp_update','gbp_offer','gbp_event')),
  add column if not exists pillar text check (pillar in ('menu','mutfak','ekip','musteri','kampanya','ozel_gun','hijyen','egitici')),
  add column if not exists menu_plan_date date,            -- günün menüsü içeriği (Not 1'den)
  add column if not exists account_ids uuid[] default '{}',
  add column if not exists approved_by uuid, add column if not exists approved_at timestamptz,
  add column if not exists ai_generation_id uuid;
-- mevcut status: havuz, taslak, onay, planlandi, yayinlandi (+ 'hata','iptal' eklenir; check süperset)

-- 2) Hesaplar (Embay social_accounts karşılığı; TOKEN YOK, yalnız Vault id)
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram','facebook','google_business')),
  external_account_id text, external_account_name text, avatar_url text,
  credential_secret_id uuid,          -- vault.secrets id
  token_expires_at timestamptz, scopes text[], connection_status text default 'bagli_degil'
    check (connection_status in ('bagli_degil','bagli','suresi_doldu','hata')),
  last_verified_at timestamptz, last_error text, metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(), unique (platform, external_account_id));

-- 3) Yayın kaydı (Embay social_publications karşılığı; platform başına bir satır)
create table public.social_publications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  account_id uuid references public.social_accounts(id),
  platform text not null, caption text not null default '', media_urls text[] default '{}',
  scheduled_at timestamptz, published_at timestamptz,
  status text not null default 'planlandi' check (status in ('planlandi','isleniyor','yayinlandi','hata','iptal','elle_paylasildi')),
  external_post_id text, external_url text, error text, attempt int default 0, next_attempt_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now());
create index on public.social_publications (scheduled_at) where status = 'planlandi';

-- 4) Metrikler (8A ile ortak tek tablo)
create table public.social_post_metrics (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.social_publications(id) on delete cascade,
  account_id uuid references public.social_accounts(id),
  fetched_at timestamptz default now(), source text default 'api' check (source in ('api','elle')),
  reach int, impressions int, likes int, comments int, shares int, saves int, clicks int, video_views int,
  followers int, raw jsonb);

-- 5) Gelen kutusu (Embay connector_events karşılığı; yanıtlanabilir)
create table public.social_inbox (
  id bigint generated always as identity primary key,
  received_at timestamptz default now(), platform text not null,
  kind text not null check (kind in ('yorum','mesaj','bahsetme','degerlendirme')),  -- GBP yorumları = degerlendirme
  account_id uuid references public.social_accounts(id), external_id text unique, parent_external_id text,
  author_name text, text text, payload jsonb default '{}'::jsonb, signature_ok boolean default false,
  status text default 'yeni' check (status in ('yeni','yanitlandi','yok_sayildi','sikayete_aktarildi')),
  reply_text text, replied_by uuid, replied_at timestamptz,
  ai_label text check (ai_label in ('olumlu','soru','siparis_talebi','sikayet','spam')));

-- 6) İşlem günlüğü + AI + kota + webhook doğrulama
create table public.social_activity (id bigint generated always as identity primary key, at timestamptz default now(),
  platform text, action text, status text check (status in ('ok','failed','skipped')), account_id uuid, summary text, error text, data jsonb);
create table public.ai_budget (id int primary key default 1 check (id = 1), enabled boolean not null default true,
  daily_usd numeric(10,2) not null default 1.00, monthly_usd numeric(10,2) not null default 15.00,
  per_call_usd numeric(10,2) not null default 0.10, updated_by uuid, updated_at timestamptz default now());
insert into public.ai_budget (id) values (1) on conflict do nothing;
create table public.ai_usage (id bigint generated always as identity primary key, at timestamptz default now(),
  source text not null check (source in ('menu_suggest','social_caption','social_reply','inbox_label','test')),
  ref_id uuid, provider text, model text, tokens_in int default 0, tokens_out int default 0, cost_usd numeric(10,4) default 0);
-- ai_budget/ai_usage Faz 3D'de (Not 1) OLUŞTURULDU; source check listesi 3D migration'ında bu değerlerin tamamıyla kurulur, burada değiştirilmez. Okuma/yazma: yalnızca yonetici.
create table public.social_quota (platform text primary key, enabled boolean default true, per_day int default 1,
  slot_times text[] default '{"11:30"}');   -- öğle yemeği öncesi (catering için varsayılan)
-- Vault: store_connector_secret / read_connector_secret / webhook_verify_token (Embay …100300, …270000 deseni)
```
- **RLS:**
  - Okuma ve yazma: `yonetici` ve `pazarlama`. `pazarlama` rolü Faz 8A'da `team_members.role` check listesine additive olarak eklenir. Bu faz 8A'dan sonra geldiği için rol hazır olur.
  - `social_accounts.credential_secret_id` alanını hiçbir istemci rolü okumaz (tabloya istemci select'i kapatılır; istemci yalnızca `credential_secret_id` içermeyen `v_social_accounts` görünümünü okur).
  - `sofor`, `depo` ve `musteri` rolleri modülü göremez.
  - `social_inbox` → `sikayete_aktarildi` aksiyonu Not 7'deki `customer_feedback`/şikâyet akışına kayıt açar.
- **Realtime:** `social_posts`, `social_publications`, `social_inbox` (G-1).

### 15.4 Ekranlar (Pazarlama > **Sosyal Medya** sekmesi; §4.1'deki Pazarlama modülünün altında, Hasat 2.0)
1. **Takvim:** ay/hafta/liste. Hücrede platform ikonlu gönderi çipleri ve durum rengi (taslak gri, onay sarı #E9A822, planlandı mavi, yayınlandı yeşil, hata kırmızı). Sürükle-bırak ile tarih değiştirilir (onaylıysa yeniden onay istenir). Özel günler katmanı (bayramlar, Anneler Günü, 1 Mayıs, Dünya Gıda Günü 16 Ekim…) seed edilir.
2. **Oluştur** (çekmece):
   - Kaynak seçimi: "Boş", "Günün menüsü" (yayınlanmış menüden fotoğraf + yemek adları), "Havuzdan".
   - Platform seçimi ve platform başına metin varyantı.
   - **AI metin botu:** ton (samimi/kurumsal), uzunluk, hashtag, CTA (WhatsApp 0505 036 49 36).
   - Medya yükleme (sıkıştırma: 1080 px, en fazla 8 MB görsel).
   - Önizleme, sonra "Onaya gönder".
3. **Onay:** yönetici onaylar ve `social_publications` satırları planlanır. **Onaysız hiçbir şey yayınlanmaz.**
4. **Gelen kutusu:** yorum, DM ve GBP değerlendirmeleri. AI etiketi ve **önerilen yanıt** gösterilir, yanıt insan onayıyla gönderilir. "Şikâyete aktar" ve "Siparişe/adaya aktar" (8A lead) aksiyonları vardır.
5. **Analiz:** hesap bazında takipçi eğrisi, gönderi başı erişim/etkileşim, en iyi saat, en iyi içerik sütunu (pillar). Bugün ekranındaki sosyal önizleme kartı (§8 Faz 8 madde 3) buradan beslenir.
6. **Hesaplar:** bağlan (OAuth), bağlantıyı kes, token bitiş sayacı, son hata. Bağlı olmayan platformda yayın zamanı gelince bildirim gelir ve "Telefondan paylaş" + "Elle paylaşıldı olarak işaretle" seçenekleri sunulur.

### 15.5 İş kuralları (Instagram/Facebook/GBP)
- **Instagram Graph API'de yerel zamanlama yoktur.** Kendi kuyruğumuz kullanılır: pg_cron her dakika `/social/worker` çağırır, worker `planlandi` ve vadesi gelmiş satırları SKIP LOCKED + lease ile alır.
  - Akış: container oluştur → (video ise) durum sorgula → `media_publish`.
  - Container 24 saatte geçersiz olur, bu yüzden container **yayın anında** oluşturulur.
  - Yayından önce `content_publishing_limit` kontrol edilir.
  - Hata olursa 3 deneme yapılır (1, 5 ve 15 dk arayla). Sonrasında `hata` durumu ve bildirim.
- IG token: "Instagram ile giriş" token'ı 60 gün geçerlidir; son 10 günde otomatik yenilenir (Embay `publisher.ts` deseni).
- Facebook: Sayfa gönderisi için `pages_manage_posts` izni gerekir.
- **Google Business Profile:** `localPosts` (STANDARD / OFFER / EVENT) kullanılır, API erişimi Google başvurusu ile açılır (🔌). Erişim yokken GBP gönderileri "elle paylaş" modunda çalışır. Yorumlar `social_inbox(kind='degerlendirme')` tablosuna elle ya da API ile gelir.
- Webhook: Meta imzası (`X-Hub-Signature-256`) doğrulanmadan olay kaydedilmez. Doğrulama token'ı Vault'ta üretilir.
- AI: model **asla doğrudan yayınlamaz, yanıt göndermez, fiyat taahhüdü vermez.** Her çıktı taslak olur ve insan onayından geçer. Bütçe dolunca şablon metne düşer. Kişisel veri (yorum sahibi adı) AI'a yalnızca ad olmadan gönderilir.
- Catering uyarlamaları:
  - Varsayılan içerik sütunları: günün menüsü, mutfaktan/hijyen, ekip, müşteri referansı (izinli), kampanya/teklif, özel gün, eğitici (beslenme).
  - Varsayılan yayın saati 11:30 (öğle öncesi). Yayın 3 gün ve 1 gün öncesinden planlanır.
  - Menü fotoğrafı üretim kaydından (`production_logs` fotoğrafı varsa) önerilir.
  - Müşteri adı ya da logosu yalnızca `customers.marketing_consent = true` ise kullanılır (kolon eklenir, varsayılan false).

### 15.6 Kabul kriterleri
1. Onaylanmamış gönderi hiçbir koşulda platforma gitmez (SQL + birim testi).
2. Planlanan IG gönderisi zamanından en fazla 2 dakika sonra yayınlanır. Başarı **yalnızca API yanıtı** ile `yayinlandi` olur ve `external_url` dolar.
3. Bağlı olmayan platformda zamanı gelen gönderi için bildirim ve "Telefondan paylaş" akışı çalışır. "Elle paylaşıldı" işaretlenebilir.
4. `social_accounts` üzerinden hiçbir istemci sorgusu token ya da secret döndürmez (RLS/grant testi). `rg -n "EAA|IGQV|sk-|service_role" src supabase` boş döner (anahtar biçimleri).
5. Webhook imzası hatalıysa kayıt oluşmaz.
6. Gelen kutusundan yanıt insan onayıyla gider ve `replied_by` dolar.
7. AI bütçesi dolunca üretim şablona düşer ve hata vermez.
8. `schedule.ts` testleri (DST, Europe/Istanbul) geçer.
9. `sofor`/`depo`/`musteri` rolleri modülü göremez.

### 15.7 Kaynaklar
- IG içerik yayınlama (container → media_publish, 24 saat, publishing limit): https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/ · https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
- Google Business Profile localPosts: https://developers.google.com/my-business/content/posts-data
- Buffer / Later / Hootsuite (takvim, AI asistan, gelen kutusu, analiz, onay): https://buffer.com/pricing.md · https://buffer.com/resources/buffer-vs-later/ · https://www.hootsuite.com/plans

---
## 16) Ana prompt §9.2'ye eklenecek uçtan uca test adımları
Tümü dev projede `begin … rollback` ile yapılır. Arayüz adımları Playwright ile koşulur.
1. **3D:**
   - Genel ve müşteriye özel ay oluşturulur.
   - Müşteri yasağına takılan yemekle yayınlama denenir, hata beklenir.
   - İstisnayla yayınlanır, `menu_plans` slotları dolar.
   - Portalda ay salt okunur görünür.
   - Geri bildirim bildirim üretir.
   - Token ile bakiye görünmez.
2. **Hemen işleri:**
   - "Sipariş linki" kopyalanır, link açılır, yenilenir, eski link geçersiz olur.
   - `/iletisim.html` girişsiz 200 döner.
   - Favicon/manifest vardır.
3. **3E:**
   - Açılış sayımı → hareket → kör periyodik sayım → fark → `sayim` hareketi.
   - Zayiat gider raporunda yoktur.
   - FEFO seçimi.
   - Onaysız imha stoktan düşmez, onaylı imha `fire` üretir, imha satırı güncellenemez.
4. **3F:**
   - Takvim satınalma modunda ihtiyaç hesaplanır, satır içi düzenleme plan sürümüne yazılır.
   - RFQ iki tedarikçiye gönderilir. Tedarikçi A, B'nin tokenıyla veri göremez. Son tarih sonrası kayıt reddedilir.
   - Kazanan → onay → PO zinciri çalışır.
5. **4:**
   - `accrue_vat` sonucu, ödeme ve devreden.
   - CSV ekstresi ikinci kez içe aktarılamaz.
   - Eşleştirme önerisi, mutabakat farkı ve kilit.
   - Kredi kartı eksi bakiye.
6. **5:**
   - Araç gideri (HGS) → `finance_entries` → hesap bakiyesi.
   - Muayene hatırlatması.
   - Rota + `route_stops`.
   - Portal sarf talebi → şoför bildirimi → teslim → araç deposundan sevk → ayrı faturalı kalem cariye borç, fiyata dahil kalem değil.
   - 3 aylık ortalama.
   - Geocode cache ikinci çağrıda dış istek yapmaz.
7. **6:**
   - Yoklama → yevmiye hakedişi → kart bakiyesi.
   - Avans gider değildir.
   - `sofor` başka personelin IBAN/maaşını göremez.
8. **8A:** Koridor filtresi ve kementle aday oluşturma, `field_visits` ataması. Şoför pazarlama katmanını göremez.
9. **8:**
   - Onaysız gönderi yayınlanmaz.
   - Worker planlanmış gönderiyi (sahte connector ile) yayınlar, `yayinlandi` + `external_url` dolar.
   - Hatalı webhook imzası kayıt üretmez.
   - `v_social_accounts` secret kolonunu döndürmez.
   - AI bütçesi dolunca şablona düşer.
10. **G-1 (her fazda):** İki tarayıcı bağlamı açılır. Birinde kayıt yapılınca diğerinde en geç 3 saniyede görünür. `rg -n "set (balance|bakiye)" supabase src` boş döner.

---

## 17) Çakışma ve öncelik tablosu (bu ek ana promptu **yalnızca burada** değiştirir)

| # | Ana prompt | Bu ek | Kazanan |
|---|---|---|---|
| Ç-1 | §4.1 Stok sekmesi "Hammadde kartları" | "Stok kartları" + `/stok/kartlar` (alias'lı) | **Ek** |
| Ç-2 | §3.2 FIFO tüketim | FEFO önce, eşitlikte FIFO (maliyet lot maliyeti) | **Ek** |
| Ç-3 | §8 3F tokenlı tedarikçi teklif linki SHOULD | MUST (Not 6) | **Ek** |
| Ç-4 | §8 Faz 8 madde 2 "Embay deposu bulunamadı…" | Depo bulundu; taşıma planı Not 17 / §15 | **Ek** |
| Ç-5 | §5.C #7 `routes.stops jsonb` | Normalize `route_stops`; `stops` okunmaz, silinmez | **Ek** |
| Ç-6 | Faz 8 ve 8A'da iki ayrı `social_post_metrics` anılması | Tek tablo, şeması §15.3 | **Ek** |
| Ç-7 | Faz 8 `social_accounts` (tanımsız) | §15.3 şeması (Vault id, token yok) | **Ek** |
| Ç-8 | Portal bakiyesi (§5.C #12'de ayrıntısız) | Yalnızca giriş ya da PIN ile | **Ek** |
| Ç-9 | Bakiye alanları (çeşitli) | G-1: yalnızca defterden türetilir, Realtime + invalidation | **Ek** (ana promptu genişletir) |
| Ç-10 | §3.1 / §3.9 tek gider, §3.6 maliyet, §3.8 sürüm/onay, §6 tasarım, §8.A kurallar, §9 testler | Değişmez; bu ekteki her madde bunlara uyar | **Ana prompt** |
| Ç-11 | Embay `approval_requests` onay motoru | Alınmaz; Trakya `approval_policies` (§3.8) kullanılır | **Ana prompt** |

Tabloda olmayan her konuda **ana prompt kazanır**.

---

## 18) Sıralı kontrol listesi (Claude işaretleyerek ilerler)

**A. Hemen (mevcut faz bittikten sonra)**
- [ ] A1. Mevcut fazı bitir: testler, faz raporu, push. Baştan başlama, bitmiş işi refactor etme.
- [ ] A2. `docs/PLAN.md`'ye EK-1 notlarını fazların altına "EK-1 / Not N" etiketiyle yerleştir (ayrı commit).
- [ ] A3. Not 12: logo + favicon + PWA manifest + `Logo.tsx` (Seçenek 1 varsayılan). Kabul 1–5.
- [ ] A4. Not 13: `public/iletisim.html` (girişsiz) + uygulama içi link. Kabul 1–5.
- [ ] A5. Not 8: Cari > müşteri > "Sipariş linki" sekmesi (kopyala / WhatsApp / QR / yenile). Kabul 1–4.
- [ ] A6. Not 2: "Stok kartları" terimi + rota alias'ı + sarf kategorileri. Kabul 1–3.

**B. Faz 3D**
- [ ] B1. Not 1/3: `monthly_menus`, `monthly_menu_days`, `recipe_tags`, `customer_dish_rules` + RLS + `publish_monthly_menu`.
- [ ] B2. Not 14: `<MonthMenuCalendar mode="menu">` (sürükle/kopyala, gün/hafta kopya, seçici, undo, tekrar uyarısı, mobil ajanda), maket birebir.
- [ ] B3. Not 1: `ai_budget` + `ai_usage` (şema §15.3), `menu-suggest` Edge Function + `rules.ts` yedek motoru.
- [ ] B4. Not 7: portal v2 sekmeleri (Sipariş, Aylık menü, Geri bildirim; Bakiye "Faz 4'te"), `customer_feedback`, puan, bildirim.
- [ ] B5. Not 8: `customer_portal_tokens` (PIN hash), `musteri` rolü ataması, `PortalComingSoon` yerine portal v2. Kabul 5.
- [ ] B6. Not 1/7 kabul kriterleri + §16 madde 1 testleri.

**C. Faz 3E**
- [ ] C1. Not 4: `warehouses`, `stock_counts`, `stock_count_lines`, kör sayım, fark hareketleri, 15 gün cron, `v_monthly_usage_by_category`, mobil sayım.
- [ ] C2. Not 5: FEFO `consume_stock`, pazartesi SKT bildirimi, `stock_disposals` + `stok_imha` onayı (değiştirilemez).
- [ ] C3. §16 madde 3 testleri.

**D. Faz 3F**
- [ ] D1. Not 14: takvim `mode="satinalma"` + ihtiyaç paneli + satır içi düzenleme → plan sürümü.
- [ ] D2. Not 6: `rfq_*` tabloları, `/#/teklif/:token` + security-definer RPC'ler, karşılaştırma matrisi, onay → PO, `v_supplier_offers`.
- [ ] D3. §16 madde 4 testleri.

**E. Faz 4**
- [ ] E1. Not 11: kredi kartı hesabı, `bank_connectors` (manual/CSV/Excel), `bank_statement_lines`, `bank_match_rules`, mutabakat ekranı + kilit.
- [ ] E2. Not 10: `tax_obligations`, `accrue_vat`, Finans > Vergiler, 25/28 hatırlatmaları.
- [ ] E3. Not 9: portal Bakiye sekmesi (giriş veya PIN), `v_customer_balances`.
- [ ] E4. G-1: `v_account_balances`, `v_customer_balances` + Realtime + `useLiveInvalidate`.
- [ ] E5. §16 madde 5 testleri.

**F. Faz 5**
- [ ] F1. Not 15b: `vehicle_logs` HGS/onarım, kasko, `vehicle_documents` + bucket, hatırlatma cron'u, araç kartviziti (maket).
- [ ] F2. Not 16: `routes` genişletme + `route_stops` (taşıma), şoför mobil durak ekranı.
- [ ] F3. Not 16: `customer_supply_items`, `supply_requests`, portal Sarf sekmesi, şoför sarf teslimi (sevk + cari), `v_customer_supply_usage` + öneri.
- [ ] F4. Not 16: `<OpsMap>` (Leaflet/OSM), `geocode` Edge Function + `geocode_cache`, müşteri lat/lng.
- [ ] F5. §16 madde 6 testleri + G-1.

**G. Faz 6**
- [ ] G1. Not 15a: yevmiye otomatiği, maaş/avans/ödeme akışı, `employee_documents` + bucket, personel kartviziti (maket), hassas alan RLS'i.
- [ ] G2. §16 madde 7 testleri + G-1.

**H. Faz 7** — Not 12 logolarını marka kiti ve antette kullan (ana prompt Faz 7 aynen).

**I. Faz 8A**
- [ ] I1. `pazarlama` rolü; `<OpsMap>` pazarlama katmanı (müşteri kiremit / aday ayçiçeği), rota koridoru, kement → lead + `field_visits` + teklif.
- [ ] I2. §16 madde 8 testleri.

**J. Faz 8**
- [ ] J1. Not 17: §15.3 migration'ları (`social_posts` ek kolonlar, `social_accounts`, `v_social_accounts`, `social_publications`, `social_post_metrics`, `social_inbox`, `social_activity`, `social_quota` (`ai_budget`/`ai_usage` 3D'den hazır), Vault sarmalayıcıları, `social-media` bucket, `trakya-social-worker` cron).
- [ ] J2. Not 17: `supabase/functions/social` (worker/api/oauth/webhook), §15.2 tablosundaki kaynaklardan uyarlama. Anahtarlar yalnızca secrets/Vault'ta.
- [ ] J3. Not 17: Pazarlama > Sosyal Medya ekranları (Takvim, Oluştur, Onay, Gelen kutusu, Analiz, Hesaplar) + Bugün sosyal kartı.
- [ ] J4. §15.6 kabul 1–9 + §16 madde 9 testleri.

**K. Her fazın sonunda:** G-1 kabul kriterleri (§13.1 madde 4) ve not bazında ✅/⏳ tablosu faz raporuna yazılır.

---

## 19) Kaynak listesi (27.09.2026'da erişildi)
- Menü planlama:
  - https://nutrislice.com/products/essentials/ · https://info.nutrislice.com/hubfs/General%20-%20How%20To%20Guide%20-%20Menus%20Features_v3.pdf
  - https://www.jamix.com/menu-management-software-system/ · https://appsource.microsoft.com/en-us/product/web-apps/jamixoy1672841610629.jamix_g5?tab=overview
  - https://support.galleysolutions.com/how-do-i-build-a-menu-plan · https://www.galleysolutions.com/advanced-menus · https://www.galleysolutions.com/galley-assist-for-menus
  - https://get.apicbase.com/menu-planning/
- Sayım / fark / zayiat / SKT:
  - https://support.apicbase.com/help/how-can-i-analyze-my-inventory-count-variance · https://support.apicbase.com/help/which-items-had-the-most-stock-variance-in-a-certain-period · https://support.apicbase.com/help/how-to-make-inventory-reports · https://support.apicbase.com/help/create-storage-locations-per-outlet
  - https://mealticket.my.site.com/helpcenter/s/article/Wasteevents65d6296176133 · https://mealticket.my.site.com/helpcenter/s/article/StorageareasandShelftoSheetinventorycounts65d62cb18f4e9?language=en_US · https://mealticket.my.site.com/helpcenter/s/article/MarketMan-Inventory-Actions-Inventory-Counts-Audit
  - https://fiddle.io/solutions/expiration-tracking · https://www.fastinventorysoftware.com/food-beverage-inventory-software
- RFQ: https://www.auravms.com/supplier-quote-response-portal · https://www.tradogram.com/sourcing-management
- KDV: http://www.muhasebedersleri.com/genel-muhasebe-2/kdv-tahakkuk.html · https://vergidosyasi.com/2021/04/19/360-odenecek-vergi-ve-fonlar-hesabi-isleyisi-muhasebe-kayit-ornegi/ · https://defteran.com/kaynaklar/vergi-takvimi · https://www.alobilgi.com.tr/eylul-2026-kdv-takvimi-25-ve-28-eylul-tarihlerine-dikkat
- Banka:
  - https://www.parasut.com/kullanim-kilavuzu/banka-mutabakati-yapmak · https://www.parasut.com/banka-entegrasyonu
  - https://learn.microsoft.com/en-us/dynamics365/finance/cash-bank-management/set-up-bank-reconciliation-matching-rules · https://learn.microsoft.com/en-us/dynamics365/finance/cash-bank-management/advanced-bank-reconciliation-overview
  - https://tcmb.gov.tr/wps/wcm/connect/d60cc679-ce04-4941-b310-b3788b6f3540/%C3%96HVPS-Rehber-2023-04-30.pdf?MOD=AJPERES · https://bkm.com.tr/urunler-ve-hizmetler/odeme-hizmetleri-veri-paylasim-servisleri/
- Harita: https://operations.osmfoundation.org/policies/nominatim/ · https://openrouteservice.org/ · https://github.com/VROOM-Project/vroom · https://www.badgermapping.com/features/ · https://www.badgermapping.com/knowledgebase/what-is-lasso/
- Sosyal:
  - https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing/ · https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
  - https://developers.google.com/my-business/content/posts-data
  - https://buffer.com/pricing.md · https://buffer.com/resources/buffer-vs-later/ · https://www.hootsuite.com/plans
- Kaynak depo (salt okunur inceleme): `github.com/sametatak9/sahin-manitou-kiralama` @ `6d01876`
- Firma bilgisi: https://trakyacatering.com (site), Yandex Haritalar kaydı
