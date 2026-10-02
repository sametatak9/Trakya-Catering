-- Faz 3E-1a: parti tabloları (bağlantı denemesi; küçük parça)
create table if not exists public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  received_on date not null default current_date,
  qty_in numeric(14,4) not null check (qty_in > 0),
  qty_remaining numeric(14,4) not null check (qty_remaining >= 0),
  created_at timestamptz not null default now()
);
alter table public.stock_lots enable row level security;
