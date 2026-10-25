import { UiLanguage } from './language.service';
import { RqsPlan } from './mastering-types';

export const PLANNED_PLAN_ENTITLEMENTS = Object.freeze({
  free: Object.freeze({ fullMasters: 3, spotifyPitches: 3, period: 'lifetime' as const }),
  master: Object.freeze({ fullMasters: 20, spotifyPitches: 10, period: 'monthly' as const }),
  plus: Object.freeze({ fullMasters: 40, spotifyPitches: 30, period: 'monthly' as const }),
  pro: Object.freeze({ fullMasters: 80, spotifyPitches: 60, period: 'monthly' as const }),
});

const PERIOD_COPY: Record<UiLanguage, { lifetime: string; monthly: string }> = {
  en: { lifetime: 'total', monthly: '/ month' },
  pt: { lifetime: 'no total', monthly: '/ mês' },
  pl: { lifetime: 'łącznie', monthly: '/ miesiąc' },
  fr: { lifetime: 'au total', monthly: '/ mois' },
};

export function plannedEntitlementLine(
  language: UiLanguage,
  plan: RqsPlan,
  resource: 'fullMasters' | 'spotifyPitches',
): string {
  const entitlement = PLANNED_PLAN_ENTITLEMENTS[plan];
  const limit = entitlement[resource];
  const label = resource === 'fullMasters' ? 'Full Masters' : 'AI Spotify Pitches';
  return `${limit} ${label} ${PERIOD_COPY[language][entitlement.period]}`;
}
