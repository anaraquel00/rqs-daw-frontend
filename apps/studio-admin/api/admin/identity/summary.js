import { authorizeOwner } from '../../_auth.mjs';
import { identitySummary } from '../../_supabase-identity.mjs';
import { completeRequest, prepareRequest } from '../../_http.mjs';

const ROUTE = '/api/admin/identity/summary';

export default async function handler(req, res) {
  const context = prepareRequest(req, res);

  if (!context.allowed) {
    return respond(res, context, 403, { error: 'ORIGIN_NOT_ALLOWED' });
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return respond(res, context, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  let authorization = null;

  try {
    authorization = await authorizeOwner(req);

    if (authorization.status !== 200) {
      return respond(
        res,
        context,
        authorization.status,
        {
          error:
            authorization.status === 401
              ? 'UNAUTHENTICATED'
              : 'FORBIDDEN',
        },
        authorization.userId,
      );
    }

    const data = await identitySummary(authorization.client);

    return respond(
      res,
      context,
      200,
      {
        ...data,
        generatedAt: new Date().toISOString(),
      },
      authorization.userId,
    );
  } catch {
    return respond(
      res,
      context,
      503,
      { error: 'IDENTITY_SUMMARY_UNAVAILABLE' },
      authorization?.userId,
    );
  }
}

function respond(res, context, status, body, userId = null) {
  completeRequest(context, ROUTE, status, userId);
  return res.status(status).json(body);
}
