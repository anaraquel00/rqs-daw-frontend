import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LanguageService, UiLanguage } from '../services/language.service';
import { SeoService } from '../services/seo.service';

type ContactCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  supportTitle: string;
  supportDesc: string;
  privacyTitle: string;
  privacyDesc: string;
  businessTitle: string;
  businessDesc: string;
  formEyebrow: string;
  formTitle: string;
  formDesc: string;
  nameLabel: string;
  emailLabel: string;
  categoryLabel: string;
  messageLabel: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  messagePlaceholder: string;
  categoryPlaceholder: string;
  categories: Record<string, string>;
  submit: string;
  sending: string;
  success: string;
  error: string;
  privacyNote: string;
  backStudio: string;
  backHome: string;
};

const CONTACT_COPY: Record<UiLanguage, ContactCopy> = {
  pt: {
    eyebrow: 'RQS STUDIO // CONTATO',
    title: 'FALE COM O STUDIO.',
    subtitle: 'Suporte técnico, privacidade e assuntos comerciais em um único ponto de contato.',
    supportTitle: 'SUPORTE',
    supportDesc: 'Problemas técnicos, conta, mastering, setlist, Uplink ou comportamento inesperado do Studio.',
    privacyTitle: 'PRIVACIDADE & LEGAL',
    privacyDesc: 'Solicitações relacionadas a dados pessoais, Política de Privacidade, Termos de Serviço ou direitos aplicáveis.',
    businessTitle: 'BUSINESS',
    businessDesc: 'Parcerias, imprensa, colaboração, interesse comercial e futuras ofertas do RQS Studio.',
    formEyebrow: 'CONTATO DIRETO',
    formTitle: 'ENVIE SUA MENSAGEM.',
    formDesc: 'Escolha a categoria mais adequada para direcionarmos sua solicitação.',
    nameLabel: 'Nome',
    emailLabel: 'E-mail',
    categoryLabel: 'Assunto',
    messageLabel: 'Mensagem',
    namePlaceholder: 'Seu nome',
    emailPlaceholder: 'voce@exemplo.com',
    messagePlaceholder: 'Descreva sua solicitação com os detalhes necessários.',
    categoryPlaceholder: 'Selecione uma categoria',
    categories: {
      support: 'Suporte técnico',
      account: 'Conta',
      privacy: 'Privacidade / Legal',
      business: 'Business / Parceria',
      other: 'Outro'
    },
    submit: 'ENVIAR MENSAGEM',
    sending: 'ENVIANDO...',
    success: 'Mensagem recebida. Obrigado — retornaremos pelo e-mail informado.',
    error: 'Não foi possível enviar agora. Tente novamente em alguns instantes.',
    privacyNote: 'Os dados deste formulário são usados para processar e responder à sua solicitação. Consulte nossa Política de Privacidade para mais informações.',
    backStudio: 'ABRIR RQS STUDIO',
    backHome: 'VOLTAR À LANDING'
  },
  en: {
    eyebrow: 'RQS STUDIO // CONTACT',
    title: 'TALK TO THE STUDIO.',
    subtitle: 'Technical support, privacy and business matters in one clear contact point.',
    supportTitle: 'SUPPORT',
    supportDesc: 'Technical issues, account questions, mastering, setlists, Uplink or unexpected Studio behavior.',
    privacyTitle: 'PRIVACY & LEGAL',
    privacyDesc: 'Requests related to personal data, the Privacy Policy, Terms of Service or applicable privacy rights.',
    businessTitle: 'BUSINESS',
    businessDesc: 'Partnerships, press, collaboration, commercial interest and future RQS Studio offerings.',
    formEyebrow: 'DIRECT CONTACT',
    formTitle: 'SEND A MESSAGE.',
    formDesc: 'Choose the most relevant category so we can route your request correctly.',
    nameLabel: 'Name',
    emailLabel: 'Email',
    categoryLabel: 'Subject',
    messageLabel: 'Message',
    namePlaceholder: 'Your name',
    emailPlaceholder: 'you@example.com',
    messagePlaceholder: 'Describe your request with the relevant details.',
    categoryPlaceholder: 'Select a category',
    categories: {
      support: 'Technical Support',
      account: 'Account',
      privacy: 'Privacy / Legal',
      business: 'Business / Partnership',
      other: 'Other'
    },
    submit: 'SEND MESSAGE',
    sending: 'SENDING...',
    success: 'Message received. Thank you — we will reply to the email provided.',
    error: 'We could not send your message right now. Please try again shortly.',
    privacyNote: 'Form data is used to process and respond to your request. See our Privacy Policy for more information.',
    backStudio: 'OPEN RQS STUDIO',
    backHome: 'BACK TO LANDING'
  },

  fr: {
    eyebrow: 'RQS STUDIO // CONTACT',
    title: 'CONTACTEZ LE STUDIO.',
    subtitle: 'Support technique, confidentialité et demandes professionnelles depuis un point de contact unique.',
    supportTitle: 'SUPPORT',
    supportDesc: 'Problèmes techniques, compte, mastering, setlists, Uplink ou comportement inattendu du Studio.',
    privacyTitle: 'CONFIDENTIALITÉ & JURIDIQUE',
    privacyDesc: 'Demandes relatives aux données personnelles, à la Politique de confidentialité, aux Conditions d’utilisation ou aux droits applicables.',
    businessTitle: 'BUSINESS',
    businessDesc: 'Partenariats, presse, collaborations, intérêt commercial et futures offres de RQS Studio.',
    formEyebrow: 'CONTACT DIRECT',
    formTitle: 'ENVOYEZ UN MESSAGE.',
    formDesc: 'Choisissez la catégorie la plus adaptée afin que nous puissions orienter correctement votre demande.',
    nameLabel: 'Nom', emailLabel: 'E-mail', categoryLabel: 'Sujet', messageLabel: 'Message',
    namePlaceholder: 'Votre nom', emailPlaceholder: 'vous@exemple.com',
    messagePlaceholder: 'Décrivez votre demande avec les informations utiles.',
    categoryPlaceholder: 'Sélectionnez une catégorie',
    categories: { support: 'Support technique', account: 'Compte', privacy: 'Confidentialité / Juridique', business: 'Business / Partenariat', other: 'Autre' },
    submit: 'ENVOYER LE MESSAGE', sending: 'ENVOI...',
    success: 'Message reçu. Merci — nous répondrons à l’adresse e-mail indiquée.',
    error: 'Impossible d’envoyer le message pour le moment. Réessayez dans quelques instants.',
    privacyNote: 'Les données de ce formulaire servent à traiter votre demande et à y répondre. Consultez notre Politique de confidentialité pour plus d’informations.',
    backStudio: 'OUVRIR RQS STUDIO', backHome: 'RETOUR À LA LANDING'
  },
  pl: {
    eyebrow: 'RQS STUDIO // KONTAKT',
    title: 'SKONTAKTUJ SIĘ ZE STUDIO.',
    subtitle: 'Wsparcie techniczne, prywatność i sprawy biznesowe w jednym miejscu.',
    supportTitle: 'WSPARCIE',
    supportDesc: 'Problemy techniczne, konto, mastering, setlisty, Uplink lub nieoczekiwane działanie Studio.',
    privacyTitle: 'PRYWATNOŚĆ I PRAWO',
    privacyDesc: 'Wnioski dotyczące danych osobowych, Polityki Prywatności, Warunków korzystania lub odpowiednich praw.',
    businessTitle: 'BUSINESS',
    businessDesc: 'Partnerstwa, media, współpraca, zainteresowanie komercyjne i przyszłe oferty RQS Studio.',
    formEyebrow: 'BEZPOŚREDNI KONTAKT',
    formTitle: 'WYŚLIJ WIADOMOŚĆ.',
    formDesc: 'Wybierz odpowiednią kategorię, aby prawidłowo skierować zgłoszenie.',
    nameLabel: 'Imię',
    emailLabel: 'E-mail',
    categoryLabel: 'Temat',
    messageLabel: 'Wiadomość',
    namePlaceholder: 'Twoje imię',
    emailPlaceholder: 'ty@example.com',
    messagePlaceholder: 'Opisz zgłoszenie i podaj potrzebne szczegóły.',
    categoryPlaceholder: 'Wybierz kategorię',
    categories: {
      support: 'Wsparcie techniczne',
      account: 'Konto',
      privacy: 'Prywatność / Prawo',
      business: 'Business / Partnerstwo',
      other: 'Inne'
    },
    submit: 'WYŚLIJ WIADOMOŚĆ',
    sending: 'WYSYŁANIE...',
    success: 'Wiadomość została odebrana. Odpowiemy na podany adres e-mail.',
    error: 'Nie udało się teraz wysłać wiadomości. Spróbuj ponownie za chwilę.',
    privacyNote: 'Dane z formularza służą do obsługi i odpowiedzi na zgłoszenie. Więcej informacji znajduje się w Polityce Prywatności.',
    backStudio: 'OTWÓRZ RQS STUDIO',
    backHome: 'WRÓĆ DO LANDING PAGE'
  }
};

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './contact-page.html',
  styleUrls: ['./contact-page.scss']
})
export class ContactPageComponent {
  readonly lang = inject(LanguageService);
  readonly copy = computed(() => CONTACT_COPY[this.lang.currentLang()]);

