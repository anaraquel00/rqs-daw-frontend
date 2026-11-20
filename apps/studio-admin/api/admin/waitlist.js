import { authorizeOwner } from '../_auth.mjs';
import {
  assertFirestoreDataIsolation,
} from '../_firestore-isolation.mjs';
import {
  countReferralDocuments,
  listWaitlistRecords,
  parsePageSize,
  parseWaitlistFilters,
} from '../_firestore-referral.mjs';
import {
  completeRequest,
  prepareRequest,
} from '../_http.mjs';

const ROUTES = Object.freeze({
  summary:
    '/api/admin/waitlist/summary',
  records:
    '/api/admin/waitlist/records',
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
    '/api/admin/waitlist';

  const context =
    prepareRequest(req, res);

  if (!context.allowed) {
    return respond(
      res,
      context,
      route,
      403,
      {
        error:
          'Origin not allowed',
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
      route,
      405,
      {
        error:
          'Method not allowed',
      },
    );
  }

  if (!ROUTES[operation]) {
    return respond(
      res,
      context,
      route,
      404,
      {
        error:
          'Waitlist operation not found',
      },
    );
  }

  let authorization;

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
            'Administrative access required',
        },
        authorization.userId,
      );
    }

    assertFirestoreDataIsolation();

    if (operation === 'summary') {
      return await handleSummary(
        res,
        context,
        route,
        authorization,
      );
    }

    return await handleRecords(
      req,
      res,
      context,
      route,
      authorization,
    );
  } catch (error) {
    if (
      operation === 'records' &&
      error instanceof TypeError
    ) {
      return respond(
        res,
        context,
        route,
        400,
        {
          error:
            error.message,
        },
        authorization?.userId,
      );
    }

    return respond(
      res,
      context,
      route,
      503,
      {
        error:
          operation === 'summary'
            ? 'Waitlist summary unavailable'
            : 'Waitlist records unavailable',
      },
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
  const [
    total,
    master,
    plus,
    pro,
    undecided,
  ] = await Promise.all([
    countReferralDocuments(
      'pro_waitlist',
    ),
    countReferralDocuments(
      'pro_waitlist',
      'plan_interest',
      'master',
    ),
    countReferralDocuments(
      'pro_waitlist',
      'plan_interest',
      'plus',
    ),
    countReferralDocuments(
      'pro_waitlist',
      'plan_interest',
      'pro',
    ),
    countReferralDocuments(
      'pro_waitlist',
      'plan_interest',
      'undecided',
    ),
  ]);

  const unknown =
    Math.max(
      0,
      total -
        master -
        plus -
        pro -
        undecided,
    );

  return respond(
    res,
    context,
    route,
    200,
    {
      total,
      byPlanInterest: {
        master,
        plus,
        pro,
        undecided,
        unknown,
      },
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
    parsePageSize(
      req.query?.limit,
    );

  const filters =
    parseWaitlistFilters(
      req.query,
    );

  const cursor =
    scalarCursor(
      req.query?.cursor,
    );

  const page =
    await listWaitlistRecords({
      limit,
      cursor,
      filters,
    });

  return respond(
    res,
    context,
    route,
    200,
    {
      records:
        page.records,
      nextCursor:
        page.nextCursor,
      limit,
      filters,
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

function scalarCursor(value) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  if (Array.isArray(value)) {
    throw new TypeError(
      'Invalid cursor',
    );
  }

  return String(value).trim();
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
