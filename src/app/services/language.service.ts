import { Injectable, signal, computed } from '@angular/core';

export type UiLanguage = 'en' | 'pt' | 'pl' | 'fr';

export const PT_DICT = {
  RQS_DSP_CORE: 'RQS DSP CORE',
  SUBTITLE: 'Arraste a faixa para homologação acústica',
  DROP_PROMPT: 'Solte o arquivo .WAV aqui',
  OR_CLICK: 'ou clique para buscar no sistema',
  FILE_INTERCEPTED: 'interceptado.',
  EXTRACT_STEMS: '🧬 EXTRAIR 6 STEMS (ISOLAMENTO MULTI-PISTA)',
  DISSECTING: '🧬 IA Demucs está dissecando a matriz acústica em 6 canais... (Pode demorar alguns minutos. Não feche a aba!)',
  REACTOR_PROCESSING: '⚙️ RQS Reator processando telemetria... Aguarde.',
  MASTER_COMPLETED: '✅ Masterização concluída! [Download áudio]',
  EJECT_DECK: '⏏️ EJETAR FAIXA E LIMPAR DECK',
  SYNCHRONIZING: '⚡ Sincronizando matriz de áudio com o Bunker... Aguarde.',
  DISSECTING_MINI: '🧬 EXTRAINDO...',
  UPLOAD_FIRST_STEMS: 'Carregue uma faixa para liberar o isolamento de Stems',
  ORIGINAL: 'Original',
  MASTER: 'Master',
  VOLUME_MATCH: 'Volume Match (Em construção 🔧)',
  PERFIL_ACUSTICO: 'Perfil Acústico (Powered by RQS DSP)',
  INTENSIDADE_MASTER: 'Intensidade da Masterização (Dynamic Control)',
  THUNDER: '🌩️ Thunder',
  CLEAR_SKY: '☁️ Clear Sky',
  SUNROOF: '☀️ Sunroof',
  AURORA: '🌌 Aurora',
  BAIXA: '🟢 Baixa (Dinâmica)',
  MEDIA: '🟡 Média (Equilibrada)',
  ALTA: '🔴 Alta (Competitiva)',
  HEAR_TEST: '🎧 OUVIR TESTE (15s)',
  MASTER_FULL: '🔥 MASTERIZAR FAIXA COMPLETA',
  ANALYZING: 'Analisando...',
  PROCESSING_ACUSTICO: 'Processando IA Acústica...',
  SETLIST_ENGINE: '🎛️ RQS Setlist Engine',
  MIX_DROP_PROMPT: 'Arraste suas faixas masterizadas aqui',
  MIX_OR_CLICK: 'ou clique para abrir a pasta',
  TIMELINE_TITLE: 'Linha do Tempo',
  TRACKS_COUNT: 'faixas',
  CROSSFADE_TO: '↳ Crossfade em direção à Faixa',
  SECONDS: 'segundos',
  DEPLOY_LABEL: 'Nomenclatura do Deploy (.WAV):',
  FFMPEG_PROCESSING: '⚙️ RQS Motor FFmpeg costurando o crossfade... Aguarde.',
  DEPLOY_COMPLETED: '✅ Deploy Concluído! O download da Setlist iniciou automaticamente.',
  IGNITE_IDLE: '🔥 INICIAR DEPLOY DA SETLIST',
  IGNITE_ACTIVE: '🔥 RENDERIZANDO MATRIZ...',
  EKG_MONITOR_TITLE: '📟 MONITORAMENTO DE EKG ACÚSTICO',
  SIGNAL_ACTIVE: 'SINAL DE ÁUDIO ATIVO',
  FREQUENCY_SPECTRUM: 'Análise de Espectro de Frequência',
  PHASE_CORRELATION: 'Correlação de Fase & Imagem Estéreo',
  LIMIT_EXCEEDED_ALERT: 'Limite de masterizações gratuitas esgotado (3 de 3 consumidas). Entre na waitlist para receber novidades dos planos pagos.',
  FREE_USAGE_LABEL: 'Masterizações gratuitas restantes',
  PRO_USAGE_LABEL: 'Plano: RQS PRO',
  FOOTER_TAGLINE: 'Reator de inteligência acústica e engenharia DSP para música eletrônica e industrial.',
  FOOTER_TELEMETRY: 'INFORMAÇÕES DO SISTEMA',
  FOOTER_NODE: 'Região de processamento',
  FOOTER_COMPLIANCE: 'Referências DSP',
  FOOTER_TERMS: 'Termos de Serviço',
  FOOTER_PRIVACY: 'Política de Privacidade',
  FOOTER_PRICING: 'Planos pagos',
  FOOTER_SA_EAST: 'São Paulo (sa-east-1)',
  FOOTER_EBU_R128: 'EBU R128 / ITU-R BS.1770',
  FOOTER_COPYRIGHT: '© 2026 RaQuel Synths. Todos os direitos reservados.',
  FOOTER_CONTACT: 'Fale Conosco',
};

export const EN_DICT: typeof PT_DICT = {
  RQS_DSP_CORE: 'RQS DSP CORE',
  SUBTITLE: 'Drag the track here for acoustic validation',
  DROP_PROMPT: 'Drop the .WAV file here',
  OR_CLICK: 'or click to browse system',
  FILE_INTERCEPTED: 'intercepted.',
  EXTRACT_STEMS: '🧬 EXTRACT 6 STEMS (MULTI-TRACK ISOLATION)',
  DISSECTING: '🧬 Demucs AI is dissecting the acoustic matrix into 6 channels... (Might take a few minutes. Do not close tab!)',
  REACTOR_PROCESSING: '⚙️ RQS Reactor processing telemetry... Please wait.',
  MASTER_COMPLETED: '✅ Mastering completed! [Download audio]',
  EJECT_DECK: '⏏️ EJECT TRACK & CLEAR DECK',
  SYNCHRONIZING: '⚡ Synchronizing audio matrix with Bunker... Please wait.',
  DISSECTING_MINI: '🧬 EXTRACTING...',
  UPLOAD_FIRST_STEMS: 'Upload a track to unlock Stem isolation',
  ORIGINAL: 'Original',
  MASTER: 'Master',
  VOLUME_MATCH: 'Volume Match (Under construction 🔧)',
  PERFIL_ACUSTICO: 'Acoustic Profile (Powered by RQS DSP)',
  INTENSIDADE_MASTER: 'Mastering Intensity (Dynamic Control)',
  THUNDER: '🌩️ Thunder',
  CLEAR_SKY: '☁️ Clear Sky',
  SUNROOF: '☀️ Sunroof',
  AURORA: '🌌 Aurora',
  BAIXA: '🟢 Low (Dynamic)',
  MEDIA: '🟡 Medium (Balanced)',
  ALTA: '🔴 High (Competitive)',
  HEAR_TEST: '🎧 HEAR TEST (15s)',
  MASTER_FULL: '🔥 MASTER FULL TRACK',
  ANALYZING: 'Analyzing...',
  PROCESSING_ACUSTICO: 'Processing Acoustic AI...',
  SETLIST_ENGINE: '🎛️ RQS Setlist Engine',
  MIX_DROP_PROMPT: 'Drag your mastered tracks here',
  MIX_OR_CLICK: 'or click to open folder',
  TIMELINE_TITLE: 'Timeline',
  TRACKS_COUNT: 'tracks',
  CROSSFADE_TO: '↳ Crossfade towards Track',
  SECONDS: 'seconds',
  DEPLOY_LABEL: 'Deploy Filename (.WAV):',
  FFMPEG_PROCESSING: '⚙️ RQS FFmpeg Engine stitching crossfades... Please wait.',
  DEPLOY_COMPLETED: '✅ Deploy Completed! Setlist download started automatically.',
  IGNITE_IDLE: '🔥 START SETLIST DEPLOY',
  IGNITE_ACTIVE: '🔥 RENDERING COMPILATION...',
  EKG_MONITOR_TITLE: '📟 ACOUSTIC EKG MONITOR',
  SIGNAL_ACTIVE: 'AUDIO SIGNAL ACTIVE',
  FREQUENCY_SPECTRUM: 'Frequency Spectrum Analysis',
  PHASE_CORRELATION: 'Phase Correlation & Stereo Imaging',
  LIMIT_EXCEEDED_ALERT: 'Free mastering limit reached (3 of 3 used). Join the waitlist for paid-plan availability.',
  FREE_USAGE_LABEL: 'Free masterings remaining',
  PRO_USAGE_LABEL: 'Plan: RQS PRO',
  FOOTER_TAGLINE: 'Acoustic intelligence and DSP engineering reactor for electronic and industrial music.',
  FOOTER_TELEMETRY: 'SYSTEM INFO',
  FOOTER_NODE: 'Audio processing region',
  FOOTER_COMPLIANCE: 'DSP references',
  FOOTER_TERMS: 'Terms of Service',
  FOOTER_PRIVACY: 'Privacy Policy',
  FOOTER_PRICING: 'Paid plans',
  FOOTER_SA_EAST: 'São Paulo (sa-east-1)',
  FOOTER_EBU_R128: 'EBU R128 / ITU-R BS.1770',
  FOOTER_COPYRIGHT: '© 2026 RaQuel Synths. All rights reserved.',
  FOOTER_CONTACT: 'Contact Us',
};

export const PL_DICT: typeof PT_DICT = {
  RQS_DSP_CORE: 'RQS DSP CORE',
  SUBTITLE: 'Przeciągnij utwór, aby rozpocząć analizę i mastering',
  DROP_PROMPT: 'Upuść tutaj plik WAV lub MP3',
  OR_CLICK: 'lub kliknij, aby wybrać plik',
  FILE_INTERCEPTED: 'załadowany.',
  EXTRACT_STEMS: '🧬 WYDZIEL 6 STEMÓW',
  DISSECTING: '🧬 Demucs rozdziela nagranie na 6 ścieżek... Może to potrwać kilka minut. Nie zamykaj karty.',
  REACTOR_PROCESSING: '⚙️ RQS analizuje i przetwarza audio... Proszę czekać.',
  MASTER_COMPLETED: '✅ Mastering zakończony! [Pobierz audio]',
  EJECT_DECK: '⏏️ USUŃ UTWÓR I WYCZYŚĆ PANEL',
  SYNCHRONIZING: '⚡ Synchronizacja audio... Proszę czekać.',
  DISSECTING_MINI: '🧬 WYDZIELANIE...',
  UPLOAD_FIRST_STEMS: 'Najpierw załaduj utwór, aby odblokować separację stemów',
  ORIGINAL: 'Oryginał',
  MASTER: 'Master',
  VOLUME_MATCH: 'Wyrównanie głośności (w przygotowaniu)',
  PERFIL_ACUSTICO: 'Profil masteringu',
  INTENSIDADE_MASTER: 'Intensywność charakteru masteringu',
  THUNDER: '🌩️ Thunder',
  CLEAR_SKY: '☁️ Clear Sky',
  SUNROOF: '☀️ Sunroof',
  AURORA: '🌌 Aurora',
  BAIXA: '🟢 Niska (dynamiczna)',
  MEDIA: '🟡 Średnia (zbalansowana)',
  ALTA: '🔴 Wysoka (mocna)',
  HEAR_TEST: '🎧 ODSŁUCHAJ TEST (15 s)',
  MASTER_FULL: '🔥 MASTERUJ CAŁY UTWÓR',
  ANALYZING: 'Analiza...',
  PROCESSING_ACUSTICO: 'Przetwarzanie audio...',
  SETLIST_ENGINE: '🎛️ RQS Setlist Engine',
  MIX_DROP_PROMPT: 'Przeciągnij tutaj zmasterowane utwory',
  MIX_OR_CLICK: 'lub kliknij, aby otworzyć folder',
  TIMELINE_TITLE: 'Oś czasu',
  TRACKS_COUNT: 'utworów',
  CROSSFADE_TO: '↳ Crossfade do utworu',
  SECONDS: 'sekund',
  DEPLOY_LABEL: 'Nazwa pliku wynikowego (.WAV):',
  FFMPEG_PROCESSING: '⚙️ RQS FFmpeg renderuje przejścia... Proszę czekać.',
  DEPLOY_COMPLETED: '✅ Render setlisty zakończony.',
  IGNITE_IDLE: '🔥 RENDERUJ SETLISTĘ',
  IGNITE_ACTIVE: '🔥 RENDEROWANIE...',
  EKG_MONITOR_TITLE: '📟 MONITOR SYGNAŁU AUDIO',
  SIGNAL_ACTIVE: 'SYGNAŁ AUDIO AKTYWNY',
  FREQUENCY_SPECTRUM: 'Widmo częstotliwości',
  PHASE_CORRELATION: 'Korelacja fazy i obraz stereo',
  LIMIT_EXCEEDED_ALERT: 'Wykorzystano limit bezpłatnych masteringów (3/3). Dołącz do listy oczekujących na przyszłe plany.',
  FREE_USAGE_LABEL: 'Pozostałe bezpłatne mastery',
  PRO_USAGE_LABEL: 'Plan: RQS PRO',
  FOOTER_TAGLINE: 'Inteligentny mastering i narzędzia DSP dla twórców muzyki.',
  FOOTER_TELEMETRY: 'INFORMACJE SYSTEMOWE',
  FOOTER_NODE: 'Region przetwarzania audio',
  FOOTER_COMPLIANCE: 'Referencje DSP',
  FOOTER_TERMS: 'Warunki korzystania',
  FOOTER_PRIVACY: 'Polityka prywatności',
  FOOTER_PRICING: 'Płatne plany',
  FOOTER_SA_EAST: 'São Paulo (sa-east-1)',
  FOOTER_EBU_R128: 'EBU R128 / ITU-R BS.1770',
  FOOTER_COPYRIGHT: '© 2026 RaQuel Synths. Wszelkie prawa zastrzeżone.',
  FOOTER_CONTACT: 'Kontakt',
};

