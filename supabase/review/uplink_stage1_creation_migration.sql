-- RQS Uplink Dashboard Stage 1 — PHASE A / EXPAND.
-- REVIEW/STAGING ONLY. Production execution requires separate authorization.
-- Both the legacy authenticated INSERT path and the new RPC remain available
-- until the separately executed CONTRACT phase.
begin;

do $preflight$
declare
  v_column text;
begin
  if to_regclass('public.rqs_uplinks') is null then
    raise exception 'RQS_UPLINKS_NOT_FOUND';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception 'PROFILES_NOT_FOUND';
  end if;
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'rqs_uplinks'
      and c.relkind = 'r'
      and c.relrowsecurity
  ) then
    raise exception 'RQS_UPLINKS_RLS_REQUIRED';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.rqs_uplinks'::regclass
      and attname = 'id' and atttypid = 'uuid'::regtype
      and attnotnull and not attisdropped
  ) then raise exception 'RQS_UPLINKS_ID_CONTRACT_INVALID'; end if;
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.rqs_uplinks'::regclass
      and attname = 'user_id' and atttypid = 'uuid'::regtype
      and not attisdropped
  ) then raise exception 'RQS_UPLINKS_USER_ID_CONTRACT_INVALID'; end if;
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.rqs_uplinks'::regclass
      and attname = 'custom_slug' and atttypid = 'text'::regtype
      and attnotnull and not attisdropped
  ) then raise exception 'RQS_UPLINKS_CUSTOM_SLUG_CONTRACT_INVALID'; end if;
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.rqs_uplinks'::regclass
      and attname = 'target_url' and atttypid = 'text'::regtype
      and attnotnull and not attisdropped
  ) then raise exception 'RQS_UPLINKS_TARGET_URL_CONTRACT_INVALID'; end if;
  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.rqs_uplinks'::regclass
      and attname = 'created_at' and atttypid = 'timestamptz'::regtype
      and attnotnull and not attisdropped
  ) then raise exception 'RQS_UPLINKS_CREATED_AT_CONTRACT_INVALID'; end if;

  foreach v_column in array array[
    'clicks', 'source_instagram', 'source_tiktok',
    'source_facebook', 'source_youtube', 'source_direct'
  ] loop
    if not exists (
      select 1 from pg_attribute
      where attrelid = 'public.rqs_uplinks'::regclass
        and attname = v_column
        and atttypid in ('int2'::regtype, 'int4'::regtype, 'int8'::regtype)
        and not attisdropped
    ) then
      raise exception 'RQS_UPLINKS_INTEGER_COUNTER_CONTRACT_INVALID: %', v_column;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_index i
    join pg_attribute a
      on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = 'public.rqs_uplinks'::regclass
      and i.indisunique
      and i.indpred is null
      and i.indnkeyatts = 1
      and a.attname = 'custom_slug'
  ) then
    raise exception 'RQS_UPLINKS_CUSTOM_SLUG_UNIQUE_REQUIRED';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rqs_uplinks'
      and cmd = 'SELECT' and roles @> array['authenticated']::name[]
      and replace(coalesce(qual, ''), ' ', '') in (
        '(auth.uid()=user_id)', '(user_id=auth.uid())'
      )
  ) then
    raise exception 'RQS_UPLINKS_OWNER_SELECT_POLICY_REQUIRED';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rqs_uplinks'
      and cmd = 'INSERT' and roles @> array['authenticated']::name[]
      and replace(coalesce(with_check, ''), ' ', '') in (
        '(auth.uid()=user_id)', '(user_id=auth.uid())'
      )
  ) then
    raise exception 'RQS_UPLINKS_OWNER_INSERT_POLICY_REQUIRED';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname = 'id' and atttypid = 'uuid'::regtype
      and not attisdropped
  ) or not exists (
    select 1 from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname = 'role' and atttypid = 'text'::regtype
      and not attisdropped
  ) then
    raise exception 'PROFILES_ROLE_CONTRACT_INVALID';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_rqs_uplink'
  ) then
    raise exception 'CREATE_RQS_UPLINK_UNEXPECTED_EXISTING_FUNCTION';
  end if;
  if to_regclass('public.rqs_uplinks_user_id_created_at_idx') is not null then
    raise exception 'RQS_UPLINK_STAGE1_INDEX_UNEXPECTED_EXISTING';
  end if;
end;
$preflight$;

create index rqs_uplinks_user_id_created_at_idx
on public.rqs_uplinks (user_id, created_at desc);

revoke all privileges on table public.rqs_uplinks from anon;
revoke all privileges on table public.rqs_uplinks from authenticated;
grant select, insert on table public.rqs_uplinks to authenticated;

create function public.create_rqs_uplink(
  target_url text,
  requested_slug text default null
)
returns setof public.rqs_uplinks
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_slug text;
  v_url text := btrim(target_url);
  v_row public.rqs_uplinks%rowtype;
  v_reserved_slugs constant text[] := array['rqs-router'];
begin
  if v_user_id is null then
    raise exception 'UPLINK_AUTH_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 1387628465)
  );

  select p.role::text into v_role
  from public.profiles p
  where p.id = v_user_id;

  if not found then raise exception 'UPLINK_PROFILE_NOT_FOUND'; end if;
  if v_role not in ('free', 'premium') then
    raise exception 'UPLINK_INVALID_PROFILE_ROLE';
  end if;
  if v_role = 'free' and (
    select pg_catalog.count(*) from public.rqs_uplinks u where u.user_id = v_user_id
  ) >= 3 then
    raise exception 'UPLINK_FREE_LIMIT_REACHED';
  end if;

  if v_url is null or pg_catalog.length(v_url) > 2048
     or v_url !~ '^https://[^[:space:]]+$' then
    raise exception 'UPLINK_INVALID_TARGET_URL';
  end if;

  v_slug := pg_catalog.lower(coalesce(
    nullif(btrim(requested_slug), ''),
    'rqs-' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 10)
  ));
  if pg_catalog.length(v_slug) < 3 or pg_catalog.length(v_slug) > 64
     or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'UPLINK_INVALID_SLUG';
  end if;
  if v_slug = any(v_reserved_slugs) then
    raise exception 'UPLINK_RESERVED_SLUG';
  end if;

  insert into public.rqs_uplinks (
    id, user_id, custom_slug, target_url, clicks,
    source_instagram, source_tiktok, source_facebook, source_youtube, source_direct
  ) values (
    pg_catalog.gen_random_uuid(), v_user_id, v_slug, v_url, 0, 0, 0, 0, 0, 0
  )
  returning * into v_row;

  return next v_row;
exception
  when unique_violation then raise exception 'UPLINK_SLUG_TAKEN';
end;
$function$;

revoke all on function public.create_rqs_uplink(text, text)
from public, anon, authenticated, service_role;
grant execute on function public.create_rqs_uplink(text, text) to authenticated;

commit;
