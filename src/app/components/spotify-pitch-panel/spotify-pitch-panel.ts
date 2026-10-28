import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component, DestroyRef, Input, OnChanges, OnInit, PLATFORM_ID, SimpleChanges, computed, inject, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { DspService } from '../../services/dsp';
import { LanguageService } from '../../services/language.service';
import {
  AudioDnaPayload, AudioIntelligenceFlowStage, AudioIntelligenceV2Payload, ArtistConfirmedSound,
  MasteringV2Analysis, OpenAiMusicAnalystPayload,
  SpotifyPitchCollaboratorRole, SpotifyPitchEvidence, SpotifyPitchEvidenceSource,
  SpotifyPitchPromotionChannel, SpotifyPitchQuotaResponse, SpotifyPitchRequest, SpotifyPitchResponse,
} from '../../services/mastering-types';

type V2SoundCategory = 'genre_family' | 'subgenres' | 'moods' | 'instruments' | 'vocals' | 'production_elements';

interface PitchCopy {
  eyebrow: string; title: string; subtitle: string;
  masterLabel: string; masterDescription: string; pitchLabel: string; pitchDescription: string;
  evidenceReady: string; pitchReady: string; audioDna: string; genre: string; astral: string;
  instruments: string; technical: string; confirmTitle: string; confirmSubtitle: string;
  genreFamily: string; subgenres: string; vocals: string; productionElements: string; addLabel: string;
  detectedGenres: string; atmosphere: string; instrumentation: string; allCorrect: string;
  adjust: string; finishAdjusting: string; contextTitle: string; contextSubtitle: string;
  songStory: string; releaseDifference: string; realContext: string; collaboration: string;
  whyNow: string; whyNowHelp: string;
  collaborators: string; collaboratorRole: string; noRole: string; culturalContext: string;
  promotion: string; promotionDetails: string; generate: string; generating: string;
  metadataTitle: string; metadataDisclaimer: string; editorialPitchTitle: string;
  positioningTitle: string; positioningDisclaimer: string; whyTitle: string;
  copyPitch: string; copied: string; regenerate: string; evidenceUsed: string; unavailable: string;
  aiDetected: string; artistFinal: string; genreLimit: string; draftStatus: string; reviewMicrocopy: string;
  timingRecommended: string; timingReleaseRadar: string;
  quotaRemaining: string; quotaReached: string; quotaUnavailable: string; joinWaitlist: string;
  promotionLabels: Record<SpotifyPitchPromotionChannel, string>;
  roleLabels: Record<SpotifyPitchCollaboratorRole, string>;
  sourceLabels: Record<SpotifyPitchEvidenceSource, string>;
}

const EN_PROMOTION_LABELS: Record<SpotifyPitchPromotionChannel, string> = {
  'Social media': 'Social media', YouTube: 'YouTube', 'Music video': 'Music video',
  'Live performance': 'Live performance', 'Press / blogs': 'Press / blogs', Ads: 'Ads',
  'Mailing list': 'Mailing list', Website: 'Website', 'Pre-save': 'Pre-save',
  'No campaign planned': 'No campaign planned',
};
const PT_PROMOTION_LABELS: Record<SpotifyPitchPromotionChannel, string> = {
  'Social media': 'Redes sociais', YouTube: 'YouTube', 'Music video': 'Videoclipe',
  'Live performance': 'Apresentação ao vivo', 'Press / blogs': 'Imprensa / blogs', Ads: 'Anúncios',
  'Mailing list': 'Lista de e-mails', Website: 'Website', 'Pre-save': 'Pre-save',
  'No campaign planned': 'Nenhuma campanha planejada',
};


const PL_PROMOTION_LABELS: Record<SpotifyPitchPromotionChannel, string> = {
  'Social media': 'Media społecznościowe', YouTube: 'YouTube', 'Music video': 'Teledysk',
  'Live performance': 'Występ na żywo', 'Press / blogs': 'Prasa / blogi', Ads: 'Reklamy',
  'Mailing list': 'Lista mailingowa', Website: 'Strona internetowa', 'Pre-save': 'Pre-save',
  'No campaign planned': 'Brak planowanej kampanii',
};

const FR_PROMOTION_LABELS: Record<SpotifyPitchPromotionChannel, string> = {
  'Social media': 'Réseaux sociaux', YouTube: 'YouTube', 'Music video': 'Clip vidéo',
  'Live performance': 'Performance en direct', 'Press / blogs': 'Presse / blogs', Ads: 'Publicités',
  'Mailing list': 'Liste e-mail', Website: 'Site web', 'Pre-save': 'Pré-save',
  'No campaign planned': 'Aucune campagne prévue',
};

