import { Routes } from '@angular/router';
import { adminAccessGuard } from './core/admin-access.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login.component').then(module => module.LoginComponent),
    title: 'Access | RQS Studio Admin',
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./pages/forbidden.component').then(module => module.ForbiddenComponent),
    title: 'Access denied | RQS Studio Admin',
  },
  {
    path: 'unavailable',
    loadComponent: () => import('./pages/unavailable.component').then(module => module.UnavailableComponent),
    title: 'Unavailable | RQS Studio Admin',
  },
  {
    path: '',
    canActivate: [adminAccessGuard],
    loadComponent: () => import('./shell/admin-shell.component').then(module => module.AdminShellComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/overview.component').then(module => module.OverviewComponent),
        title: 'Overview | RQS Studio Admin',
      },
      {
        path: 'waitlist',
        loadComponent: () => import('./pages/waitlist.component').then(module => module.WaitlistComponent),
        title: 'Waitlist | RQS Studio Admin',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
