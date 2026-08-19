import { Routes } from '@angular/router';
import { TermsComponent } from './components/terms/terms';
import { PrivacyComponent } from './components/privacy/privacy';
import { WorkspaceComponent } from './workspace/workspace';
import { LandingPageComponent } from './landing-page/landing-page';
import { ContactPageComponent } from './contact-page/contact-page';

export const routes: Routes = [
  {
    path: '',
    component: LandingPageComponent,
    title: 'RaQuel Synths - Intelligent Workstation'
  },
  {
    path: 'app',
    component: WorkspaceComponent,
    title: 'RQS Studio - DAW Mainframe'
  },
  {
    path: 'contact',
    component: ContactPageComponent
  },
  {
    path: 'contato',
    redirectTo: 'contact',
    pathMatch: 'full'
  },
  {
    path: 'terms',
    component: TermsComponent
  },
  {
    path: 'privacy',
    component: PrivacyComponent
  },
  {
    path: 'termos',
    redirectTo: 'terms',
    pathMatch: 'full'
  },
  {
    path: 'privacidade',
    redirectTo: 'privacy',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
