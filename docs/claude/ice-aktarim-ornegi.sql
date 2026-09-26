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
