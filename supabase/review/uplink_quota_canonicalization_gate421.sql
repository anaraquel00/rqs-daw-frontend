-- RQS STUDIO ADMIN — GATE 4.2.1.1
-- UPLINK 4-plan quota canonicalization contract.
-- REVIEW-ONLY: do not apply persistently in Staging or Production in this gate.
--
-- Canonical policy:
--   FREE   active uplinks 3,        tracked clicks 1,000 / UTC month
--   MASTER active uplinks unlimited, tracked clicks 25,000 / UTC month
--   PLUS   active uplinks unlimited, tracked clicks 100,000 / UTC month
--   PRO    active uplinks unlimited, tracked clicks 500,000 / UTC month
--
-- Compatibility guarantees:
--   * profiles.role remains present but is no longer authoritative for UPLINK quota.
--   * profiles.click_quota remains present for legacy compatibility but is no longer authoritative.
--   * monthly_clicks remains the operational monthly counter.
--   * create_rqs_uplink(target_url text, requested_slug text) keeps its signature.
--   * increment_uplink_clicks(link_id uuid, source_col text, request_fingerprint text) keeps its signature.
--   * FREE active-limit error remains UPLINK_FREE_LIMIT_REACHED.
--   * click-limit error remains CLICK_QUOTA_EXCEEDED.

-- -----------------------------------------------------------------------------
-- 1. Canonical entitlement columns
-- -----------------------------------------------------------------------------

alter table public.rqs_plan_entitlements
  add column if not exists uplink_active_limit integer,
  add column if not exists uplink_click_limit bigint,
  add column if not exists uplink_click_period text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rqs_plan_entitlements_uplink_active_limit_check'
      and conrelid = 'public.rqs_plan_entitlements'::regclass
  ) then
    alter table public.rqs_plan_entitlements
      add constraint rqs_plan_entitlements_uplink_active_limit_check
      check (uplink_active_limit is null or uplink_active_limit > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rqs_plan_entitlements_uplink_click_limit_check'
      and conrelid = 'public.rqs_plan_entitlements'::regclass
  ) then
    alter table public.rqs_plan_entitlements
      add constraint rqs_plan_entitlements_uplink_click_limit_check
      check (uplink_click_limit > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rqs_plan_entitlements_uplink_click_period_check'
      and conrelid = 'public.rqs_plan_entitlements'::regclass
  ) then
    alter table public.rqs_plan_entitlements
      add constraint rqs_plan_entitlements_uplink_click_period_check
      check (uplink_click_period in ('monthly'));
  end if;
end;
$$;

update public.rqs_plan_entitlements
set
  uplink_active_limit = case plan
    when 'free' then 3
    when 'master' then null
    when 'plus' then null
    when 'pro' then null
  end,
  uplink_click_limit = case plan
    when 'free' then 1000
    when 'master' then 25000
    when 'plus' then 100000
    when 'pro' then 500000
  end,
  uplink_click_period = 'monthly'
where plan in ('free', 'master', 'plus', 'pro');

alter table public.rqs_plan_entitlements
  alter column uplink_click_limit set not null,
  alter column uplink_click_period set not null;

-- -----------------------------------------------------------------------------
-- 2. UTC lazy-reset state, aligned with the Production implementation
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists click_quota_period_start timestamptz;

update public.profiles
set click_quota_period_start = pg_catalog.date_trunc(
  'month',
  pg_catalog.clock_timestamp(),
  'UTC'
)
where click_quota_period_start is null;

alter table public.profiles
  alter column click_quota_period_start
    set default pg_catalog.date_trunc(
      'month',
      pg_catalog.clock_timestamp(),
      'UTC'
    ),
  alter column click_quota_period_start set not null;

-- -----------------------------------------------------------------------------
-- 3. Extend the existing canonical plan resolver (no breaking key removals)
-- -----------------------------------------------------------------------------

create or replace function public.resolve_rqs_plan_entitlement(p_user_id uuid)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_plan text;
  v_master_limit integer;
  v_pitch_limit integer;
  v_period text;
  v_uplink_active_limit integer;
  v_uplink_click_limit bigint;
  v_uplink_click_period text;
