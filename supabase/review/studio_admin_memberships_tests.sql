-- REVIEW ONLY — run after the proposed migration in a disposable local Supabase stack.
-- Expected command in that isolated stack: supabase test db

begin;

select plan(14);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'owner@example.invalid',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'other@example.invalid',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'inactive@example.invalid',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.studio_admin_memberships (user_id, role, active) values
  ('00000000-0000-4000-8000-000000000001', 'commercial_admin', true),
  ('00000000-0000-4000-8000-000000000002', 'commercial_admin', true),
  ('00000000-0000-4000-8000-000000000003', 'commercial_admin', false);

select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_class
   where oid = 'public.studio_admin_memberships'::regclass)
  and has_table_privilege('service_role', 'public.studio_admin_memberships', 'select')
  and has_table_privilege('service_role', 'public.studio_admin_memberships', 'insert')
  and has_table_privilege('service_role', 'public.studio_admin_memberships', 'update')
  and has_table_privilege('service_role', 'public.studio_admin_memberships', 'delete'),
  'membership table has forced RLS and service_role has explicit CRUD grants'
);
select ok(
  not has_table_privilege('anon', 'public.studio_admin_memberships', 'select'),
  'anon has no read grant'
);
select ok(
  not has_table_privilege('anon', 'public.studio_admin_memberships', 'insert')
  and not has_table_privilege('anon', 'public.studio_admin_memberships', 'update')
  and not has_table_privilege('anon', 'public.studio_admin_memberships', 'delete'),
  'anon has no write grants'
);
select ok(
  has_table_privilege('authenticated', 'public.studio_admin_memberships', 'select'),
  'authenticated has the required read grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.studio_admin_memberships', 'insert'),
  'authenticated has no insert grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.studio_admin_memberships', 'update'),
  'authenticated has no update grant'
);
select ok(
  not has_table_privilege('authenticated', 'public.studio_admin_memberships', 'delete'),
  'authenticated has no delete grant'
);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select results_eq(
  $$select user_id from public.studio_admin_memberships order by user_id$$,
  $$values ('00000000-0000-4000-8000-000000000001'::uuid)$$,
  'an authenticated user sees only their own active membership'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',
  true
);
select is_empty(
  $$select user_id from public.studio_admin_memberships$$,
  'an inactive membership is not visible to its owner'
);

reset role;
set local role anon;
select throws_ok(
  $$select * from public.studio_admin_memberships$$,
  '42501',
  null,
  'anonymous access is rejected'
);

reset role;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000001',
  true
);
select throws_ok(
  $$insert into public.studio_admin_memberships (user_id, role) values ('00000000-0000-4000-8000-000000000001', 'commercial_admin')$$,
  '42501',
  null,
  'authenticated cannot insert memberships'
);
select throws_ok(
  $$update public.studio_admin_memberships set active = false where user_id = '00000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'authenticated cannot update memberships'
);
select throws_ok(
  $$delete from public.studio_admin_memberships where user_id = '00000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'authenticated cannot delete memberships'
);

reset role;
select throws_ok(
  $$insert into public.studio_admin_memberships (user_id, role) values ('00000000-0000-4000-8000-000000000001', 'premium')$$,
  '23514',
  null,
  'paid-plan roles cannot become commercial admin memberships'
);

select * from finish();

rollback;
