import { environment } from './environment.staging';

describe('staging analytics isolation', () => {
  it('does not send Preview or staging traffic to the commercial GA4 property', () => {
    expect(environment.analyticsEnabled).toBeFalse();
    expect(environment.analyticsDebugMode).toBeFalse();
  });
});
