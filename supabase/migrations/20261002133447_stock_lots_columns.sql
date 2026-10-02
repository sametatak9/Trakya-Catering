-- Faz 3E-1b: parti sütunları, indeksler, RLS, çıkış dağılımı tablosu, hareket ekleri
alter table public.stock_lots add column if not exists purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null;
alter table public.stock_lots add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null;
alter table public.stock_lots add column if not exists source_movement_id uuid unique;
alter table public.stock_lots add column if not exists unit_cost numeric(14,6) check (unit_cost is null or unit_cost >= 0);
alter table public.stock_lots add column if not exists lot_no text;
alter table public.stock_lots add column if not exists expiry_date date;
alter table public.stock_lots add column if not exists status text not null default 'acik' check (status in ('acik', 'bitti', 'imha'));
alter table public.stock_lots add column if not exists source text not null default 'elle' check (source in ('pok', 'fatura', 'acilis', 'sayim', 'elle'));
alter table public.stock_lots add column if not exists note text;
alter table public.stock_lots add column if not exists updated_at timestamptz not null default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'stock_lots_remaining_le_in') then
    alter table public.stock_lots add constraint stock_lots_remaining_le_in check (qty_remaining <= qty_in);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'stock_lots' and policyname = 'stock_lots_read') then
    create policy stock_lots_read on public.stock_lots for select to authenticated using ((select public.is_staff()));
  end if;
end $$;
comment on table public.stock_lots is 'Faz 3E: tedarikçi etiketli stok partisi. Yalnız stok hareketi tetikleyicileriyle yazılır; istemci okur.';
create unique index if not exists stock_lots_invoice_ing_uidx on public.stock_lots (purchase_invoice_id, ingredient_id) where purchase_invoice_id is not null;
create unique index if not exists stock_lots_po_ing_uidx on public.stock_lots (purchase_order_id, ingredient_id) where purchase_order_id is not null;
create index if not exists stock_lots_open_idx on public.stock_lots (ingredient_id, expiry_date nulls last, received_on, created_at) where status = 'acik';
create index if not exists stock_lots_supplier_idx on public.stock_lots (supplier_id);

create table if not exists public.stock_lot_allocations (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.stock_movements(id) on delete cascade,
  lot_id uuid references public.stock_lots(id) on delete restrict,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  qty numeric(14,4) not null check (qty > 0),
  unit_cost numeric(14,6),
  created_at timestamptz not null default now()
);
create index if not exists stock_lot_alloc_mv_idx on public.stock_lot_allocations (movement_id);
create index if not exists stock_lot_alloc_lot_idx on public.stock_lot_allocations (lot_id);
create index if not exists stock_lot_alloc_unlot_idx on public.stock_lot_allocations (ingredient_id, created_at desc) where lot_id is null;
alter table public.stock_lot_allocations enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'stock_lot_allocations' and policyname = 'stock_lot_allocations_read') then
    create policy stock_lot_allocations_read on public.stock_lot_allocations for select to authenticated using ((select public.is_staff()));
  end if;
end $$;

alter table public.stock_movements add column if not exists lot_id uuid references public.stock_lots(id) on delete set null;
alter table public.stock_movements add column if not exists purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null;
alter table public.stock_movements add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null;
alter table public.stock_movements add column if not exists lot_no text;
alter table public.stock_movements add column if not exists expiry_date date;
create index if not exists stock_movements_lot_idx on public.stock_movements (lot_id) where lot_id is not null;
grant select on public.stock_lots, public.stock_lot_allocations to authenticated;
