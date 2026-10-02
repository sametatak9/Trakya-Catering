-- Faz 3E-1d: açılış partisi dönüşümü, tek giriş/çıkış kapısı RPC'leri (invoker; yetki stock_movements RLS'inden), görünümler.

-- Açılış partisi (idempotent): partisi olmayan, eldeki stoğu pozitif kalemler
insert into public.stock_lots (ingredient_id, received_on, qty_in, qty_remaining, unit_cost, source, note)
select m.ingredient_id, current_date, sum(m.qty), sum(m.qty), i.avg_cost, 'acilis', 'Faz 3E açılış partisi'
  from public.stock_movements m join public.ingredients i on i.id = m.ingredient_id
 where not exists (select 1 from public.stock_lots l where l.ingredient_id = m.ingredient_id)
 group by m.ingredient_id, i.avg_cost having sum(m.qty) > 0;

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
grant execute on function public.consume_stock(uuid, numeric, text, uuid, text, uuid, date, text, text, text) to authenticated;

-- Kalem × tedarikçi × kalan (açık partiler)
create or replace view public.v_stock_by_supplier with (security_invoker = true) as
select l.ingredient_id, i.name as ingredient_name, i.stock_unit, l.supplier_id, s.name as supplier_name,
       count(*) as lot_count, sum(l.qty_remaining) as qty_remaining,
       round(sum(l.qty_remaining * coalesce(l.unit_cost, 0)), 2) as value,
       min(l.expiry_date) as nearest_expiry, min(l.received_on) as oldest_received
  from public.stock_lots l join public.ingredients i on i.id = l.ingredient_id left join public.suppliers s on s.id = l.supplier_id
 where l.status = 'acik' and l.qty_remaining > 0
 group by l.ingredient_id, i.name, i.stock_unit, l.supplier_id, s.name;

-- Lot geri izleme: parti → çıkış hareketi → kaynak ve müşteri
create or replace view public.v_lot_trace with (security_invoker = true) as
select l.id as lot_id, l.ingredient_id, i.name as ingredient_name, l.supplier_id, s.name as supplier_name, l.lot_no, l.received_on, l.expiry_date,
       l.purchase_invoice_id, l.purchase_order_id, a.qty, a.unit_cost, m.id as movement_id, m.move_date, m.kind, m.source, m.source_id, m.customer_id, c.name as customer_name, m.note
  from public.stock_lot_allocations a join public.stock_lots l on l.id = a.lot_id join public.stock_movements m on m.id = a.movement_id
  join public.ingredients i on i.id = l.ingredient_id left join public.suppliers s on s.id = l.supplier_id left join public.customers c on c.id = m.customer_id;

grant select on public.v_stock_by_supplier, public.v_lot_trace to authenticated;
