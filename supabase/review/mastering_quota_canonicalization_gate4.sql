-- RQS Studio Admin / Product Usage
-- Gate 4.0.1 — MASTER quota canonicalization
--
-- REVIEW-ONLY.
-- Do not apply to Production.
--
-- Goals:
-- - preserve all legacy mastering quota rows unchanged;
-- - migrate future MASTER quota enforcement from profiles.role
--   to profiles.rqs_plan + rqs_plan_entitlements;
-- - introduce a canonical get_mastering_quota(uuid) contract;
-- - retain completed_masters only as free/legacy compatibility state;
-- - preserve the existing service-role-only RPC boundary.

alter table public.mastering_quota_reservations
  add column if not exists plan text,
  add column if not exists period text,
  add column if not exists period_key text,
  add column if not exists quota_limit integer,
  add column if not exists policy_version text;

do $constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'mastering_quota_reservations_canonical_policy_check'
      and conrelid =
        'public.mastering_quota_reservations'::regclass
  ) then
    alter table public.mastering_quota_reservations
      add constraint
        mastering_quota_reservations_canonical_policy_check
      check (
        policy_version is null
        or (
          policy_version = 'rqs_plan_v1'
          and plan in ('free', 'master', 'plus', 'pro')
          and period in ('lifetime', 'monthly')
          and quota_limit is not null
          and quota_limit >= 0
          and counts_quota = true
          and (
            (
              period = 'lifetime'
              and period_key = 'lifetime'
            )
            or (
              period = 'monthly'
              and period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
            )
          )
        )
      );
  end if;
end
$constraints$;


