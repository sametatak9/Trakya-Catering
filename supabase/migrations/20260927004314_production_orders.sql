-- Faz 3C — Üretim emri akışı + gramaj kalibrasyonu + 1 kişilik reçete + iş emri
create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(), prod_date date not null,
  meal text not null check (meal in ('kahvalti', 'ogle', 'aksam', 'gece')),
  status text not null default 'taslak' check (status in ('taslak', 'kontrol', 'onaylandi', 'uretildi', 'kapandi', 'iptal')),
  total_people numeric(12,2) not null default 0, planned_cost numeric(14,2), actual_cost numeric(14,2),
  anomalies jsonb not null default '[]'::jsonb, checked_by uuid, checked_at timestamptz, approved_by uuid, approved_at timestamptz,
  closed_by uuid, closed_at timestamptz, delivered_orders int, note text, created_by uuid default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (prod_date, meal));
create index if not exists production_orders_status_idx on public.production_orders (status, prod_date desc);
drop trigger if exists production_orders_updated_at on public.production_orders;
create trigger production_orders_updated_at before update on public.production_orders for each row execute function public.set_updated_at();
alter table public.stock_movements drop constraint if exists stock_movements_source_check;
alter table public.stock_movements add constraint stock_movements_source_check check (source in ('fatura', 'hazirlik', 'sevk', 'elle', 'sayim', 'siparis', 'uretim'));
alter table public.prep_batches add column if not exists production_order_id uuid references public.production_orders(id) on delete set null;
alter table public.prep_batches add column if not exists recipe_snapshot jsonb;
create index if not exists prep_batches_po_idx on public.prep_batches (production_order_id);
create table if not exists public.recipe_calibrations (
  id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade, prep_batch_id uuid references public.prep_batches(id) on delete set null,
  prep_date date not null default current_date, portions numeric(12,2) not null check (portions > 0),
  used_qty_base numeric(16,3) not null check (used_qty_base >= 0),
  per_portion_base numeric(14,4) generated always as (used_qty_base / portions) stored,
  included boolean not null default true, reason text, created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  unique (prep_batch_id, ingredient_id));
create index if not exists recipe_calibrations_recipe_idx on public.recipe_calibrations (recipe_id, ingredient_id, prep_date desc);
create index if not exists recipe_calibrations_ingredient_idx on public.recipe_calibrations (ingredient_id);
alter table public.recipe_ingredients add column if not exists calib_qty numeric(12,3);
alter table public.recipe_ingredients add column if not exists calib_n int not null default 0;
alter table public.recipe_ingredients add column if not exists calib_cv numeric(8,4);
alter table public.recipe_ingredients add column if not exists calib_updated_at timestamptz;
alter table public.recipe_ingredients add column if not exists calib_mode text not null default 'manuel';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'recipe_ingredients_calib_mode_check') then
    alter table public.recipe_ingredients add constraint recipe_ingredients_calib_mode_check check (calib_mode in ('manuel', 'otomatik', 'kilitli'));
  end if;
end $$;
comment on column public.recipe_ingredients.calib_mode is 'manuel: üretimler yalnız öneri üretir (varsayılan; reçete bir kez kurulur) · otomatik: öneri net miktara yazılır · kilitli: hiç değişmez';
alter table public.recipe_ingredients add column if not exists cut_style text;
alter table public.recipe_ingredients add column if not exists prep_note text;
alter table public.recipes add column if not exists storage_container text;
alter table public.recipes add column if not exists storage_temp text;
alter table public.recipes add column if not exists shelf_life_hours int;
create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.recipes(id) on delete cascade,
  sort int not null default 0, station text not null default 'pisirme' check (station in ('hazirlik', 'pisirme', 'soguk', 'paketleme')),
  body text not null check (length(trim(body)) > 0), minutes int check (minutes is null or minutes >= 0), temp_c numeric(5,1),
  ccp boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists recipe_steps_recipe_idx on public.recipe_steps (recipe_id, sort);
drop trigger if exists recipe_steps_updated_at on public.recipe_steps;
create trigger recipe_steps_updated_at before update on public.recipe_steps for each row execute function public.set_updated_at();
create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(), production_order_id uuid not null references public.production_orders(id) on delete cascade,
  revision int not null, meal text not null, snapshot jsonb not null, print_count int not null default 0, printed_at timestamptz,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), unique (production_order_id, revision));
