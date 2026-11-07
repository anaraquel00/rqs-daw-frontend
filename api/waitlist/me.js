import { WAITLIST_COLLECTION, normalizePlanInterest, waitlistDocumentId } from '../_referral-core.mjs';
import { applyCors, authenticateRequest, getDocument, hasVerifiedEmail, updateDocument } from '../_referral-http.mjs';

export default async function handler(req, res) {
  if (!applyCors(req, res, 'GET, PATCH, OPTIONS')) {
    return res.status(403).json({ success: false, error: 'Origin not allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (!hasVerifiedEmail(user)) {
      return res.status(403).json({ success: false, error: 'Verified email required' });
    }

    const documentId = waitlistDocumentId(user.email);
    const waitlist = await getDocument(WAITLIST_COLLECTION, documentId);
    if (!waitlist) {
      return res.status(404).json({
        success: false,
        joined: false,
        error: 'Waitlist entry not found for the current verified email',
      });
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        joined: true,
        status: waitlist.status ?? 'waiting',
        plan_interest: normalizePlanInterest(waitlist.plan_interest) ?? 'undecided',
        legacy_unset: waitlist.plan_interest === undefined,
      });
    }

    const planInterest = normalizePlanInterest(req.body?.plan_interest);
    if (!planInterest || req.body?.plan_interest === undefined) {
      return res.status(400).json({ success: false, error: 'Invalid plan interest' });
    }
    const updated = await updateDocument(WAITLIST_COLLECTION, documentId, {
      plan_interest: planInterest,
      plan_interest_updated_at: new Date(),
    });
    if (!updated) return res.status(404).json({ success: false, joined: false, error: 'Waitlist entry not found' });

    return res.status(200).json({
      success: true,
      joined: true,
      status: updated.status ?? waitlist.status ?? 'waiting',
      plan_interest: planInterest,
    });
  } catch (error) {
    console.error('[RQS WAITLIST PREFERENCE]', error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false, error: 'Unable to manage waitlist preference' });
  }
}
