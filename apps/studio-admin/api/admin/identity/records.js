import { authorizeOwner } from '../../_auth.mjs';
import {
  identityRecords,
  parseIdentityFilters,
  parseIdentityPageSize,
} from '../../_supabase-identity.mjs';
import { completeRequest, prepareRequest } from '../../_http.mjs';

const ROUTE = '/api/admin/identity/records';

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

    const limit = parseIdentityPageSize(req.query?.limit);
    const filters = parseIdentityFilters(req.query);
    const page = await identityRecords(
      authorization.client,
      {
        limit,
        cursor: req.query?.cursor ?? null,
        filters,
      },
    );

    return respond(
      res,
      context,
      200,
      {
        ...page,
        limit,
        filters,
        generatedAt: new Date().toISOString(),
      },
      authorization.userId,
    );
  } catch (error) {
    const status =
      error instanceof TypeError
        ? 400
        : 503;

    return respond(
      res,
      context,
      status,
      {
        error:
          status === 400
            ? 'INVALID_IDENTITY_QUERY'
            : 'IDENTITY_RECORDS_UNAVAILABLE',
      },
      authorization?.userId,
    );
  }
}

function respond(res, context, status, body, userId = null) {
  completeRequest(context, ROUTE, status, userId);
  return res.status(status).json(body);
}
