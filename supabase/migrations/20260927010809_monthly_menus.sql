-- Faz 3D · EK-1 Not 1·3·14 (aylık menü, müşteri kuralları, yemek etiketleri),
-- Not 7 (müşteri geri bildirimi), Not 1/§15.3 (AI harcama freni).
-- YALNIZCA EKLEMELİ: yeni tablolar, yeni tablolarda RLS, index, fonksiyon.
-- Mevcut tablolar (menus, menu_items, menu_plans, recipes, customers) değiştirilmez;
-- publish_monthly_menu yayınlanınca mevcut menus/menu_items/menu_plans akışına yazar (EK-1 §2.3).

-- ---------------------------------------------------------------------
-- 1) Aylık plan başlığı (sürümlü) ve gün × öğün × sıra içeriği
-- ---------------------------------------------------------------------
create table if not exists public.monthly_menus (
  id uuid primary key default gen_random_uuid(),
  period date not null check (extract(day from period) = 1),      -- ayın 1'i
  customer_id uuid references public.customers(id) on delete cascade, -- null = genel menü
  kind text not null default '4_kap' check (kind in ('3_kap','4_kap','kahvalti','diyet','ozel')),
  status text not null default 'taslak' check (status in ('taslak','onay','yayinda','arsiv')),
  version int not null default 1 check (version >= 1),
  published_at timestamptz,
  published_by uuid,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists monthly_menus_version_uidx
  on public.monthly_menus (period, coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, version);
create index if not exists monthly_menus_customer_idx on public.monthly_menus (customer_id);
create trigger monthly_menus_updated_at before update on public.monthly_menus
  for each row execute function public.set_updated_at();

create table if not exists public.monthly_menu_days (
  id uuid primary key default gen_random_uuid(),
  monthly_menu_id uuid not null references public.monthly_menus(id) on delete cascade,
  day date not null,
  meal text not null check (meal in ('kahvalti','ogle','aksam')),
  position smallint not null default 1 check (position between 1 and 20),
  recipe_id uuid not null references public.recipes(id) on delete restrict,
  course text check (course in ('corba','ana','yardimci','salata','meze','tatli','icecek','ekmek','kahvalti')),
  note text,
  override_reason text,   -- müşteri kuralına rağmen seçildiyse gerekçe (EK-1 §2.4)
  created_at timestamptz not null default now(),
  unique (monthly_menu_id, day, meal, position)
);
create index if not exists monthly_menu_days_recipe_idx on public.monthly_menu_days (recipe_id);

-- ---------------------------------------------------------------------
-- 2) Yemek etiketleri ve müşteri kuralları (Not 3)
-- ---------------------------------------------------------------------
create table if not exists public.recipe_tags (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  tag text not null check (tag ~ '^[a-z0-9_]{2,40}$'),
  primary key (recipe_id, tag)
);
create index if not exists recipe_tags_tag_idx on public.recipe_tags (tag);

create table if not exists public.customer_dish_rules (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  rule text not null check (rule in ('yasak_etiket','yasak_yemek','tercih_etiket','gun_yasak','haftalik_en_fazla','haftalik_en_az')),
  tag text,
  recipe_id uuid references public.recipes(id) on delete cascade,
  weekday smallint check (weekday between 1 and 7),               -- ISO: 1 = Pazartesi
  qty smallint check (qty >= 0),
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (tag is not null or recipe_id is not null)
);
create index if not exists customer_dish_rules_customer_idx on public.customer_dish_rules (customer_id);
create index if not exists customer_dish_rules_recipe_idx on public.customer_dish_rules (recipe_id);

-- ---------------------------------------------------------------------
-- 3) Müşteri geri bildirimi (Not 7)
-- ---------------------------------------------------------------------
create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  menu_date date not null,
  meal text not null default 'ogle' check (meal in ('kahvalti','ogle','aksam','gece')),
  recipe_id uuid references public.recipes(id) on delete set null,
  kind text not null check (kind in ('revizyon','oneri','sikayet','begeni')),
  rating smallint check (rating between 1 and 5),
  text text,
  photo_path text,
  status text not null default 'yeni' check (status in ('yeni','incelendi','cozuldu')),
  handled_by uuid,
  handled_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists customer_feedback_customer_idx on public.customer_feedback (customer_id, menu_date desc);
create index if not exists customer_feedback_recipe_idx on public.customer_feedback (recipe_id);

