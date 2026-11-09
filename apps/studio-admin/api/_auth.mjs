import { createClient } from '@supabase/supabase-js';

export const ADMIN_ROLES = Object.freeze(['owner', 'operator', 'analyst']);

async function defaultContextProvider(req) {
  const authorization = String(req.headers?.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return null;

  const url = requiredEnvironment('SUPABASE_URL');
  const publishableKey = requiredEnvironment('SUPABASE_PUBLISHABLE_KEY');
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.id || !(data.user.email_confirmed_at || data.user.confirmed_at)) return null;
  return { client, user: data.user };
}

let contextProvider = defaultContextProvider;

export async function authorizeOwner(req) {
  const context = await contextProvider(req);
  if (!context) return { status: 401 };

  const { data, error } = await context.client
    .from('studio_admin_memberships')
    .select('role, active')
    .eq('user_id', context.user.id)
    .eq('active', true)
    .maybeSingle();

  if (error || data?.active !== true || !ADMIN_ROLES.includes(data.role) || data.role !== 'owner') {
    return { status: 403, userId: context.user.id };
  }
  return { status: 200, userId: context.user.id, role: data.role };
}

export function setAdminContextProviderForTests(provider) {
  if (!process.env.NODE_TEST_CONTEXT) throw new Error('Test-only admin context override');
  contextProvider = provider ?? defaultContextProvider;
}

function requiredEnvironment(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing server environment: ${name}`);
  return value;
}