  readonly sending = signal(false);
  readonly submitState = signal<'idle' | 'success' | 'error'>('idle');

  name = '';
  email = '';
  category = '';
  message = '';
  website = '';

  private readonly seo = inject(SeoService);

  constructor() {
    effect(() => {
      const currentLang = this.lang.currentLang();
      const isPt = currentLang === 'pt';
      const isPl = currentLang === 'pl';
      const isFr = currentLang === 'fr';
      const canonicalUrl = 'https://studio.raquelsynths.com/contact';

      this.seo.update({
        title: isPt ? 'Contato | RQS Studio' : isPl ? 'Kontakt | RQS Studio' : isFr ? 'Contact | RQS Studio' : 'Contact | RQS Studio',
        description: isPt
          ? 'Entre em contato com o RQS Studio para suporte técnico, privacidade, questões legais e assuntos comerciais.'
          : isPl
            ? 'Skontaktuj się z RQS Studio w sprawie wsparcia technicznego, prywatności, kwestii prawnych i biznesowych.'
            : isFr ? 'Contactez RQS Studio pour le support technique, la confidentialité, les questions juridiques et professionnelles.' : 'Contact RQS Studio for technical support, privacy, legal and business matters.',
        url: canonicalUrl,
        type: 'website',
        locale: isPt ? 'pt_BR' : isPl ? 'pl_PL' : isFr ? 'fr_FR' : 'en_US',
        siteName: 'RQS Studio',
        robots: 'index, follow',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: isPt ? 'Contato do RQS Studio' : isPl ? 'Kontakt RQS Studio' : isFr ? 'Contact RQS Studio' : 'RQS Studio Contact',
          url: canonicalUrl,
          isPartOf: {
            '@type': 'WebSite',
            name: 'RQS Studio',
            url: 'https://studio.raquelsynths.com/'
          }
        }
      });
    });
  }

  async submitContact(): Promise<void> {
    if (
      this.sending() ||
      !this.name.trim() ||
      !this.email.trim() ||
      !this.category ||
      !this.message.trim()
    ) {
      return;
    }

    this.sending.set(true);
    this.submitState.set('idle');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: this.name,
          email: this.email,
          category: this.category,
          message: this.message,
          language: this.lang.currentLang(),
          website: this.website
        })
      });

      if (!response.ok) {
        throw new Error(`Contact request failed with HTTP ${response.status}`);
      }

      const result = await response.json();

      if (!result?.success) {
        throw new Error('Contact request returned unsuccessful response');
      }

      this.submitState.set('success');
      this.name = '';
      this.email = '';
      this.category = '';
      this.message = '';
      this.website = '';
    } catch (error) {
      console.error('[RQS STUDIO CONTACT] Submit failed:', error);
      this.submitState.set('error');
    } finally {
      this.sending.set(false);
    }
  }
}
