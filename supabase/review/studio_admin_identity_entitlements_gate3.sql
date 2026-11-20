-- REVIEW ONLY — RQS Studio Admin Gate 3: Supabase Identity & Entitlements.
-- Apply only in a dedicated Staging authorization gate after code review.
-- Application contract remains read-only: these functions expose SELECT-only projections.
--
-- Canonical identity: auth.users
-- Canonical commercial plan assignment: public.profiles.rqs_plan
-- Canonical plan catalog: public.rqs_plan_entitlements
--
-- No service_role / secret key is required by the Admin runtime.

begin;

create or replace function public.studio_admin_identity_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_admin_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_admin_user_id is null or not exists (
    select 1
    from public.studio_admin_memberships m
    where m.user_id = v_admin_user_id
      and m.active = true
      and m.role = 'owner'
  ) then
    raise exception using
      errcode = '42501',
      message = 'STUDIO_ADMIN_OWNER_REQUIRED';
  end if;

  select jsonb_build_object(
    'totalUsers', count(*),
    'activeUsers', count(*) filter (
      where u.deleted_at is null
        and coalesce(u.is_anonymous, false) = false
        and (u.banned_until is null or u.banned_until <= now())
        and u.confirmed_at is not null
    ),
    'confirmedUsers', count(*) filter (where u.confirmed_at is not null),
    'unconfirmedUsers', count(*) filter (where u.confirmed_at is null),
    'authWithoutProfile', count(*) filter (where p.id is null),
    'profilesWithoutAuth', (
      select count(*)
      from public.profiles orphan_profile
      left join auth.users orphan_user on orphan_user.id = orphan_profile.id
      where orphan_user.id is null
    ),
    'byPlan', jsonb_build_object(
      'free', count(*) filter (where p.rqs_plan = 'free' and e.plan is not null),
      'master', count(*) filter (where p.rqs_plan = 'master' and e.plan is not null),
      'plus', count(*) filter (where p.rqs_plan = 'plus' and e.plan is not null),
      'pro', count(*) filter (where p.rqs_plan = 'pro' and e.plan is not null),
      'unknown', count(*) filter (where p.id is null or e.plan is null)
    )
  )
  into v_result
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.rqs_plan_entitlements e on e.plan = p.rqs_plan;

  return v_result;
end;
$function$;

