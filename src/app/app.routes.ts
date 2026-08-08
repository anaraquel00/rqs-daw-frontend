// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { TermsComponent } from './components/terms/terms';
import { PrivacyComponent } from './components/privacy/privacy';
import { WorkspaceComponent } from './workspace/workspace';
import { LandingPageComponent } from './landing-page/landing-page';
import { RedirectSimulatorComponent } from './components/redirect-simulator/redirect-simulator';

export const routes: Routes = [
  {
    path: '',
    component: LandingPageComponent,
    title: 'RaQuel Synths - Intelligent Workstation'
  },
  {
    path: 'studio', // 🟢 O estúdio completo (upload + mix-panel) passa a morar aqui!
    component: WorkspaceComponent,
    title: 'RQS Studio - DAW Mainframe'
  },
  {
  path: 'simulate-redirect/:platform/:id',
  component: RedirectSimulatorComponent // Crie este componente simples
},
  { path: 'terms', component: TermsComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: 'termos', redirectTo: 'terms' },
  { path: 'privacidade', redirectTo: 'privacy' },
  { path: '**', redirectTo: '' }
];
