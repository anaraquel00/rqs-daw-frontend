import { authorizeOwner } from '../../_auth.mjs';

import {
  adminActionsConfiguration,
} from '../../_admin-actions.mjs';

import {
  completeRequest,
  prepareRequest,
} from '../../_http.mjs';

const ROUTE =
  '/api/admin/actions/config';

export default async function handler(
  req,
  res,
) {
  const context =
    prepareRequest(req, res);

  if (!context.allowed) {
    return respond(
      res,
      context,
      403,
      {
        error: 'ORIGIN_NOT_ALLOWED',
      },
    );
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return respond(
      res,
      context,
      405,
      {
        error: 'METHOD_NOT_ALLOWED',
      },
    );
  }

  let authorization = null;

  try {
    authorization =
      await authorizeOwner(req);

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

    const configuration =
      adminActionsConfiguration();

    return respond(
      res,
      context,
      200,
      {
        enabled:
          configuration.enabled,
        mode:
          configuration.mode,
        dataEnvironment:
          configuration.dataEnvironment,
      },
      authorization.userId,
    );
  } catch {
    return respond(
      res,
      context,
      503,
      {
        error:
          'ACTION_CONFIG_UNAVAILABLE',
      },
      authorization?.userId,
    );
  }
}

function respond(
  res,
  context,
  status,
  body,
  userId = null,
) {
  completeRequest(
    context,
    ROUTE,
    status,
    userId,
  );

  return res
    .status(status)
    .json(body);
}
