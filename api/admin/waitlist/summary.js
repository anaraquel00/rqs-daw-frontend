import { authorizeStudioAdmin } from '../../_admin-auth.mjs';
import { WAITLIST_COLLECTION } from '../../_referral-core.mjs';
import { applyCors, countDocuments } from '../../_referral-http.mjs';

export default async function handler(req, res) {
  if (!applyCors(req, res, 'GET, OPTIONS')) {
    return res.status(403).json({ success: false, error: 'Origin not allowed' });
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const admin = await authorizeStudioAdmin(req);
    if (!admin) return res.status(403).json({ success: false, error: 'Admin authorization required' });

    const [total, master, plus, pro, explicitUndecided] = await Promise.all([
      countDocuments(WAITLIST_COLLECTION),
      countDocuments(WAITLIST_COLLECTION, 'plan_interest', 'master'),
      countDocuments(WAITLIST_COLLECTION, 'plan_interest', 'plus'),
      countDocuments(WAITLIST_COLLECTION, 'plan_interest', 'pro'),
      countDocuments(WAITLIST_COLLECTION, 'plan_interest', 'undecided'),
    ]);
    const legacyUnset = Math.max(0, total - master - plus - pro - explicitUndecided);

    return res.status(200).json({
      success: true,
      total,
      master,
      plus,
      pro,
      undecided: explicitUndecided + legacyUnset,
      legacy_unset: legacyUnset,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[RQS ADMIN WAITLIST]', error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false, error: 'Unable to load waitlist summary' });
  }
}
