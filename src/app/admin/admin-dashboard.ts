import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService, UiLanguage } from '../services/language.service';
import { SeoService } from '../services/seo.service';
import { AdminSessionService, WaitlistSummary } from './admin-session.service';

type AdminCopy = {
  eyebrow: string;
  title: string;
  description: string;
  total: string;
  undecided: string;
  legacy: string;
  generated: string;
  error: string;
  back: string;
};

const COPY: Record<UiLanguage, AdminCopy> = {
  pt: {
    eyebrow: 'RQS STUDIO // COMMERCIAL ADMIN', title: 'Interesse por plano',
    description: 'Distribuição agregada da waitlist. Nenhum dado pessoal é exposto.',
    total: 'TOTAL', undecided: 'INDECISOS', legacy: 'SEM PREFERÊNCIA LEGADA', generated: 'ATUALIZADO',
    error: 'Não foi possível carregar as estatísticas agregadas.', back: 'VOLTAR AO STUDIO',
  },
  en: {
    eyebrow: 'RQS STUDIO // COMMERCIAL ADMIN', title: 'Plan interest',
    description: 'Aggregate waitlist distribution. No personal data is exposed.',
    total: 'TOTAL', undecided: 'UNDECIDED', legacy: 'LEGACY UNSET', generated: 'UPDATED',
    error: 'The aggregate statistics could not be loaded.', back: 'BACK TO STUDIO',
  },
  pl: {
    eyebrow: 'RQS STUDIO // ADMIN KOMERCYJNY', title: 'Zainteresowanie planami',
    description: 'Zbiorczy rozkład listy oczekujących. Dane osobowe nie są ujawniane.',
    total: 'ŁĄCZNIE', undecided: 'NIEZDECYDOWANI', legacy: 'BRAK STARSZEJ PREFERENCJI', generated: 'AKTUALIZACJA',
    error: 'Nie udało się wczytać statystyk zbiorczych.', back: 'WRÓĆ DO STUDIO',
  },
  fr: {
    eyebrow: 'RQS STUDIO // ADMIN COMMERCIAL', title: 'Intérêt par offre',
    description: 'Répartition agrégée de la liste d’attente. Aucune donnée personnelle n’est exposée.',
    total: 'TOTAL', undecided: 'INDÉCIS', legacy: 'PRÉFÉRENCE HISTORIQUE ABSENTE', generated: 'MISE À JOUR',
    error: 'Impossible de charger les statistiques agrégées.', back: 'RETOUR AU STUDIO',
  },
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboardComponent implements OnInit {
  private readonly admin = inject(AdminSessionService);
  private readonly language = inject(LanguageService);
  private readonly seo = inject(SeoService);
  readonly copy = computed(() => COPY[this.language.currentLang()]);
  readonly summary = signal<WaitlistSummary | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  constructor() {
    this.seo.update({
      title: 'RQS Studio Commercial Admin',
      description: 'Painel administrativo comercial do RQS Studio.',
      url: 'https://studio.raquelsynths.com/admin',
      robots: 'noindex, nofollow',
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      this.summary.set(await this.admin.loadWaitlistSummary());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
