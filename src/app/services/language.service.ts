import { Injectable, signal, computed } from '@angular/core';

// 🇧🇷 Dicionário de Tradução: Português
export const PT_DICT = {
  RQS_DSP_CORE: "RQS DSP CORE",
  SUBTITLE: "Arraste a faixa para homologação acústica",
  DROP_PROMPT: "Solte o arquivo .WAV aqui",
  OR_CLICK: "ou clique para buscar no sistema",
  FILE_INTERCEPTED: "interceptado.",
  EXTRACT_STEMS: "🧬 EXTRAIR 6 STEMS (ISOLAMENTO MULTI-PISTA)",
  DISSECTING: "🧬 IA Demucs está dissecando a matriz acústica em 6 canais... (Pode demorar alguns minutos. Não feche a aba!)",
  REACTOR_PROCESSING: "⚙️ RQS Reator processando telemetria... Aguarde.",
  MASTER_COMPLETED: "✅ Masterização concluída! [Download áudio]",
  EJECT_DECK: "⏏️ EJETAR FAIXA E LIMPAR DECK",
  SYNCHRONIZING: "⚡ Sincronizando matriz de áudio com o Bunker... Aguarde.",

    // 🟢 NOVO: Chaves auxiliares do painel de Stems sempre visível [1]
  DISSECTING_MINI: "🧬 EXTRAINDO...",
  UPLOAD_FIRST_STEMS: "Carregue uma faixa para liberar o isolamento de Stems",

  // Mastering Panel
  ORIGINAL: "Original",
  MASTER: "Master",
  VOLUME_MATCH: "Volume Match (Em construção 🔧)",
  PERFIL_ACUSTICO: "Perfil Acústico (Powered by RQS DSP)",
  INTENSIDADE_MASTER: "Intensidade da Masterização (Dynamic Control)",

  // Profiles
  THUNDER: "🌩️ Thunder",
  CLEAR_SKY: "☁️ Clear Sky",
  SUNROOF: "☀️ Sunroof",
  AURORA: "🌌 Aurora",

  // Intensities
  BAIXA: "🟢 Baixa (Dinâmica)",
  MEDIA: "🟡 Média (Equilibrada)",
  ALTA: "🔴 Alta (Competitiva)",

  // Buttons
  HEAR_TEST: "🎧 OUVIR TESTE (15s)",
  MASTER_FULL: "🔥 MASTERIZAR FAIXA COMPLETA",
  ANALYZING: "Analisando...",
  PROCESSING_ACUSTICO: "Processando IA Acústica...",

  // 🎛️ NOVAS CHAVES: Mix Panel (Setlist Engine) [1.1]
  SETLIST_ENGINE: "🎛️ RQS Setlist Engine",
  MIX_DROP_PROMPT: "Arraste suas faixas masterizadas aqui",
  MIX_OR_CLICK: "ou clique para abrir a pasta",
  TIMELINE_TITLE: "Linha do Tempo",
  TRACKS_COUNT: "faixas",
  CROSSFADE_TO: "↳ Crossfade em direção à Faixa",
  SECONDS: "segundos",
  DEPLOY_LABEL: "Nomenclatura do Deploy (.WAV):",
  FFMPEG_PROCESSING: "⚙️ RQS Motor FFmpeg costurando o crossfade... Aguarde.",
  DEPLOY_COMPLETED: "✅ Deploy Concluído! O download da Setlist iniciou automaticamente.",
  IGNITE_IDLE: "🔥 INICIAR DEPLOY DA SETLIST",
  IGNITE_ACTIVE: "🔥 RENDERIZANDO MATRIZ...",

  // 📟 NOVAS CHAVES: EKG Monitor [1.1]
  EKG_MONITOR_TITLE: "📟 MONITORAMENTO DE EKG ACÚSTICO",
  SIGNAL_ACTIVE: "SINAL DE ÁUDIO ATIVO",
  FREQUENCY_SPECTRUM: "Análise de Espectro de Frequência",
  PHASE_CORRELATION: "Correlação de Fase & Imagem Estéreo",

  LIMIT_EXCEEDED_ALERT: "Limite de masterizações gratuitas esgotado (3 de 3 consumidas). Faça o upgrade para o plano RQS PRO para obter masterizações de arquivos ilimitadas!",
  FREE_USAGE_LABEL: "Masterizações gratuitas restantes",
  PRO_USAGE_LABEL: "Plano: RQS PRO (Ilimitado)",

FOOTER_TAGLINE: "Reator de inteligência acústica e engenharia DSP para música eletrônica e industrial.",
FOOTER_TELEMETRY: "TELEMETRIA DO MAINFRAME",
FOOTER_NODE: "Nó de Rede",
FOOTER_COMPLIANCE: "Conformidade",
FOOTER_TERMS: "Termos de Serviço",
FOOTER_PRIVACY: "Política de Privacidade",
FOOTER_SA_EAST: "São Paulo (sa-east-1) - Latência Mínima",
FOOTER_EBU_R128: "EBU R128 & Apple ADM Compliant",
FOOTER_COPYRIGHT: "© 2026 RaQuel Synths. Todos os direitos reservados.",

FOOTER_CONTACT: "Fale Conosco",
};


