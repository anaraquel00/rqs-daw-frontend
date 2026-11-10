import { Injectable, signal } from '@angular/core';
import { AuthChangeEvent, Session, SupabaseClient, createClient } from '@supabase/supabase-js';

interface PublicAuthConfiguration {
  url: string;
  publishableKey: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  readonly session = signal<Session | null>(null);
  readonly ready = signal(false);
  readonly initializationFailed = signal(false);
  private client: SupabaseClient | null = null;
  private initialization: Promise<void> | null = null;

  initialize(): Promise<void> {
    this.initialization ??= this.initializeClient();
    return this.initialization;
  }

  accessToken(): string | null {
    return this.session()?.access_token ?? null;
  }

  async signInWithEmail(email: string): Promise<void> {
    const client = this.requiredClient();
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw new Error('Unable to send sign-in link');
  }

  async signInWithProvider(provider: 'google' | 'github'): Promise<void> {
    const { error } = await this.requiredClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) throw new Error('Unable to start provider sign-in');
  }

  async signOut(): Promise<void> {
    const client = this.requiredClient();
    await client.auth.signOut({ scope: 'local' });
    this.session.set(null);
  }

  private async initializeClient(): Promise<void> {
    try {
      const response = await fetch('/api/auth/config', { cache: 'no-store' });
      if (!response.ok) throw new Error('Authentication configuration unavailable');
      const configuration = await response.json() as PublicAuthConfiguration;
      this.client = createClient(configuration.url, configuration.publishableKey);
      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      this.session.set(data.session);
      this.client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
        this.session.set(session);
      });
    } catch {
      this.initializationFailed.set(true);
    } finally {
      this.ready.set(true);
    }
  }

  private requiredClient(): SupabaseClient {
    if (!this.client) throw new Error('Authentication unavailable');
    return this.client;
  }
}
