import test from 'node:test';
import assert from 'node:assert/strict';
import { REFERRAL_CAMPAIGN, calculateDiscount, calculateDiscountFromStatuses, campaignPhase, isDisposableEmail, isReferralCode, referralStatus } from './_referral-core.mjs';

test('founding discount is 10% per qualified referral and capped at 50', () => {
  assert.equal(calculateDiscount(0), 0); assert.equal(calculateDiscount(1), 10); assert.equal(calculateDiscount(4), 40);
  assert.equal(calculateDiscount(5), 50); assert.equal(calculateDiscount(50), 50);
  assert.equal(calculateDiscount(2), 20); assert.equal(calculateDiscount(3), 30); assert.equal(calculateDiscount(6), 50);
  assert.equal(calculateDiscountFromStatuses(['qualified', 'pending_payment', 'revoked']), 10);
  assert.equal(REFERRAL_CAMPAIGN.paidPlansEnabled, false);
});

test('prelaunch is the safe phase when launchAt is intentionally absent', () => {
  assert.equal(campaignPhase(), REFERRAL_CAMPAIGN.launchAt ? campaignPhase() : 'prelaunch');
});

test('status and anti-abuse helpers are deterministic', () => {
  assert.equal(referralStatus(0, 1), 'pending'); assert.equal(referralStatus(1, 0), 'qualified'); assert.equal(referralStatus(5, 0), 'maxed');
  assert.equal(isReferralCode('RQSA23456789'), true); assert.equal(isReferralCode('email@example.com'), false);
  assert.equal(isDisposableEmail('user@mailinator.com'), true); assert.equal(isDisposableEmail('artist@example.com'), false);
});
