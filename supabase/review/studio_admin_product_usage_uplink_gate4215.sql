-- RQS Studio Admin — Gate 4.2.1.5
-- Product Usage UPLINK projection
--
-- Preconditions:
--   Gate 4.2.1 canonical UPLINK quota contract is already applied.
--
-- Scope:
--   Extend the owner-only Studio Admin usage RPC with canonical UPLINK
--   active-link and tracked-click telemetry.
--
-- PostgreSQL cannot change a RETURNS TABLE shape with CREATE OR REPLACE.
-- This delta intentionally drops and recreates the function atomically.

begin;

do $preflight$
begin
  if to_regprocedure('public.get_uplink_quota(uuid)') is null then
    raise exception 'GATE4215_GET_UPLINK_QUOTA_REQUIRED';
  end if;

  if to_regclass('public.studio_admin_memberships') is null then
    raise exception 'GATE4215_ADMIN_MEMBERSHIPS_REQUIRED';
  end if;

  if to_regprocedure(
    'public.studio_admin_usage_records(integer,timestamp with time zone,text,text)'
  ) is null then
    raise exception 'GATE4215_USAGE_RPC_REQUIRED';
  end if;
end;
$preflight$;

drop function public.studio_admin_usage_records(
  integer,
  timestamp with time zone,
  text,
  text
);