const COPY: Record<'en' | 'pt' | 'pl' | 'fr', PitchCopy> = {
  en: {
    eyebrow: 'AI SPOTIFY PITCH', title: 'Spotify Pitch Generator — AI Release Intelligence',
    subtitle: 'I have already heard your music. Now tell me what only you can know — if you want to.',
    masterLabel: 'MASTER', masterDescription: 'Prepare the audio for distribution.',
    pitchLabel: 'PITCH', pitchDescription: 'Prepare the release for editorial presentation.',
    evidenceReady: 'MUSIC EVIDENCE', pitchReady: '✓ Pitch ready to generate',
    audioDna: 'Audio DNA', genre: 'Genre', astral: 'Astral', instruments: 'Instruments', technical: 'Technical data',
    genreFamily: 'Genre family', subgenres: 'Subgenres', vocals: 'Vocals', productionElements: 'Production elements', addLabel: 'Add',
    confirmTitle: 'HOW YOUR MUSIC SOUNDS',
    confirmSubtitle: 'The analysis found these characteristics. Confirm or adjust them before generating the pitch.',
    detectedGenres: 'Detected genres', atmosphere: 'Atmosphere', instrumentation: 'Instrumentation',
    allCorrect: 'EVERYTHING LOOKS RIGHT', adjust: 'ADJUST', finishAdjusting: 'FINISH ADJUSTING',
    contextTitle: 'Release context — optional',
    contextSubtitle: 'Your music already has enough evidence to generate a pitch. Add context only if you want to make it more personal.',
    songStory: 'Tell the story of the song in one sentence. (optional)',
    releaseDifference: 'What is different about this track? (optional)',
    whyNow: 'Why release this track now? (optional)',
    whyNowHelp: 'It can be a new phase, a return, an anniversary, a rebuilding, a continuation of a story, or another real reason.',
    realContext: 'Is there a real story or context behind it? (optional)',
    collaboration: 'Is this track a collaboration?', collaborators: 'Who took part?',
    collaboratorRole: 'Optional role', noRole: 'No role selected',
    culturalContext: 'Is there any relevant cultural or geographic connection? (optional)',
    promotion: 'How do you plan to promote it? (optional)', promotionDetails: 'Confirmed details (optional)',
    generate: 'GENERATE PITCH', generating: 'GENERATING…',
    metadataTitle: 'SPOTIFY METADATA SUGGESTIONS',
    metadataDisclaimer: 'Suggestions only. Spotify may use different metadata choices.',
    editorialPitchTitle: 'EDITORIAL PITCH', positioningTitle: 'POSSIBLE EDITORIAL POSITIONING',
    positioningDisclaimer: 'Positioning suggestions. They do not predict or guarantee playlist inclusion.',
    whyTitle: 'WHY THIS PITCH WORKS', copyPitch: 'COPY PITCH', copied: 'COPIED', regenerate: 'REGENERATE',
    evidenceUsed: 'EVIDENCE TRACE',
    aiDetected: 'AI DETECTED', artistFinal: 'ARTIST CONFIRMED / FINAL',
    genreLimit: 'Choose up to 3 final genres.', draftStatus: 'EDITORIAL DRAFT GENERATED',
    reviewMicrocopy: 'Use this as an editorial draft and make the final adjustment in your own artistic voice before submitting.',
    unavailable: 'Pitch generation is temporarily unavailable. Your analysis and mastering remain active.',
    quotaRemaining: 'You have {remaining} of {limit} AI Spotify Pitches remaining.',
    quotaReached: 'You have reached your AI Spotify Pitch limit.', quotaUnavailable: 'Pitch quota is temporarily unavailable.', joinWaitlist: 'GO TO WAITLIST',
    timingRecommended: 'Recommended: submit your pitch around 14+ days in advance.',
    timingReleaseRadar: 'For Release Radar eligibility, Spotify states at least 7 days before release.',
    promotionLabels: EN_PROMOTION_LABELS,
    roleLabels: { artist: 'Artist', producer: 'Producer', vocalist: 'Vocalist', songwriter: 'Songwriter', instrumentalist: 'Instrumentalist', other: 'Other' },
    sourceLabels: { cocotagger: 'Audio Analysis', openai_music_analyst: 'Music Analyst', rqs_audio_dna: 'Audio DNA', artist_confirmed: 'Artist confirmed', artist_supplied: 'Artist supplied' },
  },
  pt: {
    eyebrow: 'AI SPOTIFY PITCH', title: 'Spotify Pitch Generator — Inteligência de Lançamento com IA',
    subtitle: 'Eu já ouvi sua música. Agora me conte o que só você pode saber — se quiser.',
    masterLabel: 'MASTER', masterDescription: 'Prepare o áudio para distribuição.',
    pitchLabel: 'PITCH', pitchDescription: 'Prepare o lançamento para apresentação editorial.',
    evidenceReady: 'EVIDÊNCIAS MUSICAIS', pitchReady: '✓ Pitch pronto para gerar',
    audioDna: 'Audio DNA', genre: 'Genre', astral: 'Astral', instruments: 'Instruments', technical: 'Dados técnicos',
    genreFamily: 'Família de gênero', subgenres: 'Subgêneros', vocals: 'Vocais', productionElements: 'Elementos de produção', addLabel: 'Adicionar',
    confirmTitle: 'COMO SUA MÚSICA SOA',
    confirmSubtitle: 'A análise encontrou estas características. Confirme ou ajuste antes de gerar o pitch.',
    detectedGenres: 'Gêneros detectados', atmosphere: 'Atmosfera', instrumentation: 'Instrumentação',
    allCorrect: 'TUDO CERTO', adjust: 'AJUSTAR', finishAdjusting: 'CONCLUIR AJUSTES',
    contextTitle: 'Contexto do lançamento — opcional',
    contextSubtitle: 'Sua música já tem evidências suficientes para gerar um pitch. Conte mais apenas se quiser torná-lo mais pessoal.',
    songStory: 'Conte a história da música em uma frase. (opcional)',
    releaseDifference: 'O que existe de diferente nesta faixa? (opcional)',
    whyNow: 'Por que lançar esta faixa agora? (opcional)',
    whyNowHelp: 'Pode ser uma nova fase, retorno, aniversário, reconstrução, continuação de uma história ou outro motivo real.',
    realContext: 'Existe alguma história real ou contexto por trás dela? (opcional)',
    collaboration: 'Esta faixa é uma colaboração?', collaborators: 'Quem participou?',
    collaboratorRole: 'Função opcional', noRole: 'Sem função selecionada',
    culturalContext: 'Existe alguma ligação cultural ou geográfica relevante? (opcional)',
    promotion: 'Como você pretende divulgar? (opcional)', promotionDetails: 'Detalhes já confirmados (opcional)',
    generate: 'GERAR PITCH', generating: 'GERANDO…',
    metadataTitle: 'SUGESTÕES DE METADADOS PARA SPOTIFY',
    metadataDisclaimer: 'São sugestões. O Spotify pode adotar escolhas de metadados diferentes.',
    editorialPitchTitle: 'PITCH EDITORIAL', positioningTitle: 'POSSÍVEIS DIREÇÕES EDITORIAIS',
    positioningDisclaimer: 'Sugestões de posicionamento. Não representam previsão ou garantia de inclusão em playlists.',
    whyTitle: 'POR QUE ESTE PITCH FUNCIONA', copyPitch: 'COPIAR PITCH', copied: 'COPIADO', regenerate: 'GERAR NOVAMENTE',
    evidenceUsed: 'RASTRO DE EVIDÊNCIAS',
    aiDetected: 'DETECTADO POR IA', artistFinal: 'CONFIRMADO PELO ARTISTA / FINAL',
    genreLimit: 'Escolha até 3 gêneros finais.', draftStatus: 'RASCUNHO EDITORIAL GERADO',
    reviewMicrocopy: 'Use esta versão como base editorial e faça o ajuste final com sua voz artística antes do envio.',
    unavailable: 'A geração do pitch está indisponível. Sua análise e masterização continuam ativas.',
    quotaRemaining: 'Você tem {remaining} de {limit} AI Spotify Pitches restantes.',
    quotaReached: 'Você atingiu o limite de AI Spotify Pitches.', quotaUnavailable: 'A cota de pitches está temporariamente indisponível.', joinWaitlist: 'IR PARA WAITLIST',
    timingRecommended: 'Recomendado: envie seu pitch com cerca de 14+ dias de antecedência.',
    timingReleaseRadar: 'Para benefício do Release Radar, o Spotify informa pelo menos 7 dias antes do lançamento.',
    promotionLabels: PT_PROMOTION_LABELS,
    roleLabels: { artist: 'Artista', producer: 'Produtor', vocalist: 'Vocalista', songwriter: 'Compositor', instrumentalist: 'Instrumentista', other: 'Outro' },
    sourceLabels: { cocotagger: 'Análise de áudio', openai_music_analyst: 'Music Analyst', rqs_audio_dna: 'Audio DNA', artist_confirmed: 'Confirmado pelo artista', artist_supplied: 'Informado pelo artista' },
  },

  pl: {
    eyebrow: 'AI SPOTIFY PITCH', title: 'Spotify Pitch Generator — Inteligencja wydawnicza AI',
    subtitle: 'Już znam brzmienie Twojej muzyki. Teraz opowiedz mi to, czego tylko Ty możesz wiedzieć — jeśli chcesz.',
    masterLabel: 'MASTER', masterDescription: 'Przygotuj audio do dystrybucji.',
    pitchLabel: 'PITCH', pitchDescription: 'Przygotuj wydanie do prezentacji redakcyjnej.',
    evidenceReady: 'DOWODY MUZYCZNE', pitchReady: '✓ Pitch gotowy do wygenerowania',
    audioDna: 'Audio DNA', genre: 'Gatunek', astral: 'Nastrój', instruments: 'Instrumenty', technical: 'Dane techniczne',
    genreFamily: 'Rodzina gatunków', subgenres: 'Podgatunki', vocals: 'Wokal', productionElements: 'Elementy produkcji', addLabel: 'Dodaj',
    confirmTitle: 'JAK BRZMI TWOJA MUZYKA',
    confirmSubtitle: 'Analiza wykryła te cechy. Potwierdź je lub dostosuj przed wygenerowaniem pitchu.',
    detectedGenres: 'Wykryte gatunki', atmosphere: 'Atmosfera', instrumentation: 'Instrumentarium',
    allCorrect: 'WSZYSTKO SIĘ ZGADZA', adjust: 'DOSTOSUJ', finishAdjusting: 'ZAKOŃCZ ZMIANY',
    contextTitle: 'Kontekst wydania — opcjonalnie',
    contextSubtitle: 'Muzyka ma już wystarczające dane do stworzenia pitchu. Dodaj kontekst tylko wtedy, gdy chcesz nadać mu bardziej osobisty charakter.',
    songStory: 'Opowiedz historię utworu jednym zdaniem. (opcjonalnie)',
    releaseDifference: 'Co wyróżnia ten utwór? (opcjonalnie)',
    whyNow: 'Dlaczego wydajesz ten utwór właśnie teraz? (opcjonalnie)',
    whyNowHelp: 'Może to być nowy etap, powrót, rocznica, rekonstrukcja, kontynuacja historii lub inny prawdziwy powód.',
    realContext: 'Czy za utworem stoi prawdziwa historia lub kontekst? (opcjonalnie)',
    collaboration: 'Czy ten utwór jest współpracą?', collaborators: 'Kto wziął udział?',
    collaboratorRole: 'Opcjonalna rola', noRole: 'Nie wybrano roli',
    culturalContext: 'Czy istnieje istotny kontekst kulturowy lub geograficzny? (opcjonalnie)',
    promotion: 'Jak planujesz promować wydanie? (opcjonalnie)', promotionDetails: 'Potwierdzone szczegóły (opcjonalnie)',
    generate: 'GENERUJ PITCH', generating: 'GENEROWANIE…',
    metadataTitle: 'SUGESTIE METADANYCH SPOTIFY',
    metadataDisclaimer: 'To tylko sugestie. Spotify może zastosować inne metadane.',
    editorialPitchTitle: 'PITCH REDAKCYJNY', positioningTitle: 'MOŻLIWE KIERUNKI REDAKCYJNE',
    positioningDisclaimer: 'Sugestie pozycjonowania. Nie przewidują ani nie gwarantują umieszczenia na playlistach.',
    whyTitle: 'DLACZEGO TEN PITCH DZIAŁA', copyPitch: 'KOPIUJ PITCH', copied: 'SKOPIOWANO', regenerate: 'GENERUJ PONOWNIE',
    evidenceUsed: 'ŚLAD DOWODÓW',
    aiDetected: 'WYKRYTE PRZEZ AI', artistFinal: 'POTWIERDZONE PRZEZ ARTYSTĘ / FINALNE',
    genreLimit: 'Wybierz maksymalnie 3 finalne gatunki.', draftStatus: 'WYGENEROWANO SZKIC REDAKCYJNY',
    reviewMicrocopy: 'Potraktuj tę wersję jako szkic redakcyjny i przed wysłaniem nadaj jej ostatecznie swój artystyczny głos.',
    unavailable: 'Generowanie pitchu jest chwilowo niedostępne. Analiza i mastering pozostają aktywne.',
    quotaRemaining: 'Pozostało {remaining} z {limit} AI Spotify Pitches.',
    quotaReached: 'Osiągnięto limit AI Spotify Pitch.', quotaUnavailable: 'Limit pitchy jest chwilowo niedostępny.', joinWaitlist: 'PRZEJDŹ DO LISTY',
    timingRecommended: 'Zalecenie: wyślij pitch około 14+ dni przed premierą.',
    timingReleaseRadar: 'Aby skorzystać z Release Radar, Spotify wskazuje co najmniej 7 dni przed premierą.',
    promotionLabels: PL_PROMOTION_LABELS,
    roleLabels: { artist: 'Artysta', producer: 'Producent', vocalist: 'Wokalista', songwriter: 'Autor utworu', instrumentalist: 'Instrumentalista', other: 'Inne' },
    sourceLabels: { cocotagger: 'Analiza audio', openai_music_analyst: 'Music Analyst', rqs_audio_dna: 'Audio DNA', artist_confirmed: 'Potwierdzone przez artystę', artist_supplied: 'Podane przez artystę' },
  },

  fr: {
    eyebrow: 'AI SPOTIFY PITCH', title: 'Spotify Pitch Generator — Intelligence de sortie par IA',
    subtitle: 'J’ai déjà écouté votre musique. Maintenant, dites-moi ce que vous seul pouvez savoir — si vous le souhaitez.',
    masterLabel: 'MASTER', masterDescription: 'Préparez l’audio pour la distribution.',
    pitchLabel: 'PITCH', pitchDescription: 'Préparez la sortie pour une présentation éditoriale.',
    evidenceReady: 'ÉLÉMENTS MUSICAUX', pitchReady: '✓ Pitch prêt à être généré',
    audioDna: 'Audio DNA', genre: 'Genre', astral: 'Atmosphère', instruments: 'Instruments', technical: 'Données techniques',
    genreFamily: 'Famille de genre', subgenres: 'Sous-genres', vocals: 'Voix', productionElements: 'Éléments de production', addLabel: 'Ajouter',
    confirmTitle: 'COMMENT SONNE VOTRE MUSIQUE',
    confirmSubtitle: 'L’analyse a détecté ces caractéristiques. Confirmez-les ou ajustez-les avant de générer le pitch.',
    detectedGenres: 'Genres détectés', atmosphere: 'Atmosphère', instrumentation: 'Instrumentation',
    allCorrect: 'TOUT EST CORRECT', adjust: 'AJUSTER', finishAdjusting: 'TERMINER LES AJUSTEMENTS',
    contextTitle: 'Contexte de la sortie — facultatif',
    contextSubtitle: 'Votre musique contient déjà assez d’éléments pour générer un pitch. Ajoutez du contexte uniquement si vous souhaitez le rendre plus personnel.',
    songStory: 'Racontez l’histoire du titre en une phrase. (facultatif)',
    releaseDifference: 'Qu’est-ce qui distingue ce titre ? (facultatif)',
    whyNow: 'Pourquoi sortir ce titre maintenant ? (facultatif)',
    whyNowHelp: 'Il peut s’agir d’une nouvelle phase, d’un retour, d’un anniversaire, d’une reconstruction, de la suite d’une histoire ou d’une autre raison réelle.',
    realContext: 'Y a-t-il une histoire réelle ou un contexte derrière ce titre ? (facultatif)',
    collaboration: 'Ce titre est-il une collaboration ?', collaborators: 'Qui a participé ?',
    collaboratorRole: 'Rôle facultatif', noRole: 'Aucun rôle sélectionné',
    culturalContext: 'Existe-t-il un lien culturel ou géographique pertinent ? (facultatif)',
    promotion: 'Comment comptez-vous promouvoir cette sortie ? (facultatif)', promotionDetails: 'Détails confirmés (facultatif)',
    generate: 'GÉNÉRER LE PITCH', generating: 'GÉNÉRATION…',
    metadataTitle: 'SUGGESTIONS DE MÉTADONNÉES SPOTIFY',
    metadataDisclaimer: 'Ce sont des suggestions. Spotify peut utiliser d’autres choix de métadonnées.',
    editorialPitchTitle: 'PITCH ÉDITORIAL', positioningTitle: 'ORIENTATIONS ÉDITORIALES POSSIBLES',
    positioningDisclaimer: 'Suggestions de positionnement. Elles ne prédisent ni ne garantissent une inclusion dans des playlists.',
    whyTitle: 'POURQUOI CE PITCH FONCTIONNE', copyPitch: 'COPIER LE PITCH', copied: 'COPIÉ', regenerate: 'GÉNÉRER À NOUVEAU',
    evidenceUsed: 'TRACE DES ÉLÉMENTS',
    aiDetected: 'DÉTECTÉ PAR IA', artistFinal: 'CONFIRMÉ PAR L’ARTISTE / FINAL',
    genreLimit: 'Choisissez jusqu’à 3 genres finaux.', draftStatus: 'BROUILLON ÉDITORIAL GÉNÉRÉ',
    reviewMicrocopy: 'Utilisez cette version comme base éditoriale et apportez la touche finale avec votre propre voix artistique avant l’envoi.',
    unavailable: 'La génération du pitch est momentanément indisponible. L’analyse et le mastering restent actifs.',
    quotaRemaining: 'Il vous reste {remaining} AI Spotify Pitches sur {limit}.',
    quotaReached: 'Vous avez atteint votre limite d’AI Spotify Pitches.', quotaUnavailable: 'Le quota de pitches est momentanément indisponible.', joinWaitlist: 'ALLER À LA LISTE D’ATTENTE',
    timingRecommended: 'Recommandé : envoyez votre pitch environ 14+ jours à l’avance.',
    timingReleaseRadar: 'Pour bénéficier de Release Radar, Spotify indique au moins 7 jours avant la sortie.',
    promotionLabels: FR_PROMOTION_LABELS,
    roleLabels: { artist: 'Artiste', producer: 'Producteur', vocalist: 'Chanteur', songwriter: 'Auteur-compositeur', instrumentalist: 'Instrumentiste', other: 'Autre' },
    sourceLabels: { cocotagger: 'Analyse audio', openai_music_analyst: 'Music Analyst', rqs_audio_dna: 'Audio DNA', artist_confirmed: 'Confirmé par l’artiste', artist_supplied: 'Fourni par l’artiste' },
  },

};


