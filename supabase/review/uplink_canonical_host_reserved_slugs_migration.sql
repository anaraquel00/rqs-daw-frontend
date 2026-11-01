-- Forward-only review migration for canonical Studio host containment.
-- This changes only custom-slug validation; resolver behavior and existing rows stay untouched.

begin;

do $preflight$
begin
  if to_regprocedure('public.create_rqs_uplink(text,text)') is null then
    raise exception 'RQS_UPLINK_CREATE_RPC_MISSING';
  end if;
end;
$preflight$;

create or replace function public.create_rqs_uplink(
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
  v_reserved_slugs constant text[] := array[
    'account',
    'admin',
    'api',
    'app',
    'assets',
    'build',
    'contact',
    'contato',
    'cookies',
    'indicacoes',
    'learn',
    'legacy',
    'login',
    'master',
    'pitch',
    'pricing',
    'privacidade',
    'privacy',
    'referral-terms',
    'rqs-router',
    'robots.txt',
    'signin',
    'signup',
    'sitemap.xml',
    'split',
    'studio',
    'termos',
    'terms',
    'uplink',
    'workspace'
  ];
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

commit;
