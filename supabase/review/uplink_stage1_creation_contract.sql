-- RQS Uplink Dashboard Stage 1 — PHASE C / CONTRACT.
-- Execute only after the exact new frontend is deployed and its Production
-- create/list smoke passes. REVIEW/STAGING ONLY in this repository task.
begin;

do $preflight$
begin
  if to_regclass('public.rqs_uplinks') is null
     or to_regclass('public.rqs_uplinks_user_id_created_at_idx') is null then
    raise exception 'UPLINK_EXPAND_STATE_REQUIRED';
  end if;
  if to_regprocedure('public.create_rqs_uplink(text,text)') is null then
    raise exception 'UPLINK_RPC_REQUIRED';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_rqs_uplink'
      and p.prosecdef and p.proconfig @> array['search_path=""']
  ) then
    raise exception 'UPLINK_RPC_SECURITY_CONTRACT_INVALID';
  end if;
  if not has_table_privilege('authenticated', 'public.rqs_uplinks', 'SELECT')
     or not has_table_privilege('authenticated', 'public.rqs_uplinks', 'INSERT') then
    raise exception 'UPLINK_EXPAND_OVERLAP_PRIVILEGES_REQUIRED';
  end if;
  if not exists (
    select 1
    from (
      select cmd, roles,
        regexp_replace(
          regexp_replace(lower(coalesce(qual, '')), '[[:space:]]+', '', 'g'),
          '\(selectauth\.uid\(\)(asuid)?\)', 'auth.uid()', 'g'
        ) as normalized_expression
      from pg_policies
      where schemaname = 'public' and tablename = 'rqs_uplinks'
    ) policy
    where cmd = 'SELECT' and roles @> array['authenticated']::name[]
      and normalized_expression in (
        '(auth.uid()=user_id)', '(user_id=auth.uid())'
      )
  ) then
    raise exception 'UPLINK_EXPAND_OWNER_SELECT_POLICY_REQUIRED';
  end if;
  if exists (
    select 1
    from (
      select cmd, roles,
        regexp_replace(
          regexp_replace(lower(coalesce(qual, '')), '[[:space:]]+', '', 'g'),
          '\(selectauth\.uid\(\)(asuid)?\)', 'auth.uid()', 'g'
        ) as normalized_expression
      from pg_policies
      where schemaname = 'public' and tablename = 'rqs_uplinks'
    ) policy
    where cmd in ('SELECT', 'ALL')
      and roles && array['authenticated', 'public']::name[]
      and (
        cmd <> 'SELECT'
        or normalized_expression not in (
          '(auth.uid()=user_id)', '(user_id=auth.uid())'
        )
      )
  ) then
    raise exception 'UPLINK_EXPAND_BROAD_SELECT_POLICY_REJECTED';
  end if;
  if not exists (
    select 1
    from (
      select cmd, roles,
        regexp_replace(
          regexp_replace(lower(coalesce(with_check, '')), '[[:space:]]+', '', 'g'),
          '\(selectauth\.uid\(\)(asuid)?\)', 'auth.uid()', 'g'
        ) as normalized_expression
      from pg_policies
      where schemaname = 'public' and tablename = 'rqs_uplinks'
    ) policy
    where cmd = 'INSERT' and roles @> array['authenticated']::name[]
      and normalized_expression in (
        '(auth.uid()=user_id)', '(user_id=auth.uid())'
      )
  ) then
    raise exception 'UPLINK_EXPAND_OWNER_INSERT_POLICY_REQUIRED';
  end if;
  if exists (
    select 1
    from (
      select cmd, roles,
        regexp_replace(
          regexp_replace(lower(coalesce(with_check, '')), '[[:space:]]+', '', 'g'),
          '\(selectauth\.uid\(\)(asuid)?\)', 'auth.uid()', 'g'
        ) as normalized_expression
      from pg_policies
      where schemaname = 'public' and tablename = 'rqs_uplinks'
    ) policy
    where cmd in ('INSERT', 'ALL')
      and roles && array['authenticated', 'public']::name[]
      and (
        cmd <> 'INSERT'
        or normalized_expression not in (
          '(auth.uid()=user_id)', '(user_id=auth.uid())'
        )
      )
  ) then
    raise exception 'UPLINK_EXPAND_BROAD_INSERT_POLICY_REJECTED';
  end if;
end;
$preflight$;

drop policy "Permitir inserção de uplinks" on public.rqs_uplinks;
revoke all privileges on table public.rqs_uplinks from anon, authenticated;
grant select on table public.rqs_uplinks to authenticated;

revoke all on function public.create_rqs_uplink(text, text)
from public, anon, authenticated, service_role;
grant execute on function public.create_rqs_uplink(text, text) to authenticated;

commit;
