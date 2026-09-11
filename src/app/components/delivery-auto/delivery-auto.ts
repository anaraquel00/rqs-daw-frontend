import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { LanguageService, UiLanguage } from '../../services/language.service';
import {
  MasteringAutoReasonCode,
  MasteringAutoRecommendation,
} from '../../services/mastering-types';

export type DeliveryAutoUiState =
  | 'empty'
  | 'loading'
  | 'recommendation'
  | 'no_change'
  | 'abstain'
  | 'stale'
  | 'error';

type DeliveryAutoCopy = {
  eyebrow: string;
  title: string;
  description: string;
  empty: string;
  loading: string;
  recommendation: string;
  noChange: string;
  abstain: string;
  stale: string;
  error: string;
  analyzeFirst: string;
  signIn: string;
  request: string;
  recalculate: string;
  current: string;
  recommended: string;
  policyDefault: string;
  policy: string;
  why: string;
  confirmation: string;
  apply: string;
  reviewOnly: string;
};

const COPY: Record<UiLanguage, DeliveryAutoCopy> = {
  en: {
    eyebrow: 'DELIVERY AUTO', title: 'Delivery recommendation',
    description: 'A deterministic policy review. AUTO proposes; you decide.',
    empty: 'Request a recommendation after the source analysis is ready.',
    loading: 'Reviewing the selected delivery policy…',
    recommendation: 'RECOMMENDATION AVAILABLE', noChange: 'NO CHANGE RECOMMENDED',
    abstain: 'INFO', stale: 'OUTDATED RECOMMENDATION', error: 'RECOMMENDATION UNAVAILABLE',
    analyzeFirst: 'Complete source analysis before requesting AUTO.',
    signIn: 'Sign in to request a delivery recommendation.',
    request: 'Review with Delivery AUTO', recalculate: 'Recalculate recommendation',
    current: 'Current Requested LUFS', recommended: 'Recommended Requested LUFS',
    policyDefault: 'Policy default', policy: 'Policy', why: 'Why',
    confirmation: 'Applying changes only Requested LUFS. Preview remains a separate action.',
    apply: 'Apply Requested LUFS', reviewOnly: 'Review this guidance before requesting Preview.',
  },
  pt: {
    eyebrow: 'DELIVERY AUTO', title: 'Recomendação de delivery',
    description: 'Uma revisão determinística da policy. O AUTO propõe; você decide.',
    empty: 'Peça uma recomendação quando a análise da source estiver pronta.',
    loading: 'Revisando a policy do delivery selecionado…',
    recommendation: 'RECOMENDAÇÃO DISPONÍVEL', noChange: 'NENHUMA MUDANÇA RECOMENDADA',
    abstain: 'INFO', stale: 'RECOMENDAÇÃO DESATUALIZADA', error: 'RECOMENDAÇÃO INDISPONÍVEL',
    analyzeFirst: 'Conclua a análise da source antes de pedir o AUTO.',
    signIn: 'Entre na sua conta para pedir uma recomendação de delivery.',
    request: 'Revisar com Delivery AUTO', recalculate: 'Recalcular recomendação',
    current: 'Requested LUFS atual', recommended: 'Requested LUFS recomendado',
    policyDefault: 'Padrão da policy', policy: 'Policy', why: 'Motivo',
    confirmation: 'Aplicar altera somente Requested LUFS. A prévia continua sendo uma ação separada.',
    apply: 'Aplicar Requested LUFS', reviewOnly: 'Revise esta orientação antes de pedir a prévia.',
  },
  pl: {
    eyebrow: 'DELIVERY AUTO', title: 'Rekomendacja dystrybucji',
    description: 'Deterministyczna ocena polityki. AUTO proponuje, a decyzja należy do Ciebie.',
    empty: 'Poproś o rekomendację, gdy analiza źródła będzie gotowa.',
    loading: 'Sprawdzanie wybranej polityki dystrybucji…',
    recommendation: 'REKOMENDACJA DOSTĘPNA', noChange: 'BRAK ZALECANYCH ZMIAN',
    abstain: 'INFO', stale: 'NIEAKTUALNA REKOMENDACJA', error: 'REKOMENDACJA NIEDOSTĘPNA',
    analyzeFirst: 'Zakończ analizę źródła przed użyciem AUTO.',
    signIn: 'Zaloguj się, aby poprosić o rekomendację dystrybucji.',
    request: 'Sprawdź z Delivery AUTO', recalculate: 'Przelicz rekomendację',
    current: 'Bieżące Requested LUFS', recommended: 'Zalecane Requested LUFS',
    policyDefault: 'Wartość domyślna polityki', policy: 'Polityka', why: 'Dlaczego',
    confirmation: 'Zastosowanie zmienia tylko Requested LUFS. Preview pozostaje osobną czynnością.',
    apply: 'Zastosuj Requested LUFS', reviewOnly: 'Sprawdź tę wskazówkę przed wygenerowaniem Preview.',
  },
  fr: {
    eyebrow: 'DELIVERY AUTO', title: 'Recommandation de diffusion',
    description: 'Une vérification déterministe de la politique. AUTO propose, vous décidez.',
    empty: 'Demandez une recommandation lorsque l’analyse de la source est prête.',
    loading: 'Vérification de la politique de diffusion sélectionnée…',
    recommendation: 'RECOMMANDATION DISPONIBLE', noChange: 'AUCUN CHANGEMENT RECOMMANDÉ',
    abstain: 'INFO', stale: 'RECOMMANDATION OBSOLÈTE', error: 'RECOMMANDATION INDISPONIBLE',
    analyzeFirst: 'Terminez l’analyse de la source avant de demander AUTO.',
    signIn: 'Connectez-vous pour demander une recommandation de diffusion.',
    request: 'Vérifier avec Delivery AUTO', recalculate: 'Recalculer la recommandation',
    current: 'Requested LUFS actuel', recommended: 'Requested LUFS recommandé',
    policyDefault: 'Valeur par défaut de la politique', policy: 'Politique', why: 'Pourquoi',
    confirmation: 'Appliquer modifie uniquement Requested LUFS. La prévisualisation reste une action séparée.',
    apply: 'Appliquer Requested LUFS', reviewOnly: 'Consultez ce conseil avant de demander la prévisualisation.',
  },
};

