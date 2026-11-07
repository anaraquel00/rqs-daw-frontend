import { authenticateRequestContext, hasVerifiedEmail } from './_referral-http.mjs';

export const STUDIO_ADMIN_ROLE = 'commercial_admin';

export async function authorizeStudioAdmin(req) {
  const context = await authenticateRequestContext(req);
  if (!context || !hasVerifiedEmail(context.user)) return null;

  const { data, error } = await context.client
    .from('studio_admin_memberships')
    .select('role, active')
    .eq('user_id', context.user.id)
    .eq('active', true)
    .maybeSingle();

  if (error || data?.role !== STUDIO_ADMIN_ROLE || data.active !== true) return null;
  return { user: context.user, role: STUDIO_ADMIN_ROLE, environment: context.environment };
}
