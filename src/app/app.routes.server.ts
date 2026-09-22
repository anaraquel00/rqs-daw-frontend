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
  {
    path: 'cookies',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'contact',
    renderMode: RenderMode.Prerender
  },

  // O selector público do Studio é prerenderizado; os workspaces continuam client-only.
  {
    path: 'app',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'app/**',
    renderMode: RenderMode.Client
  },
  {
    path: 'legacy',
    renderMode: RenderMode.Client
  },

  {
    path: '**',
    renderMode: RenderMode.Client
  }
];
