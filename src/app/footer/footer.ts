import { Component, inject } from '@angular/core';
import { LanguageService } from '../services/language.service';
import { RouterLink, RouterModule } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [RouterModule,RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {

readonly lang = inject(LanguageService);

}
