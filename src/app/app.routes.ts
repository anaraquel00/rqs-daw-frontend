import { Routes } from '@angular/router';
import { TermsComponent } from './components/terms/terms';
import { PrivacyComponent } from './components/privacy/privacy';
import { WorkspaceComponent } from './workspace/workspace';
import { LandingPageComponent } from './landing-page/landing-page';
import { ContactPageComponent } from './contact-page/contact-page';
import { PricingPageComponent } from './pricing-page/pricing-page';
import { CookiesPageComponent } from './cookies-page/cookies-page';

export const routes: Routes = [
  {
    path: 'studio',
    redirectTo: 'app',
    pathMatch: 'full'
  },
  {
    path: 'studio/master',
    redirectTo: 'app/master',
    pathMatch: 'full'
  },
  {
    path: 'studio/build',
    redirectTo: 'app/build',
    pathMatch: 'full'
  },
  {
    path: 'studio/uplink',
    redirectTo: 'app/uplink',
    pathMatch: 'full'
  },
  {
    path: 'studio/split',
    redirectTo: 'app/split',
    pathMatch: 'full'
  },
  {
    path: 'studio/learn',
    redirectTo: 'app/learn',
    pathMatch: 'full'
  },
  {
    path: 'studio/account',
    redirectTo: 'app/account',
    pathMatch: 'full'
  },
  {
    path: 'app',
    loadChildren: () => import('./studio/studio.routes').then(m => m.STUDIO_ROUTES)
  },
  {
    path: '',
    component: LandingPageComponent,
    title: 'RaQuel Synths - Intelligent Workstation'
  },
  {
    path: 'legacy',
    component: WorkspaceComponent,
    title: 'RQS Studio - Legacy DAW Mainframe'
  },
  {
    path: 'contact',
    component: ContactPageComponent
  },
  {
    path: 'pricing',
    component: PricingPageComponent
  },
  {
    path: 'cookies',
    component: CookiesPageComponent
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
