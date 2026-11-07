import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { WaitlistPreferenceService } from './waitlist-preference.service';

describe('WaitlistPreferenceService', () => {
  let service: WaitlistPreferenceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{
        provide: AuthService,
        useValue: { session: signal({ access_token: 'verified-session-token' }) },
      }],
    });
    service = TestBed.inject(WaitlistPreferenceService);
  });

  it('uses the authenticated endpoint and sends only the canonical preference', async () => {
    const request = spyOn(globalThis, 'fetch').and.resolveTo(new Response(
      JSON.stringify({ joined: true, plan_interest: 'plus' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    expect(await service.update('plus')).toEqual({ joined: true, plan_interest: 'plus' });
    expect(request).toHaveBeenCalledOnceWith('/api/waitlist/me', jasmine.objectContaining({ method: 'PATCH' }));
    const options = request.calls.mostRecent().args[1] as RequestInit;
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer verified-session-token');
    expect(JSON.parse(String(options.body))).toEqual({ plan_interest: 'plus' });
  });
});
