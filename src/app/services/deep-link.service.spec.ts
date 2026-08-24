import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { DeepLinkService } from './deep-link.service';
import { LanguageService } from './language.service';

describe('DeepLinkService', () => {
  const session = signal<any>({ user: { id: 'owner-a' } });
  let rows: any[];
  let rpc: jasmine.Spy;
  let select: jasmine.Spy;

  beforeEach(() => {
    rows = [{
      id: 'link-1', target_url: 'https://open.spotify.com/track/abc',
      custom_slug: 'owner-a-link', created_at: '2026-08-24T00:00:00Z',
      clicks: 9, source_instagram: 1, source_tiktok: 2,
      source_facebook: 1, source_youtube: 3, source_direct: 2
    }];
    select = jasmine.createSpy().and.returnValue({
      order: jasmine.createSpy().and.resolveTo({ data: rows, error: null })
    });
    rpc = jasmine.createSpy().and.resolveTo({ data: rows[0], error: null });
    const client = { from: () => ({ select }), rpc };

    TestBed.configureTestingModule({
      providers: [
        DeepLinkService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthService, useValue: {
          session,
          isPremium: signal(false),
          getSupabaseClient: () => client
        }},
        { provide: LanguageService, useValue: { tr: () => ({
          UPLINK_LOGIN_REQUIRED: 'LOGIN_REQUIRED',
          UPLINK_LIMIT_REACHED: 'LIMIT_REACHED'
        })}}
      ]
    });
  });

  it('maps authoritative server counters including Direct', async () => {
    const service = TestBed.inject(DeepLinkService);
    await service.refreshLinks();
    expect(service.links()[0].clicks).toBe(9);
    expect(service.links()[0].sources.direct).toBe(2);
  });

  it('creates through the atomic RPC and refreshes the server list', async () => {
    const service = TestBed.inject(DeepLinkService);
    const result = await service.compileAndRegisterLink(
      'https://open.spotify.com/track/abc', 'owner-a-link'
    );
    expect(rpc).toHaveBeenCalledWith('create_rqs_uplink', {
      target_url: 'https://open.spotify.com/track/abc',
      requested_slug: 'owner-a-link'
    });
    expect(select).toHaveBeenCalled();
    expect(result.url).toBe('https://go.raquelsynths.com/owner-a-link');
  });

  it('does not access Supabase or browser storage during SSR', async () => {
    TestBed.resetTestingModule();
    const getSupabaseClient = jasmine.createSpy();
    TestBed.configureTestingModule({
      providers: [
        DeepLinkService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: AuthService, useValue: {
          session: signal<any>({ user: { id: 'owner-a' } }),
          isPremium: signal(false),
          getSupabaseClient
        }},
        { provide: LanguageService, useValue: { tr: () => ({}) }}
      ]
    });
    const service = TestBed.inject(DeepLinkService);
    await service.refreshLinks();
    expect(service.links()).toEqual([]);
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });
});
