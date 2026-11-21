import { authorizeOwner } from '../_auth.mjs';
import {
  entitlementCatalog,
  identityRecords,
  identitySummary,
  parseIdentityFilters,
  parseIdentityPageSize,
} from '../_supabase-identity.mjs';

import {
  parseUsageFilters,
  parseUsagePageSize,
  usageRecords,
} from '../_supabase-usage.mjs';

import {
  completeRequest,
  prepareRequest,
} from '../_http.mjs';

const ROUTES = Object.freeze({
  summary:
    '/api/admin/identity/summary',
  records:
    '/api/admin/identity/records',
  entitlements:
    '/api/admin/identity/entitlements',
  'usage-records': '/api/admin/usage/records',
});

export default async function handler(
  req,
  res,
) {
  const operation =
    scalarOperation(
      req.query?.operation,
    );

  const route =
    ROUTES[operation] ??
    '/api/admin/identity';

  const context =
    prepareRequest(req, res);

  if (!context.allowed) {
    return respond(
      res,
      context,
      route,
      403,
      { error: 'ORIGIN_NOT_ALLOWED' },
    );
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return respond(
      res,
      context,
      route,
      405,
      { error: 'METHOD_NOT_ALLOWED' },
    );
  }

  if (!ROUTES[operation]) {
    return respond(
      res,
      context,
      route,
      404,
      { error: 'IDENTITY_OPERATION_NOT_FOUND' },
    );
  }

  let authorization = null;

  try {
    authorization =
      await authorizeOwner(req);

    if (
      authorization.status !== 200
    ) {
      return respond(
        res,
        context,
        route,
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

    switch (operation) {
      case 'summary':
        return await handleSummary(
          res,
          context,
          route,
          authorization,
        );

      case 'records':
        return await handleRecords(
          req,
          res,
          context,
          route,
          authorization,
        );
      case 'usage-records':
        return await handleUsageRecords(
          req,
          res,
          context,
          route,
          authorization,
        );

      case 'entitlements':
        return await handleEntitlements(
          res,
          context,
          route,
          authorization,
        );

      default:
        return respond(
          res,
          context,
          route,
          404,
          {
            error:
              'IDENTITY_OPERATION_NOT_FOUND',
          },
          authorization.userId,
        );
    }
  } catch (error) {
    if (
      (operation === 'records' || operation === 'usage-records') && error instanceof TypeError
    ) {
      return respond(
        res,
        context,
        route,
        400,
        {
          error:
            'INVALID_IDENTITY_QUERY',
        },
        authorization?.userId,
      );
    }

    const errorCode =
      operation === 'summary'
        ? 'IDENTITY_SUMMARY_UNAVAILABLE'
        : operation === 'records'
          ? 'IDENTITY_RECORDS_UNAVAILABLE'
          : operation === 'usage-records'
              ? 'USAGE_RECORDS_UNAVAILABLE'
              : 'ENTITLEMENT_CATALOG_UNAVAILABLE';

    return respond(
      res,
      context,
      route,
      503,
      { error: errorCode },
      authorization?.userId,
    );
  }
}

async function handleSummary(
  res,
  context,
  route,
  authorization,
) {
  const data =
    await identitySummary(
      authorization.client,
    );

  return respond(
    res,
    context,
    route,
    200,
    {
      ...data,
      generatedAt:
        new Date().toISOString(),
    },
    authorization.userId,
  );
}

async function handleRecords(
  req,
  res,
  context,
  route,
  authorization,
) {
  const limit =
    parseIdentityPageSize(
      req.query?.limit,
    );

  const filters =
    parseIdentityFilters(
      req.query,
    );

  const page =
    await identityRecords(
      authorization.client,
      {
        limit,
        cursor:
          req.query?.cursor ?? null,
        filters,
      },
    );

  return respond(
    res,
    context,
    route,
    200,
    {
      ...page,
      limit,
      filters,
      generatedAt:
        new Date().toISOString(),
    },
    authorization.userId,
  );
}

async function handleUsageRecords(
  req,
  res,
  context,
  route,
  authorization,
) {
  const limit =
    parseUsagePageSize(
      req.query?.limit,
    );

  const filters =
    parseUsageFilters(
      req.query,
    );

  const page =
    await usageRecords(
      authorization.client,
      {
        limit,
        cursor:
          req.query?.cursor ??
          null,
        filters,
      },
    );

  return respond(
    res,
    context,
    route,
    200,
    {
      ...page,
      limit,
      filters,
      generatedAt:
        new Date().toISOString(),
    },
    authorization.userId,
  );
}


async function handleEntitlements(
  res,
  context,
  route,
  authorization,
) {
  const plans =
    await entitlementCatalog(
      authorization.client,
    );

  return respond(
    res,
    context,
    route,
    200,
    {
      plans,
      generatedAt:
        new Date().toISOString(),
    },
    authorization.userId,
  );
}

function scalarOperation(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return '';
  }

  if (Array.isArray(value)) {
    return '';
  }

  return String(value)
    .trim()
    .toLowerCase();
}

function respond(
  res,
  context,
  route,
  status,
  body,
  userId = null,
) {
  completeRequest(
    context,
    route,
    status,
    userId,
  );

  return res
    .status(status)
    .json(body);
}
