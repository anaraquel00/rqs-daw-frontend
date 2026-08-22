import { Injectable, signal } from '@angular/core';

export type AuthIntent = 'general' | 'mastering' | 'stems' | 'uplink';

@Injectable({ providedIn: 'root' })
export class AuthPromptService {
  readonly visible = signal(false);
  readonly intent = signal<AuthIntent>('general');

  open(intent: AuthIntent = 'general'): void {
    this.intent.set(intent);
    this.visible.set(true);
  }

  close(): void {
    this.visible.set(false);
  }
}
