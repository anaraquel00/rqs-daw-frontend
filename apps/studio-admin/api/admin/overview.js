import { authorizeOwner } from '../_auth.mjs';
import { assertFirestoreDataIsolation } from '../_firestore-isolation.mjs';
import { countReferralDocuments } from '../_firestore-referral.mjs';
import { completeRequest, prepareRequest } from '../_http.mjs';

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
    const [waitlistTotal, foundingReferralParticipants] = await Promise.all([
      countReferralDocuments('pro_waitlist'),
      countReferralDocuments('founding_referral_participants'),
    ]);
    return respond(res, context, 200, {
      waitlistTotal,
      foundingReferralParticipants,
      systemStatus: 'operational',
      generatedAt: new Date().toISOString(),
    }, authorization.userId);
  } catch {
    return respond(res, context, 503, { error: 'Admin overview unavailable' }, authorization?.userId);
  }
}

function respond(res, context, status, body, userId = null) {
  completeRequest(context, '/api/admin/overview', status, userId);
  return res.status(status).json(body);
}