export const FR_DICT: typeof PT_DICT = {
  RQS_DSP_CORE: 'RQS DSP CORE',
  SUBTITLE: 'Glissez le morceau ici pour lancer la validation acoustique',
  DROP_PROMPT: 'Déposez votre fichier WAV ou MP3 ici',
  OR_CLICK: 'ou cliquez pour choisir un fichier',
  FILE_INTERCEPTED: 'chargé.',
  EXTRACT_STEMS: '🧬 SÉPARER EN 6 STEMS',
  DISSECTING: '🧬 Demucs sépare l’audio en 6 pistes... Cela peut prendre quelques minutes. Ne fermez pas l’onglet.',
  REACTOR_PROCESSING: '⚙️ RQS analyse et traite l’audio... Veuillez patienter.',
  MASTER_COMPLETED: '✅ Mastering terminé ! [Télécharger l’audio]',
  EJECT_DECK: '⏏️ ÉJECTER LE MORCEAU ET VIDER LE DECK',
  SYNCHRONIZING: '⚡ Synchronisation de l’audio... Veuillez patienter.',
  DISSECTING_MINI: '🧬 SÉPARATION...',
  UPLOAD_FIRST_STEMS: 'Chargez d’abord un morceau pour débloquer la séparation des stems',
  ORIGINAL: 'Original',
  MASTER: 'Master',
  VOLUME_MATCH: 'Volume Match (en préparation)',
  PERFIL_ACUSTICO: 'Profil de mastering',
  INTENSIDADE_MASTER: 'Intensité du caractère de mastering',
  THUNDER: '🌩️ Thunder',
  CLEAR_SKY: '☁️ Clear Sky',
  SUNROOF: '☀️ Sunroof',
  AURORA: '🌌 Aurora',
  BAIXA: '🟢 Faible (dynamique)',
  MEDIA: '🟡 Moyenne (équilibrée)',
  ALTA: '🔴 Élevée (puissante)',
  HEAR_TEST: '🎧 ÉCOUTER LE TEST (15 s)',
  MASTER_FULL: '🔥 MASTERISER LE MORCEAU COMPLET',
  ANALYZING: 'Analyse...',
  PROCESSING_ACUSTICO: 'Traitement audio...',
  SETLIST_ENGINE: '🎛️ RQS Setlist Engine',
  MIX_DROP_PROMPT: 'Glissez vos morceaux masterisés ici',
  MIX_OR_CLICK: 'ou cliquez pour ouvrir le dossier',
  TIMELINE_TITLE: 'Timeline',
  TRACKS_COUNT: 'morceaux',
  CROSSFADE_TO: '↳ Crossfade vers le morceau',
  SECONDS: 'secondes',
  DEPLOY_LABEL: 'Nom du fichier de sortie (.WAV) :',
  FFMPEG_PROCESSING: '⚙️ Le moteur RQS FFmpeg rend les transitions... Veuillez patienter.',
  DEPLOY_COMPLETED: '✅ Export de la setlist terminé.',
  IGNITE_IDLE: '🔥 RENDRE LA SETLIST',
  IGNITE_ACTIVE: '🔥 RENDU EN COURS...',
  EKG_MONITOR_TITLE: '📟 MONITEUR DU SIGNAL AUDIO',
  SIGNAL_ACTIVE: 'SIGNAL AUDIO ACTIF',
  FREQUENCY_SPECTRUM: 'Spectre de fréquences',
  PHASE_CORRELATION: 'Corrélation de phase et image stéréo',
  LIMIT_EXCEEDED_ALERT: 'La limite gratuite de 3 masterings a été atteinte. Rejoignez la liste d’attente pour les futurs forfaits.',
  FREE_USAGE_LABEL: 'Masterings gratuits restants',
  PRO_USAGE_LABEL: 'Forfait : RQS PRO',
  FOOTER_TAGLINE: 'Mastering intelligent et outils DSP pour les créateurs de musique.',
  FOOTER_TELEMETRY: 'INFORMATIONS SYSTÈME',
  FOOTER_NODE: 'Région de traitement audio',
  FOOTER_COMPLIANCE: 'Références DSP',
  FOOTER_TERMS: 'Conditions d’utilisation',
  FOOTER_PRIVACY: 'Politique de confidentialité',
  FOOTER_PRICING: 'Forfaits payants',
  FOOTER_SA_EAST: 'São Paulo (sa-east-1)',
  FOOTER_EBU_R128: 'EBU R128 / ITU-R BS.1770',
  FOOTER_COPYRIGHT: '© 2026 RaQuel Synths. Tous droits réservés.',
  FOOTER_CONTACT: 'Contact',
};

const PT_PRICING = {
  eyebrow: 'BETA PÚBLICO // PRÉVIA DE PREÇOS DE LANÇAMENTO', title: 'PREÇOS FEITOS PARA ARTISTAS INDEPENDENTES.', subtitle: 'Comece grátis. Faça upgrade quando o RQS Studio se tornar parte do seu workflow.', inactive: 'As assinaturas pagas ainda não estão ativas. Entre na lista de espera para ser avisado quando os planos forem disponibilizados.', previewLabel: 'PREÇOS DE LANÇAMENTO PLANEJADOS', monthly: '/ mês', openStudio: 'ABRIR RQS STUDIO', joinWaitlist: 'ENTRAR NA WAITLIST', features: 'DIREÇÃO DE RECURSOS', proposedQuota: 'Cota proposta', publicBeta: 'BETA PÚBLICO', plannedAccess: 'ACESSO PLANEJADO NOS PLANOS PAGOS', currentBetaAccess: 'ACESSO ATUAL NO BETA', taxes: 'Tributos aplicáveis, quando houver, serão informados antes da compra quando os planos pagos forem disponibilizados.', compareTitle: 'BETA ATUAL VS. ACESSO PLANEJADO', compareIntro: 'O acesso do Public Beta permanece separado da proposta de empacotamento dos planos pagos. Nenhum entitlement pago está ativo hoje.', feature: 'Recurso', price: 'Preço', fullMasters: 'Full Masters', preview: 'Preview', ab: 'Comparação A/B', setlist: 'Setlist Engine', uplink: 'RQS Uplink', stems: 'Separação de Stems', availableBeta: 'Disponível durante o Public Beta', planned: 'planejado', waitlistTitle: 'RECEBA O AVISO DE LANÇAMENTO.', waitlistIntro: 'Use a waitlist já existente do RQS para receber avisos de disponibilidade. A preferência de plano ainda não é registrada.', emailLabel: 'E-mail', emailPlaceholder: 'voce@exemplo.com', sending: 'ENTRANDO...', waitlistSuccess: 'Você entrou na waitlist de lançamento do RQS.', waitlistError: 'Não foi possível adicionar este e-mail à waitlist agora.', faqTitle: 'FAQ', freeTagline: 'Explore o sistema.', masterTagline: 'Finalize suas faixas.', plusTagline: 'Construa seu workflow.', proTagline: 'Use o Studio completo.', freeCurrentAccess: 'ACESSO ATUAL DO BETA', freeItem1: '3 Full Masters no total', freeItem2: 'Preview: comportamento atual do beta', freeItem3: 'Comparação A/B onde já suportada', freeItem4: 'Setlist, Uplink e Stems disponíveis durante o Public Beta', masterItem1: 'Workflow MASTER', masterItem2: 'Ferramentas de masterização', masterItem3: 'Comparação A/B onde já suportada', plusItem1: 'Tudo do MASTER', plusItem2: 'BUILD / Setlist Engine', plusItem3: 'DEPLOY / RQS Uplink', proItem1: 'Tudo do PLUS', proItem2: 'SPLIT / Separação de Stems', proItem3: 'Workflow MASTER / SPLIT / BUILD / DEPLOY', independentArtists: 'PARA ARTISTAS INDEPENDENTES', fullStudio: 'STUDIO COMPLETO', waitlistEyebrow: 'WAITLIST // SEM CHECKOUT', infoEyebrow: 'RQS STUDIO // INFORMAÇÕES',
  faq: [
    { q: 'Posso usar o RQS Studio gratuitamente?', a: 'Sim. O RQS Studio está em Public Beta. A experiência Free inclui a franquia atual de masterização do beta, enquanto vários módulos do Studio permanecem disponíveis durante o beta.' },
    { q: 'As assinaturas pagas estão ativas?', a: 'Não. Assinaturas pagas, checkout e entitlements comerciais não estão ativos. Os cards pagos desta página são apenas uma prévia de preços de lançamento.' },
    { q: 'Esses são os preços finais de lançamento?', a: 'Não. São preços planejados e ainda podem mudar antes da disponibilização dos planos pagos.' },
    { q: 'Por que os preços são diferentes em cada moeda?', a: 'O RQS Studio usa preços localizados nas moedas suportadas. São price books fixos e independentes, sem conversão automática pelas taxas de câmbio diárias.' },
    { q: 'Haverá tributos adicionais?', a: 'Tributos aplicáveis, quando houver, serão informados antes da compra quando os planos pagos forem disponibilizados. Este preview não calcula VAT, Stripe Tax ou impostos de checkout.' },
    { q: 'O que acontece quando eu atinjo o limite gratuito de masterização?', a: 'O limite atual do beta bloqueia novos Full Masters depois que a franquia gratuita é consumida. O comportamento de Preview é separado, e você pode entrar na waitlist para ser avisado sobre futuros planos pagos.' },
    { q: 'O RQS reivindica propriedade sobre minha música?', a: 'Consulte os Termos de Serviço para as regras atuais de propriedade e uso. Esta página de preços não substitui nem reproduz as regras jurídicas.', legal: 'terms' },
    { q: 'Como os arquivos de áudio enviados são tratados?', a: 'Consulte a Política de Privacidade para as informações atuais sobre tratamento e retenção dos arquivos. Esta página evita duplicar regras detalhadas de retenção.', legal: 'privacy' }
  ]
};

