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
  FOOTER_COPYRIGHT: "© 2026 RaQuel Synths. All rights reserved."

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

  PRICE_TITLE: "MASTERIZAÇÃO ILIMITADA. PREÇO DE IMPULSO.",
  PRICE_DESC: "Esqueça as assinaturas abusivas em dólar. Assine o plano RQS PRO por apenas R$ 39,90/mês e libere masterizações WAV ilimitadas e acesso total ao emulador MIDI.",
  PRICE_CTA: "[ 💎 ADQUIRIR ACESSO RQS PRO ]",

  AB_PREVIEW_LOCK_NOTE: "Gere uma prévia de 15s para habilitar a comparação A/B.",
  AB_PREVIEW_GENERATING: "GERANDO PRÉVIA DA VERSÃO MASTER...",
  BTN_GENERATE_PREVIEW: "[ ⚡ GERAR PRÉVIA DE 15 SEGUNDOS ]",
  VOLUME_MATCH: "Correspondência de Volume",
  ORIGINAL_LABEL: "A - ORIGINAL",
  MASTER_LABEL: "B - MASTER PREVIEW",
  FULL_MASTER_COMPLETED_ALERT: "💎 MASTERIZAÇÃO COMPLETA CONCLUÍDA! (CLIQUE EM DOWNLOAD ÁUDIO PARA LIBERAR O DECK)"
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

  PRICE_TITLE: "UNLIMITED MASTERING. IMPULSE PRICING.",
  PRICE_DESC: "Forget expensive USD subscriptions. Get the RQS PRO plan for just $8.00/mo to unlock unlimited WAV downloads and full MIDI support.",
  PRICE_CTA: "[ 💎 UPGRADE TO RQS PRO ]",

  AB_PREVIEW_LOCK_NOTE: "Gere uma prévia de 15s para habilitar a comparação A/B.",
  AB_PREVIEW_GENERATING: "GERANDO PRÉVIA DA VERSÃO MASTER...",
  BTN_GENERATE_PREVIEW: "[ ⚡ GERAR PRÉVIA DE 15 SEGUNDOS ]",
  VOLUME_MATCH: "Correspondência de Volume",
  ORIGINAL_LABEL: "A - ORIGINAL",
  MASTER_LABEL: "B - MASTER PREVIEW",
  FULL_MASTER_COMPLETED_ALERT: "💎 FULL MASTER COMPLETED! (CLICK DOWNLOAD AUDIO TO RELEASE THE DECK)"

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
