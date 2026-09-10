import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Footer } from '../footer/footer';

// Reuse the V1 footer's language/consent actions; only the Studio module badges
// become navigation links. The existing footer and /app remain unchanged.
@Component({
  selector: 'app-studio-footer', standalone: true, imports: [RouterLink],
  templateUrl: './studio-footer.html', styleUrls: ['../footer/footer.scss', './studio-footer.scss'],
})
export class StudioFooterComponent extends Footer {}