type PricingCopy = typeof PT_PRICING;

const EN_PRICING: PricingCopy = {
  eyebrow: 'PUBLIC BETA // LAUNCH PRICING PREVIEW', title: 'PRICING BUILT FOR INDEPENDENT ARTISTS.', subtitle: 'Start free. Upgrade when RQS Studio becomes part of your workflow.', inactive: 'Paid subscriptions are not active yet. Join the waitlist to be notified when plans become available.', previewLabel: 'PLANNED LAUNCH PRICING', monthly: '/ month', openStudio: 'OPEN RQS STUDIO', joinWaitlist: 'JOIN WAITLIST', features: 'FEATURE DIRECTION', proposedQuota: 'Proposed quota', publicBeta: 'PUBLIC BETA', plannedAccess: 'PLANNED PAID-PLAN ACCESS', currentBetaAccess: 'CURRENT BETA ACCESS', taxes: 'Taxes, where applicable, will be shown before purchase when paid plans become available.', compareTitle: 'CURRENT BETA VS. PLANNED ACCESS', compareIntro: 'Public Beta access remains separate from proposed paid-plan packaging. No paid entitlement is active today.', feature: 'Feature', price: 'Price', fullMasters: 'Full Masters', preview: 'Preview', ab: 'A/B comparison', setlist: 'Setlist Engine', uplink: 'RQS Uplink', stems: 'Stem Separation', availableBeta: 'Available during Public Beta', planned: 'planned', waitlistTitle: 'GET LAUNCH NOTIFIED.', waitlistIntro: 'Use the existing RQS waitlist to receive launch availability updates. Plan preference is not recorded yet.', emailLabel: 'Email', emailPlaceholder: 'you@example.com', sending: 'JOINING...', waitlistSuccess: 'You are on the RQS launch waitlist.', waitlistError: 'We could not add this email to the waitlist right now.', faqTitle: 'FAQ', freeTagline: 'Explore the system.', masterTagline: 'Finish your tracks.', plusTagline: 'Build your workflow.', proTagline: 'Run the full Studio.', freeCurrentAccess: 'CURRENT BETA ACCESS', freeItem1: '3 Full Masters total', freeItem2: 'Preview: current beta behavior', freeItem3: 'A/B comparison where currently supported', freeItem4: 'Setlist, Uplink and Stems available during Public Beta', masterItem1: 'MASTER workflow', masterItem2: 'Mastering tools', masterItem3: 'A/B comparison where currently supported', plusItem1: 'Everything in MASTER', plusItem2: 'BUILD / Setlist Engine', plusItem3: 'DEPLOY / RQS Uplink', proItem1: 'Everything in PLUS', proItem2: 'SPLIT / Stem Separation', proItem3: 'MASTER / SPLIT / BUILD / DEPLOY workflow', independentArtists: 'FOR INDEPENDENT ARTISTS', fullStudio: 'FULL STUDIO', waitlistEyebrow: 'WAITLIST // NO CHECKOUT', infoEyebrow: 'RQS STUDIO // INFO',
  faq: [
    { q: 'Can I use RQS Studio for free?', a: 'Yes. RQS Studio is currently in Public Beta. The Free experience includes the current beta mastering allowance, while several Studio modules remain available during the beta.' },
    { q: 'Are paid subscriptions active?', a: 'No. Paid subscriptions, checkout and commercial entitlements are not active. The paid cards on this page are launch pricing previews only.' },
    { q: 'Are these final launch prices?', a: 'No. They are planned launch prices and may change before paid plans become available.' },
    { q: 'Why do prices differ by currency?', a: 'RQS Studio uses localized pricing for supported currencies. Prices are fixed product price books and do not change automatically with daily exchange rates.' },
    { q: 'Will taxes be added?', a: 'Taxes, where applicable, will be shown before purchase when paid plans become available. No VAT, Stripe Tax or checkout tax calculation is active in this preview.' },
    { q: 'What happens when I reach my free mastering limit?', a: 'The current beta Full Master limit blocks additional Full Masters after the free allowance is consumed. Preview behavior remains separate, and you can join the waitlist for future paid-plan availability.' },
    { q: 'Does RQS claim ownership of my music?', a: 'See the Terms of Service for the current ownership and usage terms. This pricing page does not replace or restate the legal terms.', legal: 'terms' },
    { q: 'How are uploaded audio files handled?', a: 'See the Privacy Policy for the current audio-file handling and retention information. This pricing page intentionally avoids duplicating detailed retention rules.', legal: 'privacy' }
  ]
};

const PL_PRICING: PricingCopy = {
  eyebrow: 'PUBLICZNA BETA // PODGLĄD CEN PREMIEROWYCH', title: 'CENNIK DLA ARTYSTÓW NIEZALEŻNYCH.', subtitle: 'Zacznij za darmo. Przejdź na wyższy plan, gdy RQS Studio stanie się częścią Twojego workflow.', inactive: 'Płatne subskrypcje nie są jeszcze aktywne. Dołącz do listy oczekujących, aby otrzymać informację o uruchomieniu planów.', previewLabel: 'PLANOWANE CENY PREMIEROWE', monthly: '/ miesiąc', openStudio: 'OTWÓRZ RQS STUDIO', joinWaitlist: 'DOŁĄCZ DO LISTY', features: 'KIERUNEK FUNKCJI', proposedQuota: 'Proponowany limit', publicBeta: 'PUBLICZNA BETA', plannedAccess: 'PLANOWANY DOSTĘP W PŁATNYCH PLANACH', currentBetaAccess: 'OBECNY DOSTĘP W BETA', taxes: 'Podatki, jeśli będą miały zastosowanie, zostaną pokazane przed zakupem, gdy płatne plany staną się dostępne.', compareTitle: 'OBECNA BETA VS. PLANOWANY DOSTĘP', compareIntro: 'Dostęp w Public Beta pozostaje oddzielony od planowanego podziału funkcji w płatnych planach. Obecnie żadne płatne uprawnienia nie są aktywne.', feature: 'Funkcja', price: 'Cena', fullMasters: 'Pełne mastery', preview: 'Preview', ab: 'Porównanie A/B', setlist: 'Setlist Engine', uplink: 'RQS Uplink', stems: 'Separacja stemów', availableBeta: 'Dostępne podczas Public Beta', planned: 'planowane', waitlistTitle: 'OTRZYMAJ POWIADOMIENIE O PREMIERZE.', waitlistIntro: 'Skorzystaj z istniejącej listy oczekujących RQS, aby otrzymywać informacje o dostępności. Preferencja planu nie jest jeszcze zapisywana.', emailLabel: 'E-mail', emailPlaceholder: 'ty@example.com', sending: 'DODAWANIE...', waitlistSuccess: 'Jesteś na liście oczekujących na premierę RQS.', waitlistError: 'Nie udało się teraz dodać tego adresu e-mail do listy.', faqTitle: 'FAQ', freeTagline: 'Poznaj system.', masterTagline: 'Dokończ swoje utwory.', plusTagline: 'Zbuduj swój workflow.', proTagline: 'Korzystaj z pełnego Studio.', freeCurrentAccess: 'OBECNY DOSTĘP W BETA', freeItem1: 'Łącznie 3 pełne mastery', freeItem2: 'Preview: obecne działanie wersji beta', freeItem3: 'Porównanie A/B tam, gdzie jest obecnie obsługiwane', freeItem4: 'Setlist, Uplink i Stems dostępne podczas Public Beta', masterItem1: 'Workflow MASTER', masterItem2: 'Narzędzia masteringowe', masterItem3: 'Porównanie A/B tam, gdzie jest obecnie obsługiwane', plusItem1: 'Wszystko z MASTER', plusItem2: 'BUILD / Setlist Engine', plusItem3: 'DEPLOY / RQS Uplink', proItem1: 'Wszystko z PLUS', proItem2: 'SPLIT / Separacja stemów', proItem3: 'Workflow MASTER / SPLIT / BUILD / DEPLOY', independentArtists: 'DLA NIEZALEŻNYCH ARTYSTÓW', fullStudio: 'PEŁNE STUDIO', waitlistEyebrow: 'LISTA OCZEKUJĄCYCH // BEZ CHECKOUTU', infoEyebrow: 'RQS STUDIO // INFORMACJE',
  faq: [
    { q: 'Czy mogę korzystać z RQS Studio za darmo?', a: 'Tak. RQS Studio jest obecnie w Public Beta. Plan Free obejmuje aktualny limit masteringu w wersji beta, a kilka modułów Studio pozostaje dostępnych podczas testów.' },
    { q: 'Czy płatne subskrypcje są aktywne?', a: 'Nie. Płatne subskrypcje, checkout i komercyjne uprawnienia nie są aktywne. Płatne karty na tej stronie są wyłącznie podglądem cen premierowych.' },
    { q: 'Czy to są ostateczne ceny premierowe?', a: 'Nie. To planowane ceny premierowe i mogą się zmienić przed uruchomieniem płatnych planów.' },
    { q: 'Dlaczego ceny różnią się w zależności od waluty?', a: 'RQS Studio stosuje lokalne ceny dla obsługiwanych walut. Są to stałe, niezależne cenniki produktowe i nie zmieniają się automatycznie wraz z codziennymi kursami walut.' },
    { q: 'Czy zostaną doliczone podatki?', a: 'Podatki, jeśli będą miały zastosowanie, zostaną pokazane przed zakupem, gdy płatne plany staną się dostępne. Ten podgląd nie oblicza VAT, Stripe Tax ani podatków checkoutu.' },
    { q: 'Co się stanie po wykorzystaniu bezpłatnego limitu masteringu?', a: 'Aktualny limit wersji beta blokuje kolejne pełne mastery po wykorzystaniu bezpłatnej puli. Preview działa osobno, a na listę oczekujących można dołączyć, aby otrzymać informację o przyszłych płatnych planach.' },
    { q: 'Czy RQS przejmuje prawa do mojej muzyki?', a: 'Aktualne zasady dotyczące własności i korzystania z muzyki znajdują się w Warunkach korzystania. Ta strona cenowa ich nie zastępuje ani nie powiela.', legal: 'terms' },
    { q: 'Jak obsługiwane są przesłane pliki audio?', a: 'Aktualne informacje o obsłudze i retencji plików audio znajdują się w Polityce prywatności. Ta strona celowo nie powiela szczegółowych zasad retencji.', legal: 'privacy' }
  ]
};