const EVIDENCE_TYPE_LABELS: Record<'en' | 'pt' | 'pl' | 'fr', Record<string, string>> = {
  en: {
    genre: 'Genre', astral: 'Astral', instrument: 'Instrument', vocals: 'Vocals',
    production_element: 'Production', bpm: 'BPM', energy: 'Energy', danceability: 'Danceability',
    sonic_characteristic: 'Sonic profile', collaborator: 'Collaboration',
    release_story: 'Release story', release_difference: 'Release difference',
    release_timing_context: 'Why now', real_context: 'Real context',
    cultural_context: 'Cultural context', promotion_plan: 'Promotion',
  },
  pt: {
    genre: 'Gênero', astral: 'Astral', instrument: 'Instrumento', vocals: 'Vocais',
    production_element: 'Produção', bpm: 'BPM', energy: 'Energia', danceability: 'Dançabilidade',
    sonic_characteristic: 'Perfil sonoro', collaborator: 'Colaboração',
    release_story: 'História do lançamento', release_difference: 'Diferencial do lançamento',
    release_timing_context: 'Por que agora', real_context: 'Contexto real',
    cultural_context: 'Contexto cultural', promotion_plan: 'Divulgação',
  },
  pl: {
    genre: 'Gatunek', astral: 'Nastrój', instrument: 'Instrument', vocals: 'Wokal',
    production_element: 'Produkcja', bpm: 'BPM', energy: 'Energia', danceability: 'Taneczność',
    sonic_characteristic: 'Profil brzmienia', collaborator: 'Współpraca',
    release_story: 'Historia wydania', release_difference: 'Wyróżnik wydania',
    release_timing_context: 'Dlaczego teraz', real_context: 'Kontekst rzeczywisty',
    cultural_context: 'Kontekst kulturowy', promotion_plan: 'Promocja',
  },
  fr: {
    genre: 'Genre', astral: 'Atmosphère', instrument: 'Instrument', vocals: 'Voix',
    production_element: 'Production', bpm: 'BPM', energy: 'Énergie', danceability: 'Dansabilité',
    sonic_characteristic: 'Profil sonore', collaborator: 'Collaboration',
    release_story: 'Histoire de la sortie', release_difference: 'Différence de la sortie',
    release_timing_context: 'Pourquoi maintenant', real_context: 'Contexte réel',
    cultural_context: 'Contexte culturel', promotion_plan: 'Promotion',
  },
};

