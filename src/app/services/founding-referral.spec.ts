import { calculateFoundingDiscount, isValidReferralCode } from './founding-referral';

describe('Founding referral contract', () => {
  it('applies 10% per qualified referral, capped at 5 referrals / 50%', () => {
    expect(calculateFoundingDiscount(0)).toBe(0);
    expect(calculateFoundingDiscount(1)).toBe(10);
    expect(calculateFoundingDiscount(2)).toBe(20);
    expect(calculateFoundingDiscount(3)).toBe(30);
    expect(calculateFoundingDiscount(4)).toBe(40);
    expect(calculateFoundingDiscount(5)).toBe(50);
    expect(calculateFoundingDiscount(6)).toBe(50);
    expect(calculateFoundingDiscount(50)).toBe(50);
  });

  it('accepts only opaque RQS codes with the canonical alphabet and length', () => {
    expect(isValidReferralCode('RQSA23456789')).toBeTrue();
    expect(isValidReferralCode('user@example.com')).toBeFalse();
    expect(isValidReferralCode('RQS-user-uuid')).toBeFalse();
  });
});