const FR_PRICING: PricingCopy = {
  eyebrow: 'BÊTA PUBLIQUE // APERÇU DES TARIFS DE LANCEMENT', title: 'DES TARIFS PENSÉS POUR LES ARTISTES INDÉPENDANTS.', subtitle: 'Commencez gratuitement. Passez à un forfait supérieur lorsque RQS Studio devient partie intégrante de votre workflow.', inactive: 'Les abonnements payants ne sont pas encore actifs. Rejoignez la liste d’attente pour être informé de leur disponibilité.', previewLabel: 'TARIFS DE LANCEMENT PRÉVUS', monthly: '/ mois', openStudio: 'OUVRIR RQS STUDIO', joinWaitlist: 'REJOINDRE LA LISTE D’ATTENTE', features: 'ORIENTATION DES FONCTIONNALITÉS', proposedQuota: 'Quota proposé', publicBeta: 'BÊTA PUBLIQUE', plannedAccess: 'ACCÈS PRÉVU AUX FORFAITS PAYANTS', currentBetaAccess: 'ACCÈS ACTUEL EN BÊTA', taxes: 'Les taxes applicables, le cas échéant, seront indiquées avant l’achat lorsque les forfaits payants seront disponibles.', compareTitle: 'BÊTA ACTUELLE VS. ACCÈS PRÉVU', compareIntro: 'L’accès à la bêta publique reste distinct de l’offre prévue pour les forfaits payants. Aucun droit payant n’est actif aujourd’hui.', feature: 'Fonctionnalité', price: 'Prix', fullMasters: 'Masterings complets', preview: 'Preview', ab: 'Comparaison A/B', setlist: 'Setlist Engine', uplink: 'RQS Uplink', stems: 'Séparation des stems', availableBeta: 'Disponible pendant la bêta publique', planned: 'prévu', waitlistTitle: 'SOYEZ INFORMÉ DU LANCEMENT.', waitlistIntro: 'Utilisez la liste d’attente RQS existante pour recevoir les informations de disponibilité. La préférence de forfait n’est pas encore enregistrée.', emailLabel: 'E-mail', emailPlaceholder: 'vous@exemple.com', sending: 'INSCRIPTION...', waitlistSuccess: 'Vous êtes inscrit sur la liste d’attente de lancement de RQS.', waitlistError: 'Impossible d’ajouter cette adresse e-mail à la liste d’attente pour le moment.', faqTitle: 'FAQ', freeTagline: 'Explorez le système.', masterTagline: 'Finalisez vos morceaux.', plusTagline: 'Construisez votre workflow.', proTagline: 'Utilisez le Studio complet.', freeCurrentAccess: 'ACCÈS ACTUEL EN BÊTA', freeItem1: '3 masterings complets au total', freeItem2: 'Preview : comportement actuel de la bêta', freeItem3: 'Comparaison A/B là où elle est prise en charge', freeItem4: 'Setlist, Uplink et Stems disponibles pendant la bêta publique', masterItem1: 'Workflow MASTER', masterItem2: 'Outils de mastering', masterItem3: 'Comparaison A/B là où elle est prise en charge', plusItem1: 'Tout le forfait MASTER', plusItem2: 'BUILD / Setlist Engine', plusItem3: 'DEPLOY / RQS Uplink', proItem1: 'Tout le forfait PLUS', proItem2: 'SPLIT / Séparation des stems', proItem3: 'Workflow MASTER / SPLIT / BUILD / DEPLOY', independentArtists: 'POUR LES ARTISTES INDÉPENDANTS', fullStudio: 'STUDIO COMPLET', waitlistEyebrow: 'LISTE D’ATTENTE // SANS CHECKOUT', infoEyebrow: 'RQS STUDIO // INFORMATIONS',
  faq: [
    { q: 'Puis-je utiliser RQS Studio gratuitement ?', a: 'Oui. RQS Studio est actuellement en bêta publique. L’offre Free comprend le quota actuel de mastering de la bêta, tandis que plusieurs modules du Studio restent disponibles pendant les tests.' },
    { q: 'Les abonnements payants sont-ils actifs ?', a: 'Non. Les abonnements payants, le checkout et les droits commerciaux ne sont pas actifs. Les cartes payantes de cette page sont uniquement un aperçu des tarifs de lancement.' },
    { q: 'S’agit-il des tarifs définitifs de lancement ?', a: 'Non. Ce sont des tarifs prévus et ils peuvent encore changer avant la disponibilité des forfaits payants.' },
    { q: 'Pourquoi les prix diffèrent-ils selon la devise ?', a: 'RQS Studio utilise des tarifs localisés pour les devises prises en charge. Il s’agit de grilles tarifaires fixes et indépendantes, sans conversion automatique selon les taux de change quotidiens.' },
    { q: 'Des taxes supplémentaires seront-elles ajoutées ?', a: 'Les taxes applicables, le cas échéant, seront indiquées avant l’achat lorsque les forfaits payants seront disponibles. Cet aperçu ne calcule ni TVA, ni Stripe Tax, ni taxe de checkout.' },
    { q: 'Que se passe-t-il lorsque j’atteins la limite gratuite de mastering ?', a: 'La limite actuelle de la bêta bloque de nouveaux Full Masters après consommation du quota gratuit. Le fonctionnement du Preview est séparé et vous pouvez rejoindre la liste d’attente pour les futurs forfaits.' },
    { q: 'RQS revendique-t-il la propriété de ma musique ?', a: 'Consultez les Conditions d’utilisation pour les règles actuelles de propriété et d’usage. Cette page de tarifs ne remplace pas les dispositions juridiques.', legal: 'terms' },
    { q: 'Comment les fichiers audio envoyés sont-ils traités ?', a: 'Consultez la Politique de confidentialité pour les informations actuelles sur le traitement et la conservation des fichiers audio. Cette page évite de dupliquer les règles détaillées de conservation.', legal: 'privacy' }
  ]
};

