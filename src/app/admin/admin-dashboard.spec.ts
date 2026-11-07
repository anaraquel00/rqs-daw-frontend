import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService } from '../services/language.service';
import { SeoService } from '../services/seo.service';
import { AdminDashboardComponent } from './admin-dashboard';
import { AdminSessionService } from './admin-session.service';

describe('AdminDashboardComponent', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  const language = signal<'pt' | 'en' | 'pl' | 'fr'>('en');
  const summary = {
    total: 20, master: 4, plus: 3, pro: 5, undecided: 8, legacy_unset: 6,
    generated_at: '2026-11-07T12:00:00.000Z',
  };
  const seo = { update: jasmine.createSpy('update') };

  beforeEach(async () => {
    seo.update.calls.reset();
    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: LanguageService, useValue: { currentLang: language } },
        { provide: SeoService, useValue: seo },
        { provide: AdminSessionService, useValue: { loadWaitlistSummary: () => Promise.resolve(summary) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders aggregate statistics without PII and sets canonical noindex metadata', () => {
    const text = fixture.nativeElement.textContent;
    for (const value of ['20', '4', '3', '5', '8', '6']) expect(text).toContain(value);
    expect(text).not.toContain('@');
    expect(seo.update).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      url: 'https://studio.raquelsynths.com/admin',
      robots: 'noindex, nofollow',
    }));
  });

  it('has complete dashboard copy in PT-BR, EN, PL and FR', () => {
    const expected = {
      pt: 'Interesse por plano', en: 'Plan interest', pl: 'Zainteresowanie planami', fr: 'Intérêt par offre',
    } as const;
    for (const code of ['pt', 'en', 'pl', 'fr'] as const) {
      language.set(code);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(expected[code]);
    }
  });
});
