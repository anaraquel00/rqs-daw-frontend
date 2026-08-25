-- Isolated fixture contract tests. Never target Production.
-- Required psql variable: expected_state = expand | contract | rollback.
\if :{?expected_state}
\else
  \echo 'expected_state psql variable is required'
  \quit 3
\endif

begin;
select pg_catalog.set_config('rqs.test.expected_state', :'expected_state', true);

do $security_contract$
declare
  v_state text := pg_catalog.current_setting('rqs.test.expected_state');
  v_privilege text;
  v_rpc regprocedure := to_regprocedure('public.create_rqs_uplink(text,text)');
begin
  if v_state not in ('expand', 'contract', 'rollback') then
    raise exception 'UNKNOWN_EXPECTED_STATE: %', v_state;
  end if;

  foreach v_privilege in array array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ] loop
    if has_table_privilege('anon', 'public.rqs_uplinks', v_privilege) then
      raise exception 'ANON_TABLE_PRIVILEGE_UNEXPECTED: %', v_privilege;
    end if;
  end loop;

  if not has_table_privilege('authenticated', 'public.rqs_uplinks', 'SELECT') then
    raise exception 'AUTHENTICATED_SELECT_MISSING';
  end if;
  if v_state in ('expand', 'rollback') then
    if not has_table_privilege('authenticated', 'public.rqs_uplinks', 'INSERT') then
      raise exception 'AUTHENTICATED_INSERT_MISSING_IN_COMPATIBILITY_STATE';
    end if;
  elsif has_table_privilege('authenticated', 'public.rqs_uplinks', 'INSERT') then
    raise exception 'AUTHENTICATED_INSERT_UNEXPECTED_AFTER_CONTRACT';
  end if;
  foreach v_privilege in array array['UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('authenticated', 'public.rqs_uplinks', v_privilege) then
      raise exception 'AUTHENTICATED_TABLE_PRIVILEGE_UNEXPECTED: %', v_privilege;
    end if;
  end loop;

  if v_state = 'rollback' then
    if v_rpc is not null then raise exception 'RPC_UNEXPECTED_AFTER_ROLLBACK'; end if;
  else
    if v_rpc is null then raise exception 'RPC_MISSING'; end if;
    if has_function_privilege('public', v_rpc, 'EXECUTE')
       or has_function_privilege('anon', v_rpc, 'EXECUTE') then
      raise exception 'PUBLIC_OR_ANON_EXECUTE_UNEXPECTED';
    end if;
    if not has_function_privilege('authenticated', v_rpc, 'EXECUTE') then
      raise exception 'AUTHENTICATED_EXECUTE_MISSING';
    end if;
    if not exists (
      select 1 from pg_proc p
      where p.oid = v_rpc and p.prosecdef
        and p.proconfig @> array['search_path=""']
    ) then
      raise exception 'RPC_SECURITY_CONFIGURATION_INVALID';
    end if;
  end if;

  if to_regclass('public.rqs_uplink_click_dedup') is null
     or to_regprocedure('public.increment_uplink_clicks(uuid,text,text)') is null then
    raise exception 'TRACKING_V3_SENTINELS_MISSING';
  end if;
end;
$security_contract$;

-- Owner A is the authenticated test identity for functional checks.
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true
);

do $direct_insert_contract$
declare
  v_state text := pg_catalog.current_setting('rqs.test.expected_state');
begin
  if v_state in ('expand', 'rollback') then
    insert into public.rqs_uplinks(id, user_id, custom_slug, target_url)
    values (
      '10000000-0000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'legacy-owner-a',
      'https://example.com/legacy-owner-a'
    );

    begin
      insert into public.rqs_uplinks(id, user_id, custom_slug, target_url)
      values (
        '10000000-0000-4000-8000-000000000002',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'legacy-cross-owner',
        'https://example.com/legacy-cross-owner'
      );
      raise exception 'CROSS_OWNER_INSERT_UNEXPECTEDLY_SUCCEEDED';
    exception
      when insufficient_privilege then null;
    end;
  else
    begin
      insert into public.rqs_uplinks(id, user_id, custom_slug, target_url)
      values (
        '10000000-0000-4000-8000-000000000003',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'direct-after-contract',
        'https://example.com/direct-after-contract'
      );
      raise exception 'DIRECT_INSERT_UNEXPECTEDLY_SUCCEEDED_AFTER_CONTRACT';
    exception
      when insufficient_privilege then null;
    end;
  end if;