// 🇺🇸 Dicionário de Tradução: Inglês
export const EN_DICT: typeof PT_DICT = {
  RQS_DSP_CORE: "RQS DSP CORE",
  SUBTITLE: "Drag the track here for acoustic validation",
  DROP_PROMPT: "Drop the .WAV file here",
  OR_CLICK: "or click to browse system",
  FILE_INTERCEPTED: "intercepted.",
  EXTRACT_STEMS: "🧬 EXTRACT 6 STEMS (MULTI-TRACK ISOLATION)",
  DISSECTING: "🧬 Demucs AI is dissecting the acoustic matrix into 6 channels... (Might take a few minutes. Do not close tab!)",
  REACTOR_PROCESSING: "⚙️ RQS Reactor processing telemetry... Please wait.",
  MASTER_COMPLETED: "✅ Mastering completed! [Download audio]",
  EJECT_DECK: "⏏️ EJECT TRACK & CLEAR DECK",
  SYNCHRONIZING: "⚡ Synchronizing audio matrix with Bunker... Please wait.",

    // 🇺🇸 Adicione no dicionário EN_DICT:
   DISSECTING_MINI: "🧬 EXTRACTING...",
   UPLOAD_FIRST_STEMS: "Upload a track to unlock Stem isolation",

  // Mastering Panel
  ORIGINAL: "Original",
  MASTER: "Master",
  VOLUME_MATCH: "Volume Match (Under construction 🔧)",
  PERFIL_ACUSTICO: "Acoustic Profile (Powered by RQS DSP)",
  INTENSIDADE_MASTER: "Mastering Intensity (Dynamic Control)",

  // Profiles
  THUNDER: "🌩️ Thunder",
  CLEAR_SKY: "☁️ Clear Sky",
  SUNROOF: "☀️ Sunroof",
  AURORA: "🌌 Aurora",

  // Intensities
  BAIXA: "🟢 Low (Dynamic)",
  MEDIA: "🟡 Medium (Balanced)",
  ALTA: "🔴 High (Competitive)",

  // Buttons
  HEAR_TEST: "🎧 HEAR TEST (15s)",
  MASTER_FULL: "🔥 MASTER FULL TRACK",
  ANALYZING: "Analyzing...",
  PROCESSING_ACUSTICO: "Processing Acoustic AI...",

  // 🎛️ NOVAS CHAVES: Mix Panel (Setlist Engine) [1.1]
  SETLIST_ENGINE: "🎛️ RQS Setlist Engine",
  MIX_DROP_PROMPT: "Drag your mastered tracks here",
  MIX_OR_CLICK: "or click to open folder",
  TIMELINE_TITLE: "Timeline",
  TRACKS_COUNT: "tracks",
  CROSSFADE_TO: "↳ Crossfade towards Track",
  SECONDS: "seconds",
  DEPLOY_LABEL: "Deploy Filename (.WAV):",
  FFMPEG_PROCESSING: "⚙️ RQS FFmpeg Engine stitching crossfades... Please wait.",
  DEPLOY_COMPLETED: "✅ Deploy Completed! Setlist download started automatically.",
  IGNITE_IDLE: "🔥 START SETLIST DEPLOY",
  IGNITE_ACTIVE: "🔥 RENDERING COMPILATION...",

  // 📟 NOVAS CHAVES: EKG Monitor [1.1]
  EKG_MONITOR_TITLE: "📟 ACOUSTIC EKG MONITOR",
  SIGNAL_ACTIVE: "AUDIO SIGNAL ACTIVE",
  FREQUENCY_SPECTRUM: "Frequency Spectrum Analysis",
  PHASE_CORRELATION: "Phase Correlation & Stereo Imaging",

  LIMIT_EXCEEDED_ALERT: "Free mastering limit reached (3 of 3 used). Upgrade to the RQS PRO plan for unlimited high-resolution wav mastering!",
  FREE_USAGE_LABEL: "Free masterings remaining",
  PRO_USAGE_LABEL: "Plan: RQS PRO (Unlimited)",

  FOOTER_TAGLINE: "Acoustic intelligence and DSP engineering reactor for electronic and industrial music.",
  FOOTER_TELEMETRY: "MAINFRAME TELEMETRY",
  FOOTER_NODE: "Network Node",
  FOOTER_COMPLIANCE: "Compliance",
  FOOTER_TERMS: "Terms of Service",
  FOOTER_PRIVACY: "Privacy Policy",
  FOOTER_SA_EAST: "São Paulo (sa-east-1) - Ultra-Low Latency",
  FOOTER_EBU_R128: "EBU R128 & Apple ADM Compliant",
  FOOTER_COPYRIGHT: "© 2026 RaQuel Synths. All rights reserved.",

  FOOTER_CONTACT: "Contact Us",

 };

 // Objeto de traduções em PORTUGUÊS