do $$
declare t text;
begin
  foreach t in array array['production_orders', 'recipe_calibrations', 'recipe_steps', 'work_orders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_staff()))', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.has_role(array[''yonetici'',''asci_basi'',''diyetisyen''])))', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.has_role(array[''yonetici'',''asci_basi'',''diyetisyen'']))) with check ((select public.has_role(array[''yonetici'',''asci_basi'',''diyetisyen''])))', t || '_update', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.log_audit()', t || '_audit', t);
  end loop;
end $$;
drop policy if exists recipe_steps_delete on public.recipe_steps;
create policy recipe_steps_delete on public.recipe_steps for delete to authenticated using ((select public.has_role(array['yonetici', 'asci_basi', 'diyetisyen'])));
revoke delete, truncate on public.production_orders, public.recipe_calibrations, public.work_orders from authenticated;
create or replace function public.production_orders_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_flag text := current_setting('trakya.po_transition', true);
begin
  if old.status in ('kapandi', 'iptal') then raise exception 'Kapanmış veya iptal edilmiş üretim emri değiştirilemez' using errcode = '42501'; end if;
  if new.status is distinct from old.status then
    if new.status in ('onaylandi', 'kapandi') and v_flag is distinct from new.id::text then
      raise exception 'Onay ve kapanış yalnız üretim emri ekranından yapılır' using errcode = '42501';
    end if;
    if not ((old.status = 'taslak' and new.status in ('kontrol', 'iptal')) or (old.status = 'kontrol' and new.status in ('taslak', 'onaylandi', 'iptal'))
         or (old.status = 'onaylandi' and new.status in ('uretildi', 'kapandi', 'iptal')) or (old.status = 'uretildi' and new.status in ('kapandi', 'iptal'))) then
      raise exception 'Geçersiz durum geçişi: % → %', old.status, new.status using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.production_orders_guard() from public, anon, authenticated;
drop trigger if exists production_orders_guard on public.production_orders;
create trigger production_orders_guard before update on public.production_orders for each row execute function public.production_orders_guard();
create or replace function public.work_orders_guard()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.snapshot is distinct from old.snapshot or new.revision is distinct from old.revision
     or new.production_order_id is distinct from old.production_order_id or new.meal is distinct from old.meal then
    raise exception 'Basılmış iş emri değiştirilemez; değişiklik yeni revizyondur' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function public.work_orders_guard() from public, anon, authenticated;
drop trigger if exists work_orders_guard on public.work_orders;
create trigger work_orders_guard before update on public.work_orders for each row execute function public.work_orders_guard();
drop policy if exists work_orders_update on public.work_orders;
drop policy if exists work_orders_print on public.work_orders;
create policy work_orders_print on public.work_orders for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create or replace function public.weighted_median(p_values numeric[], p_weights numeric[])
returns numeric language sql immutable set search_path = public as $$
  with x as (select v, w, sum(w) over (order by v, ord) as cum, sum(w) over () as tot from unnest(p_values, p_weights) with ordinality as t(v, w, ord) where w > 0)
  select v from x where cum >= tot / 2 order by v limit 1;
$$;
create or replace function public.recalibrate_recipe(p_recipe_id uuid)
returns int language plpgsql security invoker set search_path = public as $$
declare r record; v_med numeric; v_mean numeric; v_sd numeric; v_n int; v_waste numeric; v_changed int := 0; v_ids uuid[];
begin
  for r in select ri.id, ri.ingredient_id, ri.net_qty, ri.calib_mode, coalesce(ri.waste_pct_override, i.waste_pct) as waste
             from public.recipe_ingredients ri join public.ingredients i on i.id = ri.ingredient_id where ri.recipe_id = p_recipe_id loop
    select array_agg(id) into v_ids from (select id from public.recipe_calibrations
       where recipe_id = p_recipe_id and ingredient_id = r.ingredient_id and coalesce(reason, '') <> 'elle' order by prep_date desc, created_at desc limit 10) s;
    if v_ids is null then continue; end if;
    select public.weighted_median(array_agg(per_portion_base), array_agg(portions)) into v_med from public.recipe_calibrations where id = any(v_ids);
    update public.recipe_calibrations set included = abs(per_portion_base - v_med) <= 0.3 * v_med,
           reason = case when abs(per_portion_base - v_med) <= 0.3 * v_med then null else 'aykırı' end where id = any(v_ids);
    select public.weighted_median(array_agg(per_portion_base), array_agg(portions)), avg(per_portion_base), stddev_samp(per_portion_base), count(*)
      into v_med, v_mean, v_sd, v_n from public.recipe_calibrations where id = any(v_ids) and included;
    if v_med is null then continue; end if;
    v_waste := coalesce(r.waste, 0);
    update public.recipe_ingredients set calib_qty = round(v_med * (1 - v_waste / 100), 3), calib_n = v_n,
           calib_cv = case when v_mean > 0 and v_sd is not null then round(v_sd / v_mean, 4) end, calib_updated_at = now(),
           net_qty = case when r.calib_mode = 'otomatik' then round(v_med * (1 - v_waste / 100), 3) else net_qty end where id = r.id;
    if r.calib_mode = 'otomatik' and round(v_med * (1 - v_waste / 100), 3) <> r.net_qty then v_changed := v_changed + 1; end if;
  end loop;
  if v_changed > 0 then
    insert into public.recipe_cost_snapshots (recipe_id, cost, note)
    select recipe_id, cost_last, format('Kalibrasyon (otomatik): %s malzeme güncellendi', v_changed) from public.v_recipe_costs where recipe_id = p_recipe_id;
  end if;
  return v_changed;
