-- Kullanıcı notları D + E (Faz 3D). YALNIZCA EKLEMELİ: yeni tablolar (RLS'li), menus'a nullable sütun,
-- index, tetikleyici fonksiyonu. Mevcut satırlar değişmez.

-- ---------------------------------------------------------------------
-- D) Müşteriye menü atama: öğün/dönem başına bir veya birden çok menü.
--    Aylık menü görünümü, sipariş menü varsayılanı ve sevilmeyen yemek kontrolü bu atamadan beslenir.
-- ---------------------------------------------------------------------
create table if not exists public.customer_menus (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  meal text not null default 'ogle' check (meal in ('kahvalti','ogle','aksam','gece')),
  valid_from date not null default current_date,
  valid_to date,
  is_default boolean not null default false,
  active boolean not null default true,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  unique (customer_id, menu_id, meal, valid_from)
);
create index if not exists customer_menus_customer_idx on public.customer_menus (customer_id, meal) where active;
create index if not exists customer_menus_menu_idx on public.customer_menus (menu_id);
create trigger customer_menus_updated_at before update on public.customer_menus
  for each row execute function public.set_updated_at();
create trigger customer_menus_audit after insert or update or delete on public.customer_menus
  for each row execute function public.log_audit();

alter table public.customer_menus enable row level security;
create policy customer_menus_read on public.customer_menus for select to authenticated
  using ((select public.is_staff()) or customer_id = (select public.current_customer_id()));
create policy customer_menus_insert on public.customer_menus for insert to authenticated
  with check ((select public.has_role(array['yonetici','asci_basi','diyetisyen'])));
create policy customer_menus_update on public.customer_menus for update to authenticated
  using ((select public.has_role(array['yonetici','asci_basi','diyetisyen'])))
  with check ((select public.has_role(array['yonetici','asci_basi','diyetisyen'])));
create policy customer_menus_delete on public.customer_menus for delete to authenticated
  using ((select public.has_role(array['yonetici','asci_basi','diyetisyen'])));

-- ---------------------------------------------------------------------
-- E) Kap (ambalaj) tipi ve birim kap maliyeti. Plastik kapta maliyet zorunlu; maliyeti yalnızca yönetici
--    girer/değiştirir. Maliyet porsiyon birim maliyetine eklenir. Her maliyet değişikliği loglanır.
-- ---------------------------------------------------------------------
create table if not exists public.container_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) >= 2),
  is_plastic boolean not null default false,
  unit_cost numeric(12,4) check (unit_cost is null or unit_cost >= 0),
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint container_types_plastic_flag check (name !~* 'plastik' or is_plastic),
  constraint container_types_plastic_cost check (not is_plastic or (unit_cost is not null and unit_cost > 0))
);
create unique index if not exists container_types_name_uidx on public.container_types (lower(btrim(name)));
create trigger container_types_updated_at before update on public.container_types
  for each row execute function public.set_updated_at();
create trigger container_types_audit after insert or update or delete on public.container_types
  for each row execute function public.log_audit();

alter table public.container_types enable row level security;
create policy container_types_read on public.container_types for select to authenticated
  using ((select public.is_staff()));
-- Mutfak rolleri maliyetsiz, plastik olmayan kap tipi açabilir; maliyetli/plastik kap yalnızca yönetici.
create policy container_types_insert on public.container_types for insert to authenticated
  with check ((select public.has_role(array['yonetici']))
    or ((select public.has_role(array['asci_basi','diyetisyen'])) and unit_cost is null and not is_plastic));
create policy container_types_update on public.container_types for update to authenticated
  using ((select public.has_role(array['yonetici'])))
  with check ((select public.has_role(array['yonetici'])));
create policy container_types_delete on public.container_types for delete to authenticated
  using ((select public.has_role(array['yonetici'])));

create table if not exists public.container_cost_log (
  id uuid primary key default gen_random_uuid(),
  container_type_id uuid not null references public.container_types(id) on delete cascade,
  old_cost numeric(12,4),
  new_cost numeric(12,4),
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);
create index if not exists container_cost_log_type_idx on public.container_cost_log (container_type_id, changed_at desc);
alter table public.container_cost_log enable row level security;
create policy container_cost_log_read on public.container_cost_log for select to authenticated
  using ((select public.is_staff()));
-- Yazma yalnızca tetikleyiciyle (istemci ekleyemez/değiştiremez/silemez).

create or replace function public.container_cost_logger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.unit_cost is not null then
      insert into public.container_cost_log (container_type_id, old_cost, new_cost, changed_by) values (new.id, null, new.unit_cost, auth.uid());
    end if;
  elsif new.unit_cost is distinct from old.unit_cost then
    insert into public.container_cost_log (container_type_id, old_cost, new_cost, changed_by) values (new.id, old.unit_cost, new.unit_cost, auth.uid());
  end if;
  return new;
end $$;
revoke execute on function public.container_cost_logger() from public, anon, authenticated;
create trigger container_types_cost_log after insert or update of unit_cost on public.container_types
  for each row execute function public.container_cost_logger();

alter table public.menus add column if not exists container_type_id uuid references public.container_types(id) on delete set null;
create index if not exists menus_container_type_idx on public.menus (container_type_id);
comment on column public.menus.container_type_id is
  'Kap (ambalaj) tipi. Birim kap maliyeti (container_types.unit_cost) porsiyon birim maliyetine eklenir; plastik kapta zorunlu.';
