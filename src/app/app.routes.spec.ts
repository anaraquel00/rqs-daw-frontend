import { RenderMode } from '@angular/ssr';
import { Routes } from '@angular/router';
import { routes } from './app.routes';
import { serverRoutes } from './app.routes.server';
import { WorkspaceComponent } from './workspace/workspace';

describe('V2 canonical app routes', () => {
  const expectedRedirects: Record<string, string> = {
    studio: 'app',
    'studio/master': 'app/master',
    'studio/build': 'app/build',
    'studio/uplink': 'app/uplink',
    'studio/split': 'app/split',
    'studio/learn': 'app/learn',
    'studio/account': 'app/account',
  };

  it('makes /app the V2 route and preserves the legacy workspace at /legacy', () => {
    const app = routes.find(route => route.path === 'app');
    const legacy = routes.find(route => route.path === 'legacy');

    expect(app?.loadChildren).toBeDefined();
    expect(app?.component).toBeUndefined();
    expect(legacy?.component).toBe(WorkspaceComponent);
    expect(routes.filter(route => route.path === 'app').length).toBe(1);
  });

  it('exposes all canonical V2 child surfaces under /app', async () => {
    const app = routes.find(route => route.path === 'app')!;
    const children = await (app.loadChildren as () => Promise<Routes>)();
    const shellChildren = children[0].children ?? [];

    expect(shellChildren.some(route => route.path === '' && route.pathMatch === 'full')).toBeTrue();
    for (const path of ['master', 'build', 'uplink', 'split']) {
      expect(shellChildren.some(route => route.path === path)).withContext(path).toBeTrue();
    }
  });

  it('redirects legacy /studio deep links to canonical /app paths without a loop', () => {
    for (const [path, target] of Object.entries(expectedRedirects)) {
      const route = routes.find(candidate => candidate.path === path);
      expect(route?.redirectTo).withContext(path).toBe(target);
      expect(route?.pathMatch).withContext(path).toBe('full');
      expect(target.startsWith('studio')).withContext(path).toBeFalse();
    }
  });

  it('prerenders public /app while keeping child workspaces client-rendered', () => {
    expect(serverRoutes.find(route => route.path === 'app')?.renderMode).toBe(RenderMode.Prerender);
    expect(serverRoutes.find(route => route.path === 'app/**')?.renderMode).toBe(RenderMode.Client);
  });
});
