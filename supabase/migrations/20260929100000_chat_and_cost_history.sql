-- TRAKYA CATERING ERP — 8: ekip sohbeti ve reçete maliyet geçmişi
--
-- Sohbet: kanal bazlı kısa mesajlar (genel, mutfak, sevkiyat, satınalma). Müşteri talepleri
-- ("tuzluk istedi") buradan mutfak/depoya iletilir. Realtime ile anlık.
-- Reçete maliyet geçmişi: reçetedeki "Güncelle" butonu o anki maliyetin anlık görüntüsünü yazar;
-- böylece "son güncellemeden bu yana ne kadar arttı" görülebilir.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'genel' check (channel in ('genel','mutfak','sevkiyat','satinalma')),
  body text not null check (length(trim(body)) between 1 and 2000),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_channel_idx on public.chat_messages (channel, created_at desc);

-- Yazar adı istemciden gelmez; ekip kaydından yazılır (taklit edilemez)
create or replace function public.chat_set_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_id := auth.uid();
  new.author_name := coalesce((select full_name from public.team_members where user_id = auth.uid()), 'Bilinmeyen');
  new.created_at := now();
  return new;
end $$;
revoke execute on function public.chat_set_author() from public, anon, authenticated;
create trigger chat_messages_author before insert on public.chat_messages
  for each row execute function public.chat_set_author();

create table if not exists public.recipe_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  cost numeric(14,4) not null check (cost >= 0),
  noted_at timestamptz not null default now(),
  note text,
  created_by uuid default auth.uid()
);
create index if not exists recipe_cost_snapshots_idx on public.recipe_cost_snapshots (recipe_id, noted_at desc);

alter table public.chat_messages enable row level security;
alter table public.recipe_cost_snapshots enable row level security;

create policy chat_messages_read on public.chat_messages for select to authenticated using (public.is_staff());
create policy chat_messages_insert on public.chat_messages for insert to authenticated with check (public.is_staff());
create policy chat_messages_delete on public.chat_messages for delete to authenticated
  using (author_id = auth.uid() or public.has_role(array['yonetici']));

create policy recipe_cost_snapshots_read on public.recipe_cost_snapshots for select to authenticated using (public.is_staff());
create policy recipe_cost_snapshots_insert on public.recipe_cost_snapshots for insert to authenticated
  with check (public.has_role(array['yonetici','asci_basi','diyetisyen','satinalma']));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
