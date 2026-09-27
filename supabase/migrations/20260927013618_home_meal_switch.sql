-- Kullanıcı notu H: ana sayfa "şimdiki öğün" kartı eşik saatleri (şirket geneli) + kap türünde servis şekli (tepsi / küvet).
-- Yalnızca eklemeli: nullable sütunlar + check. Veri değişikliği yok; RLS mevcut politikalarla aynı kalır.
alter table public.company_settings
  add column if not exists home_breakfast_until text default '07:00',
  add column if not exists home_lunch_until text default '11:00',
  add column if not exists home_dinner_until text default '23:59';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'company_settings_home_times_check') then
    alter table public.company_settings add constraint company_settings_home_times_check check (
      (home_breakfast_until is null or home_breakfast_until ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
      and (home_lunch_until is null or home_lunch_until ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
      and (home_dinner_until is null or home_dinner_until ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'));
  end if;
end $$;
comment on column public.company_settings.home_breakfast_until is 'Bugün ekranı: bu saate kadar bugünün kahvaltısı, sonra yarının kahvaltısı gösterilir (HH:MM, Europe/Istanbul)';
comment on column public.company_settings.home_lunch_until is 'Bugün ekranı: bu saate kadar öğle hazırlığı, sonra akşam hazırlığı gösterilir (HH:MM, Europe/Istanbul)';
comment on column public.company_settings.home_dinner_until is 'Bugün ekranı: bu saatten sonra yarının öğle hazırlığı gösterilir (HH:MM, Europe/Istanbul)';

alter table public.container_types add column if not exists service_style text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'container_types_service_style_check') then
    alter table public.container_types add constraint container_types_service_style_check check (service_style is null or service_style in ('tepsi','kuvet'));
  end if;
end $$;
comment on column public.container_types.service_style is 'Servis şekli: tepsi (kişi başı porsiyonlu) / küvet (toplu gastronom); boşsa Bugün ekranında "servis şekli tanımsız"';
