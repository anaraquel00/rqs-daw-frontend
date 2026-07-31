import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing-page.html',
  styleUrls: ['./landing-page.scss']
})
export class LandingPageComponent {
  readonly lang = inject(LanguageService);
  private router = inject(Router);

  enterMainframe() {
    // Redireciona para a tela do Studio de produção
    this.router.navigate(['/studio']);
  }

  buyProPlan() {
    // 🟢 CORREÇÃO: Redireciona para o link de checkout de testes (ou produção) oficial da Stripe
    window.open('https://buy.stripe.com/test_aFa00bdzW3Qmgt9dT7djO00', '_blank');
  }
}
