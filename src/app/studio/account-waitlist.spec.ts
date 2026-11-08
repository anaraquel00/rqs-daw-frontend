import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService } from '../services/language.service';
import { WaitlistPreferenceService } from '../services/waitlist-preference.service';
import { AccountWaitlistComponent } from './account-waitlist';

describe('AccountWaitlistComponent', () => {
  let fixture: ComponentFixture<AccountWaitlistComponent>;
  let component: AccountWaitlistComponent;
  let service: jasmine.SpyObj<WaitlistPreferenceService>;
  const language = signal<'pt' | 'en' | 'pl' | 'fr'>('pt');

  beforeEach(async () => {
    service = jasmine.createSpyObj<WaitlistPreferenceService>('WaitlistPreferenceService', ['load', 'update']);
    service.load.and.resolveTo({ joined: true, plan_interest: 'master' });
    service.update.and.resolveTo({ joined: true, plan_interest: 'pro' });
    await TestBed.configureTestingModule({
      imports: [AccountWaitlistComponent],
      providers: [
        provideRouter([]),
        { provide: WaitlistPreferenceService, useValue: service },
        { provide: LanguageService, useValue: { currentLang: language } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AccountWaitlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads the existing preference and saves an explicit idempotent plan value', async () => {
    expect(service.load).toHaveBeenCalledTimes(1);
    expect(component.selected()).toBe('master');

    component.select('pro');
    await component.save();
    fixture.detectChanges();

    expect(service.update).toHaveBeenCalledOnceWith('pro');
    expect(component.persisted()).toBe('pro');
    expect(component.saved()).toBeTrue();
    await component.save();
    expect(service.update).toHaveBeenCalledTimes(1);
  });

  it('renders complete preference UX in PT-BR, EN, PL and FR', () => {
    const expected = {
      pt: 'Minha lista de espera', en: 'My waitlist', pl: 'Moja lista oczekujących', fr: 'Ma liste d’attente',
    } as const;
    for (const code of ['pt', 'en', 'pl', 'fr'] as const) {
      language.set(code);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(expected[code]);
      expect(fixture.nativeElement.textContent).toContain('MASTER');
      expect(fixture.nativeElement.textContent).toContain('PLUS');
      expect(fixture.nativeElement.textContent).toContain('PRO');
    }
  });

  it('offers the existing pricing waitlist when the verified email has no entry', async () => {
    service.load.and.resolveTo({ joined: false });
    const second = TestBed.createComponent(AccountWaitlistComponent);
    second.detectChanges();
    await second.whenStable();
    second.detectChanges();
    expect(second.nativeElement.querySelector('a')?.getAttribute('href')).toBe('/pricing#waitlist');
    second.destroy();
  });
});
