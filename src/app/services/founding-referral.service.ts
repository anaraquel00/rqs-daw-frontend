import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { FOUNDING_REFERRAL, ReferralStatus } from './founding-referral';

const EMPTY_STATUS: ReferralStatus = { participantStatus: 'prelaunch', eligibleCount: 0, pendingCount: 0,
  qualifiedCount: 0, discountPercent: 0, maxDiscountPercent: 50, paidPlansEnabled: false };

@Injectable({ providedIn: 'root' })
export class FoundingReferralService {
  private readonly auth = inject(AuthService);
  readonly status = signal<ReferralStatus>(EMPTY_STATUS);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    const token = this.auth.session()?.access_token;
    if (!token || this.loading()) return;
    this.loading.set(true); this.error.set(null);
    try {
      const response = await fetch('/api/referral/status', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('status');
      this.status.set(await response.json());
    } catch { this.error.set('status'); }
    finally { this.loading.set(false); }
  }

  async activate(): Promise<boolean> {
    const token = this.auth.session()?.access_token;
    if (!token || this.loading()) return false;
    this.loading.set(true); this.error.set(null);
    try {
      const response = await fetch('/api/referral/activate', { method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptedTerms: true, termsVersion: FOUNDING_REFERRAL.termsVersion }) });
      if (!response.ok) { this.error.set(response.status === 409 ? 'waitlist' : 'activate'); return false; }
      await this.loadAfterActivation(); return true;
    } catch { this.error.set('activate'); return false; }
    finally { this.loading.set(false); }
  }

  reset(): void { this.status.set(EMPTY_STATUS); this.error.set(null); }
  private async loadAfterActivation(): Promise<void> { this.loading.set(false); await this.load(); }
}