begin
  if p_user_id is null then
    raise exception 'SPOTIFY_PITCH_PROFILE_INVALID';
  end if;

  select
    p.rqs_plan,
    e.full_master_limit,
    e.spotify_pitch_limit,
    e.period,
    e.uplink_active_limit,
    e.uplink_click_limit,
    e.uplink_click_period
  into
    v_plan,
    v_master_limit,
    v_pitch_limit,
    v_period,
    v_uplink_active_limit,
    v_uplink_click_limit,
    v_uplink_click_period
  from public.profiles as p
  join public.rqs_plan_entitlements as e
    on e.plan = p.rqs_plan
  where p.id = p_user_id;

  if not found
     or v_plan not in ('free', 'master', 'plus', 'pro')
     or v_uplink_click_limit is null
     or v_uplink_click_limit <= 0
     or v_uplink_click_period <> 'monthly'
     or (v_uplink_active_limit is not null and v_uplink_active_limit <= 0)
  then
    raise exception 'SPOTIFY_PITCH_PROFILE_INVALID';
  end if;

  return jsonb_build_object(
    'plan', v_plan,
    'full_master', jsonb_build_object(
      'limit', v_master_limit,
      'period', v_period
    ),
    'spotify_pitch', jsonb_build_object(
      'limit', v_pitch_limit,
      'period', v_period
    ),
    'uplink', jsonb_build_object(
      'active_limit', v_uplink_active_limit,
      'click_limit', v_uplink_click_limit,
      'click_period', v_uplink_click_period
    )
  );
end;
$function$;

