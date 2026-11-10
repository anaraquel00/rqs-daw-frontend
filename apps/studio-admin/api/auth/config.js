import { completeRequest, prepareRequest } from '../_http.mjs';

export default async function handler(req, res) {
  const context = prepareRequest(req, res);
  if (!context.allowed) return respond(res, context, 403, { error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return respond(res, context, 405, { error: 'Method not allowed' });

  const url = String(process.env.SUPABASE_URL || '').trim();
  const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!url || !publishableKey) return respond(res, context, 503, { error: 'Authentication unavailable' });
  return respond(res, context, 200, { url, publishableKey });
}

function respond(res, context, status, body) {
  completeRequest(context, '/api/auth/config', status);
  return res.status(status).json(body);
}