@Component({ selector: 'app-spotify-pitch-panel', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './spotify-pitch-panel.html', styleUrls: ['./spotify-pitch-panel.scss'] })
export class SpotifyPitchPanelComponent implements OnChanges, OnInit {
  private readonly dsp = inject(DspService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  readonly lang = inject(LanguageService);

  @Input() analysisMetrics: MasteringV2Analysis | null = null;
  @Input() audioDna: AudioDnaPayload | null = null;
  @Input() audioIntelligence: AudioIntelligenceV2Payload | null = null;
  @Input() openAiMusicAnalyst: OpenAiMusicAnalystPayload | null = null;
  @Input() sourceGeneration: string | null = null;
  @Input() analysisId: string | null = null;
  @Input() persistedArtistConfirmation: ArtistConfirmedSound | null = null;
  @Input() persistedFlowStage: AudioIntelligenceFlowStage | null = null;
  @Input() persistedConfirmedAt: string | null = null;
  @Input() persistedPitchResult: SpotifyPitchResponse | null = null;

  songStory = ''; releaseDifference = ''; whyNow = ''; realContext = ''; isCollaboration = false;
  collaborators = ''; collaboratorRole: SpotifyPitchCollaboratorRole | '' = '';
  culturalGeographicContext = ''; promotionDetails = '';
  selectedPromotionChannels: SpotifyPitchPromotionChannel[] = [];
  confirmedGenres: string[] = []; confirmedAstral: string[] = []; confirmedInstruments: string[] = [];
  confirmedGenreFamily: string[] = []; confirmedSubgenres: string[] = []; confirmedMoods: string[] = [];
  confirmedVocals: string[] = []; confirmedProductionElements: string[] = [];
  readonly manualValues: Record<V2SoundCategory, string> = {
    genre_family: '', subgenres: '', moods: '', instruments: '', vocals: '', production_elements: '',
  };
  adjustingSound = false; soundConfirmed = false;

  readonly promotionOptions: SpotifyPitchPromotionChannel[] = ['Social media', 'YouTube', 'Music video', 'Live performance', 'Press / blogs', 'Ads', 'Mailing list', 'Website', 'Pre-save', 'No campaign planned'];
  readonly collaboratorRoles: SpotifyPitchCollaboratorRole[] = ['artist', 'producer', 'vocalist', 'songwriter', 'instrumentalist', 'other'];
  readonly requestState = signal<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  readonly result = signal<SpotifyPitchResponse | null>(null);
  readonly quota = signal<SpotifyPitchQuotaResponse | null>(null);
  readonly quotaState = signal<'loading' | 'ready' | 'unavailable'>('loading');
  readonly copied = signal(false);
  readonly confirmationSaving = signal(false);
  readonly copy = computed(() => COPY[this.lang.currentLang()]);
  private requestIndex = 0;
  private soundFingerprint = '';
  private pendingConfirmationMode: 'draft' | 'confirm' | null = null;

  ngOnInit(): void {
    this.loadQuota();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sourceGeneration'] && !changes['sourceGeneration'].firstChange) {
      this.requestIndex += 1; this.requestState.set('idle'); this.result.set(null); this.copied.set(false);
      this.resetArtistContext();
    }
    if (changes['sourceGeneration'] || changes['audioDna'] || changes['openAiMusicAnalyst'] || changes['audioIntelligence']) this.syncConfirmedSound();
    if (changes['persistedArtistConfirmation'] || changes['persistedConfirmedAt']
      || changes['persistedFlowStage'] || changes['persistedPitchResult'] || changes['audioIntelligence']) {
      this.applyPersistedState();
    }
  }