-- ---------------------------------------------------------------------
-- 4) AI harcama freni (EK-1 §2.5 / §15.3) — Faz 8 aynı tabloları kullanır
-- ---------------------------------------------------------------------
create table if not exists public.ai_budget (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  daily_usd numeric(10,2) not null default 1.00,
  monthly_usd numeric(10,2) not null default 15.00,
  per_call_usd numeric(10,2) not null default 0.10,
  updated_by uuid,
  updated_at timestamptz default now()
);
insert into public.ai_budget (id) values (1) on conflict do nothing;

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  source text not null check (source in ('menu_suggest','social_caption','social_reply','inbox_label','test')),
  ref_id uuid,
  provider text,
  model text,
  tokens_in int default 0,
  tokens_out int default 0,
  cost_usd numeric(10,4) default 0
);
create index if not exists ai_usage_at_idx on public.ai_usage (at desc);

-- ---------------------------------------------------------------------
-- 5) RLS (yeni tablolar)
-- ---------------------------------------------------------------------
alter table public.monthly_menus enable row level security;
alter table public.monthly_menu_days enable row level security;
alter table public.recipe_tags enable row level security;
alter table public.customer_dish_rules enable row level security;
alter table public.customer_feedback enable row level security;
alter table public.ai_budget enable row level security;
alter table public.ai_usage enable row level security;

-- Aylık menü: personel okur; müşteri yalnızca yayındaki kendi menüsünü ve genel menüyü okur
create policy monthly_menus_read on public.monthly_menus for select to authenticated using (
  (select public.is_staff())
  or (status = 'yayinda' and (select public.current_customer_id()) is not null
      and (customer_id is null or customer_id = (select public.current_customer_id()))));
create policy monthly_menus_insert on public.monthly_menus for insert to authenticated
  with check ((select public.has_role(array['yonetici','asci_basi'])));
create policy monthly_menus_update on public.monthly_menus for update to authenticated
  using ((select public.has_role(array['yonetici','asci_basi'])))
  with check ((select public.has_role(array['yonetici','asci_basi'])));
create policy monthly_menus_delete on public.monthly_menus for delete to authenticated
  using ((select public.has_role(array['yonetici','asci_basi'])) and status in ('taslak','onay'));

-- İçerik: üst kaydı görebilen okur; yalnızca taslak/onay aşamasında yazılır (yayındaki sürüm kilitli)
create policy monthly_menu_days_read on public.monthly_menu_days for select to authenticated using (
  exists (select 1 from public.monthly_menus m where m.id = monthly_menu_id));
create policy monthly_menu_days_insert on public.monthly_menu_days for insert to authenticated with check (
  (select public.has_role(array['yonetici','asci_basi']))
  and exists (select 1 from public.monthly_menus m where m.id = monthly_menu_id and m.status in ('taslak','onay')));
create policy monthly_menu_days_update on public.monthly_menu_days for update to authenticated
  using ((select public.has_role(array['yonetici','asci_basi']))
    and exists (select 1 from public.monthly_menus m where m.id = monthly_menu_id and m.status in ('taslak','onay')))
  with check ((select public.has_role(array['yonetici','asci_basi']))
    and exists (select 1 from public.monthly_menus m where m.id = monthly_menu_id and m.status in ('taslak','onay')));
create policy monthly_menu_days_delete on public.monthly_menu_days for delete to authenticated using (
  (select public.has_role(array['yonetici','asci_basi']))
  and exists (select 1 from public.monthly_menus m where m.id = monthly_menu_id and m.status in ('taslak','onay')));

create policy recipe_tags_read on public.recipe_tags for select to authenticated using ((select public.is_staff()));
create policy recipe_tags_insert on public.recipe_tags for insert to authenticated
  with check ((select public.has_role(array['yonetici','asci_basi','diyetisyen'])));
create policy recipe_tags_delete on public.recipe_tags for delete to authenticated
  using ((select public.has_role(array['yonetici','asci_basi','diyetisyen'])));

-- Müşteri kuralları: personel ve ilgili müşteri okur, yalnızca mutfak yönetimi yazar
create policy customer_dish_rules_read on public.customer_dish_rules for select to authenticated using (
  (select public.is_staff()) or customer_id = (select public.current_customer_id()));
create policy customer_dish_rules_insert on public.customer_dish_rules for insert to authenticated
  with check ((select public.has_role(array['yonetici','asci_basi','diyetisyen'])));
