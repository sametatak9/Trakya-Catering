-- TRAKYA CATERING ERP — 4: reçete ve menüyü satırlarıyla birlikte atomik kaydetme
-- SECURITY INVOKER: çağıranın RLS yetkileri aynen geçerli (aşçıbaşı/yönetici dışı yazamaz).

create or replace function public.save_recipe(p_id uuid, p_header jsonb, p_lines jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := p_id;
begin
  if coalesce(trim(p_header->>'name'), '') = '' then
    raise exception 'Reçete adı zorunlu' using errcode = '23514';
  end if;

  if v_id is null then
    insert into public.recipes (code, name, category_code, portion_label, portion_served_g, instructions, active)
    values (
      nullif(trim(p_header->>'code'), ''), trim(p_header->>'name'), p_header->>'category_code',
      nullif(trim(p_header->>'portion_label'), ''), (p_header->>'portion_served_g')::numeric,
      nullif(p_header->>'instructions', ''), coalesce((p_header->>'active')::boolean, true)
    ) returning id into v_id;
  else
    update public.recipes set
      code = nullif(trim(p_header->>'code'), ''),
      name = trim(p_header->>'name'),
      category_code = p_header->>'category_code',
      portion_label = nullif(trim(p_header->>'portion_label'), ''),
      portion_served_g = (p_header->>'portion_served_g')::numeric,
      instructions = nullif(p_header->>'instructions', ''),
      active = coalesce((p_header->>'active')::boolean, true)
    where id = v_id;
    if not found then raise exception 'Reçete bulunamadı veya yetkiniz yok' using errcode = '42501'; end if;
  end if;

  delete from public.recipe_ingredients ri
  where ri.recipe_id = v_id
    and ri.ingredient_id not in (select (x->>'ingredient_id')::uuid from jsonb_array_elements(coalesce(p_lines, '[]')) x);

  insert into public.recipe_ingredients (recipe_id, ingredient_id, net_qty, waste_pct_override, note, sort)
  select v_id, (x->>'ingredient_id')::uuid, (x->>'net_qty')::numeric,
         (x->>'waste_pct_override')::numeric, nullif(x->>'note', ''), ord::int
  from jsonb_array_elements(coalesce(p_lines, '[]')) with ordinality as t(x, ord)
  on conflict (recipe_id, ingredient_id) do update set
    net_qty = excluded.net_qty,
    waste_pct_override = excluded.waste_pct_override,
    note = excluded.note,
    sort = excluded.sort;

  return v_id;
end $$;
revoke execute on function public.save_recipe(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_recipe(uuid, jsonb, jsonb) to authenticated;

create or replace function public.save_menu(p_id uuid, p_header jsonb, p_items jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := p_id;
begin
  if coalesce(trim(p_header->>'name'), '') = '' then
    raise exception 'Menü adı zorunlu' using errcode = '23514';
  end if;

  if v_id is null then
    insert into public.menus (code, name, kind, meal, target_price, notes, active)
    values (
      nullif(trim(p_header->>'code'), ''), trim(p_header->>'name'), coalesce(p_header->>'kind', '4_kap'),
      coalesce(p_header->>'meal', 'ogle'), (p_header->>'target_price')::numeric,
      nullif(p_header->>'notes', ''), coalesce((p_header->>'active')::boolean, true)
    ) returning id into v_id;
  else
    update public.menus set
      code = nullif(trim(p_header->>'code'), ''),
      name = trim(p_header->>'name'),
      kind = coalesce(p_header->>'kind', '4_kap'),
      meal = coalesce(p_header->>'meal', 'ogle'),
      target_price = (p_header->>'target_price')::numeric,
      notes = nullif(p_header->>'notes', ''),
      active = coalesce((p_header->>'active')::boolean, true)
    where id = v_id;
    if not found then raise exception 'Menü bulunamadı veya yetkiniz yok' using errcode = '42501'; end if;
  end if;

  delete from public.menu_items mi
  where mi.menu_id = v_id
    and mi.recipe_id not in (select (x->>'recipe_id')::uuid from jsonb_array_elements(coalesce(p_items, '[]')) x);

  insert into public.menu_items (menu_id, recipe_id, portion_factor, sort)
  select v_id, (x->>'recipe_id')::uuid, coalesce((x->>'portion_factor')::numeric, 1), ord::int
  from jsonb_array_elements(coalesce(p_items, '[]')) with ordinality as t(x, ord)
  on conflict (menu_id, recipe_id) do update set
    portion_factor = excluded.portion_factor,
    sort = excluded.sort;

  return v_id;
end $$;
revoke execute on function public.save_menu(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_menu(uuid, jsonb, jsonb) to authenticated;
