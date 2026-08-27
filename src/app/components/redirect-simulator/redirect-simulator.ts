import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-redirect-simulator',
  standalone: true,
  template: `
    <div style="background: #0f0f13; color: #fff; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: monospace;">
      <h2 style="color: #ff007f;">📡 RQS UPLINK ENGINE: REDIRECIONANDO...</h2>
      <p style="color: #9ba1a6;">Computando métricas de acesso e convertendo tráfego...</p>
      <button (click)="forceRedirect()" style="background: #ff007f; color: #fff; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 20px;">
        [ ABRIR NO APP OFICIAL ]
      </button>
    </div>
  `
})
export class RedirectSimulatorComponent implements OnInit {
  private route = inject(ActivatedRoute);

  private platform = '';
  private id = '';

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.platform = params['platform'];
      this.id = params['id'];
    });

    // Executa o redirecionamento automático após 1.5s
    setTimeout(() => {
      this.forceRedirect();
    }, 1500);
  }

  forceRedirect() {
    if (this.platform === 'spotify') {
      const target = `spotify://track/${this.id}`;
      window.location.href = target;

      setTimeout(() => {
        window.location.href = `https://open.spotify.com/track/${this.id}`;
      }, 1000);
    }
  }
}
