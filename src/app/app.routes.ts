// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { TermsComponent } from './components/terms/terms';
import { PrivacyComponent } from './components/privacy/privacy';
import { WorkspaceComponent } from './workspace/workspace';

export const routes: Routes = [
  { path: '', component: WorkspaceComponent }, // 🟢 Página inicial carrega o estúdio completo!
  { path: 'terms', component: TermsComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: 'termos', redirectTo: 'terms' },
  { path: 'privacidade', redirectTo: 'privacy' },
  { path: '**', redirectTo: '' }
];