end $$;
create or replace function public.apply_calibration(p_recipe_id uuid)
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  update public.recipe_ingredients set net_qty = calib_qty where recipe_id = p_recipe_id and calib_qty is not null and calib_qty > 0 and calib_mode <> 'kilitli' and net_qty <> calib_qty;
  get diagnostics n = row_count;
  if n > 0 then insert into public.recipe_cost_snapshots (recipe_id, cost, note) select recipe_id, cost_last, format('Kalibrasyon önerisi uygulandı: %s malzeme', n) from public.v_recipe_costs where recipe_id = p_recipe_id; end if;
  return n;
end $$;
create or replace function public.calibrations_from_batch(p_batch_id uuid)
returns int language plpgsql security invoker set search_path = public as $$
declare b record; n int;
begin
  select * into b from public.prep_batches where id = p_batch_id;
  if b.recipe_id is null or coalesce(b.portions, 0) <= 0 then return 0; end if;
  insert into public.recipe_calibrations (recipe_id, ingredient_id, prep_batch_id, prep_date, portions, used_qty_base)
  select b.recipe_id, it.ingredient_id, b.id, b.prep_date, b.portions, sum(it.qty * u.to_base)
    from public.prep_batch_items it join public.units u on u.code = it.unit where it.batch_id = b.id and it.ingredient_id is not null group by it.ingredient_id
  on conflict (prep_batch_id, ingredient_id) do update set used_qty_base = excluded.used_qty_base, portions = excluded.portions;
  get diagnostics n = row_count;
  return n;