create policy customer_dish_rules_update on public.customer_dish_rules for update to authenticated
  using ((select public.has_role(array['yonetici','asci_basi','diyetisyen'])))
  with check ((select public.has_role(array['yonetici','asci_basi','diyetisyen'])));
create policy customer_dish_rules_delete on public.customer_dish_rules for delete to authenticated
  using ((select public.has_role(array['yonetici','asci_basi','diyetisyen'])));

-- Geri bildirim: müşteri kendi kaydını açar/okur; personel okur; mutfak yönetimi durumunu işler
create policy customer_feedback_read on public.customer_feedback for select to authenticated using (
  (select public.is_staff()) or customer_id = (select public.current_customer_id()));
create policy customer_feedback_insert on public.customer_feedback for insert to authenticated with check (
  (select public.is_staff()) or customer_id = (select public.current_customer_id()));
create policy customer_feedback_update on public.customer_feedback for update to authenticated
  using ((select public.has_role(array['yonetici','asci_basi'])))
  with check ((select public.has_role(array['yonetici','asci_basi'])));

-- AI bütçesi ve kullanım: yalnızca yönetici; kullanım kaydını yalnızca sunucu (service_role) yazar
create policy ai_budget_read on public.ai_budget for select to authenticated using ((select public.has_role(array['yonetici'])));
create policy ai_budget_update on public.ai_budget for update to authenticated
  using ((select public.has_role(array['yonetici']))) with check ((select public.has_role(array['yonetici'])));
create policy ai_usage_read on public.ai_usage for select to authenticated using ((select public.has_role(array['yonetici'])));

revoke all on public.monthly_menus, public.monthly_menu_days, public.recipe_tags, public.customer_dish_rules,
  public.customer_feedback, public.ai_budget, public.ai_usage from anon;
revoke insert, delete, truncate on public.ai_budget from authenticated;
revoke insert, update, delete, truncate on public.ai_usage from authenticated;
revoke delete, truncate on public.customer_feedback from authenticated;

create trigger monthly_menus_audit after insert or update or delete on public.monthly_menus
  for each row execute function public.log_audit();
create trigger customer_dish_rules_audit after insert or update or delete on public.customer_dish_rules
  for each row execute function public.log_audit();
create trigger customer_feedback_audit after insert or update or delete on public.customer_feedback
  for each row execute function public.log_audit();
create trigger ai_budget_audit after update on public.ai_budget
  for each row execute function public.log_audit();

