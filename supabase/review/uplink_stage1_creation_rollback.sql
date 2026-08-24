-- REVIEW/STAGING rollback. Existing Uplink rows and tracking V3 are preserved.
begin;
revoke all on function public.create_rqs_uplink(text, text)
from public, anon, authenticated, service_role;
drop function public.create_rqs_uplink(text, text);
drop index if exists public.rqs_uplinks_user_id_created_at_idx;
create policy "Permitir inserção de uplinks"
on public.rqs_uplinks for insert to authenticated
with check (auth.uid() = user_id);
-- INSERT was already absent from authenticated in the audited staging baseline.
commit;
