import { createHash, randomBytes } from 'node:crypto';

export const REFERRAL_CAMPAIGN = Object.freeze({
  id: process.env.RQS_FOUNDING_REFERRAL_CAMPAIGN_ID || 'founding-2026',
  enabled: process.env.RQS_FOUNDING_REFERRAL_ENABLED !== 'false',
  launchAt: process.env.RQS_FOUNDING_REFERRAL_LAUNCH_AT || null,
  settlementDays: process.env.RQS_FOUNDING_REFERRAL_SETTLEMENT_DAYS
    ? Number.parseInt(process.env.RQS_FOUNDING_REFERRAL_SETTLEMENT_DAYS, 10)
    : null,
  maxQualifiedReferrals: 5,
  discountPerQualified: 10,
  maximumDiscount: 50,
  termsVersion: '2026-10-31',
  paidPlansEnabled: false,
});

export const FIRESTORE_PROJECT_ID = 'raquel-synths-platform';
export const WAITLIST_COLLECTION = 'pro_waitlist';
export const PARTICIPANT_COLLECTION = 'founding_referral_participants';

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function waitlistDocumentId(email) {
  return sha256(normalizeEmail(email));
}

export function participantDocumentId(userId) {
  return sha256(`${REFERRAL_CAMPAIGN.id}:${userId}`);
}

export function emailFingerprint(email) {
  return sha256(`rqs-referral:${normalizeEmail(email)}`);
}

export function calculateDiscount(qualifiedCount) {
  const count = Math.max(0, Math.floor(Number(qualifiedCount) || 0));
  return Math.min(count * REFERRAL_CAMPAIGN.discountPerQualified, REFERRAL_CAMPAIGN.maximumDiscount);
}

export function referralStatus(qualifiedCount, pendingCount) {
  const discountPercent = calculateDiscount(qualifiedCount);
  if (discountPercent >= REFERRAL_CAMPAIGN.maximumDiscount) return 'maxed';
  if (qualifiedCount > 0) return 'qualified';
  if (pendingCount > 0) return 'pending';
  return 'eligible';
}

export function campaignPhase(now = new Date()) {
  if (!REFERRAL_CAMPAIGN.enabled) return 'closed';
  if (!REFERRAL_CAMPAIGN.launchAt) return 'prelaunch';
  const launch = new Date(REFERRAL_CAMPAIGN.launchAt);
  if (!Number.isFinite(launch.getTime())) return 'closed';
  if (now < launch) return 'prelaunch';
  if (!REFERRAL_CAMPAIGN.settlementDays) return 'settlement';
  const settlementEnd = new Date(launch.getTime() + REFERRAL_CAMPAIGN.settlementDays * 86_400_000);
  return now < settlementEnd ? 'settlement' : 'closed';
}

export function captureEndsAt() {
  return REFERRAL_CAMPAIGN.launchAt;
}

export function settlementEndsAt() {
  if (!REFERRAL_CAMPAIGN.launchAt || !REFERRAL_CAMPAIGN.settlementDays) return null;
  return new Date(new Date(REFERRAL_CAMPAIGN.launchAt).getTime() + REFERRAL_CAMPAIGN.settlementDays * 86_400_000).toISOString();
}

export function calculateDiscountFromStatuses(statuses) {
  return calculateDiscount(statuses.filter(status => status === 'qualified').length);
}

export function createReferralCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(9);
  let code = 'RQS';
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

export function isReferralCode(value) {
  return /^RQS[A-HJ-NP-Z2-9]{9}$/.test(String(value || '').trim().toUpperCase());
}

export function normalizeLanguage(value) {
  return ['pt', 'en', 'pl', 'fr'].includes(value) ? value : 'en';
}

export function isDisposableEmail(email) {
  const domain = normalizeEmail(email).split('@')[1] || '';
  return new Set(['10minutemail.com', 'guerrillamail.com', 'mailinator.com', 'tempmail.com', 'yopmail.com']).has(domain);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
