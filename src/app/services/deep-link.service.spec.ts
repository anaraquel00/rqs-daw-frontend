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
  let order: jasmine.Spy;

  beforeEach(() => {
    rows = [{
      id: 'link-1', target_url: 'https://open.spotify.com/track/abc',
      custom_slug: 'owner-a-link', created_at: '2026-08-24T00:00:00Z',
      clicks: 9, source_instagram: 1, source_tiktok: 2,
      source_facebook: 1, source_youtube: 3, source_direct: 2
    }];
    order = jasmine.createSpy().and.resolveTo({ data: rows, error: null });
    select = jasmine.createSpy().and.returnValue({ order });
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
          UPLINK_LIMIT_REACHED: 'LIMIT_REACHED',
          UPLINK_INVALID_URL: 'INVALID_URL',
          UPLINK_INVALID_SLUG: 'INVALID_SLUG',
          UPLINK_SLUG_TAKEN: 'SLUG_TAKEN',
          UPLINK_CREATE_FAILED: 'CREATE_FAILED',
          UPLINK_LOAD_FAILED: 'LOAD_FAILED'
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

  it('clears loading and hides raw database errors when list loading rejects', async () => {
    order.and.rejectWith(new Error('relation public.rqs_uplinks leaked_internal'));
    const service = TestBed.inject(DeepLinkService);
    await service.refreshLinks();
    expect(service.loading()).toBeFalse();
    expect(service.links()).toEqual([]);
    expect(service.error()).toBe('LOAD_FAILED');
  });

  it('maps known RPC errors to localized safe messages', async () => {
    rpc.and.resolveTo({ data: null, error: { message: 'UPLINK_INVALID_TARGET_URL: internal detail' } });
    const service = TestBed.inject(DeepLinkService);
    const result = await service.compileAndRegisterLink('invalid', 'slug');
    expect(result).toEqual({ success: false, error: 'INVALID_URL' });
  });

  it('uses a generic localized error for unexpected RPC rejection', async () => {
    rpc.and.rejectWith(new Error('postgres schema and constraint detail'));
    const service = TestBed.inject(DeepLinkService);
    const result = await service.compileAndRegisterLink('https://example.com', 'slug');
    expect(result).toEqual({ success: false, error: 'CREATE_FAILED' });
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