export const PT_TRANSLATIONS = {
  LANDING_HERO_EYEBROW: 'CONSTRUÍDO PELA RAQUEL SYNTHS // BETA PÚBLICO', LANDING_HERO_TITLE: 'DO SINAL BRUTO AO ENVIO.', LANDING_HERO_SUB: 'Masterize. Separe stems. Construa sets. Envie sua música.', LANDING_CTA_OPEN: 'ABRIR RQS STUDIO', LANDING_CTA_EXPLORE: 'EXPLORAR RECURSOS', LANDING_HERO_NOTE: 'Ferramentas de produção musical desenvolvidas dentro de um projeto independente real.',
  LANDING_CAP_MASTERING: 'MASTERING', LANDING_CAP_STEMS: 'STEM SEPARATION', LANDING_CAP_SETLIST: 'SETLIST ENGINE', LANDING_CAP_UPLINK: 'RQS UPLINK', LANDING_CAP_NOTE: 'Ferramentas desenvolvidas dentro de um projeto musical real.',
  LANDING_MASTER_TAGLINE: 'Finalize a faixa.', LANDING_MASTER_DESC: 'Analise loudness, gere uma prévia e finalize a master dentro do workflow RQS DSP Core.', LANDING_MASTER_ITEM_1: 'Análise de loudness', LANDING_MASTER_ITEM_2: 'True Peak e telemetria', LANDING_MASTER_ITEM_3: 'Perfis acústicos', LANDING_MASTER_ITEM_4: 'Comparação A/B por prévia',
  LANDING_SPLIT_TAGLINE: 'Recupere as partes.', LANDING_SPLIT_DESC: 'Separe uma faixa em 6 stems para remix, análise e reconstrução criativa usando o fluxo de separação do Studio.',
  LANDING_BUILD_TAGLINE: 'Transforme faixas em um set.', LANDING_BUILD_DESC: 'Organize faixas, configure crossfades e renderize uma sessão contínua no RQS Setlist Engine.', LANDING_BUILD_ITEM_1: 'Organização de faixas', LANDING_BUILD_ITEM_2: 'Crossfades configuráveis', LANDING_BUILD_ITEM_3: 'Render contínuo em WAV',
  LANDING_DEPLOY_TAGLINE: 'Envie o sinal.', LANDING_DEPLOY_DESC: 'Cole o link da sua faixa no Spotify, SoundCloud, YouTube ou Bandcamp. O RQS Uplink Engine gera um link curto que tenta abrir o conteúdo no aplicativo oficial compatível e reduz a fricção de navegadores internos.',
  LANDING_ORIGIN_TITLE: 'CONSTRUÍDO DENTRO DA MÚSICA.', LANDING_ORIGIN_TAGLINE: 'Nós usamos as mesmas ferramentas.', LANDING_ORIGIN_DESC: 'O RQS Studio nasceu de ferramentas internas do workflow da RaQuel Synths — masterização, separação de stems, preparação de setlists e deep links musicais. Agora esse sistema está sendo aberto para outros criadores.', LANDING_ORIGIN_CTA: 'EXPLORAR RAQUEL SYNTHS',
  LANDING_PROOF_TITLE: 'OUÇA A DIFERENÇA.', LANDING_PROOF_DESC: 'A comparação pública A/B será adicionada somente com áudio real e métricas verificadas. Nenhum resultado fictício é usado como prova de produto.',
  LANDING_PRICING_TITLE: 'COMECE GRÁTIS.', LANDING_PRICING_DESC: 'A beta pública mantém acesso gratuito controlado enquanto o RQS PRO permanece em fase de lançamento.', LANDING_FREE_PRICE: 'BETA PÚBLICO', LANDING_FREE_ITEM_1: '3 masterizações completas', LANDING_FREE_ITEM_2: 'Até 3 Uplinks ativos', LANDING_FREE_ITEM_3: 'Acesso ao workspace principal', LANDING_FREE_CTA: 'COMEÇAR GRÁTIS',
  LANDING_PRO_DESC: 'O RQS PRO continua em preparação para o lançamento público. A prévia de preços e limites planejados já está disponível, mas nenhuma assinatura paga ou checkout está ativo.', LANDING_PRO_ITEM_1: 'Prévia de preços localizada em BRL, USD e PLN', LANDING_PRO_ITEM_2: 'Limites planejados de MASTER, SPLIT, BUILD e DEPLOY', LANDING_PRO_ITEM_3: 'Assinaturas pagas continuam desativadas durante o Public Beta', LANDING_PRO_STATUS: 'PRÉVIA DE LANÇAMENTO', LANDING_PRO_CTA: 'VER PREÇOS // PRÉVIA', PRICING: PT_PRICING,
  LANDING_FINAL_TITLE: 'SEU SINAL ESTÁ PRONTO.', LANDING_FINAL_DESC: 'Masterize. Separe. Construa. Envie.',
  HERO_TITLE: 'REESCREVA O CÓDIGO SÔNICO DAS SUAS MÚSICAS.', HERO_SUB: 'O RQS Studio é uma estação de trabalho inteligente em nuvem desenvolvida sob medida para produtores independentes, DJs e criadores de música por IA.', HERO_CTA: '[ 🎛️ ENTRAR NO MAINFRAME DE GRAÇA ]', HERO_NOTE: '*Teste suas 3 primeiras faixas com uma conta gratuita.', DSP_TITLE: 'DOMINE A ACÚSTICA DA INTELIGÊNCIA ARTIFICIAL', DSP_DESC: 'Músicas geradas por IA podem apresentar desafios de equilíbrio espectral e dinâmica. O RQS DSP Core oferece um fluxo controlado de preparação para entrega.', STEMS_TITLE: 'SETLIST ENGINE & SEPARADOR DE STEMS', STEMS_DESC: 'Extraia vocais, baterias e outros stems em arquivos separados e prepare seus fluxos de produção.',
  PRICE_BETA_BADGE: '[ BETA FINAL // VALIDAÇÃO DO SISTEMA ]', PRICE_TITLE: 'RQS PRO ESTÁ CHEGANDO.', PRICE_DESC: 'O RQS Studio está em fase final de testes de produção. As ferramentas principais já estão disponíveis para avaliação gratuita enquanto os planos pagos são preparados.', PRICE_CTA: '[ 💎 RQS PRO // EM BREVE ]',
  AB_PREVIEW_LOCK_NOTE: 'Gere uma prévia de 15s para habilitar a comparação A/B.', AB_PREVIEW_GENERATING: 'GERANDO PRÉVIA DA VERSÃO MASTER...', BTN_GENERATE_PREVIEW: '[ ⚡ GERAR PRÉVIA DE 15 SEGUNDOS ]', VOLUME_MATCH: 'Correspondência de Volume', ORIGINAL_LABEL: 'A - ORIGINAL', MASTER_LABEL: 'B - MASTER PREVIEW', FULL_MASTER_COMPLETED_ALERT: '💎 MASTERIZAÇÃO COMPLETA CONCLUÍDA! (CLIQUE EM DOWNLOAD ÁUDIO PARA LIBERAR O DECK)',
  SETLIST_ENGINE: 'RQS SETLIST ENGINE', MIX_DROP_PROMPT: 'Arraste suas faixas masterizadas aqui', MIX_OR_CLICK: 'ou clique para abrir a pasta', VALIDATION_TITLE: '🛡️ VALIDAÇÃO DE SETLIST & CONFORMIDADE', VALIDATION_MIN_TRACKS: '❌ Necessário pelo menos 2 faixas para gerar uma setlist.', VALIDATION_NAME_REQUIRED: '❌ O nome do arquivo de exportação é obrigatório.', VALIDATION_SR_MISMATCH: '⚠️ Taxas de amostragem diferentes detectadas. O reator fará o resample automático.', VALIDATION_BD_MISMATCH: '⚠️ Bit Depths inconsistentes detectados. A setlist será exportada uniformemente.', SUMMARY_TITLE: '📊 SUMÁRIO ESTIMADO DA SETLIST', SUMMARY_TRACKS: 'Faixas:', SUMMARY_TOTAL_SOURCE: 'Tempo Total de Fontes:', SUMMARY_TOTAL_FADE: 'Tempo Total de Crossfade:', SUMMARY_EST_OUTPUT: 'Saída Estimada:', SUMMARY_OUT_FORMAT: 'Formato de Saída:', SUMMARY_EST_SIZE: 'Tamanho Estimado:', LOUDNESS_MATCH_LABEL: '⚡ EQUALIZADOR DE LOUDNESS PERCEBIDO:', LOUDNESS_OFF: 'DESATIVADO', LOUDNESS_PERCEIVED: 'EQUILIBRAR PERCEBIDO (LUFS)', LOUDNESS_NORMALIZE: 'NORMALIZAR AO ALVO (-14 LUFS)', CROSSFADE_CURVE_LABEL: '🎚️ CURVA DE TRANSIÇÃO:', CURVE_EQUAL_POWER: 'EQUAL POWER (SUAVE)', CURVE_LINEAR: 'LINEAR (FADE DIRETO)', CURVE_FAST_CUT: 'FAST CUT (CORTE RÁPIDO)', PREVIEWING_TRANSITION: '🔁 REPRODUZINDO TRANSIÇÃO: FAIXA', TRACK_LABEL: 'FAIXA', BTN_STOP_PREVIEW: '■ PARAR PRÉVIA', TIMELINE_TITLE: 'LINHA DO TEMPO DA SETLIST', CROSSFADE_TO: 'FADE PARA', SECONDS: 'segundos', PREVIEW_ACTIVE: 'REPRODUZINDO...', BTN_PREVIEW_TRANSITION: 'OUVIR TRANSIÇÃO (PREVIEW)', DEPLOY_LABEL: 'NOME DO SETLIST MASTER (.WAV)', FFMPEG_PROCESSING: 'REATOR SÔNICO RQS OPERANDO AS TRANSIÇÕES... AGUARDE.', DEPLOY_COMPLETED: 'SETLIST EXPORTADA COM SUCESSO!', IGNITE_ACTIVE: 'RQS_DEPLOY_ATIVO...', IGNITE_LIMIT_ALERT: '🔒 RECURSO LIMITADO PELO PLANO', IGNITE_IDLE: '🔥 RENDER & DEPLOY SETLIST', SETLIST_HELPER_NOTE: 'Gera um único arquivo contínuo WAV com todas as transições e curvas configuradas.',
  SYNCING_WITH_S3_BUNKER: 'SINCRONIZANDO COM O BUNKER...', PROTECTED_IN_BUNKER: 'PROTEGIDO NO BUNKER', UPLINK_TITLE: '📡 RQS UPLINK ENGINE', UPLINK_STATUS: 'CONEXÃO ESTÁVEL', UPLINK_DESC: 'Roteie seus deploys de áudio com deep links inteligentes.', UPLINK_DETECTED: '⚡ NOVO DEPLOY DE ÁUDIO RECONHECIDO NO MAINFRAME', BTN_INSTANT_DEPLOY: '[ DEPLOY DE MARKETING INSTANTÂNEO ]', BTN_COMPILE_LINK: '[ COMPILAR LINK SEGURO ]', UPLINK_INPUT_PLACEHOLDER: 'URL DE DESTINO (SPOTIFY / YOUTUBE)...', DEPLOY_LABELURL: 'URL DE DESTINO', CUSTOM_SLUG_LABEL: 'SLUG CUSTOMIZADO', META_PIXEL_ID_LABEL: 'META PIXEL ID (OPCIONAL)', ANALYTICS_CLICKS: 'CLIQUES', ANALYTICS_CONVERSION: 'TAXA DE CONVERSÃO', ANALYTICS_PIXEL: 'STATUS DO PIXEL', PIXEL_ACTIVE: 'ATIVO', PIXEL_INACTIVE: 'INATIVO',
  uplinkTitle: 'RQS UPLINK ENGINE', uplinkBadge: 'DEEP LINK BYPASS ACTIVE: Acesso Direto', uplinkDesc: 'Cole o link da sua faixa no Spotify, SoundCloud ou YouTube. O motor gera um link curto inteligente que tenta abrir o conteúdo no aplicativo oficial compatível.', urlLabel: 'URL DA FAIXA (STREAMING)', slugLabel: 'SLUG PERSONALIZADO (OPCIONAL)', compileBtn: '[ COMPILAR DEEP LINK SEGURO ]', copyLink: 'Copiar Link', copiedLink: '✓ Copiado!', dashTitle: 'RQS UPLINK ANALYTICS & DEEP LINKS', activeLinks: 'Links Ativos', dashDesc: 'Gerencie seus deep links e acompanhe cliques e fontes de tráfego.', emptyLinks: 'Nenhum deep link compilado ainda. Use o Uplink Engine acima para gerar o seu primeiro link.', clicksLabel: 'Cliques', conversionLabel: 'Conversão', trafficSources: 'Fontes de Tráfego:', copyUrl: 'Copiar URL', deleteBtn: 'Excluir', UPLINK_LOGIN_REQUIRED: 'LOGIN_REQUIRED: Você precisa estar logado para criar deep links. Faça login para continuar.', UPLINK_LIMIT_REACHED: 'LIMIT_REACHED: O plano Free permite até 3 Deep Links ativos.', MASTER_LIMIT_REACHED: 'Limite gratuito atingido', PRO_WAITLIST_NOTE: 'Entre na lista de lançamento do RQS PRO e seja avisado quando o plano estiver disponível.', PRO_WAITLIST_CTA: '[ 🔔 ENTRAR NA LISTA DE LANÇAMENTO ]', PRO_WAITLIST_JOINING: '[ SINCRONIZANDO... ]', PRO_WAITLIST_SUCCESS: 'Você está na lista de lançamento do RQS PRO.', PRO_WAITLIST_ERROR: 'Não foi possível entrar na lista agora. Tente novamente.'
};