create or replace function public.studio_admin_identity_records(
  p_fetch_limit integer default 26,
  p_cursor_created_at timestamptz default null,
  p_cursor_ref text default null,
  p_plan text default null,
  p_status text default null
)
returns table (
  cursor_ref text,
  cursor_created_at timestamptz,
  identity_ref text,
  masked_email text,
  auth_status text,
  provider text,
  plan text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  full_master_limit integer,
  spotify_pitch_limit integer,
  build_project_limit integer,
  build_storage_bytes_limit bigint
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_admin_user_id uuid := auth.uid();
  v_plan text := nullif(lower(btrim(coalesce(p_plan, ''))), '');
  v_status text := nullif(lower(btrim(coalesce(p_status, ''))), '');
begin
  if v_admin_user_id is null or not exists (
    select 1
    from public.studio_admin_memberships m
    where m.user_id = v_admin_user_id
      and m.active = true
      and m.role = 'owner'
  ) then
    raise exception using
      errcode = '42501',
      message = 'STUDIO_ADMIN_OWNER_REQUIRED';
  end if;

  if p_fetch_limit < 1 or p_fetch_limit > 51 then
    raise exception using
      errcode = '22023',
      message = 'STUDIO_ADMIN_INVALID_PAGE_SIZE';
  end if;

  if (p_cursor_created_at is null) <> (p_cursor_ref is null) then
    raise exception using
      errcode = '22023',
      message = 'STUDIO_ADMIN_INVALID_CURSOR';
  end if;

  if p_cursor_ref is not null
     and p_cursor_ref !~ '^[0-9a-f]{32}$' then
    raise exception using
      errcode = '22023',
      message = 'STUDIO_ADMIN_INVALID_CURSOR';
  end if;

  if v_plan is not null and v_plan not in ('free', 'master', 'plus', 'pro', 'unknown') then
    raise exception using
      errcode = '22023',
      message = 'STUDIO_ADMIN_INVALID_PLAN_FILTER';
  end if;

  if v_status is not null and v_status not in ('active', 'unconfirmed', 'banned', 'deleted', 'anonymous') then
    raise exception using
      errcode = '22023',
      message = 'STUDIO_ADMIN_INVALID_STATUS_FILTER';
  end if;

  return query
  with identity_rows as (
    select
      md5(u.id::text) as row_cursor_ref,
      coalesce(u.created_at, '1970-01-01 00:00:00+00'::timestamptz) as row_cursor_created_at,
      substring(md5(u.id::text) from 1 for 12) as row_identity_ref,
      case
        when position('@' in coalesce(u.email, '')) > 1 then
          left(split_part(lower(u.email), '@', 1), 2)
          || '***@'
          || split_part(lower(u.email), '@', 2)
        else 'UNKNOWN'
      end as row_masked_email,
      case
        when u.deleted_at is not null then 'deleted'
        when coalesce(u.is_anonymous, false) then 'anonymous'
        when u.banned_until is not null and u.banned_until > now() then 'banned'
        when u.confirmed_at is null then 'unconfirmed'
        else 'active'
      end as row_auth_status,
      coalesce(nullif(lower(btrim(u.raw_app_meta_data ->> 'provider')), ''), 'unknown') as row_provider,
      case
        when e.plan is not null then p.rqs_plan
        else 'unknown'
      end as row_plan,
      u.created_at as row_created_at,
      u.last_sign_in_at as row_last_sign_in_at,
      e.full_master_limit as row_full_master_limit,
      e.spotify_pitch_limit as row_spotify_pitch_limit,
      e.build_project_limit as row_build_project_limit,
      e.build_storage_bytes_limit as row_build_storage_bytes_limit
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.rqs_plan_entitlements e on e.plan = p.rqs_plan
  )
  select
    r.row_cursor_ref,
    r.row_cursor_created_at,
    r.row_identity_ref,
    r.row_masked_email,
    r.row_auth_status,
    r.row_provider,
    r.row_plan,
    r.row_created_at,
    r.row_last_sign_in_at,
    r.row_full_master_limit,
    r.row_spotify_pitch_limit,
    r.row_build_project_limit,
    r.row_build_storage_bytes_limit
  from identity_rows r
  where (v_plan is null or r.row_plan = v_plan)
    and (v_status is null or r.row_auth_status = v_status)
    and (
      p_cursor_created_at is null
      or (r.row_cursor_created_at, r.row_cursor_ref)
         < (p_cursor_created_at, p_cursor_ref)
    )
  order by r.row_cursor_created_at desc, r.row_cursor_ref desc
  limit p_fetch_limit;
end;
$function$;

create or replace function public.studio_admin_entitlement_catalog()
returns table (
  plan text,
  period text,
  full_master_limit integer,
  spotify_pitch_limit integer,
  build_project_limit integer,
  build_storage_bytes_limit bigint
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_admin_user_id uuid := auth.uid();
begin
  if v_admin_user_id is null or not exists (
    select 1
    from public.studio_admin_memberships m
    where m.user_id = v_admin_user_id
      and m.active = true
      and m.role = 'owner'
  ) then
    raise exception using
      errcode = '42501',
      message = 'STUDIO_ADMIN_OWNER_REQUIRED';
  end if;

  return query
  select
    e.plan,
    e.period,
    e.full_master_limit,
    e.spotify_pitch_limit,
    e.build_project_limit,
    e.build_storage_bytes_limit
  from public.rqs_plan_entitlements e
  order by
    case e.plan
      when 'free' then 1
      when 'master' then 2
      when 'plus' then 3
      when 'pro' then 4
      else 5
    end,
    e.plan;
end;
$function$;

revoke all on function public.studio_admin_identity_summary() from public, anon, authenticated;
revoke all on function public.studio_admin_identity_records(integer, timestamptz, text, text, text)
  from public, anon, authenticated;
revoke all on function public.studio_admin_entitlement_catalog() from public, anon, authenticated;

grant execute on function public.studio_admin_identity_summary() to authenticated;
grant execute on function public.studio_admin_identity_records(integer, timestamptz, text, text, text)
  to authenticated;
grant execute on function public.studio_admin_entitlement_catalog() to authenticated;

commit;
