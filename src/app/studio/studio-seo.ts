import { SeoConfig } from '../services/seo.service';
import { UiLanguage } from '../services/language.service';

export type StudioSurface = 'home' | 'master' | 'build' | 'uplink' | 'split' | 'learn' | 'account';

const APP_URL = 'https://studio.raquelsynths.com/app';

const LOCALES: Record<UiLanguage, string> = {
  en: 'en_US',
  pt: 'pt_BR',
  pl: 'pl_PL',
  fr: 'fr_FR'
};

export function studioSeoConfig(surface: StudioSurface, currentLang: UiLanguage): SeoConfig {
  const isPt = currentLang === 'pt';
  const isPl = currentLang === 'pl';
  const isFr = currentLang === 'fr';
  const url = surface === 'home' ? APP_URL : APP_URL + '/' + surface;

  if (surface === 'home') {
    const title = isPt
      ? 'RQS Studio Apps | Masterização Online, Stems, Setlists e Links Musicais'
      : isPl
        ? 'Aplikacje RQS Studio | Mastering Online, Stemy, Setlisty i Linki Muzyczne'
        : isFr
          ? 'Applications RQS Studio | Mastering en Ligne, Stems, Setlists et Liens Musicaux'
          : 'RQS Studio Apps | Online Mastering, Stems, Setlists & Music Links';
    const description = isPt
      ? 'Explore as ferramentas do RQS Studio para músicos e produtores independentes: masterização no navegador, preview de separação de stems, criação contínua de setlists e links musicais inteligentes.'
      : isPl
        ? 'Poznaj narzędzia RQS Studio dla niezależnych muzyków i producentów: mastering w przeglądarce, podgląd separacji stemów, ciągłe tworzenie setlist i inteligentne linki muzyczne.'
        : isFr
          ? 'Découvrez les outils RQS Studio pour musiciens et producteurs indépendants : mastering dans le navigateur, aperçu de séparation des stems, création continue de setlists et liens musicaux intelligents.'
          : 'Explore RQS Studio tools for independent musicians and producers: browser-based mastering, stem separation preview, continuous setlist building and smart music links.';

    return {
      title,
      description,
      url,
      type: 'website',
      locale: LOCALES[currentLang],
      siteName: 'RQS Studio',
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'RQS Studio',
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        url,
        description,
        featureList: 'Online music mastering; Stem separation preview (not available in Public Beta); Setlist building; Smart music links'
      }
    };
  }

  const operationalCopy: Record<UiLanguage, Record<Exclude<StudioSurface, 'home'>, { title: string; description: string }>> = {
    en: {
      master: { title: 'RQS Studio MASTER | Online Music Mastering', description: 'Operational RQS MASTER workspace.' },
      split: { title: 'RQS Studio SPLIT | Stem Separation Preview', description: 'RQS Studio SPLIT preview surface. Stem separation is not available in the Public Beta.' },
      build: { title: 'RQS Studio BUILD | Setlist Builder', description: 'Operational RQS Studio setlist-building workspace.' },
      uplink: { title: 'RQS Studio UPLINK | Smart Music Links', description: 'Operational RQS Studio smart music link workspace.' },
      learn: { title: 'RQS Studio Learn | Mastering Help', description: 'Contextual RQS Studio help for the mastering workflow.' },
      account: { title: 'RQS Studio Account', description: 'RQS Studio account and plan controls.' }
    },
    pt: {
      master: { title: 'RQS Studio MASTER | Masterização Online', description: 'Workspace operacional do RQS MASTER.' },
      split: { title: 'RQS Studio SPLIT | Preview de Separação de Stems', description: 'Superfície de preview do RQS Studio SPLIT. A separação de stems ainda não está disponível no Public Beta.' },
      build: { title: 'RQS Studio BUILD | Criador de Setlists', description: 'Workspace operacional para criação de setlists no RQS Studio.' },
      uplink: { title: 'RQS Studio UPLINK | Links Musicais Inteligentes', description: 'Workspace operacional de links musicais inteligentes do RQS Studio.' },
      learn: { title: 'RQS Studio Aprender | Ajuda de Masterização', description: 'Ajuda contextual do RQS Studio para o workflow de masterização.' },
      account: { title: 'Conta RQS Studio', description: 'Controles de conta e plano do RQS Studio.' }
    },
    pl: {
      master: { title: 'RQS Studio MASTER | Mastering Online', description: 'Operacyjna przestrzeń RQS MASTER.' },
      split: { title: 'RQS Studio SPLIT | Podgląd Separacji Stemów', description: 'Powierzchnia podglądu RQS Studio SPLIT. Separacja stemów nie jest jeszcze dostępna w Public Beta.' },
      build: { title: 'RQS Studio BUILD | Kreator Setlist', description: 'Operacyjna przestrzeń RQS Studio do tworzenia setlist.' },
      uplink: { title: 'RQS Studio UPLINK | Inteligentne Linki Muzyczne', description: 'Operacyjna przestrzeń RQS Studio do inteligentnych linków muzycznych.' },
      learn: { title: 'RQS Studio Nauka | Pomoc Masteringu', description: 'Kontekstowa pomoc RQS Studio dla workflow masteringu.' },
      account: { title: 'Konto RQS Studio', description: 'Ustawienia konta i planu RQS Studio.' }
    },
    fr: {
      master: { title: 'RQS Studio MASTER | Mastering en Ligne', description: 'Espace opérationnel RQS MASTER.' },
      split: { title: 'RQS Studio SPLIT | Aperçu de Séparation des Stems', description: 'Surface d’aperçu RQS Studio SPLIT. La séparation des stems n’est pas encore disponible dans la Public Beta.' },
      build: { title: 'RQS Studio BUILD | Créateur de Setlists', description: 'Espace opérationnel RQS Studio pour créer des setlists.' },
      uplink: { title: 'RQS Studio UPLINK | Liens Musicaux Intelligents', description: 'Espace opérationnel RQS Studio pour les liens musicaux intelligents.' },
      learn: { title: 'RQS Studio Apprendre | Aide au Mastering', description: 'Aide contextuelle RQS Studio pour le workflow de mastering.' },
      account: { title: 'Compte RQS Studio', description: 'Contrôles du compte et du forfait RQS Studio.' }
    }
  };

  const copy = operationalCopy[currentLang][surface];

  return {
    title: copy.title,
    description: copy.description,
    url,
    type: 'website',
    locale: LOCALES[currentLang],
    siteName: 'RQS Studio',
    robots: surface === 'account' ? 'noindex, nofollow' : 'noindex, follow'
  };
}
