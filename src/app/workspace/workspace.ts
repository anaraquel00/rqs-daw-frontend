import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MixPanelComponent } from '../mix-panel/mix-panel';
import { UploadZoneComponent } from "../components/upload-zone/upload-zone";

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, MixPanelComponent, UploadZoneComponent],
  template: `
    <!-- 🎛️ A GRADE DE ENGENHARIA PRINCIPAL DA WORKSTATION -->
    <div class="workspace-grid">
       <app-upload-zone></app-upload-zone>
       <app-mix-panel></app-mix-panel>
    </div>
  `,
  styles: [`
    .workspace-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    @media (min-width: 900px) {
      .workspace-grid {
        grid-template-columns: 1fr 1fr; /* Lado a lado em telas grandes */
      }
    }
  `]
})
export class WorkspaceComponent {}