end;
$direct_insert_contract$;

reset role;

do $rpc_functional_contract$
declare
  v_state text := pg_catalog.current_setting('rqs.test.expected_state');
  v_before bigint;
begin
  if v_state = 'rollback' then return; end if;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true
  );
  set local role authenticated;

  select count(*) into v_before from public.rqs_uplinks;
  begin
    perform public.create_rqs_uplink('https://example.com/reserved', 'rqs-router');
    raise exception 'RESERVED_SLUG_UNEXPECTEDLY_SUCCEEDED';
  exception
    when raise_exception then
      if sqlerrm = 'RESERVED_SLUG_UNEXPECTEDLY_SUCCEEDED'
         or sqlerrm not like '%UPLINK_RESERVED_SLUG%' then
        raise;
      end if;
  end;
  if (select count(*) from public.rqs_uplinks) <> v_before then
    raise exception 'RESERVED_SLUG_INSERTED_A_ROW';
  end if;

  begin
    perform public.create_rqs_uplink('http://example.com/insecure', 'invalid-url');
    raise exception 'INVALID_URL_UNEXPECTEDLY_SUCCEEDED';
  exception
    when raise_exception then
      if sqlerrm = 'INVALID_URL_UNEXPECTEDLY_SUCCEEDED'
         or sqlerrm not like '%UPLINK_INVALID_TARGET_URL%' then
        raise;
      end if;
  end;

  begin
    perform public.create_rqs_uplink('https://example.com/invalid-slug', 'Invalid Slug');
    raise exception 'INVALID_SLUG_UNEXPECTEDLY_SUCCEEDED';
  exception
    when raise_exception then
      if sqlerrm = 'INVALID_SLUG_UNEXPECTEDLY_SUCCEEDED'
         or sqlerrm not like '%UPLINK_INVALID_SLUG%' then
        raise;
      end if;
  end;

  perform public.create_rqs_uplink('https://example.com/free-1', 'free-b-1');
  perform public.create_rqs_uplink('https://example.com/free-2', 'free-b-2');
  perform public.create_rqs_uplink('https://example.com/free-3', 'free-b-3');
  begin
    perform public.create_rqs_uplink('https://example.com/free-4', 'free-b-4');
    raise exception 'FREE_LIMIT_UNEXPECTEDLY_SUCCEEDED';
  exception
    when raise_exception then
      if sqlerrm = 'FREE_LIMIT_UNEXPECTEDLY_SUCCEEDED'
         or sqlerrm not like '%UPLINK_FREE_LIMIT_REACHED%' then
        raise;
      end if;
  end;

  reset role;
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true
  );
  set local role authenticated;
  perform public.create_rqs_uplink('https://example.com/premium-1', 'premium-1');
  perform public.create_rqs_uplink('https://example.com/premium-2', 'premium-2');
  perform public.create_rqs_uplink('https://example.com/premium-3', 'premium-3');
  perform public.create_rqs_uplink('https://example.com/premium-4', 'premium-4');
  reset role;
end;
$rpc_functional_contract$;

do $legacy_unowned_preserved$
begin
  if exists (
    select 1 from public.rqs_uplinks
    where custom_slug = 'legacy-unowned-fixture' and user_id is null
  ) then
    return;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.rqs_uplinks'::regclass
      and attname = 'user_id' and not attnotnull
  ) then
    raise exception 'PRODUCTION_LIKE_LEGACY_UNOWNED_ROW_LOST';
  end if;
end;
$legacy_unowned_preserved$;

rollback;
