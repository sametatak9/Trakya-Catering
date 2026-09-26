# Trakya Catering ERP — Keşif Raporu & Uygulama Planı

## Context

`sametatak9/Trakya-Catering` boş bir repo (hiç commit yok). AI Studio'nun yazdığı prompt "bizim ERP'yi dönüştür" diyor; kaynak ERP **`sametatak9/xx` = "Bizim Vinç ERP"** (React 19 + Vite + Tailwind v4 + Supabase). Ayrıca daha olgun kalıplar **`sahin-manitou-kiralama` (Embay Ops)** projesinde var (ekip rolleri, RLS, audit log, `ui.tsx` primitive'leri, `@theme` token sistemi). Hedef: iki projeden iyi olanı alıp, toplu yemek fabrikasının gerçek matematiğini (reçete→MRP→stok→maliyet→irsaliye→fatura→P&L) taşıyan, özgün görünümlü bir ERP kurmak.

## Kararlar (kullanıcı onaylı)

- Palet: **Trakya Hasadı** (kiremit + ayçiçeği + krem).
- Supabase: **yeni proje** — Supabase MCP ile oluşturulacak (`get_cost` → kullanıcıya maliyet onayı → `create_project`), migration'lar MCP `apply_migration` ile uygulanır, `.env.example`'a URL/anon key yazılır (secret değil).
- Bu tur: **Faz 1 + Faz 2**.
- **Müşteri portalı var:** rol modeline baştan `musteri` rolü + `team_members.customer_id` eklenir; RLS müşteriyi kendi kayıtlarıyla sınırlar. Portal ekranı Faz 3'te (sipariş modülüyle), ama auth/rol altyapısı Faz 1'de hazır.

## Kaynak ERP'nin (xx) gerçek durumu

