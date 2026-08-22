import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, MagicLinkErrorCode } from '../services/auth.service';
import { AuthPromptService } from '../services/auth-prompt.service';
import { LanguageService } from '../services/language.service';

type AuthCopy = {
  title: string;
  body: string;
  secondary: string;
  google: string;
  github: string;
  email: string;
  emailLabel: string;
  send: string;
  sending: string;
  successTitle: string;
  successBody: string;
  invalidEmail: string;
  rateLimit: string;
  sendError: string;
  expired: string;
  invalidLink: string;
  close: string;
};

const COPY: Record<'en' | 'pt' | 'pl' | 'fr', AuthCopy> = {
  en: {
    title: 'Sign in required',
    body: 'Create a free account or sign in to continue.',
    secondary: 'Get 3 free full masters during the Public Beta.',
    google: 'Continue with Google',
    github: 'Continue with GitHub',
    email: 'Continue with email',
    emailLabel: 'Email address',
    send: 'Send sign-in link',
    sending: 'Sending…',
    successTitle: 'Check your email',
    successBody: 'We sent you a secure sign-in link to access RQS Studio.',
    invalidEmail: 'Enter a valid email address.',
    rateLimit: 'Too many attempts. Please wait a moment and try again.',
    sendError: 'We could not send the sign-in link right now. Please try again.',
    expired: 'This sign-in link has expired. Request a new one to continue.',
    invalidLink: 'This sign-in link is invalid. Request a new one to continue.',
    close: 'Close'
  },
  pt: {
    title: 'Autenticação necessária',
    body: 'Crie uma conta gratuita ou entre para continuar.',
    secondary: 'Você recebe 3 masterizações completas gratuitas durante o Public Beta.',
    google: 'Continuar com Google',
    github: 'Continuar com GitHub',
    email: 'Continuar com email',
    emailLabel: 'Endereço de email',
    send: 'Enviar link de acesso',
    sending: 'Enviando…',
    successTitle: 'Verifique seu email',
    successBody: 'Enviamos um link seguro para entrar no RQS Studio.',
    invalidEmail: 'Digite um endereço de email válido.',
    rateLimit: 'Muitas tentativas. Aguarde um momento e tente novamente.',
    sendError: 'Não foi possível enviar o link de acesso agora. Tente novamente.',
    expired: 'Este link de acesso expirou. Solicite um novo para continuar.',
    invalidLink: 'Este link de acesso é inválido. Solicite um novo para continuar.',
    close: 'Fechar'
  },
  pl: {
    title: 'Wymagane logowanie',
    body: 'Utwórz bezpłatne konto lub zaloguj się, aby kontynuować.',
    secondary: 'Podczas publicznej wersji beta otrzymujesz 3 bezpłatne pełne masteringi.',
    google: 'Kontynuuj z Google',
    github: 'Kontynuuj z GitHub',
    email: 'Kontynuuj przez e-mail',
    emailLabel: 'Adres e-mail',
    send: 'Wyślij link do logowania',
    sending: 'Wysyłanie…',
    successTitle: 'Sprawdź swoją skrzynkę e-mail',
    successBody: 'Wysłaliśmy bezpieczny link do logowania do RQS Studio.',
    invalidEmail: 'Wpisz prawidłowy adres e-mail.',
    rateLimit: 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.',
    sendError: 'Nie udało się teraz wysłać linku do logowania. Spróbuj ponownie.',
    expired: 'Ten link do logowania wygasł. Poproś o nowy link, aby kontynuować.',
    invalidLink: 'Ten link do logowania jest nieprawidłowy. Poproś o nowy link.',
    close: 'Zamknij'
  },
  fr: {
    title: 'Connexion requise',
    body: 'Créez un compte gratuit ou connectez-vous pour continuer.',
    secondary: 'Vous bénéficiez de 3 masterisations complètes gratuites pendant la bêta publique.',
    google: 'Continuer avec Google',
    github: 'Continuer avec GitHub',
    email: 'Continuer avec l’e-mail',
    emailLabel: 'Adresse e-mail',
    send: 'Envoyer le lien de connexion',
    sending: 'Envoi…',
    successTitle: 'Vérifiez votre e-mail',
    successBody: 'Nous vous avons envoyé un lien sécurisé pour vous connecter à RQS Studio.',
    invalidEmail: 'Saisissez une adresse e-mail valide.',
    rateLimit: 'Trop de tentatives. Patientez un instant puis réessayez.',
    sendError: 'Impossible d’envoyer le lien de connexion pour le moment. Réessayez.',
    expired: 'Ce lien de connexion a expiré. Demandez-en un nouveau pour continuer.',
    invalidLink: 'Ce lien de connexion n’est pas valide. Demandez-en un nouveau.',
    close: 'Fermer'
  }
};

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-modal.html',
  styleUrls: ['./auth-modal.scss']
})
export class AuthModalComponent {
  readonly auth = inject(AuthService);
  readonly prompt = inject(AuthPromptService);
  readonly lang = inject(LanguageService);

  email = '';
  readonly emailMode = signal(false);
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal<MagicLinkErrorCode | null>(null);

  readonly copy = computed(() => {
    const language = this.lang.currentLang() as 'en' | 'pt' | 'pl' | 'fr';
    return COPY[language] ?? COPY.en;
  });

  readonly callbackMessage = computed(() => {
    if (this.auth.authCallbackError() === 'expired') return this.copy().expired;
    if (this.auth.authCallbackError() === 'invalid') return this.copy().invalidLink;
    return null;
  });

  openEmail(): void {
    this.emailMode.set(true);
    this.error.set(null);
  }

  async provider(provider: 'google' | 'github'): Promise<void> {
    await this.auth.loginWithProvider(provider);
  }

  async sendMagicLink(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);

    const result = await this.auth.sendMagicLink(this.email);
    this.loading.set(false);

    if (result.ok) {
      this.sent.set(true);
      return;
    }

    this.error.set(result.code);
  }

  errorMessage(): string | null {
    const code = this.error();
    if (code === 'invalid_email') return this.copy().invalidEmail;
    if (code === 'rate_limit') return this.copy().rateLimit;
    if (code === 'send_failed') return this.copy().sendError;
    return null;
  }

  close(): void {
    this.prompt.close();
    this.auth.clearAuthCallbackError();
    this.emailMode.set(false);
    this.sent.set(false);
    this.error.set(null);
    this.email = '';
  }
}
