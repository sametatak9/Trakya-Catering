-- Kullanıcı notu G (Faz 3F): internet toptan referans fiyatı. Bot (Edge Function `market-prices`) herkese açık
-- kaynaklardan (İzmir Büyükşehir açık API hal bülteni vb.) yalnızca AÇIK EŞLEŞEN kalemlerin fiyatını yazar;
-- kaynak yoksa satır yazılmaz, ekran "kaynak yok" gösterir. Fiyat asla tahmin edilmez/üretilmez.
-- YALNIZCA EKLEMELİ: yeni tablo (RLS'li) + index.

create table if not exists public.market_reference_prices (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  price numeric(12,4) not null check (price > 0),
  price_min numeric(12,4) check (price_min is null or price_min > 0),
  price_max numeric(12,4) check (price_max is null or price_max > 0),
  unit text not null,                                   -- kaynağın birimi, stok birimiyle eşleşmiş (kg, adet)
  source_name text not null,
  source_url text not null check (source_url ~ '^https?://'),
  bulletin_date date,                                   -- kaynağın kendi tarihi (bülten günü)
  raw_label text not null,                              -- kaynaktaki ürün adı, birebir
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (ingredient_id, source_url, raw_label)
);
create index if not exists market_reference_prices_ing_idx on public.market_reference_prices (ingredient_id, fetched_at desc);

alter table public.market_reference_prices enable row level security;
create policy market_reference_prices_read on public.market_reference_prices for select to authenticated
  using ((select public.is_staff()));
create policy market_reference_prices_insert on public.market_reference_prices for insert to authenticated
  with check ((select public.has_role(array['yonetici','satinalma'])));
create policy market_reference_prices_delete on public.market_reference_prices for delete to authenticated
  using ((select public.has_role(array['yonetici','satinalma'])));
-- Güncelleme yok: her çekim yeni satırdır (geçmiş korunur). Bot service role ile yazar.
comment on table public.market_reference_prices is
  'Toptan referans fiyatları (bot). Her satır kaynak URL + bülten tarihi + çekilme zamanı + kaynaktaki ad ile. Kaynak yoksa satır yok.';