  hasAudioDna(): boolean { return this.audioDna?.status === 'available'; }
  isAudioIntelligenceV2(): boolean { return this.audioIntelligence?.analysisVersion === 'audio-intelligence-v2'; }
  genreValues(): string[] { return this.isAudioIntelligenceV2() ? [...(this.audioIntelligence?.genre_family ?? []), ...(this.audioIntelligence?.subgenres ?? [])] : this.semanticValues('genre'); }
  astralValues(): string[] { return this.isAudioIntelligenceV2() ? this.audioIntelligence?.moods ?? [] : this.semanticValues('mood'); }
  instrumentValues(): OpenAiMusicAnalystPayload['instruments'] { return this.openAiMusicAnalyst?.status === 'READY' ? this.openAiMusicAnalyst.instruments : []; }
  rawInstrumentNames(): string[] { return this.isAudioIntelligenceV2() ? this.audioIntelligence?.instruments ?? [] : this.instrumentValues().map(item => item.name); }
  hasTechnicalData(): boolean { return Boolean(this.analysisMetrics && this.audioDna?.technical); }
  hasAnyEvidence(): boolean { return this.hasAudioDna() || this.genreValues().length > 0 || this.astralValues().length > 0 || this.rawInstrumentNames().length > 0 || this.hasTechnicalData(); }
  canGeneratePitch(): boolean {
    return this.quotaState() === 'ready'
      && this.quota()?.spotify_pitch.can_generate === true
      && (!this.isAudioIntelligenceV2() || (this.soundConfirmed && Boolean(this.analysisId)));
  }
  quotaMessage(): string {
    const quota = this.quota()?.spotify_pitch;
    if (!quota) return this.copy().quotaUnavailable;
    if (!quota.can_generate) return this.copy().quotaReached;
    return this.copy().quotaRemaining
      .replace('{remaining}', String(quota.remaining))
      .replace('{limit}', String(quota.limit));
  }

