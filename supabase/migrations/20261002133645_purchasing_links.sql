-- Faz 3E-2b: fiyat geçmişi tedarikçi/fatura bağı, düzensiz fiyat (%3) kararı, verim testi, PO satırları, talep kaydı.
-- Not: teklif fiyatları supplier_quotes'ta kalır (ingredient_prices.source check'i değiştirilmedi).
alter table public.ingredient_prices add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.ingredient_prices add column if not exists purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null;
alter table public.ingredient_prices add column if not exists invoice_line_no int;
create index if not exists ingredient_prices_hist_idx on public.ingredient_prices (ingredient_id, noted_at desc);

alter table public.purchase_invoices add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
update public.purchase_invoices pi set supplier_id = s.id
  from public.suppliers s where pi.supplier_id is null and pi.supplier_tax_no is not null and s.tax_no = pi.supplier_tax_no;
alter table public.suppliers add column if not exists default_category_code text;

create table if not exists public.price_variance_decisions (
  id uuid primary key default gen_random_uuid(),
  price_id uuid not null unique references public.ingredient_prices(id) on delete cascade,
  decision text not null check (decision in ('kabul', 'red')),
  note text,
  decided_by uuid default auth.uid(),
  decided_at timestamptz not null default now()
);
alter table public.price_variance_decisions enable row level security;
create or replace trigger price_variance_decisions_audit after insert or update or delete on public.price_variance_decisions for each row execute function public.log_audit();

create or replace view public.v_price_variances with (security_invoker = true) as
with p as (
  select ip.*, lag(ip.price) over (partition by ip.ingredient_id order by ip.noted_at) as prev_price
    from public.ingredient_prices ip
)
select p.id as price_id, p.ingredient_id, i.name as ingredient_name, i.stock_unit, p.noted_at, p.price, p.prev_price,
       round((p.price - p.prev_price) / nullif(p.prev_price, 0) * 100, 2) as change_pct,
       p.supplier_id, coalesce(s.name, p.supplier_name) as supplier_name, p.purchase_invoice_id,
       d.decision, d.note as decision_note, d.decided_at
  from p join public.ingredients i on i.id = p.ingredient_id
  left join public.suppliers s on s.id = p.supplier_id
  left join public.price_variance_decisions d on d.price_id = p.id
 where p.prev_price is not null and abs(p.price - p.prev_price) / nullif(p.prev_price, 0) > 0.03;

create table if not exists public.yield_tests (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  test_date date not null default current_date,
  gross_qty numeric(14,4) not null check (gross_qty > 0),
  net_qty numeric(14,4) not null check (net_qty > 0),
  yield_pct numeric(6,2) generated always as (round(net_qty / gross_qty * 100, 2)) stored,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (net_qty <= gross_qty)
);
alter table public.yield_tests enable row level security;

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  qty numeric(14,4) not null check (qty > 0),
  unit_price numeric(14,6) not null default 0 check (unit_price >= 0),
  received_qty numeric(14,4),
  unique (po_id, ingredient_id)
);
alter table public.purchase_order_lines enable row level security;

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  po_id uuid references public.purchase_orders(id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'eposta', 'pdf')),
  message text,
  sent_at timestamptz not null default now(),
  sent_by uuid default auth.uid()
);
alter table public.purchase_requests enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'price_variance_decisions' and policyname = 'pvd_read') then
    create policy pvd_read on public.price_variance_decisions for select to authenticated using ((select public.is_staff()));
    create policy pvd_write on public.price_variance_decisions for insert to authenticated with check ((select public.has_role(array['yonetici', 'satinalma', 'muhasebe'])));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'yield_tests' and policyname = 'yield_tests_read') then
    create policy yield_tests_read on public.yield_tests for select to authenticated using ((select public.is_staff()));
    create policy yield_tests_write on public.yield_tests for insert to authenticated with check ((select public.has_role(array['yonetici', 'satinalma', 'asci_basi'])));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'purchase_order_lines' and policyname = 'pol_read') then
    create policy pol_read on public.purchase_order_lines for select to authenticated using ((select public.is_staff()));
    create policy pol_write on public.purchase_order_lines for all to authenticated
      using ((select public.has_role(array['yonetici', 'satinalma']))) with check ((select public.has_role(array['yonetici', 'satinalma'])));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'purchase_requests' and policyname = 'purchase_requests_read') then
    create policy purchase_requests_read on public.purchase_requests for select to authenticated using ((select public.is_staff()));
    create policy purchase_requests_write on public.purchase_requests for insert to authenticated with check ((select public.has_role(array['yonetici', 'satinalma'])));
  end if;
end $$;

-- PO satırları → purchase_orders.lines jsonb ve toplam (jsonb okunmaya devam eder)
create or replace function public.po_lines_sync() returns trigger
language plpgsql set search_path = 'public' as $$
declare v_po uuid := coalesce(new.po_id, old.po_id);
begin
  update public.purchase_orders set
    lines = coalesce((select jsonb_agg(jsonb_build_object('ingredient_id', l.ingredient_id, 'qty', l.qty, 'unit_price', l.unit_price) order by l.id)
                        from public.purchase_order_lines l where l.po_id = v_po), '[]'::jsonb),
    total = coalesce((select round(sum(l.qty * l.unit_price), 2) from public.purchase_order_lines l where l.po_id = v_po), 0)
   where id = v_po;
  return null;
end $$;
create or replace trigger purchase_order_lines_sync after insert or update or delete on public.purchase_order_lines for each row execute function public.po_lines_sync();
insert into public.purchase_order_lines (po_id, ingredient_id, qty, unit_price)
select po.id, (l->>'ingredient_id')::uuid, sum((l->>'qty')::numeric), max(coalesce((l->>'unit_price')::numeric, 0))
  from public.purchase_orders po cross join lateral jsonb_array_elements(coalesce(po.lines, '[]'::jsonb)) l
 where (l->>'ingredient_id') is not null and (l->>'qty')::numeric > 0
   and exists (select 1 from public.ingredients i where i.id = (l->>'ingredient_id')::uuid)
 group by po.id, (l->>'ingredient_id')::uuid
on conflict (po_id, ingredient_id) do nothing;
grant select on public.price_variance_decisions, public.v_price_variances, public.yield_tests, public.purchase_order_lines, public.purchase_requests to authenticated;
