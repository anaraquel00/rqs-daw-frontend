import { TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(() => {
    window.localStorage.removeItem('rqs_language');
    TestBed.configureTestingModule({});
    service = TestBed.inject(LanguageService);
  });

  it('supports English, Brazilian Portuguese and Polish', () => {
    service.setLanguage('en');
    expect(service.currentLang()).toBe('en');
    expect(service.tr().ORIGINAL_LABEL).toContain('ORIGINAL');

    service.setLanguage('pt');
    expect(service.currentLang()).toBe('pt');
    expect(service.t().MASTER_FULL).toContain('MASTERIZAR');

    service.setLanguage('pl');
    expect(service.currentLang()).toBe('pl');
    expect(service.t().MASTER_FULL).toContain('MASTERUJ');
  });

  it('persists the explicit language choice', () => {
    service.setLanguage('pl');
    expect(window.localStorage.getItem('rqs_language')).toBe('pl');
  });
});
