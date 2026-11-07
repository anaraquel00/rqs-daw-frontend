-- REVIEW ONLY — do not apply without a separate Supabase migration gate.
-- Commercial administration is independent from paid-plan entitlements.

begin;

create table if not exists public.studio_admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('commercial_admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_admin_memberships enable row level security;
alter table public.studio_admin_memberships force row level security;

revoke all on table public.studio_admin_memberships from anon, authenticated;
grant select on table public.studio_admin_memberships to authenticated;
grant select, insert, update, delete on table public.studio_admin_memberships to service_role;

drop policy if exists "studio admins can read own active membership"
  on public.studio_admin_memberships;
create policy "studio admins can read own active membership"
  on public.studio_admin_memberships
  for select
  to authenticated
  using ((select auth.uid()) = user_id and active = true);

commit;
