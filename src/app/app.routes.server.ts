// src/app/app.routes.server.ts

import {
  RenderMode,
  ServerRoute
} from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'terms',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'privacy',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'pricing',
    renderMode: RenderMode.Prerender
  },

  // A DAW depende fortemente das APIs do navegador.
  {
    path: 'app',
    renderMode: RenderMode.Client
  },

  {
    path: '**',
    renderMode: RenderMode.Client
  }
];
