import {
  Component,
  Input,
  inject,
  signal,
} from '@angular/core';

import {
  AdminAction,
  AdminActionDesiredState,
  AdminActionReason,
  AdminActionTargetKind,
  AdminApiError,
  AdminApiService,
} from '../core/admin-api.service';

@Component({
  selector: 'rqs-review-action-control',
  standalone: true,
  template: `
    @if (!expanded()) {
      <button
        type="button"
        class="review-trigger"
        data-testid="review-trigger"
        (click)="open()"
      >
        FLAG FOR REVIEW
      </button>
    } @else {
      <section
        class="action-console"
        aria-label="Controlled review action"
      >
        <header>
          <div>
            <p>CONTROLLED ACTION</p>
            <strong>REVIEW FLAG</strong>
          </div>
          <span>ADMIN DATA ONLY</span>
        </header>

        <dl class="target">
          <div>
            <dt>TARGET</dt>
            <dd>{{ targetLabel }}</dd>
          </div>
          <div>
            <dt>TYPE</dt>
            <dd>{{ targetKindLabel() }}</dd>
          </div>
        </dl>

        @if (!pendingAction()) {
          <div class="action-fields">
            <label>
              <span>STATE</span>
              <select
                [value]="desiredState()"
                [disabled]="busy()"
                (change)="setDesiredState($event)"
              >
                <option value="open">
                  OPEN
                </option>
                <option value="resolved">
                  RESOLVED
                </option>
              </select>
            </label>

            <label>
              <span>REASON</span>
              <select
                [value]="reason()"
                [disabled]="busy()"
                (change)="setReason($event)"
              >
                <option value="manual_review">
                  MANUAL REVIEW
                </option>
                <option value="data_quality">
                  DATA QUALITY
                </option>
                <option value="follow_up">
                  FOLLOW UP
                </option>
              </select>
            </label>
          </div>

          <p class="safety-copy">
            Preparing this action does not modify
            the source Waitlist or Referral record.
          </p>

          <div class="action-buttons">
            <button
              type="button"
              class="secondary"
              [disabled]="busy()"
              (click)="closeDraft()"
            >
              CLOSE
            </button>

            <button
              type="button"
              class="primary"
              data-testid="prepare-action"
              [disabled]="busy()"
              (click)="prepareAction()"
            >
              {{
                busy()
                  ? 'PREPARING…'
                  : 'PREPARE ACTION'
              }}
            </button>
          </div>
        } @else if (pendingAction(); as current) {
          <div class="confirmation">
            <p class="confirmation-label">
              {{ statusLabel(current) }}
            </p>

            <dl>
              <div>
                <dt>ACTION</dt>
                <dd>
                  REVIEW FLAG
                </dd>
              </div>

              <div>
                <dt>STATE</dt>
                <dd>
                  {{
                    current.desiredState
                      .toUpperCase()
                  }}
                </dd>
              </div>

              <div>
                <dt>REASON</dt>
                <dd>
                  {{
                    displayReason(
                      current.reason
                    )
                  }}
                </dd>
              </div>

              <div>
                <dt>ENVIRONMENT</dt>
                <dd>
                  {{
                    current.dataEnvironment
                      .toUpperCase()
                  }}
                </dd>
              </div>
            </dl>

            @if (
              current.status ===
              'pending_confirmation'
            ) {
              <div
                class="confirmation-warning"
                role="note"
              >
                <strong>
                  CONFIRMATION REQUIRED
                </strong>
                <span>
                  The source record remains
                  read-only. Confirmation writes
                  only the Admin review flag and
                  audit trail.
                </span>
              </div>

              <div class="action-buttons">
                <button
                  type="button"
                  class="secondary danger"
                  data-testid="cancel-action"
                  [disabled]="busy()"
                  (click)="cancelAction()"
                >
                  {{
                    busy()
                      ? 'WORKING…'
                      : 'CANCEL ACTION'
                  }}
                </button>

                <button
                  type="button"
                  class="primary"
                  data-testid="confirm-action"
                  [disabled]="busy()"
                  (click)="confirmAction()"
                >
                  {{
                    busy()
                      ? 'WORKING…'
                      : 'CONFIRM ACTION'
                  }}
                </button>
              </div>
            } @else {
              <div
                class="terminal-state"
                [class.success]="
                  current.status ===
                  'executed'
                "
              >
                {{ terminalMessage(current) }}
              </div>

              <div class="action-buttons">
                <button
                  type="button"
                  class="secondary"
                  (click)="closeCompleted()"
                >
                  CLOSE
                </button>
              </div>
            }
          </div>
        }

        @if (errorMessage()) {
          <div
            class="action-error"
            role="alert"
          >
            {{ errorMessage() }}
          </div>
        }
      </section>
    }
  `,
  styleUrl:
    './review-action-control.component.scss',
})
export class ReviewActionControlComponent {
  private readonly api =
    inject(AdminApiService);

  @Input({ required: true })
  targetKind!: AdminActionTargetKind;

  @Input({ required: true })
  targetId!: string;

  @Input({ required: true })
  targetLabel!: string;

  readonly expanded =
    signal(false);

