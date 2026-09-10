import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../services/language.service';
import { STUDIO_COPY } from './studio-copy';

// Exact approved display copy/ordering; these are visual entry cards, not DSP
// previews. SPLIT opens an unavailable surface, never the disabled processing API.
@Component({
  selector: 'app-module-selector', standalone: true, imports: [RouterLink],
  templateUrl: './module-selector.html', styleUrl: './module-selector.scss',
})
export class ModuleSelectorComponent {
  readonly lang = inject(LanguageService);
  readonly copy = computed(() => STUDIO_COPY[this.lang.currentLang()]);
  readonly meters = [0, 1, 2, 3, 4, 5, 6];
  readonly modules = [
    { id: 'master', name: 'MASTER', engine: 'DSP ENGINE 01', subtitle: 'CORE SIGNAL REFINEMENT', icon: 'ϟ', description: 'Professional DSP mastering chain. Finalize your tracks with surgical spectral balance and industry-standard loudness controls.', tags: ['LUFS', 'ANALYZE', 'DSP_CORE'] },
    { id: 'split', name: 'SPLIT', engine: 'NEURAL ENGINE 02', subtitle: 'STEM EXTRACTION CORE', icon: '✂', description: 'Neural engine for clean stem extraction. Deconstruct any track into four high-fidelity musical components for remixing or analysis.', tags: ['AI_MODEL_V4', '4_STEMS'] },
    { id: 'build', name: 'BUILD', engine: 'SEQUENCER ENGINE 03', subtitle: 'SETLIST & FLOW ENGINE', icon: '≋', description: 'Architecture for your live sets. Sequence tracks, manage transitions, and analyze harmonic flow for a flawless performance.', tags: ['SETLIST', 'TRANSITION'] },
    { id: 'uplink', name: 'UPLINK', engine: 'DISTRIBUTION ENGINE 04', subtitle: 'DEPLOYMENT CORE', icon: '↥', description: 'Global release engine. Direct uplink to streaming services, stores, and analytics nodes for immediate worldwide deployment.', tags: ['DSPs', 'ROUTING'] },
  ];
}
