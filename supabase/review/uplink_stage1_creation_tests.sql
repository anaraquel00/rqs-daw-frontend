-- Execute in an isolated fixture/staging transaction. Never targets Production.
begin;

do $security_contract$
declare
  v_privilege text;
begin
  foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('anon', 'public.rqs_uplinks', v_privilege) then
      raise exception 'ANON_TABLE_PRIVILEGE_UNEXPECTED: %', v_privilege;
    end if;
  end loop;
  if not has_table_privilege('authenticated', 'public.rqs_uplinks', 'SELECT') then
    raise exception 'AUTHENTICATED_SELECT_MISSING';
  end if;
  foreach v_privilege in array array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('authenticated', 'public.rqs_uplinks', v_privilege) then
      raise exception 'AUTHENTICATED_TABLE_PRIVILEGE_UNEXPECTED: %', v_privilege;
    end if;
  end loop;
  if has_function_privilege('public', 'public.create_rqs_uplink(text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.create_rqs_uplink(text,text)', 'EXECUTE') then
    raise exception 'PUBLIC_OR_ANON_EXECUTE_UNEXPECTED';
  end if;
  if not has_function_privilege('authenticated', 'public.create_rqs_uplink(text,text)', 'EXECUTE') then
    raise exception 'AUTHENTICATED_EXECUTE_MISSING';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='create_rqs_uplink'
      and p.prosecdef and p.proconfig @> array['search_path=""']
  ) then
    raise exception 'RPC_SECURITY_CONFIGURATION_INVALID';
  end if;
end;
$security_contract$;

-- Functional Free/Premium, invalid-input, owner isolation, and concurrency
-- scenarios are exercised by the staging harness with distinct Auth JWTs.
rollback;
