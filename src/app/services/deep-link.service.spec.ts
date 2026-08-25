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
    session.set({ user: { id: 'owner-a' } });
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

  it('maps the reserved router slug error to a safe validation message', async () => {
    rpc.and.resolveTo({ data: null, error: { message: 'UPLINK_RESERVED_SLUG: rqs-router' } });
    const service = TestBed.inject(DeepLinkService);
    const result = await service.compileAndRegisterLink('https://example.com', 'rqs-router');
    expect(result).toEqual({ success: false, error: 'INVALID_SLUG' });
  });

  it('keeps B links when a delayed A refresh resolves last', async () => {
    const pending: Deferred<{ data: any[]; error: null }>[] = [];
    order.and.callFake(() => {
      const request = deferred<{ data: any[]; error: null }>();
      pending.push(request);
      return request.promise;
    });

    const service = TestBed.inject(DeepLinkService);
    TestBed.flushEffects();
    expect(pending.length).toBe(1);

    session.set({ user: { id: 'owner-b' } });
    TestBed.flushEffects();
    expect(pending.length).toBe(2);

    pending[1].resolve({ data: [uplinkRow('link-b', 'owner-b-link')], error: null });
    await settle();
    pending[0].resolve({ data: [uplinkRow('link-a', 'owner-a-link')], error: null });
    await settle();

    expect(service.links().map((link) => link.id)).toEqual(['link-b']);
    expect(service.loading()).toBeFalse();
  });

  it('does not resurrect A links when a delayed request resolves after logout', async () => {
    const request = deferred<{ data: any[]; error: null }>();
    order.and.returnValue(request.promise);

    const service = TestBed.inject(DeepLinkService);
    TestBed.flushEffects();
    session.set(null);
    TestBed.flushEffects();
    request.resolve({ data: [uplinkRow('link-a', 'owner-a-link')], error: null });
    await settle();

    expect(service.links()).toEqual([]);
    expect(service.loading()).toBeFalse();
    expect(service.error()).toBeNull();
    expect(service.limitReached()).toBeFalse();
  });

  it('keeps the newest same-user refresh when the older request resolves last', async () => {
    const initial = deferred<{ data: any[]; error: null }>();
    const older = deferred<{ data: any[]; error: null }>();
    const newer = deferred<{ data: any[]; error: null }>();
    order.and.returnValues(initial.promise, older.promise, newer.promise);

    const service = TestBed.inject(DeepLinkService);
    TestBed.flushEffects();
    initial.resolve({ data: [uplinkRow('initial', 'initial')], error: null });
    await settle();

    const olderRefresh = service.refreshLinks();
    const newerRefresh = service.refreshLinks();
    newer.resolve({ data: [uplinkRow('newer', 'newer')], error: null });
    await newerRefresh;
    older.resolve({ data: [uplinkRow('older', 'older')], error: null });
    await olderRefresh;

    expect(service.links().map((link) => link.id)).toEqual(['newer']);
    expect(service.loading()).toBeFalse();
  });

  it('ignores a late A create result after switching to B', async () => {
    const create = deferred<{ data: any; error: null }>();
    rpc.and.returnValue(create.promise);
    order.and.callFake(() => Promise.resolve({
      data: session()?.user.id === 'owner-b'
        ? [uplinkRow('link-b', 'owner-b-link')]
        : [uplinkRow('link-a', 'owner-a-link')],
      error: null
    }));

    const service = TestBed.inject(DeepLinkService);
    TestBed.flushEffects();
    const resultPromise = service.compileAndRegisterLink('https://example.com', 'owner-a-new');

    session.set({ user: { id: 'owner-b' } });
    TestBed.flushEffects();
    create.resolve({ data: uplinkRow('created-a', 'owner-a-new'), error: null });
    const result = await resultPromise;
    await settle();

    expect(result).toEqual({ success: false, stale: true });
    expect(service.links().every((link) => link.id !== 'created-a')).toBeTrue();
    expect(service.error()).toBeNull();
    expect(service.limitReached()).toBeFalse();
  });

  it('preserves valid state across a same-user session refresh', async () => {
    order.and.callFake(() => Promise.resolve({
      data: [uplinkRow('link-a', 'owner-a-link')],
      error: null
    }));
    const service = TestBed.inject(DeepLinkService);
    TestBed.flushEffects();
    await settle();
    const epoch = service.sessionEpoch();

    session.set({ user: { id: 'owner-a' }, access_token: 'replacement-not-a-real-token' });
    TestBed.flushEffects();
    await settle();

    expect(service.sessionEpoch()).toBe(epoch);
    expect(service.links().map((link) => link.id)).toEqual(['link-a']);
    expect(service.error()).toBeNull();
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

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function uplinkRow(id: string, customSlug: string): any {
  return {
    id,
    target_url: 'https://open.spotify.com/track/abc',
    custom_slug: customSlug,
    created_at: '2026-08-24T00:00:00Z',
    clicks: 0,
    source_instagram: 0,
    source_tiktok: 0,
    source_facebook: 0,
    source_youtube: 0,
    source_direct: 0
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
