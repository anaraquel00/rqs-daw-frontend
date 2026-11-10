-- REVIEW ONLY — explicit one-time owner bootstrap.
-- Run with psql after studio_admin_memberships_migration.sql:
--   psql "$DATABASE_URL" -v owner_user_id='<ANA_AUTH_USER_UUID>' \
--     -f supabase/review/studio_admin_owner_bootstrap.sql
-- Never commit DATABASE_URL or the real UUID.

begin;

create temporary table studio_admin_owner_bootstrap_input (
  user_id uuid not null
) on commit drop;

insert into studio_admin_owner_bootstrap_input (user_id)
values (:'owner_user_id'::uuid);

do $bootstrap$
declare
  target_user_id uuid := (select user_id from studio_admin_owner_bootstrap_input limit 1);
begin
  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception using
      errcode = 'P0002',
      message = 'STUDIO_ADMIN_OWNER_AUTH_USER_NOT_FOUND';
  end if;

  insert into public.studio_admin_memberships (user_id, role, active)
  values (target_user_id, 'owner', true)
  on conflict (user_id) do update
    set role = 'owner', active = true, updated_at = now();
end;
$bootstrap$;

commit;
