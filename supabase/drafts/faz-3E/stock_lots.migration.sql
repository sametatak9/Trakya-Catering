-- Faz 3E-1: tedarikçi etiketli stok partileri (FEFO/FIFO), tek giriş kapısı, fatura ↔ sipariş teslimi eşleştirme.
-- Muhasebe kuralı: gider yalnız sync_invoice_entry'de (fatura onayı). Parti, sevk ve üretim çıkışı asla gider yazmaz.
-- Model: her pozitif stok hareketi bir parti açar; her negatif hareket en erken SKT'li (yoksa en eski) partiden düşer.
-- Mevcut tüm istemci yolları (fatura, sipariş teslimi, üretim, hazırlık, sevk, elle, sayım) değişmeden partili çalışır;
-- receive_stock / consume_stock RPC'leri yeni ekranların tek kapısıdır. Yalnızca eklemeli.

-- 1) Parti tablosu
create table if not exists public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  source_movement_id uuid unique,
  received_on date not null default current_date,
  qty_in numeric(14,4) not null check (qty_in > 0),
  qty_remaining numeric(14,4) not null check (qty_remaining >= 0),
  unit_cost numeric(14,6) check (unit_cost is null or unit_cost >= 0),
  lot_no text,
  expiry_date date,
  status text not null default 'acik' check (status in ('acik', 'bitti', 'imha')),
  source text not null check (source in ('pok', 'fatura', 'acilis', 'sayim', 'elle')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (qty_remaining <= qty_in)
);
comment on table public.stock_lots is 'Faz 3E: tedarikçi etiketli stok partisi. Yalnız stok hareketi tetikleyicileriyle yazılır; istemci okur.';
create unique index if not exists stock_lots_invoice_ing_uidx on public.stock_lots (purchase_invoice_id, ingredient_id) where purchase_invoice_id is not null;
create unique index if not exists stock_lots_po_ing_uidx on public.stock_lots (purchase_order_id, ingredient_id) where purchase_order_id is not null;
create index if not exists stock_lots_open_idx on public.stock_lots (ingredient_id, expiry_date nulls last, received_on, created_at) where status = 'acik';
create index if not exists stock_lots_supplier_idx on public.stock_lots (supplier_id);
alter table public.stock_lots enable row level security;
drop policy if exists stock_lots_read on public.stock_lots;
create policy stock_lots_read on public.stock_lots for select to authenticated using ((select public.is_staff()));

-- 2) Çıkışların partilere dağılımı (lot_id boşsa "partisiz çıkış": stok yetmedi)
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
drop policy if exists stock_lot_allocations_read on public.stock_lot_allocations;
create policy stock_lot_allocations_read on public.stock_lot_allocations for select to authenticated using ((select public.is_staff()));

-- 3) Hareket ekleri
alter table public.stock_movements add column if not exists lot_id uuid references public.stock_lots(id) on delete set null;
alter table public.stock_movements add column if not exists purchase_invoice_id uuid references public.purchase_invoices(id) on delete set null;
alter table public.stock_movements add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null;
alter table public.stock_movements add column if not exists lot_no text;
alter table public.stock_movements add column if not exists expiry_date date;
create index if not exists stock_movements_lot_idx on public.stock_movements (lot_id) where lot_id is not null;

-- 4) Ortalama maliyeti açık partilerden yeniden hesapla (fatura sonradan gelip fiyatı düzelttiğinde)
create or replace function private.recalc_avg_cost(p_ing uuid) returns void
language sql security definer set search_path = '' as $$
  update public.ingredients i set avg_cost = coalesce((
    select round(sum(l.qty_remaining * l.unit_cost) / nullif(sum(l.qty_remaining), 0), 6)
      from public.stock_lots l where l.ingredient_id = p_ing and l.status = 'acik' and l.unit_cost is not null and l.qty_remaining > 0), i.avg_cost)
   where i.id = p_ing;
$$;
revoke all on function private.recalc_avg_cost(uuid) from public, anon, authenticated;

