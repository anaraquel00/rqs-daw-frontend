-- REVIEW ONLY — do not apply without a separate Supabase migration gate.
-- RQS Studio administration is independent from paid-plan entitlements.

begin;

do $preflight$
begin
  if to_regclass('public.studio_admin_memberships') is not null then
    raise exception using
      errcode = '42P07',
      message = 'STUDIO_ADMIN_MEMBERSHIPS_ALREADY_EXISTS',
      detail = 'Refuse to accept an existing table without an explicit schema audit.';
  end if;
end;
$preflight$;

create table public.studio_admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'operator', 'analyst')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_admin_memberships enable row level security;
alter table public.studio_admin_memberships force row level security;

revoke all on table public.studio_admin_memberships from anon, authenticated;
grant select on table public.studio_admin_memberships to authenticated;
grant select, insert, update, delete on table public.studio_admin_memberships to service_role;

create policy "studio admins can read own active membership"
  on public.studio_admin_memberships
  for select
  to authenticated
  using ((select auth.uid()) = user_id and active = true);

commit;
