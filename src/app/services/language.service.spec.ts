import { TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(() => {
    window.localStorage.removeItem('rqs_language');
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
it('defaults to English when there is no explicit stored language choice', () => {
  expect(window.localStorage.getItem('rqs_language')).toBeNull();
  expect(service.currentLang()).toBe('en');
});
});
