import { Injectable, inject } from '@angular/core';
import { AdminAuthService } from './admin-auth.service';

export type AdminRole = 'owner' | 'operator' | 'analyst';

export interface AdminIdentity {
  authenticated: true;
  role: AdminRole;
}

export interface AdminOverview {
  waitlistTotal: number;
  foundingReferralParticipants: number;
  systemStatus: 'operational';
  generatedAt: string;
}

export interface WaitlistSummary {
  total: number;
  byPlanInterest: {
    master: number;
    plus: number;
    pro: number;
    undecided: number;
    unknown: number;
  };
  generatedAt: string;
}

export class AdminApiError extends Error {
  constructor(readonly status: number) {
    super(`Admin API request failed (${status})`);
  }
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly auth = inject(AdminAuthService);

  me(): Promise<AdminIdentity> {
    return this.get<AdminIdentity>('/api/admin/me');
  }

  overview(): Promise<AdminOverview> {
    return this.get<AdminOverview>('/api/admin/overview');
  }

  waitlistSummary(): Promise<WaitlistSummary> {
    return this.get<WaitlistSummary>('/api/admin/waitlist/summary');
  }

  private async get<T>(url: string): Promise<T> {
    const token = this.auth.accessToken();
    if (!token) throw new AdminApiError(401);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new AdminApiError(response.status);
    return response.json() as Promise<T>;
  }
}