-- 5) Eşleştirme: fatura ↔ sipariş teslimi aynı malı ikinci kez stoğa sokmaz, var olan partiyi tamamlar.
--    Tetikleyici adı "a_" ile başlar: stock_single_entry'den önce çalışır. Eşleşirse hareket yazılmaz (NULL döner).
create or replace function public.stock_lot_match() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare v_po uuid; v_lot record;
begin
  if new.kind <> 'giris' or new.source_id is null then return new; end if;
  if new.source = 'fatura' then
    select purchase_order_id into v_po from public.purchase_invoices where id = new.source_id;
    if v_po is null then return new; end if;
    select * into v_lot from public.stock_lots
     where purchase_order_id = v_po and ingredient_id = new.ingredient_id and purchase_invoice_id is null and source = 'pok' for update;
    if not found then return new; end if;
    update public.stock_lots set purchase_invoice_id = new.source_id, unit_cost = coalesce(new.unit_cost, unit_cost),
           supplier_id = coalesce(supplier_id, new.supplier_id), updated_at = now() where id = v_lot.id;
    update public.stock_lot_allocations set unit_cost = coalesce(new.unit_cost, unit_cost) where lot_id = v_lot.id;
    perform private.recalc_avg_cost(new.ingredient_id);
    return null;
  elsif new.source = 'siparis' then
    select * into v_lot from public.stock_lots l
     where l.ingredient_id = new.ingredient_id and l.purchase_order_id is null and l.source = 'fatura'
       and l.purchase_invoice_id in (select id from public.purchase_invoices where purchase_order_id = new.source_id) for update;
    if not found then return new; end if;
    update public.stock_lots set purchase_order_id = new.source_id, updated_at = now() where id = v_lot.id;
    return null;
  end if;
  return new;
end $$;
revoke all on function public.stock_lot_match() from public, anon, authenticated;
drop trigger if exists stock_movements_a_lot_match on public.stock_movements;
create trigger stock_movements_a_lot_match before insert on public.stock_movements for each row execute function public.stock_lot_match();

-- 6) Giriş: parti aç (single_entry doğrulamasından sonra; "z_" adı en son çalışır)
create or replace function public.stock_lot_open() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare v_lot uuid;
begin
  if new.qty <= 0 or new.kind not in ('giris', 'sayim') then return new; end if;
  if new.source = 'fatura' then new.purchase_invoice_id := coalesce(new.purchase_invoice_id, new.source_id);
    new.purchase_order_id := coalesce(new.purchase_order_id, (select purchase_order_id from public.purchase_invoices where id = new.source_id));
  elsif new.source = 'siparis' then new.purchase_order_id := coalesce(new.purchase_order_id, new.source_id);
  end if;
  insert into public.stock_lots (ingredient_id, supplier_id, purchase_invoice_id, purchase_order_id, source_movement_id, received_on,
                                 qty_in, qty_remaining, unit_cost, lot_no, expiry_date, source, note)
  values (new.ingredient_id, new.supplier_id, new.purchase_invoice_id, new.purchase_order_id, new.id, new.move_date,
          new.qty, new.qty, coalesce(new.unit_cost, (select avg_cost from public.ingredients where id = new.ingredient_id)), new.lot_no, new.expiry_date,
          case when new.source = 'siparis' then 'pok' when new.source = 'fatura' then 'fatura' when new.kind = 'sayim' then 'sayim' else 'elle' end, new.note)
  returning id into v_lot;
  new.lot_id := v_lot;
  return new;
end $$;
revoke all on function public.stock_lot_open() from public, anon, authenticated;
drop trigger if exists stock_movements_z_lot_open on public.stock_movements;
create trigger stock_movements_z_lot_open before insert on public.stock_movements for each row execute function public.stock_lot_open();

