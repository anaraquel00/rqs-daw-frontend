import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule } from '@angular/router';
import { LanguageService } from '../../services/language.service'; // 🟢 INJECT DE SINAL

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink],
  templateUrl: './privacy.html',
  styleUrls: ['./privacy.scss']
})
export class PrivacyComponent {
  readonly lang = inject(LanguageService);
}
