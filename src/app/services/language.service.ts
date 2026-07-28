import { Injectable, signal, computed } from '@angular/core';

// 🇧🇷 Dicionário de Tradução: Português
export const PT_DICT = {
  RQS_DSP_CORE: "RQS DSP CORE",
  SUBTITLE: "Arraste a faixa crua do Suno para homologação acústica",
  DROP_PROMPT: "Solte o arquivo .WAV aqui",
  OR_CLICK: "ou clique para buscar no sistema",
  FILE_INTERCEPTED: "interceptado.",
  EXTRACT_STEMS: "🧬 EXTRAIR 6 STEMS (ISOLAMENTO MULTI-PISTA)",
  DISSECTING: "🧬 IA Demucs está dissecando a matriz acústica em 6 canais... (Pode demorar alguns minutos. Não feche a aba!)",
  REACTOR_PROCESSING: "⚙️ RQS Reator processando telemetria... Aguarde.",
  MASTER_COMPLETED: "✅ Masterização concluída! [Download áudio]",
  EJECT_DECK: "⏏️ EJETAR FAIXA E LIMPAR DECK",
  SYNCHRONIZING: "⚡ Sincronizando matriz de áudio com o S3 Bunker... Aguarde.",

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
  PROCESSING_ACUSTICO: "Processando IA Acústica..."
};

// 🇺🇸 Dicionário de Tradução: Inglês
export const EN_DICT: typeof PT_DICT = {
  RQS_DSP_CORE: "RQS DSP CORE",
  SUBTITLE: "Drag the raw Suno track here for acoustic validation",
  DROP_PROMPT: "Drop the .WAV file here",
  OR_CLICK: "or click to browse system",
  FILE_INTERCEPTED: "intercepted.",
  EXTRACT_STEMS: "🧬 EXTRACT 6 STEMS (MULTI-TRACK ISOLATION)",
  DISSECTING: "🧬 Demucs AI is dissecting the acoustic matrix into 6 channels... (Might take a few minutes. Do not close tab!)",
  REACTOR_PROCESSING: "⚙️ RQS Reactor processing telemetry... Please wait.",
  MASTER_COMPLETED: "✅ Mastering completed! [Download audio]",
  EJECT_DECK: "⏏️ EJECT TRACK & CLEAR DECK",
  SYNCHRONIZING: "⚡ Synchronizing audio matrix with S3 Bunker... Please wait.",

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
  PROCESSING_ACUSTICO: "Processing Acoustic AI..."
};

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  // 1. Sinal Writable que armazena o idioma ativo ('pt' ou 'en')
  readonly currentLang = signal<'pt' | 'en'>('en');

  // 2. Sinal Computado reativo que devolve o dicionário correto [1.1]
  readonly t = computed(() => this.currentLang() === 'pt' ? PT_DICT : EN_DICT);

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
