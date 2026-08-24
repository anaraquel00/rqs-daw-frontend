select p.proname, p.prosecdef, p.proconfig, p.proacl,
       pg_get_function_identity_arguments(p.oid) as identity_args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'create_rqs_uplink';

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'rqs_uplinks'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'rqs_uplinks'
order by grantee, privilege_type;

select r.rolname as role,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'SELECT') as can_select,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'INSERT') as can_insert,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'UPDATE') as can_update,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'DELETE') as can_delete,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'TRUNCATE') as can_truncate,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'REFERENCES') as can_references,
       has_table_privilege(r.rolname, 'public.rqs_uplinks', 'TRIGGER') as can_trigger,
       has_function_privilege(r.rolname, 'public.create_rqs_uplink(text,text)', 'EXECUTE') as can_execute_rpc
from pg_roles r
where r.rolname in ('anon', 'authenticated', 'service_role')
order by r.rolname;

select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'rqs_uplinks'
order by indexname;