export const EN_TRANSLATIONS: typeof PT_TRANSLATIONS = {
  ...PT_TRANSLATIONS,
  LANDING_HERO_EYEBROW: 'BUILT BY RAQUEL SYNTHS // PUBLIC BETA', LANDING_HERO_TITLE: 'FROM RAW SIGNAL TO RELEASE.', LANDING_HERO_SUB: 'Master. Split stems. Build sets. Send your music.', LANDING_CTA_OPEN: 'OPEN RQS STUDIO', LANDING_CTA_EXPLORE: 'EXPLORE FEATURES', LANDING_HERO_NOTE: 'Music production tools built inside a real independent project.', LANDING_CAP_MASTERING: 'MASTERING', LANDING_CAP_STEMS: 'STEM SEPARATION', LANDING_CAP_SETLIST: 'SETLIST ENGINE', LANDING_CAP_UPLINK: 'RQS UPLINK', LANDING_CAP_NOTE: 'Tools built inside a real music project.', LANDING_MASTER_TAGLINE: 'Finish the track.', LANDING_MASTER_DESC: 'Analyze loudness, generate a preview and finish the master inside the RQS DSP Core workflow.', LANDING_MASTER_ITEM_1: 'Loudness analysis', LANDING_MASTER_ITEM_2: 'True Peak and telemetry', LANDING_MASTER_ITEM_3: 'Acoustic profiles', LANDING_MASTER_ITEM_4: 'Preview-based A/B comparison', LANDING_SPLIT_TAGLINE: 'Get the parts back.', LANDING_SPLIT_DESC: 'Separate a track into 6 stems for remixing, analysis and creative reconstruction using the Studio separation workflow.', LANDING_BUILD_TAGLINE: 'Turn tracks into a set.', LANDING_BUILD_DESC: 'Order tracks, configure crossfades and render a continuous session with the RQS Setlist Engine.', LANDING_BUILD_ITEM_1: 'Track ordering', LANDING_BUILD_ITEM_2: 'Configurable crossfades', LANDING_BUILD_ITEM_3: 'Continuous WAV render', LANDING_DEPLOY_TAGLINE: 'Send the signal.', LANDING_DEPLOY_DESC: 'Paste your track link from Spotify, SoundCloud, YouTube or Bandcamp. RQS Uplink Engine generates a short link that attempts to open the content in the compatible official app.', LANDING_ORIGIN_TITLE: 'BUILT IN THE MUSIC.', LANDING_ORIGIN_TAGLINE: 'We use the same tools.', LANDING_ORIGIN_DESC: 'RQS Studio began as internal tooling for the RaQuel Synths workflow — mastering, stem separation, setlist preparation and music deep links. Now the system is opening to other creators.', LANDING_ORIGIN_CTA: 'EXPLORE RAQUEL SYNTHS', LANDING_PROOF_TITLE: 'HEAR THE DIFFERENCE.', LANDING_PROOF_DESC: 'The public A/B comparison will be added only with real audio and verified metrics. No fictional result is used as product proof.', LANDING_PRICING_TITLE: 'START FREE.', LANDING_PRICING_DESC: 'The public beta keeps controlled free access while RQS PRO remains in its launch phase.', LANDING_FREE_PRICE: 'PUBLIC BETA', LANDING_FREE_ITEM_1: '3 full masterings', LANDING_FREE_ITEM_2: 'Up to 3 active Uplinks', LANDING_FREE_ITEM_3: 'Core workspace access', LANDING_FREE_CTA: 'START FREE', LANDING_PRO_DESC: 'RQS PRO is still being prepared for public launch. A preview of planned pricing and limits is available, but no paid subscription or checkout is active.', LANDING_PRO_ITEM_1: 'Localized pricing preview in BRL, USD and PLN', LANDING_PRO_ITEM_2: 'Planned limits across MASTER, SPLIT, BUILD and DEPLOY', LANDING_PRO_ITEM_3: 'Paid subscriptions remain disabled during Public Beta', LANDING_PRO_STATUS: 'LAUNCH PREVIEW', LANDING_PRO_CTA: 'VIEW PRICING // PREVIEW', PRICING: EN_PRICING, LANDING_FINAL_TITLE: 'YOUR SIGNAL IS READY.', LANDING_FINAL_DESC: 'Master. Split. Build. Send.', HERO_TITLE: 'REWRITE THE SONIC CODE OF YOUR MUSIC.', HERO_SUB: 'RQS Studio is an intelligent cloud workstation for independent producers, DJs, and generative AI creators.', HERO_CTA: '[ 🎛️ ENTER THE MAINFRAME FOR FREE ]', HERO_NOTE: '*Get 3 full masters with a free account during Public Beta.', DSP_TITLE: 'INTELLIGENT MASTERING AND DSP', DSP_DESC: 'RQS provides a controlled DSP workflow for preparing music for delivery.', STEMS_TITLE: 'SETLIST ENGINE & STEMS SPLITTER', STEMS_DESC: 'Extract vocals, drums and other stems into separate files and prepare your production workflow.', PRICE_BETA_BADGE: '[ FINAL BETA // SYSTEM VALIDATION ]', PRICE_TITLE: 'RQS PRO IS COMING.', PRICE_DESC: 'RQS Studio is undergoing final production testing. Core tools are available for free evaluation while paid plans are prepared.', PRICE_CTA: '[ 💎 RQS PRO // COMING SOON ]', AB_PREVIEW_LOCK_NOTE: 'Generate a 15s preview to enable A/B comparison.', AB_PREVIEW_GENERATING: 'GENERATING MASTER VERSION PREVIEW...', BTN_GENERATE_PREVIEW: '[ ⚡ GENERATE 15-SECOND PREVIEW ]', VOLUME_MATCH: 'Volume Match', ORIGINAL_LABEL: 'A - ORIGINAL', MASTER_LABEL: 'B - MASTER PREVIEW', FULL_MASTER_COMPLETED_ALERT: '💎 FULL MASTER COMPLETED!', SETLIST_ENGINE: 'RQS SETLIST ENGINE', MIX_DROP_PROMPT: 'Drag your mastered tracks here', MIX_OR_CLICK: 'or click to open the folder', VALIDATION_TITLE: '🛡️ SETLIST VALIDATION & COMPLIANCE', VALIDATION_MIN_TRACKS: '❌ At least 2 tracks are required to generate a setlist.', VALIDATION_NAME_REQUIRED: '❌ Export filename is required.', VALIDATION_SR_MISMATCH: '⚠️ Different sample rates detected. The engine will resample automatically.', VALIDATION_BD_MISMATCH: '⚠️ Inconsistent bit depths detected. Output will be standardized.', SUMMARY_TITLE: '📊 ESTIMATED SETLIST SUMMARY', SUMMARY_TRACKS: 'Tracks:', SUMMARY_TOTAL_SOURCE: 'Total Source Time:', SUMMARY_TOTAL_FADE: 'Total Crossfade:', SUMMARY_EST_OUTPUT: 'Estimated Output:', SUMMARY_OUT_FORMAT: 'Output Format:', SUMMARY_EST_SIZE: 'Estimated Size:', LOUDNESS_MATCH_LABEL: '⚡ PERCEIVED LOUDNESS EQUALIZER:', LOUDNESS_OFF: 'DISABLED', LOUDNESS_PERCEIVED: 'MATCH PERCEIVED LOUDNESS (LUFS)', LOUDNESS_NORMALIZE: 'NORMALIZE TO TARGET (-14 LUFS)', CROSSFADE_CURVE_LABEL: '🎚️ TRANSITION CURVE:', CURVE_EQUAL_POWER: 'EQUAL POWER (SMOOTH)', CURVE_LINEAR: 'LINEAR', CURVE_FAST_CUT: 'FAST CUT', PREVIEWING_TRANSITION: '🔁 PLAYING TRANSITION: TRACK', TRACK_LABEL: 'TRACK', BTN_STOP_PREVIEW: '■ STOP PREVIEW', TIMELINE_TITLE: 'SETLIST TIMELINE', CROSSFADE_TO: 'FADE TO', SECONDS: 'seconds', PREVIEW_ACTIVE: 'PLAYING...', BTN_PREVIEW_TRANSITION: 'HEAR TRANSITION (PREVIEW)', DEPLOY_LABEL: 'SETLIST MASTER FILENAME (.WAV)', FFMPEG_PROCESSING: 'RQS SONIC REACTOR PROCESSING TRANSITIONS... PLEASE WAIT.', DEPLOY_COMPLETED: 'SETLIST EXPORTED SUCCESSFULLY!', IGNITE_ACTIVE: 'RQS_DEPLOY_ACTIVE...', IGNITE_LIMIT_ALERT: '🔒 PLAN-LIMITED FEATURE', IGNITE_IDLE: '🔥 RENDER & DEPLOY SETLIST', SETLIST_HELPER_NOTE: 'Creates one continuous WAV file with all configured transitions and curves.', SYNCING_WITH_S3_BUNKER: 'SYNCING WITH BUNKER...', PROTECTED_IN_BUNKER: 'PROTECTED IN BUNKER', UPLINK_TITLE: '📡 RQS UPLINK ENGINE', UPLINK_STATUS: 'STABLE CONNECTION', UPLINK_DESC: 'Route your audio deploys with smart deep links.', UPLINK_DETECTED: '⚡ NEW AUDIO DEPLOY DETECTED IN MAINFRAME', BTN_INSTANT_DEPLOY: '[ INSTANT MARKETING DEPLOY ]', BTN_COMPILE_LINK: '[ COMPILE SECURE LINK ]', UPLINK_INPUT_PLACEHOLDER: 'DESTINATION URL (SPOTIFY / YOUTUBE)...', DEPLOY_LABELURL: 'DESTINATION URL', CUSTOM_SLUG_LABEL: 'CUSTOM SLUG', META_PIXEL_ID_LABEL: 'META PIXEL ID (OPTIONAL)', ANALYTICS_CLICKS: 'CLICKS', ANALYTICS_CONVERSION: 'CONVERSION RATE', ANALYTICS_PIXEL: 'PIXEL STATUS', PIXEL_ACTIVE: 'ACTIVE', PIXEL_INACTIVE: 'INACTIVE', uplinkTitle: 'RQS UPLINK ENGINE', uplinkBadge: 'DEEP LINK BYPASS ACTIVE: Direct Access', uplinkDesc: 'Paste your track link from Spotify, SoundCloud or YouTube. The engine generates a smart short link that attempts to open the content in the compatible official app.', urlLabel: 'TRACK URL (STREAMING)', slugLabel: 'CUSTOM SLUG (OPTIONAL)', compileBtn: '[ COMPILE SECURE DEEP LINK ]', copyLink: 'Copy Link', copiedLink: '✓ Copied!', dashTitle: 'RQS UPLINK ANALYTICS & DEEP LINKS', activeLinks: 'Active Links', dashDesc: 'Manage deep links and track clicks and traffic sources.', emptyLinks: 'No deep links compiled yet. Use the Uplink Engine above to generate your first link.', clicksLabel: 'Clicks', conversionLabel: 'Conversion', trafficSources: 'Traffic Sources:', copyUrl: 'Copy URL', deleteBtn: 'Delete', UPLINK_LOGIN_REQUIRED: 'LOGIN_REQUIRED: You must be signed in to create deep links.', UPLINK_LIMIT_REACHED: 'LIMIT_REACHED: The Free plan allows up to 3 active Deep Links.', MASTER_LIMIT_REACHED: 'Free limit reached', PRO_WAITLIST_NOTE: 'Join the RQS PRO launch list and get notified when the plan becomes available.', PRO_WAITLIST_CTA: '[ 🔔 JOIN THE LAUNCH LIST ]', PRO_WAITLIST_JOINING: '[ SYNCHRONIZING... ]', PRO_WAITLIST_SUCCESS: 'You are on the RQS PRO launch list.', PRO_WAITLIST_ERROR: 'Unable to join the list right now. Please try again.'
};

