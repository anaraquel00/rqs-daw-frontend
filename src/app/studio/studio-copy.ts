import { UiLanguage } from '../services/language.service';

export const STUDIO_COPY: Record<UiLanguage, {
  back: string; open: string; learn: string; account: string; signOut: string;
  split: string; learnNotice: string; accountNotice: string; quota: string;
  masterFeedbackEyebrow: string; masterFeedbackTitle: string;
  masterFeedbackBody: string; masterFeedbackCta: string;
  masterFeedbackMeta: string; masterFeedbackDismiss: string;
}> = {
  en: {
    back: 'Back to Studio',
    open: 'Open workspace',
    learn: 'Learn',
    account: 'Account',
    signOut: 'Sign out',
    split: 'Stem separation is not available yet. No file will be uploaded or processed here.',
    learnNotice: 'Explore the existing mastering guide and contextual help inside MASTER.',
    accountNotice: 'Sign in to view your current plan and mastering allowance.',
    quota: 'Full Masters remaining',
    masterFeedbackEyebrow: 'RQS MASTER // PUBLIC BETA FEEDBACK',
    masterFeedbackTitle: 'Help improve MASTER',
    masterFeedbackBody: 'Found something difficult or have a suggestion? Tell us how we can improve your experience.',
    masterFeedbackCta: 'GIVE FEEDBACK',
    masterFeedbackMeta: 'Anonymous survey · About 2 minutes · Survey in English',
    masterFeedbackDismiss: 'Dismiss feedback invitation'
  },
  pt: {
    back: 'Voltar ao Studio',
    open: 'Abrir workspace',
    learn: 'Aprender',
    account: 'Conta',
    signOut: 'Sair',
    split: 'A separação de stems ainda não está disponível. Nenhum arquivo será enviado ou processado aqui.',
    learnNotice: 'Explore o guia de masterização e a ajuda contextual existentes dentro do MASTER.',
    accountNotice: 'Entre para ver seu plano atual e a disponibilidade de masters.',
    quota: 'Full Masters restantes',
    masterFeedbackEyebrow: 'RQS MASTER // PUBLIC BETA FEEDBACK',
    masterFeedbackTitle: 'Ajude a melhorar o MASTER',
    masterFeedbackBody: 'Encontrou alguma dificuldade ou tem sugestões? Conte como podemos melhorar sua experiência.',
    masterFeedbackCta: 'DAR FEEDBACK',
    masterFeedbackMeta: 'Pesquisa anônima · Aproximadamente 2 minutos · Pesquisa em português',
    masterFeedbackDismiss: 'Dispensar convite de feedback'
  },
  pl: {
    back: 'Wróć do Studio',
    open: 'Otwórz przestrzeń roboczą',
    learn: 'Nauka',
    account: 'Konto',
    signOut: 'Wyloguj się',
    split: 'Separacja stemów nie jest jeszcze dostępna. Żaden plik nie zostanie tutaj przesłany ani przetworzony.',
    learnNotice: 'Odkryj istniejący przewodnik masteringu i pomoc kontekstową w MASTER.',
    accountNotice: 'Zaloguj się, aby zobaczyć aktualny plan i dostępny limit masterów.',
    quota: 'Pozostałe pełne mastery',
    masterFeedbackEyebrow: 'RQS MASTER // PUBLIC BETA FEEDBACK',
    masterFeedbackTitle: 'Pomóż ulepszyć MASTER',
    masterFeedbackBody: 'Masz trudności lub sugestie? Powiedz nam, jak możemy poprawić Twoje doświadczenie.',
    masterFeedbackCta: 'PRZEKAŻ OPINIĘ',
    masterFeedbackMeta: 'Anonimowa ankieta · Około 2 minut · Ankieta w języku polskim',
    masterFeedbackDismiss: 'Ukryj zaproszenie do ankiety'
  },
  fr: {
    back: 'Retour au Studio',
    open: 'Ouvrir l’espace de travail',
    learn: 'Apprendre',
    account: 'Compte',
    signOut: 'Se déconnecter',
    split: 'La séparation des stems n’est pas encore disponible. Aucun fichier ne sera envoyé ou traité ici.',
    learnNotice: 'Explorez le guide de mastering et l’aide contextuelle existants dans MASTER.',
    accountNotice: 'Connectez-vous pour consulter votre forfait et votre quota de masters.',
    quota: 'Masters complets restants',
    masterFeedbackEyebrow: 'RQS MASTER // PUBLIC BETA FEEDBACK',
    masterFeedbackTitle: 'Aidez-nous à améliorer MASTER',
    masterFeedbackBody: 'Vous avez rencontré une difficulté ou avez une suggestion ? Dites-nous comment améliorer votre expérience.',
    masterFeedbackCta: 'DONNER MON AVIS',
    masterFeedbackMeta: 'Questionnaire anonyme · Environ 2 minutes · Questionnaire en français',
    masterFeedbackDismiss: 'Masquer l’invitation au questionnaire'
  },
};
