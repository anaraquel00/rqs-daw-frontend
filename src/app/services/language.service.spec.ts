import { TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  let service: LanguageService;
  let browserLanguagesSpy: jasmine.Spy;

  beforeEach(() => {
    window.localStorage.removeItem('rqs_language');

    browserLanguagesSpy = spyOnProperty(
      window.navigator,
      'languages',
      'get',
    ).and.returnValue(['en-US']);

    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageService);
  });

  it('provides Auth UX strings in English, Brazilian Portuguese, Polish and French', () => {
    service.setLanguage('en');
    expect(service.currentLang()).toBe('en');
    expect(service.t().AUTH_EMAIL_CONTINUE).toBe('Continue with email');

    service.setLanguage('pt');
    expect(service.currentLang()).toBe('pt');
    expect(service.t().AUTH_EMAIL_CONTINUE).toBe('Continuar com e-mail');

    service.setLanguage('pl');
    expect(service.currentLang()).toBe('pl');
    expect(service.t().AUTH_EMAIL_CONTINUE).toBe('Kontynuuj przez e-mail');

    service.setLanguage('fr');
    expect(service.currentLang()).toBe('fr');
    expect(service.t().AUTH_EMAIL_CONTINUE).toBe('Continuer avec l’e-mail');
  });

  it('persists the explicit language choice', () => {
    service.setLanguage('pl');
    expect(window.localStorage.getItem('rqs_language')).toBe('pl');
  });
  it('uses English when the browser locale is English and there is no explicit stored language choice', () => {
    expect(window.localStorage.getItem('rqs_language')).toBeNull();
    expect(service.currentLang()).toBe('en');
  });

  it('detects Brazilian Portuguese from the browser locale when there is no explicit stored language choice', () => {
    browserLanguagesSpy.and.returnValue(['pt-BR']);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageService);

    expect(window.localStorage.getItem('rqs_language')).toBeNull();
    expect(service.currentLang()).toBe('pt');
  });
});
