-- Faz 3E-2d: puan sırası düzeltmesi. Kod 1,00 > tedarikçi adı 0,99 > ad birebir 0,97 > genel takma ad 0,95 > benzerlik (en çok 0,90).
-- Trigram benzerliği kelime sırasına duyarsız olduğu için "kuşbaşı dana" birebir adın önüne geçmesin.
create or replace function public.match_invoice_line(p_supplier_id uuid, p_raw text, p_seller_code text default null)
returns table (ingredient_id uuid, name text, score numeric, kaynak text, factor_to_stock numeric)
language sql stable set search_path = public, extensions as $$
  with q as (select public.norm_tr(p_raw) as n),
  c as (
    select a.ingredient_id, 1.0::numeric as score, 'kod'::text as kaynak, a.factor_to_stock
      from public.ingredient_aliases a where p_seller_code is not null and a.seller_item_code = p_seller_code and a.supplier_id is not distinct from p_supplier_id
    union all
    select a.ingredient_id, 0.99, 'alias_tedarikci', a.factor_to_stock from public.ingredient_aliases a, q
     where p_supplier_id is not null and a.supplier_id = p_supplier_id and a.alias_norm = q.n
    union all
    select i.id, 0.97, 'ad', 1::numeric from public.ingredients i, q where i.active and public.norm_tr(i.name) = q.n
    union all
    select a.ingredient_id, 0.95, 'alias_genel', a.factor_to_stock from public.ingredient_aliases a, q
     where a.supplier_id is null and a.alias_norm = q.n
    union all
    select i.id, least(round(extensions.similarity(public.norm_tr(i.name), q.n)::numeric, 3), 0.90), 'benzerlik', 1::numeric
      from public.ingredients i, q where i.active and q.n is not null and public.norm_tr(i.name) operator(extensions.%) q.n
    union all
    select a.ingredient_id, least(round(extensions.similarity(a.alias_norm, q.n)::numeric, 3), 0.90), 'benzerlik', a.factor_to_stock
      from public.ingredient_aliases a, q where q.n is not null and a.alias_norm operator(extensions.%) q.n
  ),
  best as (select distinct on (c.ingredient_id) c.* from c order by c.ingredient_id, c.score desc)
  select b.ingredient_id, i.name, b.score, b.kaynak, b.factor_to_stock
    from best b join public.ingredients i on i.id = b.ingredient_id where i.active
   order by b.score desc, i.name limit 5;
$$;
