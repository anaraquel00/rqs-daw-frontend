-- RQS Uplink Dashboard Stage 1 — OPERATIONAL_COMPATIBILITY_ROLLBACK.
-- REVIEW/STAGING ONLY. Production execution requires separate authorization.
-- This is intentionally not an exact historical ACL restoration. It restores
-- only the least privileges required by the authenticated legacy frontend:
-- owner-scoped SELECT + INSERT. Existing rows and tracking V3 are preserved.
begin;

do $preflight$
begin
  if to_regclass('public.rqs_uplinks') is null
     or to_regclass('public.rqs_uplinks_user_id_created_at_idx') is null then
    raise exception 'UPLINK_CONTRACT_STATE_REQUIRED';
  end if;
  if to_regprocedure('public.create_rqs_uplink(text,text)') is null then
    raise exception 'UPLINK_RPC_REQUIRED';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rqs_uplinks'
      and cmd = 'SELECT' and roles @> array['authenticated']::name[]
      and replace(coalesce(qual, ''), ' ', '') in (
        '(auth.uid()=user_id)', '(user_id=auth.uid())'
      )
  ) then
    raise exception 'RQS_UPLINKS_OWNER_SELECT_POLICY_REQUIRED';
  end if;
end;
$preflight$;

revoke all on function public.create_rqs_uplink(text, text)
from public, anon, authenticated, service_role;
drop function public.create_rqs_uplink(text, text);
drop index public.rqs_uplinks_user_id_created_at_idx;

revoke all privileges on table public.rqs_uplinks from anon, authenticated;
grant select, insert on table public.rqs_uplinks to authenticated;

drop policy if exists "Permitir inserção de uplinks" on public.rqs_uplinks;
create policy "Permitir inserção de uplinks"
on public.rqs_uplinks for insert to authenticated
with check (auth.uid() = user_id);

commit;