-- 7) Çıkış: FEFO (son kullanma tarihi en yakın), yoksa FIFO (en eski giriş). Yetmeyen miktar "partisiz çıkış".
create or replace function public.stock_lot_consume() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare v_need numeric := -new.qty; v_take numeric; l record;
begin
  if new.qty >= 0 then return new; end if;
  for l in select * from public.stock_lots where ingredient_id = new.ingredient_id and status = 'acik' and qty_remaining > 0
            order by expiry_date nulls last, received_on, created_at for update loop
    exit when v_need <= 0;
    v_take := least(v_need, l.qty_remaining);
    update public.stock_lots set qty_remaining = qty_remaining - v_take,
           status = case when qty_remaining - v_take <= 0 then 'bitti' else status end, updated_at = now() where id = l.id;
    insert into public.stock_lot_allocations (movement_id, lot_id, ingredient_id, qty, unit_cost) values (new.id, l.id, new.ingredient_id, v_take, l.unit_cost);
    v_need := v_need - v_take;
  end loop;
  if v_need > 0 then
    insert into public.stock_lot_allocations (movement_id, lot_id, ingredient_id, qty, unit_cost) values (new.id, null, new.ingredient_id, v_need, new.unit_cost);
  end if;
  return new;
end $$;
revoke all on function public.stock_lot_consume() from public, anon, authenticated;
drop trigger if exists stock_movements_lot_consume on public.stock_movements;
create trigger stock_movements_lot_consume after insert on public.stock_movements for each row execute function public.stock_lot_consume();

-- 8) Birim değişimi (kg → g gibi aynı boyut): partiler ve dağılımlar da çevrilir
create or replace function public.stock_lots_unit_convert() returns trigger
language plpgsql security definer set search_path = 'public' as $$
declare f numeric;
begin
  select o.to_base / n.to_base into f from public.units o, public.units n where o.code = old.stock_unit and n.code = new.stock_unit and o.dimension = n.dimension;
  if f is null or f = 1 then return new; end if;
  update public.stock_lots set qty_in = round(qty_in * f, 4), qty_remaining = round(qty_remaining * f, 4), unit_cost = round(unit_cost / f, 6) where ingredient_id = new.id;
  update public.stock_lot_allocations set qty = round(qty * f, 4), unit_cost = round(unit_cost / f, 6) where ingredient_id = new.id;
  return new;
end $$;
revoke all on function public.stock_lots_unit_convert() from public, anon, authenticated;
drop trigger if exists ingredients_lots_unit on public.ingredients;
create trigger ingredients_lots_unit after update of stock_unit on public.ingredients for each row
  when (old.stock_unit is distinct from new.stock_unit) execute function public.stock_lots_unit_convert();

-- 9) Açılış partisi dönüşümü (idempotent): partisi olmayan, eldeki stoğu pozitif kalemler
insert into public.stock_lots (ingredient_id, received_on, qty_in, qty_remaining, unit_cost, source, note)
select m.ingredient_id, current_date, sum(m.qty), sum(m.qty), i.avg_cost, 'acilis', 'Faz 3E açılış partisi'
  from public.stock_movements m join public.ingredients i on i.id = m.ingredient_id
 where not exists (select 1 from public.stock_lots l where l.ingredient_id = m.ingredient_id)
 group by m.ingredient_id, i.avg_cost having sum(m.qty) > 0;

-- 10) Tek giriş kapısı RPC'leri (invoker; yetki stock_movements RLS'inden gelir)
create or replace function public.receive_stock(
  p_ingredient uuid, p_qty numeric, p_unit_cost numeric default null, p_source text default 'elle', p_source_id uuid default null,
  p_supplier uuid default null, p_date date default current_date, p_lot_no text default null, p_expiry date default null,
  p_note text default null, p_reason text default null, p_reason_note text default null)
returns jsonb language plpgsql set search_path = 'public' as $$
declare v_id uuid; v_lot uuid;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Giriş miktarı pozitif olmalı' using errcode = '23514'; end if;
  insert into public.stock_movements (ingredient_id, move_date, kind, qty, unit_cost, source, source_id, supplier_id, lot_no, expiry_date, note, reason, reason_note)
  values (p_ingredient, coalesce(p_date, current_date), 'giris', p_qty, p_unit_cost, coalesce(p_source, 'elle'), p_source_id, p_supplier, p_lot_no, p_expiry, p_note, p_reason, p_reason_note)
  returning id, lot_id into v_id, v_lot;
  if v_id is null then
    select id into v_lot from public.stock_lots where ingredient_id = p_ingredient
       and ((p_source = 'fatura' and purchase_invoice_id = p_source_id) or (p_source = 'siparis' and purchase_order_id = p_source_id)) limit 1;
    return jsonb_build_object('durum', 'eslesti', 'lot_id', v_lot);
  end if;
  return jsonb_build_object('durum', 'giris', 'movement_id', v_id, 'lot_id', v_lot);
