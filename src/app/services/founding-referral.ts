export const FOUNDING_REFERRAL = Object.freeze({
  termsVersion: '2026-10-31',
  maxQualifiedReferrals: 5,
  discountPerQualified: 10,
  maximumDiscount: 50,
  paidPlansEnabled: false,
});

export type ReferralParticipantStatus = 'prelaunch' | 'eligible' | 'pending' | 'qualified' | 'maxed';

export interface ReferralStatus {
  campaignStatus?: 'prelaunch' | 'settlement' | 'closed';
  participantStatus: ReferralParticipantStatus;
  referralCode?: string;
  eligibleCount: number;
  pendingCount: number;
  qualifiedCount: number;
  discountPercent: number;
  maxDiscountPercent: number;
  maxQualified?: number;
  captureEndsAt?: string | null;
  settlementEndsAt?: string | null;
  paidPlansEnabled: false;
}

export function calculateFoundingDiscount(qualifiedCount: number): number {
  const count = Math.max(0, Math.floor(Number(qualifiedCount) || 0));
  return Math.min(count * FOUNDING_REFERRAL.discountPerQualified, FOUNDING_REFERRAL.maximumDiscount);
}

export function isValidReferralCode(value: string | null | undefined): boolean {
  return /^RQS[A-HJ-NP-Z2-9]{9}$/.test(String(value || '').trim().toUpperCase());
}
