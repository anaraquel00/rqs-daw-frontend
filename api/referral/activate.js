import { REFERRAL_CAMPAIGN, WAITLIST_COLLECTION, PARTICIPANT_COLLECTION, campaignPhase, captureEndsAt, createReferralCode, emailFingerprint, participantDocumentId, waitlistDocumentId } from '../_referral-core.mjs';
import { applyCors, authenticateRequest, createDocument, getDocument } from '../_referral-http.mjs';

export default async function handler(req, res) {
  if (!applyCors(req, res)) return res.status(403).json({ success: false, error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    if (req.body?.acceptedTerms !== true || req.body?.termsVersion !== REFERRAL_CAMPAIGN.termsVersion) {
      return res.status(400).json({ success: false, error: 'Referral terms acceptance required' });
    }
    if (campaignPhase() !== 'prelaunch') return res.status(409).json({ success: false, error: 'Referral activation is closed' });
    const waitlist = await getDocument(WAITLIST_COLLECTION, waitlistDocumentId(user.email));
    if (!waitlist?.createdAt) return res.status(409).json({ success: false, error: 'A valid waitlist entry is required' });
    if (REFERRAL_CAMPAIGN.launchAt && new Date(waitlist.createdAt) >= new Date(REFERRAL_CAMPAIGN.launchAt)) {
      return res.status(409).json({ success: false, error: 'Waitlist entry is outside the eligibility window' });
    }
    const participantId = participantDocumentId(user.id);
    const result = await createDocument(PARTICIPANT_COLLECTION, participantId, {
      campaignId: REFERRAL_CAMPAIGN.id, referrerUserId: user.id, referrerWaitlistId: waitlistDocumentId(user.email), emailFingerprint: emailFingerprint(user.email),
      referralCode: createReferralCode(), termsVersion: REFERRAL_CAMPAIGN.termsVersion,
      termsAcceptedAt: new Date(), eligibleFrom: waitlist.createdAt, captureEndsAt: captureEndsAt(), createdAt: new Date(), status: 'active',
    });
    return res.status(200).json({ success: true, referralCode: result.document.referralCode, participantStatus: 'eligible' });
  } catch (error) {
    console.error('[RQS REFERRAL ACTIVATE]', error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