  readonly desiredState =
    signal<AdminActionDesiredState>(
      'open',
    );

  readonly reason =
    signal<AdminActionReason>(
      'manual_review',
    );

  readonly pendingAction =
    signal<AdminAction | null>(null);

  readonly busy =
    signal(false);

  readonly errorMessage =
    signal('');

  private requestKey:
    string | null = null;

  private confirmationKey:
    string | null = null;

  private cancellationKey:
    string | null = null;

  open(): void {
    this.errorMessage.set('');
    this.expanded.set(true);
  }

  closeDraft(): void {
    if (this.busy()) return;

    this.errorMessage.set('');
    this.expanded.set(false);
  }

  closeCompleted(): void {
    if (this.busy()) return;

    this.pendingAction.set(null);
    this.requestKey = null;
    this.confirmationKey = null;
    this.cancellationKey = null;
    this.errorMessage.set('');
    this.expanded.set(false);
  }

  setDesiredState(
    event: Event,
  ): void {
    this.desiredState.set(
      (
        event.target as
          HTMLSelectElement
      ).value as
        AdminActionDesiredState,
    );
  }

  setReason(
    event: Event,
  ): void {
    this.reason.set(
      (
        event.target as
          HTMLSelectElement
      ).value as AdminActionReason,
    );
  }

  async prepareAction():
    Promise<void> {
    if (this.busy()) return;

    this.busy.set(true);
    this.errorMessage.set('');

    this.requestKey ??=
      crypto.randomUUID();

    try {
      const result =
        await this.api.requestReviewFlag(
          {
            actionType:
              'review_flag.set',
            targetKind:
              this.targetKind,
            targetId:
              this.targetId,
            desiredState:
              this.desiredState(),
            reason:
              this.reason(),
          },
          this.requestKey,
        );

      this.pendingAction.set(
        result.action,
      );
    } catch (error) {
      this.errorMessage.set(
        this.describeError(error),
      );
    } finally {
      this.busy.set(false);
    }
  }

  async confirmAction():
    Promise<void> {
    const current =
      this.pendingAction();

    if (
      !current ||
      current.status !==
        'pending_confirmation' ||
      this.busy()
    ) {
      return;
    }

    this.busy.set(true);
    this.errorMessage.set('');

    this.confirmationKey ??=
      crypto.randomUUID();

    try {
      const result =
        await this.api.confirmAction(
          current.actionId,
          this.confirmationKey,
        );

      this.pendingAction.set(
        result.action,
      );
    } catch (error) {
      this.errorMessage.set(
        this.describeError(error),
      );
    } finally {
      this.busy.set(false);
    }
  }

  async cancelAction():
    Promise<void> {
    const current =
      this.pendingAction();

    if (
      !current ||
      current.status !==
        'pending_confirmation' ||
      this.busy()
    ) {
      return;
    }

    this.busy.set(true);
    this.errorMessage.set('');

    this.cancellationKey ??=
      crypto.randomUUID();

    try {
      const result =
        await this.api.cancelAction(
          current.actionId,
          this.cancellationKey,
        );

      this.pendingAction.set(
        result.action,
      );
    } catch (error) {
      this.errorMessage.set(
        this.describeError(error),
      );
    } finally {
      this.busy.set(false);
    }
  }

  targetKindLabel(): string {
    return this.targetKind ===
      'referral_participant'
      ? 'REFERRAL PARTICIPANT'
      : 'WAITLIST';
  }

  displayReason(
    reason: AdminActionReason,
  ): string {
    switch (reason) {
      case 'data_quality':
        return 'DATA QUALITY';
      case 'follow_up':
        return 'FOLLOW UP';
      default:
        return 'MANUAL REVIEW';
    }
  }

  statusLabel(
    action: AdminAction,
  ): string {
    return action.status
      .replaceAll('_', ' ')
      .toUpperCase();
  }

  terminalMessage(
    action: AdminAction,
  ): string {
    switch (action.status) {
      case 'executed':
        return 'REVIEW FLAG SAVED TO ADMIN CONTROL PLANE.';
      case 'cancelled':
        return 'ACTION CANCELLED. SOURCE DATA WAS NOT CHANGED.';
      case 'expired':
        return 'ACTION EXPIRED WITHOUT EXECUTION.';
      case 'failed':
        return 'ACTION FAILED. VERIFY THE ADMIN CONTROL PLANE.';
      default:
        return action.status
          .replaceAll('_', ' ')
          .toUpperCase();
    }
  }

  private describeError(
    error: unknown,
  ): string {
    if (
      error instanceof
      AdminApiError
    ) {
      switch (error.status) {
        case 401:
          return 'SESSION EXPIRED. SIGN IN AGAIN.';
        case 403:
          return 'ACTION NOT AUTHORIZED.';
        case 409:
          return 'ACTION STATE CHANGED. REFRESH BEFORE RETRYING.';
        case 503:
          return 'CONTROLLED ACTIONS ARE CURRENTLY UNAVAILABLE.';
      }
    }

    return 'ACTION REQUEST FAILED. NO SOURCE DATA WAS CHANGED.';
  }
}
