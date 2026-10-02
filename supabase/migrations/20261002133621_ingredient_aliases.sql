-- Faz 3E-2a: Türkçe normalleştirme, tedarikçi takma adları (trigram), alternatif birimler, yemek öğünleri.
-- Kural: kanonik ad sabit; faturadaki aynı ürün o stoğa yazılır ve tedarikçi adı kaydedilir.
create extension if not exists pg_trgm with schema extensions;

-- İstemci eşleniği: src/lib/normTr.ts (aynı kural, vitest)
create or replace function public.norm_tr(p text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select nullif(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
           lower(translate(coalesce(p, ''), 'ÇĞİIÖŞÜÂÎÛçğıöşüâîû', 'cgiiosuaiucgiosuaiu')),
           '[^a-z0-9]+', ' ', 'g'),
           '(^| )1 ?sinif(?= |$)', ' ', 'g'),
           '(^| )[0-9]+(kg|gr|g|lt|l|ml|cl|li|lu|luk)?(?= |$)', ' ', 'g'),
           '(^| )(birinci sinif|sinif|ekstra|extra|kg|kilo|gr|g|lt|l|ml|cl|adet|ad|ade|koli|kasa|pkt|paket|kutu|cuval|bidon|teneke|demet|rulo|kova|li|lu|luk)(?= |$)', ' ', 'g'),
           ' +', ' ', 'g')), '');
$$;
comment on function public.norm_tr(text) is 'Türkçe karakter → ASCII, küçük harf, noktalama, sayı ve birim/gürültü sözcükleri atılır. "DANA KUŞBAŞI 1.SINIF KG" → "dana kusbasi"';

create table if not exists public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  alias_raw text not null check (length(btrim(alias_raw)) > 0),
  alias_norm text generated always as (public.norm_tr(alias_raw)) stored,
  seller_item_code text,
  unit_code text references public.units(code),
  factor_to_stock numeric(14,6) not null default 1 check (factor_to_stock > 0),
  confirmed boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists ingredient_aliases_uidx on public.ingredient_aliases
  (coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid), alias_norm);
create index if not exists ingredient_aliases_trgm on public.ingredient_aliases using gin (alias_norm extensions.gin_trgm_ops);
create index if not exists ingredient_aliases_code on public.ingredient_aliases (supplier_id, seller_item_code) where seller_item_code is not null;
create index if not exists ingredients_name_norm_trgm on public.ingredients using gin (public.norm_tr(name) extensions.gin_trgm_ops);
alter table public.ingredient_aliases enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'ingredient_aliases' and policyname = 'ingredient_aliases_read') then
    create policy ingredient_aliases_read on public.ingredient_aliases for select to authenticated using ((select public.is_staff()));
    create policy ingredient_aliases_write on public.ingredient_aliases for insert to authenticated with check ((select public.has_role(array['yonetici', 'satinalma', 'muhasebe'])));
    create policy ingredient_aliases_update on public.ingredient_aliases for update to authenticated
      using ((select public.has_role(array['yonetici', 'satinalma', 'muhasebe']))) with check ((select public.has_role(array['yonetici', 'satinalma', 'muhasebe'])));
    create policy ingredient_aliases_remove on public.ingredient_aliases for delete to authenticated using ((select public.has_role(array['yonetici', 'satinalma'])));
  end if;
end $$;
create or replace trigger ingredient_aliases_audit after insert or update or delete on public.ingredient_aliases for each row execute function public.log_audit();

create table if not exists public.ingredient_pack_units (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  pack_name text not null check (length(btrim(pack_name)) > 0),
  factor_to_stock numeric(14,6) not null check (factor_to_stock > 0),
  unique (ingredient_id, pack_name)
);
alter table public.ingredient_pack_units enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'ingredient_pack_units' and policyname = 'ingredient_pack_units_read') then
    create policy ingredient_pack_units_read on public.ingredient_pack_units for select to authenticated using ((select public.is_staff()));
    create policy ingredient_pack_units_write on public.ingredient_pack_units for all to authenticated
      using ((select public.has_role(array['yonetici', 'satinalma', 'asci_basi']))) with check ((select public.has_role(array['yonetici', 'satinalma', 'asci_basi'])));
  end if;
end $$;

alter table public.recipes add column if not exists meals text[] not null default '{}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_meals_check') then
    alter table public.recipes add constraint recipes_meals_check check (meals <@ array['kahvalti', 'ogle', 'aksam', 'gece']::text[]);
  end if;
end $$;
grant select on public.ingredient_aliases, public.ingredient_pack_units to authenticated;
