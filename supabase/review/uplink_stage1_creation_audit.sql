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

select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'rqs_uplinks'
order by indexname;
