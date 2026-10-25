import { PLANNED_PLAN_ENTITLEMENTS, plannedEntitlementLine } from './plan-entitlements';

describe('planned plan entitlements', () => {
  it('keeps the approved non-unlimited plan matrix', () => {
    expect(PLANNED_PLAN_ENTITLEMENTS).toEqual({
      free: { fullMasters: 3, spotifyPitches: 3, period: 'lifetime' },
      master: { fullMasters: 20, spotifyPitches: 10, period: 'monthly' },
      plus: { fullMasters: 40, spotifyPitches: 30, period: 'monthly' },
      pro: { fullMasters: 80, spotifyPitches: 60, period: 'monthly' },
    });
  });

  it('renders real quota copy in all supported languages', () => {
    expect(plannedEntitlementLine('en', 'free', 'spotifyPitches')).toBe('3 AI Spotify Pitches total');
    expect(plannedEntitlementLine('pt', 'master', 'spotifyPitches')).toBe('10 AI Spotify Pitches / mês');
    expect(plannedEntitlementLine('pl', 'plus', 'fullMasters')).toBe('40 Full Masters / miesiąc');
    expect(plannedEntitlementLine('fr', 'pro', 'spotifyPitches')).toBe('60 AI Spotify Pitches / mois');
  });
});
