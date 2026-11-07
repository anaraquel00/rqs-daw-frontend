import { Routes } from '@angular/router';
import { adminAuthGuard } from './admin-auth.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminAuthGuard],
    loadComponent: () => import('./admin-dashboard').then(module => module.AdminDashboardComponent),
    title: 'RQS Studio Commercial Admin',
  },
];
