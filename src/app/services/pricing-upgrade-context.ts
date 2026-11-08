export const PRICING_UPGRADE_SOURCES = ['master', 'pitch', 'build', 'uplink'] as const;
export const PRICING_UPGRADE_INTENTS = ['quota', 'upgrade'] as const;

export type PricingUpgradeSource = typeof PRICING_UPGRADE_SOURCES[number];
export type PricingUpgradeIntent = typeof PRICING_UPGRADE_INTENTS[number];

export interface PricingUpgradeContext {
  source: PricingUpgradeSource;
  intent: PricingUpgradeIntent;
}

interface QueryParamReader {
  get(name: string): string | null;
}

export function parsePricingUpgradeContext(
  params: QueryParamReader,
): PricingUpgradeContext | null {
  const source = params.get('from');
  const intent = params.get('intent');

  if (!PRICING_UPGRADE_SOURCES.includes(source as PricingUpgradeSource)) return null;
  if (!PRICING_UPGRADE_INTENTS.includes(intent as PricingUpgradeIntent)) return null;

  return {
    source: source as PricingUpgradeSource,
    intent: intent as PricingUpgradeIntent,
  };
}