  confirmSound(): void {
    if (this.isAudioIntelligenceV2() && this.analysisId) {
      this.persistConfirmation('confirm');
      return;
    }
    this.soundConfirmed = true;
    this.adjustingSound = false;
  }
  beginAdjustSound(): void {
    this.adjustingSound = true;
    this.soundConfirmed = false;
    this.persistDraft();
  }
  isSoundLabelSelected(category: 'genre' | 'astral' | 'instruments', value: string): boolean { return this.confirmedList(category).includes(value); }
  toggleSoundLabel(category: 'genre' | 'astral' | 'instruments', value: string): void {
    const current = this.confirmedList(category);
    if (category === 'genre' && !current.includes(value) && current.length >= 3) return;
    const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
    if (category === 'genre') this.confirmedGenres = next;
    if (category === 'astral') this.confirmedAstral = next;
    if (category === 'instruments') this.confirmedInstruments = next;
    this.soundConfirmed = false;
    this.persistDraft();
  }
  isSoundLabelDisabled(category: 'genre' | 'astral' | 'instruments', value: string): boolean {
    return !this.adjustingSound
      || (category === 'genre' && !this.confirmedGenres.includes(value) && this.confirmedGenres.length >= 3);
  }

  v2SuggestedValues(category: V2SoundCategory): string[] {
    if (this.audioIntelligence?.status !== 'READY') return [];
    return this.audioIntelligence[category];
  }

  genreFamilyOptions(): string[] {
    return this.audioIntelligence?.genre_family_taxonomy ?? [];
  }

  v2DisplayValues(category: V2SoundCategory): string[] {
    return [...new Set([...this.v2SuggestedValues(category), ...this.v2ConfirmedValues(category)])];
  }

  v2ConfirmedValues(category: V2SoundCategory): string[] {
    if (category === 'genre_family') return this.confirmedGenreFamily;
    if (category === 'subgenres') return this.confirmedSubgenres;
    if (category === 'moods') return this.confirmedMoods;
    if (category === 'instruments') return this.confirmedInstruments;
    if (category === 'vocals') return this.confirmedVocals;
    return this.confirmedProductionElements;
  }

  isV2LabelSelected(category: V2SoundCategory, value: string): boolean {
    return this.v2ConfirmedValues(category).includes(value);
  }

  manualValue(category: V2SoundCategory): string {
    return this.manualValues[category];
  }

  setManualValue(category: V2SoundCategory, value: string): void {
    this.manualValues[category] = value;
  }

