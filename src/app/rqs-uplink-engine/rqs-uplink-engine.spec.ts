import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AnalyticsService } from '../services/analytics.service';
import { DeepLinkService } from '../services/deep-link.service';
import { LanguageService } from '../services/language.service';
import { RqsUplinkEngineComponent } from './rqs-uplink-engine';

describe('RqsUplinkEngineComponent', () => {
  it('always clears creating after an unexpected dependency rejection', async () => {
    const deepLinkService = {
      detectPlatform: () => null,
      sessionEpoch: signal(0),
      compileAndRegisterLink: jasmine.createSpy().and.rejectWith(new Error('internal detail'))
    };

    await TestBed.configureTestingModule({
      imports: [RqsUplinkEngineComponent],
      providers: [
        { provide: DeepLinkService, useValue: deepLinkService },
        { provide: LanguageService, useValue: { tr: () => ({ UPLINK_CREATE_FAILED: 'CREATE_FAILED' }) } },
        { provide: AnalyticsService, useValue: { trackEvent: jasmine.createSpy() } }
      ]
    }).compileComponents();

    const component = TestBed.createComponent(RqsUplinkEngineComponent).componentInstance;
    component.targetUrl.set('https://example.com');
    await component.compileLink();

    expect(component.creating()).toBeFalse();
    expect(component.errorMessage()).toBe('CREATE_FAILED');
  });

  it('does not surface a stale create result after a user switch', async () => {
    const createA = deferred<{ success: boolean; stale: boolean }>();
    const createB = deferred<{ success: boolean; url: string }>();
    const sessionEpoch = signal(1);
    const deepLinkService = {
      detectPlatform: () => null,
      sessionEpoch,
      compileAndRegisterLink: jasmine.createSpy().and.returnValues(createA.promise, createB.promise)
    };

    await TestBed.configureTestingModule({
      imports: [RqsUplinkEngineComponent],
      providers: [
        { provide: DeepLinkService, useValue: deepLinkService },
        { provide: LanguageService, useValue: { tr: () => ({ UPLINK_CREATE_FAILED: 'CREATE_FAILED' }) } },
        { provide: AnalyticsService, useValue: { trackEvent: jasmine.createSpy() } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(RqsUplinkEngineComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.targetUrl.set('https://example.com');
    const compilationA = component.compileLink();
    sessionEpoch.set(2);
    fixture.detectChanges();
    await fixture.whenStable();
    const compilationB = component.compileLink();
    createA.resolve({ success: false, stale: true });
    await compilationA;

    expect(component.compiledLink()).toBe('');
    expect(component.errorMessage()).toBe('');
    expect(component.creating()).toBeTrue();

    createB.resolve({ success: true, url: 'https://go.raquelsynths.com/owner-b' });
    await compilationB;

    expect(component.compiledLink()).toBe('https://go.raquelsynths.com/owner-b');
    expect(component.creating()).toBeFalse();
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
