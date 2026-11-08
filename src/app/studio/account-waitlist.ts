import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService, UiLanguage } from '../services/language.service';
import { PlanInterest, WaitlistPreferenceService } from '../services/waitlist-preference.service';

type AccountWaitlistCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  undecided: string;
  save: string;
  saving: string;
  saved: string;
  missing: string;
  join: string;
  error: string;
};

const COPY: Record<UiLanguage, AccountWaitlistCopy> = {
  pt: {
    eyebrow: 'WAITLIST // PREFERÊNCIA', title: 'Minha lista de espera',
    intro: 'Qual plano você considera para o lançamento? Você pode alterar esta preferência a qualquer momento.',
    undecided: 'Ainda não decidi', save: 'SALVAR PREFERÊNCIA', saving: 'SALVANDO...',
    saved: 'Preferência atualizada.', missing: 'Sua conta ainda não está na waitlist com este e-mail verificado.',
    join: 'ENTRAR NA WAITLIST', error: 'Não foi possível carregar sua preferência agora.',
  },
  en: {
    eyebrow: 'WAITLIST // PREFERENCE', title: 'My waitlist',
    intro: 'Which launch plan are you considering? You can change this preference at any time.',
    undecided: 'I have not decided yet', save: 'SAVE PREFERENCE', saving: 'SAVING...',
    saved: 'Preference updated.', missing: 'Your account is not on the waitlist with this verified email yet.',
    join: 'JOIN THE WAITLIST', error: 'Your preference could not be loaded right now.',
  },
  pl: {
    eyebrow: 'LISTA OCZEKUJĄCYCH // PREFERENCJA', title: 'Moja lista oczekujących',
    intro: 'Który plan premierowy rozważasz? Możesz zmienić tę preferencję w dowolnym momencie.',
    undecided: 'Jeszcze nie podjęto decyzji', save: 'ZAPISZ PREFERENCJĘ', saving: 'ZAPISYWANIE...',
    saved: 'Preferencja została zaktualizowana.', missing: 'Konto z tym zweryfikowanym adresem e-mail nie jest jeszcze na liście.',
    join: 'DOŁĄCZ DO LISTY', error: 'Nie można teraz wczytać preferencji.',
  },
  fr: {
    eyebrow: 'LISTE D’ATTENTE // PRÉFÉRENCE', title: 'Ma liste d’attente',
    intro: 'Quelle offre envisagez-vous pour le lancement ? Vous pouvez modifier ce choix à tout moment.',
    undecided: 'Je n’ai pas encore décidé', save: 'ENREGISTRER LA PRÉFÉRENCE', saving: 'ENREGISTREMENT...',
    saved: 'Préférence mise à jour.', missing: 'Votre compte avec cet e-mail vérifié n’est pas encore sur la liste.',
    join: 'REJOINDRE LA LISTE', error: 'Impossible de charger votre préférence pour le moment.',
  },
};

@Component({
  selector: 'app-account-waitlist',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './account-waitlist.html',
  styleUrl: './account-waitlist.scss',
})
export class AccountWaitlistComponent implements OnInit {
  private readonly service = inject(WaitlistPreferenceService);
  private readonly lang = inject(LanguageService);
  readonly copy = computed(() => COPY[this.lang.currentLang()]);
  readonly state = signal<'loading' | 'ready' | 'missing' | 'error'>('loading');
  readonly selected = signal<PlanInterest>('undecided');
  readonly persisted = signal<PlanInterest>('undecided');
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly dirty = computed(() => this.selected() !== this.persisted());
  readonly options: ReadonlyArray<{ value: PlanInterest; label: string }> = [
    { value: 'master', label: 'MASTER' },
    { value: 'plus', label: 'PLUS' },
    { value: 'pro', label: 'PRO' },
  ];

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  select(plan: PlanInterest): void {
    this.selected.set(plan);
    this.saved.set(false);
  }

  async save(): Promise<void> {
    if (this.saving() || !this.dirty()) return;
    this.saving.set(true);
    this.saved.set(false);
    try {
      const result = await this.service.update(this.selected());
      if (!result.joined) {
        this.state.set('missing');
        return;
      }
      const plan = result.plan_interest ?? this.selected();
      this.selected.set(plan);
      this.persisted.set(plan);
      this.saved.set(true);
    } catch {
      this.state.set('error');
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.state.set('loading');
    try {
      const result = await this.service.load();
      if (!result.joined) {
        this.state.set('missing');
        return;
      }
      const plan = result.plan_interest ?? 'undecided';
      this.selected.set(plan);
      this.persisted.set(plan);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
