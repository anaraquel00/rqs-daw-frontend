import { Injectable, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export interface WaitlistSummary {
  total: number;
  master: number;
  plus: number;
  pro: number;
  undecided: number;
  legacy_unset: number;
  generated_at: string;
}

@Injectable({ providedIn: 'root' })
export class AdminSessionService {
  private readonly auth = inject(AuthService);

  async verify(): Promise<boolean> {
    const response = await fetch('/api/admin/session', {
      headers: this.authorizationHeaders(),
    });
    return response.ok && Boolean((await response.json()).admin);
  }

  async loadWaitlistSummary(): Promise<WaitlistSummary> {
    const response = await fetch('/api/admin/waitlist/summary', {
      headers: this.authorizationHeaders(),
    });
    if (!response.ok) throw new Error(`Admin waitlist summary failed (${response.status})`);
    return response.json();
  }

  private authorizationHeaders(): Record<string, string> {
    const token = this.auth.session()?.access_token;
    if (!token) throw new Error('Authenticated admin session required');
    return { Authorization: `Bearer ${token}` };
  }
}
