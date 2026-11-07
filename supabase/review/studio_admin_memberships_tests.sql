-- REVIEW ONLY — run after the proposed migration in an isolated local/staging database.
-- The endpoint also validates the JWT through auth.getUser; RLS below is the data-plane boundary.

begin;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $test$
begin
  if exists (
    select 1
    from public.studio_admin_memberships membership
    where membership.user_id <> (select auth.uid())
  ) then
    raise exception 'ADMIN_RLS_EXPOSED_ANOTHER_MEMBERSHIP';
  end if;
end;
$test$;

do $test$
begin
  begin
    insert into public.studio_admin_memberships (user_id, role)
    values ('00000000-0000-4000-8000-000000000001', 'commercial_admin');
    raise exception 'ADMIN_RLS_ALLOWED_CLIENT_MUTATION';
  exception
    when insufficient_privilege then null;
  end;
end;
$test$;

rollback;
