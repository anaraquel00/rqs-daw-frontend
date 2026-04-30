import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// 📡 A PEÇA QUE FALTAVA: O módulo oficial de comunicação do Angular
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),

    // 🛡️ O cabo de rede oficial liberado pela Diretoria!
    provideHttpClient()
  ]
};