export const PL_TRANSLATIONS: typeof PT_TRANSLATIONS = {
  ...EN_TRANSLATIONS,
  LANDING_HERO_EYEBROW: 'ZBUDOWANE PRZEZ RAQUEL SYNTHS // PUBLICZNA BETA', LANDING_HERO_TITLE: 'OD SUROWEGO SYGNAŁU DO PREMIERY.', LANDING_HERO_SUB: 'Masteruj. Rozdziel stem-y. Zbuduj set. Wyślij swoją muzykę.', LANDING_CTA_OPEN: 'OTWÓRZ RQS STUDIO', LANDING_CTA_EXPLORE: 'POZNAJ FUNKCJE', LANDING_HERO_NOTE: 'Narzędzia produkcji muzycznej stworzone wewnątrz prawdziwego niezależnego projektu.', LANDING_CAP_STEMS: 'SEPARACJA STEMÓW', LANDING_CAP_NOTE: 'Narzędzia stworzone wewnątrz prawdziwego projektu muzycznego.', LANDING_MASTER_TAGLINE: 'Dokończ utwór.', LANDING_MASTER_DESC: 'Przeanalizuj głośność, wygeneruj podgląd i przygotuj finalny master w workflow RQS DSP Core.', LANDING_MASTER_ITEM_1: 'Analiza głośności', LANDING_MASTER_ITEM_2: 'True Peak i telemetria', LANDING_MASTER_ITEM_3: 'Profile akustyczne', LANDING_MASTER_ITEM_4: 'Porównanie A/B na podstawie podglądu', LANDING_SPLIT_TAGLINE: 'Odzyskaj elementy.', LANDING_SPLIT_DESC: 'Rozdziel utwór na 6 stemów do remiksu, analizy i kreatywnej rekonstrukcji.', LANDING_BUILD_TAGLINE: 'Zamień utwory w set.', LANDING_BUILD_DESC: 'Ułóż utwory, skonfiguruj crossfady i wyrenderuj ciągłą sesję w RQS Setlist Engine.', LANDING_BUILD_ITEM_1: 'Układanie utworów', LANDING_BUILD_ITEM_2: 'Konfigurowalne crossfady', LANDING_BUILD_ITEM_3: 'Ciągły render WAV', LANDING_DEPLOY_TAGLINE: 'Wyślij sygnał.', LANDING_DEPLOY_DESC: 'Wklej link do utworu ze Spotify, SoundCloud, YouTube lub Bandcamp. RQS Uplink Engine tworzy krótki link otwierający zgodną oficjalną aplikację.', LANDING_ORIGIN_TITLE: 'ZBUDOWANE WEWNĄTRZ MUZYKI.', LANDING_ORIGIN_TAGLINE: 'Używamy tych samych narzędzi.', LANDING_ORIGIN_DESC: 'RQS Studio powstało jako wewnętrzne narzędzia workflow RaQuel Synths — do masteringu, separacji stemów, przygotowania setlist i muzycznych deep linków. Teraz system otwiera się na innych twórców.', LANDING_ORIGIN_CTA: 'ODKRYJ RAQUEL SYNTHS', LANDING_PROOF_TITLE: 'USŁYSZ RÓŻNICĘ.', LANDING_PROOF_DESC: 'Publiczne porównanie A/B zostanie dodane wyłącznie z prawdziwym audio i zweryfikowanymi metrykami.', LANDING_PRICING_TITLE: 'ZACZNIJ ZA DARMO.', LANDING_PRICING_DESC: 'Publiczna beta zapewnia kontrolowany bezpłatny dostęp, podczas gdy RQS PRO jest przygotowywany do premiery.', LANDING_FREE_PRICE: 'PUBLICZNA BETA', LANDING_FREE_ITEM_1: '3 pełne mastery', LANDING_FREE_ITEM_2: 'Do 3 aktywnych Uplinków', LANDING_FREE_ITEM_3: 'Dostęp do głównego workspace', LANDING_FREE_CTA: 'ZACZNIJ ZA DARMO', LANDING_PRO_DESC: 'RQS PRO jest przygotowywany do publicznej premiery. Podgląd planowanych cen i limitów jest dostępny, ale płatne subskrypcje i checkout pozostają wyłączone.', LANDING_PRO_ITEM_1: 'Lokalny podgląd cen w BRL, USD i PLN', LANDING_PRO_ITEM_2: 'Planowane limity dla MASTER, SPLIT, BUILD i DEPLOY', LANDING_PRO_ITEM_3: 'Płatne subskrypcje pozostają wyłączone podczas Public Beta', LANDING_PRO_STATUS: 'PODGLĄD PREMIERY', LANDING_PRO_CTA: 'ZOBACZ CENY // PODGLĄD', PRICING: PL_PRICING, LANDING_FINAL_TITLE: 'TWÓJ SYGNAŁ JEST GOTOWY.', LANDING_FINAL_DESC: 'Masteruj. Rozdziel. Zbuduj. Wyślij.', HERO_TITLE: 'NADAJ SWOJEJ MUZYCE GOTOWE BRZMIENIE.', HERO_SUB: 'RQS Studio to inteligentne narzędzia masteringu, setlist i DSP dla producentów, DJ-ów i twórców muzyki generowanej przez AI.', HERO_CTA: '[ 🎛️ WEJDŹ DO RQS STUDIO ]', HERO_NOTE: '*W Public Beta otrzymujesz 3 pełne mastery z bezpłatnym kontem.', DSP_TITLE: 'INTELIGENTNY MASTERING I DSP', DSP_DESC: 'RQS oferuje kontrolowany workflow DSP do przygotowania muzyki do publikacji.', STEMS_TITLE: 'SETLIST ENGINE I SEPARACJA STEMÓW', STEMS_DESC: 'Wydziel wokal, perkusję i pozostałe stem-y oraz przygotuj workflow produkcyjny.', PRICE_BETA_BADGE: '[ FINAL BETA // WALIDACJA SYSTEMU ]', PRICE_TITLE: 'RQS PRO JUŻ WKRÓTCE.', PRICE_DESC: 'RQS Studio przechodzi końcowe testy produkcyjne. Główne narzędzia są dostępne bezpłatnie do testów, a płatne plany są przygotowywane.', PRICE_CTA: '[ 💎 RQS PRO // WKRÓTCE ]', AB_PREVIEW_LOCK_NOTE: 'Wygeneruj 15-sekundowy podgląd, aby włączyć porównanie A/B.', AB_PREVIEW_GENERATING: 'GENEROWANIE PODGLĄDU MASTERU...', BTN_GENERATE_PREVIEW: '[ ⚡ GENERUJ PODGLĄD 15 S ]', VOLUME_MATCH: 'Wyrównanie głośności', ORIGINAL_LABEL: 'A - ORYGINAŁ', MASTER_LABEL: 'B - PODGLĄD MASTERU', FULL_MASTER_COMPLETED_ALERT: '💎 PEŁNY MASTER GOTOWY!', SETLIST_ENGINE: 'RQS SETLIST ENGINE', MIX_DROP_PROMPT: 'Przeciągnij tutaj zmasterowane utwory', MIX_OR_CLICK: 'lub kliknij, aby otworzyć folder', VALIDATION_TITLE: '🛡️ WALIDACJA SETLISTY', VALIDATION_MIN_TRACKS: '❌ Potrzebne są co najmniej 2 utwory.', VALIDATION_NAME_REQUIRED: '❌ Podaj nazwę pliku wynikowego.', VALIDATION_SR_MISMATCH: '⚠️ Wykryto różne sample rate. Silnik wykona resampling.', VALIDATION_BD_MISMATCH: '⚠️ Wykryto różne bit depth. Wyjście zostanie ujednolicone.', SUMMARY_TITLE: '📊 PODSUMOWANIE SETLISTY', SUMMARY_TRACKS: 'Utwory:', SUMMARY_TOTAL_SOURCE: 'Łączny czas źródeł:', SUMMARY_TOTAL_FADE: 'Łączny crossfade:', SUMMARY_EST_OUTPUT: 'Szacowane wyjście:', SUMMARY_OUT_FORMAT: 'Format wyjściowy:', SUMMARY_EST_SIZE: 'Szacowany rozmiar:', LOUDNESS_MATCH_LABEL: '⚡ WYRÓWNANIE ODCZUWALNEJ GŁOŚNOŚCI:', LOUDNESS_OFF: 'WYŁĄCZONE', LOUDNESS_PERCEIVED: 'WYRÓWNAJ GŁOŚNOŚĆ (LUFS)', LOUDNESS_NORMALIZE: 'NORMALIZUJ DO -14 LUFS', CROSSFADE_CURVE_LABEL: '🎚️ KRZYWA PRZEJŚCIA:', CURVE_EQUAL_POWER: 'EQUAL POWER (ŁAGODNIE)', CURVE_LINEAR: 'LINEARNA', CURVE_FAST_CUT: 'FAST CUT', PREVIEWING_TRANSITION: '🔁 ODSŁUCH PRZEJŚCIA: UTWÓR', TRACK_LABEL: 'UTWÓR', BTN_STOP_PREVIEW: '■ ZATRZYMAJ', TIMELINE_TITLE: 'OŚ CZASU SETLISTY', CROSSFADE_TO: 'PRZEJŚCIE DO', SECONDS: 'sekund', PREVIEW_ACTIVE: 'ODTWARZANIE...', BTN_PREVIEW_TRANSITION: 'ODSŁUCHAJ PRZEJŚCIE', DEPLOY_LABEL: 'NAZWA PLIKU SETLIST MASTER (.WAV)', FFMPEG_PROCESSING: 'RQS RENDERUJE PRZEJŚCIA... PROSZĘ CZEKAĆ.', DEPLOY_COMPLETED: 'SETLISTA WYEKSPORTOWANA!', IGNITE_ACTIVE: 'RENDEROWANIE...', IGNITE_LIMIT_ALERT: '🔒 FUNKCJA OGRANICZONA PLANEM', IGNITE_IDLE: '🔥 RENDERUJ SETLISTĘ', SETLIST_HELPER_NOTE: 'Tworzy jeden ciągły plik WAV z ustawionymi przejściami.', SYNCING_WITH_S3_BUNKER: 'SYNCHRONIZACJA...', PROTECTED_IN_BUNKER: 'ZABEZPIECZONE', UPLINK_TITLE: '📡 RQS UPLINK ENGINE', UPLINK_STATUS: 'POŁĄCZENIE STABILNE', UPLINK_DESC: 'Twórz deep linki do platform streamingowych.', UPLINK_DETECTED: '⚡ WYKRYTO NOWY PLIK AUDIO', BTN_INSTANT_DEPLOY: '[ SZYBKI DEPLOY MARKETINGOWY ]', BTN_COMPILE_LINK: '[ UTWÓRZ BEZPIECZNY LINK ]', UPLINK_INPUT_PLACEHOLDER: 'URL DO SPOTIFY / YOUTUBE...', DEPLOY_LABELURL: 'URL DOCELOWY', CUSTOM_SLUG_LABEL: 'WŁASNY SLUG', META_PIXEL_ID_LABEL: 'META PIXEL ID (OPCJONALNIE)', ANALYTICS_CLICKS: 'KLIKNIĘCIA', ANALYTICS_CONVERSION: 'KONWERSJA', ANALYTICS_PIXEL: 'STATUS PIXELA', PIXEL_ACTIVE: 'AKTYWNY', PIXEL_INACTIVE: 'NIEAKTYWNY', uplinkTitle: 'RQS UPLINK ENGINE', uplinkBadge: 'DEEP LINK ACTIVE', uplinkDesc: 'Wklej adres utworu, aby wygenerować deep link.', urlLabel: 'URL UTWORU', slugLabel: 'WŁASNY SLUG (OPCJONALNIE)', compileBtn: '[ UTWÓRZ DEEP LINK ]', copyLink: 'Kopiuj link', copiedLink: '✓ Skopiowano!', dashTitle: 'RQS UPLINK ANALYTICS', activeLinks: 'Aktywne linki', dashDesc: 'Zarządzaj linkami i statystykami.', emptyLinks: 'Brak utworzonych linków.', clicksLabel: 'Kliknięcia', conversionLabel: 'Konwersja', trafficSources: 'Źródła ruchu:', copyUrl: 'Kopiuj URL', deleteBtn: 'Usuń', UPLINK_LOGIN_REQUIRED: 'LOGIN_REQUIRED: Musisz być zalogowany, aby tworzyć deep linki.', UPLINK_LIMIT_REACHED: 'LIMIT_REACHED: Plan Free pozwala na maksymalnie 3 aktywne Deep Linki.', MASTER_LIMIT_REACHED: 'Osiągnięto bezpłatny limit', PRO_WAITLIST_NOTE: 'Dołącz do listy startowej RQS PRO i otrzymaj powiadomienie, gdy plan będzie dostępny.', PRO_WAITLIST_CTA: '[ 🔔 DOŁĄCZ DO LISTY STARTOWEJ ]', PRO_WAITLIST_JOINING: '[ SYNCHRONIZACJA... ]', PRO_WAITLIST_SUCCESS: 'Jesteś na liście startowej RQS PRO.', PRO_WAITLIST_ERROR: 'Nie udało się teraz dołączyć do listy. Spróbuj ponownie.'
};

