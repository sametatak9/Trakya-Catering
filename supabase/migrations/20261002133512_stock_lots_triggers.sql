-- Faz 3E-1c: parti tetikleyicileri. Eşleştirme (a_) → single_entry doğrulaması → parti aç (z_) → çıkışta FEFO/FIFO dağıtım.
-- Muhasebe kuralı korunur: gider yalnız sync_invoice_entry'de (fatura onayı); parti, sevk ve üretim gider yazmaz.

-- Ortalama maliyeti açık partilerden yeniden hesapla (fatura sonradan gelip fiyatı düzelttiğinde).
-- private şeması API'ye açık değildir; yalnız tetikleyiciden çağrılır.
create or replace function private.recalc_avg_cost(p_ing uuid) returns void
language sql security definer set search_path = '' as $$
  update public.ingredients i set avg_cost = coalesce((
    select round(sum(l.qty_remaining * l.unit_cost) / nullif(sum(l.qty_remaining), 0), 6)
      from public.stock_lots l where l.ingredient_id = p_ing and l.status = 'acik' and l.unit_cost is not null and l.qty_remaining > 0), i.avg_cost)
   where i.id = p_ing;
$$;

-- Fatura ↔ sipariş teslimi: aynı mal ikinci kez stoğa girmez, var olan partiyi tamamlar (hareket yazılmaz, NULL döner)
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
create or replace trigger stock_movements_a_lot_match before insert on public.stock_movements for each row execute function public.stock_lot_match();

-- Giriş: parti aç
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
create or replace trigger stock_movements_z_lot_open before insert on public.stock_movements for each row execute function public.stock_lot_open();

-- Çıkış: FEFO (SKT en yakın), yoksa FIFO (en eski). Yetmeyen miktar "partisiz çıkış".
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
create or replace trigger stock_movements_lot_consume after insert on public.stock_movements for each row execute function public.stock_lot_consume();

-- Birim değişimi (kg → g gibi aynı boyut): partiler ve dağılımlar da çevrilir
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
create or replace trigger ingredients_lots_unit after update of stock_unit on public.ingredients for each row
  when (old.stock_unit is distinct from new.stock_unit) execute function public.stock_lots_unit_convert();
