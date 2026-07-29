# 🎛️ RQS DAW - Frontend Client (studio.raquelsynths.com)

Este repositório abriga a interface de usuário (UI) da **RaQuel Synths Digital Audio Workstation (RQS-DAW)**. Desenvolvido em **Angular 18+ Standalone**, o projeto oferece uma experiência de estúdio altamente responsiva, com telemetria em tempo real e processamento híbrido na nuvem.

---

## 🚀 Diferenciais de Engenharia & UX

*   **⚡ Upload em Segundo Plano (S3 Background Sync):** Assim que o usuário escolhe ou arrasta uma faixa para o dropzone, o Angular inicia o upload direto para o bucket do Amazon S3 em background. Isso elimina o tempo de espera do usuário ao clicar em masterizar [1.2.6].
*   **🌐 Módulo Global RQS i18n (Angular Signals):** Internacionalização reativa sem bibliotecas externas pesadas [1.1]. O sistema detecta automaticamente o idioma do navegador (`navigator.language`) e atualiza instantaneamente a tela de forma cirúrgica na mudança manual (PT-EN) com performance impecável [1].
*   **📟 Terminal de Telemetria Cyberpunk:** Exibe logs reais do status de processamento da AWS em tempo real na tela, eliminando a necessidade de o produtor abrir o console de desenvolvedor (F12) do navegador [1].
*   **🧹 Higiene de Memória Rigorosa:** Destruição ativa de referências de memória binária (`URL.revokeObjectURL`) no ciclo de vida `OnDestroy` dos componentes, blindando o navegador contra vazamentos de RAM (*Blob leaks*) [1.1.5, 1.2.6].

---

## 🧭 Guia de Operação Acústica (Aos Produtores)

A interface trabalha sob o conceito da **Guerra Civil do Áudio** (Blue Team vs. Red Team), dividindo os algoritmos adaptativos com base na proposta estética da sua faixa:

### 🎯 A Pergunta de Ouro antes de Masterizar
Olhe para a sua track crua vinda do Suno e se pergunte: **"Qual é o elemento mais importante que guia essa música?"**

*   Se for a **VOZ** ou o brilho de um instrumento solo ➡️ **CÉU CLARO (Clear Sky)**
*   Se for o **GRAVE** físico no peito (sub-bass/groove) ➡️ **TROVÃO (Thunder)**
*   Se for a **PRESSÃO** e energia de sintetizadores gigantes ➡️ **TETO SOLAR (Sunroof)**
*   Se for a **AMBIÊNCIA** e as texturas espaciais (reverbs/viagem) ➡️ **AURORA (Aurora)**

---

### 🎛️ O Livro de Regras por Gênero Musical

#### 1. Progressive House

| Estilo de Progressive House | Perfil Recomendado | Por que usar? | O que ele faz no som? |
| :--- | :--- | :--- | :--- |
| **Vocal e Melódico** *(Estilo deadmau5, Lane 8)* | 🌤️ **Clear Sky** (Blue) | Vocais femininos e plucks precisam de definição e ar. | Puxa a voz para o centro, abre o estéreo acima de $8\text{ kHz}$ e limpa a lama espectral [1.2.2]. |
| **Groove de Clube / Dark** *(Estilo Pryda, John Digweed)* | ⛈️ **Thunder** (Red) | Músicas focadas na batida e no subgrave precisam de peso no peito. | Dá ganho focado abaixo de $60\text{ Hz}$ e usa compressão firme no bumbo [1.2.2]. |
| **Mainstage / Festival** *(Estilo Alesso, Avicii)* | ☀️ **Sunroof** (Red) | Acordes de sintetizadores gigantes (*supersaws*) precisam soar massivos. | Espreme a dinâmica para atingir volume comercial de festival ($-8\text{ LUFS}$) [1.2.6]. |
| **Deep / Melodic House** *(Estilo Ben Böhmer, Rufus Du Sol)* | 🌌 **Aurora** (Blue) | Sintetizadores e texturas analógicas precisam de calor e cola de mixagem. | Aplica saturação harmônica suave e espalha os reverbs pelas laterais [1.2.2]. |

#### 2. Synthwave
*   **Classic Retrowave / Dreamwave** *(Estilo The Midnight)* ➡️ **🌌 Aurora**
    *   *Por quê?* Adiciona saturação de fita analógica no canal central e espalha o efeito de *chorus* das guitarras e synths clássicos pelas laterais.
*   **Darksynth / Outrun** *(Estilo Carpenter Brut)* ➡️ **☀️ Sunroof**
    *   *Por quê?* Fornece o volume agressivo e a compressão rápida que o andamento acelerado do gênero exige [1.2.6].

#### 3. Industrial Metal & Aggrotech
*   **Industrial Metal** *(Estilo Rammstein)* ➡️ **☀️ Sunroof**
    *   *Por quê?* Amarra as paredes de guitarras de forma compacta e pesada, preservando o transiente rápido da bateria acústica.
*   **Aggrotech / Power Noise** *(Estilo Combichrist)* ➡️ **⛈️ Thunder**
    *   *Por quê?* Garante o peso devastador do bumbo industrial de Techno nos subgraves, cortando o "estridência metálica" excessiva gerada pela IA.

---

## 🛠️ Resolução de Problemas Rápidos (Troubleshooting)

*   **"O meu arquivo WAV masterizado ficou com agudos irritantes/sibilantes no fone."**  
    *   *Correção:* A faixa gerada pela IA continha sibilância excessiva. Remasterize no perfil **`Thunder`** (que possui controle de agudos ásperos) ou no perfil **`Aurora`** (que suaviza agudos através de compressão analógica de fita).
*   **"Sinto que o bumbo ou o subgrave está distorcendo a música inteira."**  
    *   *Correção:* A mixagem original já tinha excesso de peso abaixo de $100\text{ Hz}$. Remasterize no perfil **`Clear Sky`**. O seu algoritmo é o mais plano e transparente, preservando o equilíbrio sônico original sem saturar os graves.
*   **"O volume ficou muito baixo comparado às tracks comerciais do Spotify."**  
    *   *Correção:* Você utilizou o perfil `Aurora` (focado em dinâmica macia) em uma faixa que pedia energia. Remasterize no perfil **`Sunroof`** na intensidade **`Alta (Competitiva)`** [1.2.6].

---

## 📦 Estrutura de Arquivos e Execução

src/
├── app/
│ ├── components/
│ │ ├── upload-zone/ # Dropzone + Terminal Sônico (Main)
│ │ ├── mastering-panel/ # Seletores de Perfil, Intensidade e A/B Play
│ │ └── ekg-monitor/ # Oscilloscópio Visual de Espectro
│ └── services/
│ ├── dsp.service.ts # Handshake HTTP e upload direto ao S3
│ └── language.service.ts# Gerenciamento de i18n via Angular Signals

### Instalação & Execução Local:
```bash
# 1. Instale as dependências visuais (Lucide Icons)
npm install

# 2. Inicie o servidor do Angular
npm run start # ou 'ng serve'
