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
});
