import { Component } from '@angular/core';
import { Routes } from '@angular/router';
import { StudioShellComponent } from './studio-shell';

// The route selects a surface. The parent owns visited engine instances so that
// Back/Forward and Module Selector navigation do not destroy local audio/jobs.
@Component({ standalone: true, template: '' })
export class StudioRouteSurface {}

export const STUDIO_ROUTES: Routes = [{
  path: '', component: StudioShellComponent,
  children: [
    { path: '', pathMatch: 'full', component: StudioRouteSurface, data: { surface: 'home' }, title: 'RQS Studio' },
    ...['master', 'build', 'uplink', 'split', 'learn', 'account'].map(surface => ({
      path: surface, component: StudioRouteSurface, data: { surface }, title: `RQS Studio — ${surface.toUpperCase()}`,
    })),
    { path: '**', redirectTo: '' },
  ],
}];