export const FR_TRANSLATIONS: typeof PT_TRANSLATIONS = {
  ...EN_TRANSLATIONS,
  LANDING_HERO_EYEBROW: 'CRÉÉ PAR RAQUEL SYNTHS // BÊTA PUBLIQUE', LANDING_HERO_TITLE: 'DU SIGNAL BRUT À LA DIFFUSION.', LANDING_HERO_SUB: 'Masterisez. Séparez les stems. Construisez vos sets. Diffusez votre musique.', LANDING_CTA_OPEN: 'OUVRIR RQS STUDIO', LANDING_CTA_EXPLORE: 'DÉCOUVRIR LES FONCTIONNALITÉS', LANDING_HERO_NOTE: 'Des outils de production musicale créés au sein d’un véritable projet indépendant.', LANDING_CAP_MASTERING: 'MASTERING', LANDING_CAP_STEMS: 'SÉPARATION DES STEMS', LANDING_CAP_SETLIST: 'SETLIST ENGINE', LANDING_CAP_UPLINK: 'RQS UPLINK', LANDING_CAP_NOTE: 'Des outils développés au cœur d’un véritable projet musical.', LANDING_MASTER_TAGLINE: 'Finalisez le morceau.', LANDING_MASTER_DESC: 'Analysez le loudness, générez un Preview et finalisez le master dans le workflow RQS DSP Core.', LANDING_MASTER_ITEM_1: 'Analyse du loudness', LANDING_MASTER_ITEM_2: 'True Peak et télémétrie', LANDING_MASTER_ITEM_3: 'Profils acoustiques', LANDING_MASTER_ITEM_4: 'Comparaison A/B basée sur le Preview', LANDING_SPLIT_TAGLINE: 'Récupérez les éléments.', LANDING_SPLIT_DESC: 'Séparez un morceau en 6 stems pour le remix, l’analyse et la reconstruction créative.', LANDING_BUILD_TAGLINE: 'Transformez vos morceaux en set.', LANDING_BUILD_DESC: 'Organisez les morceaux, configurez les crossfades et rendez une session continue avec RQS Setlist Engine.', LANDING_BUILD_ITEM_1: 'Organisation des morceaux', LANDING_BUILD_ITEM_2: 'Crossfades configurables', LANDING_BUILD_ITEM_3: 'Rendu WAV continu', LANDING_DEPLOY_TAGLINE: 'Envoyez le signal.', LANDING_DEPLOY_DESC: 'Collez le lien de votre morceau depuis Spotify, SoundCloud, YouTube ou Bandcamp. RQS Uplink Engine génère un lien court qui tente d’ouvrir le contenu dans l’application officielle compatible.', LANDING_ORIGIN_TITLE: 'CRÉÉ DANS LA MUSIQUE.', LANDING_ORIGIN_TAGLINE: 'Nous utilisons les mêmes outils.', LANDING_ORIGIN_DESC: 'RQS Studio est né comme ensemble d’outils internes du workflow RaQuel Synths — mastering, séparation des stems, préparation de setlists et deep links musicaux. Le système s’ouvre maintenant à d’autres créateurs.', LANDING_ORIGIN_CTA: 'DÉCOUVRIR RAQUEL SYNTHS', LANDING_PROOF_TITLE: 'ENTENDEZ LA DIFFÉRENCE.', LANDING_PROOF_DESC: 'La comparaison A/B publique ne sera ajoutée qu’avec de l’audio réel et des métriques vérifiées. Aucun résultat fictif n’est utilisé comme preuve produit.', LANDING_PRICING_TITLE: 'COMMENCEZ GRATUITEMENT.', LANDING_PRICING_DESC: 'La bêta publique maintient un accès gratuit contrôlé pendant la préparation de RQS PRO.', LANDING_FREE_PRICE: 'BÊTA PUBLIQUE', LANDING_FREE_ITEM_1: '3 masterings complets', LANDING_FREE_ITEM_2: 'Jusqu’à 3 Uplinks actifs', LANDING_FREE_ITEM_3: 'Accès au workspace principal', LANDING_FREE_CTA: 'COMMENCER GRATUITEMENT', LANDING_PRO_DESC: 'RQS PRO est toujours en préparation pour son lancement public. Un aperçu des tarifs et limites prévus est disponible, mais aucun abonnement payant ni checkout n’est actif.', LANDING_PRO_ITEM_1: 'Aperçu des tarifs localisés en BRL, USD et PLN', LANDING_PRO_ITEM_2: 'Limites prévues pour MASTER, SPLIT, BUILD et DEPLOY', LANDING_PRO_ITEM_3: 'Les abonnements payants restent désactivés pendant la bêta publique', LANDING_PRO_STATUS: 'APERÇU DU LANCEMENT', LANDING_PRO_CTA: 'VOIR LES TARIFS // APERÇU', PRICING: FR_PRICING, LANDING_FINAL_TITLE: 'VOTRE SIGNAL EST PRÊT.', LANDING_FINAL_DESC: 'Masterisez. Séparez. Construisez. Diffusez.', HERO_TITLE: 'RÉÉCRIVEZ LE CODE SONORE DE VOTRE MUSIQUE.', HERO_SUB: 'RQS Studio est une station de travail intelligente pour les producteurs indépendants, DJ et créateurs de musique générative.', HERO_CTA: '[ 🎛️ ENTRER GRATUITEMENT DANS LE MAINFRAME ]', HERO_NOTE: '*Recevez 3 masterings complets avec un compte gratuit pendant la bêta publique.', DSP_TITLE: 'MASTERING INTELLIGENT ET DSP', DSP_DESC: 'RQS propose un workflow DSP contrôlé pour préparer la musique à la diffusion.', STEMS_TITLE: 'SETLIST ENGINE & SÉPARATION DES STEMS', STEMS_DESC: 'Séparez les voix, batteries et autres stems, puis préparez votre workflow de production.', PRICE_BETA_BADGE: '[ FINAL BETA // VALIDATION DU SYSTÈME ]', PRICE_TITLE: 'RQS PRO ARRIVE.', PRICE_DESC: 'RQS Studio passe ses derniers tests de production. Les outils principaux sont disponibles gratuitement à l’évaluation pendant la préparation des forfaits payants.', PRICE_CTA: '[ 💎 RQS PRO // BIENTÔT ]', AB_PREVIEW_LOCK_NOTE: 'Générez un Preview de 15 s pour activer la comparaison A/B.', AB_PREVIEW_GENERATING: 'GÉNÉRATION DU PREVIEW MASTER...', BTN_GENERATE_PREVIEW: '[ ⚡ GÉNÉRER UN PREVIEW DE 15 SECONDES ]', VOLUME_MATCH: 'Volume Match', ORIGINAL_LABEL: 'A - ORIGINAL', MASTER_LABEL: 'B - PREVIEW MASTER', FULL_MASTER_COMPLETED_ALERT: '💎 MASTER COMPLET TERMINÉ !', SETLIST_ENGINE: 'RQS SETLIST ENGINE', MIX_DROP_PROMPT: 'Glissez vos morceaux masterisés ici', MIX_OR_CLICK: 'ou cliquez pour ouvrir le dossier', VALIDATION_TITLE: '🛡️ VALIDATION DE LA SETLIST', VALIDATION_MIN_TRACKS: '❌ Au moins 2 morceaux sont nécessaires pour générer une setlist.', VALIDATION_NAME_REQUIRED: '❌ Le nom du fichier d’export est obligatoire.', VALIDATION_SR_MISMATCH: '⚠️ Des fréquences d’échantillonnage différentes ont été détectées. Le moteur effectuera le resampling.', VALIDATION_BD_MISMATCH: '⚠️ Des profondeurs de bits différentes ont été détectées. La sortie sera uniformisée.', SUMMARY_TITLE: '📊 RÉSUMÉ ESTIMÉ DE LA SETLIST', SUMMARY_TRACKS: 'Morceaux :', SUMMARY_TOTAL_SOURCE: 'Durée totale des sources :', SUMMARY_TOTAL_FADE: 'Crossfade total :', SUMMARY_EST_OUTPUT: 'Sortie estimée :', SUMMARY_OUT_FORMAT: 'Format de sortie :', SUMMARY_EST_SIZE: 'Taille estimée :', LOUDNESS_MATCH_LABEL: '⚡ ÉGALISATION DU LOUDNESS PERÇU :', LOUDNESS_OFF: 'DÉSACTIVÉE', LOUDNESS_PERCEIVED: 'ÉGALISER LE LOUDNESS PERÇU (LUFS)', LOUDNESS_NORMALIZE: 'NORMALISER À LA CIBLE (-14 LUFS)', CROSSFADE_CURVE_LABEL: '🎚️ COURBE DE TRANSITION :', CURVE_EQUAL_POWER: 'EQUAL POWER (DOUX)', CURVE_LINEAR: 'LINÉAIRE', CURVE_FAST_CUT: 'FAST CUT', PREVIEWING_TRANSITION: '🔁 LECTURE DE LA TRANSITION : MORCEAU', TRACK_LABEL: 'MORCEAU', BTN_STOP_PREVIEW: '■ ARRÊTER LE PREVIEW', TIMELINE_TITLE: 'TIMELINE DE LA SETLIST', CROSSFADE_TO: 'TRANSITION VERS', SECONDS: 'secondes', PREVIEW_ACTIVE: 'LECTURE...', BTN_PREVIEW_TRANSITION: 'ÉCOUTER LA TRANSITION', DEPLOY_LABEL: 'NOM DU FICHIER SETLIST MASTER (.WAV)', FFMPEG_PROCESSING: 'RQS REND LES TRANSITIONS... VEUILLEZ PATIENTER.', DEPLOY_COMPLETED: 'SETLIST EXPORTÉE AVEC SUCCÈS !', IGNITE_ACTIVE: 'RENDU EN COURS...', IGNITE_LIMIT_ALERT: '🔒 FONCTIONNALITÉ LIMITÉE PAR LE FORFAIT', IGNITE_IDLE: '🔥 RENDRE LA SETLIST', SETLIST_HELPER_NOTE: 'Crée un fichier WAV continu avec toutes les transitions configurées.', SYNCING_WITH_S3_BUNKER: 'SYNCHRONISATION...', PROTECTED_IN_BUNKER: 'PROTÉGÉ', UPLINK_TITLE: '📡 RQS UPLINK ENGINE', UPLINK_STATUS: 'CONNEXION STABLE', UPLINK_DESC: 'Créez des deep links pour les plateformes de streaming.', UPLINK_DETECTED: '⚡ NOUVEAU DÉPLOIEMENT AUDIO DÉTECTÉ', BTN_INSTANT_DEPLOY: '[ DÉPLOIEMENT MARKETING RAPIDE ]', BTN_COMPILE_LINK: '[ CRÉER UN LIEN SÉCURISÉ ]', UPLINK_INPUT_PLACEHOLDER: 'URL SPOTIFY / YOUTUBE...', DEPLOY_LABELURL: 'URL DE DESTINATION', CUSTOM_SLUG_LABEL: 'SLUG PERSONNALISÉ', META_PIXEL_ID_LABEL: 'META PIXEL ID (OPTIONNEL)', ANALYTICS_CLICKS: 'CLICS', ANALYTICS_CONVERSION: 'CONVERSION', ANALYTICS_PIXEL: 'STATUT DU PIXEL', PIXEL_ACTIVE: 'ACTIF', PIXEL_INACTIVE: 'INACTIF', uplinkTitle: 'RQS UPLINK ENGINE', uplinkBadge: 'DEEP LINK ACTIF', uplinkDesc: 'Collez l’adresse de votre morceau pour générer un deep link.', urlLabel: 'URL DU MORCEAU', slugLabel: 'SLUG PERSONNALISÉ (OPTIONNEL)', compileBtn: '[ CRÉER LE DEEP LINK ]', copyLink: 'Copier le lien', copiedLink: '✓ Copié !', dashTitle: 'RQS UPLINK ANALYTICS', activeLinks: 'Liens actifs', dashDesc: 'Gérez vos liens et leurs statistiques.', emptyLinks: 'Aucun deep link créé pour le moment.', clicksLabel: 'Clics', conversionLabel: 'Conversion', trafficSources: 'Sources de trafic :', copyUrl: 'Copier l’URL', deleteBtn: 'Supprimer', UPLINK_LOGIN_REQUIRED: 'LOGIN_REQUIRED : Vous devez être connecté pour créer des deep links.', UPLINK_LIMIT_REACHED: 'LIMIT_REACHED : Le forfait Free autorise jusqu’à 3 Deep Links actifs.', MASTER_LIMIT_REACHED: 'Limite gratuite atteinte', PRO_WAITLIST_NOTE: 'Rejoignez la liste de lancement RQS PRO et soyez informé lorsque le forfait sera disponible.', PRO_WAITLIST_CTA: '[ 🔔 REJOINDRE LA LISTE DE LANCEMENT ]', PRO_WAITLIST_JOINING: '[ SYNCHRONISATION... ]', PRO_WAITLIST_SUCCESS: 'Vous êtes inscrit sur la liste de lancement RQS PRO.', PRO_WAITLIST_ERROR: 'Impossible de rejoindre la liste pour le moment. Réessayez.'
};

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly currentLang = signal<UiLanguage>('en');

  readonly t = computed(() => {
    if (this.currentLang() === 'pt') return PT_DICT;
    if (this.currentLang() === 'pl') return PL_DICT;
    if (this.currentLang() === 'fr') return FR_DICT;
    return EN_DICT;
  });

  readonly tr = computed(() => {
    if (this.currentLang() === 'pt') return PT_TRANSLATIONS;
    if (this.currentLang() === 'pl') return PL_TRANSLATIONS;
    if (this.currentLang() === 'fr') return FR_TRANSLATIONS;
    return EN_TRANSLATIONS;
  });

  constructor() {
    this.detectLanguage();
  }

  setLanguage(lang: UiLanguage): void {
    this.currentLang.set(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rqs_language', lang);
    }
  }

  private detectLanguage(): void {
    if (typeof window === 'undefined') return;

    const stored = window.localStorage.getItem('rqs_language');
    if (stored === 'en' || stored === 'pt' || stored === 'pl' || stored === 'fr') {
      this.currentLang.set(stored);
      return;
    }

    this.currentLang.set('en');
  }
}