export const PT_TRANSLATIONS = {
  HERO_TITLE: "REESCREVA O CÓDIGO SÔNICO DAS SUAS MÚSICAS.",
  HERO_SUB: "O RQS Studio é uma estação de trabalho inteligente em nuvem desenvolvida sob medida para produtores independentes, DJs e criadores de música por IA.",
  HERO_CTA: "[ 🎛️ ENTRAR NO MAINFRAME DE GRAÇA ]",
  HERO_NOTE: "*Teste suas 3 primeiras faixas sem precisar de cadastro ou cartão.",

  DSP_TITLE: "DOMINE A ACÚSTICA DA INTELIGÊNCIA ARTIFICIAL",
  DSP_DESC: "Músicas geradas por IA (Suno/Udio) sofrem de estridência e graves embolados. Nosso reator acústico em Python SciPy corrige a física do áudio em menos de 300 milissegundos.",

  STEMS_TITLE: "SETLIST ENGINE & SEPARADOR DE STEMS",
  STEMS_DESC: "Extraia vocais, baterias e sintetizadores em arquivos WAV separados. Unifique o volume médio de um álbum inteiro sob a norma EBU R128 automaticamente.",

  MIXLAB_TITLE: "RQS MIXLAB: SIMULADOR DE DJ PROFISSIONAL",
  MIXLAB_DESC: "Acesse um emulador de DJ completo no seu navegador. Conecte sua controladora MIDI e grave seus mixsets em alta fidelidade com feedback de IA em tempo real.",

  PRICE_BETA_BADGE: "[ BETA FINAL // VALIDAÇÃO DO SISTEMA ]",
  PRICE_TITLE: "RQS PRO ESTÁ CHEGANDO.",
  PRICE_DESC: "O RQS Studio está em fase final de testes de produção. As ferramentas principais já estão disponíveis para avaliação gratuita enquanto o sistema de assinatura RQS PRO é preparado para o lançamento público. Preço planejado de lançamento: R$ 49,90/mês.",
  PRICE_CTA: "[ 💎 RQS PRO // EM BREVE ]",

  AB_PREVIEW_LOCK_NOTE: "Gere uma prévia de 15s para habilitar a comparação A/B.",
  AB_PREVIEW_GENERATING: "GERANDO PRÉVIA DA VERSÃO MASTER...",
  BTN_GENERATE_PREVIEW: "[ ⚡ GERAR PRÉVIA DE 15 SEGUNDOS ]",
  VOLUME_MATCH: "Correspondência de Volume",
  ORIGINAL_LABEL: "A - ORIGINAL",
  MASTER_LABEL: "B - MASTER PREVIEW",
  FULL_MASTER_COMPLETED_ALERT: "💎 MASTERIZAÇÃO COMPLETA CONCLUÍDA! (CLIQUE EM DOWNLOAD ÁUDIO PARA LIBERAR O DECK)",

  SETLIST_ENGINE: "RQS SETLIST ENGINE",
  MIX_DROP_PROMPT: "Arraste suas faixas masterizadas aqui",
  MIX_OR_CLICK: "ou clique para abrir a pasta",
  VALIDATION_TITLE: "🛡️ VALIDAÇÃO DE SETLIST & CONFORMIDADE",
  VALIDATION_MIN_TRACKS: "❌ Necessário pelo menos 2 faixas para gerar uma setlist.",
  VALIDATION_NAME_REQUIRED: "❌ O nome do arquivo de exportação é obrigatório.",
  VALIDATION_SR_MISMATCH: "⚠️ Taxas de amostragem (Sample Rates) diferentes detectadas. O reator fará o resample automático para 44.1 kHz.",
  VALIDATION_BD_MISMATCH: "⚠️ Bit Depths inconsistentes detectados. A setlist será exportada uniformemente em 24-bit.",
  SUMMARY_TITLE: "📊 SUMÁRIO ESTIMADO DA SETLIST",
  SUMMARY_TRACKS: "Faixas:",
  SUMMARY_TOTAL_SOURCE: "Tempo Total de Fontes:",
  SUMMARY_TOTAL_FADE: "Tempo Total de Crossfade:",
  SUMMARY_EST_OUTPUT: "Saída Estimada:",
  SUMMARY_OUT_FORMAT: "Formato de Saída:",
  SUMMARY_EST_SIZE: "Tamanho Estimado:",
  LOUDNESS_MATCH_LABEL: "⚡ EQUALIZADOR DE LOUDNESS PERCEBIDO:",
  LOUDNESS_OFF: "DESATIVADO",
  LOUDNESS_PERCEIVED: "EQUILIBRAR PERCEBIDO (LUFS)",
  LOUDNESS_NORMALIZE: "NORMALIZAR AO ALVO (-14 LUFS)",
  CROSSFADE_CURVE_LABEL: "🎚️ CURVA DE TRANSIÇÃO (CROSSFADE CURVE):",
  CURVE_EQUAL_POWER: "EQUAL POWER (SUAVE)",
  CURVE_LINEAR: "LINEAR (FADE DIRETO)",
  CURVE_FAST_CUT: "FAST CUT (CORTE RÁPIDO)",
  PREVIEWING_TRANSITION: "🔁 REPRODUZINDO TRANSIÇÃO: FAIXA",
  TRACK_LABEL: "FAIXA",
  BTN_STOP_PREVIEW: "■ PARAR PRÉVIA",
  TIMELINE_TITLE: "LINHA DO TEMPO DA SETLIST",
  CROSSFADE_TO: "FADE PARA",
  SECONDS: "segundos",
  PREVIEW_ACTIVE: "REPRODUZINDO...",
  BTN_PREVIEW_TRANSITION: "OUVIR TRANSIÇÃO (PREVIEW)",
  DEPLOY_LABEL: "NOME DO SETLIST MASTER (.WAV)",
  FFMPEG_PROCESSING: "REATOR SÔNICO RQS OPERANDO AS TRANSIÇÕES... AGUARDE.",
  DEPLOY_COMPLETED: "SETLIST EXPORTADA COM SUCESSO!",
  IGNITE_ACTIVE: "RQS_DEPLOY_ATIVO...",
  IGNITE_LIMIT_ALERT: "🔒 APENAS PLANO PRO (>3 FAIXAS)",
  IGNITE_IDLE: "🔥 RENDER & DEPLOY SETLIST",
  SETLIST_HELPER_NOTE: "Gera um único arquivo contínuo WAV com todas as transições e curvas configuradas.",

  SYNCING_WITH_S3_BUNKER: "SINCRONIZANDO COM O BUNKER...",
  PROTECTED_IN_BUNKER: "PROTEGIDO NO BUNKER",
  UPLINK_TITLE: "📡 RQS UPLINK ENGINE",
  UPLINK_STATUS: "CONEXÃO ESTÁVEL",
  UPLINK_DESC: "Roteie seus deployst de áudio. Gere deep-links inteligentes para forçar a abertura instantânea dos aplicativos de streaming e reter seus ouvintes sem perdas por barreiras de login.",
  UPLINK_DETECTED: "⚡ NOVO DEPLOY DE ÁUDIO RECONHECIDO NO MAINFRAME",
  BTN_INSTANT_DEPLOY: "[ DEPLOY DE MARKETING INSTANTÂNEO ]",
  BTN_COMPILE_LINK: "[ COMPILAR LINK SEGURO ]",
  UPLINK_INPUT_PLACEHOLDER: "URL DE DESTINO (SPOTIFY / YOUTUBE)...",

  // 🟢 CHAVES DE CONFORMIDADE DE LAYOUT CORRIGIDAS (Bate 1:1 com o HTML):
  DEPLOY_LABELURL: "URL DE DESTINO",
  CUSTOM_SLUG_LABEL: "SLUG CUSTOMIZADO",
  META_PIXEL_ID_LABEL: "META PIXEL ID (OPCIONAL)",

  ANALYTICS_CLICKS: "CLIQUES",
  ANALYTICS_CONVERSION: "TAXA DE CONVERSÃO",
  ANALYTICS_PIXEL: "STATUS DO PIXEL",
  PIXEL_ACTIVE: "ATIVO",
  PIXEL_INACTIVE: "INATIVO",

  // RQS Uplink Engine & Dashboard
  uplinkTitle: 'RQS UPLINK ENGINE',
  uplinkBadge: 'DEEP LINK BYPASS ACTIVE: Acesso Direto',
  uplinkDesc: 'Cole o link da sua faixa no Spotify, SoundCloud ou YouTube. Nosso motor gera um link curto inteligente que tenta abrir o conteúdo diretamente no aplicativo oficial compatível, reduzindo a fricção causada por navegadores internos de redes sociais — sem exigir suas credenciais das plataformas musicais.',
  urlLabel: 'URL DA FAIXA (STREAMING)',
  slugLabel: 'SLUG PERSONALIZADO (OPCIONAL)',
  compileBtn: '[ COMPILAR DEEP LINK SEGURO ]',
  copyLink: 'Copiar Link',
  copiedLink: '✓ Copiado!',

  // Dashboard
  dashTitle: 'RQS UPLINK ANALYTICS & DEEP LINKS',
  activeLinks: 'Links Ativos',
  dashDesc: 'Gerencie seus deep links publicados no Instagram, TikTok, Facebook e YouTube. Acompanhe cliques e taxas de conversão em tempo real.',
  emptyLinks: 'Nenhum deep link compilado ainda. Use o Uplink Engine acima para gerar o seu primeiro link de rastreio.',
  clicksLabel: 'Cliques',
  conversionLabel: 'Conversão',
  trafficSources: 'Fontes de Tráfego:',
  copyUrl: 'Copiar URL',
  deleteBtn: 'Excluir',

  UPLINK_LOGIN_REQUIRED:'LOGIN_REQUIRED: Você precisa estar logado para criar deep links. Por favor, faça login na sua conta para continuar.',
  UPLINK_LIMIT_REACHED:
  'LIMIT_REACHED: O plano Free permite apenas 3 Deep Links ativos. Faça login para vincular sua conta e assine o RQS Pro para liberar links ilimitados.',
};

