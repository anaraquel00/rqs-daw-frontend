import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthPromptComponent } from './auth-prompt';

describe('AuthPromptComponent', () => {
  let fixture: ComponentFixture<AuthPromptComponent>;
  let component: AuthPromptComponent;

  beforeEach(async () => {
    window.history.replaceState({}, '', '/app');
    window.sessionStorage.clear();
    window.localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [AuthPromptComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthPromptComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/app');
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('resets invalid email and service error when the prompt closes and reopens', () => {
    const signIn = spyOn(component.auth.getSupabaseClient().auth, 'signInWithOtp');

    component.auth.requestSignIn('general', 'email');
    component.email.set('not-an-email');
    component.submitEmail();

    expect(component.auth.authMessageKey()).toBe('AUTH_EMAIL_INVALID');
    expect(signIn).not.toHaveBeenCalled();

    component.close();

    expect(component.email()).toBe('');
    expect(component.auth.authMessageKey()).toBeNull();

    component.auth.requestSignIn('general', 'email');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#auth-email') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(input.validity.typeMismatch).toBeFalse();

    component.submitEmail();

    expect(component.auth.authMessageKey()).toBe('AUTH_EMAIL_REQUIRED');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('does not request a Magic Link for empty or malformed component input', () => {
    const signIn = spyOn(component.auth.getSupabaseClient().auth, 'signInWithOtp');

    component.email.set('   ');
    component.submitEmail();
    expect(component.auth.authMessageKey()).toBe('AUTH_EMAIL_REQUIRED');

    component.email.set('invalid-email');
    component.submitEmail();
    expect(component.auth.authMessageKey()).toBe('AUTH_EMAIL_INVALID');

    expect(signIn).not.toHaveBeenCalled();
  });

  it('shows the shared account message for every intent and the beta benefit only for MASTER', () => {
    component.auth.requestSignIn('build');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(component.lang.t().AUTH_SHARED_ACCOUNT);
    expect(fixture.nativeElement.querySelector('.auth-benefit')).toBeNull();

    component.close();
    component.auth.requestSignIn('master');
    fixture.detectChanges();

    const benefit = fixture.nativeElement.querySelector('.auth-benefit') as HTMLElement;
    expect(benefit.textContent).toContain(component.lang.t().AUTH_REQUIRED_BENEFIT);
  });

  it('provides complete shared-auth copy in PT-BR, EN-US, PL-PL and FR-FR', () => {
    for (const language of ['pt', 'en', 'pl', 'fr'] as const) {
      component.lang.setLanguage(language);
      component.auth.requestSignIn('pitch');
      fixture.detectChanges();

      const copy = component.lang.t();
      expect(copy.AUTH_EYEBROW).withContext(language).toBeTruthy();
      expect(copy.AUTH_REQUIRED_BODY).withContext(language).toBeTruthy();
      expect(copy.AUTH_SHARED_ACCOUNT).withContext(language).toContain('MASTER');
      expect(copy.AUTH_GOOGLE).withContext(language).toBeTruthy();
      expect(copy.AUTH_GITHUB).withContext(language).toBeTruthy();
      expect(copy.AUTH_EMAIL_CONTINUE).withContext(language).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.auth-benefit')).withContext(language).toBeNull();

      component.close();
    }
  });
});