const REASON_COPY: Record<UiLanguage, Record<MasteringAutoReasonCode, string>> = {
  en: {
    DELIVERY_LUFS_WITHIN_RANGE: 'Source loudness is within the selected delivery range.',
    DELIVERY_LUFS_BELOW_RANGE: 'Source loudness is below the selected delivery range.',
    DELIVERY_LUFS_ABOVE_RANGE: 'Source loudness is above the selected delivery range.',
    TRUE_PEAK_WITHIN_CEILING: 'True Peak is within the selected delivery ceiling.',
    TRUE_PEAK_ABOVE_CEILING: 'True Peak exceeds the selected delivery ceiling and needs attention.',
    CUSTOM_LUFS_DIFFERS_FROM_POLICY: 'The custom Requested LUFS differs from the selected policy target.',
    DELIVERY_INTENT_REVIEW_SUGGESTED: 'Review the delivery choice separately; AUTO will not change it.',
    INSUFFICIENT_CREATIVE_EVIDENCE: 'The measurements do not support a safe creative recommendation.',
    KEEP_CURRENT_ATMOSPHERE: 'Atmosphere remains under your manual control.',
    KEEP_CURRENT_INTENSITY: 'Intensity remains under your manual control.',
    ANALYZER_DATA_UNAVAILABLE: 'Source analysis is unavailable.',
    ANALYZER_DATA_STALE: 'The source changed after analysis. Analyze it again.',
    POLICY_UNAVAILABLE: 'No objective policy is available for this delivery selection.',
  },
  pt: {
    DELIVERY_LUFS_WITHIN_RANGE: 'O loudness da source está dentro da faixa do delivery selecionado.',
    DELIVERY_LUFS_BELOW_RANGE: 'O loudness da source está abaixo da faixa do delivery selecionado.',
    DELIVERY_LUFS_ABOVE_RANGE: 'O loudness da source está acima da faixa do delivery selecionado.',
    TRUE_PEAK_WITHIN_CEILING: 'O True Peak está dentro do teto do delivery selecionado.',
    TRUE_PEAK_ABOVE_CEILING: 'O True Peak ultrapassa o teto do delivery e precisa de atenção.',
    CUSTOM_LUFS_DIFFERS_FROM_POLICY: 'O Requested LUFS personalizado difere do target da policy selecionada.',
    DELIVERY_INTENT_REVIEW_SUGGESTED: 'Revise o destino separadamente; o AUTO não irá alterá-lo.',
    INSUFFICIENT_CREATIVE_EVIDENCE: 'As medições não sustentam uma recomendação criativa segura.',
    KEEP_CURRENT_ATMOSPHERE: 'Atmosphere permanece sob seu controle manual.',
    KEEP_CURRENT_INTENSITY: 'Intensity permanece sob seu controle manual.',
    ANALYZER_DATA_UNAVAILABLE: 'A análise da source não está disponível.',
    ANALYZER_DATA_STALE: 'A source mudou depois da análise. Analise novamente.',
    POLICY_UNAVAILABLE: 'Não há policy objetiva para esta seleção de delivery.',
  },
  pl: {
    DELIVERY_LUFS_WITHIN_RANGE: 'Głośność źródła mieści się w zakresie wybranej dystrybucji.',
    DELIVERY_LUFS_BELOW_RANGE: 'Głośność źródła jest poniżej zakresu wybranej dystrybucji.',
    DELIVERY_LUFS_ABOVE_RANGE: 'Głośność źródła jest powyżej zakresu wybranej dystrybucji.',
    TRUE_PEAK_WITHIN_CEILING: 'True Peak mieści się w limicie wybranej dystrybucji.',
    TRUE_PEAK_ABOVE_CEILING: 'True Peak przekracza limit dystrybucji i wymaga uwagi.',
    CUSTOM_LUFS_DIFFERS_FROM_POLICY: 'Niestandardowe Requested LUFS różni się od celu wybranej polityki.',
    DELIVERY_INTENT_REVIEW_SUGGESTED: 'Sprawdź wybór dystrybucji osobno; AUTO go nie zmieni.',
    INSUFFICIENT_CREATIVE_EVIDENCE: 'Pomiary nie uzasadniają bezpiecznej rekomendacji kreatywnej.',
    KEEP_CURRENT_ATMOSPHERE: 'Atmosphere pozostaje pod Twoją ręczną kontrolą.',
    KEEP_CURRENT_INTENSITY: 'Intensity pozostaje pod Twoją ręczną kontrolą.',
    ANALYZER_DATA_UNAVAILABLE: 'Analiza źródła jest niedostępna.',
    ANALYZER_DATA_STALE: 'Źródło zmieniło się po analizie. Przeanalizuj je ponownie.',
    POLICY_UNAVAILABLE: 'Dla tego wyboru dystrybucji nie ma obiektywnej polityki.',
  },
  fr: {
    DELIVERY_LUFS_WITHIN_RANGE: 'Le niveau de la source est dans la plage de diffusion sélectionnée.',
    DELIVERY_LUFS_BELOW_RANGE: 'Le niveau de la source est sous la plage de diffusion sélectionnée.',
    DELIVERY_LUFS_ABOVE_RANGE: 'Le niveau de la source dépasse la plage de diffusion sélectionnée.',
    TRUE_PEAK_WITHIN_CEILING: 'Le True Peak respecte le plafond de diffusion sélectionné.',
    TRUE_PEAK_ABOVE_CEILING: 'Le True Peak dépasse le plafond de diffusion et nécessite votre attention.',
    CUSTOM_LUFS_DIFFERS_FROM_POLICY: 'Le Requested LUFS personnalisé diffère de la cible de la politique.',
    DELIVERY_INTENT_REVIEW_SUGGESTED: 'Vérifiez le choix de diffusion séparément ; AUTO ne le modifiera pas.',
    INSUFFICIENT_CREATIVE_EVIDENCE: 'Les mesures ne permettent pas une recommandation créative sûre.',
    KEEP_CURRENT_ATMOSPHERE: 'Atmosphere reste sous votre contrôle manuel.',
    KEEP_CURRENT_INTENSITY: 'Intensity reste sous votre contrôle manuel.',
    ANALYZER_DATA_UNAVAILABLE: 'L’analyse de la source est indisponible.',
    ANALYZER_DATA_STALE: 'La source a changé après l’analyse. Analysez-la de nouveau.',
    POLICY_UNAVAILABLE: 'Aucune politique objective ne correspond à cette diffusion.',
  },
};

