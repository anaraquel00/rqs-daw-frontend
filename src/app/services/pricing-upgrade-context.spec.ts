import { parsePricingUpgradeContext } from './pricing-upgrade-context';

describe('parsePricingUpgradeContext', () => {
  function params(values: Record<string, string | null>) {
    return { get: (name: string) => values[name] ?? null };
  }

  it('accepts only the canonical source and intent contract', () => {
    expect(parsePricingUpgradeContext(params({ from: 'build', intent: 'upgrade' }))).toEqual({
      source: 'build',
      intent: 'upgrade',
    });
  });

  for (const values of [
    { from: 'unknown', intent: 'quota' },
    { from: 'master', intent: 'unknown' },
    { from: 'master', intent: null },
    { from: null, intent: 'upgrade' },
  ]) {
    it(`ignores invalid query params safely: ${JSON.stringify(values)}`, () => {
      expect(parsePricingUpgradeContext(params(values))).toBeNull();
    });
  }
});