- 8 sayfa: Dashboard(harita), Personel, Onay Merkezi, Filo, Operatör(mobil), Finans(makbuz/masraf), TV pano, Dijital kart (`/kart/:slug`).
- `src/lib/store.tsx` (994 satır): **hardcoded mock dizi + localStorage** asıl kaynak; Supabase'e `.then()` ile fire-and-forget yazıyor → hata yutuluyor, iki kaynak ayrışabiliyor.
- `supabase/migrations/20260913_init.sql`: **RLS `using (true)` → anon anahtarı olan herkes tüm veriyi okuyup silebilir** (kritik). Seed'de `createdAt` kolon hatası var (migration patlar). Auth yok.
- `supabase.ts` vinç projesinin URL'sini hardcode ediyor (`jimywfjufmrpgnjynhkx`).
- Tasarım: tamamen yeşil (#22C55E / #14532D), DM Sans + Space Grotesk, düz CSS sınıfları.

**Prompt'taki hatalar:** `ModuleHero`, `finance_movements`, `inventory_items`, `inventory_movements`, `customers` tabloları **xx'te yok** — AI Studio uydurmuş/başka projeyle karıştırmış. "Mevcut tabloları uyarla" maddesi geçersiz; bunlar sıfırdan kurulacak.

## Prompt'ta eksik / düzeltilmesi gerekenler (plana eklendi)

1. **Brüt/net gramaj & fire:** Reçete net (tabağa giren) gramajla yazılır; stoktan düşen brüt = net / (1 − temizleme firesi). Pişme firesi (et ~%30–35) ayrı alan. Maliyet brütten hesaplanır.
2. **Birim dönüşümü:** gr/kg, ml/lt, adet (yumurta, ekmek), paket. Hammadde kartında `stok birimi` + `reçete birimi` + çarpan.
3. **Maliyet yöntemi:** "güncel alış fiyatı" teklif/fiyatlandırma için; P&L için **ağırlıklı ortalama maliyet** (alış faturası girildikçe güncellenir). İkisi ayrı gösterilir.
4. **Menü takvimi:** Her müşteri aynı menüyü almaz → günlük menü planı (tarih × öğün × müşteri grubu). Porsiyon katsayısı (ağır işçi 1.2x), diyet/vejetaryen alt sayıları.
5. **Öğünler:** kahvaltı, öğle, akşam, gece/sahur vardiyası.
6. **Sipariş ≠ teslim:** 16:00 kesimi sonrası revizyon logu; **fatura teslim edilen (irsaliye) adetten** kesilir.
7. **Gıda güvenliği (yasal):** şahit numune (72 saat), lot/SKT takibi, 14 alerjen etiketi, sevkiyat sıcaklık kaydı. Prompt'ta hiç yok.
8. **E-fatura:** GİB'e doğrudan gönderim yok, **özel entegratör** (Paraşüt/Uyumsoft/Logo vb.) gerekir. Biz UBL-TR alanlarını + entegratör adaptör arayüzünü kurarız. Yemek hizmeti KDV %10 ve 5/10 tevkifat — oran/kodlar mali müşavirle teyit edilecek, tabloda parametre olacak.
9. **Bordro:** Net→brüt/SGK hesabı (vergi dilimi, asgari ücret istisnası) ayrı bir uzmanlık; ERP **işveren toplam maliyetini** bordrodan girdi/import olarak alır, puantaj/mesai/avans'ı kendisi tutar.
10. **Yetki:** Rol yok. Roller: yönetici, aşçıbaşı, depo, satınalma, muhasebe, şoför, (ops.) müşteri portalı. RLS rol bazlı.

## Tasarım yönü (yeşilden çıkıyoruz)

Önceki iki proje de yeşil; catering için özgün, iştah açıcı ve "Trakya" kimliği taşıyan palet. Öneri **"Trakya Hasadı"**:

| Token | Açık | Koyu (mutfak/TV) | Rol |
|---|---|---|---|
| `brand` Kiremit/Pul biber | #B4432A | #E0694E | birincil buton, aktif nav |
| `accent` Ayçiçeği | #E9A822 | #F2BC45 | vurgu, KPI, uyarı-dışı highlight |
| `ink` Sıcak kömür | #221F1B | #F3EEE6 | metin |
| `surface` Un/krem | #FBF8F2 | #16140F | zemin |
| `card` | #FFFFFF | #201D18 | panel |
| `line` | #EAE3D6 | #332E27 | kenarlık |
| sinyal: ok #0F766E (petrol), wait #D97706, stop #DC2626, info #2563EB | | | durum |

Font: **Outfit** (başlık) + **Inter** (gövde) + **JetBrains Mono** (rakam/gramaj/tutar — tabular). Token sistemi manitou'daki `@theme` yaklaşımıyla (`src/index.css`), dark mode `data-theme` ile. TV/mutfak ekranı koyu tema, büyük tipografi.

## Mimari

- Yeni Vite + React 19 + TS + Tailwind v4 projesi bu repoda (xx'i kopyalamıyoruz; sayfa fikirlerini ve bileşenleri port ediyoruz).
- **UI primitive'leri** manitou `src/ops/ui.tsx`'ten port: `Panel`, `Pill`, `Button`, `Field`, `Tabs`, `cx` + yeni `ModuleHero` (sayfa başlığı + KPI şeridi), `DataTable`, `EmptyState`, `Money`, `Qty`.
- **Veri katmanı:** localStorage/mock yok. `@tanstack/react-query` + tipli `api/*.ts` modülleri; hatalar toast'a düşer, iyimser güncelleme yok (tutarlılık önce).
- **Supabase:** migration dosyaları `supabase/migrations/`; auth + `team_members(role)` + `has_role()` + rol bazlı RLS + `audit_log` trigger (manitou `20260923100000_ops_security_audit.sql` kalıbı). Kritik hesaplar **Postgres fonksiyonlarında** (tek doğruluk kaynağı):
  - `recipe_cost(recipe_id)` — brüt gramaj × ağırlıklı ort. maliyet
  - `explode_orders(date)` — D+1 siparişleri × menü × reçete → hammadde ihtiyacı
  - `purchase_needs(date)` — ihtiyaç − (stok − rezerve) → tedarikçi bazlı liste
  - `issue_to_production(plan_id)` — `stock_movements` 'cikis_uretim' yazar (transaction)
  - `invoice_from_waybills(customer, period)` — irsaliyeleri tek faturaya bağlar
  - `monthly_pnl(month)` view

### Şema (özet)
`units`, `ingredients`(fire %, stok birimi, ort. maliyet, alerjen[], min stok) · `suppliers` · `purchase_invoices`/`_lines` (ort. maliyeti günceller) · `stock_lots`(SKT) · `stock_movements`(giris_alis, cikis_uretim, fire, sayim_duzeltme) · `recipes`(kategori, porsiyon adı) · `recipe_ingredients`(net_g, fire override) · `menus`/`menu_items`(3–4 kap) · `menu_plans`(tarih, öğün, müşteri grubu → menü) · `customers`(VKN/TCKN, vergi dairesi, tabldot fiyatı, vade, e-fatura mükellefi mi) · `customer_sites`(teslim noktası) · `daily_meal_orders`(tarih, öğün, müşteri, adet, diyet adet, revizyon) · `production_plans`/`_lines` · `vehicles` · `deliveries`/`waybills`(teslim adet, imza görseli, sıcaklık, şoför) · `sales_invoices`/`_lines`(UBL alanları, tevkifat, durum: taslak/gönderildi/onaylandı) · `payments`(tahsilat/ödeme, çek/havale, vade) · `employees`, `timesheets`, `advances`, `payroll_costs`(aylık işveren maliyeti) · `fixed_costs`(ay, kategori, tutar) · `food_samples`(şahit numune) · `approvals` (xx'ten).

## Modüller & xx'ten eşleme

| Yeni modül | xx karşılığı | Not |
|---|---|---|
| Komuta Merkezi (dashboard) | DashboardPage | harita yerine: yarının sipariş sayısı, kesime kalan süre, eksik hammadde, bugünkü teslim durumu, aylık porsiyon maliyeti |
| Reçeteler & Gramaj | Filo (FleetPage) | reçete editörü, canlı porsiyon maliyeti |
| Menü Planı | — | takvim görünümü |
| Siparişler (D-1) | — | müşteri × öğün grid, 16:00 kilidi |
| Üretim & MRP | — | patlatma, ihtiyaç listesi, sevk |
| Depo & Stok | — | hareketler, sayım, SKT |
| Satınalma & Tedarikçi | Finans/masraf | alış faturası, ödeme takvimi |
| Sevkiyat & Araçlar | Filo + OperatorPage | şoför mobil irsaliye + imza |
| Cari & Fatura | Finans/makbuz | toplu fatura, tahsilat |
| Personel & Puantaj | PersonnelPage + Onay | mesai/avans onayı |
| Maliyet & Kâr | — | P&L, porsiyon başı maliyet |
| Mutfak Ekranı | TvBoardPage | bugün üretilecekler, koyu tema |

## Fazlar

1. **Temel (bu tur):**
   - Vite/React 19/TS/Tailwind v4 iskeleti, `package.json` scriptleri (dev, build, lint=tsc, test=vitest).
   - `src/index.css` `@theme` token'ları (açık + `[data-theme=dark]`), Google Fonts (Outfit/Inter/JetBrains Mono).
   - `src/ui/` primitive'ler (manitou `src/ops/ui.tsx` port) + `ModuleHero`, `DataTable`, `EmptyState`, `Money`, `Qty`, toast.
   - App shell: sol sidebar (masaüstü) + alt bar/çekmece (mobil), rota: basit pushState router (xx `App.tsx` kalıbı) → modül kayıt dizisi.
   - Supabase: `src/lib/supabase.ts` (hardcode URL yok, env zorunlu), giriş ekranı (e-posta+şifre), `session` context.
   - Migration `0001_core_security.sql`: `team_members(user_id, role, customer_id)`, `has_role()`, `is_staff()`, `audit_log` + `log_audit()` trigger (manitou kalıbı), `updated_at` trigger.
   - Diğer modüller sidebar'da "yakında" durumunda (sahte veri yok).
2. **Reçete çekirdeği (bu tur):**
   - Migration `0002_recipes.sql`: `units`, `ingredients`, `ingredient_prices` (fiyat geçmişi; ort. maliyet şimdilik elle/son fiyat, alış faturası Faz 3'te bağlanır), `recipe_categories`, `recipes`, `recipe_ingredients`, `menus`, `menu_items`; RLS: personel rolleri okur, yönetici/aşçıbaşı/satınalma yazar; hepsine audit trigger.
   - SQL: `ingredient_gross_qty()`, `recipe_cost(recipe_id)`, `menu_cost(menu_id)`, `v_recipe_costs` view.
   - Ekranlar: **Hammaddeler** (liste, kart: birim, fire %, fiyat, alerjen, min stok), **Reçeteler** (editör: satır ekle, net gr → brüt gr + satır maliyeti canlı; toplam porsiyon maliyeti; 1.000 porsiyon ön-hesap önizlemesi), **Menüler** (3/4 kap kombinasyon, toplam maliyet, hedef satış fiyatına göre marj).
   - Dashboard ilk sürüm: reçete/hammadde sayıları, en pahalı porsiyonlar, fiyatı güncel olmayan hammaddeler.
   - Başlangıç verisi: yalnızca **birimler** ve **reçete kategorileri** (referans veri); hammadde/reçete kullanıcı girer (mock yok).
3. **Sipariş → MRP → Stok:** müşteri + **müşteri portalı**, D-1 sipariş, menü planı, patlatma, ihtiyaç listesi, stok hareketleri, alış faturası.
4. **Sevkiyat & Fatura:** araç, irsaliye (şoför mobil), toplu fatura (UBL alanları, entegratör adaptör arayüzü — gönderim stub), tahsilat/ödeme.
5. **Personel & Maliyet:** puantaj/mesai/avans/onay, işveren maliyeti girişi, sabit giderler, aylık P&L, porsiyon maliyeti.
6. **Gıda güvenliği & Mutfak ekranı:** numune, lot/SKT, alerjen, sıcaklık, TV ekranı.

Her faz ayrı commit(ler), `claude/catering-erp-transformation-lxyhbx` dalına push, draft PR.

## Doğrulama

- `npm run lint` (tsc) + `npm run build` her fazda.
- SQL fonksiyonları için `supabase/tests/*.sql` senaryoları: 1.200 porsiyon Orman Kebabı → 144 kg net kuşbaşı; %X fire ile brüt; stok 100 kg iken ihtiyaç listesinde 44 kg+ fire.
- Birim testleri (vitest) istemci tarafı formatlama/dönüşüm için.
- Uygulamayı Playwright (hazır Chromium) ile açıp ana akışların ekran görüntüsü; açık/koyu tema kontrolü.
- Supabase MCP ile migration uygulanır ve `get_advisors` ile RLS/güvenlik uyarıları kontrol edilir.
