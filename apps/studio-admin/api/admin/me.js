import { authorizeOwner } from '../_auth.mjs';
import { completeRequest, prepareRequest } from '../_http.mjs';

export default async function handler(req, res) {
  const context = prepareRequest(req, res);
  if (!context.allowed) return respond(res, context, 403, { error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return respond(res, context, 405, { error: 'Method not allowed' });

  try {
    const authorization = await authorizeOwner(req);
    if (authorization.status !== 200) {
      return respond(res, context, authorization.status, { authenticated: authorization.status !== 401 }, authorization.userId);
    }
    return respond(res, context, 200, { authenticated: true, role: authorization.role }, authorization.userId);
  } catch {
    return respond(res, context, 503, { error: 'Admin authorization unavailable' });
  }
}

function respond(res, context, status, body, userId = null) {
  completeRequest(context, '/api/admin/me', status, userId);
  return res.status(status).json(body);
}
