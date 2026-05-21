import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// 📡 Importando a Zona de Upload tática
import { UploadZoneComponent } from './components/upload-zone/upload-zone';
import { MixPanelComponent } from "./mix-panel/mix-panel";

@Component({
  selector: 'app-root',
  standalone: true,
  // 🔌 Soldando o chip na placa (adicionando ao array de imports)
  imports: [UploadZoneComponent, MixPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent {
  title = 'daw-frontend';
}