end $$;
create or replace function public.recipe_from_first_production(p_recipe_id uuid, p_people numeric, p_items jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare v_has boolean; n int;
begin
  if coalesce(p_people, 0) <= 0 then raise exception 'Kişi sayısı girin' using errcode = '23514'; end if;
  select exists (select 1 from public.recipe_ingredients where recipe_id = p_recipe_id) into v_has;
  if not v_has then
    insert into public.recipe_ingredients (recipe_id, ingredient_id, net_qty, sort, note)
    select p_recipe_id, (x->>'ingredient_id')::uuid, round((x->>'qty')::numeric * u.to_base / p_people * (1 - i.waste_pct / 100), 3), ord::int, 'İlk üretimden (1 kişilik)'
      from jsonb_array_elements(p_items) with ordinality t(x, ord)
      join public.ingredients i on i.id = (x->>'ingredient_id')::uuid join public.units u on u.code = coalesce(x->>'unit', i.stock_unit)
     where (x->>'qty')::numeric > 0
    on conflict (recipe_id, ingredient_id) do nothing;
    get diagnostics n = row_count;
    insert into public.recipe_cost_snapshots (recipe_id, cost, note) select recipe_id, cost_last, format('İlk üretim: %s kişi', p_people) from public.v_recipe_costs where recipe_id = p_recipe_id;
    return n;
  end if;
  insert into public.recipe_calibrations (recipe_id, ingredient_id, portions, used_qty_base)
  select p_recipe_id, (x->>'ingredient_id')::uuid, p_people, (x->>'qty')::numeric * u.to_base
    from jsonb_array_elements(p_items) x join public.ingredients i on i.id = (x->>'ingredient_id')::uuid join public.units u on u.code = coalesce(x->>'unit', i.stock_unit)
   where (x->>'qty')::numeric > 0;
  get diagnostics n = row_count;
  perform public.recalibrate_recipe(p_recipe_id);
  return n;
end $$;
create or replace function public.recipe_from_prep(p_batch_id uuid, p_category text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare b record; v_recipe uuid; v_cat text;
begin
  select * into b from public.prep_batches where id = p_batch_id;
  if not found then raise exception 'Hazırlık bulunamadı' using errcode = '42501'; end if;
  if b.portions is null then raise exception 'Porsiyon sayısı olmadan reçete türetilemez' using errcode = '23514'; end if;
  v_cat := coalesce(p_category, case b.course when 'corba' then 'corba' when 'ana' then 'ana_yemek' when 'yardimci' then 'pilav_makarna'
    when 'salata' then 'salata_meze' when 'meze' then 'salata_meze' when 'tatli' then 'tatli' when 'icecek' then 'icecek' when 'ekmek' then 'ekmek' when 'kahvalti' then 'kahvalti' else 'ana_yemek' end);
  v_recipe := b.recipe_id;
  if v_recipe is null then select id into v_recipe from public.recipes where lower(name) = lower(trim(b.dish_name)); end if;
  if v_recipe is null then insert into public.recipes (name, category_code) values (trim(b.dish_name), v_cat) returning id into v_recipe; end if;
  update public.prep_batches set recipe_id = v_recipe where id = p_batch_id;
  if exists (select 1 from public.recipe_ingredients where recipe_id = v_recipe) then
    perform public.calibrations_from_batch(p_batch_id);
    perform public.recalibrate_recipe(v_recipe);
    return v_recipe;
  end if;
  insert into public.recipe_ingredients (recipe_id, ingredient_id, net_qty, sort, note)
  select v_recipe, it.ingredient_id, round(sum(it.qty * u.to_base) / b.portions * (1 - i.waste_pct / 100), 3), min(it.sort), 'Hazırlıktan türetildi (1 kişilik)'
  from public.prep_batch_items it join public.units u on u.code = it.unit join public.ingredients i on i.id = it.ingredient_id
  where it.batch_id = p_batch_id and it.ingredient_id is not null group by it.ingredient_id, i.waste_pct having sum(it.qty) > 0;
  perform public.calibrations_from_batch(p_batch_id);
  return v_recipe;
end $$;
create or replace function public.po_build(p_date date, p_meal text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_status text; b record;
begin
  select id, status into v_id, v_status from public.production_orders where prod_date = p_date and meal = p_meal;
  if v_status in ('onaylandi', 'uretildi', 'kapandi') then raise exception 'Bu öğünün üretim emri onaylanmış; değiştirmek için önce iptal edin' using errcode = '23514'; end if;
  if v_status = 'iptal' then raise exception 'Bu öğünün üretim emri iptal edildi' using errcode = '23514'; end if;
  perform public.plan_prep_from_orders(p_date, p_meal);
  for b in select id from public.prep_batches pb where pb.prep_date = p_date and pb.meal = p_meal and pb.recipe_id is not null and coalesce(pb.portions, 0) > 0
              and not exists (select 1 from public.prep_batch_items it where it.batch_id = pb.id) loop
    perform public.prep_fill_from_recipe(b.id);
  end loop;
  if v_id is null then insert into public.production_orders (prod_date, meal) values (p_date, p_meal) returning id into v_id;
  elsif v_status = 'kontrol' then update public.production_orders set status = 'taslak', anomalies = '[]'::jsonb where id = v_id;
  end if;
  update public.prep_batches pb set production_order_id = v_id,
         recipe_snapshot = case when pb.recipe_id is null then null else (
           select jsonb_agg(jsonb_build_object('ingredient_id', l.ingredient_id, 'name', l.ingredient_name, 'net_qty', l.net_qty, 'waste_pct', l.waste_pct, 'stock_unit', l.stock_unit) order by l.sort)
             from public.v_recipe_lines l where l.recipe_id = pb.recipe_id) end
   where pb.prep_date = p_date and pb.meal = p_meal;
  update public.production_orders po
     set total_people = coalesce((select sum(coalesce(o.delivered_qty, o.ordered_qty)) from public.meal_orders o where o.service_date = p_date and o.meal = p_meal and o.status <> 'iptal'), 0),
         planned_cost = (select round(sum(c.total_cost), 2) from public.v_prep_batch_costs c where c.prep_date = p_date and c.meal = p_meal)
   where po.id = v_id;
  return v_id;
end $$;
create or replace function public.po_check(p_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare po record; v jsonb := '[]'::jsonb; v_cutoff timestamptz;
begin
  select * into po from public.production_orders where id = p_id;
  if not found then raise exception 'Üretim emri bulunamadı' using errcode = '42501'; end if;
  if po.status not in ('taslak', 'kontrol') then raise exception 'Bu emir kontrol aşamasını geçti' using errcode = '23514'; end if;
  select v || coalesce(jsonb_agg(jsonb_build_object('tur', t.tur, 'yemek', t.dish, 'mesaj', t.msg)), '[]'::jsonb) into v from (
    select 'recetesiz' tur, c.dish_name dish, 'Reçetesi yok: maliyet ve kalibrasyon çıkmaz' msg from public.v_prep_batch_costs c where c.prep_date = po.prod_date and c.meal = po.meal and c.recipe_id is null
    union all select 'bos', c.dish_name, 'Malzemesi girilmedi' from public.v_prep_batch_costs c where c.prep_date = po.prod_date and c.meal = po.meal and coalesce(c.item_count, 0) = 0
    union all select 'fiyatsiz', c.dish_name, format('%s malzemenin fiyatı yok', c.missing_price_count) from public.v_prep_batch_costs c where c.prep_date = po.prod_date and c.meal = po.meal and coalesce(c.missing_price_count, 0) > 0
    union all select 'kisi_yok', c.dish_name, 'Kişi sayısı yok' from public.v_prep_batch_costs c where c.prep_date = po.prod_date and c.meal = po.meal and c.portions is null
  ) t;
  select v || coalesce(jsonb_agg(jsonb_build_object('tur', 'stok_yetersiz', 'malzeme', s.name, 'mesaj', format('Gereken %s %s, depoda %s %s', round(s.need, 2), s.unit, round(s.on_hand, 2), s.unit))), '[]'::jsonb) into v from (
    select i.name, i.stock_unit unit, sum(it.qty * u.to_base / su.to_base) need, coalesce((select sum(m.qty) from public.stock_movements m where m.ingredient_id = i.id), 0) on_hand
      from public.prep_batch_items it join public.prep_batches pb on pb.id = it.batch_id join public.ingredients i on i.id = it.ingredient_id
      join public.units u on u.code = it.unit join public.units su on su.code = i.stock_unit
     where pb.prep_date = po.prod_date and pb.meal = po.meal and exists (select 1 from public.stock_movements m where m.ingredient_id = i.id)
       and not exists (select 1 from public.stock_movements m where m.source in ('hazirlik', 'uretim') and m.source_id = pb.id)
     group by i.id, i.name, i.stock_unit) s where s.need > s.on_hand;
  select v || coalesce(jsonb_agg(jsonb_build_object('tur', 'gramaj_sapma', 'yemek', k.dish, 'malzeme', k.name,
           'mesaj', format('Kişi başı %s g/ml planlandı, alışılmış %s (%%%s)', round(k.planned, 1), round(k.norm, 1), round((k.planned / k.norm - 1) * 100)))), '[]'::jsonb) into v from (
    select pb.dish_name dish, i.name, sum(it.qty * u.to_base) / pb.portions planned, ri.calib_qty / (1 - coalesce(ri.waste_pct_override, i.waste_pct) / 100) norm
      from public.prep_batch_items it join public.prep_batches pb on pb.id = it.batch_id join public.units u on u.code = it.unit
      join public.ingredients i on i.id = it.ingredient_id join public.recipe_ingredients ri on ri.recipe_id = pb.recipe_id and ri.ingredient_id = it.ingredient_id
     where pb.prep_date = po.prod_date and pb.meal = po.meal and pb.portions > 0 and ri.calib_n >= 3 and ri.calib_qty > 0
     group by pb.id, pb.dish_name, pb.portions, i.name, ri.calib_qty, ri.waste_pct_override, i.waste_pct) k where abs(k.planned / k.norm - 1) > 0.25;
  v_cutoff := ((po.prod_date - 1)::timestamp + time '16:00') at time zone 'Europe/Istanbul';
  select v || coalesce(jsonb_agg(jsonb_build_object('tur', 'kesim_sonrasi', 'yemek', c.name, 'mesaj', format('%s siparişi kesimden sonra değişti', c.name))), '[]'::jsonb) into v
    from public.meal_orders o join public.customers c on c.id = o.customer_id where o.service_date = po.prod_date and o.meal = po.meal and o.updated_at > v_cutoff and o.status <> 'iptal';
  update public.production_orders set anomalies = v, status = 'kontrol', checked_by = auth.uid(), checked_at = now() where id = p_id;
  return v;
end $$;
create or replace function public.po_snapshot(p_id uuid)
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object('tarih', po.prod_date, 'ogun', po.meal, 'kisi', po.total_people,
    'yemekler', coalesce((select jsonb_agg(jsonb_build_object('yemek', pb.dish_name, 'kap', pb.course, 'porsiyon', pb.portions,
        'saklama', (select jsonb_build_object('kap', r.storage_container, 'sicaklik', r.storage_temp, 'raf_omru_saat', r.shelf_life_hours) from public.recipes r where r.id = pb.recipe_id),
        'malzemeler', coalesce((select jsonb_agg(jsonb_build_object('ad', coalesce(i.name, it.manual_name), 'miktar', it.qty, 'birim', it.unit, 'dograma', ri.cut_style, 'on_islem', ri.prep_note) order by it.sort)
            from public.prep_batch_items it left join public.ingredients i on i.id = it.ingredient_id
            left join public.recipe_ingredients ri on ri.recipe_id = pb.recipe_id and ri.ingredient_id = it.ingredient_id where it.batch_id = pb.id), '[]'::jsonb),
        'adimlar', coalesce((select jsonb_agg(jsonb_build_object('istasyon', s.station, 'adim', s.body, 'dk', s.minutes, 'derece', s.temp_c, 'kkn', s.ccp) order by s.sort)
            from public.recipe_steps s where s.recipe_id = pb.recipe_id), '[]'::jsonb)) order by pb.course, pb.dish_name) from public.prep_batches pb where pb.production_order_id = po.id), '[]'::jsonb),
    'firmalar', coalesce((select jsonb_agg(jsonb_build_object('firma', c.name, 'kisi', f.people) order by c.name)
        from (select o.customer_id, sum(coalesce(o.delivered_qty, o.ordered_qty)) people from public.meal_orders o where o.service_date = po.prod_date and o.meal = po.meal and o.status <> 'iptal' group by o.customer_id) f
        join public.customers c on c.id = f.customer_id), '[]'::jsonb),
    'cekme_listesi', coalesce((select jsonb_agg(jsonb_build_object('ad', x.name, 'miktar', round(x.qty, 3), 'birim', x.unit) order by x.name)
        from (select i.name, i.stock_unit unit, sum(it.qty * u.to_base / su.to_base) qty from public.prep_batch_items it join public.prep_batches pb on pb.id = it.batch_id
                join public.ingredients i on i.id = it.ingredient_id join public.units u on u.code = it.unit join public.units su on su.code = i.stock_unit
               where pb.production_order_id = po.id group by i.name, i.stock_unit) x), '[]'::jsonb)
  ) from public.production_orders po where po.id = p_id;
$$;
create or replace function public.po_approve(p_id uuid, p_force boolean default false, p_note text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare po record; v_wo uuid; v_rev int;
begin
  if not public.has_role(array['yonetici', 'asci_basi']) then raise exception 'Üretim emrini yalnız yönetici veya aşçıbaşı onaylar' using errcode = '42501'; end if;
  select * into po from public.production_orders where id = p_id for update;
  if not found then raise exception 'Üretim emri bulunamadı' using errcode = '42501'; end if;
  if po.status <> 'kontrol' then raise exception 'Önce kontrol edin' using errcode = '23514'; end if;
  if jsonb_array_length(po.anomalies) > 0 and not p_force then
    raise exception '% uyarı var. İnceleyip "yine de onayla" ile gerekçe yazarak onaylayın', jsonb_array_length(po.anomalies) using errcode = '23514';
  end if;
  if p_force and jsonb_array_length(po.anomalies) > 0 and coalesce(trim(p_note), '') = '' then raise exception 'Uyarılara rağmen onay için gerekçe yazın' using errcode = '23514'; end if;
  perform set_config('trakya.po_transition', p_id::text, true);
  update public.production_orders set status = 'onaylandi', approved_by = auth.uid(), approved_at = now(),
         note = case when coalesce(trim(p_note), '') = '' then note else concat_ws(' · ', note, 'Onay: ' || trim(p_note)) end where id = p_id;
  perform set_config('trakya.po_transition', '', true);
  select coalesce(max(revision), 0) + 1 into v_rev from public.work_orders where production_order_id = p_id;
  insert into public.work_orders (production_order_id, revision, meal, snapshot) values (p_id, v_rev, po.meal, public.po_snapshot(p_id)) returning id into v_wo;
  return v_wo;
end $$;
create or replace function public.po_close(p_id uuid, p_deliver boolean default true)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare po record; b record; v_moves int := 0; v_cal int := 0; v_deliv int := 0; n int; v_unpriced text; v_recipes uuid[] := '{}'; r uuid;
begin
  if not public.has_role(array['yonetici', 'asci_basi']) then raise exception 'Üretimi yalnız yönetici veya aşçıbaşı kapatır' using errcode = '42501'; end if;
  select * into po from public.production_orders where id = p_id for update;
  if not found then raise exception 'Üretim emri bulunamadı' using errcode = '42501'; end if;
  if po.status not in ('onaylandi', 'uretildi') then raise exception 'Kapatmak için emir onaylı olmalı (şu an: %)', po.status using errcode = '23514'; end if;
  if p_deliver then
    select string_agg(distinct c.name, ', ') into v_unpriced from public.meal_orders o join public.customers c on c.id = o.customer_id
     where o.service_date = po.prod_date and o.meal = po.meal and o.status in ('bekliyor', 'onaylandi') and coalesce(o.delivered_qty, o.ordered_qty) > 0 and coalesce(o.unit_price, 0) = 0;
    if v_unpriced is not null then raise exception 'Kişi başı fiyatı olmayan siparişler var: %. Fiyat girin ya da teslim işaretlemeden kapatın.', v_unpriced using errcode = '23514'; end if;
  end if;
  for b in select * from public.prep_batches where production_order_id = p_id loop
    if not exists (select 1 from public.stock_movements m where m.source in ('hazirlik', 'uretim') and m.source_id = b.id) then
      insert into public.stock_movements (ingredient_id, move_date, kind, qty, unit_cost, source, source_id, note)
      select it.ingredient_id, po.prod_date, 'cikis', -round(sum(it.qty * u.to_base / su.to_base), 3), coalesce(i.avg_cost, i.last_price), 'uretim', b.id, b.dish_name
        from public.prep_batch_items it join public.ingredients i on i.id = it.ingredient_id join public.units u on u.code = it.unit join public.units su on su.code = i.stock_unit
       where it.batch_id = b.id and it.ingredient_id is not null group by it.ingredient_id, i.avg_cost, i.last_price having sum(it.qty) > 0;
      get diagnostics n = row_count; v_moves := v_moves + n;
    end if;
    n := public.calibrations_from_batch(b.id); v_cal := v_cal + n;
    if b.recipe_id is not null and not b.recipe_id = any(v_recipes) then v_recipes := v_recipes || b.recipe_id; end if;
    update public.prep_batches set status = 'kapandi' where id = b.id;
  end loop;
  foreach r in array v_recipes loop perform public.recalibrate_recipe(r); end loop;
  if p_deliver then
    update public.meal_orders set status = 'teslim_edildi' where service_date = po.prod_date and meal = po.meal and status in ('bekliyor', 'onaylandi');
    get diagnostics v_deliv = row_count;
  end if;
  perform set_config('trakya.po_transition', p_id::text, true);
  update public.production_orders set status = 'kapandi', closed_by = auth.uid(), closed_at = now(), delivered_orders = case when p_deliver then v_deliv end,
         actual_cost = (select round(sum(c.total_cost), 2) from public.v_prep_batch_costs c where c.batch_id in (select id from public.prep_batches where production_order_id = p_id))
   where id = p_id;
  perform set_config('trakya.po_transition', '', true);
  return jsonb_build_object('stok_kalem', v_moves, 'kalibrasyon', v_cal, 'teslim', v_deliv, 'recete', coalesce(array_length(v_recipes, 1), 0));
end $$;
create or replace function public.po_cancel(p_id uuid, p_note text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.has_role(array['yonetici']) then raise exception 'Üretim emrini yalnız yönetici iptal eder' using errcode = '42501'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'İptal gerekçesi yazın' using errcode = '23514'; end if;
  update public.production_orders set status = 'iptal', note = concat_ws(' · ', note, 'İptal: ' || trim(p_note)) where id = p_id;
  if not found then raise exception 'Üretim emri bulunamadı' using errcode = '42501'; end if;
end $$;
do $$
declare f text;
begin
  foreach f in array array['weighted_median(numeric[], numeric[])', 'recalibrate_recipe(uuid)', 'apply_calibration(uuid)', 'calibrations_from_batch(uuid)',
    'recipe_from_first_production(uuid, numeric, jsonb)', 'po_build(date, text)', 'po_check(uuid)', 'po_snapshot(uuid)',
    'po_approve(uuid, boolean, text)', 'po_close(uuid, boolean)', 'po_cancel(uuid, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
create or replace function public.save_recipe(p_id uuid, p_header jsonb, p_lines jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid := p_id;
begin
  if coalesce(trim(p_header->>'name'), '') = '' then raise exception 'Reçete adı zorunlu' using errcode = '23514'; end if;
  if v_id is null then
    insert into public.recipes (code, name, category_code, portion_label, portion_served_g, instructions, active, storage_container, storage_temp, shelf_life_hours)
    values (nullif(trim(p_header->>'code'), ''), trim(p_header->>'name'), p_header->>'category_code',
      nullif(trim(p_header->>'portion_label'), ''), (p_header->>'portion_served_g')::numeric,
      nullif(p_header->>'instructions', ''), coalesce((p_header->>'active')::boolean, true),
      nullif(trim(p_header->>'storage_container'), ''), nullif(trim(p_header->>'storage_temp'), ''), (p_header->>'shelf_life_hours')::int
    ) returning id into v_id;
  else
    update public.recipes set
      code = nullif(trim(p_header->>'code'), ''), name = trim(p_header->>'name'), category_code = p_header->>'category_code',
      portion_label = nullif(trim(p_header->>'portion_label'), ''), portion_served_g = (p_header->>'portion_served_g')::numeric,
      instructions = nullif(p_header->>'instructions', ''), active = coalesce((p_header->>'active')::boolean, true),
      storage_container = case when p_header ? 'storage_container' then nullif(trim(p_header->>'storage_container'), '') else storage_container end,
      storage_temp = case when p_header ? 'storage_temp' then nullif(trim(p_header->>'storage_temp'), '') else storage_temp end,
      shelf_life_hours = case when p_header ? 'shelf_life_hours' then (p_header->>'shelf_life_hours')::int else shelf_life_hours end
    where id = v_id;
    if not found then raise exception 'Reçete bulunamadı veya yetkiniz yok' using errcode = '42501'; end if;
  end if;
  delete from public.recipe_ingredients ri where ri.recipe_id = v_id
    and ri.ingredient_id not in (select (x->>'ingredient_id')::uuid from jsonb_array_elements(coalesce(p_lines, '[]')) x);
  insert into public.recipe_ingredients (recipe_id, ingredient_id, net_qty, waste_pct_override, note, sort, cut_style, prep_note)
  select v_id, (x->>'ingredient_id')::uuid, (x->>'net_qty')::numeric, (x->>'waste_pct_override')::numeric, nullif(x->>'note', ''), ord::int,
         nullif(x->>'cut_style', ''), nullif(x->>'prep_note', '')
  from jsonb_array_elements(coalesce(p_lines, '[]')) with ordinality as t(x, ord)
  on conflict (recipe_id, ingredient_id) do update set
    net_qty = excluded.net_qty, waste_pct_override = excluded.waste_pct_override, note = excluded.note, sort = excluded.sort,
    cut_style = case when (select x->>'cut_style' from jsonb_array_elements(coalesce(p_lines, '[]')) x where (x->>'ingredient_id')::uuid = excluded.ingredient_id limit 1) is null
                     then public.recipe_ingredients.cut_style else excluded.cut_style end,
    prep_note = case when (select x->>'prep_note' from jsonb_array_elements(coalesce(p_lines, '[]')) x where (x->>'ingredient_id')::uuid = excluded.ingredient_id limit 1) is null
                     then public.recipe_ingredients.prep_note else excluded.prep_note end;
  return v_id;
end $$;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'production_orders') then
    alter publication supabase_realtime add table public.production_orders;
  end if;
end $$;
