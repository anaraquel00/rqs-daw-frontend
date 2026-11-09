import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../core/admin-auth.service';
import { AdminSeoService } from '../core/admin-seo.service';

@Component({
  selector: 'rqs-admin-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="access-screen">
      <section class="access-card">
        <p class="eyebrow">RQS STUDIO // SECURE ACCESS</p>
        <h1>ADMIN CONTROL ROOM</h1>
        <p class="lede">Use your existing RQS Studio identity. Access is granted only after server-side owner verification.</p>
        <button type="button" class="provider" (click)="provider('google')" [disabled]="busy()">CONTINUE WITH GOOGLE</button>
        <button type="button" class="provider" (click)="provider('github')" [disabled]="busy()">CONTINUE WITH GITHUB</button>
        <div class="divider"><span>OR</span></div>
        <form (ngSubmit)="sendLink()">
          <label for="email">WORK EMAIL</label>
          <input id="email" name="email" type="email" autocomplete="email" required [(ngModel)]="email" placeholder="name@example.com">
          <button type="submit" [disabled]="busy() || !email.trim()">SEND SECURE LINK</button>
        </form>
        @if (sent()) { <p class="status">Check your inbox for the secure sign-in link.</p> }
        @if (failed()) { <p class="error">Authentication is unavailable. Try again without sharing credentials.</p> }
      </section>
    </main>
  `,
  styleUrl: './access.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  email = '';
  readonly busy = signal(false);
  readonly sent = signal(false);
  readonly failed = signal(false);

  constructor(seo: AdminSeoService) {
    seo.setCanonical('/login');
    if (this.auth.session()?.user) void this.router.navigateByUrl('/');
  }

  async provider(provider: 'google' | 'github'): Promise<void> {
    await this.execute(() => this.auth.signInWithProvider(provider));
  }

  async sendLink(): Promise<void> {
    await this.execute(async () => {
      await this.auth.signInWithEmail(this.email);
      this.sent.set(true);
    });
  }

  private async execute(operation: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.failed.set(false);
    try { await operation(); } catch { this.failed.set(true); } finally { this.busy.set(false); }
  }
}