-- ---------------------------------------------------------------------
-- 6) Kural denetimi ve yayınlama (security invoker: çağıranın RLS'i geçerli)
-- ---------------------------------------------------------------------
create or replace function public.monthly_menu_violations(p_id uuid)
returns table (day date, meal text, recipe_id uuid, rule text, detail text)
language sql stable security invoker set search_path = public as $$
  with m as (select * from public.monthly_menus where id = p_id),
  d as (select x.* from public.monthly_menu_days x where x.monthly_menu_id = p_id and x.override_reason is null),
  r as (select c.* from public.customer_dish_rules c join m on c.customer_id = m.customer_id where c.active)
  select d.day, d.meal, d.recipe_id, 'yasak_yemek', coalesce(r.note, 'Müşteri bu yemeği istemiyor')
    from d join r on r.rule = 'yasak_yemek' and r.recipe_id = d.recipe_id
  union all
  select d.day, d.meal, d.recipe_id, 'yasak_etiket', 'Yasak: ' || r.tag
    from d join public.recipe_tags t on t.recipe_id = d.recipe_id
           join r on r.rule = 'yasak_etiket' and r.tag = t.tag
  union all
  select d.day, d.meal, d.recipe_id, 'gun_yasak', 'Bu gün yasak: ' || coalesce(r.tag, 'yemek')
    from d join r on r.rule = 'gun_yasak' and r.weekday = extract(isodow from d.day)::int
    where r.recipe_id = d.recipe_id
       or exists (select 1 from public.recipe_tags t where t.recipe_id = d.recipe_id and t.tag = r.tag)
  union all
  select min(d.day), null, null, 'haftalik_en_fazla',
         format('%s: haftada %s kez (en fazla %s)', r.tag, count(*), r.qty)
    from d join public.recipe_tags t on t.recipe_id = d.recipe_id
           join r on r.rule = 'haftalik_en_fazla' and r.tag = t.tag
    group by date_trunc('week', d.day), r.id, r.tag, r.qty
    having count(*) > r.qty;
$$;
revoke execute on function public.monthly_menu_violations(uuid) from public, anon;
grant execute on function public.monthly_menu_violations(uuid) to authenticated;

create or replace function public.publish_monthly_menu(p_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_m public.monthly_menus;
  v_viol jsonb;
  v_kind text;
  v_cname text;
  v_menu uuid;
  v_code text;
  v_count int := 0;
  rec record;
begin
  if not public.has_role(array['yonetici','asci_basi']) then
    raise exception 'Aylık menüyü yalnızca yönetici veya aşçıbaşı yayınlar' using errcode = '42501';
  end if;
  select * into v_m from public.monthly_menus where id = p_id for update;
  if not found then raise exception 'Aylık menü bulunamadı' using errcode = 'P0002'; end if;
  if v_m.status in ('yayinda','arsiv') then
    raise exception 'Bu sürüm kilitli; değiştirmek için yeni sürüm açın' using errcode = '22023';
  end if;
  if not exists (select 1 from public.monthly_menu_days x where x.monthly_menu_id = p_id) then
    raise exception 'Boş ay yayınlanamaz: önce yemek ekleyin' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) into v_viol from public.monthly_menu_violations(p_id) v;
  if jsonb_array_length(v_viol) > 0 then
    return jsonb_build_object('ok', false, 'violations', v_viol);
  end if;

  v_kind := case v_m.kind when 'kahvalti' then 'kahvalti' when 'diyet' then 'diyet' when 'ozel' then 'ozel' else 'standart' end;
  select name into v_cname from public.customers where id = v_m.customer_id;

  for rec in select x.day, x.meal from public.monthly_menu_days x where x.monthly_menu_id = p_id
             group by x.day, x.meal order by x.day, x.meal loop
    v_code := format('AY-%s-%s-%s', left(replace(p_id::text, '-', ''), 8), to_char(rec.day, 'YYYYMMDD'), rec.meal);
    insert into public.menus (code, name, kind, meal, customer_id, notes)
    values (v_code,
            format('%s · %s · %s', to_char(rec.day, 'DD.MM.YYYY'),
                   case rec.meal when 'kahvalti' then 'Kahvaltı' when 'ogle' then 'Öğle' else 'Akşam' end,
                   coalesce(v_cname, 'Genel')),
            v_kind, rec.meal, v_m.customer_id, 'Aylık menüden yayınlandı')
    on conflict (code) do update set name = excluded.name, kind = excluded.kind, meal = excluded.meal,
                                     customer_id = excluded.customer_id, active = true
    returning id into v_menu;

    delete from public.menu_items where menu_id = v_menu;
    insert into public.menu_items (menu_id, recipe_id, course, sort)
    select v_menu, x.recipe_id, coalesce(x.course, 'ana'), x.position
      from public.monthly_menu_days x
     where x.monthly_menu_id = p_id and x.day = rec.day and x.meal = rec.meal
     order by x.position
    on conflict (menu_id, recipe_id) do nothing;

    insert into public.menu_plans (plan_date, meal, customer_id, menu_id, note)
    values (rec.day, rec.meal, v_m.customer_id, v_menu, 'Aylık menü')
    on conflict (plan_date, meal, coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid))
    do update set menu_id = excluded.menu_id, note = excluded.note;
    v_count := v_count + 1;
  end loop;

  update public.monthly_menus set status = 'arsiv'
   where period = v_m.period and customer_id is not distinct from v_m.customer_id and kind = v_m.kind
     and status = 'yayinda' and id <> p_id;
  update public.monthly_menus set status = 'yayinda', published_at = now(), published_by = auth.uid() where id = p_id;
  return jsonb_build_object('ok', true, 'slots', v_count);
end $$;
revoke execute on function public.publish_monthly_menu(uuid) from public, anon;
grant execute on function public.publish_monthly_menu(uuid) to authenticated;

-- AI harcama durumu (yönetici; Edge Function service_role ile okur)
create or replace function public.ai_spend_status()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'enabled', b.enabled,
    'daily_usd', b.daily_usd, 'monthly_usd', b.monthly_usd, 'per_call_usd', b.per_call_usd,
    'spent_today', coalesce((select sum(cost_usd) from public.ai_usage where at >= date_trunc('day', now())), 0),
    'spent_month', coalesce((select sum(cost_usd) from public.ai_usage where at >= date_trunc('month', now())), 0))
  from public.ai_budget b where b.id = 1;
$$;
revoke execute on function public.ai_spend_status() from public, anon;
grant execute on function public.ai_spend_status() to authenticated;