  toggleV2Label(category: V2SoundCategory, value: string): void {
    if (!this.adjustingSound) return;
    const current = this.v2ConfirmedValues(category);
    this.setV2ConfirmedValues(category, current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value]);
    this.soundConfirmed = false;
    this.persistDraft();
  }

  addV2Label(category: V2SoundCategory): void {
    if (!this.adjustingSound) return;
    const value = this.manualValues[category].replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!value) return;
    if (category === 'genre_family' && !this.genreFamilyOptions().includes(value)) return;
    const current = this.v2ConfirmedValues(category);
    if (!current.some(item => item.toLocaleLowerCase('en-US') === value.toLocaleLowerCase('en-US'))) {
      this.setV2ConfirmedValues(category, [...current, value]);
    }
    this.manualValues[category] = '';
    this.soundConfirmed = false;
    this.persistDraft();
  }

  isPromotionSelected(channel: SpotifyPitchPromotionChannel): boolean { return this.selectedPromotionChannels.includes(channel); }
  togglePromotion(channel: SpotifyPitchPromotionChannel): void {
    if (channel === 'No campaign planned') {
      this.selectedPromotionChannels = this.isPromotionSelected(channel) ? [] : [channel];
      return;
    }
    const withoutNone = this.selectedPromotionChannels.filter(item => item !== 'No campaign planned');
    this.selectedPromotionChannels = withoutNone.includes(channel) ? withoutNone.filter(item => item !== channel) : [...withoutNone, channel];
  }

  generatePitch(): void {
    if (this.requestState() === 'loading' || !this.hasAnyEvidence() || !this.canGeneratePitch()) return;
    const requestIndex = ++this.requestIndex;
    const sourceGeneration = this.sourceGeneration;
    this.requestState.set('loading'); this.copied.set(false);
    this.dsp.generateSpotifyPitch(this.buildRequest(), crypto.randomUUID()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        if (requestIndex !== this.requestIndex || sourceGeneration !== this.sourceGeneration) return;
        if (response.quota) this.applyQuota(response.quota);
        this.result.set(response); this.requestState.set(response.status === 'READY' ? 'ready' : 'unavailable');
      },
      error: (error: HttpErrorResponse) => {
        if (requestIndex !== this.requestIndex || sourceGeneration !== this.sourceGeneration) return;
        const quota = error.error?.quota as SpotifyPitchQuotaResponse | undefined;
        if (quota) this.applyQuota(quota);
        this.result.set(null); this.requestState.set('unavailable');
      },
    });
  }

  async copyPitch(): Promise<void> {
    const pitch = this.result()?.editorial_pitch;
    if (!pitch || !isPlatformBrowser(this.platformId) || !navigator.clipboard) return;
    await navigator.clipboard.writeText(pitch); this.copied.set(true);
  }
  sourceLabel(evidence: SpotifyPitchEvidence): string { return this.copy().sourceLabels[evidence.source]; }
  evidenceTypeLabel(evidence: SpotifyPitchEvidence): string {
    return EVIDENCE_TYPE_LABELS[this.lang.currentLang()][evidence.type] ?? evidence.type;
  }

  private confirmedList(category: 'genre' | 'astral' | 'instruments'): string[] {
    return category === 'genre' ? this.confirmedGenres : category === 'astral' ? this.confirmedAstral : this.confirmedInstruments;
  }
  private setV2ConfirmedValues(category: V2SoundCategory, values: string[]): void {
    if (category === 'genre_family') this.confirmedGenreFamily = values.slice(0, 2);
    if (category === 'subgenres') this.confirmedSubgenres = values.slice(0, 3);
    if (category === 'moods') this.confirmedMoods = values.slice(0, 3);
    if (category === 'instruments') this.confirmedInstruments = values.slice(0, 6);
    if (category === 'vocals') this.confirmedVocals = values.slice(0, 4);
    if (category === 'production_elements') this.confirmedProductionElements = values.slice(0, 6);
  }
  private loadQuota(): void {
    this.quotaState.set('loading');
    this.dsp.getSpotifyPitchQuota().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: quota => this.applyQuota(quota),
      error: () => { this.quota.set(null); this.quotaState.set('unavailable'); },
    });
  }
  private applyQuota(quota: SpotifyPitchQuotaResponse): void {
    this.quota.set(quota);
    this.quotaState.set('ready');
  }
  private syncConfirmedSound(): void {
    const genres = this.genreValues(); const astral = this.astralValues(); const instruments = this.rawInstrumentNames();
    const v2 = this.audioIntelligence;
    const fingerprint = JSON.stringify([this.sourceGeneration, genres, astral, instruments, v2]);
    if (fingerprint === this.soundFingerprint) return;
    this.soundFingerprint = fingerprint;
    this.confirmedGenres = genres.filter(value => value.trim().toLocaleLowerCase('en-US') !== 'epic').slice(0, 3);
    this.confirmedAstral = [...astral]; this.confirmedInstruments = [...instruments];
    this.confirmedGenreFamily = v2?.status === 'READY' ? [...v2.genre_family] : [];
    this.confirmedSubgenres = v2?.status === 'READY' ? [...v2.subgenres] : [];
    this.confirmedMoods = v2?.status === 'READY' ? [...v2.moods] : [];
    this.confirmedVocals = v2?.status === 'READY' ? [...v2.vocals] : [];
    this.confirmedProductionElements = v2?.status === 'READY' ? [...v2.production_elements] : [];
    this.adjustingSound = false; this.soundConfirmed = false;
  }
  private resetArtistContext(): void {
    this.songStory = ''; this.releaseDifference = ''; this.whyNow = ''; this.realContext = ''; this.isCollaboration = false;
    this.collaborators = ''; this.collaboratorRole = ''; this.culturalGeographicContext = '';
    this.promotionDetails = ''; this.selectedPromotionChannels = [];
  }
  private semanticValues(category: 'genre' | 'mood'): string[] {
    const semantic = this.audioDna?.semantic;
    if (semantic?.status !== 'READY' || semantic.source_generation !== semantic.analyzer_generation
      || (this.sourceGeneration && semantic.source_generation !== this.sourceGeneration)) return [];
    return (semantic.categories[category] ?? []).map(item => item.tag).filter(Boolean);
  }
  private sonicCharacteristics(): string[] {
    const technical = this.audioDna?.technical;
    if (!technical) return [];
    const result: string[] = [];
    if (technical.brightness !== undefined) result.push(technical.brightness >= 0.6 ? 'Bright tonal balance' : 'Warm tonal balance');
    if (technical.stereo_width !== undefined) result.push(technical.stereo_width >= 0.6 ? 'Wide stereo image' : 'Focused stereo image');
    if (technical.transient_strength !== undefined && technical.transient_strength >= 0.6) result.push('Pronounced transients');
    if (technical.low_end_density !== undefined && technical.low_end_density >= 0.6) result.push('Strong low-end density');
    if (technical.dynamic_density !== undefined && technical.dynamic_density >= 0.6) result.push('Dense dynamics');
    return result;
  }
  private buildRequest(): SpotifyPitchRequest {
    const music = this.audioDna?.music;
    const collaboratorNames = this.isCollaboration ? this.collaborators.split(',').map(value => value.trim()).filter(Boolean) : [];
    const shared = {
      output_language: this.lang.currentLang(),
      artist_context: {
        song_story: this.songStory.trim(), release_difference: this.releaseDifference.trim(), real_context: this.realContext.trim(),
        why_now: this.whyNow.trim(),
        is_collaboration: this.isCollaboration,
        collaborators: collaboratorNames.map(name => ({ name, role: this.collaboratorRole || null })),
        cultural_geographic_context: this.culturalGeographicContext.trim(),
      },
      promotion_context: { channels: [...this.selectedPromotionChannels], confirmed_details: this.promotionDetails.trim() },
    };
    if (this.isAudioIntelligenceV2()) {
      return { analysis_id: this.analysisId ?? undefined, release_intelligence: {
        ...shared,
        analysis_version: 'audio-intelligence-v2',
        dsp: {
          bpm: music?.bpm?.value ?? null,
          energy: music?.energy ?? null,
          danceability: music?.danceability ?? null,
          sonic_characteristics: this.sonicCharacteristics(),
        },
        artist_confirmed_sound: {
          confirmed: true,
          genre_family: [...this.confirmedGenreFamily],
          subgenres: [...this.confirmedSubgenres],
          moods: [...this.confirmedMoods],
          instruments: [...this.confirmedInstruments],
          vocals: [...this.confirmedVocals],
          production_elements: [...this.confirmedProductionElements],
        },
      } };
    }
    return { release_intelligence: {
      ...shared,
      raw_audio_evidence: {
        genre: this.genreValues(), astral: this.astralValues(), instruments: this.instrumentValues(),
        vocals: this.openAiMusicAnalyst?.status === 'READY' ? this.openAiMusicAnalyst.vocals : null,
        production_elements: this.openAiMusicAnalyst?.status === 'READY' ? this.openAiMusicAnalyst.production_elements : [],
        bpm: music?.bpm?.value ?? null, energy: music?.energy ?? null, danceability: music?.danceability ?? null,
        sonic_characteristics: this.sonicCharacteristics(),
      },
      artist_confirmed_sound: { confirmed: this.soundConfirmed, genre: [...this.confirmedGenres], astral: [...this.confirmedAstral], instruments: [...this.confirmedInstruments] },
    } };
  }

  private currentConfirmedSound(): ArtistConfirmedSound {
    return {
      genre_family: [...this.confirmedGenreFamily],
      subgenres: [...this.confirmedSubgenres],
      moods: [...this.confirmedMoods],
      instruments: [...this.confirmedInstruments],
      vocals: [...this.confirmedVocals],
      production_elements: [...this.confirmedProductionElements],
    };
  }

  private persistDraft(): void {
    if (!this.isAudioIntelligenceV2() || !this.analysisId) return;
    this.persistConfirmation('draft');
  }

  private persistConfirmation(mode: 'draft' | 'confirm'): void {
    const analysisId = this.analysisId;
    if (!analysisId) return;
    if (this.confirmationSaving()) {
      this.pendingConfirmationMode = mode === 'confirm' ? 'confirm' : (this.pendingConfirmationMode ?? 'draft');
      return;
    }
    this.confirmationSaving.set(true);
    this.dsp.saveArtistConfirmation(analysisId, {
      mode,
      artist_confirmed_sound: this.currentConfirmedSound(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: restored => {
        this.confirmationSaving.set(false);
        this.persistedArtistConfirmation = restored.artist_confirmed_sound;
        this.persistedFlowStage = restored.flow_stage;
        this.persistedConfirmedAt = restored.confirmed_at;
        this.soundConfirmed = mode === 'confirm' && Boolean(restored.confirmed_at);
        if (this.soundConfirmed) this.adjustingSound = false;
        this.flushPendingConfirmation();
      },
      error: () => {
        this.confirmationSaving.set(false);
        this.soundConfirmed = false;
        this.flushPendingConfirmation();
      },
    });
  }

  private flushPendingConfirmation(): void {
    const pending = this.pendingConfirmationMode;
    this.pendingConfirmationMode = null;
    if (pending) this.persistConfirmation(pending);
  }

  private applyPersistedState(): void {
    const persisted = this.persistedArtistConfirmation;
    if (persisted) {
      this.confirmedGenreFamily = [...persisted.genre_family];
      this.confirmedSubgenres = [...persisted.subgenres];
      this.confirmedMoods = [...persisted.moods];
      this.confirmedInstruments = [...persisted.instruments];
      this.confirmedVocals = [...persisted.vocals];
      this.confirmedProductionElements = [...persisted.production_elements];
      this.soundConfirmed = Boolean(this.persistedConfirmedAt)
        && (this.persistedFlowStage === 'artist_confirmed' || this.persistedFlowStage === 'pitch_ready');
      this.adjustingSound = !this.soundConfirmed;
    }
    if (this.persistedPitchResult?.status === 'READY') {
      this.result.set(this.persistedPitchResult);
      this.requestState.set('ready');
      this.soundConfirmed = true;
      this.adjustingSound = false;
    }
  }
}
