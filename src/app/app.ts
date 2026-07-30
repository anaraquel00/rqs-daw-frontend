// src/app/app.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router'; // 🟢 ESSENCIAL: Importa o RouterOutlet! [1]
import { LanguageService } from './services/language.service';
import { Footer } from './footer/footer';
import { UploadZoneComponent } from "./components/upload-zone/upload-zone";
import { MixPanelComponent } from "./mix-panel/mix-panel"; // 🟢 Importa o FooterComponent! [2]
import { AuthService } from './services/auth.service';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, Footer], // 🟢 Adicionados RouterOutlet e Footer!
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent {
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
}
