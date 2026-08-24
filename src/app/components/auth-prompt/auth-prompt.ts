import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-auth-prompt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-prompt.html',
  styleUrls: ['./auth-prompt.scss'],
})
export class AuthPromptComponent {
  readonly auth = inject(AuthService);
  readonly lang = inject(LanguageService);
  readonly email = signal('');
  readonly message = computed(() => {
    const key = this.auth.authMessageKey();
    return key ? this.lang.t()[key] : '';
  });

  close(): void {
    this.email.set('');
    this.auth.closeAuthPrompt();
  }

  submitEmail(): void {
    void this.auth.sendMagicLink(this.email());
  }
}