create function public.studio_admin_usage_records(
  p_fetch_limit integer default 26,
  p_cursor_created_at timestamp with time zone default null::timestamp with time zone,
  p_cursor_ref text default null::text,
  p_plan text default null::text
)
returns table(
  cursor_ref text,
  cursor_created_at timestamp with time zone,
  identity_ref text,
  masked_email text,
  plan text,

  master_used bigint,
  master_reserved bigint,
  master_limit integer,
  master_remaining bigint,
  master_period text,
  master_period_key text,
  master_available boolean,

  pitch_used bigint,
  pitch_reserved bigint,
  pitch_limit integer,
  pitch_remaining bigint,
  pitch_period text,
  pitch_period_key text,
  pitch_available boolean,

  build_projects_used bigint,
  build_projects_limit integer,
  build_projects_remaining bigint,
  build_projects_available boolean,

  build_storage_confirmed_bytes bigint,
  build_storage_reserved_bytes bigint,
  build_storage_used_bytes bigint,
  build_storage_limit_bytes bigint,
  build_storage_remaining_bytes bigint,
  build_storage_available boolean,

  uplink_active_used bigint,
  uplink_active_limit integer,
  uplink_active_remaining bigint,
  uplink_active_unlimited boolean,
  uplink_active_available boolean,

  uplink_clicks_used bigint,
  uplink_clicks_limit bigint,
  uplink_clicks_remaining bigint,
  uplink_clicks_period text,
  uplink_clicks_period_key text,
  uplink_clicks_available boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin_user_id uuid := auth.uid();
  v_plan text :=
    nullif(
      lower(
        btrim(
          coalesce(
            p_plan,
            ''
          )
        )
      ),
      ''
    );
begin
  if
    v_admin_user_id is null
    or not exists (
      select 1
      from public.studio_admin_memberships m
      where
        m.user_id = v_admin_user_id
        and m.active = true
        and m.role = 'owner'
    )
  then
    raise exception
      using
        errcode = '42501',
        message = 'STUDIO_ADMIN_OWNER_REQUIRED';
  end if;

  if
    p_fetch_limit < 1
    or p_fetch_limit > 51
  then
    raise exception
      using
        errcode = '22023',
        message = 'STUDIO_ADMIN_INVALID_PAGE_SIZE';
  end if;

  if
    (p_cursor_created_at is null)
    <>
    (p_cursor_ref is null)
  then
    raise exception
      using
        errcode = '22023',
        message = 'STUDIO_ADMIN_INVALID_CURSOR';
  end if;

  if
    p_cursor_ref is not null
    and p_cursor_ref !~ '^[0-9a-f]{32}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'STUDIO_ADMIN_INVALID_CURSOR';
  end if;

  if
    v_plan is not null
    and v_plan not in (
      'free',
      'master',
      'plus',
      'pro',
      'unknown'
    )
  then
    raise exception
      using
        errcode = '22023',
        message = 'STUDIO_ADMIN_INVALID_PLAN_FILTER';
  end if;

  return query

  with identity_rows as (
    select
      md5(u.id::text) as row_cursor_ref,
      coalesce(
        u.created_at,
        '1970-01-01 00:00:00+00'::timestamptz
      ) as row_cursor_created_at,
      substring(
        md5(u.id::text)
        from 1 for 12
      ) as row_identity_ref,

      case
        when position('@' in coalesce(u.email, '')) > 1
        then
          left(
            split_part(lower(u.email), '@', 1),
            2
          )
          || '***@'
          || split_part(lower(u.email), '@', 2)
        else 'UNKNOWN'
      end as row_masked_email,

      case
        when e.plan is not null
        then p.rqs_plan
        else 'unknown'
      end as row_plan,

      case
        when e.plan is not null
        then u.id
        else null
      end as row_profile_id

    from auth.users u

    left join public.profiles p
      on p.id = u.id

    left join public.rqs_plan_entitlements e
      on e.plan = p.rqs_plan
  ),

  paged_rows as (
    select r.*
    from identity_rows r
    where
      (
        v_plan is null
        or r.row_plan = v_plan
      )
      and (
        p_cursor_created_at is null
        or (
          r.row_cursor_created_at,
          r.row_cursor_ref
        )
        <
        (
          p_cursor_created_at,
          p_cursor_ref
        )
      )
    order by
      r.row_cursor_created_at desc,
      r.row_cursor_ref desc
    limit p_fetch_limit
  ),

  usage_rows as (
    select
      p.row_cursor_ref,
      public.get_mastering_quota(p.row_profile_id) as master_quota,
      public.get_spotify_pitch_quota(p.row_profile_id) as pitch_quota,
      public.get_build_quota(p.row_profile_id) as build_quota,
      public.get_uplink_quota(p.row_profile_id) as uplink_quota
    from paged_rows p
    where
      p.row_profile_id is not null
      and p.row_plan <> 'unknown'
  )

  select
    p.row_cursor_ref,
    p.row_cursor_created_at,
    p.row_identity_ref,
    p.row_masked_email,
    p.row_plan,

    (u.master_quota -> 'full_master' ->> 'used')::bigint,
    (u.master_quota -> 'full_master' ->> 'active_reservations')::bigint,
    (u.master_quota -> 'full_master' ->> 'limit')::integer,
    (u.master_quota -> 'full_master' ->> 'remaining')::bigint,
    u.master_quota -> 'full_master' ->> 'period',
    u.master_quota -> 'full_master' ->> 'period_key',
    (u.master_quota -> 'full_master' ->> 'can_master')::boolean,

    (u.pitch_quota -> 'spotify_pitch' ->> 'used')::bigint,
    (u.pitch_quota -> 'spotify_pitch' ->> 'active_reservations')::bigint,
    (u.pitch_quota -> 'spotify_pitch' ->> 'limit')::integer,
    (u.pitch_quota -> 'spotify_pitch' ->> 'remaining')::bigint,
    u.pitch_quota -> 'spotify_pitch' ->> 'period',
    u.pitch_quota -> 'spotify_pitch' ->> 'period_key',
    (u.pitch_quota -> 'spotify_pitch' ->> 'can_generate')::boolean,

    (u.build_quota -> 'projects' ->> 'used')::bigint,
    (u.build_quota -> 'projects' ->> 'limit')::integer,
    (u.build_quota -> 'projects' ->> 'remaining')::bigint,
    (u.build_quota -> 'projects' ->> 'canCreate')::boolean,

    (u.build_quota -> 'storage' ->> 'confirmedBytes')::bigint,
    (u.build_quota -> 'storage' ->> 'reservedBytes')::bigint,
    (u.build_quota -> 'storage' ->> 'usedBytes')::bigint,
    (u.build_quota -> 'storage' ->> 'limitBytes')::bigint,
    (u.build_quota -> 'storage' ->> 'remainingBytes')::bigint,
    (u.build_quota -> 'storage' ->> 'canReserve')::boolean,

    (u.uplink_quota -> 'uplink' -> 'active' ->> 'used')::bigint,
    (u.uplink_quota -> 'uplink' -> 'active' ->> 'limit')::integer,
    (u.uplink_quota -> 'uplink' -> 'active' ->> 'remaining')::bigint,
    (u.uplink_quota -> 'uplink' -> 'active' ->> 'unlimited')::boolean,
    (u.uplink_quota -> 'uplink' -> 'active' ->> 'can_create')::boolean,

    (u.uplink_quota -> 'uplink' -> 'clicks' ->> 'used')::bigint,
    (u.uplink_quota -> 'uplink' -> 'clicks' ->> 'limit')::bigint,
    (u.uplink_quota -> 'uplink' -> 'clicks' ->> 'remaining')::bigint,
    u.uplink_quota -> 'uplink' -> 'clicks' ->> 'period',
    u.uplink_quota -> 'uplink' -> 'clicks' ->> 'period_key',
    (u.uplink_quota -> 'uplink' -> 'clicks' ->> 'can_track')::boolean

  from paged_rows p

  left join usage_rows u
    on u.row_cursor_ref = p.row_cursor_ref

  order by
    p.row_cursor_created_at desc,
    p.row_cursor_ref desc;
end;
$function$;

revoke all on function public.studio_admin_usage_records(
  integer,
  timestamp with time zone,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.studio_admin_usage_records(
  integer,
  timestamp with time zone,
  text,
  text
) to authenticated;

commit;
