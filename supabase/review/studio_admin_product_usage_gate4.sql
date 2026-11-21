-- RQS Studio Admin — Gate 4.1
-- Product Usage Observability
--
-- REVIEW-ONLY.
-- Do not apply to Production.
--
-- Canonical sources:
--
-- MASTER:
--   public.get_mastering_quota(uuid)
--
-- PITCH:
--   public.get_spotify_pitch_quota(uuid)
--
-- BUILD:
--   public.get_build_quota(uuid)
--
-- Canonical identity:
--   auth.users
--
-- Canonical commercial plan:
--   public.profiles.rqs_plan
--
-- The Studio Admin runtime does not receive service_role.
-- This owner-only SECURITY DEFINER projection calls the existing
-- internal quota getters under the function owner's privileges.

create or replace function public.studio_admin_usage_records(
  p_fetch_limit integer default 26,
  p_cursor_created_at timestamptz default null,
  p_cursor_ref text default null,
  p_plan text default null
)
returns table (
  cursor_ref text,
  cursor_created_at timestamptz,

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
  build_storage_available boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin_user_id uuid :=
    auth.uid();

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
  -- ----------------------------------------------------------
  -- Owner-only Admin boundary
  -- ----------------------------------------------------------

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
        message =
          'STUDIO_ADMIN_OWNER_REQUIRED';
  end if;


  -- ----------------------------------------------------------
  -- Bounded page
  --
  -- The API asks for limit + 1, therefore:
  -- UI maximum 50 → SQL maximum 51.
  -- ----------------------------------------------------------

  if
    p_fetch_limit < 1
    or p_fetch_limit > 51
  then
    raise exception
      using
        errcode = '22023',
        message =
          'STUDIO_ADMIN_INVALID_PAGE_SIZE';
  end if;


  -- ----------------------------------------------------------
  -- Opaque cursor
  -- ----------------------------------------------------------

  if
    (
      p_cursor_created_at is null
    )
    <>
    (
      p_cursor_ref is null
    )
  then
    raise exception
      using
        errcode = '22023',
        message =
          'STUDIO_ADMIN_INVALID_CURSOR';
  end if;

  if
    p_cursor_ref is not null
    and p_cursor_ref
      !~ '^[0-9a-f]{32}$'
  then
    raise exception
      using
        errcode = '22023',
        message =
          'STUDIO_ADMIN_INVALID_CURSOR';
  end if;


  -- ----------------------------------------------------------
  -- Explicit commercial plan allowlist
  -- ----------------------------------------------------------

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
        message =
          'STUDIO_ADMIN_INVALID_PLAN_FILTER';
  end if;


  return query

  with identity_rows as (
    select
      md5(u.id::text)
        as row_cursor_ref,

      coalesce(
        u.created_at,
        '1970-01-01 00:00:00+00'::timestamptz
      )
        as row_cursor_created_at,

      substring(
        md5(u.id::text)
        from 1 for 12
      )
        as row_identity_ref,

      case
        when
          position(
            '@'
            in coalesce(
              u.email,
              ''
            )
          ) > 1
        then
          left(
            split_part(
              lower(u.email),
              '@',
              1
            ),
            2
          )
          || '***@'
          || split_part(
            lower(u.email),
            '@',
            2
          )

        else
          'UNKNOWN'
      end
        as row_masked_email,

      case
        when
          e.plan is not null
        then
          p.rqs_plan

        else
          'unknown'
      end
        as row_plan,

      case
        when
          e.plan is not null
        then
          u.id

        else
          null
      end
        as row_profile_id

    from auth.users u

    left join public.profiles p
      on p.id = u.id

    left join public.rqs_plan_entitlements e
      on e.plan = p.rqs_plan
  ),

  paged_rows as (
    select
      r.*
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

      public.get_mastering_quota(
        p.row_profile_id
      )
        as master_quota,

      public.get_spotify_pitch_quota(
        p.row_profile_id
      )
        as pitch_quota,

      public.get_build_quota(
        p.row_profile_id
      )
        as build_quota

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

    (
      u.master_quota
        -> 'full_master'
        ->> 'used'
    )::bigint,

    (
      u.master_quota
        -> 'full_master'
        ->> 'active_reservations'
    )::bigint,

    (
      u.master_quota
        -> 'full_master'
        ->> 'limit'
    )::integer,

    (
      u.master_quota
        -> 'full_master'
        ->> 'remaining'
    )::bigint,

    u.master_quota
      -> 'full_master'
      ->> 'period',

    u.master_quota
      -> 'full_master'
      ->> 'period_key',

    (
      u.master_quota
        -> 'full_master'
        ->> 'can_master'
    )::boolean,


    (
      u.pitch_quota
        -> 'spotify_pitch'
        ->> 'used'
    )::bigint,

    (
      u.pitch_quota
        -> 'spotify_pitch'
        ->> 'active_reservations'
    )::bigint,

    (
      u.pitch_quota
        -> 'spotify_pitch'
        ->> 'limit'
    )::integer,

    (
      u.pitch_quota
        -> 'spotify_pitch'
        ->> 'remaining'
    )::bigint,

    u.pitch_quota
      -> 'spotify_pitch'
      ->> 'period',

    u.pitch_quota
      -> 'spotify_pitch'
      ->> 'period_key',

    (
      u.pitch_quota
        -> 'spotify_pitch'
        ->> 'can_generate'
    )::boolean,


    (
      u.build_quota
        -> 'projects'
        ->> 'used'
    )::bigint,

    (
      u.build_quota
        -> 'projects'
        ->> 'limit'
    )::integer,

    (
      u.build_quota
        -> 'projects'
        ->> 'remaining'
    )::bigint,

    (
      u.build_quota
        -> 'projects'
        ->> 'canCreate'
    )::boolean,


    (
      u.build_quota
        -> 'storage'
        ->> 'confirmedBytes'
    )::bigint,

    (
      u.build_quota
        -> 'storage'
        ->> 'reservedBytes'
    )::bigint,

    (
      u.build_quota
        -> 'storage'
        ->> 'usedBytes'
    )::bigint,

    (
      u.build_quota
        -> 'storage'
        ->> 'limitBytes'
    )::bigint,

    (
      u.build_quota
        -> 'storage'
        ->> 'remainingBytes'
    )::bigint,

    (
      u.build_quota
        -> 'storage'
        ->> 'canReserve'
    )::boolean

  from paged_rows p

  left join usage_rows u
    on
      u.row_cursor_ref =
      p.row_cursor_ref

  order by
    p.row_cursor_created_at desc,
    p.row_cursor_ref desc;
end;
$function$;


-- Browser/Admin runtime:
--
-- authenticated may invoke the wrapper, but the function itself
-- requires an active owner membership before reading anything.
--
-- The underlying product quota RPCs remain inaccessible directly
-- to authenticated/anon clients.

revoke all
on function public.studio_admin_usage_records(
  integer,
  timestamptz,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function public.studio_admin_usage_records(
  integer,
  timestamptz,
  text,
  text
)
to authenticated;
