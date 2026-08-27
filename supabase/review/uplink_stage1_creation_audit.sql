-- Read-only audit valid at baseline, EXPAND, CONTRACT, and rollback states.
do $policy_audit$
begin
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
    raise exception 'AUDIT_OWNER_SELECT_POLICY_REQUIRED';
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
    raise exception 'AUDIT_BROAD_SELECT_POLICY_REJECTED';
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
        and cmd in ('INSERT', 'ALL')
        and roles && array['authenticated', 'public']::name[]
    ) policy
    where cmd <> 'INSERT'
       or normalized_expression not in (
         '(auth.uid()=user_id)', '(user_id=auth.uid())'
       )
  ) then
    raise exception 'AUDIT_BROAD_INSERT_POLICY_REJECTED';
  end if;
end;
$policy_audit$;

select
  to_regprocedure('public.create_rqs_uplink(text,text)') as rpc,
  p.prosecdef,
  p.proconfig,
  p.proacl,
  pg_get_function_identity_arguments(p.oid) as identity_args
from (values (to_regprocedure('public.create_rqs_uplink(text,text)'))) expected(oid)
left join pg_proc p on p.oid = expected.oid;

select policyname, roles, cmd, qual, with_check,
       regexp_replace(
         regexp_replace(lower(coalesce(qual, '')), '[[:space:]]+', '', 'g'),
         '\(selectauth\.uid\(\)(asuid)?\)', 'auth.uid()', 'g'
       ) as normalized_qual,
       regexp_replace(
         regexp_replace(lower(coalesce(with_check, '')), '[[:space:]]+', '', 'g'),
         '\(selectauth\.uid\(\)(asuid)?\)', 'auth.uid()', 'g'
       ) as normalized_with_check
from pg_policies
where schemaname = 'public' and tablename = 'rqs_uplinks'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rqs_uplinks'
  and grantee in ('anon', 'authenticated', 'service_role')
order by grantee, privilege_type;

select r.rolname as role,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'SELECT') as can_select,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'INSERT') as can_insert,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'UPDATE') as can_update,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'DELETE') as can_delete,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'TRUNCATE') as can_truncate,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'REFERENCES') as can_references,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'TRIGGER') as can_trigger,
       case
         when to_regprocedure('public.create_rqs_uplink(text,text)') is null then false
         else has_function_privilege(
           r.rolname, 'public.create_rqs_uplink(text,text)', 'EXECUTE'
         )
       end as can_execute_rpc
from pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role')
order by r.rolname;

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'rqs_uplinks'
order by indexname;

select
  count(*) as total_rows,
  count(*) filter (where user_id is not null) as owned_rows,
  count(*) filter (where user_id is null) as legacy_unowned_rows
from public.rqs_uplinks;
