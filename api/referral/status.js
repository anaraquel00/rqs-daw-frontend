import { REFERRAL_CAMPAIGN, PARTICIPANT_COLLECTION, WAITLIST_COLLECTION, calculateDiscount, campaignPhase, captureEndsAt, participantDocumentId, referralStatus, settlementEndsAt } from '../_referral-core.mjs';
import { applyCors, authenticateRequest, getDocument, queryDocuments } from '../_referral-http.mjs';

export default async function handler(req, res) {
  if (!applyCors(req, res)) return res.status(403).json({ success: false, error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
    const participantId = participantDocumentId(user.id);
    const participant = await getDocument(PARTICIPANT_COLLECTION, participantId);
    if (!participant) return res.status(200).json({ success: true, campaignStatus: campaignPhase(), participantStatus: 'prelaunch', eligibleCount: 0, pendingCount: 0, qualifiedCount: 0, discountPercent: 0, maxQualified: REFERRAL_CAMPAIGN.maxQualifiedReferrals, maxDiscountPercent: REFERRAL_CAMPAIGN.maximumDiscount, captureEndsAt: captureEndsAt(), settlementEndsAt: settlementEndsAt(), paidPlansEnabled: false });
    const referrals = await queryDocuments(WAITLIST_COLLECTION, 'referrerParticipantId', participantId);
    const qualifiedCount = Math.min(referrals.filter(item => item.referralStatus === 'qualified').length, REFERRAL_CAMPAIGN.maxQualifiedReferrals);
    const pendingCount = referrals.filter(item => ['waitlisted', 'pending_payment'].includes(item.referralStatus)).length;
    return res.status(200).json({ success: true, campaignStatus: campaignPhase(), participantStatus: referralStatus(qualifiedCount, pendingCount), referralCode: participant.referralCode, eligibleCount: referrals.length, pendingCount, qualifiedCount, discountPercent: calculateDiscount(qualifiedCount), maxQualified: REFERRAL_CAMPAIGN.maxQualifiedReferrals, maxDiscountPercent: REFERRAL_CAMPAIGN.maximumDiscount, captureEndsAt: captureEndsAt(), settlementEndsAt: settlementEndsAt(), paidPlansEnabled: false });
  } catch (error) {
    console.error('[RQS REFERRAL STATUS]', error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
