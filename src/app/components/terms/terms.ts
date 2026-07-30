import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule } from '@angular/router';
import { LanguageService } from '../../services/language.service'; // 🟢 INJECT DE SINAL

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink],
  templateUrl: './terms.html',
  styleUrls: ['./terms.scss'] // Use o mesmo SCSS do painel ou crie um simples
})
export class TermsComponent {
  readonly lang = inject(LanguageService);
}