// Objeto de traduções em INGLÊS (🟢 CORRIGIDO: $9.90 alterado para $8.00!)
export const EN_TRANSLATIONS = {
  HERO_TITLE: "REWRITE THE SONIC CODE OF YOUR MUSIC.",
  HERO_SUB: "RQS Studio is an intelligent cloud workstation custom-built for independent producers, DJs, and generative AI creators.",
  HERO_CTA: "[ 🎛️ ENTER THE MAINFRAME FOR FREE ]",
  HERO_NOTE: "*Test your first 3 tracks with no registration or credit card required.",

  DSP_TITLE: "TAMING GENERATIVE AI ACOUSTICS",
  DSP_DESC: "AI-generated music (Suno/Udio) suffers from harshness and muddy low-ends. Our SciPy Python DSP engine fixes the audio physics in less than 300 milliseconds.",

  STEMS_TITLE: "SETLIST ENGINE & STEMS SPLITTER",
  STEMS_DESC: "Extract vocals, drums, and synths into high-res WAV files. Batch-normalize album loudness under the international EBU R128 broadcast standard automatically.",

  MIXLAB_TITLE: "RQS MIXLAB: PROFESSIONAL DJ SIMULATOR",
  MIXLAB_DESC: "Access a complete DJ emulator in your browser. Connect your MIDI hardware and record high-fidelity mixsets with real-time AI performance metrics.",

  PRICE_BETA_BADGE: "[ FINAL BETA // SYSTEM VALIDATION ]",
  PRICE_TITLE: "RQS PRO IS COMING.",
  PRICE_DESC: "RQS Studio is currently undergoing final production testing. Core tools are already available for free evaluation while the RQS PRO subscription system is prepared for public release. Planned launch price: $9.90/month.",
  PRICE_CTA: "[ 💎 RQS PRO // COMING SOON ]",

    AB_PREVIEW_LOCK_NOTE: "Generate a 15s preview to enable A/B comparison.",
    AB_PREVIEW_GENERATING: "GENERATING MASTER VERSION PREVIEW...",
    BTN_GENERATE_PREVIEW: "[ ⚡ GENERATE 15-SECOND PREVIEW ]",
    VOLUME_MATCH: "Volume Match",
    ORIGINAL_LABEL: "A - ORIGINAL",
    MASTER_LABEL: "B - MASTER PREVIEW",
    FULL_MASTER_COMPLETED_ALERT: "💎 FULL MASTER COMPLETED! (CLICK DOWNLOAD AUDIO TO RELEASE THE DECK)",

  SETLIST_ENGINE: "RQS SETLIST ENGINE",
  MIX_DROP_PROMPT: "Drag your mastered tracks here",
  MIX_OR_CLICK: "or click to open the folder",
  VALIDATION_TITLE: "🛡️ SETLIST VALIDATION & COMPLIANCE",
  VALIDATION_MIN_TRACKS: "❌ At least 2 tracks are required to generate a setlist.",
  VALIDATION_NAME_REQUIRED: "❌ Export filename is required.",
  VALIDATION_SR_MISMATCH: "⚠️ Different sample rates detected. The reactor will auto-resample to 44.1 kHz.",
  VALIDATION_BD_MISMATCH: "⚠️ Inconsistent bit depths detected. The setlist will be exported as 24-bit.",
  SUMMARY_TITLE: "📊 ESTIMATED SETLIST SUMMARY",
  SUMMARY_TRACKS: "Tracks:",
  SUMMARY_TOTAL_SOURCE: "Total Source Time:",
  SUMMARY_TOTAL_FADE: "Total Crossfade:",
  SUMMARY_EST_OUTPUT: "Estimated Output:",
  SUMMARY_OUT_FORMAT: "Output Format:",
  SUMMARY_EST_SIZE: "Estimated Size:",
  LOUDNESS_MATCH_LABEL: "⚡ PERCEIVED LOUDNESS EQUALIZER:",
  LOUDNESS_OFF: "DISABLED",
  LOUDNESS_PERCEIVED: "MATCH PERCEIVED LOUDNESS (LUFS)",
  LOUDNESS_NORMALIZE: "NORMALIZE TO TARGET (-14 LUFS)",
  CROSSFADE_CURVE_LABEL: "🎚️ TRANSITION CURVE (CROSSFADE CURVE):",
  CURVE_EQUAL_POWER: "EQUAL POWER (SMOOTH)",
  CURVE_LINEAR: "LINEAR (DIRECT FADE)",
  CURVE_FAST_CUT: "FAST CUT (QUICK CUT)",
  PREVIEWING_TRANSITION: "🔁 PLAYING TRANSITION: TRACK",
  TRACK_LABEL: "TRACK",
  BTN_STOP_PREVIEW: "■ STOP PREVIEW",
  TIMELINE_TITLE: "SETLIST TIMELINE",
  CROSSFADE_TO: "FADE TO",
  SECONDS: "seconds",
  PREVIEW_ACTIVE: "PLAYING...",
  BTN_PREVIEW_TRANSITION: "HEAR TRANSITION (PREVIEW)",
  DEPLOY_LABEL: "SETLIST MASTER FILENAME (.WAV)",
  FFMPEG_PROCESSING: "RQS SONIC REACTOR PROCESSING TRANSITIONS... PLEASE WAIT.",
  DEPLOY_COMPLETED: "SETLIST EXPORTED SUCCESSFULLY!",
  IGNITE_ACTIVE: "RQS_DEPLOY_ACTIVE...",
  IGNITE_LIMIT_ALERT: "🔒 PRO PLAN ONLY (>3 TRACKS)",
  IGNITE_IDLE: "🔥 RENDER & DEPLOY SETLIST",
  SETLIST_HELPER_NOTE: "Creates one continuous WAV file with all configured transitions and curves.",

  SYNCING_WITH_S3_BUNKER: "SYNCING WITH BUNKER...",
  PROTECTED_IN_BUNKER: "PROTECTED IN BUNKER",

  UPLINK_TITLE: "📡 RQS UPLINK ENGINE",
  UPLINK_STATUS: "STABLE CONNECTION",
  UPLINK_DESC: "Route your audio deploys. Generate smart deep-links to force instant opening of native streaming apps and retain your audience without login barriers.",
  UPLINK_DETECTED: "⚡ NEW AUDIO DEPLOY DETECTED IN MAINFRAME",
  BTN_INSTANT_DEPLOY: "[ INSTANT MARKETING DEPLOY ]",
  BTN_COMPILE_LINK: "[ COMPILE SECURE LINK ]",
  UPLINK_INPUT_PLACEHOLDER: "DESTINATION URL (SPOTIFY / YOUTUBE)...",

  // 🟢 CHAVES DE CONFORMIDADE DE LAYOUT CORRIGIDAS (Bate 1:1 com o HTML):
  DEPLOY_LABELURL: "DESTINATION URL",
  CUSTOM_SLUG_LABEL: "CUSTOM SLUG",
  META_PIXEL_ID_LABEL: "META PIXEL ID (OPTIONAL)",

  ANALYTICS_CLICKS: "CLICKS",
  ANALYTICS_CONVERSION: "CONVERSION RATE",
  ANALYTICS_PIXEL: "PIXEL STATUS",
  PIXEL_ACTIVE: "ACTIVE",
  PIXEL_INACTIVE: "INACTIVE",

  // RQS Uplink Engine & Dashboard
  uplinkTitle: 'RQS UPLINK ENGINE',
  uplinkBadge: 'DEEP LINK BYPASS ACTIVE: Direct Access',
  uplinkDesc: 'Paste the link to your track from Spotify, SoundCloud, or YouTube. Our engine generates a smart short link that attempts to open the content directly in the compatible official app, reducing friction caused by in-app social media browsers—without requiring your music platform credentials.',
  urlLabel: 'TRACK URL (STREAMING)',
  slugLabel: 'CUSTOM SLUG (OPTIONAL)',
  compileBtn: '[ COMPILE SECURE DEEP LINK ]',
  copyLink: 'Copy Link',
  copiedLink: '✓ Copied!',

  // Dashboard
  dashTitle: 'RQS UPLINK ANALYTICS & DEEP LINKS',
  activeLinks: 'Active Links',
  dashDesc: 'Manage your deep links published on Instagram, TikTok, Facebook and YouTube. Track clicks and conversion rates in real time.',
  emptyLinks: 'No deep links compiled yet. Use the Uplink Engine above to generate your first tracking link.',
  clicksLabel: 'Clicks',
  conversionLabel: 'Conversion',
  trafficSources: 'Traffic Sources:',
  copyUrl: 'Copy URL',
  deleteBtn: 'Delete',

  UPLINK_LOGIN_REQUIRED:'LOGIN_REQUIRED: You must be logged in to create deep links. Please sign in to your account to continue.',
  UPLINK_LIMIT_REACHED:
  'LIMIT_REACHED: The Free plan allows up to 3 active Deep Links. Sign in to link your account and subscribe to RQS Pro to unlock unlimited links.',


};

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  // 1. Sinal Writable que armazena o idioma ativo ('pt' ou 'en')
  readonly currentLang = signal<'pt' | 'en'>('en');

  // 2. Sinal Computado reativo que devolve o dicionário correto [1.1]
  readonly t = computed(() => this.currentLang() === 'pt' ? PT_DICT : EN_DICT);
  readonly tr = computed(() => this.currentLang() === 'pt' ? PT_TRANSLATIONS : EN_TRANSLATIONS);

  constructor() {
    this.detectBrowserLanguage();
  }

  // Detecta automaticamente a linguagem do navegador do usuário
  private detectBrowserLanguage() {
    if (typeof window !== 'undefined' && window.navigator) {
      const browserLang = window.navigator.language.toLowerCase();
      // Se o navegador iniciar com 'pt' (pt-BR, pt-PT), ativa português. Caso contrário, inglês.
      this.currentLang.set(browserLang.startsWith('pt') ? 'pt' : 'en');
    }
  }

  // Método manual de alternar idioma na barra de topo
  setLanguage(lang: 'pt' | 'en') {
    this.currentLang.set(lang);
  }
}
