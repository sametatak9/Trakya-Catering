# CLAUDE ANA PROMPT — Trakya Catering ERP (tek belge, eksiksiz)

> ## 🚨 EN ÖNEMLİ ÇALIŞMA TALİMATI (her şeyden önce oku, her şeyin üstündedir)
> 1. **Kullanıcı ilerlemeyi telefondan takip ediyor.** Uyusa ya da cevap vermese bile **tüm izinleri verdi.** Soru sorup **beklemeden**, §8'deki tüm fazları öncelik sırasıyla (3A → 3B → 3C-0 → 3C → 3D → 3E → 3F → 3H → 3G → 4 → 5 → 6 → 7 → 8A → 8 → 8B → 9 → 10) **baştan sona kendin tamamla.** Belirsiz bir noktada en makul, güvenli ve geri alınabilir varsayımı seç; varsayımı `docs/PLAN.md`'ye ve faz raporuna yaz, sonra devam et. §10'daki açık sorular **işi durdurmaz**: yedek yolla ilerle, soruları raporda listele.
> 2. **Her faz bittiğinde, push'tan önce, o fazın yöntemi uygulamada gerçekten çalışıyor mu test et:**
>    - `npm run build`, typecheck (`tsc --noEmit`), lint;
>    - birim testleri (Vitest) ve entegrasyon/SQL testleri (`supabase/tests/*.sql`, RLS dahil);
>    - fazın §8'deki kabul kriterleri;
>    - mümkünse Supabase branch'i veya yerel Supabase üzerinde `begin … rollback` ile uçtan uca test (§9).
> 3. **Testler geçerse `main`'e push et.** Geçmezse düzelt ve testleri yeniden çalıştır; hepsi yeşil olana kadar tekrarla. **Kırık, test edilmemiş ya da build almayan kodu asla `main`'e gönderme.**
> 4. **Canlı site senkronu:** Render canlı sitesi şu anda `claude/catering-erp-transformation-lxyhbx` dalını izliyor. `main`'e yaptığın her push'tan hemen sonra **aynı commit'i bu dala da push et** (ör. `git push origin main:claude/catering-erp-transformation-lxyhbx`), böylece iki dal hep aynı commit'te kalır ve değişiklik canlıya çıkar. Dal ayrışmışsa önce `main`'i dala birleştir (merge), force-push yapma.
> 5. **Her fazdan sonra** `docs/PLAN.md`'yi güncelle (tamamlananlar, varsayımlar, sıradaki faz) ve §8.E şablonuna göre **kısa bir faz raporu** yaz (`docs/raporlar/faz-XX.md` + commit mesajı özeti). Kullanıcı bu raporları telefondan okuyacak.
> 6. Canlı veritabanı migration'ları: yalnız eklemeli olur ve önce dev/branch/yerelde test edilir. Testler geçince canlıya uygulanır; ne uygulandığı faz raporunda yazılır. Kullanıcı panelinden yapılması gereken ayarlar (sızdırılmış parola koruması, Auth Site URL) için adım adım talimatı raporun başına koy; bunlar yapılmadı diye bekleme.
> 7. **Öncelik:** Bu belgede alıntılanan kaynak bölümlerde (§5, §6, §8) "kullanıcı onayı", "onay bekle", "yalnız dalda çalış" ya da "taslak PR" gibi ifadeler bu talimata göre okunur: iş durmaz, varsayılanla devam edilir, test geçince main'e ve canlı dala push edilir. (Uygulama içi **Onaylar** iş akışı, yani yöneticinin satınalma planı ve gider onayı, bir ürün özelliğidir; bu kuraldan etkilenmez.)
> 8. **Elindeki mevcut işle entegre yürüt:** Devam eden işin bu planla örtüşen kısımlarını plana bağla ve birlikte ilerlet. Elindeki iş bu plandan farklıysa onu sıraya koy: yarım kalanı kırık bırakmadan güvenli bir noktada durdur ve `docs/PLAN.md`'ye yaz. **Bu büyük planı bitirmek her şeyden önceliklidir.**

*Hazırlanma: 27 Eylül 2026, TSİ. Sahibi: Hüseyin Samet Atak (Trakya Catering, toplu yemek fabrikası, Çorlu). Bu belge Claude Code'a doğrudan verilir. Bu belgeden başka yalnız **veri paketi** (`claude-veri-paketi.zip`) vardır.*

> Belgedeki "kullanıcı" = işletme sahibi. Kullanıcı yalnız **niyeti** tarif eder. Matematiği, veri modelini, algoritmaları ve testleri **sen (Claude)** sağlam biçimde tasarlarsın. Gerekçelerini `docs/PLAN.md` içinde kısaca yaz.
> Asistan makinesindeki görseller ve HTML maketleri sana ulaşmaz. Her ekran bu belgede sözle ve token/CSS değerleriyle tarif edildi; tarife uy.


---

## 0) Nasıl kullanılır — rolün ve altın kurallar

**Rolün:** Kıdemli ürün mimarı ve tam yığın geliştirici (React + TypeScript + Vite + Tailwind v4 + TanStack Query + Supabase/Postgres/RLS/Edge Functions). Görevin, mevcut Trakya Catering ERP'yi **bozmadan** bu belgedeki tüm gereksinimlere göre fazlar hâlinde geliştirmek.

**Altın kurallar (her PR'da geçerli):**
1. **Çalışan hiçbir özelliği bozma.** Mevcut rotalar, RPC'ler (`save_recipe`, `save_menu`, `recipe_scale`, `plan_production_from_orders`, `plan_prep_from_orders`, `prep_fill_from_recipe`, `recipe_from_prep`, `order_is_open`, `portal_set_order` …), token adları (`--tc-*`, `bg-brand`, `text-ink-3`), `src/ui/` bileşen API'leri ve RLS yardımcıları (`has_role`, `is_staff`, `current_customer_id`, `current_app_role`) korunur. Kaldırılan ekranların eski yolları yeni yerlerine yönlendirilir.
2. **Yalnız eklemeli (additive) migration.** Yeni tablo, sütun, fonksiyon ve politika eklenir. Veri kaybettiren `drop`/`alter type` yapılmaz; zorunlu değişikliklerde önce geçiş (backfill) yapılır, sonra kısıt eklenir. Migration adları `YYYYMMDDHHMMSS_ad.sql` biçimindedir ve **canlıdaki sürüm numaralarıyla uyumlu** olmalıdır (bkz. §2.4 M-1).
3. **Her yeni tabloda RLS açık** olur ve **9 rolün + kurucunun** her biri için okuma/yazma kuralı (bkz. §8, B matrisi) yazılır. Yeni rol `ik` eklenirse eski değerler korunur. `(select auth.uid())` kalıbı kullanılır; işlem başına tek politika tercih edilir; FK'lara index eklenir; SECURITY DEFINER fonksiyonlarda `set search_path = public` ve yetki kontrolü bulunur, `anon`'a `execute` verilmez.
4. **Test zorunlu:** Her faz `supabase/tests/*.sql` (begin … rollback; RLS dahil), Vitest (iş mantığı) ve gerektiğinde Playwright testi içerir. CI (typecheck + lint + test + build) ve fazın kabul kriterleri yeşil olmadan `main`'e push yapılmaz.
5. **Canlı veritabanına doğrudan dokunma.** Canlı proje: `gbuwcrajpbnjqwqrftgs`. Geliştirme ve test için ayrı Supabase projesi, Supabase branch'i veya yerel Supabase kullanılır. Migration önce dev ortamında denenir; testler geçince canlıya alınır (kullanıcı izin verdi, bekleme yok; faz raporunda belirt).
6. **Tasarım dili "Hasat 2.0"** korunur ve uygulanır (bkz. §6). Yeni ekran bu kalıbın dışına çıkmaz.
7. **Dal ve yayın:** Geliştirmeyi yerelde veya konu başına kısa ömürlü dallarda yap. Faz testleri geçince `main`'e push et, ardından aynı commit'i `claude/catering-erp-transformation-lxyhbx` dalına da push et (Render canlı sitesi bu dalı izliyor; iki dal hep senkron kalır). Force-push yapılmaz. Commit mesajları Türkçe ve açıklayıcı olur.
8. **Belgeler:** Her faz sonunda `docs/PLAN.md` ve `docs/BACKLOG.md` güncellenir, `generate_typescript_types` → `src/lib/database.types.ts` yenilenir, `get_advisors` (security + performance) çalıştırılır ve **yeni WARN bırakılmaz**. Kullanıcıya §8.E şablonuyla kısa faz raporu verilir (bekleme yok, sonraki faza geç).
9. **Uydurma veri yok.** Demo verisi yalnız `src/demo` altında durur ve "Örnek veri" rozeti taşır.
10. **Dış servis anahtarı gereken işler** (WhatsApp Business, Meta Graph, Google Directions/Maps, e-posta sağlayıcı, e-Fatura entegratörü, parmak izi cihazı API'si, LLM) 🔌 olarak işaretlenir. Anahtarsız çalışan yedek yol **mutlaka** yapılır: wa.me linki, Google Maps URL, elle giriş, XLS/XLSX içe aktarma. Anahtarlar yalnız Edge Function secrets/Vault'ta tutulur, istemciye konmaz.
11. **Bağlayıcı iş kuralları** (§3): muhasebe tek gider kuralı, öğün boyutu, 1 kişilik reçete, sürüm ve değişmezlik, onay akışı. Bunlarla çelişen hiçbir kod yazılmaz.
12. **Türkçe:** Arayüz, rapor, hata mesajı, commit ve belge dili Türkçedir. Sayılar TR biçiminde gösterilir (`1.250,50 ₺`, `%31,4`); tarih ve saat Europe/Istanbul.


---

## 1) Proje bağlamı ve mevcut durum

### 1.1 İşletme ve amaç
- Trakya Catering, fabrika, okul, hastane ve kurumlara günlük toplu yemek üreten ve dağıtan bir yemek fabrikasıdır. **Üç ayrı hizmet satılır: kahvaltı, öğle ve akşam** (şemada `gece` de var ve korunur).
- Amaç, bulut tabanlı, hızlı, görsel olarak güçlü ve kolay kullanılan bir ERP'dir. Mutfak, üretim, sipariş, stok, satınalma, finans/muhasebe, lojistik, personel, pazarlama/sosyal medya ve yönetim tek sistemde birbirine bağlı çalışır.
- **Kalp:** 1 porsiyon ve 1 menü kaça mal oluyor, her gün, güncel fiyatlarla ve öğün bazında. Rakipler (FoodSoft, Çözbim vb.) eski kaldı; biz modern, sade, yapay zekâ yardımcılı ve patron dostu bir ürün yapıyoruz. Hammadde fiyatları, stok maliyetleri ve cari bakiyeler hep güncel görünür, önemli şeyler hatırlatılır.
- **Üretimhane çalışanlarının çoğu ilkokul mezunu.** Mutfak ekranları ve raporları büyük yazılı, simgeli, adım adım ve sade dilli olmalıdır.
- **Ürün stratejisi:** çok modül değil, şu akışın kusursuz bağlanması: **müşteri siparişi (kesim saatli) → satınalma → üretim ve fiili tüketim → irsaliye ve teslim → ay sonu toplu e-fatura → müşteri/öğün bazında kâr.** Rakiplerin en çok şikâyet aldığı iki konu zor kurulum ve zayıf mobil uygulamadır; bu ikisini en iyi biz yapmalıyız.

### 1.2 Teknik durum (27.09.2026)
- **Repo:** `sametatak9/Trakya-Catering` (public). Çalışma dalı `claude/catering-erp-transformation-lxyhbx`; `main` yalnız ilk commit'te. Açık taslak PR #1 (`claude/...` → `main`).
- **Önemli commit'ler:** `8a5a188` (şema, RLS, audit, maliyet motoru, SQL testleri), `088449d` (Faz 1+2 arayüzü), `22725a8` (finans çekirdeği) ve sonrası (mutfak hazırlık, sohbet + maliyet geçmişi, operasyonlar, müşteri sipariş linki).
- **Yığın:** React + TS + Vite + Tailwind v4 (`@theme inline`, `--tc-*` token'ları), TanStack Query, Supabase (Auth, Postgres, RLS, Storage, Realtime). `src/app/modules.ts` modül ve rol tanımlarını, `src/app/Shell.tsx` kabuğu, `src/ui/` bileşenleri, `src/lib/format.ts` TR biçimlendirmeyi, `src/demo/` demo motorunu içerir.
- **Supabase `gbuwcrajpbnjqwqrftgs`:**
  - 10 migration uygulanmış: core_security, recipes, function_hardening, save_rpcs, guard_last_admin_cascade, finance_core, kitchen_prep, chat_and_cost_history, operations, customer_order_link. **Sürüm numaraları repo dosya adlarıyla uyuşmuyor** (§2.4 M-1).
  - 43 tablonun hepsinde RLS açık.
  - Eklentiler: plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault. **pg_trgm, pg_cron ve unaccent yok**; gerekiyorsa migration'la eklenir.
  - Auth'ta 1 kullanıcı (kurucu). Storage bucket: `visit-photos` (private). Realtime yayınında yalnız `chat_messages` var.
  - İş tabloları boş. Referans veriler: units 5 (g, kg, ml, lt, adet), recipe_categories 9 (corba, ana_yemek, sebze, pilav_makarna, salata_meze, tatli, icecek, kahvalti, ekmek), finance_categories 20, finance_accounts 2.
- **Mevcut tablolar (public):** team_members, audit_log, role_permissions, member_permissions, employees, attendance_days, employee_ledger, employee_requests, stock_movements, suppliers, supplier_quotes, supplier_categories, purchase_orders, delivery_notes, sales_invoices, purchase_invoices, cheques, vehicles, vehicle_logs, routes, units, recipe_categories, ingredients, ingredient_prices, recipes, recipe_ingredients, recipe_cost_snapshots, menus, menu_items, menu_plans, meal_orders, customers, prep_batches, prep_batch_items, quotes, leads, field_visits, social_posts, finance_categories, finance_accounts, finance_entries, company_settings, chat_messages.
  - Görünümler: v_recipe_lines, v_recipe_costs, v_menu_costs, v_account_balances, v_prep_items, v_prep_batch_costs.
- **Önemli şema gerçekleri:**
  - `ingredients.category` CHECK: et_tavuk, balik, sebze_meyve, bakliyat_tahil, sut_urunleri, yag, baharat_sos, kuru_gida, icecek, ekmek_unlu, temizlik_sarf, diger. `stock_unit` → `units(code)`. `vat_rate` yüzde tutar, varsayılan 1. `allergens text[]` 14 AB alerjeni: gluten, kabuklu_deniz, yumurta, balik, yer_fistigi, soya, sut, sert_kabuklu, kereviz, hardal, susam, sulfit, aci_bakla, yumusakca.
  - `menus.meal`, `meal_orders.meal`, `menu_plans.meal`, `prep_batches.meal` ∈ {kahvalti, ogle, aksam, gece}.
  - `menus.kind` ∈ {standart, kahvalti, soguk_mezeli, diyet, ozel}.
  - `menu_items.course` ve `prep_batches.course` ∈ {corba, ana, yardimci, salata, meze, tatli, icecek, ekmek, kahvalti}.
  - Tasarım belgelerinde geçen `production_logs` canlıda **yok**; mutfak üretimi `prep_batches`/`prep_batch_items` ile tutuluyor. Mutfak durum alanlarını buna göre uyarla.
- **Render:** static site `trakya-catering`, https://trakya-catering.onrender.com. Canlı deploy eski bir commit'te kalmış olabilir (`22725a8` otomatik deploy edilmemişti). SPA yönlendirme kuralı (`/*` → `/index.html`, Rewrite) eklenmeli. Supabase Auth **Site URL** ve **Redirect URL** Render adresine göre ayarlanmalı (kullanıcıdan teyit, §10).
- **Rakiplerden alınacak kısa özellik notları:** §5.C ve §5.D'de.
- **Tamamlanan modüller (önceki fazlar):** Bugün paneli; Mutfak (hammaddeler, reçeteler ve gramaj, menüler, günlük üretim/hazırlık ve maliyet); Satış (müşteriler, siparişler, teslimde otomatik gelir, portal token linki, 16:00 kesim); Finans (özet, giderler, gelen faturalar UBL-TR XML, kasa ve gelirler); Ekip ve yetkiler (9 rol + kurucu); sohbet; operasyon ekranları (satınalma, araçlar, rotalar, personel, puantaj, teklifler, saha, sosyal gönderiler).
  - Toplam **30 modül/sekme**; bu sayı 14 modüle indirilecek (§4).
- **Roller (mevcut):** kurucu, yonetici, asci_basi, diyetisyen, depo, satinalma, muhasebe, pazarlamaci, sofor, musteri. **Eklenecek:** `ik` (İnsan Kaynakları) ve baş şoför işareti `team_members.is_lead`.


---

## 2) Önce kritik düzeltmeler (başka hiçbir işe başlamadan)

Aşağıdaki listenin tamamı **Faz 3A**'dır. Hepsi birleşmeden tasarım veya yeni modül işine geçilmez. Sıra bağlayıcıdır.

### 2.1 Birleşik öncelik listesi
0. **M-1 migration sürüm kayması** (diğer tüm migration'lardan önce). Repo dosya adları canlı sürüm numaralarıyla uyuşmuyor. Çözüm şu iki yoldan biridir; varsayılan olarak ilkini uygula ve raporla:
   - repo dosyalarını canlı sürümlere göre yeniden adlandırmak (en az riskli);
   - `supabase migration repair` kullanmak.
   Yeni migration'lar `20260930120000` ve sonrasıyla numaralanır. Tablo §2.4'te.
1. **Admin/kurucu yetki yükseltme açığı (S-4).** `yonetici` kendini veya başkasını `kurucu` yapabiliyor. `team_members` insert/update with check: `role <> 'kurucu' or current_app_role() = 'kurucu'`; yönetici kendi rolünü değiştiremez. Admin bootstrap yarışı ve son adminin silinmesi guard'ı korunur ve testlenir (devir raporu 8).
2. **Portal RLS açığı (S-2, devir 1).** Müşteri `unit_price`, `vat_rate`, `menu_id`, `kind`, `delivered_qty` yazabiliyor ve teslimde gelir bu fiyattan oluşuyor. BEFORE INSERT/UPDATE tetikleyicisi, musteri rolünde fiyat, KDV ve menüyü müşteri kartından (sonra `customer_menus`'tan) zorlar; `delivered_qty` null, `kind='sozlesmeli'` olur.
3. **Personel maaş ve IBAN sızıntısı (S-1).** `employees_read` yalnız yonetici/muhasebe (+ ik) ve kendi satırı için açılır. Diğer roller için yalnız ad, unvan, departman ve telefon içeren `v_employee_directory` eklenir.
4. **Kendi talebini onaylama (S-3).** `employee_requests_self_insert` with check: `status='bekliyor' and decided_by is null`.
5. **stock_unit değişimi (devir 2).** Birim değişince fiyat ve miktarlar eski birimde kalıyor, maliyet sessizce bozuluyor. DB tetikleyicisi, hareket veya fiyat geçmişi olan kalemde birim değişimini engeller ya da `units.to_base` ile dönüştürür (fiyat, avg_cost, min_stock, reçete satırları, hareketler; aynı boyut içinde). Farklı boyuttaki değişim (kg → adet) reddedilir. Arayüzde onay diyaloğu ve açıklama gösterilir.
6. **parseNum / ondalık (devir 3).** `"1.250"` 1,25 olarak okunuyor. TR binlik (`.`) ve ondalık (`,`) doğru ayrıştırılmalı: `1.250` → 1250, `1,25` → 1,25, `1.250,5` → 1250,5. Belirsiz durum (`1.250` ve alan ondalık bekliyor) için kural yazılır ve testlenir. "Pişmiş porsiyon" ve tüm sayı alanları virgüllü ondalık kabul eder. `src/lib/format.ts` için Vitest tablo testleri yazılır.
7. **Fiyat sütunu yetkisi (devir 4).** `last_price` ve `avg_cost` doğrudan UPDATE ile değiştirilemez (aşçıbaşı dahil). Sütun bazında `revoke update(last_price, avg_cost)` uygulanır; bu alanlar yalnız fiyat/stok RPC'leri ve tetikleyicilerle değişir. Fiyatı kimin, ne zaman, hangi belgeyle güncellediği `ingredient_prices` ve `audit_log`'da tutulur.
8. **Çıkışta önbellek (devir 5).** `signOut` sonrası `queryClient.clear()` çağrılır ve kullanıcıya özel durum sıfırlanır.
9. **Canlı DB riski (devir 6).** `.env.example` ve SQL testleri canlı projeyi göstermez; ayrı dev/test projesi ya da yerel Supabase kullanılır.
10. **CI (devir 7).** GitHub Actions: typecheck, lint, Vitest, SQL testleri (yerel Supabase), build ve `database.types.ts` farkı kontrolü.
11. **Çift stok girişi (B-3) ve muhasebe kuralı.** PO teslimi ve fatura aynı malı iki kez stoğa sokuyor. Tek kapı kuralı uygulanır: `purchase_invoices.purchase_order_id` + `stock_movements (source, source_id, ingredient_id)` partial unique + `stock_movements.supplier_id`. Gider yalnız faturada, bir kez yazılır; PO teslimi ve üretim gider yazmaz (§3.1).
12. **avg_cost iki yerden yazılıyor (B-4).** `avg_cost` yalnız stok girişinden hesaplanır; fiyat girişi yalnız `last_price`'ı değiştirir.
13. **Stok hareketleri değişmez (B-5).** Düzeltme ters kayıtla yapılır; upd/del yalnız yöneticiye açıktır; sofor yalnız `kind='sevk'` yazar; `sayim` = fark (delta) olarak belgelenir.
14. **Diğer hatalar:**
    - B-1: fiyat 0 ise teslimde uyarı/engel.
    - B-2: `portal_set_order` çoklu menü + onay kaybı.
    - B-6: `recipe_from_prep` reçeteyi ezmesin, kalibrasyona dönsün.
    - B-7: plan sayacı + iptal edilen başlıklar.
    - B-8: tevkifat + ödenmiş fatura silme.
    - B-9: maaş tahakkuk esası.
    - B-10: firmaya özel kesim saati.
    - B-11: rol×modül matrisi RLS'e bağlansın ya da belgelensin.
    - B-12: Realtime yayını.
    - B-13: types üretimi.
    - Ayrıntılar §2.3'te.
15. **Advisor düzeltmeleri:**
    - `(select auth.uid())` initplan (3 politika);
    - çoklu izin politikalarının birleştirilmesi (5);
    - 39 indekssiz FK'ya `create index if not exists`;
    - `revoke truncate, trigger, references … from anon, authenticated` (S-6);
    - token'ın ayrı tabloya taşınması ve hız sınırı (S-5);
    - SECURITY DEFINER yardımcılarının `private` şemaya taşınması (iyileştirme).
16. **Auth ve deploy (Dashboard ayarları kullanıcıdadır; faz raporunun başına adım adım talimat yaz, beklemeden devam et):**
    - sızdırılmış parola korumasını aç;
    - Site URL / Redirect URL = `https://trakya-catering.onrender.com`;
    - Render SPA rewrite kuralını ekle;
    - otomatik deploy'u doğrula.
17. **Erken altyapı:**
    - `audit_log` değişmezliği (UPDATE/DELETE/TRUNCATE yasak + hash zinciri);
    - istemci hata yakalama (`error_events` + `log_client_error`);
    - Realtime yayını (`meal_orders`, `prep_batches`, `employee_ledger`, `stock_movements`).
    Ayrıntı: §8 Faz 3A.

**Kabul (3A):**
- Güvenlik testleri (S-1…S-6) SQL'de 42501 veya beklenen hata veriyor.
- parseNum tablo testleri geçiyor.
- CI yeşil.
- Advisor'da yeni WARN yok; leaked password WARN'ı kapandı (kullanıcı ayarı).
- M-1 çözüldü (`supabase migration list` repo ile aynı).



### 2.2 Devir raporundaki 8 kritik düzeltme ve advisor özeti (orijinal metin)
> Kaynak: `claude-devir-raporu.md` satır 20–36 (birebir alıntı; başlık seviyeleri düşürüldü).

#### 3. Önce düzeltilmesi gerekenler (öncelik sırasıyla)
1. **Portal RLS açığı:** Müşteri rolü kendi siparişini eklerken `unit_price` ve `menu_id` değerlerini serbestçe yazabiliyor. Teslimde bu fiyat gelire geçiyor. Portal ekranından önce kapatılmalı.
2. **stock_unit değişimi:** Birim değişince fiyat ve miktarlar eski birimde kalıyor ve maliyetler sessizce bozuluyor. Veritabanında da arayüzde de koruma yok.
3. **parseNum:** `"1.250"` 1,25 olarak okunuyor. Türkçe binlik ve ondalık ayracı düzeltilmeli. "Pişmiş porsiyon" alanı virgüllü ondalık kabul etmiyor.
4. **Fiyat sütunu yetkisi:** `last_price` ve `avg_cost`, hammadde yazma yetkisi olan herkes (aşçıbaşı dahil) tarafından doğrudan değiştirilebiliyor.
5. **Çıkışta önbellek:** `signOut` TanStack Query önbelleğini temizlemiyor.
6. **Canlı veritabanı riski:** `.env.example` ve SQL testleri canlı projeyi gösteriyor. Ayrı bir geliştirme veya test projesi ya da yerel Supabase kullanılmalı.
7. **CI yok:** typecheck, lint, test ve build için GitHub Actions eklenmeli.
8. (Düşük öncelik) Admin bootstrap yarışı ve son adminin silinmesi durumu. Admin artık mevcut, pratik risk düşük.

#### 4. Supabase advisor uyarıları
- 8 SECURITY DEFINER fonksiyonu API'den çağrılabiliyor. `needs_bootstrap` anonim kullanıcıya açık, migration notlarına göre bu bilinçli.
- Sızdırılmış parola koruması kapalı.
- team_members politikasında `auth.uid()` her satırda yeniden hesaplanıyor; `(select auth.uid())` kullanılmalı.
- meal_orders ve customers tablolarında aynı işlem için birden çok izin politikası var.
- 12 yabancı anahtarda index yok.



### 2.3 Supabase advisor bulguları, eksik FK'lar ve şüpheli hatalar (S-/B- kodları)
> Kaynak: `notlar-analiz/supabase-kontrol.md` satır 75–144 (birebir alıntı; başlık seviyeleri düşürüldü).

#### 3. Advisor bulguları

##### 3.1 Güvenlik (security)
| Seviye | Lint | Bulgu | Değerlendirme |
|---|---|---|---|
| WARN | 0028 anon_security_definer_function_executable | `needs_bootstrap()`, `portal_info(uuid)`, `portal_set_order(...)`, `public_card(text)` anon çağırabilir | **Bilinçli** (giriş ekranı, token'lı sipariş linki, kartvizit). Kalabilir; ancak `portal_set_order` için hız sınırı yok ve token tüm personele görünür (bkz. S-5). [Doküman](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) |
| WARN | 0029 authenticated_security_definer_function_executable | `current_app_role`, `current_customer_id`, `has_role`, `is_staff`, `list_pending_users`, `list_team`, `needs_bootstrap`, `portal_info`, `portal_set_order`, `public_card` | RLS yardımcıları yalnız çağıranın kendi bilgisini döndürür; `list_*` içeride yönetici kontrolü yapıyor. **Kabul edilebilir.** İyileştirme: yardımcıları `private` şemaya taşıyıp API'den gizlemek. [Doküman](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| WARN | auth_leaked_password_protection | Sızdırılmış parola koruması kapalı | **Açılmalı** (Dashboard → Auth → Password security). [Doküman](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |

##### 3.2 Performans (performance)
| Seviye | Lint | Adet | Değerlendirme |
|---|---|---|---|
| WARN | 0003 auth_rls_initplan | 3 | `team_members_read`, `chat_messages_delete`, `employee_requests_self_insert` → `auth.uid()` yerine `(select auth.uid())`. [Doküman](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) |
| WARN | 0006 multiple_permissive_policies | 5 | `customers` SELECT, `employee_requests` INSERT, `meal_orders` INSERT/SELECT/UPDATE: personel + portal politikaları ayrı. Veri küçükken sorun değil; birleştirilebilir (`is_staff() or customer_id = current_customer_id()`). [Doküman](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) |
| INFO | 0001 unindexed_foreign_keys | 39 | Aşağıdaki liste. [Doküman](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) |
| INFO | 0005 unused_index | 11 | DB boş olduğu için anlamsız; **silmeyin**. |

Ek performans notu: tüm politikalar `has_role(array[...])` / `is_staff()` çağırıyor; STABLE olsalar da satır başına değerlendirilebilir. Yeni politikalarda `(select public.has_role(array[...]))` kalıbı kullanılsın (initplan önbelleği).

##### 3.3 İndekslenmemiş FK'lar (öneri: tek migration, `create index if not exists`)
```
chat_messages(author_id) · cheques(account_id) · cheques(customer_id) · cheques(supplier_id)
delivery_notes(customer_id) · delivery_notes(sales_invoice_id) · employee_ledger(account_id)
employee_requests(employee_id) · employees(user_id) · field_visits(customer_id) · field_visits(lead_id)
field_visits(user_id) · finance_entries(account_id) · finance_entries(category_code, kind)
finance_entries(customer_id) · ingredients(stock_unit) · leads(assigned_to)
meal_orders(customer_id, service_date) · meal_orders(menu_id) · menu_plans(customer_id) · menu_plans(menu_id)
prep_batch_items(unit) · prep_batches(customer_id) · prep_batches(menu_id) · prep_batches(recipe_id)
purchase_invoices(category_code, kind) · purchase_orders(supplier_id) · quotes(customer_id) · quotes(lead_id)
quotes(menu_id) · recipes(category_code) · routes(driver_id) · routes(vehicle_id) · routes(route_date)
sales_invoices(customer_id) · supplier_categories(category_code) · supplier_quotes(supplier_id)
team_members(customer_id) · vehicle_logs(account_id) · vehicles(driver_id)
```
Referans tablolar (`units`, `recipe_categories`, `finance_categories`) için indeks düşük önceliklidir.

##### 3.4 Eksik FK / bütünlük
| Yer | Sorun | Öneri |
|---|---|---|
| `purchase_invoices.supplier_name/supplier_tax_no` | `suppliers` ile bağ yok | `supplier_id uuid references suppliers` (+ VKN ile doldurma) |
| `ingredient_prices.supplier_name` | serbest metin, belge bağı yok | `supplier_id`, `purchase_invoice_id` FK |
| `supplier_categories.supplier_key` | metin anahtar | `suppliers.default_category_code` |
| `purchase_orders.lines`, `delivery_notes.lines`, `sales_invoices.lines`, `routes.stops`, `purchase_invoices.lines` | jsonb içinde id'ler, FK yok | kritik olanlar için satır tablosu (`purchase_order_lines`, `route_stops`, `delivery_note_lines`) |
| `stock_movements.source_id`, `finance_entries.source_id` | polimorfik, FK yok | kabul edilebilir; `source` + `source_id` üzerine indeks ve temizlik tetikleyicileri |
| `quotes.lead_id` | FK var (sonradan eklenmiş) | — |
| `delivery_notes.sales_invoice_id` | FK var | indeks ekle |

#### 4. Şüpheli hatalar ve riskler (migration/fonksiyon incelemesi)

| Kod | Seviye | Yer | Sorun | Öneri |
|---|---|---|---|---|
| **S-1** | **Yüksek** | `employees_read` (operations.sql) | `is_staff()` → şoför, depo, aşçı dahil **herkes maaş, yevmiye, IBAN, telefon** okuyabilir. PersonnelPage'de `canSeePay` ile gizleniyor ama API'den açık. | `employees_read` → `has_role(['yonetici','muhasebe']) or user_id = (select auth.uid())`; diğer roller için `v_employee_directory` (security_invoker değil, **sadece** ad, unvan, departman, telefon) veya `public_card` benzeri RPC. |
| **S-2** | Orta | `meal_orders_portal_insert/update` | Portal müşterisi (`musteri` rolü) `unit_price`, `vat_rate`, `kind`, `menu_id`, `delivered_qty`, `note` alanlarını serbestçe yazabilir; personel "teslim" deyince gelir müşterinin yazdığı fiyattan oluşur. | BEFORE INSERT/UPDATE tetikleyicisi: `current_app_role()='musteri'` ise `unit_price/vat_rate` müşteri kartından (ileride `customer_menus`) zorla, `delivered_qty` null, `kind='sozlesmeli'`. |
| **S-3** | Orta | `employee_requests_self_insert` | Personel kendi talebini `status='onaylandi'`, `decided_by` dolu şekilde ekleyebilir (kendini onaylama). | with check'e `status = 'bekliyor' and decided_by is null`. |
| **S-4** | Orta-Yüksek | `team_members_update/insert` | `yonetici` kendi satırını veya başkasını `role='kurucu'` yapabilir → kurucu yetkisine yükselme (rol×modül matrisini yazar). | with check: `role <> 'kurucu' or public.current_app_role() = 'kurucu'`; ayrıca yönetici kendi rolünü değiştiremesin. |
| **S-5** | Düşük-Orta | `customers.order_token` | Token tüm personele okunur (şoför/depo dahil) — token = firmanın sipariş yetkisi. `portal_set_order` için hız sınırı/denetim izi yok (audit tetikleyicisi auth.uid null → 'system'). | Token'ı ayrı tabloya (`customer_portal_tokens`, okuma: yonetici/muhasebe/pazarlamaci) taşı; `meal_orders.source='portal'` + IP/UA log; token yenileme RPC. |
| S-6 | Düşük | anon/authenticated tablo yetkileri | Supabase varsayılanı: anon'a tüm tablolarda SELECT/INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES verilmiş. RLS okuma/yazmayı engelliyor, PostgREST TRUNCATE sunmuyor; yine de derinlemesine savunma. | `revoke truncate, trigger, references on all tables in schema public from anon, authenticated;` (+ `alter default privileges`). |
| **B-1** | Orta | `sync_order_entry` | `unit_price = 0` olan teslim siparişi **sessizce gelir oluşturmaz** (`new.unit_price > 0` koşulu). Portal, fiyatı olmayan müşteride `unit_price=0` yazıyor. | Teslimde fiyat 0 ise uyarı/engelle (`raise exception` veya `alerts.ts`'ye "fiyatsız teslim" uyarısı); müşteri fiyatı `customer_menus`'tan. |
| **B-2** | Orta | `portal_set_order` | Aynı firma/öğünde birden çok menü siparişi varsa `order by created_at limit 1` ilkini günceller; menü parametresi yok. Onaylı (`onaylandi`) siparişi portal güncelleyince durum `bekliyor`'a döner (onay kaybolur, bilgilendirme yok). | Yeni imzaya `customer_menu_id`; onaylı sipariş değişince bildirim/`chat_messages` kaydı. |
| **B-3** | **Yüksek (veri)** | PurchasingPage `receive()` + InvoicesPage stok aktarımı | Aynı mal **iki kez stoğa girebilir**: PO teslimi (`source='siparis'`, `source_id=po.id`) ve fatura aktarımı (`source='fatura'`, `source_id=invoice.id`); fatura tarafı yalnız aynı fatura id'sini kontrol ediyor. Ortalama maliyet ve stok şişer. | Tek kapı kuralı: `purchase_invoices.purchase_order_id`; PO'su teslim alınmış faturada stok girişi yapılmaz, yalnız fiyat farkı; DB'de benzersizlik (`stock_movements (source, source_id, ingredient_id)` partial unique). |
| B-4 | Orta | `apply_ingredient_price` vs `apply_stock_cost` | `avg_cost` iki farklı yerden yazılıyor: fiyat girişi ilk fiyatla başlatıyor, stok girişi ağırlıklı ortalamayı hesaplıyor → stok yokken girilen fiyat ortalamayı bozar. | `avg_cost` yalnız stok girişinden; `apply_ingredient_price` yalnız `last_price`. |
| B-5 | Orta | `stock_movements` UPDATE/DELETE | Giriş hareketi sonradan düzenlenir/silinirse `avg_cost` yeniden hesaplanmaz (tetikleyici yalnız AFTER INSERT). `sofor` rolü tüm stok hareketlerini silebilir. `sayim` türünde işaret anlamı belirsiz (fark mı, sayılan miktar mı?). | Hareketleri değişmez yap (düzeltme = ters kayıt), upd/del yalnız yonetici; `sayim` = fark (delta) olarak belgele; sofor yazma yetkisini `kind='sevk'` ile sınırla. |
| B-6 | Orta | `recipe_from_prep` | Reçetenin tüm satırlarını silip tek günle yeniden yazar; önceki kalibrasyon kaybolur; `waste_pct_override` göz ardı edilir. | Kalibrasyon tablosu + ağırlıklı medyan (claude-is-plani Faz 3). |
| B-7 | Düşük | `plan_prep_from_orders` | `n` sayacı, `on conflict … do update where portions_source='siparis'` koşulu sağlanmayınca da artıyor (yanlış "X yemek güncellendi" mesajı). Sipariş iptal edilen yemek başlıkları silinmiyor (eski porsiyon kalır). | `GET DIAGNOSTICS` ile satır sayısı; siparişte kalmayan `portions_source='siparis'` başlıklarını 0'la/işaretle. |
| B-8 | Düşük | `sync_invoice_entry` | `vat_amount = total − net`; tevkifatlı faturada `total` ödenecek tutar olduğu için KDV eksik görünür. Onaylı fatura `bekliyor` değilse (ödenmişse) silinince defter kaydı kalır (yetim). | `withholding_amount` kolonu; silmeyi, ödenmiş faturada engelle. |
| B-9 | Düşük | `sync_ledger_entry` | Maaş gideri ödemede (nakit esaslı) yazılıyor; PLAN "tahakkuk esaslı" diyor. Hakediş (`hakedis`) deftere gider olarak düşmüyor → aylık kâr, ödeme gününe kayıyor. | Hakedişte `finance_entries` (gider, bekliyor), ödemede kapatma (`payments`). |
| B-10 | Düşük | `order_is_open` | Kesim saati sabit 16:00 kodda; firmaya özel kesim yok. | `customers.cutoff_time` (varsayılan 16:00). |
| B-11 | Bilgi | `role_permissions` | Kurucu panelindeki "yaz/gör" yalnız menü görünürlüğü; RLS uygulamıyor. | Dokümante et veya `has_module_level()` ile kritik tablolara bağla. |
| B-12 | Bilgi | Realtime | "Canlı bakiye/ana sayfa" için `employee_ledger`, `meal_orders`, `prep_batches`, `stock_movements` yayında değil. | Yayına ekle (RLS realtime'da da uygulanır). |
| B-13 | Bilgi | `database.types.ts` | Yeni migration'lardan sonra yeniden üretilmeli (`generate_typescript_types`). | CI adımı. |



### 2.4 Migration durumu (M-1) ve öncelikli düzeltme listesi
> Kaynak: `notlar-analiz/supabase-kontrol.md` satır 7–23 (birebir alıntı; başlık seviyeleri düşürüldü).

#### 1. Migration durumu

| Repo dosyası | Canlı version | Ad |
|---|---|---|
| 20260926100000_core_security.sql | 20260926165350 | core_security |
| 20260926110000_recipes.sql | 20260926165426 | recipes |
| 20260926120000_function_hardening.sql | 20260926165600 | function_hardening |
| 20260926130000_save_rpcs.sql | 20260926170128 | save_rpcs |
| 20260926140000_guard_last_admin_cascade.sql | 20260926170902 | guard_last_admin_cascade |
| 20260927100000_finance_core.sql | 20260926171742 | finance_core |
| 20260928100000_kitchen_prep.sql | 20260926191939 | kitchen_prep |
| 20260929100000_chat_and_cost_history.sql | 20260926194947 | chat_and_cost_history |
| 20260930100000_operations.sql | 20260926201331 | operations |
| 20260930110000_customer_order_link.sql | 20260926202527 | customer_order_link |

**Bulgu M-1 (Yüksek, operasyonel):** Adlar aynı, **sürüm numaraları farklı**. Migration'lar MCP `apply_migration` ile uygulanmış (zaman damgası o anın saati), repo dosyaları elle numaralanmış. `supabase db push` / `supabase migration up` çalıştırılırsa CLI, 10 dosyanın hiçbirini uygulanmış görmez ve yeniden çalıştırmaya çalışır → `create policy … already exists` ile kırılır. Ayrıca repo dosyalarının bir kısmı **gelecek tarihli** (28–30 Eylül); yeni migration'ların sıralaması karışır.
**Çözüm (önerilen, onay gerektirir):** repo dosyalarını canlı version'lara göre yeniden adlandırmak (en az riskli) **veya** `supabase migration repair --status applied <repo_version>` + `--status reverted <live_version>`. Yeni migration'lar `20260930120000` ve sonrası numaralanmalı (hem repo hem canlıdaki en büyük değerden büyük).
#### 6. Öncelikli düzeltme listesi (tek migration: `20260930120000_security_fixes.sql` önerisi)
1. S-1 `employees` okuma kısıtı + `v_employee_directory`.
2. S-4 `team_members` kurucu yükseltme engeli.
3. S-2 portal fiyat zorlama tetikleyicisi; S-3 talep durumu kısıtı.
4. B-3 çift stok girişi (DB benzersizlik + istemci tek kapı).
5. `(select auth.uid())` düzeltmeleri, 39 FK indeksi, `revoke truncate…`.
6. Auth: leaked password protection (Dashboard ayarı).
7. Migration sürüm kayması çözümü (M-1) — **bu adım diğer tüm migration'lardan önce.**


---

## 3) Çekirdek iş mantığı ve matematik (bağlayıcı)
> Kullanıcı niyeti tarif etti; formülleri, veri modelini, yuvarlamayı, aykırı değer eleme ve testleri sen tasarlarsın. Aşağıdakiler asgari şartlardır.

### 3.1 Muhasebe kuralı (tek gider)
- Hammadde ve sarf gideri **yalnız tedarikçi faturası işlendiğinde, bir kez** yazılır (`finance_entries`).
- Üretim, sevk ve fire **yalnız stoktan düşer** (FIFO parti), gider yazmaz; SMM/porsiyon maliyetini yönetim raporu olarak gösterir. `finance_entries.source`'a `uretim` eklenmez.
- **Tek kapı:** Stok girişi ya mal kabulü (PO teslimi) ya faturayla yapılır; hangisi önce gelirse partiyi açar, diğeri eşleştirir (çift giriş yok). Fatura sonradan gelirse parti birim maliyeti düzeltilir ve `avg_cost` yeniden hesaplanır (geriye dönük maliyet düzeltmesi, geç fatura).
- Firmalara yemekle gönderilen yan malzemeler (tuzluk, ketçap/mayonez saşe, yağ, peçete, servis seti) stoktan müşteri etiketiyle düşer; maliyete (öğün/müşteri) eklenir ve fatura akışına yansır.

### 3.2 Kanonik stok, tedarikçi etiketi, FIFO
- Stok adları **sade ve kanonik**tir ("Domates", "Kıyma", "Dana Kuşbaşı"). Farklı yazımlar yalnız takma addır (`ingredient_aliases`); ad uygulamadan değiştirilebilir.
- **Fatura içe aktarma kuralı:**
  - Faturadaki ürün kanonik bir stoğa eşleşirse o stoğa yazılır, stok güncellenir ve **tedarikçi etiketi** (supplier_id + fatura/PO + parti) kaydedilir. Eşleşme sırası: tedarikçiye özgü takma ad → genel takma ad → pg_trgm benzerlik önerisi (kullanıcı onayı). Onaylanan yazım yeni takma ad olur.
  - **Eşleşme yoksa yeni stok oluşturulur** (kategori seçimi, "gözden geçir" bayrağı).
- Fiyatı kimin, ne zaman, hangi belgeyle güncellediği iz olarak tutulur.
- **Parti modeli:** `stock_lots` (ingredient_id, supplier_id, purchase_invoice_id, purchase_order_id, received_on, qty_in, unit_cost, lot_no, expiry_date, qty_remaining, status, source `pok|fatura|acilis|sayim`). Ayrıca `stock_movements.lot_id/supplier_id/purchase_invoice_id/purchase_order_id` ve `meal` (üretim/sevk çıkışında zorunlu).
- **RPC'ler:** `receive_stock` (tek giriş kapısı) ve `consume_stock` (FIFO). Parti yetmezse negatif stok uyarısı verilir ve "partisiz çıkış" kaydı açılır. Mevcut hareketler idempotent olarak "açılış partisi"ne dönüştürülür. Görünüm: `v_stock_by_supplier`.
- Birim çevirisi: e-Fatura (UBL-TR) birimleri KGM→kg, GRM→g, LTR→lt, MLT→ml, C62→adet eşlenir. Koli/kasa/teneke ambalajları `ingredient_pack_units.factor` ile (tedarikçiye özgü olabilir) stok birimine çevrilir.

### 3.3 Reçete: bir kez, 1 kişilik, gerçek üretimden öğrenilir
- Reçete **yalnız adla** açılır (iskelet: `yemek-listesi.csv`, 331 ad). Malzeme ve miktar mutfakta **gerçek üretimden** girilir.
- **İlk üretim:** Mutfak, o üretimin kişi sayısı X için gerçek kullanılan miktarları Y girer. Sistem arka planda **1 kişilik miktarı = Y ÷ X** hesaplar ve reçeteyi **1 kişilik** olarak kaydeder (sürüm 1). Kullanıcı hesap yapmaz.
  - Örnek: 1200 kişi / 100 kg → 83,3 g/kişi net. Fire yüzdesi ile brüt = net ÷ (1 − fire).
- Reçete bir kez oluşturulur ve **süresiz kullanılır**. Sonraki üretimler reçeteyi kendiliğinden değiştirmez; **kalibrasyon önerisi** üretir:
  - Son N (örn. 10) üretimin porsiyon ağırlıklı medyanı / ağırlıklı ortalaması alınır.
  - Aykırı değerler (medyan ± %30 veya ± 3·MAD) elenir.
  - `calib_mode` manuel/otomatik/kilitli olabilir.
  - Yönetici veya aşçıbaşı onaylarsa yeni sürüm kaydedilir; eski sürüm arşivde kalır.
- Reçete ayrıca **yapılış bilgisini** taşır:
  - işlem adımları (istasyon, süre, sıcaklık, kritik kontrol noktası);
  - satır başına **doğrama biçimleri** (küp, julyen, halka, yarım ay, rende, kıyım, brunoise, bütün…);
  - **saklama kapları** (GN 1/1, 1/2, 1/3, küvet derinliği, termobox, 3 bölmeli kap, çorba kasesi), saklama sıcaklığı ve raf ömrü.
- İsteğe bağlı: alt reçete (sos, pilav, hamur; derinlik ≤ 3), müşteri grubuna göre gramaj profili (MEB/fabrika/hastane), kalori/besin değeri ve 14 alerjen.
- Reçete ekranında **"Güncelle"** butonu malzemelere güncel alış fiyatlarını yazar ve maliyeti yeniler. Elle girilen malzemenin de fiyatı olmalıdır.

### 3.4 Menü: 1 kişilik, siparişle ölçeklenir
- Menüler **1 kişi** için tanımlanır. Çeşit sayısı ayarlanabilir (4, 5 veya 6 çeşit; menü tipleri "4 çeşit / 5 çeşit"; kahvaltı, soğuk mezeli, diyet ve özel menüler; salata ve tatlı üretimi).
- Firma bazlı menü tanımı `customer_menus`: müşteri × öğün × menü tipi × sunum şekli × fiyat × gramaj profili × geçerlilik.
- **Sunum şekli:** `tabla` = 3 bölmeli kap (kap + kapak maliyeti porsiyon maliyetine dahil) ve `kuvet` (küvet/gastronorm ile toplu gönderim; kap maliyeti yok, küvet/termobox zimmeti var). Bunlar ayrı maliyetlenir.
- **Ölçekleme:** Gün × öğün × müşteri × menü sipariş sayısı N → her malzeme ihtiyacı = Σ(N × qty_per_person × brüt katsayı).
  - Kanonik stok adıyla toplanır: `production_order_lines` (net/brüt kg, stok mevcudu, eksik).
  - Yuvarlama: kg 0,1; adetli yukarı.
  - Ambalaj ihtiyacı (3 bölmeli kap = kişi sayısı; küvet adedi = ⌈kişi × porsiyon hacmi ÷ kap kapasitesi⌉; çorba kasesi, ekmek, servis seti) sarf olarak listelenir.

### 3.5 Üç öğün hizmeti (meal service boyutu)
- **Kahvaltı, öğle ve akşam ayrı satılır** (`gece` korunur). Her birinin hazırlığı, üretimi, kişi sayısı, siparişi, üretim emri, iş emri ve maliyeti **ayrı**dır.
- Ortak domain: `meal_service` ∈ {kahvalti, ogle, aksam, gece}. Aşağıdakilerin hepsi `meal` taşır:
  - customer_menus, meal_orders (var), menu_plans (var), prep_batches (var);
  - production_orders (+ satırları), work_orders, production_runs;
  - stock_movements (üretim/sevk çıkışı), purchase_plan_lines, cost_version_lines, finance_entries (nullable, doğrudan atanabilen gider);
  - rotalar (opsiyonel).
- Arayüzde Siparişler, Üretim, Mutfak, Satınalma planı ve Maliyet ekranlarında `Kahvaltı · Öğle · Akşam` segmenti bulunur. Kahvaltı hazırlığı önceki akşam planlanabilir.

### 3.6 Maliyet ve genel gider dağıtımı
- **Planlanan kişi başı malzeme** = Σ(qty_per_person × güncel maliyet). Güncel maliyet son parti fiyatı veya ağırlıklı ortalamadır (ayardan seçilir).
- **Gerçekleşen kişi başı malzeme** = Σ(qty_used × unit_cost_used [FIFO, üretim anında dondurulur]) ÷ X. İkisi yan yana gösterilir; fark fiyat ve verim sapmasıdır (plan-fiili fark TL olarak raporlanır; artan ve dönen yemek kaydedilir).
- **Nihai kişi başı öğün maliyeti = kişi başı malzeme + kişi başı genel gider.**
- **Genel gider dağıtımı (öğün bazlı, hammadde hariç, çift sayım yok):**
  - (a) Öğüne doğrudan atanabilen gider (`finance_entries.meal`) o öğüne yazılır.
  - (b) Ortak gider havuzlarına anahtarlar uygulanır (`allocation_keys`, sürümlü):
    - personel → öğün başı hazırlık/üretim saati; yoksa kişi × öğün ağırlığı;
    - enerji → pişirme süresi veya porsiyon;
    - lojistik → sefer ve km, yoksa porsiyon;
    - ambalaj/sarf → fiili öğün etiketli tüketim;
    - kira, amortisman, yönetim → porsiyon eşdeğeri (varsayılan ağırlık kahvaltı 0,6 · öğle 1,0 · akşam 1,0; ayarlanabilir).
  - (c) Öğün payı ÷ o öğünün dönemde teslim edilen kişi sayısı (payda seçilebilir: teslim/sipariş/üretilen).
  - (d) Ay içinde bütçe/tahmin, ay kapanışında gerçekleşen değer, sürümlü. **Σ paylar = havuz**; kuruş yuvarlama farkı en büyük paya eklenir.
- **Raporlar:**
  - gün × öğün × müşteri × menü: kişi, malzeme, genel gider, nihai maliyet, satış fiyatı, marj;
  - **Finans > Maliyet** sekmesinde **günlük / aylık / yıllık** görünümler (`v_cost_daily/monthly/yearly`, `v_meal_cost_*`, `v_overhead_allocation`);
  - menü bazlı kârlılık: kişi başı maliyet + genel gider payı, **fiyatlandırma serbestliği** (hedef FC% veya marj → önerilen fiyat; kullanıcı değiştirebilir);
  - müşteri/sözleşme bazında tam maliyetli kâr, marj alarmı, TÜFE revizyon hatırlatması.

### 3.7 Satınalma planı (menüden otomatik, sürümlü)
- `generate_purchase_plan(period)`: gelecek ayın `menu_plans` × **geçen ayın** gün/öğün/firma ortalama kişi sayısı (+ standing orders) × kalibre brüt gramaj (+ ambalaj) − beklenen stok − açık PO.
- Fiyat: geçerli en uygun teklif (marka tercihine uygun) yoksa son alış.
- Sonuç **sürüm 1 (otomatik)** olur. Yönetici düzenler ve **kaydeder = yeni sürüm**; otomatik ve elle girilen değer yan yana görünür. Onaya gönderilir; **satınalma siparişi yalnız onaylı sürümden** oluşur.
- Tedarikçiye göre gruplanır. Tedarikçiye satınalma talebi PDF, WhatsApp veya e-posta ile gönderilir.

### 3.8 Sürüm, değişmezlik, onay, log
- Maliyet, satınalma planı, reçete normu, dağıtım anahtarları, iş emri, onay ve denetim kayıtları **yıkıcı biçimde güncellenmez**. "Kaydet" = yeni sürüm satırıdır (`version_no`, `based_on_version_id`, `created_by`, `created_at`); eski sürümler okunur, iki sürüm arasında fark gösterilir, geri alma da yeni sürümdür.
- `audit_log` ve `approval_events` UPDATE/DELETE/TRUNCATE'e kapalıdır (tetikleyici + revoke) ve **hash zinciriyle** kurcalamaya karşı mühürlenir (`verify_audit_chain`).
- **Her değişiklik loglanır:** kim, ne zaman, hangi kayıt, önce/sonra.
- **Onay:** `approval_policies`'te tanımlı işlemler `request_approval` → `decide_approval` akışından geçer:
  - satınalma planı, maliyet düzenleme, eşik üstü gider/ödeme (ör. 20.000 ₺);
  - izin/avans, stok düzeltme, modül kapatma, kullanıcı silme, hata düzeltme önerisi.
  Talep eden kendi talebini onaylayamaz; talep anındaki veri `payload` olarak saklanır. **Yönetici son onay mercidir;** Bugün ekranındaki **Onaylar** sekmesinde karar verir.



### 3.9 Muhasebe kuralı (eşleştirme belgesindeki bağlayıcı metin)
> Kaynak: `notlar-analiz/eslestirme.md` satır 32–48 (birebir alıntı; başlık seviyeleri düşürüldü).

#### 0.1 Muhasebe kuralı (güncelleme 27.09.2026 02:07 TSİ — bağlayıcı)

1. **Hammadde bir kez gider yazılır: tedarikçi faturası girildiğinde/onaylandığında** (`purchase_invoices` → `sync_invoice_entry` → `finance_entries` gider). Başka hiçbir akış (PO teslimi, üretim, stok çıkışı, firmalara sevk) gıda/sarf gideri yazmaz.
2. **Üretim yalnız stoktan düşer (tüketim)** ve maliyet rakamını ortaya çıkarır: porsiyon maliyeti, günlük/menü bazında satılan malın maliyeti (SMM/COGS). Bu bir **yönetim raporu** değeridir; deftere ikinci gider kaydı açılmaz. Finans Özeti'nde iki sütun: "Gıda gideri (fatura)" ve "Tüketim maliyeti (üretim)"; fark = stok değer değişimi (mutabakat kartı).
3. **Stok adları bizim kanonik adlarımızdır** (`ingredients.name`); tedarikçi adı yalnız eşleştirme (alias) katmanında durur.
4. **Her stok girişi bir parti (lot) olarak tedarikçi etiketi taşır**: kim getirdi (`supplier_id`), hangi belgeyle (`purchase_invoice_id` ve/veya `purchase_order_id`), hangi fiyattan, parti no/SKT. Çıkışlar (üretim, sevk, fire) partiye bağlanır (FIFO) → "hangi tedarikçinin malı hangi yemeğe/firmaya gitti" izlenebilir; gıda güvenliği (lot/SKT, PLAN faz 10) da bu yapıya oturur.
5. **Stok girişi tek kapıdan**: mal kabulü (irsaliye/PO teslimi) **veya** fatura — hangisi önce gelirse partiyi o açar; ikincisi aynı partiyi **eşleştirir** (yeni giriş yapmaz). Fatura sonradan gelirse yalnız gider yazılır ve parti birim maliyeti fatura fiyatına düzeltilir (`avg_cost` yeniden hesaplanır). Faturasız elle giriş yalnız "açılış/devir/sayım farkı" nedenleriyle ve gider yazmadan yapılabilir.

**Tasarım karşılığı:**
- Yeni tablo `stock_lots` (id, ingredient_id, supplier_id FK, purchase_invoice_id FK null, purchase_order_id FK null, received_on, qty_in (stok biriminde), unit_cost, lot_no, expiry_date, qty_remaining, status `acik|bitti`, source `pok|fatura|acilis|sayim`).
- `stock_movements` ek: `lot_id FK`, `supplier_id` (girişte zorunlu; açılış/sayım hariç), `purchase_invoice_id`, `purchase_order_id`. Çıkış hareketleri RPC ile FIFO lot tüketir (`consume_stock(ingredient, qty, source, source_id)`).
- Benzersizlik: bir fatura satırı ile bir PO satırı en fazla bir partiye bağlanır (`stock_lots` unique (purchase_invoice_id, ingredient_id) ve (purchase_order_id, ingredient_id) partial).
- `purchase_invoices.purchase_order_id` + fatura onayında: PO'ya bağlı parti varsa **stok girişi yok**, yalnız fiyat düzeltme; yoksa parti açılır. Gider her durumda yalnız faturadan.
- Firmalara giden malzeme (tuzluk, ketçap…): faturada `mutfak_sarf` gideri bir kez yazılır → stok partisi → `sevk` çıkışı müşteri maliyetine **yönetim raporu** olarak dağıtılır (ikinci gider yok).

---



---

## 4) Modüller ve navigasyon (30 → 14 modül) ve rol çalışma alanları
Gereksiz ya da tekrar eden sekme olmayacak. Her bilgi tek yerde girilir, gerisi otomatik dolar. Eski yollar yeni yerlere yönlendirilir. Her rol kendi çalışma alanını görür; yönetici son onay mercidir.


### 4.1 Önerilen sade navigasyon, uçtan uca veri akışı ve çakışmalar
> Kaynak: `notlar-analiz/eslestirme.md` satır 534–618 (birebir alıntı; başlık seviyeleri düşürüldü).

#### Önerilen sade navigasyon (30 → 14 modül)

Kural: bir iş akışı = bir modül; alt ayrıntılar sekme. Eski yollar (`/puantaj`, `/kahvalti`, …) yönlendirme ile çalışmaya devam eder (yer imi bozulmasın).

| Grup | Modül (yol) | Sekmeler | Birleşen eski modüller | Varsayılan roller |
|---|---|---|---|---|
| Genel | **Bugün** (`/`) = **rol çalışma alanı** (#18) | Yönetici/kurucu: Özet · **Onaylar** (#19). Diğer roller: kendi iş masası (sekme yok; kartlar ilgili modüle götürür) | Bugün | tüm personel (rol bazlı içerik) |
| Mutfak | **Üretim** (`/uretim`) | Günlük üretim (öğün sekmesi: kahvaltı/öğle/akşam/gece) · Üretim emri (kontrol→onay) · Kalibrasyon | Günlük Hazırlık, Kahvaltı, Mutfak Ekranı (tam ekran mod düğmesi; `/mutfak-ekrani` tablet için kalır) | yonetici, asci_basi, diyetisyen, depo |
| Mutfak | **Menüler** (`/menuler`) | Menü kartları · Menü planı (takvim) · Hammadde ihtiyacı · Kârlılık | Menüler, Menü Planı | yonetici, asci_basi, diyetisyen, pazarlamaci, muhasebe, satinalma(okur) |
| Mutfak | **Reçeteler** (`/receteler`) | Reçeteler · Yarı mamuller | Reçeteler & Gramaj | yonetici, asci_basi, diyetisyen |
| Depo | **Stok** (`/stok`) | Stok durumu · Hareketler & sayım · Firmalara giden · Hammadde kartları (alias + fiyat geçmişi) | Stok & Depo, Firmalara Giden Malzeme, Hammaddeler | yonetici, depo, satinalma, asci_basi |
| Depo | **Satınalma** (`/satinalma`) | Satınalma planı (menüden otomatik, sürümlü — #20; geçen ay ortalaması + bu/gelecek ay) · Teklifler & analiz (marka/fiyat) · Talepler & siparişler · Tasarruf | Satınalma | yonetici, satinalma, depo |
| Satış | **Siparişler** (`/siparisler`) | Günlük · Aylık sipariş | Siparişler | yonetici, muhasebe, asci_basi, pazarlamaci, diyetisyen |
| Satış | **Cari Hesaplar** (`/cari`) | Müşteriler · Adaylar (CRM) · Tedarikçiler (detayda: menü tanımları, hassasiyet & şikâyet, görüşmeler, ekstre, irsaliye/fatura, alias) | Müşteriler & Cari, Tedarikçiler, İrsaliye & Satış Faturası | yonetici, muhasebe, pazarlamaci (müşteri), satinalma (tedarikçi) |
| Satış | **Teklifler & Sunum** (`/teklifler`) | Teklifler & proforma · Menü sunumu · Şablonlar (menü/teklif/proforma/fatura) · Galeri & referanslar · Hedef firmalar (bot listesi, #18.1) | Kurumsal Teklifler, Müşteri Bulma & Saha | yonetici, pazarlamaci, muhasebe |
| Satış | **Sosyal Medya** (`/sosyal-medya`) | Hesaplar · Takvim · İçerik & onay | Sosyal Medya | yonetici, pazarlamaci |
| Sevkiyat | **Lojistik** (`/lojistik`) | Canlı takip (mutfak + sevkiyat, #18.3) · Rotalar & harita · Araçlar · Şoförler & masraflar | Rota & Harita, Araçlar & Filo | yonetici, sofor (baş şoför), muhasebe; canlı takip: + asci_basi, diyetisyen |
| Sevkiyat | **Şoför Ekranı** (`/sofor`) | — (mobil tam ekran) | Şoför Ekranı | sofor |
| Personel | **Personel** (`/personel`) | Kartlar · Puantaj · Bakiye & ödemeler · İzin & talepler · Analiz & değerlendirme (#18.6) | Personel, Puantaj & Maaş, Personel Bakiyeleri | yonetici, muhasebe, **ik** (ek rol) |
| Finans | **Finans** (`/finans`) | Özet · **Maliyet** (gün/ay/yıl, sürümlü — #20) · Giderler · Gelen faturalar · Belgeler (#18.5) | Finans Özeti, Giderler, Gelen Faturalar | yonetici, muhasebe (+ satinalma: yalnız Gelen faturalar) |
| Finans | **Kasa & Banka** (`/kasa`) | Hesaplar & hareketler · Tahsilat/ödeme · Çek & senet · Krediler · Hatırlatmalar | Kasa & Banka, Çek & Senet | yonetici, muhasebe |
| Sistem | **Ayarlar** (`/ayarlar`) | Hesabım · Kullanıcılar · Firma & antet · Yetkiler · Modüller · Hata Merkezi · Entegrasyonlar (#17) | Ekip & Firma, Kurucu Paneli | yonetici (Hesabım, Firma); kurucu: tümü |

(Şoför Ekranı rol-özel olduğu için 16 satır; masaüstü menüde 14–15 öğe görünür. "Müşteri Bulma & Saha" ertelenir; açıldığında Teklifler'in sekmesi olur.)

**Rol çalışma alanı notu:** Pazarlama, müşteri, canlı takip, satınalma, muhasebe, İK, şoför, diyetisyen ve yönetici ekranları ayrı modül değildir; Bugün ekranı rolüne göre bu modüllerin kartlarını gösterir (#18). Modül sayısı 14'te kalır.

**Yetki matrisinin sekme düzeyine inmesi:** `role_permissions.module` değerleri `"/finans#gelen-faturalar"` gibi sekme anahtarlarını da kabul etsin; `modules.ts` `tabs` dizisi tanımlasın.

---

#### Uçtan uca veri akışı (hedef)

```
[Menüler]  menus (+menu_type, customer_id?) ──< menu_items (recipe, course, portion_factor)
     │                                           │
     │ menu_plans (gün × öğün × genel/firma)      └─ recipes ──< recipe_ingredients (net_qty ← kalibrasyon)
     ▼                                                                 │
[Cari] customer_menus (müşteri × menü tipi × sunum × fiyat)            │
     ▼                                                                 │
[Siparişler] meal_orders  ← portal (token, 16:00 kesimi) / aylık sipariş (standing_orders) / admin
     │  (customer_menu_id → unit_price, service_style; effective_menu → menü)
     ▼  D-1 16:00 kesim
[Üretim] production_orders (taslak)  ← plan_prep_from_orders: yemek × Σkişi×katsayı
     │   prep_batches (yemek) ──< prep_batch_items (planned_qty = kalibre gramaj × kişi)
     │   po_check → anomali listesi (kg sapması, stok yetersiz, fiyatsız kalem)
     │   po_approve (üretim evi / aşçıbaşı)  → Üretim Emri (istasyon bazlı çıktı)
     ▼   pişirme sonrası gerçek miktar girilir
     │   po_close  ──► stock_movements (cikis, source=uretim)      → Stok azalır
     │             ──► recipe_calibrations → recalibrate_recipe    → reçete gramajı güncellenir
     │             ──► maliyet fotoğrafı (cost_per_portion)         → Menü/müşteri kârlılığı
     ▼
[Sevkiyat] routes/route_stops → teslim (delivered_qty, imza)
     │   meal_orders.status = teslim_edildi
     ▼
[Finans]  sync_order_entry → finance_entries (gelir, bekliyor = alacak)
          payments/payment_allocations (tahsilat: nakit/banka/çek) → alacak kapanır, kasa/banka bakiyesi
[Satınalma] menü planı × beklenen kişi × gramaj − stok → purchase_orders → teslim (stock giris)
          → gelen fatura (UBL) → alias eşleştirme → ingredient_prices (tedarikçi+belge) → avg_cost
          → sync_invoice_entry → finance_entries (gider, bekliyor = borç) → payments (ödeme)
```

Muhasebe ilkesi (§0.1, bağlayıcı): gelir = teslim (tahakkuk); **hammadde/sarf gideri yalnız tedarikçi faturasında bir kez**; üretim ve sevk yalnız stoktan (tedarikçi etiketli partilerden, FIFO) düşer ve SMM/porsiyon maliyetini gösterir — deftere ikinci gider yazılmaz. Finans Özeti'nde "Tüketim (stoktan) vs Fatura (gider)" farkı = stok değer değişimi.

---

#### Mevcut tasarımla çakışmalar ve dikkat noktaları

1. **Üretim emri kavramı:** Şu an "Üretim Emri" bir rapor; yeni akışta durumlu kayıt. `prep_batches` korunup `production_order_id` ile bağlanmalı — tablo değiştirilmemeli (mevcut test `prep_batch_flow.sql` bozulmasın).
2. **`recipe_from_prep()` üzerine yazma davranışı** kalibrasyon isteğiyle çelişiyor; fonksiyon imzası korunup davranışı "kalibrasyon kaydı + yeniden hesap" olarak değişmeli.
3. **Fiyat kaynağı:** `customers.default_meal_price` + `meal_orders.unit_price` + `menus.target_price` + yeni `customer_menus.unit_price` → tek doğruluk kaynağı `customer_menus` olmalı; diğerleri varsayılan/öneri olarak kalır.
4. **Menü sınıflandırması:** `menus.kind` (standart/kahvaltı/diyet…) ile yeni `menu_type` (4/5 çeşit) ayrı eksenlerdir.
5. **Stok girişi iki kapıdan:** PO teslimi ve fatura aktarımı → tek kapı + tedarikçi etiketli parti kuralı (§0.1). Gider yalnız faturadan; PO teslimi ve üretim gider yazmaz.
6. **Ortalama maliyet iki yerden yazılıyor:** `apply_ingredient_price` (ilk fiyatla `avg_cost` başlatır) ve `apply_stock_cost` (ağırlıklı ortalama). Kural: `avg_cost` yalnız stok girişinden hesaplanmalı.
7. **Tedarikçi kimliği:** `purchase_invoices`/`ingredient_prices`/`supplier_categories` serbest metin, `suppliers` ayrı tablo → FK'ya geçiş gerekli.
8. **Müşteri portalı iki yöntem:** RLS'li `musteri` rolü (App'te "yakında" ekranı) ve token'lı link (çalışıyor). Birini birincil seçin (öneri: token link + ileride giriş yapan müşteri aynı RPC'leri kullansın).
9. **Yetki matrisi yalnız arayüzde:** `role_permissions` menü görünürlüğünü değiştirir ama RLS'yi değiştirmez; "yaz" seviyesi sunucuda uygulanmıyor. Ya dokümante edin ya da kritik tablolarda `has_module_level(module, level)` fonksiyonu ile RLS'ye bağlayın.
10. **Günlük saat kuralı:** PLAN.md 7,5 saat, kod ve kullanıcı 10 saat → PLAN.md güncellenmeli.
11. **Navigasyon birleştirmesi** mevcut `role_permissions` kayıtlarını (modül yolu anahtarlı) etkiler; birleştirme migration'ı eski yol anahtarlarını yeni anahtarlara taşımalı (şu an tablo boş — en ucuz zaman şimdi).
12. **Migration sürüm kayması** (repo dosya adı ≠ canlı version) — yeni migration eklemeden önce çözülmeli (bkz. supabase-kontrol.md).

13. **Muhasebe kuralı (§0.1):** Mevcut `PurchasingPage.receive()` PO tesliminde stok girişi yapıyor, InvoicesPage de faturadan giriş yapıyor; ikisi de gider yazmıyor/yazıyor ayrımı doğru ama stok çiftleniyor. Yeni parti (lot) modeline geçişte mevcut `stock_movements` kayıtları "açılış partisi" olarak dönüştürülmeli (tedarikçi etiketi bilinmiyorsa `supplier_id` null + `source='acilis'`).
14. **Onay akışı** mevcut doğrudan-kaydet ekranlarını yavaşlatmamalı: yalnız `approval_policies`'te tanımlı türler onaya düşer; diğerleri eskisi gibi anında kaydedilir ve `audit_log`'a yazılır.
15. **Sürümlü plan/maliyet** ile anlık hesap (mevcut PurchasingPage) çelişmez: anlık hesap "otomatik öneri" olarak kalır, "Kaydet" sürüm oluşturur.
16. **Hata Merkezi botu** canlıya yazamaz; GitHub'a yalnız taslak PR, Supabase'e yalnız branch. Service role anahtarı ve LLM anahtarı yalnız Edge Function/Vault'ta.


### 4.2 Rol çalışma alanları (18.1–18.9) ve rol ↔ çalışma alanı eşlemesi
> Kaynak: `notlar-analiz/eslestirme.md` satır 426–494 (birebir alıntı; başlık seviyeleri düşürüldü).

#### 18. Rol çalışma alanları (her rol kendi sorumluluğunu girer, program dolar)
**Durum: Kısmen var**

**İlke:** Yeni sekme/modül açılmaz. **Bugün** (`/`) ekranı **rol bazlı çalışma alanına** dönüşür: her rol girişte kendi "iş masasını" görür; kartlar ana modüllerin verisinden beslenir ve tıklayınca ilgili modül/sekmeye gider (tek veri, tek kaynak). Kullanıcının girdiği her kayıt ana modüle yazılır (ör. pazarlamacının görüşme kaydı Cari'de, şoförün teslimi Siparişler/Lojistik'te görünür).

##### 18.1 Pazarlama — **Kısmen var**
- *Var:* `social_posts`, `leads` (aday firma, durum, atanan kişi, konum), `field_visits` (ziyaret, fotoğraf, geri dönüş, yönetici kontrolü), `quotes`; ekranlar yok (`/pazarlama`, `/sosyal-medya`, `/teklifler` IN_PROGRESS).
- *Eksik:* sosyal medya etkileşim verisi (beğeni/yorum/erişim), botun günlük hedef kitle raporu, pazarlamacı iş kaydı, CRM kişi ve görüşme logu, adayların talepleri, proforma ve belge şablonları, hazır menü/teklif şablonları.
- *Tasarım:* `social_post_metrics` (post_id, taken_at, likes, comments, shares, reach, saves) · `audience_targets` (bot çıktısı: target_date, segment (sektör/bölge/çalışan sayısı), lead_id null, company_name, reason, score, source `bot|elle`, status `yeni|ulasildi|olumlu|olumsuz`) · `crm_contacts` (id, lead_id/customer_id, full_name, title, phone, email, kvkk_consent bool, consent_at) · `crm_interactions` (contact_id, lead_id/customer_id, at, channel `telefon|ziyaret|eposta|whatsapp|toplanti`, summary, next_action, next_date, user_id) · `lead_requests` (lead_id, request `numune|teklif|menu|tadim|ziyaret`, detail, status, due_date) · `document_templates` (kind `menu|teklif|proforma|fatura|ekstre`, name, body/sections jsonb, is_default) · `proformas` (no, lead_id/customer_id, quote_id, lines, totals, status). Bot: Edge Function `audience-bot` (🔌 Google Places/Meta API; o zamana kadar CSV içe aktarma) günlük 08:00 → `audience_targets`. **KVKK:** yalnız izinli/resmi kaynaklar, iletişim izni alanı zorunlu.
- *Çalışma alanı kartları:* Bugünün hedef listesi (bot) · Yapılacak geri dönüşler (next_date) · Açık aday talepleri · Sosyal medya etkileşim özeti · Teklif/proforma durumları. Kayıtlar **Teklifler & Sunum** (Teklifler, Proforma, Şablonlar) ve **Cari Hesaplar** (aday/müşteri detayında Görüşmeler) modüllerine yazılır; sosyal veriler **Sosyal Medya** modülünde.

##### 18.2 Müşteri kartı: hassasiyet, alerji, dikkat, son şikâyet — **Yok** (alerjen altyapısı var)
- *Var:* `ingredients.allergens` (14 alerjen), `v_recipe_costs.allergens`.
- *Tasarım:* `customer_notes` (customer_id, kind `alerji|hassasiyet|dikkat|tercih`, allergen_code null (14 alerjen listesi), text, active, created_by) · `customer_complaints` (customer_id, reported_at, channel, category `lezzet|gramaj|hijyen|gec_teslim|eksik|diger`, detail, photo_path, severity, status `acik|incelemede|cozuldu`, resolution, resolved_by, resolved_at). View `v_menu_allergen_conflicts` (menü planı × müşteri alerjisi → çakışan yemek). Hatırlatma: sipariş, üretim emri ve şoför ekranında müşteri adının yanında ⚠ rozeti + "son şikâyet: 3 gün önce, gramaj" satırı; üretim emri kontrolünde (`po_check`) alerji çakışması anomali olarak.
- *Yer:* **Cari Hesaplar** > müşteri detay > `Hassasiyetler & şikâyetler`; özet diğer ekranlara rozet olarak.

##### 18.3 Sevkiyat & mutfak canlı takip — **Kısmen var**
- *Var:* `prep_batches.status` (taslak/pişti/kapandı), `routes.status` (plan/yolda/tamam), `routes.stops` jsonb (done, done_at).
- *Tasarım:* `route_stops` (Faz 5) ek: `status` `bekliyor|yolda|teslim|sorun`, `departed_at`, `arrived_at`, `delivered_qty`, `issue`. `production_events` (batch_id, status, at, user_id) — pişirme başladı/bitti/paketlendi/araca yüklendi. View `v_live_ops` (bugün: yemek × durum, araç × durak × durum, gecikme). Realtime yayın: `prep_batches`, `production_orders`, `route_stops`. Konum: şoför ekranı açıkken isteğe bağlı konum paylaşımı (`vehicle_positions` son konum; 🔌 Arvento/Mobiliz gelince oradan).
- *Yer:* **Lojistik** > `Canlı takip` panosu (mutfak + sevkiyat tek ekranda; TV modu). Yönetici/diyetisyen/baş şoför çalışma alanında küçük özet kartı.

##### 18.4 Satınalma — **Kısmen var**
- *Var:* PurchasingPage: **bu ayın** menü planı × (sipariş varsa sipariş, yoksa firmanın son 4 hafta ortalaması) × reçete brütü − stok; `supplier_quotes` (fiyat, kaynak, tarih); en uygun fiyat + tasarruf (runner-up farkı); taslak PO.
- *Eksik:* **gelecek ayın** menüsü × **geçen ayın ortalama sayıları** ile otomatik ihtiyaç ve **maliyet listesi** (kaydedilen, sürümlü plan — bkz. #20); teklif **dosyası yükleme** (PDF/Excel), **marka** bazlı karşılaştırma; tedarikçi bağlantıları (portal/e-posta); satınalmanın kazandırdığı tasarruf raporu.
- *Tasarım:* `supplier_quotes` ek: `brand`, `pack_size`, `pack_unit`, `min_qty`, `valid_until`, `quote_file_id`, `quality_note`. `quote_files` (supplier_id, uploaded_by, storage path, parsed bool, parsed_lines jsonb) — Excel içe aktarma + alias eşleştirme (#11); PDF için 🔌 OCR/LLM ayrıştırma önerisi, kullanıcı onaylı. `quote_analysis` görünümü: kalem × marka × tedarikçi, birim fiyata normalize (paket → stok birimi), kalite/marka tercih kuralı (`ingredient_brand_prefs`: kabul edilen markalar). **Tasarruf raporu** `v_purchase_savings`: gerçekleşen alış (fatura satırı) × (referans fiyat − ödenen fiyat); referans = aynı dönem tekliflerinin medyanı veya önceki alış fiyatı (seçilebilir); aylık/tedarikçi/satınalmacı bazında "satınalmanın kazandırdığı".
- *Yer:* **Satınalma** sekmeleri: `Satınalma planı` (gelecek ay, sürümlü — #20) · `Teklifler & analiz` · `Talepler & siparişler` · `Tasarruf`. Çalışma alanı: plan onay durumu, bekleyen teklif, bu ay tasarruf.

##### 18.5 Muhasebe — **Kısmen var**
- *Var:* `finance_entries` (tek defter), `purchase_invoices` (UBL XML), ExpensesPage, CashPage, FinanceSummaryPage, `employee_ledger`/`vehicle_logs` → gider tetikleyicileri.
- *Eksik:* **belge merkezi** (fiş, fatura, dekont, tahsilat makbuzu, gider pusulası, serbest meslek makbuzu, masraf fişi, sözleşme…) ve belgelerin kayda bağlanması; mantıksal giderleştirme kuralları (her belge türü → doğru hesap/kategori, KDV, çift kayıt kontrolü).
- *Tasarım:* `documents` (id, doc_type `alis_faturasi|satis_faturasi|fis|dekont|tahsilat_makbuzu|tediye_makbuzu|gider_pusulasi|smm|irsaliye|sozlesme|diger`, doc_no, doc_date, counterparty (customer_id/supplier_id/employee_id), amount, vat_amount, file_path (storage `documents`, private), hash unique (aynı belge iki kez yüklenmez), ocr_text, status `yuklendi|eslesti|islendi|reddedildi`, linked_table, linked_id, uploaded_by). `document_rules` (doc_type × anahtar kelime/tedarikçi → kategori, KDV oranı, hesap). İşleme RPC `process_document(id)`: türüne göre `purchase_invoices` / `payments` / `finance_entries` oluşturur (hammadde faturası → §0.1: gider + stok partisi). Mükerrer kontrol: (counterparty, doc_no, amount, date).
- *Yer:* **Finans** modülüne `Belgeler` sekmesi (gelen kutusu: yüklenen/eşleşmeyen belgeler). Çalışma alanı: işlenmeyi bekleyen belge, vadesi gelen ödeme/tahsilat, onay bekleyen gider.

##### 18.6 İnsan kaynakları — **Kısmen var**
- *Var:* `employees`, `attendance_days`, `employee_ledger`, `employee_requests`, `payroll.ts`, Puantaj/Bakiye ekranları.
- *Eksik:* devamlılık/devamsızlık analizi (oran, ardışık yok, geç giriş, erken çıkış, departman kıyası), personel değerlendirme ve grafikleri; ayrı İK rolü yok (şu an yonetici/muhasebe).
- *Tasarım:* `employees` ek: `shift_start time` (geç kalma için). View `v_attendance_stats` (çalışan × ay: çalışılan gün, yok, raporlu, izin, geç giriş sayısı/dakika, fazla mesai saati, devam oranı %). `employee_reviews` (employee_id, period, reviewer_id, scores jsonb {hijyen, hız, ekip, disiplin, beceri} 1–5, comment, status `taslak|tamam`) — tamamlanan değerlendirme değiştirilemez (yeni sürüm açılır). Grafikler: devam oranı trendi, departman ısı haritası, puan radar grafiği.
- *Rol:* **ek (additive) rol `ik`** önerilir: personel, puantaj, izin, değerlendirme yazar; `employee_ledger` ödeme/avans **yazamaz** (muhasebe), maaş kolonlarını okur. `team_members_role_check` genişletilir (mevcut değerler korunur).
- *Yer:* **Personel** modülüne `Analiz & değerlendirme` sekmesi; İK çalışma alanı: bugün gelmeyenler, bekleyen izinler, eksik puantaj, değerlendirme takvimi.

##### 18.7 Şoför — **Kısmen var**
- *Var:* `vehicles`, `vehicle_logs`, `routes`; ekran yok.
- *Tasarım:* Faz 5 (Lojistik) + çalışma alanı = **Şoför Ekranı**: bugünkü rota ve duraklar (müşteri ⚠ hassasiyet rozeti), teslim/imza, araç kontrol listesi (sabah: lastik, soğutucu sıcaklığı, temizlik → `vehicle_checks` (vehicle_id, driver_id, check_date, items jsonb, temp_c, ok bool)), masraf fişi, firmaların istekleri (tuzluk vb.).

##### 18.8 Diyetisyen / üretim müdürü — **Var/Kısmen**
- *Var:* PrepPage, MenusPage, MenuPlanPage, RecipeEditor, KitchenScreen.
- *Tasarım:* Çalışma alanı: yarının üretim emri (kontrol/onay butonu), menü planı boşlukları (gelecek ay), alerji çakışmaları (#18.2), kalibrasyon güven düzeyi düşük reçeteler, reçetesiz yemekler, son şikâyetler (gramaj/lezzet). Rol eşlemesi: diyetisyen = `diyetisyen` (var), üretim müdürü = `asci_basi` (var; ayrı unvan gerekirse `team_members.title`, yeni rol gereksiz).

##### 18.9 Yönetici — bkz. #19 (Onaylar) — çalışma alanı: tüm modüllerin özet kartları + **Onaylar** sekmesi.

##### Rol ↔ çalışma alanı eşlemesi (mevcut 9 rol + kurucu + önerilen `ik`)
| Rol | Mevcut mu | Çalışma alanı (Bugün) | Veri yazdığı modüller |
|---|---|---|---|
| kurucu | Var | Yönetici alanı + Ayarlar (Hata Merkezi, Modüller) | tümü |
| yonetici | Var | Özet + **Onaylar** | tümü (son onaycı) |
| asci_basi (üretim müdürü) | Var | Üretim alanı | Üretim, Reçeteler, Menüler |
| diyetisyen | Var | Diyetisyen alanı | Menüler, Reçeteler, Üretim (kontrol) |
| depo | Var | Depo alanı (mal kabul, sayım, kritik stok) | Stok |
| satinalma | Var | Satınalma alanı | Satınalma, Cari (tedarikçi) |
| muhasebe | Var | Muhasebe alanı | Finans, Kasa & Banka, Cari |
| pazarlamaci | Var | Pazarlama alanı | Teklifler & Sunum, Cari (aday/CRM), Sosyal Medya |
| sofor (baş şoför dahil) | Var | Şoför Ekranı | Lojistik, Stok (sevk) |
| musteri | Var | Portal (sipariş, menü, şikâyet bildir) | Siparişler (portal RPC), şikâyet (RPC) |
| **ik** | **Yok → ek** | İK alanı | Personel |

Baş şoför ayrımı: yeni rol yerine `team_members.is_lead bool` (sofor + is_lead → tüm rotaları yazar).

---



### 4.3 Rol × alan yetki matrisi (yeni tablolar için RLS referansı)
> Kaynak: `notlar-analiz/claude-is-plani.md` satır 31–73 (birebir alıntı; başlık seviyeleri düşürüldü).

#### B. Rol × alan yetki matrisi (yeni tablolar için referans)

`O` = okur, `Y` = okur+yazar, `—` = erişim yok, `K` = yalnız kendi kaydı. Kurucu her yerde `Y`.

| Alan / tablolar | yonetici | asci_basi | diyetisyen | depo | satinalma | muhasebe | pazarlamaci | sofor | musteri |
|---|---|---|---|---|---|---|---|---|---|
| production_orders, recipe_calibrations | Y | Y | Y | O | O | O | — | — | — |
| menu_types, service_styles(+items) | Y | Y | Y | O | O | O | O | — | — |
| customer_menus, standing_orders | Y | O | O | — | — | Y | Y | — | K (portal RPC ile) |
| ingredient_aliases, merge | Y | O | O | Y | Y | Y | — | — | — |
| purchase_order_lines, purchase_requests | Y | O | — | Y | Y | O | — | — | — |
| payments, payment_allocations, account_transfers | Y | — | — | — | O (tedarikçi ödemeleri) | Y | — | — | — |
| cheques(+events), loans(+installments) | Y | — | — | — | — | Y | — | — | — |
| reminders, message_templates, message_log | Y | — | — | — | — | Y | O (tahsilat dışı) | — | — |
| route_stops, routes ek kolonlar | Y | — | — | O | — | O | — | Y (kendi rotası) | — |
| driver_expenses | Y | — | — | — | — | Y | — | K (ekle/gör, onay yok) | — |
| attendance_imports, payroll_periods | Y | — | — | — | — | Y | — | — | — |
| employees (hassas kolonlar) | Y | — | — | — | — | Y | — | K | — |
| v_employee_directory (ad/unvan/telefon) | O | O | O | O | O | O | O | O | — |
| brand_assets, quote_templates | Y | O | O | — | — | O | Y | — | — |
| social_accounts(+snapshots) | Y | — | — | — | — | — | Y | — | — |
| dashboard_notes | Y | O* | O* | O* | O* | O* | O* | O* | — |
| user_onboarding | K | K | K | K | K | K | K | K | K |
| stock_lots | Y | O | O | Y | Y | O | — | O (sevk) | — |
| approval_requests / approval_events | Y (karar) | K (talep) | K | K | K | K (+karar eşik altı) | K | K | — |
| purchase_plans(+versions, lines) | Y (onay) | O | O | O | Y (taslak sürüm) | O | — | — | — |
| cost_versions(+lines) | Y | — | — | — | — | Y (öneri sürüm) | — | — | — |
| app_modules, error_events, bug_fix_proposals | kurucu Y; yonetici O | — | — | — | — | — | — | — | — |
| customer_notes, customer_complaints | Y | O | O | — | — | O | Y | O (rozet) | ins: şikâyet (portal RPC) |
| crm_contacts, crm_interactions, lead_requests, audience_targets | Y | — | — | — | — | — | Y | — | — |
| social_post_metrics | Y | — | — | — | — | — | Y | — | — |
| document_templates, proformas | Y | — | — | — | — | Y | Y | — | — |
| documents, document_rules | Y | — | — | O (irsaliye) | Y (alış belgeleri) | Y | — | K (masraf fişi) | — |
| quote_files, ingredient_brand_prefs | Y | O | — | — | Y | O | — | — | — |
| employee_reviews, v_attendance_stats | Y | — | — | — | — | O | — | — | — |
| vehicle_checks, production_events, route_stops durumları | Y | Y (production_events) | Y | O | — | O | — | Y (kendi) | — |

**Ek rol (additive):** `ik` — Personel modülünde kart, puantaj, izin, değerlendirme yazar; `employee_ledger` ödeme/avans yazamaz; employees hassas kolonlarını okur. Tabloda `ik` sütunu yoksa: employees/attendance/requests/reviews = Y, ledger = O, finans = —. Baş şoför: `team_members.is_lead` (sofor + is_lead). Diyetisyen ve pazarlamacı rolleri zaten var.

`O*` = `visible_roles` boşsa veya rolü içeriyorsa.

---



---

## 5) Modül gereksinimleri (hiçbiri düşürülmez)
Okuma sırası: 5.A kullanıcının orijinal ürün tarifi → 5.B ek turlar (2., 2b, 3., 4.) → 5.C her kullanıcı notunun mevcut sistemle eşleşmesi, DB ve ekran önerileri (§1–§20) → 5.D profesyonel uygulamalardan 32 ek özellik → 5.E rakiplerden kısa notlar. Çelişki olursa **§3 ve 5.B (sonraki tur) önceliklidir.**


### 5.A Kullanıcının orijinal ürün tarifi (maliyet, üretim, menü, sipariş, finans, satınalma, filo, personel, roller, pazarlama, modül listesi)
> Kaynak: `prompt/yemekhane-yazilimi-prompt.md` satır 23–143 (birebir alıntı; başlık seviyeleri düşürüldü).

##### En büyük beklenti: gerçek porsiyon ve menü maliyeti
Uygulamanın kalbi şudur. **Bir yemeğin 1 porsiyonu kaça mal oluyor, 1 menü kaça mal oluyor?** Bu her gün otomatik hesaplanmalı ve fiyatlar değiştikçe güncel kalmalı.

###### Yemek (reçete) oluşturma
- 1 porsiyonluk yemek oluşturulup veritabanına kaydedilir. Bu yemekler daha sonra menülerde seçilir.
- Yemeğin içindeki malzemeler **stoklardan seçilir veya elle girilir**. Elle girilen malzemenin de bir fiyatı olmalı, yoksa maliyet çıkmaz.
- Çiğden kullanılan **yan malzemeler** de hesaba katılır (yağ, tuz, baharat, salça vb.).
- Yemek ekranında bir **"Güncelle"** butonu olur. Basıldığında içindeki malzemelere stoktaki **en güncel alış fiyatları** yazılır ve maliyet yenilenir.

###### Mutfakta olağan akış içinde maliyet bulma (çok önemli)
Porsiyon maliyetini bulmak için malzemeler tek tek tartılmayacak. Sistem mutfağın **normal günlük çalışması** içinde işleyecek:
1. O günün menüsü ve yemekleri zaten hazırdır. Bazı yemekler veritabanında kayıtlıdır, bazıları henüz değildir.
2. Diyetisyen veya hazırlık sorumlusu yemek başlığına gelir, **"İçerik ekle"** der ve malzemeleri stoktan seçer.
3. O anki hazırlık miktarını girer (kg, adet, litre; birimi neyse).
4. Sistem bu toplam miktarı **müşteri siparişlerinden gelen porsiyon sayısına böler** ve 1 porsiyonun gramajını ve maliyetini bulur.
5. Bu bilgi reçeteye kaydedilir. Böylece zamanla mutfağın gerçek "kültürü" veritabanında oluşur.
- Reçete içerikleri çalışırken girilebileceği gibi baştan da tanımlanabilir. Bu senaryoların takibi, tasarımı ve veritabanı kayıtları çok önemli.

###### Üretim modülü (örnek: karnıyarık)
- "Karnıyarık" yemeğini oluşturduk ve 1 porsiyon malzeme gideri girildi.
- Karnıyarık bir günün menüsüne konuldu. O günün porsiyon sayısı **müşteri siparişlerinden** oluşur. Örneğin 850 kişilik karnıyarık yapılacaktır.
- Sistem 1 porsiyonun malzemelerini bu sayıyla çarpar (örneğin 100 kg patlıcan, 40 kg kıyma ...). Bundan **üretim raporu** ve **kullanılacak malzeme raporu** çıkar.
- Üretimhaneye hazırlık, sade dille ve adım adım tarif edilir.

###### Menü modeli
- Menü kaç çeşit olacaksa ona göre kurulabilmeli (örneğin 4, 5 veya 6 çeşit).
- **Firma bazlı menüler** olmalı.
- Özel menü türleri de olmalı: **kahvaltı menüsü** (oluşturma ve takip alanıyla), salata hesaplama, soğuk mezeli menüler, tatlı üretimi.
- Menünün maliyeti ve hangi malzemeden ne kadar gerektiği bilindiği için **aylık satın alma planı** menüden otomatik çıkar.

###### Firmalara gönderilen yan malzemeler
- Firmalara yemekle birlikte tuz, baharat, ketçap, mayonez, yağ gibi malzemeler de gönderiliyor. Bunlar da **maliyete** eklenir.
- Bu malzemeler stoklardan seçilir ve fatura akışına yansır.

##### Siparişler ve cari
- **Müşteri sipariş ekranı / portalı**: müşteri günlük yemek siparişini verir. Siparişler otomatik olarak **üretimhaneye raporlanır**.
- Her sipariş bir **irsaliye veya makbuz** olarak üretilir, müşterinin **carisi altına** kaydedilir ve ileride **faturaya** dönüştürülebilir.
- **Kurumsal teklif** hazırlama yöntemleri olsun.
- Cari ve stok takibi yapılsın, **e-fatura entegratörü** bağlansın.
- **Alış faturaları** sisteme çekildikçe stok maliyetleri güncellenir. Menü maliyeti de her zaman güncel kalır.

##### Finans: canlı gider ve gelir ekranları
Bu bölüm işletmenin finansal yönetim ekranlarıdır. Her şey birbirine bağlı ve gerçekçi bir muhasebe modelinde çalışacak. Bir nevi tam teşekküllü muhasebe programı olacak.

###### Mutfak gider ekranı (canlı)
- Her günün girdisi girildikçe bakiye artışını veya azalışını gösteren canlı bir ekran.
- Bağlı e-fatura sisteminden gelen faturalardaki **yan giderler otomatik tespit edilir**: elektrik, su, kira, bakım, mazot vb.
- Bu giderler aynı ekranda yan yana, artış ve azalışlara duyarlı şekilde gösterilir. Ekran yeni gider türlerine açıktır.
- Gider kalemleri: personel maliyeti, işletme giderleri, yan giderler, araç giderleri.

###### Gelir ekranı (canlı kasa)
- Siparişlerden doğan gelirler ve siparişlerin takibi. Giriş ve çıkışa duyarlı bir kasa ekranı.
- Örneğin personel gideri kasayı azaltır, bir mevlüt yemeği geliri kasayı artırır.

###### Gelir, gider ve kâr analizi
- Yukarıdaki ekranlardan gelen verilerle sürekli canlı takip edilen bir analiz ekranı.
- Kasa, banka, çek, senet, ödeme, alacak ve tahsilat modülleri.
- Personele, tedarikçilere ve diğer giderlere ödemeler kasadan, bankadan veya çekle yapılır. Tahsilatlar da aynı yerlere işlenir.

##### Satın alma ve tedarikçiler
- **Tedarikçi ağlarının kayıtları (logları)** takip edilir.
- Buna bağlı bir **satın alma ekranı** olur. Bu ekran en uygun fiyatlı malı bulmaya yardım eder.
- Aylık satın alma, menüden çıkan ihtiyaca göre planlanır.

##### Filo, şoför ve rota yönetimi
- Araç filosu programda takip edilir: araç giderleri, mazot fişleri, bakım ve km girişleri.
- Bir **navigasyon uygulamasıyla bağlantı** kurulur. Mazot ve kullanım bilgileri oradan çekilir.
- **Baş şoför** haritada firmaları belirler ve rota çizer. Rotalar şoförlerin hesaplarına gider, şoförler bu rotalarla sevkiyat yapar.
- Haritadaki her firma bir **cari (müşteri)** kaydıdır ve birbirine bağlıdır.
- Şoför ekranında sohbet paneli ve hatırlatmalar olur, örneğin "X firması tuzluk istedi".
- Şoför, firmalara verilen malzemeleri de girer ve **müşteri tespiti** yapabilir.
- Taşıma mutfağı yönetimi de bu bölümde olur.

##### Personel modülü
- Personel listesi ve personel modülleri kurulacak. Tüm personele dijital **kartvizit** yapılacak (Vinç uygulamamızdaki gibi).
- **Parmak izi cihazıyla bağlantı** kurulacak. Her günün girişlerinden **yoklama** otomatik çekilir: gelmeyen "yok", gelen "var" yazılır.
- Günlük çalışma süresi **10 saat**. Az çalışanın saati kesilir, fazla çalışanın fazla mesaisi yazılır.
- İzin, yoklama, rota, satın alma ve menü kayıtları tutulur.
- **Yevmiye, avans vb. hareketlerden otomatik güncellenen personel bakiyeleri** canlı bir ekranda gösterilir (Vinç'teki gibi). Hepsi Supabase'de saklanır.

##### Roller ve yetkiler (kurucu paneli)
- Bir **kurucu (yönetici) paneli** olur. Kurucu her şeyi görür.
- Kullanıcı hesaplarını kurucu yönetir. Her hesabın neyi görebileceğini kurucu belirler.
- Her rolün kendine özel sorumlulukları ve ekranları vardır:
  - **Diyetisyen:** gramajlar, üretim emirleri, yemek ve tatlı üretimi, menü oluşturma, firma bazlı menü oluşturma. Yani mutfak tarafı.
  - **Satın alma:** tedarikçiler, fiyat karşılaştırma, siparişler.
  - **Pazarlamacı:** günlük rota, müşteri ziyaretleri, teklifler.
  - **Şoför / baş şoför:** rota, sevkiyat, mazot, bakım, km, firmalara verilen malzemeler.
  - **Muhasebe / yönetim:** finans ekranları.
- Veritabanı ve kimlik doğrulama **Supabase** üzerinden yapılacak.

##### Pazarlama, sosyal medya ve botlar
- Uygulama sosyal medya platformlarına bağlı olacak ve **bot mantığıyla** çalışacak.
- Bot her gün içerik üretir, bunları **aylık içerik havuzunda** biriktirir ve paylaşımları planlar.
- Sektörde ve bölgede **müşteri arar** ve bölgesel müşteri portföyü oluşturur.
- Mevcut sosyal medya yönetim notlarımız ve yöntemlerimiz bu modüle aktarılacak.
- **Pazarlamacı için:** botların hedef uygulamalardan bulduğu verilerle günlük bir ziyaret rotası oluşur.
- **Yöneticinin pazarlamacıyı kontrolü:** pazarlamacı gittiği yerden fotoğraf yükler ve geri dönüş açıklaması yazar. Yönetici bunları görür.

##### Modül listesi (özet)
1. Yemek / reçete ve porsiyon maliyeti
2. Menü (çeşit sayısı ayarlanabilir, firma bazlı, kahvaltı, salata, soğuk meze, tatlı)
3. Üretim emirleri, üretim raporu ve malzeme raporu
4. Müşteri sipariş portalı, irsaliye / makbuz, fatura
5. Cari, stok, alış faturaları, e-fatura entegrasyonu
6. Canlı gider ekranı ve canlı gelir (kasa) ekranı
7. Muhasebe: kasa, banka, çek, senet, ödeme, tahsilat, gelir, gider ve kâr analizi
8. Satın alma ve tedarikçi takibi
9. Filo, şoför, harita ve rota (navigasyon entegrasyonu)
10. Personel: kartvizit, parmak izi yoklaması, mesai, yevmiye, avans, izin
11. Kurucu paneli, roller ve yetkiler
12. Pazarlama: sosyal medya botu, müşteri arama, pazarlamacı rotası ve kontrolü, kurumsal teklif
13. Bildirim merkezi, sohbet paneli ve hatırlatmalar
14. Yapay zekâ yardımcıları

##### Beklenen çıktı
1. Genel bilgi mimarisi: menü yapısı, ekranlar ve kimin neyi gördüğü.
2. Ana ekranların tasarımı. Öncelik sırası: porsiyon ve menü maliyeti, günlük üretim, canlı gider ve gelir, sipariş portalı, patron özet ekranı.
3. Veritabanı taslağı: tablolar, ilişkiler ve maliyet hesap mantığı.
4. Müşteriye gönderilecek, herkesin açabileceği **ortak linkte çalışan şık bir demo**.



### 5.B Ek gereksinimler — 2. tur, 2b, 3. tur, 4. tur (kullanıcının sonraki notları)
> Kaynak: `prompt/yemekhane-yazilimi-prompt.md` satır 144–son (birebir alıntı; başlık seviyeleri düşürüldü).

#### Ek gereksinimler (2. tur)

##### Muhasebe kuralı (bağlayıcı)
- Hammadde ve sarf malzemesi gideri **yalnız tedarikçi faturası işlendiğinde, bir kez** yazılır. Üretim, sevkiyat ve fire gider yazmaz; yalnız stoktan düşer ve satılan malın maliyetini (SMM) / porsiyon maliyetini raporlar.
- Stok adları kanoniktir (tek ürün adı; tedarikçi ve fatura adları takma ad olarak eşlenir). Her stok girişi **tedarikçi etiketli bir parti** açar (tedarikçi, fatura/sipariş no, parti no, son kullanma tarihi, birim maliyet). Çıkışlar FIFO usulüyle partiden düşer.
- Stok girişi tek kapıdan yapılır: mal kabulü veya fatura. Hangisi önce gelirse partiyi açar, diğeri onu eşleştirir; çift giriş olmaz.

##### Onaylar ve değişmez kayıt
- Tanımlı işlemler (satınalma planı, maliyet düzenleme, eşik üstü gider/ödeme, izin/avans, modül kapatma, kullanıcı silme, hata düzeltme önerisi) onaya düşer. Kimin onaylayacağı ve tutar eşiği ayarlardan belirlenir. Talep eden kendi talebini onaylayamaz.
- Yöneticinin "Bugün" ekranında **Onaylar** sekmesi olur. Burada bekleyen talepler, önce/sonra farkı, onay/red ve gerekçe görünür.
- Denetim kaydı (kim, ne zaman, hangi kayıt, önce/sonra) **silinemez ve değiştirilemez**. Kayıtlar hash zinciriyle mühürlenir ve kurcalama tespit edilebilir.

##### Maliyet sekmesi ve satınalma planı (sürümlü)
- **Finans > Maliyet** sekmesi günlük, aylık ve yıllık görünüm sunar. Görünümler: öğün/müşteri bazında kişi sayısı, tüketim maliyeti, ambalaj, personel, işletme, araç ve genel gider payı, kişi başı tam maliyet, gelir ve marj.
- **Satınalma planı menüden otomatik oluşur.** Hesap: gelecek ayın menüsü × geçen ayın ortalama kişi sayısı (gün/öğün/müşteri) × kalibre gramaj. Beklenen stok ve açık siparişler düşülür. Fiyat olarak geçerli en uygun teklif (marka tercihine uygun) veya son alış fiyatı kullanılır.
- Yönetici maliyet ve satınalma planı sekmelerinde **düzenleyip kaydedebilir**. Her kayıt **yeni bir sürüm** oluşturur, hiçbir sürüm üzerine yazılmaz veya silinmez. Tüm sürümler arşivde okunur, iki sürüm karşılaştırılabilir, eski bir sürümden yeni sürüm türetilebilir. Otomatik değer ile elle girilen değer yan yana görünür. Satınalma siparişi yalnız onaylı sürümden oluşturulur.
- Her değişiklik loglanır: kim, ne zaman, önceki ve sonraki değer.

##### Kurucu paneli ve Hata Merkezi
- Kurucu hesabını yönetir (ad, telefon, e-posta, parola). Kullanıcı davet eder, rol verir, geçici olarak kısıtlar, salt-okur yapar veya siler. Modülleri açıp kapatabilir; kapalı modülün verisi silinmez, yalnız yazmaya kapanır.
- **Hata Merkezi:** uygulama ve veritabanı hataları otomatik toplanır; kaynak, sayı, ilk/son görülme ve etkilenen kullanıcı gösterilir. Bir **debugger botu** hatayı inceler; teşhis, kod/SQL yaması, test planı ve risk **önerir**. Kurucu onaylamadan hiçbir şey uygulanmaz. Onay sonrası yalnız taslak değişiklik (ör. taslak PR) açılır; canlı sisteme otomatik müdahale yoktur.

##### Rol bazlı çalışma alanları
Ayrı modüller yerine her rolün "Bugün" ekranı kendi iş masasıdır:
- **Pazarlama:** günlük hedef firma listesi (bot), müşteri adayı ve görüşme takibi (CRM, KVKK izinli), sosyal medya etkileşim verileri, teklif/proforma ve menü/fatura şablonları.
- **Müşteri takibi:** müşteri bazında alerji/hassasiyet ve şikâyet kaydı. Uyarılar menü, üretim ve sevkiyat ekranlarında görünür.
- **Canlı takip:** mutfak üretimi ve sevkiyat durumu tek panoda (TV modu).
- **Satınalma:** teklif dosyalarının analizi (marka, ambalaj, birim fiyat), marka tercihi, tasarruf raporu.
- **Muhasebe:** belge gelen kutusu (fatura, fiş, dekont, makbuz, gider pusulası). Belge türüne göre işlenir, mükerrer kontrol yapılır.
- **İK:** devam/devamsızlık analizi, personel değerlendirme.
- **Şoför:** günlük rota, araç kontrol listesi, müşteri uyarıları.
- **Diyetisyen/üretim:** reçete, gramaj ve alerjen kontrolü.
- **Yönetici:** özet ve Onaylar.
- Mevcut rollere ek olarak (bozmadan) bir **İK** rolü ve **baş şoför** işareti eklenir.

#### Ek gereksinimler (3. tur)

##### Ana stok listesi ve fatura eşleştirme
- Sistem sade, kanonik adlı bir ana stok listesiyle başlar: "Domates", "Patlıcan", "Limon", "Dana Kuşbaşı" gibi. Hazır iskelet 564 kalem içerir, kanonik ad dışındaki yazımlar yalnız takma ad (eş anlam) olarak tutulur. Adlar uygulamadan değiştirilebilir.
- Tedarikçi faturası işlenirken satırdaki ürün mevcut bir stoğa eşleşirse (önce o tedarikçiye özgü takma ad, sonra genel takma ad, sonra benzerlik önerisi) **o kanonik stoğa yazılır**, stok güncellenir ve **tedarikçi etiketi** (hangi tedarikçiden, hangi faturayla, hangi parti) kaydedilir. Onaylanan yeni yazım takma ad olarak öğrenilir.
- Eşleşme yoksa **yeni stok kalemi oluşturulur**, fatura yazımı ona takma ad olarak eklenir ve kalem "gözden geçir" olarak işaretlenir.
- Koli, kasa, teneke gibi ambalaj birimleri stok birimine katsayıyla çevrilir. Katsayı tedarikçiye göre farklı olabilir.

##### Yemek listesi ve üretimden öğrenen reçete
- Yemekler önce **yalnız adla** açılır (çorba, ana yemek, sebze/zeytinyağlı, pilav/makarna, salata/meze, tatlı/meyve, kahvaltılık…). Her yemek hangi öğünlerde verildiğini taşır: kahvaltı, öğle, akşam; birden fazlası seçilebilir.
- Malzeme ve miktarlar mutfakta **gerçek üretimden** girilir: "X kişilik üretildi, şu malzemelerden Y kadar kullanıldı". Buradan kişi başı kullanım (Y ÷ X) ve güncel stok fiyatlarıyla kişi başı malzeme maliyeti hesaplanır. Üretimler biriktikçe sistem reçete normunu önerir; yönetici onaylar, eski norm sürüm olarak saklanır.

##### Öğün bazlı maliyet (kahvaltı, öğle, akşam)
- İşletme üç ayrı hizmet satar: **kahvaltı, öğle yemeği, akşam yemeği**. Her birinin hazırlığı, üretimi, kişi sayısı, siparişi, üretim emri ve maliyeti ayrıdır. Siparişler, menü planları, müşteri menü tanımları, üretim emirleri, stok çıkışları, satınalma planı ve maliyet raporları öğün bilgisini taşır ve öğüne göre filtrelenir.
- **Nihai öğün maliyeti = kişi başı malzeme maliyeti + tüm işletme giderlerinden o öğüne düşen payın o öğünün kişi sayısına bölümü.**
- Hammadde gideri genel gidere tekrar eklenmez; zaten malzeme maliyetindedir.
- Ortak giderler (personel, enerji, lojistik, kira, amortisman, yönetim…) doğru anahtarlarla öğünlere dağıtılır. Örnek anahtarlar: çalışma saati, porsiyon, sefer/km, fiili tüketim, porsiyon eşdeğeri. Anahtarlar ve ağırlıklar ayarlanabilir ve sürümlüdür. Dağıtılan paylar toplamı gider toplamına eşittir.
- Rapor gün × öğün × müşteri kırılımında kişi başı malzeme, genel gider ve nihai maliyeti gösterir. Satış fiyatıyla karşılaştırıp marj verir; günlük, aylık ve yıllık görünüm sunar.
- Bu mantığın matematiğini ve veri modelini yazılımı geliştiren taraf sağlam biçimde tasarlar (ağırlıklı ortalama, aykırı değer eleme, FIFO maliyet, dağıtım ve yuvarlama kuralları, test senaryoları). Kullanıcı yalnız niyeti tanımlamıştır.

#### Ek gereksinimler (4. tur)

##### Reçete bir kez, 1 kişilik
- Reçete bir kez oluşturulur ve süresiz kullanılır. İlk üretimde mutfak, o üretimin kişi sayısı için gerçek kullanılan miktarları girer (ör. 1200 kişi için 100 kg et). Sistem arka planda 1 kişilik miktarı hesaplar ve reçeteyi **1 kişilik** olarak kaydeder. Kullanıcı hesap yapmaz.
- Sonraki üretimler reçeteyi kendiliğinden değiştirmez. Yalnız düzeltme önerisi oluşur, onaylanırsa yeni sürüm kaydedilir.

##### Menü 1 kişilik, siparişle ölçeklenir
- Menüler 1 kişi için tanımlanır. Gün, öğün ve müşteri bazındaki sipariş sayıları menüyü ölçekler. Sonuç üretimhaneye gider: o günün sayısı için her malzemenin kaç kg (veya adet) gerektiği, kanonik stok adıyla, stok mevcudu ve eksikleriyle.

##### Üretimhane iş emri
- Üretimhanede reçetenin yapılış bilgisi de tutulur: işlem adımları (istasyon, süre, sıcaklık, kritik kontrol noktaları), doğrama biçimleri (küp, julyen, halka, rende vb.) ve saklama kapları (küvet türleri, termobox, 3 bölmeli kap).
- Bu bilgiler günün sayılarıyla birlikte **iş emri** olarak yazılır. Kahvaltı, öğle ve akşam için ayrı iş emri oluşur. Basılan iş emri değişirse yeni revizyon açılır, eski revizyon arşivde kalır.

##### Basılı iş emri raporu
- İş emri, mutfak için **yazdırılabilir A4 HTML rapor** olarak alınır. Rapor kurumsal şablonu ve logoyu taşır, büyük punto kullanır, siyah-beyaz baskıda okunur, tablo başlıkları her sayfada tekrar eder.
- İçerik:
  - başlık: logo, iş emri no, tarih, öğün, revizyon;
  - toplam kişi ve yemek listesi;
  - **firma bazında kişi sayıları ve kap türleri** (3 bölmeli kap / küvet; kap adetleri) ile alerji uyarıları;
  - malzeme çekme listesi (kg, onay kutusu);
  - yemek bazında adımlar ve doğrama biçimleri;
  - saklama ve paketleme bilgisi;
  - imza alanları (hazırlayan, aşçıbaşı, kalite kontrol, teslim alan).
- Raporda "Yazdır" ve "PDF indir" seçenekleri bulunur. QR kod, iş emrini uygulamada açar.



### 5.C Kullanıcı notlarının modül modül eşleştirmesi (gap analizi, §0–§20; DB/ekran önerileriyle)
> Kaynak: `notlar-analiz/eslestirme.md` satır 7–31 (birebir alıntı; başlık seviyeleri düşürüldü).

#### 0. Kısa tablo

| # | İstek | Durum | Mevcut yer |
|---|---|---|---|
| 1 | Reçete = ürün, stoktan malzeme; üretim alanı; kişi × gramaj = kullanım | **Var** (çekirdek) | `recipes`, `recipe_ingredients`, `v_recipe_lines`, `recipe_scale()`, `prep_batches`, `/receteler`, `/uretim` |
| 2 | Menü → sipariş → üretim kontrolü → üretim emri → stok/gider/gelir; menüden hammadde talebi; satınalma planı | **Kısmen var** | `meal_orders`, `menu_plans`, `plan_prep_from_orders()`, PrepPage "Üretim Emri" raporu + "stoktan düş", `/satinalma` (Aylık ihtiyaç) |
| 3 | Menü tipleri (4/5 çeşit), 3 gözlü tabla vs küvet ayrı maliyet, menü bazlı sipariş, aylık sipariş | **Kısmen var** | `menus.kind`, `menu_items.course`, `meal_orders.menu_id`; tabla/küvet ve aylık sipariş **yok** |
| 4 | Gramaj kalibrasyonu (toplam kg ÷ kişi → reçete, sürekli güncellenen) | **Kısmen var** | PrepPage + `recipe_from_prep()` (tek günden reçeteyi **üzerine yazar**, geçmiş/ortalama yok) |
| 5 | Sosyal medya merkezi (Embay gibi) + ana sayfada hesap önizlemeleri | **Kısmen var** (yalnız tablo) | `social_posts` tablosu; `/sosyal-medya` IN_PROGRESS (ekran dosyası yok) |
| 6 | Ana sayfa: yarının sayısı, üretim emri/hazırlık, önemli notlar | **Kısmen var** | `DashboardPage.tsx` (yarın kişi, 16:00 kesimi, kasa, vadeler); üretim emri durumu ve notlar **yok** |
| 7 | Lojistik: navigasyon linki, rota çizimi, şoför hesabı + masraf, firmalara giden malzeme, araç/şoför kartı, muayene, rota yakıt analizi | **Kısmen var** (şema) | `vehicles`, `vehicle_logs` (→ gider tetikleyicisi), `routes` (stops jsonb), `/sevk` (SuppliesPage, çalışıyor); `/rota`, `/sofor`, `/filo` ekranları **yok** |
| 8 | Parmak izi XLS(X) → puantaj, 10 saat kuralı, canlı bakiye, ödeme logları, izin | **Kısmen var** (büyük ölçüde) | `attendance_days`, `employee_ledger`, `employee_requests`, `src/lib/payroll.ts`, `/puantaj`, `/personel-bakiye`; XLSX okunmuyor (yalnız CSV), izin bakiyesi/bordro dönemi yok |
| 9 | Kurumsal menü sunumu + teklif formu (menü, mutfak fotoğrafı, sosyal medya, referanslar, tedarikçiler) | **Kısmen var** (şema) | `quotes` tablosu, `ReportFrame.tsx` antet; `/teklifler` ekranı **yok**, görsel/medya deposu yok |
| 10 | Menü bazlı kârlılık (mutfak + yan maliyet = kişi başı; fiyat serbest) | **Kısmen var** | `v_menu_costs` (yalnız gıda maliyeti + `target_price` marjı), FinanceSummaryPage (1 kişilik tam maliyet ayrışımı) |
| 11 | Kanonik stok adı, fatura adı eşleştirme, fiyat güncellemesinde tedarikçi+belge izi | **Kısmen var** | InvoicesPage UBL içe aktarma → hammadde fiyatı/stok; `ingredients_name_uidx`; **alias tablosu yok**, `ingredient_prices.supplier_name` serbest metin, belge bağı yok |
| 12 | Müşteriye menü tanımlama, siparişin o tanımdan gelmesi; cari altında müşteri/tedarikçi | **Kısmen var** | `menus.customer_id` (firmaya özel menü), `menu_plans.customer_id`; **müşteri-menü sözleşme tablosu yok**, cari ekstre ekranı yok |
| 13 | Çek/senet (alınan, verilen, yazılan, ciro), ödeme/tahsil hatırlatma, kredi, alacak listesi, e-posta/WhatsApp tahsilat mesajı, kasaya bağlı tahsilat/ödeme | **Kısmen var** | `cheques` tablosu, `finance_entries` (bekliyor/odendi), `finance_accounts`, `/kasa`; `/cek-senet` ekranı yok, kredi/kısmi tahsilat/hatırlatma **yok** |
| 14 | Rehber etiketler, ilk kullanım ipuçları, basit UX | **Kısmen var** | `modules.ts` `hint` alanı, Dashboard "ilk adımlar" listesi, EmptyState metinleri, ModuleHero açıklamaları |
| 15 | Kurumsal logo + rapor şablonu (adres, e-posta, iletişim, sosyal medya) | **Kısmen var** | `company_settings`, `CompanyPanel.tsx`, `ReportFrame.tsx`; logo sabit SVG (`src/ui/Logo.tsx`), sosyal medya alanları ve logo yükleme **yok** |
| 16 | Supabase kurulumunun uçtan uca test edilmesi | **Kısmen var** | `supabase/tests/*.sql` (6 dosya); canlı DB neredeyse boş, test senaryosu `supabase-kontrol.md`'de |
| 17 | Kurucu paneli: hesap bilgisi, kullanıcı silme/kısıtlama, DB modüllerini aç/kapat, hata tespit & çözüm (debugger bot) | **Kısmen var** | `/kurucu` FounderPage (Rol × sekme, Kişiye özel, Bağlantılar), `team_members.active`, `list_team()`, `ErrorBoundary.tsx` (yalnız console.error) |
| 18 | Rol çalışma alanları (pazarlama, müşteri, sevkiyat+mutfak canlı takip, satınalma, muhasebe, İK, şoför, diyetisyen/üretim, yönetici) | **Kısmen var** | Rollerin çoğu için tablo var, ekranlar dağınık; rol bazlı ana ekran yok |
| 19 | Onaylar sekmesi (yönetici son onaycı) + gönderen/onaylayan değişmez kayıt | **Yok** (audit altyapısı var) | `audit_log` + `log_audit()` tetikleyicisi (her tabloda), yazma politikası yok |
| 20 | Maliyet sekmesi (günlük/aylık/yıllık), menüden otomatik satınalma planı, yönetici düzenler; her sürüm arşivde, tüm değişiklik loglu | **Kısmen var** | FinanceSummaryPage (12 ay), PrepPage günlük maliyet, PurchasingPage aylık ihtiyaç (anlık hesap; **kaydedilmiyor, sürüm yok**) |

#### 1. Reçete = ürün; üretim alanı; kişi sayısı × gramaj = malzeme kullanımı
**Durum: Var (çekirdek sağlam)**

**Nerede:**
- DB: `ingredients` (stok birimi, fire %, son fiyat, ortalama maliyet, alerjen), `recipe_ingredients` (1 porsiyon NET miktar, fire override), `v_recipe_lines` (net→brüt→stok birimi→maliyet), `v_recipe_costs`, `recipe_scale(recipe, porsiyon)` (N porsiyon için hammadde).
- Ekran: `/receteler` (RecipesPage, RecipeEditor), `/hammaddeler`, `/uretim` (PrepPage: yemek başlıkları siparişten gelir, reçeteden doldur, gerçek miktar gir, porsiyon maliyeti), `/mutfak-ekrani` (tablet).
- Fonksiyon: `plan_prep_from_orders(date, meal)` = Σ(sipariş kişi × `menu_items.portion_factor`) → `prep_batches.portions`; `prep_fill_from_recipe(batch)` = brüt × porsiyon → planlanan miktar.

**Eksik:**
- "Tatlı/yarı mamul" (ör. beşamel, hamur, sos) alt-reçete desteği yok (reçete içinde reçete).
- Reçete sürümü yok: reçete değişince geçmiş hazırlıkların planı değişmiyor ama "hangi gramajla planlandı" izi tutulmuyor.

**Önerilen tasarım:**
- `recipe_ingredients` içine opsiyonel `sub_recipe_id uuid references recipes(id)` (ingredient_id ile XOR). `v_recipe_lines` yarı mamulü özyinelemeli açsın (derinlik ≤3).
- `prep_batches` içine `recipe_snapshot jsonb` (plan anındaki gramajlar) — kalibrasyon ve sapma raporu için.
- Yeni sekme açmayın: yarı mamul, Reçeteler ekranında kategori ("Yarı mamul") olarak dursun.

**Bağımlılıklar:** Yok; #4 (kalibrasyon) ve #10 (kârlılık) buna dayanır.

---

#### 2. Uçtan uca akış: menü → sipariş → üretim kontrolü → üretim emri → stok / gider / gelir; satınalma
**Durum: Kısmen var**

**Nerede:**
- Menü: `menus`, `menu_items`, `menu_plans` (gün × öğün × genel/firma), `effective_menu()`.
- Sipariş: `meal_orders` (menu_id opsiyonel, D-1 16:00 kesimi `order_is_open()`), müşteri linki `portal_set_order()` (`/siparis/:token`).
- Üretim: PrepPage → "Üretim Emri" raporu (istasyon bazlı, yazdırılabilir) + "Malzemeleri stoktan düş" (istemci tarafında `stock_movements` kind=`cikis`, source=`hazirlik`).
- Gelir: `meal_orders.status='teslim_edildi'` → tetikleyici `sync_order_entry()` → `finance_entries` (gelir, bekliyor).
- Gider: Gelen fatura onayı → `sync_invoice_entry()` → `finance_entries` (gider, bekliyor).
- Satınalma: `/satinalma` "Aylık ihtiyaç" = menü planı × beklenen kişi (sipariş yoksa firmanın son 4 hafta ortalaması) × reçete brütü − stok; en uygun tedarikçi (`supplier_quotes`); taslak `purchase_orders`.

**Eksik:**
- **Üretim emri bir kayıt değil, yalnızca rapor.** "Üretim evi kiloları kontrol eder → anormallik yoksa emir verilir" adımı (onay durumu, onaylayan, zaman) yok.
- Stok düşümü istemci kodunda ve elle tetikleniyor; atomik değil (bir RPC/tetikleyici değil). Gıda maliyeti gideri tahakkuk esaslı olarak üretimden değil faturadan geliyor (bu doğru; ama "üretim maliyeti" ile "fatura gideri" arasında mutabakat raporu yok).
- Satınalmada **geçen ayın günlük/aylık sayıları** sekmesi yok (sadece ortalama arka planda kullanılıyor); tedarikçiye **satınalma talebi gönderme** (e-posta/WhatsApp/PDF) yok.
- **Çift stok girişi riski:** PurchasingPage "Teslim alındı → stoğa gir" (source=`siparis`) ve InvoicesPage fatura aktarımı (source=`fatura`) aynı malı iki kez stoğa sokabilir (bkz. supabase-kontrol.md B-3).

**Önerilen tasarım:**
- Yeni tablo `production_orders` (id, prod_date, meal, status `taslak→kontrol→onaylandi→uretildi→kapandi`, checked_by, checked_at, approved_by, approved_at, anomaly_notes, total_people, planned_cost, actual_cost). `prep_batches.production_order_id` FK (mevcut hazırlık satırları emrin kalemi olur — yeni kavram yerine mevcut tabloyu bağlayın).
- `production_order_lines` görünümü: yemek × kişi × planlanan kg (kalibre reçeteden) + firma/menü kırılımı.
- RPC `po_check(order_id)` → anomali kuralları (reçetesiz yemek, fiyatı olmayan malzeme, stok yetersiz, planlanan kg kalibrasyon ortalamasından ±%25 sapma, sipariş kesim sonrası değişmiş) → `anomalies jsonb`.
- RPC `po_approve(order_id)` (SECURITY INVOKER, rol: yonetici/asci_basi) → durum `onaylandi`.
- RPC `po_close(order_id)` → tek transaction'da: gerçek miktarlardan `stock_movements` (cikis, source=`uretim`, source_id=batch), `prep_batches.status='kapandi'`, kalibrasyon kaydı (#4), maliyet fotoğrafı. İstemcideki `issueStock` bu RPC'yi çağıracak şekilde değişsin (mevcut `source='hazirlik'` kayıtları geçerli kalır).
- Gelir tetikleyicisi aynen kalsın (teslim = gelir). **Gider yalnız faturadan (bkz. §0.1)**; `po_close` stoktan FIFO parti tüketir ve SMM/porsiyon maliyetini yazar, `finance_entries`'e dokunmaz. Finans Özeti'ne "Tüketim maliyeti (üretim) vs Gıda gideri (fatura)" mutabakat kartı eklensin.
- Satınalma ekranı sekmeleri (3 sekme, gereksiz yok): **Geçen ay** (günlük sayı tablosu + aylık toplam + tüketilen hammadde), **Bu ay ihtiyaç** (mevcut "Aylık ihtiyaç"), **Talepler & Siparişler** (mevcut sipariş sekmesi + "Talep gönder": PDF/WhatsApp/e-posta). "En uygun fiyat" sekmesi, Talepler içinde kalem satırında kupa olarak gösterilsin (ayrı sekme gereksiz) — ya da Hammadde kartına "Fiyat geçmişi" olarak taşınsın.
- `purchase_orders.lines jsonb` → `purchase_order_lines` tablosu (FK'lı); stok girişi **tek kapıdan** ve **tedarikçi etiketli parti** olarak (§0.1): PO teslimi partiyi açarsa fatura yalnız gider + fiyat düzeltmesi yapar; faturası önce gelen malda partiyi fatura açar, PO teslimi eşleştirir.

**Bağımlılıklar:** #3 (menü tipi/sunum şekli), #4 (kalibrasyon), #11 (isim eşleştirme), #12 (müşteri menü tanımı).

---

#### 3. Menü tipleri, tabla/küvet ayrı maliyet, menü bazlı sipariş, aylık sipariş
**Durum: Kısmen var**

**Nerede:** `menus.kind` (`standart|kahvalti|soguk_mezeli|diyet|ozel`), `menu_items.course` (çorba/ana/yardımcı/salata/…), `menus.customer_id` (firmaya özel), `meal_orders.menu_id` + unique (gün, öğün, müşteri, menü) → bir firmaya aynı öğünde birden fazla menü siparişi mümkün. OrdersPage'de menü seçimi var.

**Eksik:**
- "4 çeşit / 5 çeşit" gibi **menü tipi** kavramı yok (kap sayısı serbest ama sınıflandırma/fiyatlandırma birimi değil).
- **Sunum şekli yok**: 3 gözlü tabla (kap + kapak + streç + kaşık seti maliyeti kişi başı) vs küvet/gastronom (N kişilik kap, depozitolu/iade). Maliyet ve fiyat buna göre ayrışmıyor.
- **Aylık/sabit sipariş yok**; müşteri linki yalnız 7 gün gösteriyor ve menü seçimi sunmuyor (`portal_set_order` menu_id almıyor; birden fazla menü siparişi olan firmada ilk bulunan siparişi günceller — hata kaynağı).
- Üretimde "hangi menü, hangi firma, kaç kişi" kırılımı: `plan_prep_from_orders` yemek bazında toplar; firma/menü kırılımı raporda yok.

**Önerilen tasarım:**
- `menu_types` (code pk, name "4 Çeşit", course_count int, sort) → `menus.menu_type_code` FK (null = serbest). Mevcut `kind` alanı korunur (kahvaltı/diyet ayrımı için).
- `service_styles` (code pk: `tabla_3goz`, `kuvet`, `sefer_tasi`; name; `pack_mode` `kisi_basi|kap_basi`; `people_per_container` int (küvet için); `container_ingredient_ids`/daha iyisi `service_style_items` (style_code, ingredient_id, qty_per_person veya qty_per_container) — ambalaj kalemleri stokta `temizlik_sarf` kategorili hammadde olarak durur, böylece fiyatları faturadan güncellenir ve stoktan düşer.
- `meal_orders.service_style text references service_styles(code) default 'tabla_3goz'`, `meal_orders.customer_menu_id` (bkz. #12).
- View `v_menu_style_costs`: menü × sunum şekli → gıda maliyeti + ambalaj maliyeti = kişi başı mutfak maliyeti.
- Aylık sipariş: `standing_orders` (id, customer_id, customer_menu_id, meal, service_style, period `YYYY-MM`, default_qty, weekday_qty jsonb `{1:120,…,6:80}`, status `taslak|onayli`, locked_until date) + RPC `standing_order_generate(id)` → ilgili ayın `meal_orders` satırlarını üretir (kind=`sozlesmeli`, source alanı ekleyin: `meal_orders.source text default 'elle' check in ('elle','portal','aylik')`). Müşteri, kesim saatine kadar tek günü değiştirebilir (mevcut `order_is_open` kuralı).
- Portal: `portal_set_order(token, date, meal, qty, note, customer_menu_id, service_style)` yeni imza (eskisi korunur, yenisi ek), `portal_info` müşterinin tanımlı menülerini ve ay görünümünü döndürür.
- Ekran: yeni sekme yok. **Siparişler** sayfasına sekme: `Günlük` (mevcut) · `Aylık sipariş` (takvim ızgarası, firma bazlı). Üretimde (Üretim ekranı) "Firma × menü × kişi" dağılım kartı.

**Bağımlılıklar:** #12 (müşteri menü tanımı), #10 (kârlılık), #2.

**Çakışma:** Önceki migration (`kitchen_prep`) `3_kap/4_kap` değerlerini `standart`'a çevirdi; yeni `menu_types` bu bilgiyi geri getirir — `kind` ile karıştırılmamalı.

---

#### 4. Gramaj kalibrasyonu (toplam kullanılan ÷ sipariş sayısı → reçete, sürekli güncel)
**Durum: Kısmen var**

**Nerede:** PrepPage (aşçı toplam miktar girer → `v_prep_batch_costs.cost_per_portion`, `total_g`), `recipe_from_prep(batch)` (tek hazırlıktan reçete türetir), `prep_batch_items.planned_qty` (reçete önerisi) → `variance_pct`.

**Eksik:**
- `recipe_from_prep()` reçetenin **tüm satırlarını silip** tek günün verisiyle yeniden yazıyor; önceki günler, ortalama, aykırı değer eleme yok. 1200 kişilik Tas Kebap'ta 100 kg et → 83,3 g/kişi tek gün doğru olabilir ama ertesi gün 900 kişide 70 kg girilirse reçete zıplar.
- Kalibrasyon geçmişi/güven düzeyi, "otomatik kullan" bayrağı, kilitleme yok.
- Porsiyon sayısı teslim edilenden mi siparişten mi alınacağı belirsiz (`coalesce(delivered_qty, ordered_qty)`).

**Önerilen tasarım:**
- `recipe_calibrations` (id, recipe_id, ingredient_id, prep_batch_id, prep_date, portions numeric, used_qty_base numeric, per_portion_base numeric generated, included bool default true, reason text, created_by, created_at) — her kapanan hazırlıkta satır başına 1 kayıt.
- `recipe_ingredients` ek kolonlar: `calib_qty numeric`, `calib_n int`, `calib_cv numeric` (değişkenlik), `calib_updated_at`, `calib_mode text check in ('manuel','otomatik','kilitli') default 'otomatik'`.
- Algoritma (DB fonksiyonu `recalibrate_recipe(recipe_id)`): son 10 dahil kaydın **ağırlıklı medyanı** (ağırlık = porsiyon), medyandan ±%30 sapanlar otomatik `included=false`. `calib_mode='otomatik'` ise `net_qty` = medyan × (1 − fire%). `kilitli` ise sadece öneri gösterir.
- Hazırlık kapanışında (`po_close`) otomatik çağrılır; ekranda "Kalibrasyon" sekmesi: yemek seçilir → günler listesi (kişi, toplam kg, kişi başı g, dahil/hariç) → grafik → "Reçeteye uygula".
- Hızlı giriş: "1200 kişi · Tas Kebap · Et 100 kg" tek satır formu (Mutfak Ekranı'nda büyük butonlu). Reçetesi olmayan yemekte ilk girişte reçete oluşur (mevcut davranış korunur).
- `recipe_from_prep` geriye uyum için kalır ama içerik `recipe_calibrations` yazıp `recalibrate_recipe` çağıracak şekilde değişir (üzerine yazma yerine).

**Ekran yeri:** Yeni modül açmayın → **Üretim** modülünde `Kalibrasyon` sekmesi (+ reçete editöründe "Kalibrasyon geçmişi" paneli).

**Bağımlılıklar:** #1, #2 (kapanış akışı).

---

#### 5. Sosyal medya merkezi + ana sayfada hesap önizlemeleri
**Durum: Kısmen var (yalnız veri tablosu)**

**Nerede:** `social_posts` (havuz/taslak/onay/planlandı/yayınlandı, platforms[], tags[]), menüde `/sosyal-medya` tanımlı ama `IN_PROGRESS` (sayfa dosyası yok). PLAN.md faz 9 "Embay yöntemi".

**Not:** Kullanıcının GitHub hesabında erişilebilen depolarda "Embay" adlı bir depo bulunamadı (depolar: Trakya-Catering, kibritci_web, kibritci-vercel, Kibritci_Otomasyon, santiyePROGRAM, sahin-manitou-kiralama, KIBRITCI_ERP, bloom-honey-urban-ocean ve xx = "Bizim Vinç ERP"). Embay deposu başka bir hesapta/organizasyonda olabilir; Claude'a depo adı verilmeli.

**Eksik:** Hesap kartları (bizim + sektör/rakip), takipçi/gönderi özet anlık görüntüleri, içerik takvimi ekranı, medya deposu, onay akışı ekranı, ana sayfa önizleme.

**Önerilen tasarım:**
- `social_accounts` (id, platform `instagram|facebook|tiktok|youtube|linkedin|x|google_business`, handle, url, owner `biz|sektor`, display_name, avatar_path, followers int, posts int, last_post_url, last_post_thumb_path, last_synced_at, notes, active).
- `social_account_snapshots` (account_id, taken_on date, followers, posts, engagement numeric) → büyüme grafiği.
- `social_posts` ek: `account_ids uuid[]` veya `social_post_targets` (post_id, account_id, status, published_url), `media_paths text[]`, `approved_by`, `approved_at`, `menu_plan_date` (menüden içerik önerisi).
- Storage: `brand-media` bucket (private; yonetici/pazarlamaci yazar, personel okur).
- Veri kaynağı: Meta Graph / TikTok API anahtarları gelene kadar **elle güncelleme + link önizleme** (oEmbed Instagram için Facebook App token ister → 🔌). Entegrasyon için Supabase Edge Function + zamanlanmış görev (pg_cron) — anahtar gelince.
- Ekran: tek modül **Sosyal Medya** — sekmeler: `Hesaplar` (bizim + sektör kartları), `Takvim` (ay görünümü, sürükle-bırak), `İçerik Havuzu & Onay`. Ana sayfada "Sosyal medya" kartı: bizim hesapların avatar, takipçi, son gönderi küçük resmi, "bu hafta planlanan 3 gönderi".

**Bağımlılıklar:** #15 (marka varlıkları deposu), #6.

---

#### 6. Ana sayfa: yarının sayısı, üretim emri/hazırlık, önemli notlar
**Durum: Kısmen var**

**Nerede:** `src/features/dashboard/DashboardPage.tsx`: bugünkü kişi/maliyet, **yarın kişi** + kesime kalan süre, yarının sipariş listesi, kasa bakiyesi, vadesi gelenler, ilk kullanım kontrol listesi; `src/lib/alerts.ts` + `Notifications.tsx` (zam, vadesi geçen alacak, eksik fiyat, gelmeyen sipariş).

**Eksik:** Yarının üretim emri durumu (taslak/kontrol/onaylı), hazırlık ilerlemesi (kaç yemek pişti/kapandı), yarının hammadde yeterliliği (stok eksikleri), **önemli notlar/duyurular**, sosyal medya önizlemesi, sipariş girmeyen firmalar listesi (alerts'te var, kartta yok).

**Önerilen tasarım:**
- `dashboard_notes` (id, title, body, priority `normal|onemli|acil`, pinned bool, visible_roles text[] (boş = herkes), starts_on, ends_on, created_by, created_at, done bool). RLS: okuma = `is_staff() and (visible_roles = '{}' or current_app_role() = any(visible_roles))`; yazma = yonetici/kurucu (+ yazarın kendi notu).
- Dashboard düzeni (role göre): 1) **Yarın**: kişi (firma × menü × sunum), kesim sayacı, sipariş girmeyenler; 2) **Üretim emri**: durum rozeti + "Kontrole git"; 3) **Stok uyarısı**: yarın için eksik kalemler; 4) **Notlar**; 5) **Kasa & vadeler** (yalnız FIN rolleri); 6) **Sosyal medya** (yonetici/pazarlamaci).
- Realtime: `meal_orders`, `production_orders`, `dashboard_notes` yayına eklensin.

**Bağımlılıklar:** #2 (production_orders), #5.

---

#### 7. Lojistik
**Durum: Kısmen var (şema hazır, ekranlar yok; firmalara giden malzeme çalışıyor)**

**Nerede:**
- `vehicles` (plaka, sürücü=employee, km, muayene/sigorta tarihi, bakım aralığı, tracker), `vehicle_logs` (yakıt/bakım/km/arıza/sigorta, litre, tutar, hesap) → `sync_vehicle_entry()` ile `finance_entries` gideri + km güncelleme.
- `routes` (gün, araç, şoför, durum, `stops jsonb`), `customers.lat/lng`.
- `/sevk` SuppliesPage: `stock_movements` kind=`sevk` + customer_id (tuz, ketçap…) → firma bazlı maliyet.
- Menü tanımlı ama IN_PROGRESS: `/rota`, `/sofor`, `/filo`.

**Eksik:**
- Rota çizimi/harita, navigasyon linki, mesafe/süre, rota yakıt tahmini, şoför mobil ekranı.
- **Şoför masrafı** (market fişi, otopark, köprü/otoyol, yakıt) fiş fotoğrafıyla, onay akışıyla → gider. Şu an `vehicle_logs` yalnız araç giderine uygun; market alışverişi araç gideri değil.
- Şoför kartı (ehliyet sınıfı, SRC/psikoteknik geçerlilik, telefon) — `employees` genel.
- Firmalara giden malzemenin **tedarikçi faturası satırıyla** bağı (hangi faturadan geldiği) ve **müşteri kârlılığına** yansıması.
- `routes.stops` jsonb → FK bütünlüğü yok (silinen müşteri rotada kalır).

**Önerilen tasarım:**
- `route_stops` (id, route_id, seq, customer_id FK, planned_eta, done_at, delivered_qty, signature_path, note) — `routes.stops` geriye uyum için okunur, yeni kayıtlar tabloya.
- `routes` ek: `polyline text` (encoded), `distance_km numeric`, `duration_min int`, `nav_url text`, `est_fuel_l numeric`, `est_fuel_cost numeric`, `fuel_price numeric`.
- `vehicles` ek: `avg_l_per_100km numeric`, `fuel_type`, `capacity_trays int`, `kasko_due`, `k_belgesi_due`, `tachograph_due`.
- `drivers` yerine `employees` ek kolonları: `license_class`, `license_due`, `src_due`, `psycho_due` (ayrı tablo açmayın; departman=sevkiyat filtresi = şoför kartı).
- `driver_expenses` (id, employee_id, vehicle_id null, route_id null, spent_on, kind `yakit|market|otopark|otoyol|yemek|diger`, amount, vat_amount, receipt_path, place, status `bekliyor|onaylandi|reddedildi`, approved_by, account_id, finance_entry_id) → onayda tetikleyici `finance_entries` (source=`sofor`); `kind='yakit'` ise ayrıca `vehicle_logs` satırı. `finance_entries.source` check listesine `sofor`, `uretim`, `cek`, `kredi`, `tahsilat` eklenir.
- Navigasyon linki: API anahtarı gerektirmeyen Google Maps URL (`https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=lat,lng|…&travelmode=driving`, ≤9 ara nokta; fazlası parçalanır) ve Yandex Navi derin linki. Rota çizimi: Leaflet + OpenStreetMap (anahtarsız); mesafe/süre için Google Directions veya OpenRouteService anahtarı 🔌 — anahtar yokken haversine × 1,3 yaklaşık mesafe.
- Rota yakıt maliyeti = `distance_km × avg_l_per_100km/100 × fuel_price` → Finans'ta "Müşteri başı taşıma maliyeti" (durak başına paylaştırma: km veya kişi oranı).
- Firmalara giden malzeme: `stock_movements` ek `purchase_invoice_id` (kaynak fatura) — fatura satırından "Firmalara giden malzeme olarak işaretle" seçeneği; `v_customer_side_costs` (müşteri × ay: sevk malzemesi + taşıma).
- Ekran: tek modül **Lojistik** (sekmeler: `Rotalar & Harita` · `Araçlar` · `Şoförler & Masraflar`) + şoför rolüne tam ekran **Şoför Ekranı** (bugünkü duraklar, "Navigasyonu aç", teslim imzası, masraf fişi fotoğrafı). Mevcut `/sevk` Depo modülünde sekme olarak kalsın (Stok > Firmalara giden).

**Bağımlılıklar:** #10 (yan maliyet), #11 (fatura satırı eşleştirme), #13 (şoför avansı/kasa).

---

#### 8. Personel puantaj & mesai, ödeme ekranı
**Durum: Kısmen var (büyük ölçüde)**

**Nerede:** `employees` (aylık/yevmiye, `daily_hours` varsayılan 10, `overtime_rate` 1,5, `device_user_id`), `attendance_days` (ilk giriş/son çıkış, dakika, durum), `employee_ledger` (hakediş/prim/avans/kesinti/ödeme → canlı bakiye; avans/ödeme `sync_ledger_entry()` ile kasa gideri), `employee_requests` (izin/avans/mesai), `src/lib/payroll.ts` (10 saat üstü ×1,5, altı kesinti, yok/raporlu kesinti; ZKTeco CSV ayrıştırıcı; testli), `/puantaj`, `/personel-bakiye`, `/personel`.

**Eksik:**
- **XLS/XLSX okunmuyor:** `AttendancePage.tsx:61` Excel dosyasını reddedip CSV'ye çevirmeyi istiyor. İstenen: doğrudan XLS(X).
- İçe aktarma kaydı (hangi dosya, kim, ne zaman, kaç satır, eşleşmeyen cihaz no'ları) yok → "loglar" isteği karşılanmıyor.
- Bordro dönemi kapatma (ay kilidi), hakedişin tekrar yazılmasını önleyen benzersizlik (employee, period, kind='hakedis') yok.
- İzin bakiyesi (yıllık izin hakkı/kullanılan), izin onayında puantaja otomatik "izinli" yazımı yok.
- Canlı güncelleme: Realtime yayınında yalnız `chat_messages` var.
- **Güvenlik:** `employees` tablosu tüm personele okunur (maaş, yevmiye, IBAN) — bkz. supabase-kontrol.md (Yüksek).
- Kural çakışması: PLAN.md "7,5 saatlik gün" diyor, kod ve kullanıcı "10 saat" diyor → PLAN.md düzeltilmeli.

**Önerilen tasarım:**
- XLSX: `read-excel-file` (hafif) veya SheetJS'in resmi CDN paketi (`https://cdn.sheetjs.com/xlsx-0.20.x/xlsx-0.20.x.tgz`; npm'deki eski `xlsx` sürümü güvenlik açığı içerir) — dinamik import ile yalnız Puantaj ekranında yüklensin; mevcut `parseAttendanceFile` satır dizisi alacak şekilde genelleştirilsin (CSV yolu korunur).
- `attendance_imports` (id, file_name, file_hash unique, period, rows_total, rows_matched, unmatched_ids text[], imported_by, imported_at); `attendance_days.import_id` FK.
- `payroll_periods` (period pk `YYYY-MM`, status `acik|kapandi`, closed_by, closed_at); kapalı dönemde `attendance_days`/`employee_ledger` (hakediş) değişikliğini engelleyen tetikleyici. `employee_ledger` unique partial index (employee_id, period) where kind='hakedis'.
- `leave_balances` görünümü: `employees.annual_leave_days` + onaylı izin talepleri.
- İzin talebi onayında tetikleyici → ilgili günlere `attendance_days(status='izinli', source='elle')`.
- Ekran: tek modül **Personel** — sekmeler: `Kartlar` · `Puantaj` (içe aktar + ay ızgarası) · `Bakiye & Ödemeler` (canlı bakiye, toplu ödeme, ödeme logu, detay rapor) · `İzin & Talepler`. Mevcut 3 modül (`/personel`, `/puantaj`, `/personel-bakiye`) tek modülde birleşir; eski yollar yönlendirme ile çalışmaya devam eder.

**Bağımlılıklar:** #13 (kasa hesapları), RLS düzeltmesi.

---

#### 9. Kurumsal menü sunumu ve teklif formu
**Durum: Kısmen var (şema)**

**Nerede:** `quotes` (firma, kişi/gün, gün/ay, menu_id, gıda maliyeti, genel gider, marj, birim fiyat, durum), `leads`, `ReportFrame.tsx` (logolu A4 antet, mühür), MenuPlanPage "haftalık menü raporu". `/teklifler` IN_PROGRESS.

**Eksik:** Teklif ekranı; teklif içeriği bölümleri (kapak, hakkımızda, mutfak fotoğrafları, menü örnekleri, sertifikalar, referans firmalar, tedarikçiler, sosyal medya QR, fiyat tablosu, şartlar); fotoğraf deposu; kurumsal haftalık/aylık menü sunum şablonu (müşteriye giden).

**Önerilen tasarım:**
- `brand_assets` (id, kind `mutfak_foto|logo|sertifika|yemek_foto|video`, title, path (storage `brand-media`), sort, active).
- `customers.show_as_reference bool`, `customers.reference_logo_path`; `suppliers.show_as_reference bool`.
- `quotes` ek: `sections jsonb` (seçili bölümler ve sırası), `menu_ids uuid[]` (birden çok örnek menü), `service_style`, `pdf_path`, `sent_at`, `sent_via`.
- `quote_templates` (id, name, sections jsonb default, intro_text, terms_text).
- Yazdırma: mevcut `ReportFrame` genişletilerek çok sayfalı "Sunum" modu (kapak + bölümler). PDF = tarayıcı yazdır (mevcut yaklaşım).
- Ekran: **Teklifler & Sunum** tek modül — sekmeler: `Teklifler` · `Menü Sunumu` (haftalık/aylık menüyü kurumsal şablonda üret, WhatsApp/e-posta) · `Galeri` (fotoğraflar, referanslar). Fiyat hesaplayıcı #10'daki kârlılık motorunu kullanır.

**Bağımlılıklar:** #10, #15, #5 (sosyal medya bilgisi).

---

#### 10. Menü bazlı kârlılık
**Durum: Kısmen var**

**Nerede:** `v_menu_costs` (gıda maliyeti son fiyat/ortalama, `target_price`, `food_margin_pct`), MenusPage maliyet kartı, FinanceSummaryPage (1 kişilik öğün maliyet ayrışımı: gıda + işletme + personel…), `quotes.overhead_cost/margin_pct`.

**Eksik:** Ambalaj/sunum maliyeti, müşteri özel yan maliyetler (sevk malzemesi, taşıma), genel gider payı (aylık sabit gider ÷ aylık kişi-öğün) menü kartında yok; fiyat serbestliği (müşteri bazlı fiyat) ile maliyet karşılaştırması tek ekranda yok; gerçekleşen (üretim) maliyet vs teorik (reçete) ayrımı yok.

**Önerilen tasarım:**
- View `v_overhead_per_meal` (ay: gıda dışı giderler toplamı ÷ teslim edilen kişi-öğün) — kategori grupları `finance_categories.group_name`'den.
- View `v_menu_profitability` (menu_id × service_style): gıda (reçete) + ambalaj (#3) + genel gider payı = kişi başı tam maliyet; `target_price` ve müşteri fiyatlarının min/ort/max'ı; marj.
- View `v_customer_profitability` (müşteri × ay): gelir (finance_entries) − (teslim kişi × menü tam maliyeti) − sevk malzemesi − taşıma payı.
- Fiyat serbest: `customer_menus.unit_price` (#12) elle girilir; ekranda "önerilen fiyat = maliyet ÷ (1 − hedef marj)" yalnızca öneri.
- Ekran: yeni modül yok → **Menüler** modülünde `Kârlılık` sekmesi; Finans Özeti'nde "Müşteri kârlılığı" kartı; Teklifler aynı hesaplayıcıyı kullanır.

**Bağımlılıklar:** #3, #7, #12.

---

#### 11. Kanonik stok adları, fatura isim eşleştirme, fiyat izi
**Durum: Kısmen var**

**Nerede:** `ingredients` (lower(name) unique = kanonik ad), InvoicesPage (UBL-TR XML → satırlar; gıda satırlarını hammaddeye aktarma, fiyat + stok girişi), `supplier_categories` (tedarikçi → gider kategorisi hafızası), `ingredient_prices` (fiyat geçmişi; `source manuel|alis_faturasi`, `supplier_name text`, `created_by`), `supplier_quotes`.

**Eksik:**
- **Alias/eşleştirme tablosu yok:** her faturada aynı "DANA KUŞBAŞI 1.SINIF KG" satırı tekrar elle eşleştiriliyor; yanlış eşleşme yeni hammadde açıp reçeteyi bozabilir.
- Birim dönüşümü tedarikçiye özel değil (ör. "KOLİ = 12 × 1 lt").
- `ingredient_prices` → tedarikçi FK'sı ve belge bağı (`purchase_invoice_id`, satır no) yok; "fiyatı güncelleyen yönetici" `created_by` ile var ama ekranda gösterilmiyor.
- `purchase_invoices.supplier_name/supplier_tax_no` serbest metin; `suppliers` tablosuyla FK yok → aynı tedarikçi iki kez oluşabilir.
- Benzerlik araması için `pg_trgm` eklentisi kurulu değil (kurulu: plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault).

**Önerilen tasarım:**
- `create extension if not exists pg_trgm` (+ `unaccent` isteğe bağlı; Türkçe için özel normalize fonksiyonu `norm_tr(text)` immutable: küçük harf, ç/ğ/ı/ö/ş/ü → c/g/i/o/s/u, noktalama ve "1.SINIF, KG, AD" gibi birim/gürültü sözcükleri temizle).
- `ingredient_aliases` (id, ingredient_id FK, supplier_id FK null (null=genel), alias_raw text, alias_norm text, seller_item_code text null (UBL `SellersItemIdentification`), unit_code text, factor_to_stock numeric (ör. koli→12 lt), confirmed bool, created_by, created_at; unique (coalesce(supplier_id,'0'), alias_norm)). GIN trigram index on alias_norm ve `ingredients` üzerinde `norm_tr(name)`.
- RPC `match_invoice_line(supplier_id, raw_name, seller_code)` → sıra: (1) seller_code eşleşmesi, (2) tedarikçi alias tam eşleşme, (3) genel alias, (4) trigram benzerlik ≥0,45 ilk 5 öneri. Arayüz: güven %'si; yeşil = otomatik, sarı = onay iste, kırmızı = "yeni hammadde aç" (açmadan önce benzer 5 kalemi göster, **zorunlu onay**).
- `ingredient_prices` ek: `supplier_id FK`, `purchase_invoice_id FK`, `invoice_line_no int`, `source` check'e `teklif` ekle; ekranda "Fiyat geçmişi: tarih · fiyat · tedarikçi · belge · güncelleyen".
- `purchase_invoices.supplier_id FK` + fatura yüklemede VKN ile `suppliers` otomatik bul/oluştur; `supplier_categories` → `suppliers.default_category_code` (geçiş: mevcut hafıza okunmaya devam).
- Hammadde birleştirme aracı: RPC `merge_ingredients(keep_id, drop_id)` (yalnız yonetici) — reçete, hazırlık, stok, fiyat, alias kayıtlarını taşır, eskisini pasifler.
- Ekran: **Stok** modülünde `Hammadde Kartları` sekmesi (mevcut `/hammaddeler` buraya taşınır; kart içinde "Tedarikçi adları" ve "Fiyat geçmişi"). Fatura içe aktarmada eşleştirme adımı Gelen Faturalar içinde kalır.

**Bağımlılıklar:** #2 (stok girişinin tek kaynaktan olması), #12 (cari tedarikçi).

---

#### 12. Müşteriye menü tanımlama; cari altında müşteri ve tedarikçi dalları
**Durum: Kısmen var**

**Nerede:** `customers` (kişi başı varsayılan fiyat, KDV, vade, e-fatura, lat/lng, order_token), `menus.customer_id`, `menu_plans.customer_id`, `effective_menu()`; `/musteriler` "Müşteriler & Cari", `/tedarikciler` (cari borç özeti). `delivery_notes`, `sales_invoices` tabloları var, ekranları yok.

**Eksik:**
- Müşteri × menü tipi × sunum şekli × fiyat **sözleşme tablosu** yok (şu an tek `default_meal_price`).
- Sipariş ekranı müşteri tanımından beslenmiyor (her menü listelenir).
- Cari ekstre (müşteri/tedarikçi: fatura, tahsilat, çek, bakiye) ekranı yok.
- Müşteri portal linki "kopyala/WhatsApp" butonu yok (BACKLOG ⏳).

**Önerilen tasarım:**
- `customer_menus` (id, customer_id FK, meal, menu_type_code FK null, menu_id FK null (sabit menü) , service_style FK, unit_price numeric, vat_rate, valid_from, valid_to, is_default bool, active; unique (customer_id, meal, menu_type_code, service_style, valid_from)).
- `meal_orders.customer_menu_id FK` — sipariş eklerken fiyat/sunum/menü tipi buradan; `unit_price` tetikleyiciyle doldurulur (portal kullanıcısı fiyatı değiştiremez — bkz. güvenlik bulgusu). Günlük menü: `menu_plans`'tan menü tipi eşleşen menü (genel veya firmaya özel) seçilir.
- Cari görünümleri: `v_customer_ledger` (finance_entries gelir + tahsilatlar + alınan çekler), `v_supplier_ledger` (purchase_invoices + ödemeler + verilen çekler). Kısmi tahsilat için #13'teki `payments` + `payment_allocations`.
- Ekran: **Cari Hesaplar** tek modül — sekmeler `Müşteriler` · `Tedarikçiler`. Müşteri detay çekmecesinde alt sekmeler: `Bilgiler` · `Menü tanımları` · `Ekstre` · `İrsaliye/Fatura` · `Sipariş linki`. Tedarikçi detayında: `Bilgiler` · `Ekstre` · `Fiyatlar` · `Ürün adları (alias)`. Böylece `/musteriler` ve `/tedarikciler` birleşir, `/irsaliye` ayrı modül olmaz.

**Bağımlılıklar:** #3, #13.

---

#### 13. Çek/senet, hatırlatmalar, krediler, alacaklar, tahsilat mesajları, kasaya bağlı ödeme/tahsil
**Durum: Kısmen var**

**Nerede:** `cheques` (çek/senet, alınan/verilen, durum portföy/tahsil/ödendi/ciro/karşılıksız/iade, endorsed_to text, account_id), `finance_accounts` (kasa/banka/kredi kartı), `finance_entries` (status `bekliyor|odendi`, due_date, paid_at), `v_account_balances`, `/kasa` CashPage (bakiye, tahsil edilecek/ödenecek, günlük giriş-çıkış), `alerts.ts` (vadesi geçen alacak).

**Eksik:**
- Çek ekranı; çek hareket geçmişi (portföye giriş → bankaya tahsile verildi → tahsil / ciro → kime); "yazılan" (kendi çekimiz, keşide) ayrımı; çek tahsilinin kasaya/bankaya otomatik yansıması (tetikleyici yok).
- **Kısmi tahsilat/ödeme yok** (bir alacak ya tam `odendi` ya `bekliyor`); bir ödemeyle birden çok faturanın kapatılması yok.
- Hesaplar arası virman (kasadan bankaya) yok.
- Kredi ve taksit takibi yok.
- Hatırlatma/otomatik mesaj (e-posta/WhatsApp) altyapısı yok (Edge Function, zamanlayıcı, şablon).

**Önerilen tasarım:**
- `payments` (id, direction `tahsilat|odeme`, paid_on, method `nakit|banka|kredi_karti|cek|senet|virman`, account_id FK, customer_id/supplier_id/employee_id FK (biri), cheque_id FK null, amount, description, created_by) + `payment_allocations` (payment_id, finance_entry_id, amount). Tetikleyici: bir `finance_entry` tamamen karşılanınca `status='odendi'`, `paid_at`, `account_id` doldurulur (mevcut ekranlar bozulmaz). View `v_open_items` (açık kalem = tutar − Σ tahsis).
- `account_transfers` (from_account, to_account, amount, on_date) → `v_account_balances` güncellenir.
- `cheques` ek: `direction` değerlerine `yazilan` (kendi keşidemiz) eklenmesi yerine `issuer` alanı (`biz|musteri|diger`) — "verilen" = ciro edilen veya yazılan; `cheque_events` (cheque_id, event `portfoy|bankaya_verildi|tahsil|ciro|odendi|karsiliksiz|iade`, on_date, account_id, counterparty, note, created_by). Tetikleyici: `tahsil`/`odendi` olayında `payments` satırı oluşturur.
- `loans` (id, bank, principal, rate, start_date, installment_count, account_id, notes) + `loan_installments` (loan_id, due_date, principal, interest, total, payment_id null). Taksit ödenince `payments(odeme)` + faiz `finance_entries` gider (yeni kategori `finansman_gideri`).
- `reminders` (id, kind `tahsilat|odeme|cek_vade|kredi_taksit|muayene|sigorta`, ref_table, ref_id, due_on, remind_on, channel `uygulama|eposta|whatsapp`, status, last_sent_at) + `message_templates` (code, channel, subject, body — `{firma}`, `{tutar}`, `{vade}` yer tutucuları) + `message_log` (to, channel, template, payload, sent_at, status, error).
- Gönderim: Supabase Edge Function `send-reminders` + `pg_cron` günlük 09:00 TSİ; e-posta için Resend/SMTP, WhatsApp için WhatsApp Business Cloud API (🔌 anahtar gerekir). Anahtar yokken: "WhatsApp'ta aç" (wa.me linki, hazır metin) butonu — mevcut `reports/share.ts` yaklaşımıyla uyumlu.
- Ekran: **Kasa & Banka** modülü sekmeleri: `Hesaplar & Hareketler` (mevcut) · `Tahsilat / Ödeme` (açık kalemler, kısmi ödeme, virman) · `Çek & Senet` · `Krediler` · `Hatırlatmalar`. `/cek-senet` ayrı modül olmaz.

**Bağımlılıklar:** #12 (cari), `finance_entries.source` genişletmesi.

---

#### 14. Rehber etiketler, ilk kullanım ipuçları, sade UX
**Durum: Kısmen var**

**Nerede:** `modules.ts` her modülde `hint`; ModuleHero açıklamaları; EmptyState yönlendirmeleri; Dashboard "ilk adımlar" kontrol listesi; Mutfak Ekranı (büyük yazı, sesli okuma); onay penceresi, hata yakalayıcı.

**Eksik:** Adım adım tur (ilk girişte rol bazlı), alan bazlı "?" ipuçları, kullanıcı bazlı "gördüm" durumu, yardım merkezi/kısa video bağlantıları, klavye/erişilebilirlik kontrolü.

**Önerilen tasarım:**
- `user_onboarding` (user_id, step_code, done_at; pk (user_id, step_code)) — RLS: yalnız kendi satırı.
- Bileşenler: `<Hint id="..." title body />` (kapatılabilir, bir kez gösterilir), `<Tour steps=[…]>` (rol bazlı 4–6 adım; ör. aşçıbaşı: Üretim → Kalibrasyon → Mutfak Ekranı), form alanlarında `hint` (FormDrawer zaten destekliyor) tutarlı kullanım.
- Her modülde ModuleHero altında katlanabilir "Bu ekranda ne yaparım? (3 madde)".
- Metin kuralı: fiil ile başlayan buton adları, kısaltmasız Türkçe, sayılarda birim.

**Bağımlılıklar:** Yeni navigasyon (aşağıda) bittikten sonra yazılmalı.

---

#### 15. Kurumsal logo & rapor şablonu
**Durum: Kısmen var**

**Nerede:** `company_settings` (unvan, kısa ad, slogan, vergi dairesi/no, adres, şehir, telefon, e-posta, web, rapor alt bilgisi), `CompanyPanel.tsx` (Ekip & Firma), `ReportFrame.tsx` (antet + hologram mühür), `src/ui/Logo.tsx` (sabit SVG), `public/logo.svg`.

**Eksik:** Logo yükleme (depolama), sosyal medya hesapları, IBAN/banka bilgisi, MERSİS, gıda işletme kayıt no, ISO/HACCP sertifika bilgisi, rapor renk teması; pencere başlıklarında logo (BACKLOG ⏳).

**Önerilen tasarım:**
- `company_settings` ek: `logo_path`, `logo_dark_path`, `instagram`, `facebook`, `linkedin`, `youtube`, `tiktok`, `x`, `whatsapp`, `iban`, `bank_name`, `mersis_no`, `food_reg_no`, `certificates text[]`, `brand_color`.
- Storage `brand-media` (logo için public-read `brand-public` ayrı bucket; sadece yonetici/kurucu yazar).
- `ReportFrame` bu alanları okur: üstte logo + unvan + iletişim, altta adres · e-posta · telefon · sosyal medya simgeleri + QR (web/instagram).
- Ekran: **Ayarlar > Firma & Antet** sekmesi (mevcut CompanyPanel genişletilir).

**Bağımlılıklar:** #9, #5.

---

#### 16. Supabase kurulumu: tek başarılı test çalıştırması ve hata kontrolü
**Durum: Kısmen var**

**Nerede:** 10 migration canlıda uygulanmış; `supabase/tests/` altında 6 SQL test (recipes_math_and_rls, save_rpcs, finance_flow, prep_batch_flow, operations_flow, customer_order_link). Canlı veri: 1 kullanıcı (kurucu), 1 müşteri, 2 hesap, 20 kategori, 9 reçete kategorisi, 5 birim; diğer tüm tablolar boş.

**Eksik / riskler:** Ayrıntı `supabase-kontrol.md`'de. Özet: migration sürüm numaraları repo ile canlıda farklı (CLI ile `db push` yeniden uygulamaya çalışır), `employees` maaş/IBAN tüm personele açık, portal müşterisi `unit_price` değiştirebilir, çift stok girişi riski, rol×modül matrisi sunucuda uygulanmıyor, sızdırılmış parola koruması kapalı, 39 indekslenmemiş FK.

**Önerilen:** `supabase-kontrol.md`'deki senaryoyu önce bir Supabase **branch**'inde veya `begin … rollback` ile çalıştırın.

---

#### 17. Kurucu paneli: hesap, kullanıcılar, modül aç/kapat, hata tespit & çözüm
**Durum: Kısmen var**

**Nerede:** `/kurucu` FounderPage sekmeleri: `Rol × sekme` (role_permissions), `Kişiye özel` (member_permissions), `Bağlantılar` (entegrasyon durumları). `team_members` (rol, aktif), `list_team()`, `list_pending_users()`, `guard_last_admin` tetikleyicisi. Hata yakalama: `src/ui/ErrorBoundary.tsx` yalnız `console.error` yapar ve ekrana mesaj basar; hiçbir yere kaydedilmez.

**Eksik:**
- Kurucunun kendi hesap bilgisini (ad, e-posta, parola, telefon) değiştirmesi — ekran yok.
- Kullanıcı **silme** (auth hesabı) ve **kısıtlama** (geçici engel, salt-okur yapma, belirli tarihe kadar askıya alma) — yalnız `active=false` var; auth oturumu açık kalır.
- **Modül aç/kapat** (programın DB modüllerini devreye alma/çıkarma) — yalnız menü görünürlüğü var; sunucu tarafında modül kapatma yok.
- Hata kaydı, Supabase log izleme, hata çözüm önerisi — yok.

**Önerilen tasarım:**
- **Hesap bilgisi:** Kendi hesabı için `supabase.auth.updateUser({ email, password, data:{full_name, phone} })` (e-posta değişiminde onay e-postası). `team_members.full_name/phone` senkron.
- **Kullanıcı yönetimi:** Edge Function `admin-users` (service role anahtarı yalnız fonksiyonda, istemcide asla): `delete_user`, `ban_user(until)` (Auth Admin API `ban_duration`), `unban_user`, `reset_password_link`. Fonksiyon çağıranın `kurucu` olduğunu JWT + `team_members` ile doğrular; her işlem `audit_log`'a (actor, hedef, önce/sonra). `team_members` ek: `restricted_until timestamptz`, `read_only bool`. `current_app_role()` → `restricted_until > now()` ise null döndürsün (tüm RLS kapanır); `read_only` ise `has_role()` yazma politikalarında false (okuma politikaları `is_staff()` ile açık kalır — okuma/yazma yardımcıları ayrılmalı: `can_write(roles)`).
- **Modül aç/kapat:** `app_modules` (code pk: `mutfak, depo, satinalma, satis, cari, lojistik, personel, finans, kasa, teklif, sosyal, pazarlama`; enabled bool; disabled_reason; updated_by; updated_at) + `module_enabled(code)` STABLE fonksiyonu. Modül tablolarının **yazma** politikalarına `and (select public.module_enabled('<kod>'))` eklenir (kapalı modül okunur ama yazılmaz; veri silinmez). Arayüz: kapalı modül menüde gizlenir. Kapatma/açma onaylı ve loglu (bkz. #19).
- **Hata tespit & çözüm ("Hata Merkezi")** — gerçekçi, insan onaylı tasarım:
  1. *Yakalama (frontend):* `ErrorBoundary.componentDidCatch`, `window.onerror`, `unhandledrejection`, `lib/supabase.ts` `unwrap()` içindeki PostgREST/RPC hataları → RPC `log_client_error(p jsonb)` (SECURITY DEFINER, yalnız authenticated, kullanıcı başına dakikada ≤20 kayıt; yığın izi ve rota; kişisel veri/tutar maskelenir).
  2. *Yakalama (sunucu):* Edge Function `collect-logs` (pg_cron, 10 dk): Supabase Management API ile postgres/api/auth/edge loglarından `ERROR`/`FATAL` + advisor sonuçları (🔌 Supabase kişisel erişim anahtarı Vault'ta).
  3. *Tablolar:* `error_events` (id, source `frontend|postgres|api|auth|edge|advisor`, fingerprint (mesaj+yol hash), message, stack, route, user_id, release, count, first_seen, last_seen, status `yeni|inceleniyor|cozuldu|yoksay`), `bug_fix_proposals` (id, error_fingerprint, diagnosis, proposed_patch (diff metni), proposed_sql (migration metni), risk `dusuk|orta|yuksek`, test_plan, status `onerildi|onaylandi|reddedildi|uygulandi`, pr_url, proposed_by `bot`, approved_by, approved_at, decided_note).
  4. *Debugger botu:* Edge Function `bug-doctor` (🔌 LLM API anahtarı + GitHub token, salt-okur repo erişimi): hata kümesini alır, ilgili kaynak dosyaları ve migration'ı okur, kök neden + yama önerisi + test planı üretir → `bug_fix_proposals`. **Canlıya kendiliğinden hiçbir şey uygulamaz.**
  5. *Kurucu onayı:* Onaylanan öneri için bot yalnız **GitHub'da ayrı dal + taslak PR** açar (SQL ise `supabase/migrations/…` dosyası olarak ve bir Supabase branch'inde çalıştırılmış test çıktısıyla). Birleştirme/yayın normal süreçle (Claude Code/insan). Reddedilen öneriler arşivde kalır.
  6. *Güvenli hızlı eylemler* (onaylı, geri alınabilir): önbellek temizleme, tipleri yeniden üretme isteği, bir kullanıcının oturumunu kapatma, modül kapatma. Veri silme/DDL asla otomatik değil.
- **Ekran:** **Ayarlar** modülünde (yalnız kurucu) sekmeler: `Hesabım` · `Kullanıcılar` (davet, rol, kısıtla, sil) · `Yetkiler` (rol × sekme, kişiye özel) · `Modüller` · `Hata Merkezi` · `Entegrasyonlar`.

**Bağımlılıklar:** #19 (onay/log), Edge Functions + Vault, 🔌 LLM ve GitHub anahtarları.

---

#### 19. Onaylar ve değişmez kayıt (audit trail)
**Durum: Yok** (altyapı kısmen: `audit_log` + `log_audit()` her tabloda; `audit_log`'a yazma politikası yok, okuma yonetici/muhasebe)

**Eksik:** Onay akışı, "gönderen → onaylayan" kaydı, değişmezlik garantisi (şu an `postgres`/service role `audit_log`'u silebilir/değiştirebilir; kurcalama tespiti yok), onay bekleyen işlerin tek ekranı.

**Önerilen tasarım:**
- `approval_requests` (id, kind `satinalma_plani|satinalma_siparisi|gider|odeme|fiyat_degisikligi|maliyet_duzenleme|uretim_emri_zorla|modul_kapat|kullanici_sil|bug_fix|stok_duzeltme|izin|avans|teklif`, entity_table, entity_id, version_id null, summary, payload jsonb (**talep anındaki tam görüntü**), amount null, requested_by, requested_at, status `bekliyor|onaylandi|reddedildi|iptal`, decided_by, decided_at, decision_note).
- `approval_events` (id, request_id, event `olusturuldu|yorum|onay|red|iptal|yeniden_gonderildi`, actor, at, note, prev_hash, hash) — **yalnız ekleme**.
- Değişmezlik: `audit_log` ve `approval_events` için BEFORE UPDATE/DELETE tetikleyicisi `raise exception` (service role dahil); `revoke update, delete, truncate` tüm rollerden; **hash zinciri** (`hash = sha256(prev_hash || row_json)`, pgcrypto kurulu) ve günlük doğrulama fonksiyonu `verify_audit_chain(from,to)`. `audit_log` ek kolonlar: `prev_hash`, `hash`, `request_id` (onayla ilişki).
- Kurallar tablosu `approval_policies` (kind, threshold_amount, approver_roles, auto_approve_below): örn. 20.000 ₺ altı gider muhasebe onayı yeter, üstü yönetici; satınalma planı ve maliyet düzenlemeleri **her zaman** yönetici. Onaylanana kadar ilgili kayıt `status='onay_bekliyor'` (ör. `purchase_orders`, `cost_versions`, `purchase_plan_versions`) ve finans tetikleyicileri çalışmaz.
- RPC'ler: `request_approval(kind, table, id, summary, payload)`, `decide_approval(id, decision, note)` (SECURITY DEFINER, rolü `approval_policies`'e göre kontrol eder; talep eden kendi talebini onaylayamaz).
- **Ekran:** Yönetici çalışma alanında (Bugün) `Onaylar` sekmesi: bekleyenler (tür, tutar, talep eden, zaman, önce/sonra farkı), onay/red + not, geçmiş (filtre, dışa aktarım, mühürlü rapor). Başlıkta onay rozeti. Diğer roller kendi taleplerinin durumunu çalışma alanında görür.

**Bağımlılıklar:** #17, #20, Faz 3A (audit düzeltmeleri).

---

#### 20. Maliyet sekmesi (günlük/aylık/yıllık), menüden otomatik satınalma planı, sürümlü düzenleme
**Durum: Kısmen var**

**Nerede:** Günlük: `v_prep_batch_costs` (yemek bazında toplam ve porsiyon maliyeti), Dashboard "bugün kişi/maliyet". Aylık/12 ay: FinanceSummaryPage (gelir/gider/net, 1 kişilik öğün ayrışımı). Satınalma: PurchasingPage "Aylık ihtiyaç" **her açılışta yeniden hesaplanıyor**, kaydedilmiyor; düzenleme/sürüm/arşiv yok. `recipe_cost_snapshots` reçete maliyeti fotoğrafı (yalnız reçete düzeyi).

**Eksik:** tek bir "Maliyet" görünümü (gün/ay/yıl geçişli), yöneticinin maliyet ve satınalma planını düzenleyip kaydetmesi, her kaydın **yeni sürüm** olarak arşivlenmesi, alan bazlı değişiklik logu (kim, ne zaman, önce/sonra).

**Önerilen tasarım:**
- **Maliyet sekmesi (Finans > Maliyet):** Gün/Ay/Yıl anahtarı. Satırlar: kişi-öğün, gıda tüketim maliyeti (üretimden, §0.1), ambalaj, personel, işletme, araç/taşıma, genel gider payı → kişi başı tam maliyet; gelir, brüt/net marj; önceki dönem ve bütçe ile fark. Kaynak görünümler: `v_cost_daily` (gün × öğün), `v_cost_monthly`, `v_cost_yearly` (aylıklardan toplanır). Menü/müşteri kırılımı Menüler > Kârlılık'a bağlanır.
- **Otomatik satınalma planı:** RPC `generate_purchase_plan(period 'YYYY-MM', basis 'gecen_ay_ortalama'|'siparis'|'karma')` → gelecek ayın `menu_plans` × geçen ayın gün/öğün/firma ortalama kişi sayısı (+ bilinen aylık siparişler `standing_orders`) × kalibre reçete brütü (+ ambalaj `service_style_items`) − beklenen stok − açık PO → kalem × miktar × en uygun teklif fiyatı = maliyet listesi. Sonuç **sürüm 1 (otomatik)** olarak kaydedilir.
- **Sürümleme (yıkıcı üzerine yazma yok):**
  - `purchase_plans` (id, period, status `taslak|onay_bekliyor|onaylandi|arsiv`, current_version_id, created_at) · `purchase_plan_versions` (id, plan_id, version_no, basis, source `otomatik|duzenleme`, based_on_version_id, totals jsonb, note, created_by, created_at, approval_request_id) · `purchase_plan_lines` (version_id, ingredient_id, qty, unit, unit_price, supplier_id, brand, amount, auto_qty, auto_price, changed bool).
  - `cost_versions` (id, scope `gun|ay|yil`, period_key ('2026-10-05' / '2026-10' / '2026'), version_no, source `otomatik|duzenleme`, based_on_version_id, lines jsonb veya `cost_version_lines` (kalem kodu, auto_value, value, note), status, created_by, created_at, approval_request_id). Yönetici düzenlemesi = hesaplanan değerlerin üzerine "yönetim düzeltmesi/bütçe" (ör. beklenen fiyat artışı, özel gün); gerçekleşen muhasebe kayıtlarını değiştirmez.
  - Kural: sürüm satırları **değiştirilemez** (UPDATE/DELETE tetikleyiciyle yasak); "Kaydet" her zaman yeni `version_no` oluşturur, `current_version_id` onaydan sonra ilerler. Eski sürümler "Sürüm geçmişi" panelinde görüntülenir, iki sürüm yan yana **fark** (kalem, önce/sonra, tutar farkı) gösterilir, istenen sürüm "bundan yeni sürüm oluştur" ile geri getirilir (geri alma da yeni sürümdür).
  - Değişiklik logu: `log_audit` her ekleme için actor/zaman/önce-sonra (`diff`) yazar; sürüm tablosunda `based_on_version_id` + satır bazında `auto_*` vs elle değer; onay kaydı (#19) talep eden/onaylayan.
- **Yetki:** oluşturma/düzenleme: yonetici (+ satinalma planı için satinalma taslak sürüm önerebilir → yönetici onaylar); maliyet sürümü: yonetici, muhasebe öneri; okuma: yonetici, muhasebe, satinalma (plan).
- **Ekran:** Yeni modül yok: **Finans > Maliyet** (gün/ay/yıl, "Düzenle → Yeni sürüm kaydet", Sürüm geçmişi) ve **Satınalma > Satınalma planı** ("Menüden oluştur", satır düzenle, "Yeni sürüm kaydet", "Onaya gönder", Sürüm geçmişi, fark görünümü, PO'lara dönüştür).

**Bağımlılıklar:** #2, #3, #4 (kalibre gramaj), #18.4 (teklif analizi), #19 (onay).

---



### 5.D Profesyonel uygulamalardan 32 ek özellik
> Kaynak: `prompt/prompt-ekleri.md` satır 1–son (birebir alıntı; başlık seviyeleri düşürüldü).

#### Prompt'a Eklenecekler (yurt içi ve yurt dışı profesyonel uygulamalardan)

Aşağıdaki özellikleri de sisteme ekle. Parantez içindeki uygulamalar bu özelliği zaten sunan örneklerdir; onları incele ama daha sade ve modern yap.

##### Sipariş ve müşteri
1. **Kesim saati ve revizyon kaydı:** Müşteri ertesi günün kişi sayısını belirli bir saate kadar girer (ör. 16:00), sonra sipariş kilitlenir. Her değişiklik "kim, ne zaman, eski sayı, yeni sayı" olarak kaydedilir; "biz 400 demiştik" tartışması biter. Varsayılan olarak sözleşmedeki standart sayı gelir, müşteri sadece farkı girer.
2. **Müşteriye göre farklı gramaj ve fiyat:** Aynı yemek MEB, fabrika veya hastane için farklı gramajla çıkar. Müşteri bazında tarihli kişi başı fiyat geçmişi tutulur. (Yemek Üstadı, YemekPRO, YamanSoft)
3. **Sözleşme ve zam hatırlatması:** Sözleşme bitiş tarihi, TÜFE'ye göre fiyat revizyonu zamanı ve maliyeti anlaşma fiyatına yaklaşan müşteri için alarm.
4. **Müşteri portalında daha fazlası:** Onaylı aylık menüyü kalori ve alerjenle görme, irsaliye, fatura ve ekstre indirme, yemek hakkında puan ve şikayet bırakma. (JAMIX, Caterease)
5. **Dijital teslim tutanağı:** Şoför teslimde telefondan teslim adedini girer, müşteriden imza veya fotoğraf alır. İrsaliye otomatik oluşur.
6. **Ay sonu hakediş ve toplu fatura:** Teslim kayıtlarından müşteri bazında ay sonu icmali çıkar, müşteriyle mutabakat ekranında onaylanır, tek tıkla toplu e-Fatura / e-Arşiv kesilir. Alıcının e-Fatura mükellefi olup olmadığı otomatik sorgulanır. (Çözbim, YamanSoft)

##### Mutfak ve üretim
7. **Plan ile fiili fark:** Gün sonunda aşçı gerçekte ne kadar malzeme kullanıldığını girer; plandan fark TL olarak raporlanır. Mutfaktaki kaçak ve israf görünür olur. (Yemek Üstadı)
8. **Artan yemek ve fire takibi:** Geri dönen ve artan yemek miktarı kaydedilir, sonraki günlerin sayısı buna göre önerilir. (JAMIX)
9. **Yapay zekâ ile sayı tahmini:** Geçmiş siparişlerden her müşteri için gün ve menüye göre tahmini kişi sayısı önerilir. (Apicbase)
10. **Alt reçete:** Sos, pilav, hamur gibi ara ürünler bir kez tanımlanır ve birçok yemekte kullanılır. Fiyatı değişince hepsi güncellenir. (Galley, meez)
11. **Hazır Türk mutfağı reçete kütüphanesi:** Yaygın toplu yemek tarifleri ve gramajları tek tuşla yüklenir; sisteme başlamak günler değil saatler sürer. (CateringSis)
12. **Yapay zekâ ile reçete içe aktarma:** Kâğıttaki tarif fotoğrafı veya Excel yüklenir, sistem malzemeleri ve miktarları otomatik çıkarır. (meez)
13. **Kalori, besin değeri ve 14 alerjen:** Her yemek ve menü için otomatik hesaplanır, etiket ve menü çıktısına yansır. (Apicbase, JAMIX)
14. **Menü rotasyonu kuralları:** Aynı yemek belirli günden önce tekrar etmesin, haftada en az şu kadar sebze ve balık olsun gibi kurallar; diyetisyen onayı. 
15. **Gıda güvenliği (HACCP):** Şahit numune kaydı, pişirme ve sevk sıcaklığı, lot ve son kullanma tarihi izlenebilirliği, denetimde tek tıkla rapor. (Apicbase, YamanSoft)

##### Stok ve satın alma
16. **Faturadan otomatik fiyat güncelleme ve geriye dönük maliyet:** Gelen e-fatura stok kartlarıyla eşleşir, fiyatlar güncellenir, etkilenen reçetelerin maliyeti yeniden hesaplanır. Geç gelen fatura geçmiş günlerin maliyetini düzeltir. (Çözbim, YaylaSoft)
17. **Otomatik satın alma önerisi:** Menü ve sipariş toplamından ihtiyaç çıkar, stok ve yoldaki siparişler düşülür, kalan tedarikçiye göre gruplanıp WhatsApp veya e-postayla gönderilebilir. (Kitchen CUT)
18. **Tedarikçi fiyat karşılaştırma ve teklif toplama:** Aynı ürün için tedarikçilerin fiyat geçmişi yan yana görülür; en uygun olan önerilir.
19. **Telefonla sayım ve mal kabul:** Depoda barkod veya QR ile sayım, mal kabulde eksik veya hatalı ürün fotoğrafla işaretlenir. Kritik stok ve son kullanma tarihi uyarıları. (MarketMan'ın zayıf kaldığı yer, bizim fırsatımız)
20. **Küvet, termobox ve demirbaş takibi:** Hangi müşteride kaç küvet ve termobox kaldığı QR etiketle takip edilir, dönmeyenler raporlanır. (Sadece Çözbim'de var)

##### Finans ve patron
21. **Müşteri ve sözleşme bazında gerçek kâr:** Gelirden hammadde, ambalaj, işçilik payı, nakliye payı ve genel gider payı düşülür. Marjı eşiğin altına düşen müşteri için uyarı verilir. (Rakiplerin çoğu sadece hammaddeye bakıyor)
22. **Patron özet ekranı ve günlük özet:** Her sabah telefona veya WhatsApp'a gelen tek sayfa: dünkü üretim, maliyet, kasa, alacaklar, bugünün siparişleri, uyarılar.
23. **Yapay zekâ asistanı:** "Bu ay en çok hangi yemekte zarar ettik?", "Mercimek fiyatı son 3 ayda ne kadar arttı?" gibi soruları Türkçe konuşarak veya yazarak cevaplar.
24. **Nakit akışı tahmini:** Vadesi gelen çek, senet, tedarikçi ödemeleri ve beklenen tahsilatlarla önümüzdeki haftaların kasa tahmini.
25. **Muhasebeciye aktarım:** Mali müşavirin programına (Logo, Mikro, Luca vb.) dışa aktarım veya doğrudan bağlantı.

##### Personel, filo ve genel
26. **Vardiya ve görev planı:** Kim hangi gün hangi istasyonda çalışacak; mutfak görev listeleri ve kontrol listeleri.
27. **Araç bakım ve belge hatırlatmaları:** Muayene, sigorta, kasko, lastik ve yağ değişimi tarihleri için otomatik hatırlatma.
28. **İşlem kayıtları ve geri alma:** Kim neyi ne zaman değiştirdi, silme ve fiyat değişikliği gibi kritik işlemlerde yetki ve geri alma. (MetasSoft)
29. **Çoklu tesis ve şube:** Birden fazla mutfak veya proje tek hesapta; tesisler arası malzeme transferi.
30. **Excel'den kolay geçiş:** Mevcut stok, cari ve reçete listeleri Excel'den içe aktarılır.
31. **Çevrimdışı çalışma:** Mutfakta veya yolda internet kesilse bile tablet ve telefon çalışmaya devam eder, bağlantı gelince senkronize olur.
32. **Karbon ayak izi ve sürdürülebilirlik raporu:** Kurumsal müşterilere teklif verirken artı puan. (Apicbase, JAMIX)

##### Ürün stratejisi notu
Rakiplerden ayrışmanın yolu çok modül değil, şu akışı kusursuz ve birbirine bağlı yapmaktır: **Müşteri siparişi (kesim saatli) → satın alma → üretim ve fiili tüketim → irsaliye ve teslim → ay sonu toplu e-fatura → müşteri bazında kâr.** Bunu modern web ve mobil arayüzde sunan bir Türk ürünü şu an yok. Ayrıca yorumlarda rakiplerin en çok şikayet aldığı iki konu **zor kurulum** ve **zayıf mobil uygulama**; bu ikisini en iyi biz yapmalıyız.



### 5.E Pazar araştırmasından kısa notlar (boşluklar/fırsatlar ve öneri tablosu)
> Kaynak: `pazar-arastirmasi.md` satır 156–188 (birebir alıntı; başlık seviyeleri düşürüldü).

##### 4. Boşluklar ve fırsatlar (Türk toplu yemek fabrikası için)
1. **Modern web ve mobil + e-belgenin bir arada olduğu orta segment boş.** Basit web araçlarında e-belge yok, e-belgesi olanlar masaüstü ya da ağır ERP.
2. **Müşteri portalı ve ertesi gün kişi sayısı siparişi.** Bunu açıkça yapan Türk ürünü sadece Çözbim ("online sipariş"). Kesim saati, revizyon kaydı ve "biz 400 demiştik" tartışmasını bitirecek bir kayıt sistemi hiçbir hazır üründe öne çıkarılmıyor.
3. **Teslim tutanağı → ay sonu hakediş → toplu e-fatura zinciri.** YamanSoft'ta ay sonu otomatik fatura ve Çözbim'de toplu irsaliye/fatura var, ama dijital teslim imzası ve kurumla mutabakat ekranı olan hazır ürün görmedim.
4. **Tam maliyet ve sözleşme kârlılığı.** Rakiplerin çoğu sadece hammadde maliyeti gösteriyor. İşçilik, ambalaj/tek kullanımlık malzeme, nakliye ve enerji payını ekleyerek **müşteri/sözleşme bazında aylık kâr** hesaplamak az bulunan bir özellik. Gıda enflasyonu ortamında, maliyeti eşiği aşan sözleşme için alarm ve TÜFE revizyon hatırlatması büyük değer.
5. **Plan ile fiili farkı ve geriye dönük maliyet.** Yemek Üstadı'nda plan/fiili tüketim farkı, YaylaSoft'ta geç gelen faturayla geriye dönük maliyet güncelleme var. Uluslararası yorumlarda da (MarketMan) "stok değeri ve COGS tutarsız" şikayeti öne çıkıyor. Bunu doğru yapmak rakiplerden ayrışmanın yolu.
6. **Müşteri grubuna ya da sözleşmeye göre farklı gramaj** (ör. MEB, fabrika, hastane). Az sayıda üründe var (Yemek Üstadı, YemekPRO) ve toplu yemeğin çekirdeği.
7. **Demirbaş (küvet/termobox) takibi**: sadece Çözbim'de var.
8. **Mobil deneyim**: uluslararası ürünlerde bile en sık şikayet (meez, MarketMan, TPP). Mutfakta ve depoda telefondan sayım, mal kabul ve teslim çok önemli.
9. **Kolay başlangıç**: kurulum zorluğu yorumlarda en sık geçen eksi (Apicbase, MarketMan, Caterease, TPP). CateringSis'teki hazır sektör reçete kütüphanesi Türkiye'de nadir ve etkili bir fikir.
10. **Tahmin (forecast)**: geçmiş tüketimden müşteri bazında porsiyon katsayısı önermek (Apicbase'de "Demand Forecasting" var). Türk ürünlerinde görmedim.

---

##### 5. Bizim programa öneriler (öncelik sırasıyla, fazlara göre)

| # | Öneri | Faz | Neden / referans |
|---|---|---|---|
| 1 | **Müşteri siparişi: ertesi gün × öğün × kişi sayısı, müşteri bazında kesim saati, kesimden sonra kilit ve revizyon log'u** (kim, ne zaman, eski ve yeni değer). Varsayılan olarak sözleşmedeki standart kişi sayısı gelsin, müşteri sadece farkı girsin | Sipariş (sonraki faz) | Sektörün en büyük kaos noktası (Edge rehberi); Çözbim'in online siparişi; Kitchen CUT/Apicbase'deki iç sipariş modeli |
| 2 | **Müşteri/sözleşme bazında gramaj ve fiyat profili**: aynı yemeğe farklı gramaj (MEB ya da fabrika), tarihli kişi başı fiyat geçmişi, zam/revizyon tarihi hatırlatması | Mevcut reçete modülüne ek + sipariş | Yemek Üstadı, YemekPRO, YamanSoft |
| 3 | **MRP: sipariş toplamı × reçete (brüt gramaj + fire%) → net ihtiyaç = ihtiyaç − stok − yoldaki sipariş → tedarikçiye göre gruplanmış satın alma önerisi** (PDF/WhatsApp/e-posta). Kesim saati geçince otomatik çalışsın | MRP | Tüm rakiplerde var; Kitchen CUT'ın "production list → PO satırları" yapısı iyi bir model |
| 4 | **Stok: SKT/lot girişi, üretim çıkışı, sayım ve fire; plan/fiili farkı** (gün sonunda aşçı fiili tüketimi girer, fark TL olarak raporlanır). Mobil öncelikli sayım ve mal kabul ekranı | Stok | Yemek Üstadı'ndaki fark raporu; MarketMan ve meez'in zayıf mobil tarafı fırsat |
| 5 | **Alış faturası: gelen e-faturayı (UBL) içe aktarıp stok kartlarıyla eşleştirme, faturadan fiyat güncelleme ve etkilenen reçete maliyetlerinin yeniden hesaplanması; geç gelen fatura için geriye dönük maliyet düzeltmesi** | Alış faturası | Çözbim'in gelen e-fatura eşleştirmesi, YaylaSoft'un geriye dönük maliyeti, meez'in maliyet beslemesi |
| 6 | **İrsaliye ve teslim: siparişten otomatik (toplu) irsaliye; şoför telefonundan teslim adedi + imza/fotoğraf; küvet/termobox zimmeti (çıkan/dönen adet, ilk aşamada QR olmadan sayıyla)** | İrsaliye | Çözbim demirbaş takibi; Edge dijital tutanak |
| 7 | **Ay sonu hakediş → toplu e-Fatura/e-Arşiv**: teslim kayıtlarından müşteri bazında icmal, müşteriyle mutabakat ekranı, tek tıkla toplu fatura. GİB'e doğrudan bağlanmak yerine **özel entegratör API'si** (ör. Paraşüt API, Logo/Uyumsoft/QNB eFinans gibi entegratörler) kullanın; alıcının e-Fatura mükellefi olup olmadığını sorgulayıp e-Fatura ya da e-Arşiv'e otomatik yönlendirin | e-Fatura | Çözbim ve YamanSoft'taki toplu fatura. *Mevzuat notu: 2025 hasılatı ≥3 milyon TL olanlar 1 Temmuz 2026'da e-Fatura'ya, ≥10 milyon TL olanlar e-İrsaliye'ye geçmekle yükümlü görünüyor (VUK 509 ve 2025 sonu değişiklikleri; mali müşavirle teyit edin).* |
| 8 | **Aylık kârlılık raporu: müşteri/sözleşme bazında gelir − (hammadde + ambalaj + işçilik payı + nakliye payı + genel gider payı)**; marjı eşiğin altına düşen sözleşme için uyarı | Kâr raporu | Rakiplerin çoğu sadece hammadde maliyetine bakıyor (Edge rehberindeki 4 katmanlı model) |
| 9 | **Müşteri portalı**: sipariş girişi, onaylı aylık menü görüntüleme (kalori ve alerjen ile), irsaliye/fatura/ekstre indirme, geri bildirim/şikayet | Portal | JAMIX'in e-Menu ve geri bildirimi; Caterease ve TPP müşteri portalı |
| 10 | **Kolay başlangıç ve güven**: hazır Türk toplu yemek reçete/gramaj şablonları (CateringSis'teki tek tuş), Excel'den içe aktarma, kritik işlemlerde log ve geri alma. Sonraki aşamada müşteri bazında geçmiş tüketimden porsiyon katsayısı önerisi (forecast) | Sürekli / sonraki | Yorumlarda en sık eksi kurulum zorluğu; forecast için Apicbase |

**Kısa strateji:** Rakiplere göre ayrışmanın yolu çok modül değil, **tek bir akışı kusursuz bağlamak**: Müşteri siparişi (kesim saatli) → MRP/satın alma → üretim + fiili tüketim → irsaliye/teslim → ay sonu toplu e-fatura → sözleşme bazında kâr. Bu akışın tamamını modern web/mobil arayüzde ve şeffaf fiyatla sunan bir Türk ürünü şu an görünmüyor.

---



### 5.F Devir raporundaki sonraki fazlar ve pazar önerileri
> Kaynak: `claude-devir-raporu.md` satır 37–48 (birebir alıntı; başlık seviyeleri düşürüldü).

##### 5. Sıradaki fazlar (PLAN.md)
Depo, stok ve satınalma (MRP, sayım, SKT) · müşteri portalı ekranı · sevkiyat ve irsaliye · satış e-faturası · personel, puantaj ve maaş · menü planı ve diyetisyen ekranı · teklifler · saha ve müşteri bulma · sosyal medya · gıda güvenliği.
Açık notlar: KDV %10 ve tevkifat mali müşavirle teyit edilecek; bordroda net↔brüt hesabı yok.

##### 6. Pazar araştırmasından ürün önerileri (ayrıntı: pazar-arastirmasi.md)
- Sipariş: sözleşmedeki kişi sayısı varsayılan gelsin, müşteri sadece farkı girsin. Müşteriye özel kesim saati, kesimden sonra kilit ve revizyon log'u olsun.
- Müşteriye göre gramaj ve tarihli kişi başı fiyat.
- MRP sonucu tedarikçiye göre gruplanmış satın alma önerisi olsun. Lot ve SKT takibi, mobil sayım.
- Gelen e-faturayla reçete maliyetleri otomatik güncellensin. Geç gelen fatura için geriye dönük düzeltme.
- Siparişten toplu irsaliye, şoför telefonundan adet ve imza, küvet/termobox zimmeti.
- Ay sonu icmal ve mutabakat, ardından özel entegratör API'siyle toplu e-Fatura/e-Arşiv.
- Müşteri ve sözleşme bazında tam maliyetli kâr raporu ve marj alarmı.


---

## 6) Tasarım sistemi ve UI — "Hasat 2.0" (beyaz/ferah, kiremit #B4432A + ayçiçeği #E9A822 kimliği)


### 6.A Kullanıcının tasarım dili notu
> Kaynak: `prompt/yemekhane-yazilimi-prompt.md` satır 8–22 (birebir alıntı; başlık seviyeleri düşürüldü).

##### İlk teslimat: müşteriye gönderilecek tasarım demosu
- Herkesin açabileceği **tek bir ortak linkte**, tıklanabilir bir tasarım/demo uygulaması hazırla. Bunu potansiyel müşteriye göndereceğim; beğenirse işi alacağız.
- En önemli kısım **tasarım ve kolaylık**. Özene bezene, etkileyici yap.
- Demo, örnek (gerçekçi ama uydurma olduğu belli) verilerle çalışsın. Masaüstünde, tablette ve telefonda düzgün görünsün.
- Firmaya bir **logo** tasarla ve arayüzde kullan.

##### Tasarım dili
- Modern, ferah, okunaklı. Büyük dokunma alanları olsun (mutfak tableti ve telefon).
- **Hologram efektli butonlar ve geçişler**: pop-up, panel ve bildirimler hafif hologram ışık geçişiyle açılsın. Şık olsun, göz yormasın.
- Her ekranda esnek araçlar olsun: kaydet, güncelle, sil; arama; filtreleme; tarih aralığıyla arama; çoklu seçim.
- Her sekmede **Rapor** butonu ve **WhatsApp ile gönder** butonu bulunsun.
- Raporlar logolu olsun ve kurumsal, hologramlı bir antet kullansın. Görseli hoş ve kolay okunur olsun.
- **Üretimhane çalışanlarının çoğu ilkokul mezunu.** Mutfak raporları ve ekranları onların anlayacağı dille, büyük yazıyla, simgelerle ve adım adım tarifle gösterilmeli.
- Sosyal medya uygulamaları gibi bir **bildirim merkezi ve sohbet paneli** olsun (Instagram / Facebook / X tarzı). Personel kendi arasında yazışabilsin, hatırlatmalar buradan gelsin.


### 6.0 Maketler hakkında (Claude'un göremediği dosyalar)
Maketler asistan makinesinde, `/workspace/ui/` altında (PNG + `mock/*.html`). Sen bunları göremezsin. Aşağıdaki sözlü tarifler ve gömülü CSS/token'lar bağlayıcıdır. Özet:
- **mock-hasat.png (Bugün, mobil 390):**
  - üst: selamlama, tarih, zil;
  - 4 Stat kartı: yarınki kişi, bugünkü üretim, kritik stok, onay bekleyen;
  - öğün segmenti; üretim emri/hazırlık listesi; önemli notlar; sosyal önizleme şeridi;
  - alt sekme çubuğu: Bugün · Siparişler · Mutfak · Mesajlar · Bildirimler.
- **mock-hasat-recete.png (Reçete editörü, 1440):**
  - solda malzeme tablosu (combobox ile kanonik stok seçimi, g/kişi, fire %, doğrama);
  - sağda yapışkan maliyet kartı (kişi başı, FC%, son fiyat tarihi) ve alt SaveBar.
- **mock-hasat-siparis(.png / -mobil.png):**
  - üstte kesim şeridi + geri sayım;
  - durum sekmeleri (Bekliyor/Onaylı/Üretimde/Teslim);
  - masaüstünde tablo + sağda 400px detay paneli; mobilde kart listesi.
- **mock-hasat-mutfak.png (tablet 1194×834, koyu, yüksek kontrast):**
  - yemek kartları, kişi sayısı ve kg;
  - 4 büyük durum düğmesi (≥56px): Hazırlanıyor/Pişiyor/Hazır/Sevk;
  - ekran açık kalır (Wake Lock).
- **mock-hasat-bildirim.png (masaüstü):**
  - Instagram tarzı zil paneli (Tümü/Okunmamış, avatar + eylem + zaman);
  - Messenger tarzı sağ altta sohbet başları ve mini sohbet penceresi (mesaj içinde sipariş/reçete kartı, yazıyor göstergesi).
- **mock-hasat-mobil-sosyal.png:** Bildirimler · Mesajlar · Sohbet (3 mobil ekran; X/Instagram tarzı alt sekmeler).
- **Hologram:** `hologram-demo.mp4`, `hologram-kare-*.png`, `mock/hasat-motion.css`. CSS'in tamamı aşağıda (§6.3, rehber §7.1) gömülüdür.



### 6.1 Tasarım devri (talimat, ekran ekran düzen + DB eşlemesi, yeni tablolar, uygulama sırası, kabul)
> Kaynak: `ui/claude-tasarim-devri.md` satır 4–son (birebir alıntı; başlık seviyeleri düşürüldü).

#### 0. Claude'a talimat
1. **Önce oku:** `docs/PLAN.md`, `src/index.css`, `src/ui/primitives.tsx`, `src/ui/bits.tsx`, `src/ui/toast.tsx`, `src/app/Shell.tsx`, `src/app/modules.ts`, `src/lib/format.ts`, `supabase/migrations/*`. Dal: `claude/catering-erp-transformation-lxyhbx`.
2. **Mevcut mimariyi bozma.** Token adları (`--tc-*`, `bg-brand`, `text-ink-3` …), `src/ui/` bileşen API'leri, router, TanStack Query yapısı, RPC'ler (`save_recipe`, `save_menu`, `recipe_scale`, `plan_production_from_orders`, `order_is_open`) ve RLS kalıbı (`has_role`, `is_staff`, `current_customer_id`) aynen kalır. Tasarım **değer güncellemesi + yeni bileşen eklemesi** olarak uygulanır; yeniden adlandırma ve toplu yeniden yazım yok.
3. **Sıra zorunlu:** önce `claude-devir-raporu.md` §3'teki **8 kritik düzeltme** (portal RLS'de `unit_price`/`menu_id`, `stock_unit` değişimi koruması, `parseNum` TR binlik, `last_price`/`avg_cost` yetkisi, çıkışta Query önbelleği, canlı DB yerine ayrı dev/test projesi, CI, admin bootstrap). Bunlar birleşmeden tasarım işine başlama.
4. Sonra tasarımı **§5'teki sırayla, küçük PR'larla** uygula. Her PR: typecheck + lint + test + build yeşil; ekran görüntüsüyle kontrol.
5. **YENİ ÖNERİ** diye işaretli tablo/sütunlar yalnızca öneridir: ayrı migration PR'ı, önce dev projesinde, (kullanıcı izin verdi — beklemeden, test geçince). Canlı projeye (gbuwcrajpbnjqwqrftgs) test edilmemiş migration uygulama; dev/yerelde test geçince uygula ve raporla.
6. Ayrıntılı token/bileşen/CSS kaynakları: **`tasarim-rehberi.md`** (aynı klasörde; içerik bu belgeyle tutarlı). Bu belge tek başına yeterli olacak şekilde yazıldı.
7. Görseller (PNG) ve HTML kaynakları **asistanın makinesinde** (`/workspace/ui/`); Claude bunları göremez. Her ekranın düzeni aşağıda sözle tarif edildi; tarife uy.

#### 1. Ne tasarlandı, neden
- Kullanıcı üç yön arasından **Hasat 2.0 — “sakin krom, sıcak veri”**yi seçti: mevcut kiremit `#B4432A` + ayçiçeği `#E9A822` kimliği korunur; zemin `#FAF8F5`, ikincil metin `#6B635A` (AA 5,6:1), kartlar gölgesiz 1px çizgi, radius 6/10/14, Inter + `tabular-nums` (JetBrains Mono yerine), en küçük yazı 13px, dokunma hedefi ≥ 44px (mutfakta ≥ 56px). Renk yalnızca anlam taşıyan yerde (ana eylem, durum, veri vurgusu).
- **Hologram geçişleri:** modal, drawer, onay diyaloğu, toast, bildirim paneli ve sohbet penceresi açılırken 280ms bulanıktan nete + %96→%100 ölçek + 320ms tek geçişlik sıcak ışık taraması ve ayçiçeği/kiremit kenar parıltısı. Yalnız CSS (transform/opacity/filter), `prefers-reduced-motion`'da 150ms solma, etkileşimi asla bekletmez.
- **Sosyal tarzda bildirim ve sohbet:** zil + okunmamış sayaç + açılır panel (Tümü/Okunmamış), Messenger tarzı sohbet başları ve mini pencereler, mesaj içinde sipariş/reçete kartları, yazıyor göstergesi.
- **Mobil alt sekme çubuğu:** Bugün · Siparişler · Mutfak · Mesajlar · Bildirimler. Mobilde tablolar karta döner.
- **Mutfak modu** (tablet, yüksek kontrast, koyu): aşçıbaşı için büyük yazı ve tek dokunuşla durum ilerletme.

#### 2. Dosyalar (asistan makinesi, `/workspace/ui/`)
| Dosya | İçerik |
|---|---|
| `ui-inceleme.md` | Mevcut UI denetimi (kontrast ölçümleri, tutarsızlıklar, öneriler) |
| `tasarim-rehberi.md` | Token'lar (açık/koyu/mutfak), yapıştırmaya hazır `@theme` + hologram CSS, bileşen spesifikasyonları, ekran-DB eşlemesi, YENİ ÖNERİ SQL |
| `mock-hasat.png` | Bugün (mobil 390) — seçilen yönün ilk maketi |
| `mock-hasat-recete.png` | Reçete düzenleyici (masaüstü 1440) |
| `mock-hasat-siparis.png` / `mock-hasat-siparis-mobil.png` | Siparişler masaüstü (detay paneli açık) / mobil kart listesi |
| `mock-hasat-mutfak.png` | Mutfak modu (tablet yatay 1194×834) |
| `mock-hasat-bildirim.png` | Masaüstü: bildirim paneli açık + sohbet penceresi + sohbet başları |
| `mock-hasat-mobil-sosyal.png` | Mobil: Bildirimler · Mesajlar · Sohbet (3 ekran) |
| `mock/hologram-demo.html`, `hologram-demo.mp4`, `hologram-kare-modal.png`, `hologram-kare-bildirim.png` | Etkileşimli hareket demosu, kaydı ve animasyon ortası kareler |
| `mock/hasat-motion.css` | Hologram CSS (düz CSS sürümü) |
| `mock/build-hasat-*.js`, `mock/hasat-kit.js`, `mock/hasat-sosyal-parts.js`, `render-hasat.js`, `record-holo.js` | Maketlerin kaynakları ve yeniden üretim betikleri |

#### 3. Ekran ekran düzen + veritabanı eşlemesi
Tüm maketlerde küçük sarı “Örnek veri” rozeti var; gerçek uygulamada yok.

##### 3.1 Kabuk
- **Masaüstü:** 248px kenar çubuğu (logo: koyu kare içinde ayçiçeği + “Trakya Catering / Merkez Mutfak · Çorlu”; gruplar Genel/Mutfak/Satış/Finans/Sistem, öğeler tek satır ikon+etiket 44px, aktif öğe `brand-soft` zemin; altta kullanıcı kartı: avatar, ad, rol, tema). `modules.ts` içindeki `hint` açıklamaları tooltip'e taşınır. 64px üst bar: breadcrumb · ⌘K arama · tarih · Mesajlar (sayaç) · Zil (sayaç). Detay paneli açık ekranlarda kenar çubuğu 72px ikon rayına daralabilir.
- **Mobil:** 60px üst bar + alt sekme çubuğu (5 sekme, 56px, aktifte brand-soft hap, Mesajlar/Bildirimler sayaçlı). Toast mobilde sekme çubuğunun üstünde.
- Rol görünürlüğü `modules.ts` `roles` ile aynı; Mutfak sekmesi `asci_basi/diyetisyen/yonetici`, müşteri (`musteri`) yalnız portal kabuğu görür.

##### 3.2 Reçete düzenleyici (`/receteler/:id`) — `mock-hasat-recete.png`
Düzen: geri linki → H1 reçete adı + kod etiketi (`R-014`) · kategori · son kayıt (kişi/saat) → sağda Geçmiş, Reçete kartı, ⋯. İki sütun (sol esnek, sağ 316px yapışkan):
- Sol-1 **Genel bilgiler**: Reçete adı · Kategori · Ön-hesap porsiyonu (varsayılan 100, kaydedilmez) · Pişmiş porsiyon (g).
- Sol-2 **Malzemeler** tablosu: Malzeme (aranabilir combobox; açık hâlde 3 sonuç, eşleşen harf vurgulu, alt satır “HM-021 · Sebze & meyve · fire %10”, sağda “18,50 ₺/kg” ya da “Fiyat yok”; en altta “yeni hammadde oluştur” ve klavye ipuçları) · Net g (düzenlenir) · Fire % (karttan miras ise kesikli/soluk) · Brüt g · “100 porsiyon” brüt (kg/lt) · Birim fiyat · Porsiyon maliyeti · Pay % (ilk 3 kalem renkli kare) · sil. Altta arama-ekle şeridi; alt satırda çiğ net g, fire maliyeti, N porsiyon toplamı.
- Sol-3 **Hazırlanış**: numaralı adımlar.
- Sağ: **Porsiyon maliyeti** kartı (44px kiremit rakam, “Ortalama maliyetle …” hapı, yığılmış pay çubuğu + lejant, toplam, fire payı, eksik fiyat, hedef FC% → önerilen satış fiyatı) · **Alerjenler** (çipler) · **Besin değeri** (“Yeni” rozetli).
- Altta yüzen koyu **kaydet çubuğu** (değişiklik sayısı + neler değişti, Vazgeç, Kaydet ⌘S).

| UI | Tablo.sütun |
|---|---|
| Ad / kod / kategori | `recipes.name`, `recipes.code`, `recipes.category_code → recipe_categories.name` |
| Pişmiş porsiyon, porsiyon tanımı | `recipes.portion_served_g`, `recipes.portion_label` |
| Satır | `recipe_ingredients.ingredient_id, net_qty (1 porsiyon, g/ml/adet), waste_pct_override, sort, note` |
| Combobox seçenekleri | `ingredients.code, name, category, stock_unit, last_price, waste_pct, allergens, active` |
| Brüt / satır maliyeti | `v_recipe_lines.gross_qty, gross_stock_qty, line_cost_last, line_cost_avg` |
| N porsiyon sütunu | `recipe_scale(p_recipe_id, p_portions).gross_stock_total` (veya istemcide `gross_stock_qty × N`) |
| Porsiyon maliyeti / ortalama / eksik fiyat / alerjen | `v_recipe_costs.cost_last, cost_avg, missing_price_count, allergens` |
| Hedef FC% → önerilen fiyat | istemci hesabı (kalıcı değil) |
| Hazırlanış | `recipes.instructions` |
| Kaydet | `save_recipe(p_id, p_header, p_lines)` |
| Son kayıt yapan | `audit_log` (entity_type='recipes') |
| Besin değeri | **YENİ ÖNERİ** `ingredients.nutrition jsonb` |

##### 3.3 Siparişler (`/siparisler`) — `mock-hasat-siparis.png`, `mock-hasat-siparis-mobil.png`
Masaüstü: başlık + “Önceki günü kopyala”, “Yeni sipariş” → turuncu **kesim şeridi** (“Yarının siparişleri bugün 16:00'da kilitlenir. Portaldan 2 müşteri henüz sayı girmedi: …”, sağda büyük geri sayım “2 sa 24 dk kaldı” ve “Hatırlat”) → filtre satırı (‹ tarih ›, öğün segmenti Tümü/Kahvaltı/Öğle/Akşam/Gece, arama, filtre) → durum sekmeleri sayaçlı (Tümü · Bekliyor · Onaylandı · Teslim edildi · İptal) → tablo (seçim · Müşteri + kaynak + “Organizasyon” etiketi · Öğün · Kişi · Menü + yemekler · Tutar KDV hariç · Durum rozeti; seçili satır açık kiremit zemin + sol çizgi; iptal soluk/üstü çizili) → alt toplam şeridi. Sağda 400px **detay paneli**: müşteri, rozet, tarih/öğün/tür; Kişi sayısı (−/+) ve Teslim edilen; Menü kartı (kaplar, “Değiştir”); Tutar (kişi başı “müşteri kartından” kilitli, ara toplam, KDV %10, genel toplam); Not; Hareketler zaman çizelgesi; altta İptal et · Kaydet · Onayla.
Mobil: kesim kartı, tarih gezgini, yatay kaydırılan durum çipleri, toplam satırı, sipariş **kartları** (ikon, müşteri, öğün·kaynak, sağda büyük kişi sayısı; gri kutuda menü; altta tutar + rozet), “Yeni sipariş” FAB, alt sekme çubuğu.

| UI | Tablo.sütun |
|---|---|
| Müşteri | `meal_orders.customer_id → customers.name` |
| Tarih / öğün / tür | `meal_orders.service_date`, `meal` (kahvalti/ogle/aksam/gece), `kind` (sozlesmeli/organizasyon) |
| Kişi / teslim | `meal_orders.ordered_qty`, `delivered_qty` |
| Menü / yemekler | `meal_orders.menu_id → menus.name`; `menu_items.recipe_id → recipes.name`, `portion_factor` |
| Kişi başı / KDV / tutar | `meal_orders.unit_price`, `vat_rate`; tutar = `ordered_qty × unit_price` (fiyat `customers.default_meal_price`'tan gelir; portalda müşteri değiştiremez — kritik düzeltme 1) |
| Durum | `meal_orders.status` bekliyor → “Bekliyor”, onaylandi → “Onaylandı”, teslim_edildi → “Teslim edildi”, iptal → “İptal” |
| Not | `meal_orders.note` |
| Kesim / geri sayım | `order_is_open(service_date)`; 16:00 Europe/Istanbul |
| Sayı girmeyen müşteriler | aktif `customers` − o tarihte `meal_orders` kaydı olanlar |
| Hareketler | `audit_log` (entity_type='meal_orders', `diff`, `actor`) |
| Kaynak etiketi | `created_by → team_members.role` (musteri ⇒ “Portal”); Telefon/Pazarlama ayrımı **YENİ ÖNERİ** `meal_orders.source` |
| Hatırlat | **YENİ ÖNERİ** `notifications` |
| Önceki günü kopyala / Tümü teslim | mevcut işlevler korunur |

##### 3.4 Mutfak modu (`/mutfak`, YENİ rota) — `mock-hasat-mutfak.png`
Koyu yüksek kontrast, kenar çubuğu yok. Üst bar 76px: logo, “Mutfak” + tarih, öğün segmenti (Kahvaltı ✓ / Öğle / Akşam, 56px), büyük saat + “Sevkiyat 12:00”, yazı boyutu “Aa”, çıkış. İlerleme şeridi (“Öğle · 4 kalem · 7.454 porsiyon”, renkli segmentler, “2/4 hazır”). Her yemek bir satır kart (≥120px): solda durum renkli 6px şerit; ad 26px, porsiyon 30px; altında brüt hammadde özeti (kg) veya pişiyorsa turuncu zamanlayıcı + plan çubuğu; alerjen çipleri. Sağda 4 büyük düğme (≥84px): Bekliyor / Hazırlanıyor / Hazır / Sevk edildi — geçilen adım kesikli çerçeve + tik, mevcut adım dolgu (açık gri / turuncu / yeşil / mavi), sıradaki vurgulu. Altta beyaz toast “Etli Kuru Fasulye → Hazır · Geri al (4)”. Maliyet yok.

| UI | Tablo.sütun |
|---|---|
| Kalemler, porsiyon | `production_logs.prod_date, meal, recipe_id, portions` → `recipes.name` |
| Brüt özet | `recipe_scale(recipe_id, portions)` |
| Alerjen | `v_recipe_costs.allergens` |
| Durum / zamanlayıcı / sevk saati | **YENİ ÖNERİ** `production_logs.kitchen_status, started_at, ready_at, dispatched_at, planned_minutes` |
| Maliyetsiz görünüm | **YENİ ÖNERİ** `v_kitchen_today` (security_invoker, `unit_cost` hariç) |

##### 3.5 Bugün (`/`) — `mock-hasat.png`
Meta satırı → “Bugün” → selamlama (sevkiyata kalan, hazır kalem sayısı) → 4 Stat (porsiyon + delta, food cost + hedef çubuğu, ciro, açık sipariş/kesim) → “Bugünkü üretim” (ilerleme şeridi, kalem satırları, durum rozeti, alerjen çipleri) → “Yarınki siparişler” (satırlar, “Kesim 16:00”, toplam) → Üretim föyü / Yeni sipariş. Yol haritası kartı bu ekrandan kaldırılır. Kaynak: `production_logs`, `v_recipe_costs`, `meal_orders`, `customers`, finans özeti sorguları (mevcut).

##### 3.6 Bildirim ve sohbet — `mock-hasat-bildirim.png`, `mock-hasat-mobil-sosyal.png`
- Zil paneli (420px): başlık + “Tümünü okundu say”, Tümü/Okunmamış hapları, “Yeni/Bugün” grupları; satır = avatar (rol renkli baş harf veya sistem ikonu) + tür rozeti + “**Aktör** [rol] eylem” + göreli zaman; okunmamış zemin tonu + kiremit nokta; sipariş bildiriminde “Siparişi aç / Onayla”. Altta “Tüm bildirimleri gör”.
- Sohbet: sağ altta sohbet başları (52px, çevrimiçi nokta, sayaç, “yeni mesaj”), solunda 380×540 mini pencere (başlık: ad + “Aşçıbaşı · çevrimiçi”, küçült/kapat; baloncuklar: karşı beyaz, benim kiremit; “Görüldü”; yazıyor 3 nokta; mesaj içinde Sipariş ve Reçete kartları; giriş: ataç, “@ ile sipariş/reçete bağla”, gönder).
- Mobil: Bildirimler tam ekran liste (filtre hapları Tümü/Okunmamış/Siparişler), Mesajlar listesi (arama, çevrimiçi kişiler şeridi, konuşmalar), Sohbet ekranı.
- Roller (örnek veride): Ayşe Kaya — diyetisyen, Murat Şahin — asci_basi, Hakan Yıldız — satinalma, Elif Demir — musteri (Kapaklı Tekstil), Selin Aydın — muhasebe, Emre Koç — sofor. Rol etiketleri `team_members.role`: yonetici “Yönetici”, asci_basi “Aşçıbaşı”, diyetisyen “Diyetisyen”, depo “Depo”, satinalma “Satınalma”, muhasebe “Muhasebe”, pazarlamaci “Pazarlamacı”, sofor “Şoför”, musteri “Müşteri”.
- Veri: tamamen **YENİ ÖNERİ** (§4). “Stok kritik” bildirimi depo/stok modülü gelene kadar kapalı (stok miktarı tablosu yok; yalnız `ingredients.min_stock` var).

##### 3.7 Hareket
`holo` Tailwind v4 `@utility` (tam CSS `tasarim-rehberi.md` §7.1). Giriş 280ms `cubic-bezier(.2,.8,.2,1)`, tarama/parıltı 320ms, çıkış 180ms `cubic-bezier(.4,0,1,1)`; varyant `data-holo="right"` (drawer), `"up"` (toast/sohbet); kapanış `data-state="closed"`; `usePresence(open,180)` hook'u ile unmount gecikmesi. Reduced-motion: yalnız 150ms opacity.

#### 4. Önerilen yeni tablolar/sütunlar (YENİ ÖNERİ — yalnız öneri)
Tam SQL + RLS `tasarim-rehberi.md` §8.4 ve §9'da. Özet:
- `notifications (id, recipient_id, actor_id, kind, entity_type, entity_id, title, body, read_at, created_at)` — RLS: alıcı kendi satırını okur/okundu işaretler; ekleme yalnız SECURITY DEFINER tetikleyicilerden (ör. `meal_orders` insert/update, `production_logs.kitchen_status` değişimi, `ingredient_prices` insert, kesim hatırlatma cron'u).
- `conversations (id, kind direkt/grup/siparis, title, entity_type, entity_id, created_by, created_at, last_message_at)`, `conversation_members (conversation_id, user_id, last_read_at)`, `messages (id, conversation_id, sender_id, body, refs jsonb, created_at, edited_at)` — RLS: yalnız üyeler okur/yazar (`is_conversation_member()` SECURITY DEFINER, `(select auth.uid())` kalıbı); müşteri yalnız kendi `customer_id`'sine bağlı konuşmalara üye olur.
- Realtime: `alter publication supabase_realtime add table notifications, messages;` istemcide `postgres_changes` (filter `recipient_id=eq.<uid>` / `conversation_id=eq.<id>`); yazıyor ve çevrimiçi → Realtime **Presence/Broadcast** (tabloya yazılmaz).
- `production_logs` + `kitchen_status, started_at, ready_at, dispatched_at, planned_minutes`; `v_kitchen_today` view.
- `ingredients.nutrition jsonb` (100 g başına kcal, protein, karbonhidrat, yağ, lif, tuz).
- (İsteğe bağlı) `meal_orders.source`.
Hepsi eklemeli (additive): mevcut sorgu, RPC ve ekranları etkilemez; ayrı migration dosyaları, önce dev projesi, advisor uyarılarına dikkat (FK index, `(select auth.uid())`, tek politika/işlem).

#### 5. Güvenli uygulama sırası (8 kritik düzeltmeden SONRA)
1. **Token PR'ı** — yalnız `src/index.css`: `:root`/dark değerleri, `--tc-brand-text`, `.tc-num` → Inter tnum, `.tc-card` 14px gölgesiz, `.tc-input` 44px, focus halkası brand, radius/gölge/tip token'ları (`tasarim-rehberi.md` §1.2). Kod değişmez; tüm ekranlar görsel güncellenir. Görsel kontrol.
2. **Primitifler** — `Pill` 13px/28px, `Button` 44px + secondary görünüm, `accent` → primary eşlemesi, `Tabs` 44px, `Drawer` focus trap + scroll kilidi. API aynı.
3. **Yeni bileşenler** (yeni dosyalar): `Dialog.tsx` (`useConfirm`), `Combobox.tsx`, `Stat.tsx`, `SaveBar.tsx`, `DataTable.tsx` (mobil kart), `usePresence.ts`. Ardından `window.confirm` çağrılarını dosya dosya değiştir.
4. **Kabuk** — `Shell.tsx`: masaüstü üst bar (breadcrumb, ⌘K yer tutucu, zil/mesaj ikonları şimdilik sayaçsız), kenar çubuğu tek satır, mobil alt sekme çubuğu (Mesajlar/Bildirimler sekmeleri özellik bayrağıyla gizli).
5. **Ekranlar** — Reçete editörü (combobox, sağ panel, kaydet çubuğu) → Siparişler (kesim şeridi, sekmeler, detay paneli, mobil kartlar) → Bugün → Hammaddeler/Menüler/Üretim aynı kalıba.
6. **Hareket** — hologram CSS + `usePresence`; Modal/Drawer/Confirm/Toast'a `holo` sınıfı.
7. **Mutfak modu** — YENİ ÖNERİ migration (kitchen_status + view) onaylanınca `/mutfak` rotası, `data-theme="kitchen"`, Wake Lock.
8. **Bildirim + sohbet** — YENİ ÖNERİ migration'ları (dev → onay → canlı), `src/features/social/` modülü, Realtime abonelikleri, bayrağı aç.
9. (Sonra) Besin değeri, sipariş kaynağı, “Hatırlat”.

#### 6. Kabul ölçütleri
- Hiçbir metin 13px altında değil; ikincil metin kontrastı ≥ 4.5:1; tüm dokunma hedefleri ≥ 44px (mutfak ≥ 56px).
- Para/sayı TR biçimi (`1.250,50 ₺`, `%31,4`) mevcut `format.ts` ile; rakamlar `tabular-nums`.
- `window.confirm` kalmadı; silme/iptalde toast + “Geri al”.
- Mobilde yatay kaydırmalı tablo yok (Siparişler kart listesi).
- `prefers-reduced-motion` açıkken yalnız solma.
- Mevcut testler ve SQL testleri geçer; RLS davranışı değişmez (yeni tablolar hariç).



### 6.2 Tasarım rehberi (token'lar, yapıştırmaya hazır CSS, bileşenler, mutfak, erişilebilirlik, ekranlar, hologram CSS, bildirim/sohbet SQL)
> Kaynak: `ui/tasarim-rehberi.md` satır 1–son (birebir alıntı; başlık seviyeleri düşürüldü).

#### Hasat 2.0 — Tasarım Rehberi (Trakya Catering ERP)

> Claude Code için uygulanabilir rehber. Kullanıcı **Hasat 2.0** yönünü seçti: *sakin krom, sıcak veri*. Kiremit (#B4432A) + ayçiçeği (#E9A822) + un beyazı zemin; renk yalnızca anlam taşıyan yerlerde.
> Mevcut mimari korunur: token'lar `src/index.css` içindeki `--tc-*` değişkenleri ve `@theme inline` eşlemesi üzerinden **genişletilir** (yeniden adlandırma yok); bileşenler `src/ui/` içinde **aşamalı** güncellenir.
> Referans görseller (asistan makinesinde, `/workspace/ui/`): `mock-hasat.png` (Bugün, mobil), `mock-hasat-recete.png`, `mock-hasat-siparis.png`, `mock-hasat-siparis-mobil.png`, `mock-hasat-mutfak.png`, `mock-hasat-bildirim.png`, `mock-hasat-mobil-sosyal.png`, `hologram-demo.mp4`. Claude bu dosyaları göremez; her ekran aşağıda sözle tarif edildi.

---

##### 1. Token'lar

###### 1.1 Renkler (açık / koyu)
| Token (mevcut ad) | Açık (yeni değer) | Koyu (yeni değer) | Not |
|---|---|---|---|
| `--tc-surface` | `#FAF8F5` | `#121110` | sayfa zemini |
| `--tc-surface-2` | `#F3F0EA` | `#1A1917` | sekme rayı, tablo başlığı, alt şerit |
| `--tc-card` | `#FFFFFF` | `#1F1D1B` | |
| `--tc-line` | `#E7E2D9` | `#2E2B28` | |
| `--tc-line-strong` | `#D3CBBE` | `#403B36` | input kenarı |
| `--tc-ink` | `#1C1917` | `#F5F2EE` | |
| `--tc-ink-2` | `#44403C` | `#CFC8BF` | |
| `--tc-ink-3` | `#6B635A` (bg'de 5,6:1) | `#A39A8F` | eski `#857B6D` AA'yı geçmiyordu |
| `--tc-brand` | `#B4432A` | `#B4432A` | dolgu; üstünde beyaz 5,6:1. Koyuda artık parlak mercan yok |
| `--tc-brand-strong` | `#963520` | `#C9533A` | hover |
| `--tc-brand-soft` | `#F9E7E1` | `#3A221B` | aktif menü zemini |
| `--tc-on-brand` | `#FFFFFF` | `#FFFFFF` | |
| `--tc-brand-text` **(yeni)** | `#963520` | `#F08A6E` | link, ikon, aktif metin |
| `--tc-accent` | `#E9A822` | `#F2BC45` | yalnızca dolgu/grafik; üstünde koyu metin |
| `--tc-accent-strong` | `#8A5A00` | `#F6CD6E` | soft zemin üstünde metin (alerjen) 5,2:1 |
| `--tc-accent-soft` | `#FCF0D2` | `#3A2F16` | |
| `--tc-ok` / `-soft` | `#0F766E` / `#E0F2EF` | `#5EC4B6` / `#14302C` | |
| `--tc-wait` / `-soft` | `#9A4A07` / `#FDEBD3` | `#F0A34C` / `#3A2A14` | |
| `--tc-stop` / `-soft` | `#B91C1C` / `#FDE4E1` | `#F08A7E` / `#3E1A17` | |
| `--tc-info` / `-soft` | `#1D4ED8` / `#E3EAFD` | `#8FB0F7` / `#18243E` | |

**Mutfak (yüksek kontrast) teması** `[data-theme="kitchen"]`: bg `#0E0D0C`, card `#1A1816`, line `#34302B`, ink `#FFFFFF`, ink-2 `#E4DED6`, ink-3 `#B5ACA1`; durum dolguları: bekliyor `#E4DED6`, hazırlanıyor `#F0A34C`, hazır `#3FCB9B`, sevk `#8FB0F7` (hepsinin üstünde `#111` metin).

###### 1.2 Yapıştırmaya hazır CSS (`src/index.css` — mevcut blokların yerine, adlar aynı)
```css
:root {
  --tc-surface:#FAF8F5; --tc-surface-2:#F3F0EA; --tc-card:#FFFFFF;
  --tc-line:#E7E2D9; --tc-line-strong:#D3CBBE;
  --tc-ink:#1C1917; --tc-ink-2:#44403C; --tc-ink-3:#6B635A;
  --tc-brand:#B4432A; --tc-brand-strong:#963520; --tc-brand-soft:#F9E7E1; --tc-on-brand:#FFFFFF; --tc-brand-text:#963520;
  --tc-accent:#E9A822; --tc-accent-strong:#8A5A00; --tc-accent-soft:#FCF0D2;
  --tc-ok:#0F766E; --tc-ok-soft:#E0F2EF; --tc-wait:#9A4A07; --tc-wait-soft:#FDEBD3;
  --tc-stop:#B91C1C; --tc-stop-soft:#FDE4E1; --tc-info:#1D4ED8; --tc-info-soft:#E3EAFD;
  --tc-shadow:28 25 23;
  color-scheme: light;
}
[data-theme="dark"] {
  --tc-surface:#121110; --tc-surface-2:#1A1917; --tc-card:#1F1D1B;
  --tc-line:#2E2B28; --tc-line-strong:#403B36;
  --tc-ink:#F5F2EE; --tc-ink-2:#CFC8BF; --tc-ink-3:#A39A8F;
  --tc-brand:#B4432A; --tc-brand-strong:#C9533A; --tc-brand-soft:#3A221B; --tc-on-brand:#FFFFFF; --tc-brand-text:#F08A6E;
  --tc-accent:#F2BC45; --tc-accent-strong:#F6CD6E; --tc-accent-soft:#3A2F16;
  --tc-ok:#5EC4B6; --tc-ok-soft:#14302C; --tc-wait:#F0A34C; --tc-wait-soft:#3A2A14;
  --tc-stop:#F08A7E; --tc-stop-soft:#3E1A17; --tc-info:#8FB0F7; --tc-info-soft:#18243E;
  --tc-shadow:0 0 0;
  color-scheme: dark;
}
[data-theme="kitchen"] {
  --tc-surface:#0E0D0C; --tc-surface-2:#141210; --tc-card:#1A1816; --tc-line:#34302B; --tc-line-strong:#4A443D;
  --tc-ink:#FFFFFF; --tc-ink-2:#E4DED6; --tc-ink-3:#B5ACA1; --tc-brand-text:#F08A6E;
  --tc-k-wait:#E4DED6; --tc-k-cook:#F0A34C; --tc-k-ready:#3FCB9B; --tc-k-sent:#8FB0F7;
  color-scheme: dark;
}

@theme inline {
  /* mevcut eşlemeler aynen kalır; yalnızca şu satırlar EKLENİR */
  --color-brand-text: var(--tc-brand-text);
  --color-k-wait: var(--tc-k-wait); --color-k-cook: var(--tc-k-cook);
  --color-k-ready: var(--tc-k-ready); --color-k-sent: var(--tc-k-sent);

  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Outfit", "Inter", ui-sans-serif, sans-serif;   /* yalnızca logo/wordmark */

  /* tip ölçeği — 13px altı yok */
  --text-label: 13px;  --text-label--line-height: 18px;
  --text-body:  14px;  --text-body--line-height: 20px;
  --text-body-lg: 15px; --text-body-lg--line-height: 22px;
  --text-title: 16px;  --text-title--line-height: 22px;
  --text-h3: 20px;     --text-h3--line-height: 26px;
  --text-h1: 28px;     --text-h1--line-height: 32px;
  --text-kpi: 28px;    --text-kpi--line-height: 32px;
  --text-hero: 44px;   --text-hero--line-height: 44px;

  /* radius: 3 kademe */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px;

  /* gölge: kartlar gölgesiz; yalnızca yüzen katmanlar */
  --shadow-pop: 0 1px 2px rgb(var(--tc-shadow) / .06), 0 8px 24px -4px rgb(var(--tc-shadow) / .14);
  --shadow-drawer: -1px 0 0 var(--tc-line), -16px 0 40px -12px rgb(var(--tc-shadow) / .16);
  --shadow-toast: 0 16px 40px -10px rgb(var(--tc-shadow) / .45);

  --ease-holo: cubic-bezier(.2,.8,.2,1);
}

@layer base {
  body { font-feature-settings: "cv11","ss01"; }
  h1, h2, h3, h4 { font-family: var(--font-sans); letter-spacing: -0.02em; } /* Outfit başlıklardan çıkar */
  :focus-visible { outline: 2px solid var(--tc-brand); outline-offset: 2px; }
}
@layer components {
  .tc-card  { border-radius: var(--radius-lg); box-shadow: none; }        /* 18px → 14px, gölgesiz */
  .tc-input { border-radius: var(--radius-md); min-height: 44px; }
  .tc-input:focus { box-shadow: 0 0 0 3px rgb(180 67 42 / .18); }
  .tc-num   { font-family: var(--font-sans); font-variant-numeric: tabular-nums; font-feature-settings: "tnum","cv11"; letter-spacing: 0; }
}
```
> `.tc-num` sınıf adı korunur, yalnızca mono yerine Inter `tnum` olur → tüm ekranlar tek değişiklikle güncellenir. JetBrains Mono `index.html`'den kaldırılabilir (yalnız kodlar için `font-mono` = `ui-monospace`).

###### 1.3 Boşluk ve yerleşim
- 4px ızgara. Kart iç boşluğu 16 (mobil) / 20 (masaüstü). Sayfa kenarı 16 / 24 / 28–32.
- Dokunma hedefi **en az 44px** (buton, input, sekme, menü öğesi, ikon buton). Mutfak modunda **en az 56px** (tasarımda 84px).
- Metin: gövde 14–15px, etiket/rozet 13px; **9–12px yasak**.

---

##### 2. Bileşenler (`src/ui/`)
Mevcut API'ler korunur; görünüm güncellenir, yeni bileşenler yeni dosyada eklenir.

| Bileşen | Spesifikasyon | Uygulama notu |
|---|---|---|
| **Button** | yükseklik 44 (md) / 36 (sm yalnızca yoğun tablo içi, dokunmatikte 44); radius md; 14px 600. Varyantlar: `primary` (brand dolgu, beyaz), `ghost` = **secondary** (beyaz + 1px line-strong), `subtle` (şeffaf, ink-2), `danger` (beyaz + kırmızı metin; onay diyaloğunda kırmızı dolgu). `accent` varyantı **kullanımdan kaldırılır** (tip olarak kalsın, primary'ye eşlensin). Klavye kısayolu rozeti (`⌘S`) sağda. | `primitives.tsx` → `BTN` sınıfları ve `size` padding'leri |
| **Input / Field** | 44px, radius md, kenar line-strong, odakta brand kenar + 3px halka; etiket 13px 600 ink-2 üstte; yardım 13px ink-3; sağ ek (`adet`, `g`, `₺`) ink-3. | `.tc-input`, `Field` |
| **Combobox (YENİ)** `src/ui/Combobox.tsx` | Arama inputu + açılır liste (genişlik ≥ 400px, radius lg, shadow-pop). Her seçenek 48px: ikon · **ad** (eşleşen harfler accent-soft vurgulu) · alt satır `kod · kategori · fire %` · sağda `18,50 ₺/kg` veya “Fiyat yok” rozeti. Liste sonunda ayırıcı + ““soğ” adıyla yeni hammadde oluştur” (brand). En altta klavye ipuçları: ↑ ↓ gez · Enter seç · Esc kapat. `role="combobox"`, `aria-activedescendant`. | Harici kütüphane yok ya da `@headlessui/react`/Radix yalnız davranış için; stil token'larla |
| **Table + mobil kart** `src/ui/DataTable.tsx` (YENİ) | Başlık 13px 600 ink-3, normal harf, surface zemin; satır ≥ 52px; sayılar sağa, `tc-num`; seçili satır `#FDF5F1` + solda 3px brand çizgi; iptal satırı soluk + üstü çizili rakam; alt şerit surface zemin (toplam). `< md` genişlikte **aynı veri kart listesine** döner (bkz. Siparişler mobil). | TanStack Table isteğe bağlı; önce basit `columns` + `renderCard` prop'u |
| **Badge / durum** | 28px yükseklik, pill, 13px 600, solda 7px nokta. Sipariş: `bekliyor`=wait, `onaylandi`=ok, `teslim_edildi`=info, `iptal`=nötr (surface-2 + line). Mutfak: Bekliyor nötr, Hazırlanıyor wait, Hazır ok, Sevk edildi info. Alerjen çipi: accent-soft + accent-strong, 28px, radius sm, ikonlu. | `Pill` 11px → 13px; `Tone` aynı |
| **Card / Panel** | card zemin, 1px line, radius lg, gölgesiz; başlık 16px 650 + 13px açıklama; eylem sağda. | `.tc-card`, `Panel` |
| **Stat (YENİ)** | etiket 13px ink-3 + ikon · değer 28px 700 `tc-num` · alt satır delta/hedef çubuğu. Tüm mini istatistik kutuları buna iner. | `src/ui/Stat.tsx` |
| **Drawer** | Sağdan; masaüstünde 400–440px, **yer açan (docked)** kullanım da desteklenir (Siparişler); mobilde tam ekran. Başlık: küçük üst etiket, 20px başlık, durum rozeti + meta; gövde bölümleri 13px başlıklı; altta yapışkan eylem çubuğu (solda yıkıcı, sağda birincil). Focus trap, açılışta odak panele, body scroll kilidi, Esc. Hologram girişi `data-holo="right"`. | mevcut `Drawer`'a focus trap + `holo` sınıfı |
| **Modal / ConfirmDialog (YENİ)** | 480px, radius lg; Confirm: 48px kırmızı yuvarlak ikon, başlık soru cümlesi (“Sipariş iptal edilsin mi?”), sonuç açıklaması, “Vazgeç” + kırmızı dolgu eylem. `useConfirm()` hook'u Promise döner → **tüm `window.confirm` çağrıları bununla değişir**. Silmede ayrıca toast + “Geri al”. | `src/ui/Dialog.tsx` |
| **Toast** | ink zemin, beyaz metin, radius lg, sol ikon (accent), sağda “Geri al” (accent metin, 40px). Konum: mobilde alt sekme çubuğunun üstü (`bottom: 88px`), masaüstünde sağ alt. Hologram `data-holo="up"`. | `toast.tsx`: `bottom-20` artık alt sekme çubuğu ile anlamlı; `undo` seçeneği ekle |
| **Empty state** | 48px yumuşak ikon kutusu, 16px başlık, 14px açıklama, birincil eylem. | `EmptyState` |
| **Tabs** | Sayfa sekmesi: alt çizgili, 44px, sayaç rozeti (aktifte brand dolgu). Segment (öğün seçimi): surface-2 ray, aktif beyaz + ince gölge, 44px. Filtre çipi (mobil): 40–44px pill, aktif ink dolgu. | `Tabs` |
| **Kaydet çubuğu (YENİ)** | `dirty` iken altta yüzen ink zeminli çubuk: ayçiçeği nokta · “3 kaydedilmemiş değişiklik” + neler değişti · Vazgeç · Kaydet ⌘S. | `src/ui/SaveBar.tsx` |

---

##### 3. Yerleşim
- **Kenar çubuğu (lg ≥ 1024)**: 248px, tek satırlı öğe (ikon 20 + etiket 14px), 44px yükseklik; grup başlıkları 13px 600 ink-3 normal harf (Genel / Mutfak / Satış / Finans / Sistem). Aktif: brand-soft zemin + brand-text. Sayaç sağda (Siparişler 24). Altta kullanıcı kartı (avatar, ad, rol, tema düğmesi). Açıklama satırları (`hint`) tooltip'e taşınır. Detay paneli açıkken 72px **ikon rayına** daralabilir.
- **Üst bar (masaüstü)**: 64px, yarı saydam zemin + blur; solda breadcrumb (Mutfak › Reçeteler › **Etli Kuru Fasulye**); sağda ⌘K arama (240–320px), tarih hapı, Mesajlar ikonu (sayaç), Zil (sayaç).
- **Mobil**: 60px üst bar (logo, marka, arama/zil, avatar) + **alt sekme çubuğu**: Bugün · Siparişler · Mutfak · Mesajlar · Bildirimler (56px öğe, aktifte brand-soft hap; Mesajlar/Bildirimler sayaç rozetli). Ekran altı güvenli alan 22px.
- **Sayfa genişliği**: içerik `max-w-[1192px]`; iki sütunlu editörlerde sağ panel 316–340px yapışkan (`top: 88px`).
- Sayfa başlığı: üst satır küçük meta (ikon + tarih/servis), H1 28px 700, yanında “Örnek veri”/durum rozeti, altında imza çizgisi (28px kiremit + 12px ayçiçeği, 3px), sağda eylemler.

##### 4. Mutfak / tablet modu kuralları
- Rota `/mutfak`; `asci_basi` için varsayılan açılış; kenar çubuğu yok, `data-theme="kitchen"`.
- Üst bar 76px: logo, “Mutfak” + tarih, öğün segmenti (Kahvaltı ✓ / **Öğle** / Akşam, 56px), büyük saat (34px) + “Sevkiyat 12:00”, yazı boyutu (Aa) ve çıkış (56px).
- İlerleme şeridi: “Öğle · 4 kalem · 7.454 porsiyon”, kalem başına renkli segment, “2/4 hazır”.
- Her kalem bir satır kart (≥ 120px): solda 6px durum rengi şeridi; **yemek adı 26px 700**, **porsiyon 30px**; altında brüt hammadde özeti (kg) ya da pişerken **zamanlayıcı** (26px turuncu, plan çubuğu); alerjen çipleri (koyu amber zemin, 15px 700). Sağda 4 büyük durum düğmesi (Bekliyor / Hazırlanıyor / Hazır / Sevk edildi), her biri ≥ 84px yüksek; geçilmiş adımlar kesikli çerçeve + tik, mevcut adım dolgu rengi, sıradaki adım vurgulu çerçeve.
- Tek dokunuşla durum ilerler; alttaki beyaz toast “Etli Kuru Fasulye → Hazır · Geri al (4)” 5 sn geri alma verir.
- Maliyet gösterilmez. Wake Lock ile ekran açık kalır. Klavye gerektiren giriş yok.

##### 5. Erişilebilirlik
- Metin kontrastı ≥ 4.5:1 (ink-3 dahil); büyük metin ≥ 3:1. Sarı yalnız dolgu, üstünde koyu metin.
- Hedefler ≥ 44px (mutfak ≥ 56px). Odak halkası her zaman görünür (`:focus-visible`).
- Durum yalnız renkle verilmez: rozet metni + nokta/ikon.
- Dialog/Drawer: `role`, `aria-modal`, `aria-labelledby`, focus trap, Esc, odak geri dönüşü.
- `prefers-reduced-motion` desteklenir (Bölüm 7).
- Türkçe büyük harf sorunları için tablo başlıklarında büyük harf dönüşümü kullanılmaz; `lang="tr"`.

---

##### 6. Ekran spesifikasyonları

###### 6.1 Bugün — `mock-hasat.png` (mobil), `mock-hasat-bildirim.png` (masaüstü arka plan)
Meta satırı (tarih · öğün) → “Bugün” + imza çizgisi → selamlama cümlesi (sevkiyata kalan süre, hazır kalem sayısı) → 2×2 (masaüstünde 4'lü) Stat: Bugünkü porsiyon (delta), Food cost (hedef çubuklu), Günlük ciro, Açık sipariş/kesime kalan → “Bugünkü üretim” paneli (renkli ilerleme şeridi + kalem satırları, durum rozeti, alerjen çipleri) → “Yarınki siparişler” paneli (müşteri ikonlu satırlar, kişi sayısı, “Kesim 16:00” rozeti, alt toplam) → iki eylem (Üretim föyü / Yeni sipariş). Yol haritası kartı bu ekrandan kaldırılır.
Veri: `production_logs` (prod_date, meal, recipe_id, portions, unit_cost), `v_recipe_costs.allergens`, `meal_orders` (service_date = yarın), `customers.name`, `order_is_open()`.

###### 6.2 Reçete düzenleyici — `mock-hasat-recete.png` (1440)
- Başlık: “← Reçetelere dön”, H1 **Etli Kuru Fasulye** + rozet, altında `R-014` kod etiketi · kategori · “Son kayıt bugün 14:32, Ayşe Kaya”; sağda Geçmiş, Reçete kartı (yazdır), ⋯.
- Sol sütun: **Genel bilgiler** kartı (4 alan tek satır): Reçete adı · Kategori (select) · Ön-hesap porsiyonu (100, “adet”; kaydedilmez) · Pişmiş porsiyon (350 g). Açıklama: “Miktarlar 1 porsiyon için saklanır; porsiyon sayısı yalnızca ön-hesaptır.”
- **Malzemeler** tablosu: sütunlar Malzeme (combobox görünümü: hover'da kenarlık + ↕ ikonu) · Net (g, düzenlenebilir hücre) · Fire % (hammadde kartından geliyorsa kesikli/soluk; üzerine yazılınca dolu) · Brüt (g, hesaplanan) · 100 porsiyon (brüt, stok biriminde “9,18 kg”) · Birim fiyat (“92,50 ₺/kg”) · Maliyet (porsiyon, kalın) · Pay (renkli kare + “%66,0”; ilk 3 kalem kiremit/ayçiçeği/zeytin) · çöp kutusu. Bir satırda combobox açık (“Soğ” arandı). Altta gri şeritte “Malzeme ara ve ekle (ad veya HM kodu)… `/`”. Alt satır: Çiğ net g/porsiyon · Fire maliyeti/porsiyon · 100 porsiyon toplamı.
- **Hazırlanış** kartı: numaralı adımlar (instructions satırları).
- Sağ yapışkan panel: **Porsiyon maliyeti · son fiyat** (canlı rozeti) 44px kiremit rakam “42,72 ₺”, altında “Ortalama maliyetle 40,88 ₺” hapı; yığılmış pay çubuğu + lejant (ilk 3 + “Diğer 7 kalem”); satırlar: Toplam (100 porsiyon), Fire payı, Eksik fiyat “Yok ✓”; gri kutuda Hedef food cost (%32 input) → Önerilen satış fiyatı. **Alerjenler** kartı (Süt çipi, “Gluten yok” nötr çipler). **Besin değeri** kartı (“Yeni” rozetli; enerji + protein/karbonhidrat/yağ/lif).
- Altta yüzen **Kaydet çubuğu**.

| Alan | Kaynak |
|---|---|
| Ad, kod, kategori | `recipes.name`, `recipes.code`, `recipes.category_code` → `recipe_categories.name` |
| Pişmiş porsiyon (g) / porsiyon tanımı | `recipes.portion_served_g`, `recipes.portion_label` |
| Ön-hesap porsiyonu | istemci state (kaydedilmez) + `recipe_scale(p_recipe_id, p_portions)` |
| Malzeme satırı | `recipe_ingredients.ingredient_id, net_qty (1 porsiyon, temel birim g/ml/adet), waste_pct_override, sort, note` |
| Fire (miras) | `ingredients.waste_pct` (`waste_pct_override` null ise) |
| Brüt, maliyet | `v_recipe_lines.gross_qty, gross_stock_qty, line_cost_last, line_cost_avg` |
| Birim / fiyat | `ingredients.stock_unit`, `ingredients.last_price` (/ `avg_cost`) |
| Porsiyon maliyeti, ortalama, eksik fiyat, alerjen | `v_recipe_costs.cost_last, cost_avg, missing_price_count, allergens` |
| Hedef FC% → önerilen fiyat | istemci hesabı (menü düzeyinde kalıcı alan `menus.target_price`) |
| Hazırlanış | `recipes.instructions` |
| Kaydet | mevcut RPC `save_recipe(p_id, p_header, p_lines)` |
| Besin değeri | **YENİ ÖNERİ** (Bölüm 9) |
| Son kayıt yapan | `audit_log` (entity_type='recipes') |

###### 6.3 Siparişler — `mock-hasat-siparis.png` (1440), `mock-hasat-siparis-mobil.png` (390)
- Masaüstü: kenar çubuğu 72px ikon rayı, sağda 400px **yer açan detay paneli**.
- Başlık “Siparişler” + rozet; sağda “Önceki günü kopyala”, “Yeni sipariş”.
- **Kesim uyarısı** (wait-soft şerit, beyaz kutuda saat ikonu): “Yarının siparişleri bugün 16:00'da kilitlenir. Portaldan 2 müşteri henüz sayı girmedi: …” + sağda büyük “2 sa 24 dk kaldı” + “Hatırlat”.
- Filtre satırı: tarih gezgini (‹ 27 Eylül Pazar ›) · öğün segmenti (Tümü/Kahvaltı/Öğle/Akşam/Gece) · arama · filtre düğmesi.
- Durum sekmeleri + sayaç: Tümü 10 · Bekliyor 5 · Onaylandı 4 · Teslim edildi 0 · İptal 1.
- Tablo: seçim kutusu · Müşteri (ikon kutusu + ad + kaynak “Portal/Telefon/Pazarlama” + “Organizasyon” etiketi) · Öğün (+ tarih) · Kişi (sağa, 15px 650) · Menü (ad + yemekler tek satır kısaltılmış) · Tutar (KDV hariç) · Durum rozeti. Alt şerit: sipariş sayısı · “Toplam (iptal hariç, KDV hariç) 2.849 kişi · 280.038,00 ₺”.
- Detay paneli: “Sipariş detayı”, müşteri adı 20px, rozet + tarih/öğün/tür; **Kişi sayısı** (Sipariş 385, −/+ 44px; Teslim edilen “—, teslimde girilir”); **Menü** kartı (kaplar, porsiyon katsayısı, “Değiştir”); **Tutar** (Kişi başı “müşteri kartından” kilitli, ara toplam, KDV %10, genel toplam 18px); not kutusu (accent-soft); **Hareketler** zaman çizelgesi; altta İptal et (kırmızı metin) · Kaydet · **Onayla**.
- Mobil: kesim kartı (kalan süre sağda), tarih gezgini, yatay kaydırılan filtre çipleri (sayaçlı), toplam satırı, **kartlar** (ikon · müşteri + öğün · kaynak · sağda büyük kişi sayısı; gri kutuda menü + yemekler; altta tutar + rozet), sağ altta “Yeni sipariş” FAB (56px), alt sekme çubuğu.

| Alan | Kaynak |
|---|---|
| Müşteri | `meal_orders.customer_id` → `customers.name` (+ `customers.default_meal_price`, `vat_rate`) |
| Tarih / öğün | `meal_orders.service_date`, `meal` (`kahvalti/ogle/aksam/gece`) |
| Tür | `meal_orders.kind` (`sozlesmeli/organizasyon`) |
| Kişi / teslim | `meal_orders.ordered_qty`, `delivered_qty` |
| Menü | `meal_orders.menu_id` → `menus.name`, `menu_items` (+ `recipes.name`, `portion_factor`) |
| Kişi başı / KDV | `meal_orders.unit_price`, `vat_rate`; tutar = `ordered_qty × unit_price` |
| Durum | `meal_orders.status` (`bekliyor/onaylandi/teslim_edildi/iptal`) |
| Not | `meal_orders.note` |
| Kesim | `order_is_open(service_date)` (16:00 İstanbul) |
| Hareketler | `audit_log` (entity_type='meal_orders', diff) |
| Kaynak (Portal/Telefon/Pazarlama) | `created_by` → `team_members.role` (musteri ⇒ Portal); “Telefon/Pazarlama” ayrımı için **YENİ ÖNERİ** `meal_orders.source text` (isteğe bağlı) |
| “Sayı girmeyen müşteri” | aktif `customers` − yarın `meal_orders` olanlar (sorgu) |
| Hatırlat | **YENİ ÖNERİ** (notifications) |

###### 6.4 Mutfak — `mock-hasat-mutfak.png` (1194×834)
Bölüm 4'teki düzen. Örnek: Mercimek Çorbası 2.254 (Sevk edildi, 11:05, soluk), Etli Kuru Fasulye 1.860 (Hazır), Pirinç Pilavı 1.860 (Hazırlanıyor, 18:42 / plan 25 dk), Cacık 1.480 (Bekliyor, başlangıç 11:30).
| Alan | Kaynak |
|---|---|
| Kalemler / porsiyon | `production_logs (prod_date, meal, recipe_id, portions)` → `recipes.name`, `recipe_categories` |
| Brüt hammadde özeti | `recipe_scale(recipe_id, portions)` → `gross_stock_total`, `stock_unit` |
| Alerjen | `v_recipe_costs.allergens` |
| Durum, zamanlayıcı, sevk saati | **YENİ ÖNERİ** `production_logs.kitchen_status, started_at, ready_at, dispatched_at, planned_minutes` |

###### 6.5 Bildirim ve sohbet — `mock-hasat-bildirim.png`, `mock-hasat-mobil-sosyal.png`
Bkz. Bölüm 8.

---

##### 7. Hareket / Animasyon — “Hologram” geçişleri
Amaç: popover, modal, drawer, toast, bildirim paneli ve sohbet penceresi açılırken **kısa, sıcak bir ışık taraması**: bulanıktan nete, %96 → %100 ölçek, ince ayçiçeği/kiremit kenar parıltısı. Bilimkurgu değil; 1 kez oynar, döngü yok.

| Öğe | Süre | Eğri | Hareket |
|---|---|---|---|
| Giriş (modal/popover) | 280ms | `cubic-bezier(.2,.8,.2,1)` | translateY(6px) scale(.96) blur(6px) → none |
| Drawer | 280ms | aynı | translateX(24px) scale(.985) blur(6px) → none |
| Toast / sohbet penceresi | 260–280ms | aynı | translateY(12px) scale(.96) blur(5px) → none |
| Işık taraması + kenar parıltısı | 320ms | aynı / ease-out | ::after translateY(-100%→100%), ::before opacity 0→1→0 |
| Çıkış | 180ms | `cubic-bezier(.4,0,1,1)` | opacity 0, scale .98, blur(4px) |
| Scrim | 200ms / 160ms | ease-out / ease-in | opacity |
| Azaltılmış hareket | 150ms | ease-out | yalnızca opacity; tarama/parıltı gizli |

Kurallar: yalnızca `transform`, `opacity`, `filter`; ışık katmanları `pointer-events:none`; bileşen **ilk karede tıklanabilir** (animasyon beklemez); kapanışta `data-state="closed"` + `animationend` (yedek 300ms zaman aşımı) sonrası DOM'dan kaldır.

###### 7.1 Yapıştırmaya hazır CSS (`src/index.css` sonuna)
```css
:root{
  --holo-dur:280ms; --holo-dur-out:180ms; --holo-sweep:320ms;
  --ease-holo-out:cubic-bezier(.4,0,1,1);
  --holo-glow-a:rgba(233,168,34,.70); --holo-glow-b:rgba(180,67,42,.22);
  --holo-beam:rgba(255,214,150,.38); --holo-line:rgba(180,67,42,.07);
}
[data-theme="dark"],[data-theme="kitchen"]{ --holo-glow-a:rgba(242,188,69,.65); --holo-glow-b:rgba(240,138,110,.20); --holo-beam:rgba(255,200,140,.22); --holo-line:rgba(255,200,140,.06); }

@keyframes holo-in    { 0%{opacity:0;transform:translateY(6px) scale(.96);filter:blur(6px) saturate(1.3)} 55%{opacity:1;filter:blur(.6px) saturate(1.1)} 100%{opacity:1;transform:none;filter:none} }
@keyframes holo-in-r  { 0%{opacity:0;transform:translateX(24px) scale(.985);filter:blur(6px)} 55%{opacity:1;filter:blur(.6px)} 100%{opacity:1;transform:none;filter:none} }
@keyframes holo-in-up { 0%{opacity:0;transform:translateY(12px) scale(.96);filter:blur(5px)} 55%{opacity:1;filter:blur(.5px)} 100%{opacity:1;transform:none;filter:none} }
@keyframes holo-out   { to{opacity:0;transform:scale(.98);filter:blur(4px)} }
@keyframes holo-glow  { 0%{opacity:0} 35%{opacity:1} 100%{opacity:0} }
@keyframes holo-sweep { 0%{opacity:0;transform:translateY(-100%)} 20%{opacity:1} 100%{opacity:0;transform:translateY(100%)} }
@keyframes holo-fade  { from{opacity:0} to{opacity:1} }

@utility holo {
  position: relative; overflow: hidden; isolation: isolate;
  animation: holo-in var(--holo-dur) var(--ease-holo) both;
  &[data-holo="right"] { animation-name: holo-in-r; }
  &[data-holo="up"]    { animation-name: holo-in-up; }
  &[data-state="closed"] { animation: holo-out var(--holo-dur-out) var(--ease-holo-out) both; pointer-events: none; }
  &::before { content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; z-index:2; opacity:0;
    box-shadow: inset 0 0 0 1px var(--holo-glow-a), inset 0 0 28px var(--holo-glow-b);
    animation: holo-glow var(--holo-sweep) ease-out both; }
  &::after { content:""; position:absolute; inset:0; pointer-events:none; z-index:3; opacity:0;
    background: linear-gradient(180deg,transparent 30%,var(--holo-beam) 47%,rgba(255,255,255,.55) 50%,var(--holo-beam) 53%,transparent 70%),
                repeating-linear-gradient(0deg,var(--holo-line) 0 1px,transparent 1px 3px);
    animation: holo-sweep var(--holo-sweep) var(--ease-holo) both; }
  @media (prefers-reduced-motion: reduce) {
    animation: holo-fade 150ms ease-out both;
    &::before, &::after { display: none; }
  }
}
@utility holo-scrim {
  animation: holo-fade 200ms ease-out both;
  &[data-state="closed"] { animation: holo-fade 160ms ease-in reverse both; pointer-events: none; }
}
```
Kullanım: `<aside className="holo ..." data-holo="right">`. `overflow:hidden` gerektiğinden kaydırılan içerik, `holo` kabının **içindeki** bir div'de olmalı (örn. Drawer gövdesi). Kaynak dosya: `/workspace/ui/mock/hasat-motion.css` (birebir aynı, düz CSS sürümü).

###### 7.2 React notu
Mevcut `Drawer` `if (!open) return null` ile anında kaldırıyor. Kapanış animasyonu için küçük bir `usePresence(open, 180)` hook'u: `open=false` olunca `closing=true` → `data-state="closed"` → 180ms sonra unmount. Açılışta ekstra durum gerekmez (CSS animasyonu mount'ta oynar). Toast için aynı hook.

---

##### 8. Bildirim ve Sohbet (Facebook/Instagram/X tarzı)

###### 8.1 Bildirim paneli (masaüstü açılır menü) — `mock-hasat-bildirim.png`
- Üst barda Zil (44px) + sağ üstte brand sayaç rozeti (“4”); açıkken zil brand-soft zemin. Yanında Mesajlar ikonu (ink sayaç “3”).
- Panel 420px, zilin altında ok (caret) ile; radius lg, shadow-pop; hologram girişi (transform-origin sağ üst).
- Başlık “Bildirimler” 18px 700 + sağda “Tümünü okundu say” (brand link). Sekmeler (hap): **Tümü** / Okunmamış (4).
- Gruplar: “Yeni”, “Bugün” (mobilde “Bugün daha önce”, “Bu hafta”).
- Satır: 40px avatar (kişi baş harfleri, rol rengine göre yumuşak zemin) ya da sistem ikonu (fabrika, paket-kırmızı, saat-turuncu) + sağ altta 22px beyaz daire içinde tür ikonu (onay tik yeşil, sipariş panosu kiremit, uyarı kırmızı, şef şapkası, banknot mavi, saat); metin 14px: **Aktör** + rol etiketi (gri küçük rozet: Diyetisyen/Müşteri/Aşçıbaşı/Satınalma) + eylem, önemli kısım kalın; altında göreli zaman (“3 dk”, okunmamışsa brand 600). Okunmamış satır `#FDF6F2` zemin + sağda 10px brand nokta. Sipariş bildiriminde satır içi eylemler: “Siparişi aç” (primary sm) · “Onayla” (secondary sm).
- Alt: “Tüm bildirimleri gör” + ayarlar ikonu.
- Örnek metinler: “Ayşe Kaya (Diyetisyen) yarının menüsünü onayladı: 4 Kap Öğle A.” · “Kırklareli Seramik (Müşteri) 27 Eylül öğle için 350 kişilik sipariş verdi.” · “Kırmızı mercimek stoğu kritik seviyede: 42 kg kaldı (en az 150 kg).” · “Elif Demir (Müşteri) kişi sayısını 360 → 385 yaptı.” · “Murat Şahin (Aşçıbaşı) Etli Kuru Fasulye'yi hazır olarak işaretledi.” · “Hakan Yıldız (Satınalma) dana kuşbaşı fiyatını 620,00 ₺/kg yaptı.” · “Yarının siparişleri bugün 16:00'da kilitlenecek.”

###### 8.2 Sohbet
- **Sohbet başları** (sağ alt, Messenger): 52px yuvarlak avatarlar dikey yığın, çevrimiçi yeşil nokta, okunmamış sayacı; en altta beyaz “yeni mesaj” (kalem) düğmesi.
- **Mini sohbet penceresi** 380×540, başların solunda, alta yapışık; başlık: avatar + ad + “Aşçıbaşı · çevrimiçi” (yeşil), küçült / kapat. Gövde surface zemin: gün ayracı hapı, karşı taraf baloncuğu beyaz + line (sol alt köşe 6px), benim baloncuğum brand dolgu beyaz metin (sağ alt 6px), “Görüldü 11:26” çift tik, **yazıyor göstergesi** (3 nokta, 1,2 sn dalga; reduced-motion'da sabit). Mesaj içinde **bağlantı kartları**: Sipariş kartı (kiremit ikon kutusu · “Sipariş · 27 Eyl Öğle” · **Kapaklı Tekstil A.Ş.** · “385 kişi · 4 Kap Öğle B” · durum rozeti) ve Reçete kartı (ayçiçeği ikon kutusu · “Reçete · R-014” · **Etli Kuru Fasulye** · “10 malzeme · Süt” · ›). Giriş: ataç · “Mesaj yaz · @ ile sipariş/reçete bağla” (22px radius gri alan) · 44px kiremit gönder düğmesi.
- **Sağ sohbet paneli / konuşma listesi**: arama, “hikâye” satırı (çevrimiçi kişiler, ayçiçeği→kiremit halka), satırlar 68px: 44px avatar + çevrimiçi nokta, ad + zaman, rol, son mesaj (okunmamışsa kalın ink, zaman brand; yazıyorsa yeşil “yazıyor…”), sağda sayaç.

###### 8.3 Mobil — `mock-hasat-mobil-sosyal.png` (3 ekran yan yana)
1. **Bildirimler** (tam ekran, Instagram gibi): başlık + “Örnek veri”, sağda tümünü okundu (çift tik) ve ayarlar; filtre hapları Tümü (ink dolgu) / Okunmamış 4 / Siparişler; gruplar ve satırlar masaüstüyle aynı ama tam genişlik; alt sekme çubuğunda Bildirimler aktif.
2. **Mesajlar**: arama, çevrimiçi kişiler yatay şeridi, konuşma listesi; alt sekmede Mesajlar aktif (sayaç 3).
3. **Sohbet**: 64px başlık (geri, avatar, ad + çevrimiçi, telefon), baloncuklar ve kartlar, giriş çubuğu (+, alan, gönder). Alt sekme çubuğu sohbet içinde gizlenir.

###### 8.4 Veri modeli — **YENİ ÖNERİ** (henüz yok; yalnızca öneri)
```sql
-- YENİ ÖNERİ: bildirimler
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,      -- null = sistem
  kind text not null check (kind in ('siparis_yeni','siparis_degisti','menu_onay','stok_kritik','uretim_durum','fiyat_degisti','kesim_hatirlatma','mesaj')),
  entity_type text,  entity_id text,                                -- ör. 'meal_orders', uuid
  title text not null, body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, read_at, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_own_read   on public.notifications for select to authenticated using (recipient_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
-- insert yalnız SECURITY DEFINER tetikleyici/fonksiyonlardan (ör. meal_orders insert/update → yönetici+muhasebe+pazarlamaci alıcıları)

-- YENİ ÖNERİ: sohbet
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direkt' check (kind in ('direkt','grup','siparis')),
  title text, entity_type text, entity_id text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), last_message_at timestamptz
);
create table public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  last_read_at timestamptz, primary key (conversation_id, user_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id),
  body text not null check (length(body) between 1 and 4000),
  refs jsonb not null default '[]'::jsonb,   -- [{"type":"meal_orders","id":"…"},{"type":"recipes","id":"…"}]
  created_at timestamptz not null default now(), edited_at timestamptz
);
create index messages_conv_idx on public.messages (conversation_id, created_at desc);
create or replace function public.is_conversation_member(p uuid) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists(select 1 from conversation_members where conversation_id = p and user_id = auth.uid()) $$;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
create policy conv_member_read on public.conversations for select to authenticated using (public.is_conversation_member(id));
create policy cm_member_read   on public.conversation_members for select to authenticated using (public.is_conversation_member(conversation_id));
create policy cm_self_update   on public.conversation_members for update to authenticated using (user_id = (select auth.uid()));
create policy msg_member_read  on public.messages for select to authenticated using (public.is_conversation_member(conversation_id));
create policy msg_member_send  on public.messages for insert to authenticated with check (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id));
-- müşteri (musteri) rolü yalnız kendi customer_id'sine bağlı 'siparis' konuşmalarına üye yapılabilir
alter publication supabase_realtime add table public.notifications, public.messages;
```
- **Realtime**: `supabase.channel('notif:'+uid).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'recipient_id=eq.'+uid}, …)`; sohbet için `messages` INSERT, `filter: conversation_id=eq.<id>`. RLS Realtime'da da uygulanır. **Yazıyor** ve **çevrimiçi** göstergeleri tabloya yazılmaz: Realtime **Presence** (`channel.track({typing:true})`) ve **Broadcast** ile.
- Mesaj içindeki kart: `refs` içindeki id'ler, istemcide mevcut sorgularla (`meal_orders`, `v_recipe_costs`) RLS altında çözülür; yetkisi olmayan kullanıcı kartı “Erişim yok” olarak görür.
- “Mercimek stoğu kritik” bildirimi depo/stok modülüne bağlıdır (stok miktarı tablosu henüz yok; `ingredients.min_stock` var). Depo fazına kadar bu tür devre dışı.
- Bu tablolar mevcut kodu etkilemez; `src/features/social/` altında yeni modül, `Shell.tsx`'e yalnız zil/mesaj ikonları eklenir.

---

##### 9. Diğer YENİ ÖNERİ alanlar
```sql
-- YENİ ÖNERİ: mutfak durumu (production_logs'a eklenir; mevcut satırlar 'bekliyor' olur)
alter table public.production_logs
  add column kitchen_status text not null default 'bekliyor' check (kitchen_status in ('bekliyor','hazirlaniyor','hazir','sevk_edildi')),
  add column started_at timestamptz, add column ready_at timestamptz, add column dispatched_at timestamptz,
  add column planned_minutes int check (planned_minutes is null or planned_minutes > 0);
-- asci_basi bu sütunları güncelleyebilir (mevcut production_logs yazma politikası zaten yonetici/asci_basi/diyetisyen)

-- YENİ ÖNERİ: besin değeri (100 g/ml başına, hammadde kartında)
alter table public.ingredients add column nutrition jsonb;  -- {"kcal":347,"protein_g":21.4,"carb_g":60.3,"fat_g":1.2,"fiber_g":15.2,"salt_g":0.03}

-- YENİ ÖNERİ (isteğe bağlı): sipariş kaynağı
alter table public.meal_orders add column source text check (source in ('portal','telefon','pazarlama','kopya'));
```
Not: `production_logs` fiyat sütunu (`unit_cost`) mutfak ekranında gösterilmez; mutfak rolüne ayrı bir view (`v_kitchen_today`, `security_invoker`) önerilir.

##### 10. Aşamalı geçiş (özet)
1. Token değerleri (`:root`, dark) + `.tc-num` + `.tc-card` radius → görsel olarak tüm uygulama güncellenir, kod değişmez.
2. `Pill` 13px, `Button` 44px, `Tabs` 44px; `accent` buton → primary.
3. Yeni bileşenler: `Dialog/useConfirm`, `Combobox`, `Stat`, `SaveBar`, `DataTable`; `window.confirm` çağrıları tek tek değiştirilir.
4. Kabuk: üst bar + mobil alt sekme çubuğu; kenar çubuğu tek satır.
5. Ekranlar: Reçete → Siparişler (+ mobil kart) → Bugün → Mutfak modu.
6. Hologram hareket katmanı (yalnız CSS + `usePresence`).
7. Bildirim/sohbet (YENİ tablolar, migration ayrı PR).



---

## 7) Veri içe aktarma (veri paketi: `claude-veri-paketi.zip`)
Paket içeriği (düz): `ana-stok-listesi.csv` / `.xlsx` (564 sade kanonik kalem + es_anlamlar + KDV), `yemek-listesi.csv` / `.xlsx` (331 yemek adı, kategori = recipe_categories kodu, ogun = kahvalti|ogle|aksam), `ice-aktarim-ornegi.sql`, `README.md`. Kullanıcı bu dosyaları repoda `supabase/seed/` (veya `data/`) altına koyacak; yoksa kullanıcıdan iste ama beklemeden diğer işlere devam et. Yükleme Faz 3E-0b'de, dev ortamda, idempotent `stg_stok` → `ingredients` + `ingredient_aliases` akışıyla yapılır. Reçeteler yalnız adla açılır, içerik mutfakta gerçek üretimden girilir (§3.3).


### 7.1 Veri paketi README
> Kaynak: `stok-datasi/README.md` satır 1–son (birebir alıntı; başlık seviyeleri düşürüldü).

#### Ana Stok Listesi ve Yemek Adı Listesi — Trakya Catering

Bu klasördeki listeler ERP'ye toplu yüklenmek için hazırlanmış bir **iskelettir**. Stok ve yemek adları sade tutuldu. Faturalarda karşılaşılan farklı yazımlar yalnız `es_anlamlar` sütununda yer alır. Adlar uygulamadan sonradan değiştirilebilir. Hiçbir şey veritabanına yazılmadı.

##### Dosyalar
| Dosya | İçerik |
|---|---|
| `ana-stok-listesi.csv` / `.xlsx` | 564 stok kalemi (xlsx'te "Özet" sayfası var) |
| `yemek-listesi.csv` / `.xlsx` | 331 yemek adı: yalnız ad, kategori ve öğün (malzeme yok) |
| `ice-aktarim-ornegi.sql` | İçe aktarma ve takma ad eşleştirme taslağı (**çalıştırılmadı**) |
| `kaynak/` | İndirilen kaynaklar: İzmir hal bültenleri (JSON), şartname ve KDV kararı (PDF ve metin) |
| `src/` | Listeyi üreten betik (`build.py`, `rename.py`, `items_*.txt`, `yemekler.txt`) |

##### Stok listesi sütunları
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

###### Kategori dağılımı (564)
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

##### Kaynaklar (gerçekten kullanılanlar)
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

##### KDV oranları nasıl belirlendi
Karar md.1'e göre: (I) sayılı liste %1, (II) sayılı liste %10, listelerde yer almayanlar %20.
- **%1:** (I) sayılı listenin A bölümü; GTİP 2, 3, 4, 7–12, 15–21. fasıllar (et, balık, süt, yumurta, sebze-meyve, bakliyat, un, yağ, şeker, kakao, unlu mamul, konserve, sos). Ayrıca 22.01 su, 2501 tuz ve B-2/B-3 bentleri (kimyon, kekik, susam, bulgur, pirinç…).
- **%10:** gazlı içecekler (kola, gazoz). Karar md.1/(3) uyarınca, ÖTV'ye tabi olduğu varsayımıyla. LPG tüp ve dökme LPG ((II) sayılı liste 31. sıra; otogaz hariç).
- **%20:** temizlik, hijyen, ambalaj, servis malzemesi, akaryakıt, kömür (listelerde yok).
- **Boş (teyit gerekli):** karbonat, limon tuzu, jelatin, gıda boyası, vanilin, meyveli soda, soğuk çay, şalgam, limonata. Bu ürünlerin GTİP'i veya ÖTV durumu ürüne göre değişir.
- Uyarı: oran ürünün GTİP'ine ve teslim şekline bağlıdır; son kontrol muhasebeciye aittir. İçe aktarmada boş KDV şema varsayılanı olan %1'e düşer; bu satırları yükleme sonrası düzeltin.

##### Yemek listesi
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

##### İçe aktarma kuralı (özet)
1. Kanonik ad sabittir. Faturadaki ürün mevcut bir stoğa eşleşirse o stoğa yazılır, stok güncellenir ve tedarikçi etiketi (parti / `supplier_id`) kaydedilir.
2. Eşleşme sırası: önce tedarikçiye özgü takma ad, sonra genel takma ad, sonra benzerlik önerisi (pg_trgm; kullanıcı onaylar). Onaylanan yazım yeni takma ad olur, bir sonraki faturada otomatik eşleşir.
3. Hiç eşleşme yoksa yeni stok oluşturulur (`diger` kategorisi ve "gözden geçir" notuyla), fatura yazımı takma ad olarak eklenir.
4. Ayrıntı ve SQL: `ice-aktarim-ornegi.sql`.



### 7.2 `ice-aktarim-ornegi.sql` (tam metin)

```sql
-- ============================================================================
-- Ana stok listesi içe aktarma + takma ad (alias) eşleştirme — ÖRNEK, ÇALIŞTIRILMADI
-- Hedef: Supabase gbuwcrajpbnjqwqrftgs, tablo public.ingredients (canlı şemadan okundu)
--   ingredients(code unique, name, category CHECK(12 değer), stock_unit FK units(code: g,kg,ml,lt,adet),
--               vat_rate numeric (yüzde; varsayılan 1), allergens text[] CHECK(14 AB alerjeni), notes, active ...)
-- Not: Canlı ingredients tablosu şu an boş (0 satır). Bu dosya Claude Code'un migration'ı için taslaktır;
--      migration olarak eklenmeli, SQL editöründe elle çalıştırılmamalıdır.
-- ============================================================================

-- 0) Yardımcı: Türkçe normalleştirme (büyük harf, aksan katlama, noktalama temizliği)
create extension if not exists unaccent;
create extension if not exists pg_trgm;

create or replace function public.norm_tr(p text) returns text
language sql immutable parallel safe as $$
  select btrim(regexp_replace(
           regexp_replace(
             translate(upper(replace(replace(coalesce(p,''),'i','İ'),'ı','I')),
                       'ÇĞİÖŞÜÂÎÛ','CGIOSUAIU'),
             '[^A-Z0-9%/,. ]+',' ','g'),
           '\s+',' ','g'))
$$;

-- 1) Takma ad tablosu (fatura satırı → kanonik stok)
create table if not exists public.ingredient_aliases (
  id            uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  alias_raw     text not null,                        -- faturadaki yazım aynen
  alias_norm    text generated always as (public.norm_tr(alias_raw)) stored,
  supplier_id   uuid references public.suppliers(id), -- null = tüm tedarikçiler için geçerli
  source        text not null default 'ana_liste' check (source in ('ana_liste','fatura','elle')),
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
-- Aynı normalize ad, aynı tedarikçi kapsamında tek stoğa gider
create unique index if not exists ingredient_aliases_uq
  on public.ingredient_aliases (alias_norm, coalesce(supplier_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists ingredient_aliases_trgm on public.ingredient_aliases using gin (alias_norm gin_trgm_ops);
create index if not exists ingredient_aliases_ing on public.ingredient_aliases (ingredient_id);
alter table public.ingredient_aliases enable row level security;
-- (RLS: okuma tüm personel; yazma yonetici/satinalma/depo/muhasebe — mevcut has_role yardımcılarıyla)

-- 2) Ambalaj birimleri (koli=12 adet, teneke=18 lt ...) — units tablosu yalnız g/kg/ml/lt/adet içerdiği için ayrı
create table if not exists public.ingredient_pack_units (
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  pack_label    text not null,          -- 'koli','kasa','teneke','cuval','bidon','paket','demet'...
  factor        numeric not null check (factor > 0),  -- 1 pack = factor × stock_unit
  supplier_id   uuid references public.suppliers(id)  -- tedarikçiye özgü koli içi farklı olabilir
);
create unique index if not exists ingredient_pack_units_uq
  on public.ingredient_pack_units (ingredient_id, pack_label, coalesce(supplier_id,'00000000-0000-0000-0000-000000000000'::uuid));

-- 3) Stok listesi için geçici tablo (CSV buraya yüklenir: Supabase Studio > Import CSV veya \copy)
create temporary table stg_stok (
  kod text, standart_ad text, kategori text, alt_kategori text, birim text,
  alternatif_birim text, donusum_katsayisi numeric, es_anlamlar text,
  kdv_orani numeric, alerjen text, kaynak text, "not" text
);
-- \copy stg_stok from 'ana-stok-listesi.csv' with (format csv, header true, encoding 'UTF8')

-- 4) Kanonik stokları ekle (varsa dokunma — idempotent; ad değişikliği uygulamadan yapılır)
insert into public.ingredients (code, name, category, stock_unit, vat_rate, allergens, notes)
select s.kod, s.standart_ad, s.kategori, s.birim,
       coalesce(s.kdv_orani, 1),                      -- boş KDV: şema varsayılanı; muhasebe teyidi notta
       coalesce(string_to_array(nullif(s.alerjen,''),'|'), '{}'),
       concat_ws(' · ', 'alt:'||s.alt_kategori, nullif(s."not",''), 'kaynak:'||s.kaynak)
from stg_stok s
on conflict (code) do nothing;

-- 5) Takma adlar (es_anlamlar pipe ile ayrılmış) — genel kapsam (supplier_id null)
insert into public.ingredient_aliases (ingredient_id, alias_raw, source)
select i.id, a.alias, 'ana_liste'
from stg_stok s
join public.ingredients i on i.code = s.kod
cross join lateral unnest(string_to_array(s.es_anlamlar,'|')) as a(alias)
where btrim(a.alias) <> ''
on conflict do nothing;

-- 6) Ambalaj birimleri
insert into public.ingredient_pack_units (ingredient_id, pack_label, factor)
select i.id, s.alternatif_birim, s.donusum_katsayisi
from stg_stok s join public.ingredients i on i.code = s.kod
where coalesce(s.alternatif_birim,'') <> '' and s.donusum_katsayisi > 0
on conflict do nothing;

-- 7) Fatura satırı eşleştirme (kural: kanonik ad sabit; aynı ürün → o stoğa yazılır + tedarikçi etiketi;
--    yeni ürün → oluşturulur). Önce tedarikçiye özgü alias, sonra genel alias, sonra benzerlik önerisi.
create or replace function public.match_ingredient(p_supplier uuid, p_text text)
returns table (ingredient_id uuid, match_kind text, score real)
language sql stable security invoker as $$
  with q as (select public.norm_tr(p_text) as t)
  (select a.ingredient_id, 'alias_tedarikci', 1::real
     from public.ingredient_aliases a, q where a.alias_norm = q.t and a.supplier_id = p_supplier limit 1)
  union all
  (select a.ingredient_id, 'alias_genel', 1::real
     from public.ingredient_aliases a, q where a.alias_norm = q.t and a.supplier_id is null limit 1)
  union all
  (select a.ingredient_id, 'benzerlik', similarity(a.alias_norm, q.t)
     from public.ingredient_aliases a, q
    where a.alias_norm % q.t
    order by similarity(a.alias_norm, q.t) desc limit 3)
$$;

-- 8) Fatura işleme akışı (RPC taslağı; tek transaction içinde):
--   a) match_ingredient → 'alias_*' ise doğrudan o ingredient_id.
--   b) yalnız 'benzerlik' (≥0.6) ise: kullanıcıya öneri göster; onaylanınca
--      insert into ingredient_aliases(ingredient_id, alias_raw, supplier_id, source) values (…, satır_adı, fatura.supplier_id, 'fatura');
--      → aynı yazım bir daha geldiğinde otomatik eşleşir.
--   c) hiç eşleşme yoksa / kullanıcı "yeni stok" derse:
--      insert into ingredients(code, name, category, stock_unit, notes) values (next_code(kategori), temizlenmiş_ad, coalesce(seçilen,'diger'), birim, 'faturadan oluşturuldu; gözden geçir')
--      + alias (source='fatura', supplier_id=fatura.supplier_id).
--   d) Stok girişi: stock_movements(kind 'giris', source 'fatura', source_id=fatura_satırı, unit_cost, qty × pack factor)
--      + (Faz 3E) stock_lots.supplier_id / purchase_invoice_id ile tedarikçi etiketi. Gider yalnız faturada bir kez.
--   e) Birim çevirisi: fatura birimi e-Fatura (UBL-TR) koduyla gelir: KGM→kg, GRM→g, LTR→lt, MLT→ml, C62→adet;
--      koli/paket gibi ambalajlar ingredient_pack_units.factor ile stock_unit'e çevrilir.
```


---

## 8) Fazlı plan, öncelikler ve kabul kriterleri


### 8.A Değişmez kurallar (her faz için)
> Kaynak: `notlar-analiz/claude-is-plani.md` satır 8–30 (birebir alıntı; başlık seviyeleri düşürüldü).

#### A. Değişmez kurallar (her faz için)

1. **Mevcut hiçbir özelliği bozma.** Her faz sonunda: `bun run lint` (tsc), `bun run test` (vitest), `bun run build` yeşil; `supabase/tests/*.sql` testlerinin hepsi geçer. Mevcut yollar (`/uretim`, `/kahvalti`, `/puantaj` …) yeni navigasyonda **yönlendirme** ile çalışmaya devam eder.
2. **Migration'lar yalnız ekleyici (additive):** `create table if not exists`, `add column if not exists`, yeni fonksiyon/görünüm. Mevcut kolon/tablo **silme veya yeniden adlandırma yok**. Davranış değişikliği gereken fonksiyonlarda imza korunur (`create or replace` aynı imza) ve eski davranışa bağlı testler güncellenir, silinmez. Veri dönüştürme gerekiyorsa aynı migration'da, geri alınabilir şekilde (eski kolon kalır).
3. **Migration numaralama:** Önce Faz 3A-0'daki sürüm kaymasını çöz. Sonra her yeni dosya `supabase/migrations/2026093012xxxx_<ad>.sql` ve sonrası (canlıdaki ve repodaki en büyük sürümden büyük). Uygularken MCP `apply_migration` adını dosya adıyla **aynı** ver; uyguladıktan sonra `list_migrations` ile sürümü doğrula ve gerekirse dosya adını canlı sürüme eşitle.
4. **Canlı DB'ye yazmadan önce:** değişikliği önce Supabase branch'inde (maliyeti `get_cost` ile kullanıcıya sor) veya `begin … rollback` testinde dene. Canlıya migration uygulamak için kullanıcıdan faz başına açık onay al.
5. **RLS her yeni tabloda zorunlu**, `using (true)` yasak. Politikalar `(select public.has_role(array[...]))` ve `(select auth.uid())` kalıbıyla yazılır (initplan). Her yeni tablo için 10 rolün (kurucu + 9 rol: `yonetici, asci_basi, diyetisyen, depo, satinalma, muhasebe, pazarlamaci, sofor, musteri`) okuma/yazma satırı bu belgedeki matrise göre tanımlanır; `musteri` varsayılan olarak **hiçbir** iç tabloya erişemez. Her yeni tabloya `log_audit` tetikleyicisi ve (varsa) `updated_at` tetikleyicisi.
6. **Finansa dokunan her kayıt** `finance_entries`'e tetikleyici/RPC ile yazılır (istemciden çift yazma yok). `finance_entries.source` check listesini genişletirken eski değerler korunur.
7. **Hesaplar veritabanında**: maliyet, stok, bakiye, kalibrasyon SQL görünümü/fonksiyonu olarak; istemcideki saf fonksiyonlar (`src/lib/*`) yalnız gösterim/önizleme için ve **testli**.
8. **Her faz için testler:** (a) `supabase/tests/<faz>.sql` — `begin; … rollback;` içinde rol simülasyonu (`set_config('request.jwt.claims', …)` + `set local role authenticated`) ile pozitif ve negatif RLS testleri; (b) `src/lib/*.test.ts` vitest birim testleri; (c) en az bir "uçtan uca" SQL senaryosu (bkz. supabase-kontrol.md §5 kalıbı).
9. **UX:** yeni modül açma — mevcut modüle **sekme** ekle (bkz. navigasyon tablosu). Her ekranda ModuleHero açıklaması, EmptyState yönlendirmesi, 390 px mobil kontrolü, Rapor + WhatsApp butonu (mevcut `ReportButton`). Türkçe, kısaltmasız, fiil ile başlayan buton adları.
10. **Uydurma veri yok** (PLAN ilkesi). Demo verisi yalnız `src/demo`.
11. Her faz sonunda: `generate_typescript_types` → `src/lib/database.types.ts`, `get_advisors` (security + performance) → yeni WARN yok; `docs/BACKLOG.md` ve `docs/PLAN.md` güncelle; tek, açıklayıcı Türkçe commit.
12. Dış servis anahtarı gereken işler (WhatsApp Business, Meta Graph, Google Directions, e-posta sağlayıcı, Arvento) 🔌 olarak işaretlenir; anahtarsız çalışan yedek yol (wa.me linki, Google Maps URL, elle giriş) **mutlaka** yapılır.
13. **Muhasebe kuralı (bağlayıcı, eslestirme.md §0.1):** hammadde/sarf gideri **yalnız tedarikçi faturasında bir kez** yazılır. Üretim, sevk ve fire yalnız stoktan düşer (FIFO parti) ve SMM/porsiyon maliyetini gösterir; `finance_entries`'e ikinci gider yazan hiçbir kod/tetikleyici eklenmez. Stok adları kanonik (`ingredients.name`); her giriş partisi `supplier_id` + belge (fatura/PO) etiketi taşır. Stok girişi tek kapıdan (mal kabulü veya fatura; ikincisi eşleştirir).
14. **Sürüm ve değişmezlik:** Maliyet, satınalma planı, onay ve denetim kayıtları **yıkıcı biçimde güncellenmez**. "Kaydet" = yeni sürüm satırı; eski sürümler arşivde okunur, iki sürüm arasında fark gösterilir; geri alma da yeni sürümdür. `audit_log` ve `approval_events` UPDATE/DELETE/TRUNCATE'e kapalı (tetikleyici + revoke), hash zinciriyle kurcalama tespiti.
15. **Onay:** `approval_policies`'te tanımlı işlemler (satınalma planı, maliyet düzenleme, eşik üstü gider/ödeme, modül kapatma, kullanıcı silme, hata düzeltme önerisi…) `request_approval` → `decide_approval` akışından geçer; talep eden kendi talebini onaylayamaz; talep anındaki veri `payload` olarak saklanır.
16. **Rol çalışma alanları yeni modül değildir:** `/` (Bugün) rolüne göre kart setini gösterir; kartlar ana modül verisini okur ve oraya götürür. Modül sayısı 14'ü aşmaz.
17. **Öğün boyutu (bağlayıcı):** Üç ayrı satılan hizmet vardır: `kahvalti`, `ogle`, `aksam` (şemadaki `gece` korunur, isteğe bağlı). Her birinin hazırlığı, üretimi, kişi sayısı, siparişi, üretim emri ve maliyeti ayrıdır. Sipariş, menü planı, müşteri menüsü, üretim emri, stok çıkışı (üretim kaynaklı), satınalma planı satırı, maliyet görünümleri ve genel gider dağıtımı `meal` sütunu taşır. Canlıda `menus`, `meal_orders`, `menu_plans`, `prep_batches` zaten `meal` içeriyor; yeni tablolar aynı CHECK değer kümesini kullanır (ortak domain `meal_service`).
18. **Reçete üretimden öğrenilir:** Reçete yalnız adla açılır (`yemek-listesi.csv` iskeleti). Malzeme ve miktar, mutfakta gerçek üretim kaydından türetilir: "X kişi üretildi, Y kullanıldı" → kişi başı kullanım = Y / X. Kişi başı malzeme maliyeti güncel stok maliyetiyle (FIFO parti / ağırlıklı ortalama) hesaplanır. Nihai öğün maliyeti = kişi başı malzeme maliyeti + o öğünün kişi sayısına dağıtılan genel gider payı. Matematiği ve dağıtım anahtarlarını Claude tasarlar (Faz 3H); kullanıcı yalnız niyeti tanımladı.

---



### 8.C Fazlar, öncelik sırası ve rapor şablonu
> Kaynak: `notlar-analiz/claude-is-plani.md` satır 74–son (birebir alıntı; başlık seviyeleri düşürüldü).

#### C. Fazlar (öncelik sırasıyla)

##### Faz 3A — Güvenlik, bütünlük ve temizlik (ÖNCE BU) · tahmini 1 oturum
**Amaç:** supabase-kontrol.md'deki kritik bulguları kapatmak; yeni geliştirmeye sağlam zemin.

0. **Migration sürüm kayması (M-1):** repo `supabase/migrations/*.sql` adlarını canlı `list_migrations` sürümleriyle eşleştir (ör. `20260926100000_core_security.sql` → `20260926165350_core_security.sql`). Dosya içerikleri değişmez. README'ye "migration'lar MCP ile uygulanır; dosya adı = canlı sürüm" notu.
1. Migration `…_security_fixes.sql`:
   - **S-1:** `employees_read` → `has_role(['yonetici','muhasebe']) or user_id = (select auth.uid())`. Yeni görünüm `v_employee_directory` (id, full_name, title, department, phone, active) — **security_invoker=false** olacağı için yalnız bu kolonlar ve `where public.is_staff()` filtresiyle; `revoke all … from anon`. `PersonnelPage`, `vehicles.driver_id` seçicileri ve kartvizit dışındaki tüm "personel adı" ihtiyaçları bu görünüme geçsin.
   - **S-4:** `team_members_insert/update` with check: `(role <> 'kurucu' or public.current_app_role() = 'kurucu') and (user_id <> (select auth.uid()) or public.current_app_role() = 'kurucu')`.
   - **S-2:** `meal_orders` BEFORE INSERT/UPDATE tetikleyicisi `enforce_portal_order()`: çağıran `musteri` ise `unit_price`, `vat_rate` müşteri kartından (Faz 3D sonrası `customer_menus`'tan), `delivered_qty := null`, `kind := 'sozlesmeli'`.
   - **S-3:** `employee_requests_self_insert` with check'e `status = 'bekliyor' and decided_by is null`.
   - **B-3 (muhasebe kuralına göre):** `create unique index if not exists stock_movements_src_uidx on stock_movements (source, source_id, ingredient_id) where source in ('fatura','siparis','hazirlik','uretim') and source_id is not null;` + `purchase_invoices.purchase_order_id uuid references purchase_orders(id)` + `stock_movements.supplier_id uuid references suppliers(id)` (girişlerde doldurulur; parti modeli Faz 3E'de). Fatura onayı: PO'ya bağlı ve teslim alınmışsa **stok girişi yok**, yalnız gider (tek sefer) + fiyat düzeltme; PO teslimi **asla** gider yazmaz; üretim/sevk **asla** gider yazmaz (bunu doğrulayan SQL testi ekle: bir fatura + PO teslimi + üretim senaryosunda `finance_entries` gıda gideri tam 1 kayıt).
   - **B-4:** `apply_ingredient_price` artık `avg_cost`'a dokunmasın (yalnız `last_price`, `price_updated_at`).
   - **B-5:** `stock_movements` UPDATE/DELETE yalnız `yonetici`; `sofor` INSERT yalnız `kind='sevk'` (ayrı politika).
   - **B-1:** `sync_order_entry`: teslimde `unit_price = 0` ise `raise exception 'Kişi başı fiyat girilmemiş: %', müşteri` (errcode 23514). `alerts.ts`'ye "fiyatsız sipariş" uyarısı.
   - `(select auth.uid())` düzeltmeleri (3 politika), 39 FK indeksi (liste: supabase-kontrol.md §3.3), `revoke truncate, trigger, references on all tables in schema public from anon, authenticated` + default privileges.
   - Realtime yayınına: `meal_orders`, `prep_batches`, `employee_ledger`, `stock_movements`.
   - **Denetim değişmezliği (erken):** `audit_log` için BEFORE UPDATE/DELETE tetikleyicisi (`raise exception 'Denetim kaydı değiştirilemez'`), `revoke update, delete, truncate on audit_log from public, anon, authenticated, service_role`; `prev_hash/hash` kolonları ve `log_audit()` içinde hash zinciri (pgcrypto `digest`). Mevcut 3 satır için zincir başlangıcı.
   - **Hata yakalama (erken, ucuz):** `error_events` tablosu + `log_client_error(jsonb)` RPC (authenticated, kullanıcı başına dakikada ≤20, PII maskeleme); `ErrorBoundary.componentDidCatch`, `window.onerror`, `unhandledrejection` ve `unwrap()` hataları bu RPC'ye gönderilir.
2. İstemci: `InvoicesPage` stok aktarımında `purchase_order_id` eşleşiyorsa stok girişini atla (yalnız fiyat farkı notu); `PurchasingPage.receive()` aynı kontrol.
3. Kullanıcıya hatırlat: Dashboard → Auth → "Leaked password protection" açılsın (MCP ile yapılamaz).
4. Testler: `supabase/tests/security_fixes.sql` — supabase-kontrol.md §5'teki `BUG` adımlarının **artık başarısız** olduğunu doğrula (S-1: şoför başkasının maaşını görmez; S-2: fiyat 250'ye zorlanır; S-3, S-4: 42501). Mevcut 6 test dosyası geçmeye devam eder.
**Kabul:** advisor security'de yeni WARN yok; tüm testler yeşil.

##### Faz 3B — Navigasyon sadeleştirme (30 → ~14 modül) · 1 oturum
1. `modules.ts`: `ModuleDef`'e `tabs?: {id,label,roles?}[]` ve `aliases?: string[]` (eski yollar). eslestirme.md "Önerilen sade navigasyon" tablosunu uygula. `activeModule()` eski yolları yeni modül+sekmeye çevirsin (`/kahvalti` → `/uretim?ogun=kahvalti`, `/puantaj` → `/personel#puantaj`, `/tedarikciler` → `/cari#tedarikciler`, `/hammaddeler` → `/stok#hammaddeler`, `/menu-plani` → `/menuler#plan`, `/giderler` → `/finans#giderler`, `/gelen-faturalar` → `/finans#faturalar`, `/cek-senet` → `/kasa#cek`, `/ekip` & `/kurucu` → `/ayarlar#…`).
2. Sayfa bileşenleri **taşınmaz**, yalnız sekme kabuğu (`ModuleTabs`) içinde render edilir; mevcut sayfa içi sekmeler (Stok: durum/hareket/sayım) korunur.
3. `role_permissions.module` artık `'/finans'` veya `'/finans#faturalar'` kabul eder; FounderPage matrisi sekme düzeyi gösterir. Tablo şu an boş (canlıda 0 satır) → veri taşıma gerekmiyor; yine de migration eski anahtarları yeni anahtara çeviren `update` içersin (idempotent).
4. **Rol çalışma alanı kabuğu:** `DashboardPage` → `Workspace` bileşeni; `src/app/workspaces.ts` her rol için kart listesi (kart = başlık, veri sorgusu, hedef modül#sekme). İlk sürümde mevcut verilerle: yönetici (mevcut özet), aşçıbaşı/diyetisyen (yarının üretimi, reçetesiz yemekler), depo (kritik stok, bugünkü çıkışlar), satınalma (aylık ihtiyaç özeti), muhasebe (vadesi gelenler, onaylanmamış fatura), pazarlamacı (açık teklifler), şoför (bugünkü rota — Faz 5'e kadar "yakında"), İK (bugün gelmeyenler). Sonraki fazlar kart ekler. Yönetici/kurucu için `Özet · Onaylar` sekmeleri (Onaylar içeriği Faz 3C-0).
5. Testler: `modules.test.ts` — her rol için görünür modül/sekme listesi (snapshot), eski yol yönlendirmeleri; `workspaces.test.ts` — her rolün kart seti.
**Kabul:** Menüde ≤15 öğe; eski yer imleri açılıyor; 390 px'te yatay taşma yok.

##### Faz 3C-0 — Onay merkezi, değişmez kayıt ve sürüm altyapısı (istek 19, 20'nin temeli) · 1 oturum
1. Migration `…_approvals_versioning.sql`: `approval_policies` (seed: `satinalma_plani` → yonetici; `maliyet_duzenleme` → yonetici; `gider`/`odeme` eşik 20.000 ₺: altı muhasebe, üstü yonetici; `modul_kapat`, `kullanici_sil`, `bug_fix` → kurucu; `stok_duzeltme` → yonetici; `izin`/`avans` → yonetici/ik), `approval_requests`, `approval_events` (yalnız ekleme, hash zinciri, UPDATE/DELETE tetikleyiciyle yasak), RPC `request_approval`, `decide_approval` (SECURITY DEFINER; talep eden ≠ onaylayan; rol/eşik kontrolü; karar `approval_events`'e ve `audit_log`'a), `list_my_approvals()`.
2. Genel sürüm deseni (yardımcı): sürüm tablolarında `version_no` (plan başına artan, `unique(parent_id, version_no)`), `based_on_version_id`, `created_by`, `created_at`; BEFORE UPDATE/DELETE → exception (yalnız `status` alanı `taslak→onay_bekliyor→onaylandi→arsiv` geçişine izin veren dar istisna). Ortak fonksiyon `forbid_mutation()`.
3. UI: Bugün > `Onaylar` (yönetici/kurucu): bekleyenler listesi (tür, tutar, talep eden, zaman), detayda `payload` önce/sonra farkı, Onayla/Reddet + not (red için not zorunlu), geçmiş (filtre, CSV, mühürlü rapor). Başlıkta onay rozeti (realtime). Diğer rollerin çalışma alanında "Taleplerim" kartı. Mevcut akışlara ilk bağlantılar: izin/avans talebi (`employee_requests`) karar → `decide_approval`.
4. Testler: `supabase/tests/approvals.sql` — talep eden kendi talebini onaylayamaz (42501); eşik altı/üstü rol ayrımı; `approval_events`/`audit_log` UPDATE/DELETE → exception (service_role dahil); hash zinciri doğrulaması `verify_audit_chain()` true; bir kaydı el ile bozunca false.
**Kabul:** Onaylar sekmesi çalışıyor; denetim kayıtları değiştirilemiyor.

##### Faz 3C — Üretim emri akışı + gramaj kalibrasyonu (istek 1, 2, 4) · 2 oturum
1. Migration `…_production_orders.sql`:
   - `production_orders` (id, prod_date, meal, status `taslak|kontrol|onaylandi|uretildi|kapandi|iptal`, total_people, planned_cost, actual_cost, anomalies jsonb default '[]', checked_by/at, approved_by/at, closed_by/at, note; unique (prod_date, meal)).
   - `prep_batches.production_order_id uuid references production_orders(id) on delete set null`, `prep_batches.recipe_snapshot jsonb`.
   - `recipe_calibrations` (id, recipe_id, ingredient_id, prep_batch_id, prep_date, portions, used_qty_base, per_portion_base generated always as (used_qty_base/portions) stored, included bool default true, reason text, created_by, created_at; unique (prep_batch_id, ingredient_id)).
   - `recipe_ingredients` ek: `calib_qty`, `calib_n int default 0`, `calib_cv numeric`, `calib_updated_at`, `calib_mode text default 'otomatik' check in ('manuel','otomatik','kilitli')`.
   - `recipe_ingredients.sub_recipe_id` (yarı mamul, XOR ingredient_id) — **opsiyonel, zaman kalırsa**; yapılırsa `v_recipe_lines` özyinelemeli (derinlik ≤3) ve testli.
   - RPC'ler (SECURITY INVOKER): `po_build(date, meal)` (mevcut `plan_prep_from_orders` + `prep_fill_from_recipe`'i çağırır, emri oluşturur/günceller), `po_check(id)` (anomali kuralları: reçetesiz yemek, fiyatsız malzeme, stok yetersiz, planlanan kg kalibrasyon medyanından ±%25 sapma, kesim sonrası sipariş değişikliği) → `anomalies`, status `kontrol`; `po_approve(id)` (rol: yonetici, asci_basi; anomali varsa `p_force boolean` + not zorunlu); `po_close(id)` (tek transaction; **gider yazmaz** — §0.1: gerçek miktarlardan FIFO parti tüketen `stock_movements` kind `cikis` source `uretim` — daha önce `hazirlik` ile düşülmüş batch'leri atla —, `recipe_calibrations` satırları, `recalibrate_recipe()` çağrısı, `actual_cost`, status `kapandi`).
   - `recalibrate_recipe(recipe_id)`: son 10 dahil kaydın porsiyon ağırlıklı medyanı; medyandan ±%30 sapanlar `included=false, reason='aykırı'`; `calib_mode='otomatik'` ise `net_qty = medyan × (1 − fire%)`; `calib_n`, `calib_cv` güncelle; `recipe_cost_snapshots`'a satır.
   - `recipe_from_prep()` **imzası korunur**, davranışı: kalibrasyon kaydı yaz + `recalibrate_recipe` (reçete yoksa eskisi gibi oluştur). `prep_batch_flow.sql` testini buna göre güncelle.
   - `finance_entries.source` check'e `uretim` ekleme **yok** (tüketim deftere yazılmaz; yönetim raporu).
2. UI (Üretim modülü sekmeleri): `Günlük üretim` (mevcut PrepPage; "stoktan düş" butonu `po_close`'a yönlenir), `Üretim emri` (durum çubuğu taslak→kontrol→onay→kapandı; anomali listesi; firma × menü × sunum × kişi dağılımı; mevcut Üretim Emri raporu buradan yazdırılır), `Kalibrasyon` (yemek seç → günler tablosu: kişi, toplam kg, g/kişi, dahil/hariç anahtarı; mini grafik; "Reçeteye uygula"/"Kilitle"). Mutfak Ekranı'na "Toplam kullanılan gir" büyük form (1200 kişi · Tas Kebap · Et 100 kg).
3. Testler: `supabase/tests/production_orders.sql` — 1200 kişi/100 kg → 75 g net (fire %10) örneği; ikinci gün 900 kişi/70 kg → medyan; aykırı (3×) değer hariç tutulur; `po_close` iki kez çağrılınca stok iki kez düşmez; RLS: depo onaylayamaz, diyetisyen kontrol edebilir. Vitest: kalibrasyon önizleme fonksiyonu `src/lib/calibration.ts`.
**Kabul:** Sipariş → emir → kontrol → onay → kapanış tek akışta; stok ve reçete güncelleniyor; eski "Günlük Hazırlık" kullanımı bozulmadı.

###### Faz 3C ek — 1 kişilik reçete, ölçekli iş emri ve basılı üretim raporu (4. tur kullanıcı isteği)
**Niyet (kullanıcı):**
- Reçete bir kez oluşturulur ve süresiz kullanılır. İlk üretimde mutfak, o üretimin kişi sayısı için gerçek miktarları girer. Sistem arka planda 1 kişilik miktarları hesaplar ve reçeteyi **1 kişilik** olarak kaydeder.
- Menüler 1 kişi için tanımlıdır. Sipariş sayıları menüyü ölçekler. Sonuç üretimhaneye gider: her malzemenin o günün sayısı için kaç kg gerektiği.
- Üretimhanede reçetenin yapılış bilgisi de durur: işlem adımları, doğrama biçimleri, saklama kapları. Bu bilgi **iş emri** olarak yazılır.
- İş emri mutfak için basılı kâğıt rapor olur. Rapor HTML'dir, A4'e uygun yazdırılır, kurumsal şablon ve logo taşır. Firma bazında müşteri sayılarını ve kap türlerini (3 bölmeli kap / küvet) öğün bazında (kahvaltı/öğle/akşam) gösterir.

**Tasarım (Claude uygular):**
1. **Reçete = 1 kişi (tek doğruluk kaynağı):**
   - `recipe_ingredients.qty_per_person` (stok biriminde, net) + `waste_pct`; brüt = net ÷ (1 − fire). `recipes.base_portions` her zaman 1'dir.
   - İlk üretim akışı: `recipe_from_first_production(recipe_id, people X, items[{ingredient_id, qty Y}])` → qty_per_person = Y ÷ X. Hesap görünmez, arka planda yapılır; kullanıcıya yalnız "1 kişi: 85 g" önizlemesi gösterilir. Reçete sürüm 1 olarak kaydedilir (kural 14). Sonraki üretimler reçeteyi değiştirmez, yalnız kalibrasyon önerisi üretir (3H; onaylı yeni sürüm).
   - Birim çevirisi `units.to_base` ile yapılır. Adetli malzemeler (yumurta, ekmek) yuvarlanmadan saklanır, yalnız iş emrinde yukarı yuvarlanır.
2. **Menü = 1 kişi, ölçekleme:**
   - `menus/menu_items` kişi sayısı taşımaz. Gün × öğün × müşteri × menü sipariş sayısı N ise her malzeme için ihtiyaç = Σ(N × qty_per_person × brüt katsayı) olur.
   - `po_build(date, meal)` sonuçları kanonik stok adıyla toplar: `production_order_lines` (ingredient, toplam net/brüt kg, stok mevcudu, eksik) ve `production_order_recipes` (yemek, toplam kişi, firma dağılımı).
   - Yuvarlama: kg 0,1; adet yukarı.
3. **Yapılış bilgisi (üretimhane):**
   - `recipe_steps`: recipe_id, sıra, istasyon (hazırlık/pişirme/soğuk/paketleme), adım metni, süre dk, sıcaklık °C, kritik kontrol noktası bayrağı.
   - `recipe_ingredient_prep`: satır başına doğrama biçimi (`cut_styles` sözlüğü: küp, julyen, halka, yarım ay, rende, kıyım, brunoise, bütün…), yıkama/ön işlem notu.
   - `recipe_storage`: saklama kabı türü (`container_types`: GN 1/1, 1/2, 1/3, küvet derinliği, termobox, 3 bölmeli kap, çorba kasesi), saklama sıcaklığı, raf ömrü.
   - Tablolar reçete sürümüne bağlıdır ve reçeteyle birlikte sürümlenir.
4. **İş emri (work order):**
   - `work_orders`: production_order_id, meal, istasyon, durum, sorumlu, basım sayısı, printed_at.
   - İş emri, emir onayında (`po_approve`) otomatik oluşur ve üretim emrinin **öğün bazlı** kopyasıdır (kahvaltı, öğle ve akşam ayrı iş emirleri).
   - İçerik anlık görüntü (`snapshot jsonb`) olarak dondurulur: yemek listesi, malzeme × kg, adımlar, doğrama biçimleri, saklama kapları, firma bazlı kişi sayıları ve kap sayıları. Basıldıktan sonra değişiklik yeni revizyon demektir; eski revizyon arşivde kalır.
5. **Kap türü ve firma sayıları:**
   - `customer_menus.serving_type` (`tabla` = 3 bölmeli kap / `kuvet` / `karma`) ve kap kuralları (küvet kişi kapasitesi: ör. GN 1/1-100 mm = X porsiyon, yemek türüne göre `container_capacity`) kullanılır.
   - İş emrinde firma başına şu bilgiler bulunur: kişi sayısı, 3 bölmeli kap adedi (= kişi), küvet adedi ve türü (= ⌈kişi × porsiyon hacmi ÷ kap kapasitesi⌉), çorba kasesi, ekmek, servis seti.
   - Ambalaj ihtiyacı stoktan düşülecek sarf olarak da listelenir (kanonik stok adıyla).
6. **Basılı rapor (HTML, A4):**
   - Rota `/uretim/is-emri/:id/yazdir`, bileşen `WorkOrderPrint`. Mevcut rapor/antet altyapısı (`company_settings` logo, ad, adres) kullanılır.
   - `@page { size: A4; margin: 12mm }`, `@media print` stilleri, sayfa kırılımı: her istasyon veya yemek grubu yeni sayfada; tablo başlıkları her sayfada tekrar eder (`thead { display: table-header-group }`).
   - Siyah-beyaz dostu yazdırılır: renk yerine ikon ve kalın yazı. Büyük punto kullanılır (mutfakta okunur, ≥11pt); tarih, öğün ve iş emri numarası büyük gösterilir.
   - İçerik bölümleri:
     - (a) Başlık: logo, firma, iş emri no, tarih, öğün (KAHVALTI / ÖĞLE / AKŞAM), revizyon, basım zamanı;
     - (b) Özet: toplam kişi, yemek listesi;
     - (c) Firma × kişi × sunum (3 bölmeli kap / küvet) × kap adetleri tablosu, alerji/hassasiyet ⚠ satırları (18.2);
     - (d) Malzeme çekme listesi: kanonik ad, kg/adet, depo yeri, "alındı" onay kutusu;
     - (e) Yemek bazında adımlar, doğrama biçimleri, sıcaklık/süre, kritik kontrol noktaları;
     - (f) Saklama ve paketleme: kap türü ve adet, etiket bilgisi;
     - (g) İmza alanları: hazırlayan, aşçıbaşı, kalite kontrol, teslim alan.
   - "Yazdır" ve "PDF indir" (tarayıcı yazdırma) butonları bulunur. QR kodu, iş emrini uygulamada açar ve üretim kaydına (X kişi / Y kullanım) götürür.
7. **Testler:**
   - SQL: 1 kişilik reçete × 1200 = doğru kg; ilk üretimden 1 kişilik hesap (1200 kişi / 100 kg → 83,3 g net); öğün bazlı ayrı iş emri; basım sonrası değişiklik yeni revizyon.
   - Vitest: ölçekleme ve yuvarlama, küvet adedi hesabı.
   - Playwright: yazdırma sayfası A4'te taşmadan render oluyor (ekran görüntüsü karşılaştırması).
**Kabul:** Menüler 1 kişilik. Sipariş sayıları kg'lık iş emrine dönüşüyor. İş emri öğün bazında basılı A4 rapor olarak alınabiliyor.


**Rakip analizinden (§11) ekler:**
- [SHOULD] Geriye planlama: sevk saatinden başlama saati; kahvaltı hazırlığı önceki akşama; ortak alt reçeteyi (pilav, sos) tek partide birleştir, sonra firma/kap bazında böl (Galley).
- [SHOULD] HACCP: iş emrindeki KKN'lere sıcaklık ölçümü (çekirdek, soğutma, sevk), sınır dışı değerde düzeltici faaliyet kaydı, şahit numune kaydı. Sınırlar ayarlanabilir varsayılan (FoodDocs/Jolt).
- [SHOULD] A4 raporun yanında küvet/kap etiketi basılır: yemek, firma, öğün, üretim/son tüketim saati, alerjen (Jolt/Nutritics).

##### Faz 3D — Menü tipi, sunum şekli (tabla/küvet), müşteri menü tanımı, aylık sipariş, portal (istek 3, 12) · 2 oturum
1. Migration `…_menu_types_service_styles.sql`:
   - `menu_types` (code pk, name, course_count, sort, active) — seed: `3_cesit`, `4_cesit`, `5_cesit`, `kahvalti`, `diyet`.
   - `menus.menu_type_code text references menu_types(code)`; `menus.kind` aynen kalır.
   - `service_styles` (code pk, name, pack_mode `kisi_basi|kap_basi`, people_per_container int, active) — seed: `tabla_3goz` (3 gözlü tabla), `kuvet` (gastronom küvet), `sefer_tasi`.
   - `service_style_items` (style_code, ingredient_id (ambalaj stok kalemi, kategori `temizlik_sarf`), qty_per_person numeric null, qty_per_container numeric null).
   - `v_service_style_costs` (style → kişi başı ambalaj maliyeti; küvette `qty_per_container / people_per_container`).
   - `customer_menus` (id, customer_id, meal, menu_type_code, menu_id null, service_style, unit_price, vat_rate, valid_from, valid_to, is_default, active).
   - `meal_orders` ek: `customer_menu_id uuid references customer_menus(id)`, `service_style text references service_styles(code) default 'tabla_3goz'`, `source text default 'elle' check in ('elle','portal','aylik','kopya')`. BEFORE tetikleyici: `customer_menu_id` doluysa `unit_price`, `vat_rate`, `service_style` oradan (personel elle değiştirebilir; musteri değiştiremez — Faz 3A tetikleyicisiyle birleşir).
   - Unique slot index'ini **değiştirme**; yeni ek benzersizlik gerekiyorsa ayrı index (`… , coalesce(customer_menu_id,…)`) ve önce çakışma kontrolü.
   - `standing_orders` (id, customer_id, customer_menu_id, meal, period `YYYY-MM`, default_qty, weekday_qty jsonb, skip_dates date[], status `taslak|onayli`) + RPC `standing_order_generate(id)` (ay günleri için `meal_orders` üretir; var olanı ezmez; `source='aylik'`).
   - Portal: `portal_info_v2(token)` (tanımlı menüler, ay görünümü, günlük menü adı) ve `portal_set_order_v2(token, date, meal, qty, customer_menu_id, note)`; eski `portal_info/portal_set_order` korunur. Token'ı `customer_portal_tokens` tablosuna taşı (okuma: yonetici/muhasebe/pazarlamaci), `customers.order_token` geriye uyum için kalır ve senkron tutulur.
   - `plan_prep_from_orders` / `po_build`: firma × menü × sunum kırılımını `production_orders` detay görünümünde ver (`v_production_breakdown`).
2. UI: **Menüler** > Menü kartları: menü tipi seçimi; sunum şekline göre kişi başı maliyet (gıda + ambalaj) iki sütun. **Cari Hesaplar** > müşteri detay > `Menü tanımları` sekmesi (ekle/düzenle, geçerlilik tarihleri). **Siparişler** > `Günlük`: müşteri seçilince yalnız o müşterinin tanımlı menüleri; `Aylık sipariş` sekmesi: ay ızgarası (gün × firma), hafta içi şablondan doldur, tek gün düzelt. Portal sayfası: menü seçimi ve ay görünümü; Müşteriler'de "Linki kopyala / WhatsApp ile gönder".
3. **Müşteri hassasiyet & şikâyet (istek #18.2):** `customer_notes` (alerji/hassasiyet/dikkat/tercih; alerjen kodu 14'lü listeden), `customer_complaints` (kategori, önem, durum, çözüm, fotoğraf), `v_menu_allergen_conflicts`; `po_check` alerji çakışmasını anomali yapar; portal için `portal_report_complaint(token, …)` RPC. UI: Cari > müşteri detay > `Hassasiyetler & şikâyetler`; Siparişler, Üretim emri ve Şoför Ekranı'nda ⚠ rozeti + son şikâyet satırı.
4. Testler: `supabase/tests/customer_menus.sql` — tabla vs küvet maliyet farkı; aylık üretim 30 satır; portal v2 ile kesim sonrası değişiklik reddi; müşteri fiyat değiştiremez. Vitest: ay ızgarası yardımcıları.
**Kabul:** Üretim ekranında "hangi menü, hangi firma, kaç kişi, hangi sunum" görünür; aylık sipariş üret/düzelt çalışır.


**Rakip analizinden (§11) ekler:**
- [SHOULD] Menü alerjen matrisi reçetelerden otomatik türer ve stok değişince yenilenir. Müşteri hassasiyetiyle çakışırsa üretim emrinde kırmızı uyarı çıkar (Nutritics).
- [MUST] Müşteri × öğün (kahvaltı/öğle/akşam/ekstra) adet raporu, tarih aralıklı, Excel'e aktarılabilir (YemekPRO).
- [COULD] Portalda "geçen haftayı kopyala" ve değişiklik talebi logu (CaterTrax).

##### Faz 3E — Kanonik stok adları, tedarikçi etiketli stok partileri, fatura eşleştirme (istek 2, 11, muhasebe kuralı) · 2 oturum
0. Migration `…_stock_lots.sql` (§0.1): `stock_lots` (ingredient_id, supplier_id, purchase_invoice_id, purchase_order_id, received_on, qty_in, unit_cost, lot_no, expiry_date, qty_remaining, status, source `pok|fatura|acilis|sayim`; partial unique (purchase_invoice_id, ingredient_id) ve (purchase_order_id, ingredient_id)); `stock_movements.lot_id`, `purchase_invoice_id`, `purchase_order_id`; RPC `receive_stock(...)` (tek giriş kapısı: PO teslimi veya fatura; diğeri varsa eşleştirir, yeni parti açmaz; fatura sonradan gelirse parti `unit_cost` düzeltmesi + `avg_cost` yeniden hesap), `consume_stock(ingredient, qty, source, source_id)` (FIFO, parti yetmezse negatif stok uyarısı ve "partisiz çıkış" kaydı). Mevcut hareketler için "açılış partisi" dönüşümü (idempotent). İstemci: PurchasingPage, InvoicesPage, StockPage, SuppliesPage, PrepPage girişleri bu RPC'leri kullanır. Görünüm `v_stock_by_supplier` (kalem × tedarikçi × kalan). **Gider yazımı yalnız `sync_invoice_entry`'de kalır.**
0b. **Ana stok iskeletinin yüklenmesi:** `/workspace/stok-datasi/ana-stok-listesi.csv` (564 kalem; kategori ve birim canlı CHECK/FK ile uyumlu; `es_anlamlar` → `ingredient_aliases`; `alternatif_birim` → `ingredient_pack_units`). Taslak SQL: `/workspace/stok-datasi/ice-aktarim-ornegi.sql` (seed migration olarak, idempotent `on conflict do nothing`). Boş KDV satırları için muhasebe teyidi uyarısı gösterilir. Yemek adları (`yemek-listesi.csv`, 331) `recipes`'e yalnız ad + `category_code` ile yüklenir; öğün bilgisi `recipes.meals meal_service[]` alanına yazılır.
1. Migration `…_ingredient_aliases.sql`:
   - `create extension if not exists pg_trgm with schema extensions;`
   - `norm_tr(text)` immutable (küçük harf, Türkçe → ASCII, noktalama ve gürültü sözcükleri: kg, gr, lt, adet, ad, koli, pkt, 1.sinif, ekstra…).
   - `ingredient_aliases` (id, ingredient_id, supplier_id null, alias_raw, alias_norm, seller_item_code, unit_code, factor_to_stock numeric default 1, confirmed bool, created_by, created_at) + unique (coalesce(supplier_id, '00000000-…'), alias_norm) + GIN trigram index (`alias_norm`, `norm_tr(ingredients.name)` ifade indeksi).
   - RPC `match_invoice_line(p_supplier_id, p_raw, p_seller_code)` → en fazla 5 aday (ingredient_id, ad, skor, kaynak `kod|alias_tedarikci|alias_genel|benzerlik`).
   - RPC `confirm_alias(...)`, `merge_ingredients(keep_id, drop_id)` (yalnız yonetici; reçete, hazırlık, stok, fiyat, alias, teklif kayıtlarını taşır; `drop` pasiflenir; audit).
   - `ingredient_prices` ek: `supplier_id`, `purchase_invoice_id`, `invoice_line_no`; `source` check'e `teklif` ekle.
   - `purchase_invoices.supplier_id` + VKN ile doldurma (geçmiş kayıtlar için idempotent `update`).
   - `suppliers.default_category_code` (supplier_categories okunmaya devam; yeni yazımlar ikisine birden).
   - `purchase_order_lines` (po_id, ingredient_id, qty, unit_price, received_qty) — `purchase_orders.lines` jsonb okunmaya devam eder; yeni kayıtlar satır tablosuna (tetikleyiciyle jsonb senkron).
   - `purchase_requests` (id, supplier_id, po_id, channel `whatsapp|eposta|pdf`, sent_at, sent_by, message) — gönderim kaydı.
2. UI: Gelen Faturalar içe aktarma sihirbazı: satır → aday listesi (yeşil otomatik / sarı onay / kırmızı yeni); "Yeni hammadde aç" öncesi benzer 5 kalemi zorunlu göster. Stok > `Hammadde kartları` (eski /hammaddeler) kartında "Tedarikçi adları" ve "Fiyat geçmişi (tarih · fiyat · tedarikçi · belge · güncelleyen)". Satınalma sekmeleri: `Geçen ay` (günlük kişi sayısı tablosu + aylık toplam + tüketilen hammadde), `Bu ay ihtiyaç` (mevcut), `Talepler & siparişler` (mevcut + "Talep gönder": PDF/WhatsApp/e-posta; en uygun fiyat kupası satırda). Ayrı "En uygun fiyat" sekmesi kaldırılır (içerik satıra ve hammadde kartına taşınır).
3. Testler (parti): fatura + PO teslimi aynı mal → tek parti, tek gider kaydı; üretim çıkışı FIFO (eski parti önce), sevk çıkışı müşteri etiketli ve **gider yazmaz**; `v_stock_by_supplier` doğru.
4. Testler: `supabase/tests/ingredient_aliases.sql` — "DANA KUŞBAŞI 1.SINIF KG" → "Dana kuşbaşı" eşleşir; aynı tedarikçide ikinci faturada otomatik; merge sonrası reçete maliyeti değişmez; fatura+PO çift stok girişi engellenir. Vitest: `norm_tr` istemci eşleniği.
**Kabul:** Aynı ürün ikinci faturada elle eşleştirme istemiyor; kopya hammadde açılamıyor (onaysız).


**Rakip analizinden (§11) ekler:**
- [MUST] Önce e-Fatura UBL-TR XML içe aktarma; satır başına eşleşme güven skoru, düşük skor inceleme kuyruğuna. Kâğıt/PDF için OCR/LLM 🔌 COULD (MarketMan/R365 Capture AI).
- [MUST] "Düzensiz fiyat" listesi: PO, teklif ya da son alıştan eşik üstü sapma (varsayılan %3) → kabul/red (onay + audit), red durumunda iade/fark talebi. PO ↔ mal kabul ↔ fatura 3 yönlü eşleştirme; aylık "fiyat değişiminin SMM etkisi" raporu (MarketMan/R365/Procurement Partners).
- [MUST] Tedarikçiye göre ayıklama verimi (brüt → net testi). Teklif karşılaştırmasında gerçek birim maliyet = fiyat ÷ verim (StarChef).
- [SHOULD] Lot geri izleme raporu: tedarikçi partisi → üretim → firma/öğün (Apicbase traceability).

##### Faz 3F — Maliyet sekmesi (gün/ay/yıl) ve menüden otomatik, sürümlü satınalma planı + teklif analizi (istek 20, 18.4) · 2 oturum
1. Migration `…_cost_purchase_plans.sql`:
   - Görünümler `v_cost_daily` (gün × öğün: kişi, tüketim maliyeti (üretimden), ambalaj, gelir), `v_cost_monthly` (+ personel, işletme, araç, genel gider payı, kişi başı tam maliyet, marj; fatura gideri ile tüketim farkı = stok değişimi), `v_cost_yearly`.
   - `cost_versions` + `cost_version_lines` (scope `gun|ay|yil`, period_key, version_no, source `otomatik|duzenleme`, based_on_version_id, kalem kodu, auto_value, value, note, status, approval_request_id) — değişmez sürüm satırları (`forbid_mutation`).
   - `purchase_plans`, `purchase_plan_versions`, `purchase_plan_lines` (auto_qty/auto_price ile elle değer yan yana, `changed`), RPC `generate_purchase_plan(period, basis)` = gelecek ayın `menu_plans` × **geçen ayın** gün/öğün/firma ortalama kişi (+ `standing_orders`) × kalibre brüt (+ ambalaj) − beklenen stok − açık PO; fiyat = geçerli en uygun teklif (marka tercihine uygun) yoksa son alış. Sonuç sürüm 1 (otomatik). `save_purchase_plan_version(plan_id, based_on, lines jsonb, note)` → yeni sürüm; `submit`/onay → `current_version_id`; `plan_to_purchase_orders(version_id)` (yalnız onaylı sürümden).
   - Teklif analizi: `supplier_quotes` ek (`brand`, `pack_size`, `pack_unit`, `min_qty`, `valid_until`, `quote_file_id`), `quote_files` (Excel içe aktarma + alias eşleştirme; PDF 🔌), `ingredient_brand_prefs`, `v_quote_analysis` (birim fiyata normalize, marka), `v_purchase_savings` (gerçekleşen fatura satırı × (referans − ödenen); referans = dönem teklif medyanı veya önceki alış).
2. UI: **Finans > Maliyet** (Gün/Ay/Yıl anahtarı, grafik + tablo, "Düzenle → Yeni sürüm kaydet", "Onaya gönder", Sürüm geçmişi, iki sürüm farkı, "bu sürümden yeni sürüm"). **Satınalma > Satınalma planı** (Menüden oluştur, satır düzenle, Yeni sürüm kaydet, Onaya gönder, Sürüm geçmişi/fark, Siparişe dönüştür), `Teklifler & analiz`, `Tasarruf`. Satınalma çalışma alanı kartları: plan durumu, süresi dolan teklifler, bu ay tasarruf.
3. Testler: `supabase/tests/cost_purchase_plans.sql` — plan oluştur → düzenle → 3 sürüm; eski sürüm satırını UPDATE → exception; fark sorgusu doğru; yalnız onaylı sürümden PO; `audit_log`'da her sürüm için actor + diff; maliyet sürümü muhasebe kayıtlarını değiştirmez; tasarruf hesabı bilinen örnekle. Vitest: sürüm fark fonksiyonu, birim normalizasyonu.
**Kabul:** Yönetici maliyet ve satınalma planını düzenleyip kaydedebiliyor; her kayıt yeni sürüm; eski sürümler okunabilir ve karşılaştırılabilir; tüm değişiklikler kim/ne zaman/önce-sonra ile loglu.


**Rakip analizinden (§11) ekler:**
- [SHOULD] Menü dışı kalemler (ambalaj, 3 bölmeli kap, temizlik, yan malzemeler, LPG) için min/par seviyesi; satınalma planında "par'a tamamla" sütunu (MarketMan).
- [SHOULD] Kişi tahmini: müşteri × öğün × hafta günü için son 8 haftanın ağırlıklı ortalaması + tatil bayrağı; tahmin/fiili hata oranı raporu (Crunchtime/Galley).
- [SHOULD] Tedarikçiye tokenlı teklif formu linki; gelen teklifler marka × fiyat × verim karşılaştırmasına ve tasarruf raporuna düşer (Çözbim E-Talep).

##### Faz 3G — Kurucu paneli: hesap, kullanıcılar, modüller (istek 17 — Hata Merkezi botu Faz 8B'de) · 1 oturum
1. Migration `…_founder_admin.sql`: `team_members` ek (`phone`, `restricted_until`, `read_only`, `is_lead`), `current_app_role()` kısıtlı kullanıcıda null; yazma yardımcıları `can_write(roles)` (read_only ise false) — yeni politikalar bunu kullanır, eski politikalar kademeli geçirilir (davranış testleriyle); `app_modules` + `module_enabled(code)`; modül tablolarının yazma politikalarına modül kontrolü (kapalı modül okunur, yazılmaz; veri silinmez).
2. Edge Function `admin-users` (service role yalnız fonksiyonda; çağıran kurucu doğrulaması): kullanıcı sil / engelle (`ban_duration`) / engeli kaldır / parola sıfırlama linki; kullanıcı silme ve modül kapatma `approval_policies`'e göre kurucu onayı + `audit_log`.
3. UI: **Ayarlar** sekmeleri `Hesabım` (ad, telefon, e-posta, parola — `auth.updateUser`), `Kullanıcılar` (davet, rol, kısıtla, salt-okur, sil), `Modüller` (aç/kapat, neden), `Yetkiler` (mevcut). 
4. Testler: kısıtlı kullanıcı hiçbir tabloyu okuyamaz; read_only okur ama yazamaz; kapalı modülde insert → 42501; son kurucu silinemez (mevcut guard).

##### Faz 3H — Üretimden öğrenen reçete ve öğün bazlı maliyet (kullanıcı maliyet mantığı) · 2 oturum
**Kullanıcının tarif ettiği niyet (değiştirilmeyecek):**
1. Reçete adla açılır; malzeme ve miktar mutfakta gerçek üretimden girilir.
2. "X kişi üretildi, Y kullanıldı" → kişi başı kullanım = Y/X; kişi başı maliyet güncel stok fiyatından.
3. Nihai öğün maliyeti = kişi başı malzeme + tüm işletme giderlerinin o öğünün sayısına düşen payı.
4. Kahvaltı, öğle ve akşam ayrı ayrı hazırlanır, üretilir, sayılır, sipariş edilir ve maliyetlenir; genel gider de öğün bazında dağıtılır.

**Claude'un tasarlayacağı model (öneri; gerekçesiyle birlikte uygulanır):**
1. Migration `…_meal_service_costing.sql`:
   - `create domain meal_service as text check (value in ('kahvalti','ogle','aksam','gece'))`. Yeni tablolar bunu kullanır. Mevcut CHECK'ler bozulmaz, yalnız eşdeğer tutulur.
   - `meal` sütunu eklenir: `production_orders` (Faz 3C) ve satırları, `customer_menus` (3D, müşteri × öğün × gün), `purchase_plan_lines` (3F), `cost_version_lines` (3F). Ayrıca `stock_movements`'a nullable `meal`: üretim/sevk çıkışlarında zorunlu (tetikleyiciyle), girişte null.
   - **Üretim kaydı = reçete öğrenme verisi:** `production_runs` (üretim emri satırı veya prep_batch; recipe_id, service_date, meal, produced_portions X, served_portions, leftover_portions) ve `production_run_items` (ingredient_id, qty_used Y, unit; stok çıkışını `consume_stock` ile yapar ve FIFO maliyetini `unit_cost_used` olarak dondurur).
   - **Kişi başı norm:** `v_recipe_usage_observed` her (recipe, ingredient) için son N üretimden kişi başı kullanımı hesaplar: toplam Y / toplam X, yani porsiyon ağırlıklı ortalama. Aykırı değerler (medyan ± 3·MAD) dışarıda bırakılır. Kalibrasyon (3C) bu görünümden `recipe_ingredients.qty_per_portion` için **öneri** üretir. Kabul yöneticinin onayıyla ve sürümlü yapılır (kural 14), otomatik üzerine yazma olmaz. Reçetesi hiç olmayan yemek ilk üretimde oluşan kayıtla "taslak reçete" kazanır.
   - **Kişi başı malzeme maliyeti:** Gerçekleşen maliyet = Σ(qty_used × unit_cost_used) / X (üretim anındaki FIFO). Planlanan maliyet = Σ(norm × güncel maliyet); güncel maliyet son parti fiyatı ya da ağırlıklı ortalama olabilir, seçim ayardan yapılır. İkisi yan yana gösterilir; aradaki fark fiyat ve verim sapmasıdır.
   - **Genel gider dağıtımı (öğün bazlı):** Dönem gideri `finance_entries`'ten gelir, hammadde hariç (hammadde zaten malzeme maliyetinde; kural 13, çift sayım yok). Sırayla:
     (a) **Doğrudan öğüne atanabilen gider**, öğüne atanır. Bunun için `finance_entries.meal` alanı nullable eklenir; örnek: yalnız kahvaltı ekibinin mesaisi, kahvaltı ambalajı.
     (b) **Ortak gider** havuzlara ayrılır ve her havuz kendi anahtarıyla öğünlere dağıtılır:
        - personel: öğün başı hazırlık/üretim saati; puantajda öğün alanı yoksa kişi sayısı × öğün ağırlığı;
        - enerji (LPG, elektrik): pişirme süresi veya üretilen porsiyon;
        - lojistik: sefer ve km (`routes`/`vehicle_logs`'ta `meal` varsa), yoksa porsiyon;
        - ambalaj/sarf: fiili tüketim (stok çıkışı öğün etiketli);
        - kira, amortisman, yönetim: porsiyon eşdeğeri. Varsayılan ağırlıklar kahvalti 0,6 · ogle 1,0 · aksam 1,0; ayardan değiştirilebilir, sürümlü.
     (c) Öğün payı ÷ o öğünün dönemde teslim edilen (faturalanan) kişi sayısı = **kişi başı genel gider**. Payda seçilebilir (teslim / sipariş / üretilen); varsayılan teslim edilen.
     (d) **Nihai kişi başı maliyet** (gün × öğün × müşteri menüsü) = kişi başı malzeme (gerçekleşen) + kişi başı genel gider (ay içinde henüz kapanmamış giderler için bütçe/tahmin, ay kapanışında gerçekleşen, sürümlü). Marj = satış fiyatı − nihai maliyet.
   - Görünümler: `v_meal_cost_daily` (gün × öğün × müşteri × menü: X, malzeme maliyeti, kişi başı), `v_overhead_allocation` (dönem × havuz × öğün × anahtar × pay), `v_meal_cost_monthly`, `v_meal_cost_yearly`. Finans > Maliyet (3F) bu görünümleri okur; ayarlar ve yönetici düzenlemeleri `cost_versions` üzerinden sürümlenir.
   - Dağıtım anahtarları tablosu `allocation_keys` (havuz, anahtar türü, öğün ağırlıkları, geçerlilik) sürümlüdür ve değişiklikleri `audit_log`'a düşer.
2. Öğün boyutunun uçtan uca taşınması: müşteri menü tanımı (öğün) → aylık sipariş (öğün) → menü planı (öğün) → üretim emri (öğün, ayrı hazırlık ve üretim listeleri) → üretim kaydı → stok çıkışı → sevk → maliyet → fatura. UI'da Siparişler, Üretim, Satınalma planı ve Maliyet ekranlarında `Kahvaltı · Öğle · Akşam` sekme/filtresi bulunur. Üretim emri her öğün için ayrı üretilir ve kahvaltının hazırlığı önceki akşam planlanabilir.
3. UI: Üretim ekranında "Üretim kaydı": yemek, öğün, üretilen kişi X, kullanılan malzemeler Y (terazi/birim, stoktan seçim; kanonik ad) → kaydet → stok düşer, kişi başı kullanım ve maliyet anında görünür. Reçete kartı "gözlenen norm / onaylı norm / son 10 üretim" gösterir.
4. Testler: `supabase/tests/meal_costing.sql`
   - 100 kişi / 12 kg → 0,12 kg/kişi;
   - FIFO iki parti maliyeti doğru;
   - hammadde faturası genel gider havuzuna **girmez**;
   - ortak gider 3 öğüne ağırlıklarla dağılır ve toplam korunur (Σ paylar = havuz; kuruş yuvarlama farkı en büyük paya);
   - öğünsüz üretim çıkışı reddedilir;
   - norm önerisi onaysız reçeteyi değiştirmez.
   - Vitest: dağıtım fonksiyonu, yuvarlama.
5. **3C ek ile bağ:** Reçete ve menü 1 kişiliktir. Planlanan maliyet = Σ(qty_per_person × güncel maliyet). Gerçekleşen maliyet iş emrine bağlı üretim kaydından (X kişi / Y kullanım) gelir. İlk üretim reçeteyi kurar, sonrakiler yalnız kalibrasyon önerisi üretir.
**Kabul:** Her gün × öğün × müşteri için kişi başı malzeme, genel gider ve nihai maliyet; kahvaltı, öğle ve akşam ayrı raporlanıyor.


**Rakip analizinden (§11) ekler:**
- [MUST] AvT (teorik ↔ fiili) kartı, Finans › Maliyet içinde. Teorik = teslim kişi × onaylı 1 kişilik reçete × güncel maliyet; Fiili = FIFO tüketim + fire/artan + sayım farkı. Fark fiyat, verim ve kontrolsüz stok olarak ayrıştırılır; en çok sapan 10 malzeme listelenir (Apicbase/Crunchtime).
- [MUST] Mutfak modunda "Fire / Artan" düğmesi (tür, kg, neden kodu, fotoğraf). Bugün ekranında dünkü fire kg/₺, en çok fire veren 5 yemek, eşik alarmı. Dönen yemek kalibrasyon önerisine girdi olur (Winnow/Leanpath). 🔌 Tartı/kamera entegrasyonu COULD.
- [SHOULD] Sipariş ↔ fiili teslim farkından öğün bazlı üretim tamponu önerisi.

##### Faz 4 — Cari & Kasa: tahsilat/ödeme, çek-senet, kredi, hatırlatma (istek 12, 13) · 2–3 oturum
1. Migration `…_payments_cheques_loans.sql`: `payments`, `payment_allocations` (+ tetikleyici: tam karşılanan `finance_entries` → `status='odendi'`, `paid_at`, `account_id`), `v_open_items`, `account_transfers` (+ `v_account_balances` yeni sürümü: virman ve ödemeler dahil; **eski görünüm adı korunur**), `cheques.issuer` (`biz|musteri|diger`), `cheque_events` (+ tetikleyici: `tahsil/odendi` → `payments`), `loans`, `loan_installments`, `finance_categories` seed `finansman_gideri`, `v_customer_ledger`, `v_supplier_ledger`, `reminders`, `message_templates` (seed: tahsilat hatırlatma, çek vadesi, ödeme günü), `message_log`. `finance_entries.source` check'e `tahsilat`, `cek`, `kredi`, `sofor` ekle.
2. Edge Function `send-reminders` (🔌 e-posta/WhatsApp anahtarı), `pg_cron` günlük 09:00 TSİ (anahtar yoksa yalnız uygulama içi bildirim + "WhatsApp'ta aç" wa.me linki).
2b. **Belge merkezi (muhasebe çalışma alanı, #18.5):** `documents` (tür: alış/satış faturası, fiş, dekont, tahsilat/tediye makbuzu, gider pusulası, SMM, irsaliye, sözleşme; dosya storage `documents` private; `hash` unique), `document_rules` (tür/tedarikçi/anahtar kelime → kategori, KDV), RPC `process_document(id)` (türüne göre `purchase_invoices`/`payments`/`finance_entries`; hammadde faturası §0.1 → gider + stok partisi). UI: Finans > `Belgeler` (gelen kutusu, eşleştir, işle, mükerrer uyarısı). Muhasebe çalışma alanı: işlenmeyi bekleyen belge, onay bekleyen gider, vadesi gelenler.
3. UI: **Kasa & Banka** sekmeleri: `Hesaplar & hareketler` (mevcut), `Tahsilat / ödeme` (açık kalemler, kısmi tahsis, virman), `Çek & senet` (portföy, olay zaman çizelgesi, ciro, vade takvimi), `Krediler` (taksit planı, öde), `Hatırlatmalar` (şablonlar, gönderim logu). **Cari Hesaplar** müşteri/tedarikçi `Ekstre` sekmesi (yazdır/WhatsApp).
4. Testler: kısmi tahsilat 3 parçada kapanır; çek tahsili bankaya yansır; ciro edilen çek tedarikçi borcunu kapatır; karşılıksız çek alacağı geri açar; kredi taksiti faiz giderini yazar; RLS: pazarlamacı ödemeleri göremez.


**Rakip analizinden (§11) ekler:**
- [MUST] Paraşüt eşdeğeri: çek portföyü, bankaya tahsil, tedarikçiye ciro, vadesi gelen alacağa otomatik e-posta/WhatsApp hatırlatması.
- [COULD] Muhasebeci için maliyet merkezi (hizmet maliyet yeri) dışa aktarımı (Logo/Netsis uyumu).

##### Faz 5 — Lojistik (istek 7) · 2 oturum
1. Migration `…_logistics.sql`: `route_stops` (+ `routes.stops` jsonb'den tek seferlik kopya, jsonb kalır), `routes` ek (`polyline`, `distance_km`, `duration_min`, `nav_url`, `fuel_price`, `est_fuel_l`, `est_fuel_cost`), `vehicles` ek (`avg_l_per_100km`, `fuel_type`, `capacity_trays`, `kasko_due`, `k_belgesi_due`), `employees` ek (`license_class`, `license_due`, `src_due`, `psycho_due`), `driver_expenses` (+ onay tetikleyicisi → `finance_entries` source `sofor`; `kind='yakit'` → `vehicle_logs`), storage bucket `receipts` (private; şoför kendi klasörüne yazar), `stock_movements.purchase_invoice_id`, `v_customer_side_costs` (müşteri × ay: sevk malzemesi + taşıma payı).
2. UI: **Lojistik** sekmeleri `Rotalar & harita` (Leaflet + OSM; durak sırala; Google Maps / Yandex navigasyon linki üret; anahtar yoksa haversine×1,3 mesafe), `Araçlar` (kart, muayene/sigorta/bakım uyarıları → `reminders`), `Şoförler & masraflar` (şoför kartı, masraf onay kuyruğu). **Şoför Ekranı** (mobil): bugünkü duraklar, "Navigasyonu aç", teslim miktarı + imza, masraf fişi fotoğrafı. Stok > `Firmalara giden`: fatura satırından seçme.
2b. **Canlı takip (#18.3):** `route_stops.status/departed_at/arrived_at/issue`, `production_events`, `vehicle_checks` (sabah kontrol listesi, soğutucu sıcaklığı), `vehicle_positions` (isteğe bağlı), `v_live_ops`; realtime. UI: Lojistik > `Canlı takip` (mutfak + sevkiyat panosu, TV modu); yönetici/diyetisyen/baş şoför çalışma alanında özet kartı; Şoför Ekranı'na araç kontrol listesi ve müşteri ⚠ rozetleri. Şoför masrafı onayı `approval_policies` üzerinden.
3. Testler: masraf onayı → gider; şoför başkasının rotasını/masrafını göremez; rota yakıt tahmini formülü (vitest).


**Rakip analizinden (§11) ekler:**
- [MUST] Dijital teslim kanıtı: durak başına fotoğraf, imza/ad, saat, sıcaklık, dönen küvet sayısı, dönen yemek kg. Kanıt müşteriye gönderilir (🔌, yedek wa.me) (Cybake Outbound).
- [MUST] Küvet/termobox zimmeti ve kayıp takibi (Çözbim demirbaş). [COULD] Rota optimizasyonu 🔌.

##### Faz 6 — Personel: XLSX, bordro dönemi, izin (istek 8) · 1 oturum
1. Bağımlılık: `read-excel-file` (veya SheetJS resmi CDN tarball; npm `xlsx` eski sürümünü **kullanma**), dinamik import. `parseAttendanceFile` satır dizisi kabul edecek şekilde genelleştirilir (CSV yolu korunur, mevcut testler geçer).
2. Migration: `attendance_imports` (file_hash unique), `attendance_days.import_id`, `payroll_periods` + kilit tetikleyicisi, `employee_ledger` hakediş benzersizliği (employee, period), `employees.annual_leave_days`, `v_leave_balances`, izin onayı → `attendance_days(status='izinli')` tetikleyicisi. (İsteğe bağlı, (kullanıcı izin verdi — beklemeden, test geçince): hakedişte tahakkuk gideri — B-9.)
3. UI: **Personel** sekmeleri `Kartlar` · `Puantaj` (XLSX/CSV yükle → eşleşmeyen cihaz no listesi → onay; ay ızgarası; 10 saat üstü mesai ×1,5, altı kesinti — mevcut `payroll.ts`) · `Bakiye & ödemeler` (canlı — realtime; toplu ödeme; ödeme logu; kişi detay raporu) · `İzin & talepler` (izin bakiyesi).
3b. **İK çalışma alanı (#18.6):** ek rol `ik` (`team_members_role_check` genişletilir, eski değerler korunur; RLS matrisine eklenir), `employees.shift_start`, `v_attendance_stats` (devam oranı, yok/raporlu/izin, geç giriş, erken çıkış, mesai), `employee_reviews` (tamamlanan değerlendirme değişmez; yeni sürüm). UI: Personel > `Analiz & değerlendirme` (trend, departman ısı haritası, radar); İK çalışma alanı kartları.
4. PLAN.md'deki "7,5 saatlik gün" ifadesini "10 saat (kartta değiştirilebilir)" olarak düzelt.
5. Testler: örnek ZKTeco XLSX fixture (`src/lib/__fixtures__`), aynı dosya ikinci kez yüklenemez, kapalı dönem değiştirilemez.


**Rakip analizinden (§11) ekler:**
- [SHOULD] Puantajda istasyon/öğün etiketi; "kişi başı işçilik ₺" ve "personel-saat başına porsiyon" hesaplanır. Bu veri §3.6 personel dağıtım anahtarını besler (Crunchtime/R365).

##### Faz 7 — Kârlılık, teklif & sunum, marka şablonu (istek 9, 10, 15) · 2 oturum
1. Migration: `company_settings` ek (logo_path, logo_dark_path, instagram, facebook, linkedin, youtube, tiktok, x, whatsapp, iban, bank_name, mersis_no, food_reg_no, certificates text[], brand_color); storage `brand-public` (public read, yonetici yazar) ve `brand-media` (private); `brand_assets`; `customers.show_as_reference`, `suppliers.show_as_reference`; `quotes` ek (sections jsonb, menu_ids uuid[], service_style, sent_at, sent_via); `quote_templates`; görünümler `v_overhead_per_meal`, `v_menu_profitability` (menü × sunum: gıda + ambalaj + genel gider payı; min/ort/max müşteri fiyatı; marj), `v_customer_profitability`.
2. UI: **Ayarlar > Firma & antet** (logo yükle, sosyal medya, IBAN); `ReportFrame` bu alanları kullanır (logo, iletişim, sosyal simgeler, QR); pencere başlıklarında logo (BACKLOG ⏳). **Menüler > Kârlılık** sekmesi (fiyat serbest; "önerilen = maliyet ÷ (1 − hedef marj)" yalnız öneri). **Teklifler & Sunum**: `Teklifler` (hesaplayıcı + bölüm seçimi + çok sayfalı kurumsal PDF), `Menü sunumu` (haftalık/aylık menü kurumsal şablonda), `Galeri & referanslar`.
2b. **Pazarlama belgeleri (#18.1):** `document_templates` (menü/teklif/proforma/fatura/ekstre; hazır şablonlar seed), `proformas`, teklif → proforma → (kabulde) müşteri + `customer_menus` oluşturma sihirbazı.
3. Testler: genel gider payı hesabı (bilinen gider ve kişi sayısıyla), menü × sunum maliyet farkı, teklif fiyat formülü (vitest).


**Rakip analizinden (§11) ekler:**
- [SHOULD] Menü mühendisliği matrisi (Yıldız / Sabanı çeken at / Bilmece / Köpek), Kârlılık sekmesi içinde. Popülerlik = seçilme oranı + düşük dönen yemek + düşük şikâyet; kârlılık = kişi başı katkı payı (Apicbase/Craftable/Kitchen CUT).

##### Faz 8 — Ana sayfa ve sosyal medya merkezi (istek 5, 6) · 1–2 oturum
1. Migration: `dashboard_notes`, `social_accounts`, `social_account_snapshots`, `social_posts` ek (`account_ids uuid[]`, `media_paths text[]`, `approved_by`, `approved_at`, `menu_plan_date`); realtime'a `production_orders`, `dashboard_notes`.
2. **Embay yöntemi:** Kullanıcının Embay deposu bu hesapta bulunamadı — kullanıcıdan depo adını/erişimini iste; bulunursa içerik havuzu/takvim/onay akışını oradan uyarlayarak al; bulunamazsa PLAN.md faz 9 tanımıyla (havuz → taslak → onay → planlandı → yayınlandı) ilerle.
3. UI: **Bugün**: kartlar (Yarın: kişi, firma × menü × sunum, kesim sayacı, sipariş girmeyenler · Üretim emri durumu · Stok uyarısı · Notlar (sabitlenmiş/önemli) · Kasa & vadeler (FIN) · Sosyal medya önizleme (avatar, takipçi, son gönderi küçük resmi, bu hafta planlanan)). **Sosyal Medya** sekmeleri: `Hesaplar` (bizim + sektör), `Takvim`, `İçerik & onay`. Meta/TikTok API 🔌; o zamana kadar elle güncelleme + link.
4. Testler: not görünürlüğü role göre; sosyal hesap RLS (şoför göremez).


**Rakip analizinden (§11) ekler:**
- [SHOULD] Bugün'de patron günlük prime cost kartı: dün teslim, gelir, FIFO SMM, işçilik, prime cost %, kişi başı marj, haftalık kıyas (R365).

##### Faz 8A — Pazarlama çalışma alanı: CRM, hedef kitle botu, etkileşim verisi (istek 18.1) · 2 oturum
1. Migration: `crm_contacts` (KVKK izin alanları zorunlu), `crm_interactions`, `lead_requests`, `audience_targets`, `social_post_metrics`.
2. Edge Functions (🔌): `audience-bot` (günlük 08:00; Google Places/resmi listeler; anahtar yokken CSV içe aktarma), `social-metrics` (Meta/TikTok API; yokken elle giriş). Bot çıktısı yalnız öneri; iletişim kişi onayı ve izin kaydı olmadan mesaj gönderilmez.
3. UI: Pazarlamacı çalışma alanı (bugünün hedef listesi, yapılacak geri dönüşler, açık aday talepleri, etkileşim özeti, teklif/proforma durumu); Cari > `Adaylar` sekmesi ve aday/müşteri detayında `Görüşmeler`; Teklifler & Sunum > `Hedef firmalar`; yönetici için pazarlamacı iş raporu (ziyaret, görüşme, dönüşüm).
4. Testler: pazarlamacı başkasının atanmış adayını düzenleyemez (yönetici hariç — karar kullanıcıya sorulsun); şoför/depo CRM göremez.

##### Faz 8B — Hata Merkezi ve debugger botu (istek 17) · 1–2 oturum
1. Migration: `bug_fix_proposals`; `error_events` zaten Faz 3A'da.
2. Edge Functions: `collect-logs` (pg_cron 10 dk; Supabase Management API logları + advisor; 🔌 kişisel erişim anahtarı Vault'ta), `bug-doctor` (🔌 LLM + GitHub salt-okur/PR token): hata kümesi → ilgili kaynak ve migration okunur → teşhis + yama (diff) + SQL + test planı + risk → `bug_fix_proposals`. **Canlıya hiçbir şey uygulamaz.** Kurucu onayı (`approval_policies: bug_fix`) sonrası yalnız ayrı dal + **taslak PR** açar; SQL önerisi bir Supabase branch'inde test edilip sonucu PR'a eklenir. Birleştirme/yayın insan (veya Claude Code) tarafından.
3. UI: Ayarlar > `Hata Merkezi` (hata listesi: kaynak, sayı, ilk/son görülme, etkilenen kullanıcı/rota; öneri detayı: teşhis, diff görünümü, risk; Onayla → PR aç / Reddet; durum takibi). Güvenli hızlı eylemler (oturum kapat, modül kapat) onaylı ve loglu.
4. Testler: `log_client_error` hız sınırı; PII maskeleme; bot fonksiyonu service role ile DB'ye DDL yazamaz (yalnız `bug_fix_proposals` insert yetkili ayrı rol/anahtar).


**Rakip analizinden (§11) ekler:**
- [COULD] Salt okur AI rapor asistanı: RLS'e uyar, yalnız SELECT; "dün hangi yemekte fire arttı?" gibi sorulara cevap verir (Apicbase MCP).

##### Faz 9 — Rehber ve ilk kullanım (istek 14) · 1 oturum
1. Migration: `user_onboarding` (RLS: yalnız kendi).
2. UI: `<Hint>` (bir kez gösterilir, kapatılabilir), rol bazlı `<Tour>` (aşçıbaşı, muhasebe, depo, şoför, pazarlamacı için 4–6 adım), her ModuleHero altında "Bu ekranda ne yaparım?" katlanır kutu, FormDrawer alan ipuçlarının tüm formlarda tutarlılığı.
3. Test: vitest ile tur adımlarının rol filtresi; erişilebilirlik: tüm butonlarda `aria-label`/metin.

##### Faz 10 — Uçtan uca doğrulama (istek 16) · her faz sonunda + final
- supabase-kontrol.md §5 senaryosunu `supabase/tests/e2e_full_flow.sql` olarak repo'ya ekle, yeni tablolarla genişlet: menü tipi + sunum → müşteri menü tanımı → aylık sipariş → üretim emri (kontrol/onay/kapanış) → kalibrasyon → stok → teslim → gelir → kısmi tahsilat (çek) → fatura (alias eşleştirme) → ödeme → kârlılık görünümü → hatırlatma kaydı. Tamamı `begin … rollback`.
- Final: `get_advisors` security/performance raporu, `list_tables` ile RLS doğrulaması, tüm vitest + tsc + build; sonuçları `docs/analiz/test-raporu.md`'ye yaz.

---

#### D. Öncelik özeti (neden bu sıra) — güncel sıra: 3A → 3B → 3C-0 → 3C → 3D → 3E → 3F → 3H → 3G → 4 → 5 → 6 → 7 → 8A → 8 → 8B → 9 → 10
- **3A**'ya eklendi: muhasebe kuralı (tek gider, stok çift giriş engeli + tedarikçi etiketi), denetim değişmezliği, hata yakalama.
- **3B**'ye eklendi: rol çalışma alanı kabuğu (Bugün = role göre iş masası; Onaylar sekmesi yeri).
- **3C-0 (yeni, yüksek):** Onay merkezi + değişmez kayıt + sürüm altyapısı — maliyet/satınalma planı ve kurucu işlemleri buna dayanır.
- **3E**: tedarikçi etiketli stok partileri (FIFO) — muhasebe kuralının veri modeli.
- **3F (yeni, yüksek):** Maliyet (gün/ay/yıl) + menüden otomatik, sürümlü satınalma planı + teklif/marka analizi + tasarruf raporu.
- **3H (yeni, yüksek):** Üretimden öğrenen reçete (X kişi / Y kullanım), kişi başı maliyet ve öğün bazlı (kahvaltı/öğle/akşam) genel gider dağıtımı. 3C/3D/3F'de oluşturulan tablolar baştan `meal` sütunuyla açılır; sonradan eklemek pahalıdır.
- **Stok iskeleti:** `/workspace/stok-datasi/` (564 kanonik stok + takma adlar, 331 yemek adı) 3E'de `ingredient_aliases` ile yüklenir. Kural: kanonik ad sabit; faturadaki aynı ürün o stoğa yazılır ve tedarikçi etiketi kaydedilir; yeni ürün oluşturulur.
- **3G (yeni):** Kurucu paneli (hesap, kullanıcı sil/kısıtla, modül aç/kapat).
- **4/5/6/7**: belge merkezi, canlı takip + araç kontrol, İK analizi + `ik` rolü, pazarlama şablonları/proforma eklendi.
- **8A (yeni):** Pazarlama CRM + hedef kitle botu; **8B (yeni):** Hata Merkezi + insan onaylı debugger botu.

Önceki gerekçeler:
1. **Faz 3A** — güvenlik açıkları (maaş/IBAN sızıntısı, kurucu yükseltme, portal fiyat, çift stok) ve migration kayması, üstüne inşa edilmeden önce kapanmalı.
2. **Faz 3B** — navigasyon şimdi sadeleşirse sonraki tüm sekmeler doğru yere eklenir; `role_permissions` boşken taşımak bedava.
3. **Faz 3C** — kullanıcının ana akışı (sipariş → üretim kontrolü → emir → stok/maliyet) ve gramaj kalibrasyonu; sistemin "kaça mal oldu" sorusunun temeli.
4. **Faz 3D** — menü tipi, tabla/küvet ve müşteri menü tanımı; siparişin ve fiyatın doğru kaynağı.
5. **Faz 3E** — kanonik stok adları; stok ve reçete verisinin bozulmasını önler.
6. Sonra: Faz 4 (para akışı) → 5 (lojistik) → 6 (personel XLSX) → 7 (kârlılık/teklif/marka) → 8 (ana sayfa/sosyal) → 9 (rehber) → 10 (final doğrulama).

#### E. Her faz sonunda kullanıcıya rapor şablonu
- Ne yapıldı (ekran/sekme, tablo, fonksiyon) · Uygulanan migration adları ve canlı sürümleri · Test sonuçları (SQL + vitest + build) · Advisor farkı · Bilinen eksikler/🔌 bekleyenler · Kullanıcının yapması gereken (ör. Dashboard ayarı, API anahtarı).



---

## 9) Uçtan uca test senaryosu


### 9.1 Temel senaryo (SQL, begin … rollback)
> Kaynak: `notlar-analiz/supabase-kontrol.md` satır 145–374 (birebir alıntı; başlık seviyeleri düşürüldü).

#### 5. Uçtan uca test senaryosu (ÇALIŞTIRILMADI)

**Nerede çalıştırılmalı:** Önerilen: Supabase **branch** (`create_branch`, ücretlidir — önce `get_cost`/`confirm_cost`) veya yerel `supabase start`. Canlıda çalıştırılacaksa **tamamı tek transaction** içinde ve sonunda `rollback;` ile (SQL Editor'de tek seferde). Scriptteki `-- BUG` adımları, düzeltme öncesi hatanın **var olduğunu** göstermek için "başarılı olmalı" şeklinde yazıldı; düzeltmelerden sonra bu adımlar hata vermelidir (beklenti ters çevrilir).

```sql
begin;

-- ============ 0) Test kullanıcıları (postgres olarak; RLS devre dışı) ============
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
 ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t-yonetici@test.local','{}',now(),now()),
 ('00000000-0000-0000-0000-00000000a002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t-asci@test.local','{}',now(),now()),
 ('00000000-0000-0000-0000-00000000a003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t-muhasebe@test.local','{}',now(),now()),
 ('00000000-0000-0000-0000-00000000a004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t-depo@test.local','{}',now(),now()),
 ('00000000-0000-0000-0000-00000000a005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t-sofor@test.local','{}',now(),now()),
 ('00000000-0000-0000-0000-00000000a006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t-musteri@test.local','{}',now(),now());

insert into public.customers (id, name, default_meal_price, vat_rate, payment_term_days)
values ('00000000-0000-0000-0000-0000000c0001','TEST Fabrika A.Ş.', 250, 10, 30);

insert into public.team_members (user_id, full_name, role, customer_id) values
 ('00000000-0000-0000-0000-00000000a001','T Yönetici','yonetici',null),
 ('00000000-0000-0000-0000-00000000a002','T Aşçıbaşı','asci_basi',null),
 ('00000000-0000-0000-0000-00000000a003','T Muhasebe','muhasebe',null),
 ('00000000-0000-0000-0000-00000000a004','T Depo','depo',null),
 ('00000000-0000-0000-0000-00000000a005','T Şoför','sofor',null),
 ('00000000-0000-0000-0000-00000000a006','T Müşteri','musteri','00000000-0000-0000-0000-0000000c0001');

-- ============ 1) Aşçıbaşı: hammadde, reçete, menü, menü planı ============
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated"}', true);
set local role authenticated;

insert into public.ingredients (id, name, category, stock_unit, waste_pct) values
 ('00000000-0000-0000-0000-0000000e0001','TEST Dana kuşbaşı','et_tavuk','kg',10),
 ('00000000-0000-0000-0000-0000000e0002','TEST Kuru soğan','sebze_meyve','kg',12),
 ('00000000-0000-0000-0000-0000000e0003','TEST Baldo pirinç','bakliyat_tahil','kg',0);

select public.save_recipe(null,
  '{"name":"TEST Tas Kebap","category_code":"ana_yemek"}',
  '[{"ingredient_id":"00000000-0000-0000-0000-0000000e0001","net_qty":90},
    {"ingredient_id":"00000000-0000-0000-0000-0000000e0002","net_qty":30}]');
select public.save_recipe(null, '{"name":"TEST Pilav","category_code":"pilav_makarna"}',
  '[{"ingredient_id":"00000000-0000-0000-0000-0000000e0003","net_qty":70}]');

select public.save_menu(null,
  '{"name":"TEST Öğle 4 Çeşit","kind":"standart","meal":"ogle","target_price":250}',
  (select jsonb_agg(jsonb_build_object('recipe_id', id, 'course', case when name like '%Pilav' then 'yardimci' else 'ana' end))
     from public.recipes where name in ('TEST Tas Kebap','TEST Pilav')));

insert into public.menu_plans (plan_date, meal, menu_id)
select current_date + 2, 'ogle', id from public.menus where name = 'TEST Öğle 4 Çeşit';

-- Negatif: aşçıbaşı fiyat giremez (ingredient_prices yazarları: yonetici, satinalma, muhasebe)
do $$ begin
  begin
    insert into public.ingredient_prices (ingredient_id, price) values ('00000000-0000-0000-0000-0000000e0001', 500);
    raise exception 'BEKLENMEYEN: aşçıbaşı fiyat girebildi';
  exception when insufficient_privilege then raise notice 'OK: aşçıbaşı fiyat giremez';
  end;
end $$;
reset role;

-- ============ 2) Muhasebe: fiyatlar ve sipariş ============
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000a003","role":"authenticated"}', true);
set local role authenticated;

insert into public.ingredient_prices (ingredient_id, price, source, supplier_name) values
 ('00000000-0000-0000-0000-0000000e0001', 500, 'manuel', 'TEST Kasap'),
 ('00000000-0000-0000-0000-0000000e0002', 20,  'manuel', 'TEST Manav'),
 ('00000000-0000-0000-0000-0000000e0003', 60,  'manuel', 'TEST Toptancı');

-- Reçete maliyeti: et 90/(1-0,10)=100 g → 0,1 kg × 500 = 50 ₺; soğan 30/0,88=34,09 g × 20 = 0,68 ₺ → ≈50,68 ₺
do $$ declare c numeric; begin
  select cost_last into c from public.v_recipe_costs where name = 'TEST Tas Kebap';
  assert round(c, 2) = 50.68, format('Tas Kebap maliyeti beklenen 50,68, bulunan %s', c);
  raise notice 'OK: reçete maliyeti %', c;
end $$;

insert into public.meal_orders (service_date, meal, customer_id, ordered_qty, unit_price, vat_rate)
values (current_date + 2, 'ogle', '00000000-0000-0000-0000-0000000c0001', 1200, 250, 10);
reset role;

-- ============ 3) Aşçıbaşı: siparişten hazırlık, reçeteden doldur, gerçek miktar ============
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated"}', true);
set local role authenticated;

select public.plan_prep_from_orders(current_date + 2, 'ogle') as basliklar;   -- beklenen 2

do $$ declare b uuid; q numeric; begin
  select id into b from public.prep_batches where prep_date = current_date + 2 and dish_name = 'TEST Tas Kebap';
  assert (select portions from public.prep_batches where id = b) = 1200, 'porsiyon 1200 olmalı';
  perform public.prep_fill_from_recipe(b);
  select planned_qty into q from public.prep_batch_items where batch_id = b and ingredient_id = '00000000-0000-0000-0000-0000000e0001';
  assert q = 120, format('planlanan et 120 kg olmalı, bulunan %s', q);   -- 100 g brüt × 1200
  -- Gerçekte 100 kg et kullanıldı (kalibrasyon örneği)
  update public.prep_batch_items set qty = 100 where batch_id = b and ingredient_id = '00000000-0000-0000-0000-0000000e0001';
  raise notice 'OK: hazırlık planı ve gerçek miktar';
end $$;

select dish_name, portions, total_cost, cost_per_portion, variance_pct
from public.v_prep_batch_costs where prep_date = current_date + 2;
reset role;

-- ============ 4) Depo: stok girişi ve hazırlıktan çıkış ============
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000a004","role":"authenticated"}', true);
set local role authenticated;

insert into public.stock_movements (ingredient_id, kind, qty, unit_cost, source, note)
values ('00000000-0000-0000-0000-0000000e0001','giris', 150, 480, 'elle', 'TEST giriş');

insert into public.stock_movements (ingredient_id, kind, qty, unit_cost, source, source_id, note)
select '00000000-0000-0000-0000-0000000e0001', 'cikis', -100, 500, 'hazirlik', id, 'TEST üretim'
from public.prep_batches where prep_date = current_date + 2 and dish_name = 'TEST Tas Kebap';

do $$ declare onhand numeric; avgc numeric; begin
  select sum(qty) into onhand from public.stock_movements where ingredient_id = '00000000-0000-0000-0000-0000000e0001';
  select avg_cost into avgc from public.ingredients where id = '00000000-0000-0000-0000-0000000e0001';
  assert onhand = 50, format('eldeki et 50 kg olmalı, bulunan %s', onhand);
  assert avgc = 480, format('avg_cost 480 olmalı (stok 0 iken giriş fiyatı), bulunan %s', avgc);
  raise notice 'OK: stok %, avg_cost % (B-4: stok girişinden önce fiyat kaydı avg_cost=500 yazmıştı)', onhand, avgc;
end $$;
reset role;

-- ============ 5) Aşçıbaşı: hazırlıktan reçete türet (mevcut davranış = üzerine yazma) ============
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000a002","role":"authenticated"}', true);
set local role authenticated;
do $$ declare b uuid; r uuid; n numeric; begin
  select id into b from public.prep_batches where prep_date = current_date + 2 and dish_name = 'TEST Tas Kebap';
  r := public.recipe_from_prep(b);
  select net_qty into n from public.recipe_ingredients where recipe_id = r and ingredient_id = '00000000-0000-0000-0000-0000000e0001';
  -- 100 kg / 1200 kişi = 83,333 g brüt → net = 83,333 × 0,9 = 75,000 g
  assert n = 75, format('kalibre net 75 g olmalı, bulunan %s', n);
  raise notice 'OK (B-6 notu: reçete tek günle üzerine yazıldı): et net %', n;
end $$;
reset role;

-- ============ 6) Muhasebe: teslim → gelir; fatura → gider; tahsil → kasa ============
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000a003","role":"authenticated"}', true);
set local role authenticated;

update public.meal_orders set delivered_qty = 1180, status = 'teslim_edildi'
where customer_id = '00000000-0000-0000-0000-0000000c0001' and service_date = current_date + 2;

do $$ declare e record; begin
  select * into e from public.finance_entries where source = 'siparis' and counterparty = 'TEST Fabrika A.Ş.';
  assert e.net_amount = 295000 and e.vat_amount = 29500 and e.status = 'bekliyor', format('gelir hatalı: %s', row_to_json(e));
  raise notice 'OK: gelir kaydı % + KDV %', e.net_amount, e.vat_amount;
end $$;

insert into public.purchase_invoices (supplier_name, supplier_tax_no, invoice_no, invoice_date, category_code, net_amount, vat_amount, total_amount, status)
values ('TEST Kasap', '1234567890', 'TST2026000000001', current_date, 'gida_hammadde', 72000, 720, 72720, 'onaylandi');

do $$ begin
  assert exists (select 1 from public.finance_entries where source = 'gelen_fatura' and description = 'Fatura TST2026000000001' and kind = 'gider'),
    'onaylı fatura gider kaydı oluşmadı';
  raise notice 'OK: fatura gideri';
end $$;

update public.finance_entries set status = 'odendi', paid_at = current_date,
       account_id = (select id from public.finance_accounts where name = 'Banka')
where source = 'siparis' and counterparty = 'TEST Fabrika A.Ş.';

select name, balance from public.v_account_balances;   -- Banka +324.500 beklenir

-- Personel kartı (maaş + IBAN) — S-1 testi için
insert into public.employees (full_name, pay_type, monthly_salary, iban, user_id)
values ('TEST Şoför Personel', 'aylik', 30000, 'TR000000000000000000000001', '00000000-0000-0000-0000-00000000a005');
reset role;

-- ============ 7) Şoför: RLS negatif/pozitif testleri ============
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000a005","role":"authenticated"}', true);
set local role authenticated;

do $$ begin
  assert (select count(*) from public.finance_entries) = 0, 'şoför finans defterini görmemeli';
  raise notice 'OK: şoför finans görmez';
  begin
    insert into public.meal_orders (service_date, meal, customer_id, ordered_qty) values (current_date + 3, 'ogle', '00000000-0000-0000-0000-0000000c0001', 10);
    raise exception 'BEKLENMEYEN: şoför sipariş ekledi';
  exception when insufficient_privilege then raise notice 'OK: şoför sipariş ekleyemez';
  end;
end $$;

-- BUG S-1 (düzeltme öncesi GEÇER, düzeltme sonrası 0 dönmeli — kendi kaydı hariç)
select full_name, monthly_salary, iban from public.employees where full_name like 'TEST%';

-- BUG S-3: kendi izin talebini onaylı ekleyebiliyor (düzeltme sonrası 42501 beklenir)
insert into public.employee_requests (employee_id, kind, start_date, end_date, status)
select id, 'izin', current_date + 5, current_date + 6, 'onaylandi' from public.employees where full_name = 'TEST Şoför Personel';
reset role;

-- ============ 8) Portal müşterisi (rol: musteri) ============
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000a006","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.customers) = 1, 'müşteri yalnız kendi kartını görmeli';
  assert (select count(*) from public.ingredients) = 0, 'müşteri hammadde görmemeli';
  raise notice 'OK: müşteri izolasyonu';
end $$;
-- BUG S-2: müşteri kendi fiyatını 1 ₺ yazabiliyor (düzeltme sonrası fiyat 250'ye zorlanmalı)
insert into public.meal_orders (service_date, meal, customer_id, ordered_qty, unit_price, status)
values (current_date + 3, 'ogle', '00000000-0000-0000-0000-0000000c0001', 50, 1, 'bekliyor')
returning unit_price;
reset role;

-- ============ 9) Anonim sipariş linki ============
-- anon order_token okuyamaz (RLS) → token postgres olarak alınıp GUC'ye yazılır
do $$ declare t uuid; begin
  select order_token into t from public.customers where id = '00000000-0000-0000-0000-0000000c0001';
  perform set_config('test.token', t::text, true);
end $$;
set local role anon;
select public.portal_info(current_setting('test.token')::uuid);
select public.portal_set_order(current_setting('test.token')::uuid, current_date + 4, 'ogle', 300, 'TEST portal');
reset role;

-- ============ 10) Yetki yükseltme (S-4) ============
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
set local role authenticated;
-- BUG S-4: yönetici kendini kurucu yapabiliyor (düzeltme sonrası 42501 beklenir)
update public.team_members set role = 'kurucu' where user_id = '00000000-0000-0000-0000-00000000a001' returning role;
reset role;

-- ============ 11) Audit izi ============
select entity_type, action, count(*) from public.audit_log where at > now() - interval '5 minutes' group by 1,2 order by 1,2;

rollback;   -- HİÇBİR ŞEY KALICI OLMAZ
```

**Başarı ölçütü:** Tüm `assert`'ler geçer, `NOTICE: OK …` satırları görünür; `BUG` adımları düzeltmelerden önce "geçer" (hatayı kanıtlar), düzeltmelerden sonra `42501`/zorlanmış değer döndürür. Script sonunda `rollback` ile canlı veri değişmez (auth.users test satırları da geri alınır).


### 9.2 Yeni akışlar için ek uçtan uca adımlar (3C ek, 3D, 3E, 3F, 3H, 4–8 sonrası; dev projede, `begin … rollback`, ayrıca Playwright ile arayüz)
1. **Stok iskeleti:** `ana-stok-listesi.csv` (564 kalem) ve `yemek-listesi.csv` (331 ad) `stg_stok` üzerinden yüklenir. İkinci çalıştırmada yeni satır oluşmaz (idempotent). Takma adlar yüklenir. 9 boş KDV satırı "gözden geçir" olarak işaretlenir.
2. **Fatura eşleştirme:** "DOMATES SALKIM KG" satırı → `match_ingredient` → "Domates" (takma ad). "Kıyma %20 yağlı" → trgm önerisi, onaylanınca takma ad olur. Eşleşmeyen yeni ürün → yeni stok (gözden geçir). Birim KGM→kg, 1 koli = 12 adet dönüşümü doğrulanır. Tedarikçi etiketli parti açılır; fiyatı güncelleyen kullanıcı `ingredient_prices`/`audit_log`'da görünür.
3. **Tek gider / tek kapı:** PO teslimi + aynı malın faturası → stok bir kez girer (partial unique). Gider yalnız fatura onayında bir kez yazılır; üretim çıkışı `finance_entries`'e satır eklemez.
4. **1 kişilik reçete:** "Karnıyarık" yalnız adla var. İlk üretim X=1200 kişi, patlıcan Y=100 kg girilir → reçete 1 kişilik 83,3 g (sürüm 1). İkinci üretim 1000 kişi / 88 kg → kalibrasyon önerisi (88 g) çıkar, reçete kendiliğinden değişmez. Onaylanınca sürüm 2 oluşur; sürüm 1 arşivde okunur.
5. **Menü ölçekleme ve öğün:** 5 çeşitlik öğle menüsü, A firması 300 (tabla) + B firması 450 (küvet). Kahvaltı ve akşam ayrı siparişlerle girilir. Üretim emri her öğün için ayrı; kg listesi Σ(N × kişi başı × brüt), kanonik adla toplanmış. Ambalaj: 300 adet 3 bölmeli kap; B için küvet adedi kap kapasitesinden hesaplanır.
6. **İş emri ve A4 rapor:** Öğle iş emri; her yemek için yapılış adımları, doğrama biçimi, saklama kabı; istasyon/sorumlu atanır. `/uretim/is-emri/:id/yazdir` A4 HTML (`@page A4`, `print-color-adjust`) firma başına kişi sayısını ve kap türünü, öğün başlıklarını, kurumsal logo/adres başlığını gösterir. Tarayıcıdan yazdırma ve PDF çıktısı 1–2 sayfa tutar.
7. **Üretim ve FIFO:** Üretim tamamlanır → stok FIFO partilerden düşer (eski parti önce), `stock_movements.meal='ogle'`. Plan-fiili fark ve artan/fire kaydedilir. Yan malzeme (tuzluk 20 adet, ketçap saşe 300) A firması etiketiyle stoktan düşer.
8. **Maliyet ve genel gider:** Personel, enerji ve kira giderleri girilir. Ay kapanışında öğün payları anahtarlarla dağıtılır; Σ pay = havuz (kuruş farkı en büyük paya). Öğle kişi başı nihai maliyet = malzeme + genel gider. Finans > Maliyet'te gün/ay/yıl görünümü açılır; menü kârlılığında hedef marjdan önerilen fiyat çıkar.
9. **Satınalma planı:** Gelecek ay için `generate_purchase_plan` (geçen ay kişi ortalaması) sürüm 1'i üretir. Yönetici 2 satırı düzenler → sürüm 2; fark görünür. Onaya gönderilir; talep eden onaylayamaz (hata). Yönetici **Onaylar** sekmesinden onaylar → PO yalnız bu sürümden oluşur ve tedarikçiye gruplu talep gider. `audit_log`/`approval_events` UPDATE/DELETE denemesi hata verir; `verify_audit_chain` true döner.
10. **Sipariş değişikliği:** Aylık standing order'ın bir günü portaldan kesimden önce değiştirilir (revizyon logu); kesimden sonra kilitlenir. Onaylı sipariş değişirse bildirim oluşur. Portal müşterisi `unit_price` gönderse bile tetikleyici müşteri fiyatını yazar.
11. **Cari ve kasa:** Alınan çek → ciro edilerek tedarikçiye verilir; yazılan çek vade hatırlatması; tahsilat nakit/banka/çek ile kasaya bağlanır; alacak listesi (yaşlandırma) doğrulanır; planlı tahsilat mesajı kuyruğa girer (🔌 e-posta/WhatsApp gerçek gönderimi anahtar gelince; yoksa "gönderilecek" kaydı).
12. **Lojistik:** Baş şoför rota çizer; şoför navigasyon linkini açar, fiş/yakıt masrafı girer (onaya düşer); rota yakıt maliyeti km × tüketim × yakıt fiyatı ile hesaplanır. Araç muayene/bakım hatırlatması üretilir.
13. **Personel:** Parmak izi XLSX içe aktarılır. 10 saat kuralına göre fazla mesai veya kesinti hesaplanır; canlı bakiye (Realtime) güncellenir. İzin talebi onaydan geçer; ödeme logu tutulur.
14. **Kurucu paneli ve hata merkezi:** Modül kapatılınca menüde görünmez ve RLS/rota erişimi engellenir. İstemci hatası `error_events`'e düşer; debugger bot yalnız öneri üretir, kurucu onaylamadan hiçbir değişiklik uygulanmaz.
15. **Rol testleri:** Her rolle (kurucu, yonetici, muhasebe, satinalma, asci, depo, sofor, pazarlamaci, diyetisyen, ik, musteri) giriş yapılır; §4 matrisindeki görme/yazma sınırları hem arayüzde hem API'de (42501) doğrulanır.


---

## 10) Kullanıcıya açık sorular (bu sorular işi DURDURMAZ: belirtilen yedek yol/varsayılanla devam et, soruları faz raporlarında listele, cevap gelince uyarla)
1. **Embay reposu nerede?** Sosyal medya merkezi "Embay benzeri" olacak. Repo adı veya erişimi ya da örnek ekranlar verilmeden Embay kodu/tasarımı kopyalanmaz. Yedek yol: kendi `social_accounts/social_posts` modelin + manuel/CSV veri girişi.
2. **Boş KDV satırları:** `ana-stok-listesi.csv`'de 9 kalemin KDV'si boş (belirsiz). Kullanıcı mali müşavirle teyit edene kadar "gözden geçir" bayrağıyla kalır, varsayılan atanmaz. Ayrıca KDV %10 ve tevkifat oranlarının (hizmet faturası 2/10 vb.) teyidi gerekir.
3. **Sızdırılmış parola koruması:** Supabase Dashboard → Auth → Password security → "Leaked password protection" açılsın mı? Ayar kullanıcıdadır; kullanıcıya adımları ver.
4. **Supabase Auth Site URL / Redirect URL:** `https://trakya-catering.onrender.com` olarak ayarlanacak (e-posta doğrulama ve parola sıfırlama linkleri için). Kullanıcı onaylasın; önizleme alan adları da redirect listesine eklensin mi?
5. **Migration sürüm kayması (M-1):** Varsayılan: dosyalar canlı sürümlere göre yeniden adlandırılır (bilgi amaçlı).
6. **Dev/test Supabase projesi:** Ayrı proje ya da branch açılsın mı? Varsayılan: yerel `supabase start` (ücretsiz). Supabase branch'i ücretlidir; gerekirse kullan ve maliyeti raporla.
7. **Bordro:** Net ↔ brüt hesabı (SGK, gelir vergisi dilimleri, asgari ücret istisnası) programda yapılsın mı, yoksa muhasebeciden mi gelecek?
8. **Entegrasyon anahtarları (🔌):**
   - e-Fatura/e-Arşiv entegratörü (hangisi?);
   - WhatsApp Business API / SMS sağlayıcısı;
   - e-posta (SMTP/Resend);
   - Instagram/Facebook/X API erişimi;
   - harita/navigasyon (Google Maps / Yandex; rota yakıt maliyeti için);
   - parmak izi cihazının marka/modeli ve XLS/XLSX örnek dosyası;
   - banka ekstre formatı.
9. **Genel gider dağıtım varsayılanları:** Öğün ağırlıkları (kahvaltı 0,6 · öğle 1,0 · akşam 1,0), payda (teslim edilen kişi) ve onay eşiği (20.000 ₺) uygun mu?
10. **Kurumsal kimlik:** Logo dosyası, adres, e-posta, telefon, web ve sosyal hesaplar rapor/teklif şablonu için gerekiyor.


---

## 11) Yurt içi ve yurt dışı rakip analizi: katabileceklerimiz (güncel)
*Araştırma: 27 Eylül 2026, TSİ. Yöntem: üretici sitelerinin ve yardım merkezlerinin güncel web taraması. Kaynaklar bölüm sonunda. Ayrıntılı pazar belgesi: `pazar-arastirmasi.md` §6.*

**Bizi rakiplerden ayıran nokta:** Rakiplerin çoğu restoran/POS mantığıyla çalışır (satış adedi × reçete). Bizim işimiz **sözleşmeli toplu yemek fabrikası**: kişi sayısı önceden bilinir, 3 öğün ayrı yürür, reçete gerçek üretimden öğrenilir, tabla ile küvet ayrı maliyetlenir.
- Yurt dışı ürünler (Apicbase, Galley, MarketMan, R365, Crunchtime) analitikte güçlüdür ama Türk cari, çek, e-Fatura ve hakediş ihtiyacını karşılamaz.
- Yurt içi ürünler (Çözbim, YemekPRO, CateringSis, Logo/Netsis/Mikro) muhasebe ve üretimde yeterlidir ama analitik (AvT, fire, fiyat uyarısı, tahmin) ve UX'te zayıftır.
- **Hedef:** İkisinin iyi yanlarını, mevcut 14 modül içinde **yeni sekme açmadan** birleştirmek.

**Öncelik kodları:** **MUST** = ilgili fazda zorunlu · **SHOULD** = aynı fazda, zaman kalırsa bir sonraki fazın başında · **COULD** = plan bitince.

### 11.1 Özet tablo
| # | Yetenek | En iyi yapan (nasıl) | Bizde nerede (modül · faz) | Öncelik |
|---|---|---|---|---|
| 1 | Teorik ↔ fiili gıda maliyeti farkı (AvT) | Apicbase: Fiili = Teorik + Fire − Net sayım farkı; malzeme, reçete ve dönem bazında detaya iner. Crunchtime AvT. | Finans › Maliyet "Fark" kartı; Üretim · **3H** | MUST |
| 2 | Tedarikçi fiyat değişimi uyarısı + sözleşme fiyat doğrulama | MarketMan "Irregular Prices" (kabul/red). R365 fiyat değişim analizi + sözleşme ihlali raporu. Procurement Partners PO↔fatura eşleştirme. | Satınalma › Faturalar (eşleştirme ekranı içinde) · **3E** | MUST |
| 3 | Verim / ayıklama testi (brüt → net) | StarChef Yield sekmesi (brüt/pişmiş ağırlık, fire maliyeti); kasap testi (net kg ÷ brüt kg). | Stok kartı + reçete brüt katsayısı; teklif karşılaştırması · **3E/3H** | MUST |
| 4 | e-Fatura XML + fatura OCR | MarketMan ve R365 Capture AI: fotoğraftan satır çıkarır, güven skoru, inceleme kuyruğu. | Satınalma › Faturalar: önce UBL-TR XML, OCR ikincil · **3E** | MUST (XML) / COULD (OCR) |
| 5 | Dijital teslim kanıtı + şoför uygulaması | Cybake Outbound: rota, imza/fotoğraf teslim kanıtı, iade, standing order değişikliği. | Lojistik › Şoför ekranı · **5** | MUST |
| 6 | Fire / artan / dönen yemek takibi (tartı, AI) | Winnow Vision (kamera + tartı; ISS'te −%57, ESS'te −%70 fire). Leanpath (tartı, kök neden, hedef ve alarm). | Mutfak modu "Fire/Artan" düğmesi; Üretim · **3H** (elle), 🔌 tartı/kamera COULD | MUST (elle) |
| 7 | Menüden talep bazlı satınalma + par seviyesi | Galley: menü × kişi sayısı → üretim ve satınalma. MarketMan: par seviyesi ve tek tıkla "par'a tamamla". | Satınalma planı (3F); par yalnız menü dışı kalemler için · **3F** | SHOULD |
| 8 | Geçmişten üretim/talep tahmini | Crunchtime AI Forecasting (geçmiş, tatil, etkinlik → hazırlık ve sipariş önerisi). Galley (artan ve fire verisiyle düzeltme). | Satınalma planı + üretim tamponu önerisi · **3F/3H** | SHOULD |
| 9 | Merkezi üretimde geriye planlama | Galley Production Planner: teslim saatinden geriye plan, ortak alt reçeteleri birleştirir, raf ömrünü dikkate alır. | İş emri · **3C ek** | SHOULD |
| 10 | HACCP / sıcaklık / izlenebilirlik | FoodDocs (AI HACCP planı, sensör API, düzeltici faaliyet). Jolt (Bluetooth prob, kontrol listesi, etiket). Apicbase (tedarikçi lotu → parti → müşteri geri çağırma). | İş emri KKN kayıtları, Mutfak modu, teslimde sıcaklık, lot geri izleme · **3C ek/3E/5** | SHOULD |
| 11 | Alerjen / besin matrisi ve etiket | Nutritics (canlı alerjen matrisi, etiket; tedarikçi değişikliği reçeteye yansır). Galley (besin paneli). Jolt (etiket basımı). | Menü › alerjen matrisi otomatik; küvet etiketi; müşteri hassasiyet uyarısı · **3D/3C ek** | SHOULD |
| 12 | Günlük kâr-zarar / prime cost | R365 Daily Operations ve Sales & Prime Cost (SMM + işçilik; günlük, haftalık, dönemsel). | Bugün › patron günlük özeti kartı · **8** | SHOULD |
| 13 | Öğün başı işçilik maliyeti | Crunchtime (fiili/ideal saat, verimlilik). R365 (işçilik %, fazla mesai). | Personel puantajı → genel gider anahtarı · **6/3H** | SHOULD |
| 14 | Menü mühendisliği (Yıldız / Sabanı çeken at / Bilmece / Köpek) | Apicbase, Craftable, Kitchen CUT: popülerlik × katkı payı matrisi. | Finans › Kârlılık içinde matris görünümü · **7** | SHOULD |
| 15 | Tedarikçiden teklif toplama (link) | Çözbim E-Talep (tedarikçiden fiyat toplama, otomatik satınalma önerisi). | Satınalma › teklif analizi · **3F** | SHOULD |
| 16 | Çek portföyü, ciro, otomatik ödeme hatırlatma | Paraşüt: çek portföyü, bankaya tahsil, tedarikçiye ciro; vadesi gelen faturaya otomatik e-posta. | Cari & Kasa · **4** | MUST (eşdeğer) |
| 17 | Müşteri sipariş portalı genişletmesi | CaterTrax: tekrar sipariş, değişiklik talebi, onay, denetim izi. | Portal · **3D** | COULD |
| 18 | Taşımalı yemek sayıları ve demirbaş (küvet) kaybı | YemekPRO: müşteri × sabah/öğle/akşam/ekstra adet raporu. Çözbim: taşıma yemekte demirbaş takibi. | Siparişler raporu; küvet zimmeti · **3D/5** | MUST |
| 19 | Maliyet merkezi dağıtımı (muhasebe uyumu) | Logo Tiger / Netsis: hizmet maliyet yerleri, genel giderin mamule dağıtılması. | §3.6 anahtarları + muhasebeci dışa aktarımı · **3H/4** | COULD |
| 20 | Veriye doğal dille soru sorma (AI/MCP) | Apicbase MCP sunucusu: canlı veri ChatGPT, Claude veya Copilot'a bağlanır. | Salt okur, RLS'e uyan rapor asistanı · plan sonu | COULD |

### 11.2 Yetenek yetenek öneriler (yalnız işe yarayan özler)

1. **AvT farkı (MUST, 3H).**
   - Bizde POS yok, satış yerine teslim edilen kişi sayısı kullanılır.
   - **Teorik** = Σ(teslim kişi × onaylı reçete sürümündeki 1 kişilik miktar × güncel maliyet).
   - **Fiili** = FIFO üretim tüketimi + kayıtlı fire/artan + sayım farkı (Apicbase formülünün uyarlaması).
   - Fark 3 bileşene ayrılır: (a) fiyat farkı, (b) verim/porsiyon farkı, (c) kontrolsüz stok (sayım farkı).
   - Kırılımlar: gün × öğün × müşteri × malzeme. En çok sapan 10 malzeme listelenir.
   - Yeni sekme açılmaz: Finans › Maliyet'te bir kart ve detay çekmecesi.
2. **Fiyat uyarısı ve 3 yönlü eşleştirme (MUST, 3E).**
   - Fatura satırı, PO fiyatından, geçerli tekliften veya son alıştan eşik (varsayılan %3) üzerinde saparsa **"Düzensiz fiyat"** listesine düşer.
   - Kabul edilirse fiyat güncellenir; reddedilirse tedarikçiden iade/fark faturası talebi açılır. Kabul/red, onay akışına ve `audit_log`'a yazılır.
   - PO ↔ irsaliye (mal kabul) ↔ fatura miktar ve fiyat eşleştirmesi yapılır.
   - Aylık "fiyat değişiminin SMM etkisi" raporu çıkar: malzeme, tedarikçi, ₺ etki.
3. **Verim testi (MUST, 3E/3H).**
   - Stok kartında tedarikçiye göre **ayıklama verimi** tutulur (ör. X tedarikçisinin kuru soğanı %88, Y'ninki %80). Ölçüm: tartılan brüt kg → ayıklanmış net kg.
   - Teklif karşılaştırmasında **gerçek birim maliyet = fiyat ÷ verim** gösterilir; ucuz ama firesi yüksek mal böylece görünür.
   - Reçetenin brüt katsayısı bu verimden beslenir (§3.3).
4. **e-Fatura XML önce (MUST, 3E).**
   - Türkiye'de tedarikçi faturaları çoğunlukla UBL-TR XML olarak gelir. OCR'den daha doğrudur, önce bu içe aktarılır.
   - Satır → `match_ingredient` → güven skoru. Düşük skor inceleme kuyruğuna düşer (MarketMan'deki güven yüzdesi mantığı).
   - Kâğıt fatura ve PDF için OCR/LLM (🔌) COULD. Yedek yol: elle satır girişi.
5. **Dijital teslim (MUST, 5).**
   - Şoför ekranında her durak için: teslim fotoğrafı, müşteri imzası/adı, teslim saati ve sıcaklığı, **dönen küvet** ve **dönen/artan yemek (kg)**.
   - Teslim kanıtı müşteriye e-posta/WhatsApp ile gider (🔌; yedek wa.me linki).
   - Dönen yemek fire/artan kaydına ve kalibrasyona girer.
   - Rota optimizasyonu 🔌 (Google Maps); yedek yol: baş şoförün elle sıralaması.
6. **Fire/artan (elle kayıt MUST, 3H; tartı/kamera COULD).**
   - Mutfak modunda tek büyük düğme **"Fire / Artan"**: tür (hazırlık firesi, üretim fazlası, dönen yemek, tabak artığı), kg, neden kodu, isteğe bağlı fotoğraf.
   - Winnow ve Leanpath vakalarında görülen asıl kazanç, günlük görünürlük ve hedef/alarm mekanizmasından gelir. Bu yüzden: Bugün ekranında "dünkü fire kg ve ₺", haftalık en çok fire veren 5 yemek, eşik aşılınca bildirim.
   - Bluetooth/USB tartı ve kamera entegrasyonu plan sonuna kalır.
7. **Menüden talep + par (SHOULD, 3F).**
   - Menü kalemlerinde ana yöntem §3.7 MRP'dir; par kullanılmaz.
   - **Menü dışı kalemler** (ambalaj, 3 bölmeli kap, peçete, temizlik, tuzluk/ketçap gibi yan malzemeler, LPG) için min/par seviyesi tutulur. Satınalma planında "par'a tamamla" önerisi ayrı sütun olarak görünür, yeni ekran açılmaz.
8. **Tahmin (SHOULD, 3F/3H).**
   - İlk sürümde ML yok. Müşteri × öğün × hafta günü için son 8 haftanın ağırlıklı hareketli ortalaması hesaplanır; resmî tatil ve bayram bayrağı eklenir.
   - Çıktılar: (a) aylık satınalma planında kişi tahmini, (b) **sipariş ↔ fiili teslim farkına** göre öğün bazında üretim tamponu önerisi (ör. +%2).
   - Tahmin/fiili hata oranı raporlanır.
9. **Geriye planlama (SHOULD, 3C ek).**
   - İş emri, sevk saatinden geriye başlama saati hesaplar (hazırlık ve pişirme süresi).
   - Kahvaltı hazırlığı önceki akşama düşer.
   - Aynı alt reçete (pilav, sos) tüm firmalar için tek partide birleştirilir, sonra firma/kap bazında bölünür.
10. **HACCP ve izlenebilirlik (SHOULD, 3C ek / 3E / 5).**
    - İş emrindeki kritik kontrol noktalarına (KKN) ölçüm girişi yapılır: pişirme çekirdek sıcaklığı, soğutma, sevk sıcaklığı. Sınır dışı değer düzeltici faaliyet kaydı ister.
    - Sınır değerleri ayarlanabilir varsayılanlardır; mevzuatı kullanıcı teyit eder.
    - Şahit numune kaydı tutulur (saklama süresi ayarlanabilir; mevzuata göre teyit edilir).
    - **Geri izleme raporu:** tedarikçi partisi → hangi üretim → hangi firma/öğün. `stock_lots` zaten var (Apicbase traceability eşdeğeri).
    - Kablosuz sıcaklık sensörü 🔌 COULD.
11. **Alerjen matrisi ve etiket (SHOULD, 3D / 3C ek).**
    - Menünün alerjen matrisi reçetelerden otomatik türer. Tedarikçi veya stok değişince yeniden hesaplanır (Nutritics).
    - Müşteri hassasiyeti (§5, 18.2) ile çakışırsa üretim emrinde kırmızı uyarı çıkar.
    - A4 raporun yanında küvet/kap etiketi basılır: yemek, firma, öğün, üretim ve son tüketim saati, alerjen.
12. **Günlük prime cost (SHOULD, 8).**
    - Bugün ekranında patron kartı, dün için: teslim edilen kişi, gelir (sözleşme fiyatı × teslim), FIFO SMM, işçilik (puantaj saat × saat maliyeti).
    - Hesaplananlar: prime cost %, kişi başı marj, önceki hafta ile kıyas.
    - Veri 3H ve 6'dan gelir, yeni sekme açılmaz.
13. **Öğün başı işçilik (SHOULD, 6/3H).**
    - Puantaj satırları istasyon/öğün etiketi alabilir (varsayılan vardiya → öğün eşlemesi).
    - Çıktılar: "kişi başı işçilik ₺" ve "personel-saat başına porsiyon".
    - Bu veri §3.6 personel havuzunun dağıtım anahtarı olur.
14. **Menü mühendisliği (SHOULD, 7).**
    - Toplu yemekte popülerlik satış adedi değildir. Popülerlik = (a) seçmeli menülerde seçilme oranı, (b) **düşük dönen yemek oranı**, (c) düşük şikâyet; bunlardan bileşik skor hesaplanır.
    - Kârlılık = kişi başı katkı payı.
    - Kârlılık sekmesinde 4 çeyrekli matris gösterilir; menü planlamada Köpek yemekleri için değiştirme önerisi çıkar.
15. **Teklif toplama linki (SHOULD, 3F).**
    - Satınalma planından tedarikçiye tokenlı teklif formu gönderilir (portal benzeri, e-posta/WhatsApp 🔌, yedek: link kopyala).
    - Gelen teklifler otomatik olarak marka × fiyat × verim karşılaştırmasına düşer; tasarruf raporu buradan çıkar.
16. **Diğerleri:**
    - Çek/ciro/hatırlatma, Paraşüt ile eşdeğer olmalıdır (MUST, 4).
    - YemekPRO'daki müşteri × öğün adet raporu, Siparişler raporunda bulunur (MUST, 3D).
    - Küvet zimmeti ve kayıp takibi (MUST, 5).
    - Muhasebeci için maliyet merkezi dışa aktarımı (COULD).
    - CaterTrax'teki "geçen haftayı kopyala" ve değişiklik talebi (COULD).
    - Salt okur AI rapor asistanı: RLS'e uyar, yalnız SELECT (COULD).

### 11.3 Bilinçli olarak almadıklarımız
- POS/masa/adisyon, kadeh (pour-cost) maliyeti: Craftable'da güçlü ama bizim işe uymuyor.
- Etkinlik/davet catering takvimi: CaterTrax, Caterease.
- Restoran vardiya planlamasının 15 dakikalık talep eğrileri: Crunchtime. Bizde vardiya sabit.
- Bu alanlar için sekme **açılmaz**.

### 11.4 Kaynaklar (27.09.2026'da erişildi)
- Apicbase:
  - https://support.apicbase.com/help/the-management-figures-dashboard-guide
  - https://support.apicbase.com/help/cogs-dashboard
  - https://get.apicbase.com/food-cost-variance/
  - https://get.apicbase.com/food-cost-control/
  - https://get.apicbase.com/menu-engineering/
  - https://get.apicbase.com/production-planning/
  - https://get.apicbase.com/food-traceability-software/
- Winnow:
  - https://www.winnowsolutions.com/resources/news/global-catering-company-iss-is-pioneering-ai-in-the-fight-against-food-waste
  - https://cdn2.hubspot.net/hubfs/650776/Downloads/ESS-Case-study.pdf
- Leanpath:
  - https://www.leanpath.com/products/food-waste-tracking/
  - https://blog.leanpath.com/leanpath-makes-it-faster-and-easier-to-cut-food-waste-and-costs-with-new-suite-of-tools
- MarketMan:
  - https://www.marketman.com/platform/restaurant-purchasing-software-and-order-management
  - https://www.marketman.com/platform/marketman-accounts-payable-automation
  - https://mealticket.my.site.com/helpcenter/s/article/IrregularPricesReport65d62ff1a57eb
- Galley:
  - https://support.galleysolutions.com/how-the-production-planner-works
  - https://support.galleysolutions.com/menus-building-managing-costing-and-completing
  - https://www.galleysolutions.com/recipe-food-costing-software-for-foodservice
- Restaurant365:
  - https://docs.restaurant365.com/docs/sales-and-prime-cost
  - https://docs.restaurant365.com/docs/vendor-contract-price-verification
  - https://docs.restaurant365.com/docs/ap-capture-ai-1
- Crunchtime:
  - https://www.crunchtime.com/inventory-management/food-cost-management
  - https://www.crunchtime.com/restaurant-forecasting
- Fourth/StarChef: https://www.starchef.net/help/dishes/specifying_recipe_yield.htm
- Nutritics: https://www.nutritics.com/en/allergen-labelling-natashas-law-compliance/
- FoodDocs: https://www.fooddocs.com/haccp-plan · https://www.fooddocs.com/knowledge/how-to-integrate-sensors
- Jolt: https://www.jolt.com/solutions/digital-food-safety/
- Kitchen CUT: https://kitchencut.com/menu-engineering/
- Craftable: https://help.craftable.com/learning/menu-engineering-report
- Procurement Partners: https://procurementpartners.com/features/
- CaterTrax: https://www.catertrax.com/enterprise
- Cybake: https://cybake.com/bakery-software/wholesale/driver-delivery-app/
- meez: https://intercom.help/getmeez/en/articles/13402676-importing-your-recipes
- Petpooja: https://blog.petpooja.com/procurement-cost-control/central-kitchen-management-multi-outlet-stock-guide/
- Çözbim: https://cozbim.com.tr/urun/yemekci-mrp-erp-sistemi/ · https://cozbim.com.tr/satin-alma-sureclerinin-kontrolu/
- YemekPRO: https://yemekpro.com/musteri-sayilari/
- CateringSis: https://yemekuretimprogrami.com/
- YamanSoft: https://www.yamansoftsystem.com/en/urunlerimiz/catering-erp
- Logo: https://www.logo.com.tr/blog/blog-detay/gida-sektorune-logo-yazilim-destegi · https://www.logouzakdestek.com/single-post/logo-destek-tiger-uretim-hizmet-maliyet-yerleri
- Mikro: https://buluo.mikro.com.tr/s/article/Re%C3%A7ete-Kullanarak-%C3%9Cretim-Evra%C4%9F%C4%B1-Olu%C5%9Fturma
- Paraşüt: https://www.parasut.com/blog/parasutte-cek-yonetimi · https://www.parasut.com/kullanim-kilavuzu/musterinize-odeme-hatirlatma

*Not: Nebim (perakende/giyim odaklı), "Foodsoft", Weezy ve Optimum Control için catering senaryomuza özgü, doğrulanabilir bir özellik kaynağı bulunamadı; uydurmamak için tabloya alınmadı. Optimum Control yalnızca ayrı bir otel/restoran envanter ve reçete sistemi olarak görüldü (https://www.jcrsystems.com/optimum-control/).*
