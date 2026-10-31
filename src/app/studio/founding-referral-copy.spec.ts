import { FOUNDING_REFERRAL_COPY } from './founding-referral-copy';

describe('Founding referral i18n', () => {
  it('keeps the complete referral contract in PT-BR, EN, PL and FR', () => {
    for (const language of ['pt', 'en', 'pl', 'fr'] as const) {
      const copy = FOUNDING_REFERRAL_COPY[language];
      for (const value of Object.values(copy)) expect(value.trim()).not.toBe('');
      expect(copy.body).toContain('10');
      expect(copy.body).toContain('50');
    }
  });
});
