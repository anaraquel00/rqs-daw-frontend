import { Component, inject, OnDestroy, DestroyRef } from '@angular/core'; // 🟢 CORREÇÃO: Importa o DestroyRef
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DspService } from '../services/dsp';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

export interface RQSTrack {
  file: File;
  name: string;
  crossfadeNext: number;
  previewUrl: SafeUrl;
  rawUrl: string;
}

@Component({
  selector: 'app-mix-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './mix-panel.html',
  styleUrls: ['./mix-panel.scss']
})
export class MixPanelComponent implements OnDestroy {
  private dspService = inject(DspService);
  private sanitizer = inject(DomSanitizer);

  // 🟢 CORREÇÃO: Captura a referência de destruição enquanto o contexto de injeção está ativo! [2]
  private destroyRef = inject(DestroyRef);

  crossfadeValue: number = 8.0;
  tracks: RQSTrack[] = [];
  isProcessing: boolean = false;
  mixSuccess: boolean = false;
  setlistName: string = 'THE_BLUEPRINT_SESSIONS_Vol_XYZ';

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
    }
  }

  private addFiles(newFiles: File[]) {
    const validFiles = newFiles.filter(f => f.name.endsWith('.wav') || f.name.endsWith('.mp3'));

    const newTracks = validFiles.map(f => {
      const url = URL.createObjectURL(f);
      return {
        file: f,
        name: f.name,
        crossfadeNext: 8.0,
        rawUrl: url,
        previewUrl: this.sanitizer.bypassSecurityTrustUrl(url)
      };
    });

    this.tracks.push(...newTracks);
  }

  moveUp(index: number) {
    if (index > 0) {
      const temp = this.tracks[index - 1];
      this.tracks[index - 1] = this.tracks[index];
      this.tracks[index] = temp;
    }
  }

  moveDown(index: number) {
    if (index < this.tracks.length - 1) {
      const temp = this.tracks[index + 1];
      this.tracks[index + 1] = this.tracks[index];
      this.tracks[index] = temp;
    }
  }

  removeTrack(index: number) {
    const track = this.tracks[index];
    if (track.rawUrl) {
      URL.revokeObjectURL(track.rawUrl);
    }
    this.tracks.splice(index, 1);
  }

  igniteSetlist() {
    if (this.tracks.length === 0) return;

    this.isProcessing = true;
    this.mixSuccess = false;

    const crossfadesArray = this.tracks.slice(0, -1).map(track => {
      return track.crossfadeNext !== undefined ? track.crossfadeNext : 8.0;
    });

    const fileArray = this.tracks.map(t => t.file);

    this.dspService.generateMix(fileArray, crossfadesArray)
      // 🟢 CORREÇÃO: Passa o destroyRef explicitamente para neutralizar o erro NG0203 [2]
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob: Blob) => {
          this.isProcessing = false;
          this.mixSuccess = true;

          const safeName = this.setlistName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'RQS_SETLIST_MASTER';

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${safeName}.wav`;
          a.click();
          window.URL.revokeObjectURL(url);

          setTimeout(() => this.mixSuccess = false, 5000);
        },
        error: (err: any) => {
          this.isProcessing = false;
          console.error('Falha de Comunicação com a Matriz de Mixagem', err);
        }
      });
  }

  ngOnDestroy() {
    this.tracks.forEach(track => {
      if (track.rawUrl) {
        URL.revokeObjectURL(track.rawUrl);
      }
    });
  }
}
