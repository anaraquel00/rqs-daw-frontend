import { authorizeOwner } from '../../_auth.mjs';
import { assertFirestoreDataIsolation } from '../../_firestore-isolation.mjs';
import { countReferralDocuments } from '../../_firestore-referral.mjs';
import { completeRequest, prepareRequest } from '../../_http.mjs';

export default async function handler(req, res) {
  const context = prepareRequest(req, res);
  if (!context.allowed) return respond(res, context, 403, { error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return respond(res, context, 405, { error: 'Method not allowed' });

  let authorization;
  try {
    authorization = await authorizeOwner(req);
    if (authorization.status !== 200) {
      return respond(res, context, authorization.status, { error: 'Administrative access required' }, authorization.userId);
    }
    assertFirestoreDataIsolation();
    const [total, master, plus, pro, undecided] = await Promise.all([
      countReferralDocuments('pro_waitlist'),
      countReferralDocuments('pro_waitlist', 'plan_interest', 'master'),
      countReferralDocuments('pro_waitlist', 'plan_interest', 'plus'),
      countReferralDocuments('pro_waitlist', 'plan_interest', 'pro'),
      countReferralDocuments('pro_waitlist', 'plan_interest', 'undecided'),
    ]);
    const unknown = Math.max(0, total - master - plus - pro - undecided);
    return respond(res, context, 200, {
      total,
      byPlanInterest: { master, plus, pro, undecided, unknown },
      generatedAt: new Date().toISOString(),
    }, authorization.userId);
  } catch {
    return respond(res, context, 503, { error: 'Waitlist summary unavailable' }, authorization?.userId);
  }
}

function respond(res, context, status, body, userId = null) {
  completeRequest(context, '/api/admin/waitlist/summary', status, userId);
  return res.status(status).json(body);
}