end $$;
revoke all on function public.receive_stock(uuid, numeric, numeric, text, uuid, uuid, date, text, date, text, text, text) from public, anon;
grant execute on function public.receive_stock(uuid, numeric, numeric, text, uuid, uuid, date, text, date, text, text, text) to authenticated;

create or replace function public.consume_stock(
  p_ingredient uuid, p_qty numeric, p_source text default 'elle', p_source_id uuid default null, p_kind text default 'cikis',
  p_customer uuid default null, p_date date default current_date, p_note text default null, p_reason text default null, p_reason_note text default null)
returns jsonb language plpgsql set search_path = 'public' as $$
declare v_id uuid; v_unlot numeric;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Çıkış miktarı pozitif girilir (stoktan düşülecek miktar)' using errcode = '23514'; end if;
  insert into public.stock_movements (ingredient_id, move_date, kind, qty, unit_cost, source, source_id, customer_id, note, reason, reason_note)
  select p_ingredient, coalesce(p_date, current_date), coalesce(p_kind, 'cikis'), -p_qty, coalesce(i.avg_cost, i.last_price), coalesce(p_source, 'elle'), p_source_id, p_customer, p_note, p_reason, p_reason_note
    from public.ingredients i where i.id = p_ingredient
  returning id into v_id;
  if v_id is null then raise exception 'Stok kartı bulunamadı' using errcode = '23503'; end if;
  select coalesce(sum(qty), 0) into v_unlot from public.stock_lot_allocations where movement_id = v_id and lot_id is null;
  return jsonb_build_object('movement_id', v_id, 'partisiz', v_unlot,
    'uyari', case when v_unlot > 0 then format('Stok yetersiz: %s birim partisiz çıktı (negatif stok). Sayım veya giriş kaydını kontrol edin.', trim_scale(v_unlot)) end);
end $$;
revoke all on function public.consume_stock(uuid, numeric, text, uuid, text, uuid, date, text, text, text) from public, anon;
grant execute on function public.consume_stock(uuid, numeric, text, uuid, text, uuid, date, text, text, text) to authenticated;

-- 11) Kalem × tedarikçi × kalan (açık partiler)
create or replace view public.v_stock_by_supplier with (security_invoker = true) as
select l.ingredient_id, i.name as ingredient_name, i.stock_unit, l.supplier_id, s.name as supplier_name,
       count(*) as lot_count, sum(l.qty_remaining) as qty_remaining,
       round(sum(l.qty_remaining * coalesce(l.unit_cost, 0)), 2) as value,
       min(l.expiry_date) as nearest_expiry, min(l.received_on) as oldest_received
  from public.stock_lots l join public.ingredients i on i.id = l.ingredient_id left join public.suppliers s on s.id = l.supplier_id
 where l.status = 'acik' and l.qty_remaining > 0
 group by l.ingredient_id, i.name, i.stock_unit, l.supplier_id, s.name;

-- 12) Lot geri izleme: parti → çıkış hareketi → kaynak (üretim/hazırlık/sevk) ve müşteri
create or replace view public.v_lot_trace with (security_invoker = true) as
select l.id as lot_id, l.ingredient_id, i.name as ingredient_name, l.supplier_id, s.name as supplier_name, l.lot_no, l.received_on, l.expiry_date,
       l.purchase_invoice_id, l.purchase_order_id, a.qty, a.unit_cost, m.id as movement_id, m.move_date, m.kind, m.source, m.source_id, m.customer_id, c.name as customer_name, m.note
  from public.stock_lot_allocations a join public.stock_lots l on l.id = a.lot_id join public.stock_movements m on m.id = a.movement_id
  join public.ingredients i on i.id = l.ingredient_id left join public.suppliers s on s.id = l.supplier_id left join public.customers c on c.id = m.customer_id;

grant select on public.stock_lots, public.stock_lot_allocations, public.v_stock_by_supplier, public.v_lot_trace to authenticated;
