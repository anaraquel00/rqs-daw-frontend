import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export type PlanInterest = 'master' | 'plus' | 'pro' | 'undecided';

export interface WaitlistPreference {
  joined: boolean;
  status?: string;
  plan_interest?: PlanInterest;
  legacy_unset?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WaitlistPreferenceService {
  private readonly auth = inject(AuthService);

  async load(): Promise<WaitlistPreference> {
    const response = await fetch('/api/waitlist/me', {
      headers: this.authorizationHeaders(),
    });
    if (response.status === 404) return { joined: false };
    if (!response.ok) throw new Error(`Waitlist preference load failed (${response.status})`);
    return response.json();
  }

  async update(planInterest: PlanInterest): Promise<WaitlistPreference> {
    const response = await fetch('/api/waitlist/me', {
      method: 'PATCH',
      headers: {
        ...this.authorizationHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan_interest: planInterest }),
    });
    if (response.status === 404) return { joined: false };
    if (!response.ok) throw new Error(`Waitlist preference update failed (${response.status})`);
    return response.json();
  }

  private authorizationHeaders(): Record<string, string> {
    const token = this.auth.session()?.access_token;
    if (!token) throw new Error('Authenticated session required');
    return { Authorization: `Bearer ${token}` };
  }
}
