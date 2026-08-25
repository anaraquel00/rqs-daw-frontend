-- Isolated local/CI fixture matching the observed staging rqs_uplinks shape.
-- It contains no staging credentials and must never target a remote database.
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$roles$;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$ select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.profiles (
  id uuid primary key,
  role text not null check (role in ('free', 'premium')),
  monthly_clicks bigint not null default 0,
  click_quota bigint not null default 0
);

create table public.rqs_uplinks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  custom_slug text not null unique,
  target_url text not null,
  clicks bigint not null default 0,
  source_instagram bigint not null default 0,
  source_tiktok bigint not null default 0,
  source_facebook bigint not null default 0,
  source_youtube bigint not null default 0,
  source_direct bigint not null default 0,
  created_at timestamptz not null default statement_timestamp()
);

alter table public.rqs_uplinks enable row level security;
revoke all on table public.rqs_uplinks from anon, authenticated;
-- Live staging currently exposes SELECT only before PHASE A / EXPAND.
grant select on table public.rqs_uplinks to authenticated;

create policy "Owners can read own uplinks"
on public.rqs_uplinks for select to authenticated
using ((select auth.uid()) = user_id);

-- Keep one direct owner form in the matrix to prove backwards compatibility.
create policy "Permitir inserção de uplinks"
on public.rqs_uplinks for insert to authenticated
with check (auth.uid() = user_id);

insert into public.profiles(id, role, click_quota) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'free', 100),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'free', 100),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'premium', 1000);

create table public.rqs_uplink_click_dedup (
  link_id uuid not null references public.rqs_uplinks(id) on delete cascade,
  fingerprint_hash text not null check (fingerprint_hash ~ '^[0-9a-f]{64}$'),
  last_counted_at timestamptz not null,
  primary key (link_id, fingerprint_hash)
);
create index rqs_uplink_click_dedup_retention_idx
on public.rqs_uplink_click_dedup(link_id, last_counted_at);
alter table public.rqs_uplink_click_dedup enable row level security;
revoke all on table public.rqs_uplink_click_dedup from public, anon, authenticated;
grant select, insert, update, delete on table public.rqs_uplink_click_dedup to service_role;

create function public.increment_uplink_clicks(
  link_id uuid,
  source_col text,
  request_fingerprint text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $tracking_sentinel$
begin
  return true;
end;
$tracking_sentinel$;
revoke all on function public.increment_uplink_clicks(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.increment_uplink_clicks(uuid, text, text)
to service_role;