@Component({
  selector: 'app-delivery-auto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './delivery-auto.html',
  styleUrl: './delivery-auto.scss',
})
export class DeliveryAutoComponent {
  @Input() state: DeliveryAutoUiState = 'empty';
  @Input() recommendation: MasteringAutoRecommendation | null = null;
  @Input() currentRequestedLufs: number | null = null;
  @Input() policyTargetLufs: number | null = null;
  @Input() canRequest = false;
  @Input() authenticated = false;

  @Output() requestRecommendation = new EventEmitter<void>();
  @Output() applyRequestedLufs = new EventEmitter<void>();

  private readonly lang = inject(LanguageService);
  readonly copy = computed(() => COPY[this.lang.currentLang()]);

  stateLabel(): string {
    const copy = this.copy();
    if (this.state === 'recommendation') return copy.recommendation;
    if (this.state === 'no_change') return copy.noChange;
    if (this.state === 'abstain') return copy.abstain;
    if (this.state === 'stale') return copy.stale;
    if (this.state === 'error') return copy.error;
    return '';
  }

  emptyDetail(): string {
    if (!this.authenticated) return this.copy().signIn;
    if (!this.canRequest) return this.copy().analyzeFirst;
    return this.copy().empty;
  }

  reasonText(code: MasteringAutoReasonCode): string {
    return REASON_COPY[this.lang.currentLang()][code];
  }

  proposedRequestedLufs(): number | null {
    const value = this.recommendation?.proposed_patch.requestedLufs;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  canApply(): boolean {
    return this.state === 'recommendation'
      && this.recommendation?.requires_confirmation === true
      && this.proposedRequestedLufs() !== null;
  }

  currentSetting(): string {
    if (this.currentRequestedLufs !== null) return this.formatLufs(this.currentRequestedLufs);
    const target = this.policyTargetLufs;
    return target === null
      ? this.copy().policyDefault
      : `${this.copy().policyDefault} · ${this.formatLufs(target)}`;
  }

  policyContext(): string {
    const recommendation = this.recommendation;
    if (!recommendation) return '';
    const context = recommendation.delivery_policy_id?.split(':').join(' · ') || '';
    const source = recommendation.delivery_policy_source || '';
    return [context, source].filter(Boolean).join(' — ');
  }

  formatLufs(value: number): string {
    return `${value.toFixed(1)} LUFS`;
  }
}
