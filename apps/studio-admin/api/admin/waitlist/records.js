import { authorizeOwner } from '../../_auth.mjs';
import { assertFirestoreDataIsolation } from '../../_firestore-isolation.mjs';
import {
  listWaitlistRecords,
  parsePageSize,
  parseWaitlistFilters,
} from '../../_firestore-referral.mjs';
import { completeRequest, prepareRequest } from '../../_http.mjs';

const ROUTE = '/api/admin/waitlist/records';

export default async function handler(req, res) {
  const context = prepareRequest(req, res);
  if (!context.allowed) return respond(res, context, 403, { error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return respond(res, context, 405, { error: 'Method not allowed' });

  let authorization;
  try {
    authorization = await authorizeOwner(req);
    if (authorization.status !== 200) {
      return respond(
        res,
        context,
        authorization.status,
        { error: 'Administrative access required' },
        authorization.userId,
      );
    }

    assertFirestoreDataIsolation();

    const limit = parsePageSize(req.query?.limit);
    const filters = parseWaitlistFilters(req.query);
    const cursor = scalarCursor(req.query?.cursor);

    const page = await listWaitlistRecords({
      limit,
      cursor,
      filters,
    });

    return respond(
      res,
      context,
      200,
      {
        records: page.records,
        nextCursor: page.nextCursor,
        limit,
        filters,
        generatedAt: new Date().toISOString(),
      },
      authorization.userId,
    );
  } catch (error) {
    if (error instanceof TypeError) {
      return respond(
        res,
        context,
        400,
        { error: error.message },
        authorization?.userId,
      );
    }
    return respond(
      res,
      context,
      503,
      { error: 'Waitlist records unavailable' },
      authorization?.userId,
    );
  }
}

function scalarCursor(value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) throw new TypeError('Invalid cursor');
  return String(value).trim();
}

function respond(res, context, status, body, userId = null) {
  completeRequest(context, ROUTE, status, userId);
  return res.status(status).json(body);
}
