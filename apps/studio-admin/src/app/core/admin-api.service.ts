import { Injectable, inject } from '@angular/core';
import { AdminAuthService } from './admin-auth.service';

export type AdminRole = 'owner' | 'operator' | 'analyst';

export interface AdminIdentity {
  authenticated: true;
  role: AdminRole;
}

export interface PlanInterestBreakdown {
  master: number;
  plus: number;
  pro: number;
  undecided: number;
  unknown: number;
}

export interface LanguageBreakdown {
  pt: number;
  en: number;
  pl: number;
  fr: number;
  unknown: number;
}

export interface AdminOverview {
  waitlistTotal: number;
  foundingReferralParticipants: number;
  activeFoundingReferralParticipants: number;
  referralAttributedWaitlist: number;
  byPlanInterest: PlanInterestBreakdown;
  byLanguage: LanguageBreakdown;
  systemStatus: 'operational';
  generatedAt: string;
}

export interface WaitlistSummary {
  total: number;
  byPlanInterest: PlanInterestBreakdown;
  generatedAt: string;
}

export interface WaitlistRecord {
  id: string;
  maskedEmail: string;
  planInterest: string;
  status: string;
  language: string;
  source: string;
  createdAt: string | null;
  planInterestUpdatedAt: string | null;
  referralAttributed: boolean;
  referralStatus: string;
  referralCapturedAt: string | null;
}

export interface WaitlistRecordsQuery {
  limit?: number;
  cursor?: string | null;
  planInterest?: string;
  status?: string;
  language?: string;
  referralAttributed?: string;
}

export interface WaitlistRecordsPage {
  records: WaitlistRecord[];
  nextCursor: string | null;
  limit: number;
  filters: {
    planInterest?: string;
    status?: string;
    language?: string;
    referralAttributed?: string;
  };
  generatedAt: string;
}

export interface ReferralSummary {
  total: number;
  active: number;
  attributedWaitlist: number;
  generatedAt: string;
}

export interface ReferralRecord {
  id: string;
  campaignId: string;
  status: string;
  termsVersion: string;
  termsAcceptedAt: string | null;
  eligibleFrom: string | null;
  captureEndsAt: string | null;
  createdAt: string | null;
  maskedReferralCode: string;
  referredCount: number;
  pendingCount: number;
  qualifiedCount: number;
  discountPercent: number;
}

export interface ReferralRecordsQuery {
  limit?: number;
  cursor?: string | null;
  status?: string;
  campaignId?: string;
}

export interface ReferralRecordsPage {
  records: ReferralRecord[];
  nextCursor: string | null;
  limit: number;
  filters: {
    status?: string;
    campaignId?: string;
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

  waitlistRecords(query: WaitlistRecordsQuery = {}): Promise<WaitlistRecordsPage> {
    return this.get<WaitlistRecordsPage>('/api/admin/waitlist/records', query);
  }

  referralSummary(): Promise<ReferralSummary> {
    return this.get<ReferralSummary>('/api/admin/referrals/summary');
  }

  referralRecords(query: ReferralRecordsQuery = {}): Promise<ReferralRecordsPage> {
    return this.get<ReferralRecordsPage>('/api/admin/referrals/records', query);
  }

  private async get<T>(
    url: string,
    query: object = {},
  ): Promise<T> {
    const token = this.auth.accessToken();
    if (!token) throw new AdminApiError(401);

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }

    const target = params.size > 0 ? `${url}?${params.toString()}` : url;
    const response = await fetch(target, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!response.ok) throw new AdminApiError(response.status);
    return response.json() as Promise<T>;
  }
}