revoke all on function public.resolve_rqs_plan_entitlement(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_rqs_plan_entitlement(uuid)
  to service_role;

-- -----------------------------------------------------------------------------
-- 4. Canonical UPLINK getter for backend/admin observability
-- -----------------------------------------------------------------------------

create or replace function public.get_uplink_quota(p_user_id uuid)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_entitlement jsonb;
  v_plan text;
  v_active_limit integer;
  v_click_limit bigint;
  v_click_period text;
  v_active_used bigint;
  v_monthly_clicks bigint;
  v_period_start timestamptz;
  v_current_period timestamptz;
  v_effective_clicks bigint;
  v_period_key text;
begin
  if p_user_id is null then
    raise exception 'UPLINK_QUOTA_UNAVAILABLE';
  end if;

  v_entitlement := public.resolve_rqs_plan_entitlement(p_user_id);
  v_plan := v_entitlement ->> 'plan';
  v_active_limit := nullif(
    v_entitlement -> 'uplink' ->> 'active_limit',
    ''
  )::integer;
  v_click_limit := (
    v_entitlement -> 'uplink' ->> 'click_limit'
  )::bigint;
  v_click_period := v_entitlement -> 'uplink' ->> 'click_period';

  if v_plan not in ('free', 'master', 'plus', 'pro')
     or v_click_limit is null
     or v_click_limit <= 0
     or v_click_period <> 'monthly'
     or (v_active_limit is not null and v_active_limit <= 0)
  then
    raise exception 'UPLINK_ENTITLEMENT_INVALID';
  end if;

  select count(*)::bigint
  into v_active_used
  from public.rqs_uplinks as uplink
  where uplink.user_id = p_user_id;

  select
    profile.monthly_clicks,
    profile.click_quota_period_start
  into
    v_monthly_clicks,
    v_period_start
  from public.profiles as profile
  where profile.id = p_user_id;

  if not found
     or v_monthly_clicks is null
     or v_period_start is null
  then
    raise exception 'UPLINK_QUOTA_UNAVAILABLE';
  end if;

  v_current_period := pg_catalog.date_trunc(
    'month',
    pg_catalog.clock_timestamp(),
    'UTC'
  );

  if v_period_start > v_current_period then
    raise exception 'CLICK_QUOTA_PERIOD_IN_FUTURE';
  end if;

  v_effective_clicks := case
    when v_period_start < v_current_period then 0
    else v_monthly_clicks
  end;

  v_period_key := pg_catalog.to_char(
    pg_catalog.timezone('UTC', v_current_period),
    'YYYY-MM'
  );

  return jsonb_build_object(
    'plan', v_plan,
    'uplink', jsonb_build_object(
      'active', jsonb_build_object(
        'used', v_active_used,
        'limit', v_active_limit,
        'remaining', case
          when v_active_limit is null then null
          else greatest(0::bigint, v_active_limit::bigint - v_active_used)
        end,
        'unlimited', v_active_limit is null,
        'can_create', v_active_limit is null or v_active_used < v_active_limit
      ),
      'clicks', jsonb_build_object(
        'used', v_effective_clicks,
        'limit', v_click_limit,
        'remaining', greatest(0::bigint, v_click_limit - v_effective_clicks),
        'period', v_click_period,
        'period_key', v_period_key,
        'can_track', v_effective_clicks < v_click_limit
      )
    )
  );
end;
$function$;

revoke all on function public.get_uplink_quota(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_uplink_quota(uuid)
  to service_role;

-- -----------------------------------------------------------------------------
-- 5. Canonicalize UPLINK creation: rqs_plan entitlement, not legacy role
-- -----------------------------------------------------------------------------

create or replace function public.create_rqs_uplink(
  target_url text,
  requested_slug text default null::text
)
returns setof public.rqs_uplinks
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_entitlement jsonb;
  v_plan text;
  v_active_limit integer;
  v_active_used bigint;
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

  v_entitlement := public.resolve_rqs_plan_entitlement(v_user_id);
  v_plan := v_entitlement ->> 'plan';
  v_active_limit := nullif(
    v_entitlement -> 'uplink' ->> 'active_limit',
    ''
  )::integer;

  select count(*)::bigint
  into v_active_used
  from public.rqs_uplinks as uplink
  where uplink.user_id = v_user_id;

  if v_active_limit is not null
     and v_active_used >= v_active_limit
  then
    if v_plan = 'free' then
      raise exception 'UPLINK_FREE_LIMIT_REACHED';
    end if;
    raise exception 'UPLINK_ACTIVE_LIMIT_REACHED';
  end if;

  if v_url is null
     or pg_catalog.length(v_url) > 2048
     or v_url !~ '^https://[^[:space:]]+$'
  then
    raise exception 'UPLINK_INVALID_TARGET_URL';
  end if;

  v_slug := pg_catalog.lower(coalesce(
    nullif(btrim(requested_slug), ''),
    'rqs-' || pg_catalog.substr(
      pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
      1,
      10
    )
  ));

  if pg_catalog.length(v_slug) < 3
     or pg_catalog.length(v_slug) > 64
     or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception 'UPLINK_INVALID_SLUG';
  end if;

  if v_slug = any(v_reserved_slugs) then
    raise exception 'UPLINK_RESERVED_SLUG';
  end if;

  insert into public.rqs_uplinks (
    id,
    user_id,
    custom_slug,
    target_url,
    clicks,
    source_instagram,
    source_tiktok,
    source_facebook,
    source_youtube,
    source_direct
  ) values (
    pg_catalog.gen_random_uuid(),
    v_user_id,
    v_slug,
    v_url,
    0,
    0,
    0,
    0,
    0,
    0
  )
  returning * into v_row;

  return next v_row;
exception
  when unique_violation then
    raise exception 'UPLINK_SLUG_TAKEN';
end;
$function$;

revoke all on function public.create_rqs_uplink(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_rqs_uplink(text, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Canonicalize click tracking: rqs_plan entitlement + UTC lazy reset
-- -----------------------------------------------------------------------------

create or replace function public.increment_uplink_clicks(
  link_id uuid,
  source_col text,
  request_fingerprint text
)
returns boolean
language plpgsql
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_plan text;
  v_monthly_clicks bigint;
  v_effective_monthly_clicks bigint;
  v_click_limit bigint;
  v_click_period text;
  v_stored_period timestamptz;
  v_current_period timestamptz;
  v_now timestamptz;
  v_inserted integer;
begin
  if source_col is null
     or source_col not in (
       'source_instagram',
       'source_tiktok',
       'source_facebook',
       'source_youtube',
       'source_direct'
     )
  then
    raise exception 'INVALID_SOURCE';
  end if;

  if request_fingerprint is null
     or request_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception 'INVALID_FINGERPRINT';
  end if;

  select uplink.user_id
  into v_user_id
  from public.rqs_uplinks as uplink
  where uplink.id = increment_uplink_clicks.link_id
  for no key update;

  if not found or v_user_id is null then
    raise exception 'UPLINK_NOT_FOUND';
  end if;

  v_now := pg_catalog.clock_timestamp();

  insert into public.rqs_uplink_click_dedup as dedup (
    link_id,
    fingerprint_hash,
    last_counted_at
  ) values (
    increment_uplink_clicks.link_id,
    request_fingerprint,
    v_now
  )
  on conflict on constraint rqs_uplink_click_dedup_pkey
  do update
    set last_counted_at = excluded.last_counted_at
    where dedup.last_counted_at
          <= excluded.last_counted_at - interval '60 seconds'
  returning 1 into v_inserted;

  if v_inserted is null then
    return false;
  end if;

  select
    profile.rqs_plan,
    profile.monthly_clicks,
    profile.click_quota_period_start,
    entitlement.uplink_click_limit,
    entitlement.uplink_click_period
  into
    v_plan,
    v_monthly_clicks,
    v_stored_period,
    v_click_limit,
    v_click_period
  from public.profiles as profile
  join public.rqs_plan_entitlements as entitlement
    on entitlement.plan = profile.rqs_plan
  where profile.id = v_user_id
  for update of profile;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_plan not in ('free', 'master', 'plus', 'pro') then
    raise exception 'UPLINK_INVALID_PLAN';
  end if;

  if v_monthly_clicks is null then
    raise exception 'MONTHLY_CLICKS_MISSING';
  end if;

  if v_click_limit is null or v_click_limit <= 0 then
    raise exception 'CLICK_QUOTA_MISSING';
  end if;

  if v_click_period <> 'monthly' then
    raise exception 'CLICK_QUOTA_PERIOD_INVALID';
  end if;

  if v_stored_period is null then
    raise exception 'CLICK_QUOTA_PERIOD_MISSING';
  end if;

  v_current_period := pg_catalog.date_trunc(
    'month',
    pg_catalog.clock_timestamp(),
    'UTC'
  );

  if v_stored_period > v_current_period then
    raise exception 'CLICK_QUOTA_PERIOD_IN_FUTURE';
  end if;

  v_effective_monthly_clicks := case
    when v_stored_period < v_current_period then 0
    else v_monthly_clicks
  end;

  if v_effective_monthly_clicks >= v_click_limit then
    raise exception 'CLICK_QUOTA_EXCEEDED';
  end if;

  update public.rqs_uplinks
  set
    clicks = clicks + 1,
    source_instagram = source_instagram
      + case when source_col = 'source_instagram' then 1 else 0 end,
    source_tiktok = source_tiktok
      + case when source_col = 'source_tiktok' then 1 else 0 end,
    source_facebook = source_facebook
      + case when source_col = 'source_facebook' then 1 else 0 end,
    source_youtube = source_youtube
      + case when source_col = 'source_youtube' then 1 else 0 end,
    source_direct = source_direct
      + case when source_col = 'source_direct' then 1 else 0 end
  where id = increment_uplink_clicks.link_id;

  if not found then
    raise exception 'UPLINK_UPDATE_FAILED';
  end if;

  update public.profiles
  set
    monthly_clicks = v_effective_monthly_clicks + 1,
    click_quota_period_start = v_current_period
  where id = v_user_id;

  if not found then
    raise exception 'PROFILE_UPDATE_FAILED';
  end if;

  delete from public.rqs_uplink_click_dedup as dedup
  where dedup.link_id = increment_uplink_clicks.link_id
    and dedup.last_counted_at < v_now - interval '48 hours';

  return true;
end;
$function$;

revoke all on function public.increment_uplink_clicks(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.increment_uplink_clicks(uuid, text, text)
  to service_role;

-- No DROP of legacy quota columns in Gate 4.2.1.
-- profiles.role and profiles.click_quota are deliberately preserved for compatibility.
