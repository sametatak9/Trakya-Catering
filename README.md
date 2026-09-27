# Trakya Catering · Üretim & Maliyet ERP

Toplu yemek fabrikası ERP'si. Akış: reçete (gramaj) → D-1 sipariş → hammadde patlatma (MRP) → stok → sevkiyat irsaliyesi → toplu e-fatura → aylık net kâr.

**Stack:** React 19 · Vite · TypeScript · Tailwind v4 · TanStack Query · Supabase (Auth + Postgres + RLS)

## Kurulum

```bash
bun install            # veya npm install
cp .env.example .env.local
bun run dev            # http://localhost:3000
```

İlk kayıt olan kullanıcı otomatik **yönetici** olur. Sonraki kullanıcılar kayıt olur ve yönetici *Ekip & Yetkiler* ekranından rol atayana kadar hiçbir veriye erişemez.

## Komutlar

| Komut | İş |
|---|---|
| `bun run lint` | TypeScript kontrolü |
| `bun run test` | Birim testleri (maliyet matematiği, biçimlendirme) |
| `bun run build` | Üretim derlemesi |
| `bun run build:demo` | Tanıtım (demo) derlemesi — Supabase gerekmez |
| `bun run build:demo-static` | Demo, `#/yol` yönlendirmeli ve göreli yollu (her statik barındırmada çalışır) |

SQL senaryo testleri: `supabase/tests/*.sql` (transaction içinde çalışır, `ROLLBACK` ile biter).

## Veritabanı ve migration'lar

- Migration'lar Supabase MCP `apply_migration` ile uygulanır. **Dosya adı = canlıdaki sürüm numarası** (`list_migrations` çıktısı); böylece `supabase db push` hiçbir dosyayı ikinci kez çalıştırmaz.
- Yalnız eklemeli değişiklik: tablo/sütun silinmez, yeniden adlandırılmaz.
- Her migration önce `begin … rollback` içinde test senaryosuyla denenir, sonra uygulanır; ardından `generate_typescript_types` → `src/lib/database.types.ts`, `get_advisors` (yeni WARN yok).
- Yetki kuralları veritabanındadır (RLS + tetikleyiciler): maaş/IBAN yalnız yönetici-muhasebe, fiyat sütunları yalnız fiyat/stok kaydıyla değişir, stok hareketi değişmez (ters kayıt), denetim kaydı hash zinciriyle mühürlüdür.
- Ayrıntılı iş planı: `docs/PLAN.md` · İş listesi: `docs/BACKLOG.md` · Faz raporları: `docs/raporlar/`.

## Maliyet matematiği

- Reçete satırı **net** miktar tutar (temizlenmiş, tencereye giren; g / ml / adet).
- **Brüt** (depodan çıkan) = net / (1 − fire% / 100)
- Satır maliyeti = brüt (stok biriminde) × son alış fiyatı
- Porsiyon maliyeti = Σ satır · Menü maliyeti = Σ (porsiyon maliyeti × porsiyon katsayısı)

Doğruluk kaynağı veritabanıdır (`v_recipe_lines`, `v_recipe_costs`, `v_menu_costs`, `recipe_scale()`); `src/lib/cost.ts` aynı formülü editördeki canlı önizleme için kullanır.

> Örnek: 1.200 porsiyon Orman Kebabı → 144 kg net / 160 kg brüt kuşbaşı (%10 fire). Porsiyon maliyeti 83,99 ₺.

## Roller

`yonetici`, `asci_basi`, `depo`, `satinalma`, `muhasebe`, `sofor`, `musteri` (portal). Yetkiler **RLS** ile veritabanında uygulanır; hiçbir tabloda `using (true)` yoktur. Tüm değişiklikler `audit_log`'a yazılır.

## Ekranlar

Bugün · Günlük Hazırlık & Maliyet · Mutfak Ekranı · Kahvaltı · Menü Planı · Reçeteler & Gramaj · Menüler · Hammaddeler · Siparişler · Müşteriler · Finans Özeti · Giderler · Gelen Faturalar · Kasa & Gelirler · Ekip & Yetkiler

Otomatik akışlar (veritabanı trigger'ları):
- Sipariş **teslim edildi** → gelir (alacak) kaydı, vade müşteri kartından
- Gelen fatura **onaylandı** → gider (borç) kaydı, tedarikçinin kategorisi hatırlanır
- Hazırlık satırı → birim fiyat kayıt anında sabitlenir (sonraki zamlar geçmişi bozmaz)
- Siparişler + menü planı → günün yemek başlıkları ve kişi sayıları (`plan_prep_from_orders`)

Her sekmede **Rapor**: logolu antet + holografik mühür, Yazdır/PDF, Excel (CSV), WhatsApp.

Her ekranda: **Asistan & bildirim merkezi** (zam, vadesi geçen alacak, yaklaşan ödeme, eksik fiyat, gelmeyen sipariş, yüksek yemek maliyeti — `src/lib/alerts.ts`), **ekip sohbeti** (kanallar + hazır talep düğmeleri, Realtime), listelerde **çoklu seçim + toplu işlem**. Reçetede **Güncelle** son alış fiyatlarıyla maliyeti yeniler ve geçmişe yazar. **Mutfak Ekranı**: büyük yazı, simge, adım adım, sesli okuma.

## Demo (tıklanabilir tanıtım)

`VITE_DEMO=1` ile derlenen sürüm Supabase'e hiç bağlanmaz: `src/demo/` tarayıcı içinde PostgREST + Auth taklidi yapar
(görünümler, tetikleyiciler ve RPC'ler SQL'in birebir JS karşılığı, `engine.test.ts` ile doğrulanır). Örnek veri her gün
"bugün"e göre yeniden kurulur (bugün 850 kişilik karnıyarık senaryosu). Rol seçerek giriş yapılır; değişiklikler yalnız o
tarayıcıda saklanır ve "Sıfırla" ile silinir. Gerçek kurulumda demo kodu ayrı parçada kalır, yüklenmez.

## Yol haritası

Bkz. [`docs/PLAN.md`](docs/PLAN.md).
