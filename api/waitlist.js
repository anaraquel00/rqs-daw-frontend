import { PARTICIPANT_COLLECTION, REFERRAL_CAMPAIGN, WAITLIST_COLLECTION, campaignPhase, emailFingerprint, isDisposableEmail, isReferralCode, normalizeEmail, normalizeLanguage, waitlistDocumentId } from './_referral-core.mjs';
import { applyCors, createDocument, queryDocuments } from './_referral-http.mjs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (!applyCors(req, res, 'POST, OPTIONS')) return res.status(403).json({ success: false, error: 'Origin not allowed' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const { email, source, language, website, referralCode } = req.body || {};
  if (website) return res.status(200).json({ success: true });
  const normalizedEmail = normalizeEmail(email);
  if (!EMAIL_PATTERN.test(normalizedEmail)) return res.status(400).json({ success: false, error: email ? 'Invalid email' : 'Email is required' });

  try {
    const attribution = await resolveAttribution(referralCode, normalizedEmail);
    const now = new Date();
    const waitlistId = waitlistDocumentId(normalizedEmail);
    const result = await createDocument(WAITLIST_COLLECTION, waitlistId, {
      email: normalizedEmail,
      source: source ? String(source).trim() : 'studio.raquelsynths.com',
      language: normalizeLanguage(language), status: 'waiting', createdAt: now,
      ...(attribution ? { referralCampaignId: REFERRAL_CAMPAIGN.id, referrerParticipantId: attribution.id, referrerUserId: attribution.referrerUserId,
        referredWaitlistId: waitlistId,
        referralCode: attribution.referralCode, referralStatus: 'waitlisted', referralCapturedAt: now } : {}),
    });
    const notificationSynced = await syncBrevo(normalizedEmail, normalizeLanguage(language));
    return res.status(200).json({ success: true, waitlisted: true, alreadyJoined: !result.created,
      referralAttributed: result.created && Boolean(attribution), notificationSyncPending: !notificationSynced });
  } catch (error) {
    console.error('[RQS WAITLIST]', error instanceof Error ? error.message : error);
    return res.status(500).json({ success: false, error: 'Unable to join waitlist' });
  }
}

async function resolveAttribution(rawCode, referredEmail) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code || !isReferralCode(code) || campaignPhase() !== 'prelaunch' || isDisposableEmail(referredEmail)) return null;
  const matches = await queryDocuments(PARTICIPANT_COLLECTION, 'referralCode', code);
  if (matches.length !== 1 || matches[0].campaignId !== REFERRAL_CAMPAIGN.id || matches[0].status !== 'active') return null;
  if (matches[0].emailFingerprint === emailFingerprint(referredEmail)) return null;
  return { id: matches[0].id, referrerUserId: matches[0].referrerUserId, referralCode: code };
}

async function syncBrevo(email, language) {
  const key = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_WAITLIST_LIST_ID);
  if (!key || !Number.isInteger(listId) || listId <= 0) {
    console.error('[RQS WAITLIST] Missing Brevo configuration');
    return false;
  }
  const response = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST', headers: { accept: 'application/json', 'Content-Type': 'application/json', 'api-key': key },
    body: JSON.stringify({ email, attributes: { RQS_LANGUAGE: language }, listIds: [listId], updateEnabled: true }),
  });
  if (!response.ok) console.error('[RQS WAITLIST] Brevo sync failed:', response.status);
  return response.ok;
}