create or replace function public.get_mastering_quota(
  p_user_id uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_entitlement jsonb;
  v_plan text;
  v_period text;
  v_period_key text;
  v_limit integer;
  v_used bigint;
  v_reserved bigint;
  v_updated_at timestamptz;
begin
  if p_user_id is null then
    raise exception 'MASTERING_PROFILE_INVALID';
  end if;

  v_entitlement :=
    public.resolve_rqs_plan_entitlement(p_user_id);

  v_plan :=
    v_entitlement ->> 'plan';

  v_period :=
    v_entitlement
      -> 'full_master'
      ->> 'period';

  v_limit :=
    (
      v_entitlement
        -> 'full_master'
        ->> 'limit'
    )::integer;

  if
    v_plan not in ('free', 'master', 'plus', 'pro')
    or v_period not in ('lifetime', 'monthly')
    or v_limit is null
    or v_limit < 0
  then
    raise exception 'MASTERING_ENTITLEMENT_INVALID';
  end if;

  v_period_key :=
    case
      when v_period = 'lifetime'
        then 'lifetime'
      else
        to_char(
          timezone('UTC', v_now),
          'YYYY-MM'
        )
    end;

  select
    count(*) filter (
      where r.status = 'completed'
    )::bigint,

    count(*) filter (
      where r.status = 'reserved'
        and r.created_at >=
          v_now - interval '2 hours'
    )::bigint,

    max(
      coalesce(
        r.finalized_at,
        r.created_at
      )
    )
  into
    v_used,
    v_reserved,
    v_updated_at
  from public.mastering_quota_reservations r
  where
    r.user_id = p_user_id
    and r.counts_quota = true
    and (
      (
        v_period = 'lifetime'
        and (
          -- Existing counted free reservations are retained
          -- as lifetime usage without rewriting history.
          r.policy_version is null
          or (
            r.policy_version = 'rqs_plan_v1'
            and r.period_key = 'lifetime'
          )
        )
      )
      or (
        v_period = 'monthly'
        and r.policy_version = 'rqs_plan_v1'
        and r.period_key = v_period_key
      )
    );

  v_used :=
    coalesce(v_used, 0);

  v_reserved :=
    coalesce(v_reserved, 0);

  return jsonb_build_object(
    'plan',
    v_plan,

    'full_master',
    jsonb_build_object(
      'used',
      v_used,

      'limit',
      v_limit,

      'remaining',
      greatest(
        0,
        v_limit - v_used - v_reserved
      ),

      'period',
      v_period,

      'period_key',
      v_period_key,

      'can_master',
      (v_used + v_reserved) < v_limit,

      'active_reservations',
      v_reserved,

      'updated_at',
      v_updated_at
    )
  );
end;
$function$;


create or replace function public.reserve_mastering_quota(
  p_user_id uuid,
  p_reservation_id uuid
)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_entitlement jsonb;
  v_plan text;
  v_period text;
  v_period_key text;
  v_limit integer;
  v_used bigint;
  v_reserved bigint;
begin
  if
    p_user_id is null
    or p_reservation_id is null
  then
    raise exception
      'MASTERING_RESERVATION_ARGUMENT_MISSING';
  end if;

  -- Preserve the existing per-user serialization boundary.
  perform 1
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  v_entitlement :=
    public.resolve_rqs_plan_entitlement(p_user_id);

  v_plan :=
    v_entitlement ->> 'plan';

  v_period :=
    v_entitlement
      -> 'full_master'
      ->> 'period';

  v_limit :=
    (
      v_entitlement
        -> 'full_master'
        ->> 'limit'
    )::integer;

  if
    v_plan not in ('free', 'master', 'plus', 'pro')
    or v_period not in ('lifetime', 'monthly')
    or v_limit is null
    or v_limit < 0
  then
    raise exception 'MASTERING_ENTITLEMENT_INVALID';
  end if;

  v_period_key :=
    case
      when v_period = 'lifetime'
        then 'lifetime'
      else
        to_char(
          timezone('UTC', v_now),
          'YYYY-MM'
        )
    end;

  -- Preserve the existing two-hour reservation expiry.
  update public.mastering_quota_reservations
  set
    status = 'released',
    finalized_at = v_now
  where
    user_id = p_user_id
    and status = 'reserved'
    and created_at <
      v_now - interval '2 hours';

  select
    count(*) filter (
      where r.status = 'completed'
    )::bigint,

    count(*) filter (
      where r.status = 'reserved'
        and r.created_at >=
          v_now - interval '2 hours'
    )::bigint
  into
    v_used,
    v_reserved
  from public.mastering_quota_reservations r
  where
    r.user_id = p_user_id
    and r.counts_quota = true
    and (
      (
        v_period = 'lifetime'
        and (
          r.policy_version is null
          or (
            r.policy_version = 'rqs_plan_v1'
            and r.period_key = 'lifetime'
          )
        )
      )
      or (
        v_period = 'monthly'
        and r.policy_version = 'rqs_plan_v1'
        and r.period_key = v_period_key
      )
    );

  v_used :=
    coalesce(v_used, 0);

  v_reserved :=
    coalesce(v_reserved, 0);

  if
    (v_used + v_reserved) >= v_limit
  then
    raise exception
      using
        errcode = 'P0001',
        message =
          'MASTERING_QUOTA_EXCEEDED';
  end if;

  insert into
    public.mastering_quota_reservations(
      id,
      user_id,
      counts_quota,
      status,
      created_at,
      plan,
      period,
      period_key,
      quota_limit,
      policy_version
    )
  values (
    p_reservation_id,
    p_user_id,
    true,
    'reserved',
    v_now,
    v_plan,
    v_period,
    v_period_key,
    v_limit,
    'rqs_plan_v1'
  );

  return jsonb_build_object(
    'reservation_id',
    p_reservation_id,

    'plan',
    v_plan,

    'period',
    v_period,

    'period_key',
    v_period_key,

    'limit',
    v_limit,

    'used',
    v_used,

    'active_reservations',
    v_reserved + 1,

    'remaining',
    greatest(
      0,
      v_limit - v_used - v_reserved - 1
    ),

    'counts_quota',
    true
  );
end;
$function$;


create or replace function public.confirm_mastering_quota(
  p_user_id uuid,
  p_reservation_id uuid
)
returns boolean
language plpgsql
set search_path to ''
as $function$
declare
  v_status text;
  v_counts_quota boolean;
  v_plan text;
  v_policy_version text;
begin
  if
    p_user_id is null
    or p_reservation_id is null
  then
    raise exception
      'MASTERING_CONFIRM_ARGUMENT_MISSING';
  end if;

  perform 1
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  select
    r.status,
    r.counts_quota,
    r.plan,
    r.policy_version
  into
    v_status,
    v_counts_quota,
    v_plan,
    v_policy_version
  from public.mastering_quota_reservations r
  where
    r.id = p_reservation_id
    and r.user_id = p_user_id
  for update;

  if not found then
    raise exception
      'MASTERING_RESERVATION_NOT_FOUND';
  end if;

  if v_status = 'completed' then
    return false;
  end if;

  if v_status <> 'reserved' then
    raise exception
      'MASTERING_RESERVATION_NOT_ACTIVE';
  end if;

  -- completed_masters remains a compatibility counter
  -- for legacy/free lifetime MASTER usage only.
  --
  -- It is no longer the canonical quota source.
  if
    v_counts_quota
    and (
      v_policy_version is null
      or v_plan = 'free'
    )
  then
    update public.profiles
    set
      completed_masters =
        completed_masters + 1
    where id = p_user_id;

    if not found then
      raise exception 'PROFILE_NOT_FOUND';
    end if;
  end if;

  update public.mastering_quota_reservations
  set
    status = 'completed',
    finalized_at = clock_timestamp()
  where
    id = p_reservation_id
    and user_id = p_user_id;

  return true;
end;
$function$;


-- Preserve the existing internal/service-role quota boundary.
revoke all
on function public.get_mastering_quota(uuid)
from public, anon, authenticated;

grant execute
on function public.get_mastering_quota(uuid)
to service_role;


revoke all
on function public.reserve_mastering_quota(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.reserve_mastering_quota(uuid, uuid)
to service_role;


revoke all
on function public.confirm_mastering_quota(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.confirm_mastering_quota(uuid, uuid)
to service_role;
