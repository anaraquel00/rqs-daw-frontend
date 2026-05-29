# 🎛️ Manual de Referência Acústica - RQS DSP Core

Este documento estabelece as diretrizes de engenharia e os critérios de decisão para o processamento de masterização no motor da **RaQuel Synths (RQS)**. Ele correlaciona os subgêneros musicais específicos do catálogo da banda aos 4 perfis acústicos disponíveis no nosso frontend.

---

## 🧭 A Regra de Ouro da Seleção

Antes de disparar o motor de renderização, analise a estrutura da sua faixa crua vinda da IA (Suno) e identifique o seu **Ancoragem Sonora Central**:

1. **O guia da música é a VOZ ou um instrumento melódico solo muito limpo?**  
   ➡️ Use **`🌤️ Clear Sky`** (Foco em Clareza e Transientes)
2. **O guia da música é o GRAVE físico, o bumbo de clube ou o groove de pista?**  
   ➡️ Use **`⛈️ Thunder`** (Foco em Peso e Subgrave)
3. **O guia da música é a PRESSÃO, energia sintetizada comercial ou refrão de festival?**  
   ➡️ Use **`☀️ Sunroof`** (Foco em Volume Comercial/RMS)
4. **O guia da música é a ATMOSFERA, texturas flutuantes, pads e melancolia?**  
   ➡️ Use **`🌌 Aurora`** (Foco em Espaço e Calor Analógico)

---

## 📊 Especificações Técnicas dos 4 Perfis Acústicos

| Perfil | Alvo de Volume (LUFS) | Teto Real (True Peak) | Comportamento Principal | Aplicação Estética |
| :--- | :--- | :--- | :--- | :--- |
| **⛈️ Thunder** | `-9.0 LUFS` | `-1.2 dBTP` | Boost focado abaixo de $65\text{ Hz}$. Compressão de graves firme (ataque lento, release de $150\text{ ms}$). | Clássicos de pista, bumbos eletrônicos pesados e grooves profundos. |
| **🌤️ Clear Sky** | `-10.5 LUFS` | `-1.0 dBTP` | Presença de médios-altos em $3.2\text{ kHz}$. Abertura de ar lateral acima de $8\text{ kHz}$. | Vocais limpos, solos instrumentais, plucks e faixas dinâmicas de streaming. |
| **☀️ Sunroof** | `-8.0 LUFS` | `-1.5 dBTP` | Compressão rápida (ataques de $15\text{ ms}$ e release curto). Teto baixo contra distorção interamostra. | Volume comercial ensurdecedor, blocos gigantes de sintetizadores (*supersaws*). |
| **🌌 Aurora** | `-11.5 LUFS` | `-1.0 dBTP` | Saturação de fita analógica sutil no Mid. Compressão suave (release longo). Máxima abertura estéreo difusa. | Ambiências orgânicas, pads analógicos longos e texturas vintage/retro. |

---

## 🗂️ Matriz de Decisão por Gênero Musical

### 1. Progressive House
*   **Melodic & Vocal** *(Estilo Lane 8, Deadmau5, Anjunadeep)*  
    *   👉 **`🌤️ Clear Sky`**  
    *   *Por quê?* Abre o espaço das laterais (Side) para os delays e reverbs, joga os vocais femininos limpos para a frente e remove a "lama" digital típica da geração de IA na região de $250\text{ Hz}$.
*   **Dark & Club Groove** *(Estilo Eric Prydz / Cirez D, Digweed)*  
    *   👉 **`⛈️ Thunder`**  
    *   *Por quê?* Progressive House de pista vive de subgraves e da pressão física no peito. A compressão do Thunder segura o sub-bass estável sem distorcer o bumbo.
*   **Mainstage & Festival** *(Estilo Alesso, Avicii, Swedish House Mafia)*  
    *   👉 **`☀️ Sunroof`**  
    *   *Por quê?* Necessita de volume competitivo para tocar em grandes sistemas de som. O compressor esmaga a dinâmica para dar a sensação de "bombeamento" e energia constante.
*   **Deep & Organic** *(Estilo Ben Böhmer, Rüfüs Du Sol)*  
    *   👉 **`🌌 Aurora`**  
    *   *Por quê?* Plucks orgânicos e acordes melancólicos de sintetizadores beneficiam-se da "cola" harmônica e do calor do nosso algoritmo de emulação de fita analógica.

---

### 2. Synthwave
*   **Classic Retrowave / Dreamwave** *(Estilo The Midnight, Trevor Something)*  
    *   👉 **`🌌 Aurora`**  
    *   *Por quê?* O Synthwave vive da nostalgia dos anos 80. A saturação analógica sutil e o alargamento estéreo do perfil Aurora simulam com perfeição a textura física de uma fita de rolo ou fita cassete.
*   **Darksynth / Outrun** *(Estilo Carpenter Brut, Perturbator)*  
    *   👉 **`☀️ Sunroof`**  
    *   *Por quê?* O ritmo é rápido, focado em linhas de baixo sintetizadas violentas e bumbos de alta pressão sonora. Exige máxima densidade e volume.

---

### 3. Industrial Metal & Aggrotech
*   **Industrial Metal** *(Estilo Rammstein, Ministry)*  
    *   👉 **`☀️ Sunroof`**  
    *   *Por quê?* Guitarras distorcidas geram forte mascaramento de frequência. O compressor rápido do Sunroof amarra a parede de guitarras de forma compacta sem deixar os transientes rápidos do bumbo de metal sumirem.
*   **Aggrotech / Power Noise** *(Estilo Combichrist, Hocico)*  
    *   👉 **`⛈️ Thunder`**  
    *   *Por quê?* Vocais distorcidos e synths gritantes saturam conversores rapidamente. O Thunder fornece o grave estrodondoso que o gênero pede e corta cirurgicamente as frequências estridentes em $4\text{ kHz}$ com o equalizador dinâmico para evitar fadiga auditiva.

---

## 🛠️ Guia de Resolução de Problemas (Troubleshooting)

*   **"Meu arquivo masterizado ficou com os agudos estalando/irritantes no fone de ouvido."**  
    *   *Diagnóstico:* A track gerada pelo Suno continha sibilância/harshness excessivos e você masterizou usando o perfil `Sunroof` ou `Clear Sky`.  
    *   *Correção:* Remasterize no perfil **`Thunder`** (que tem controle passivo de agudos ásperos) ou no perfil **`Aurora`** (que suaviza agudos através de compressão analógica de fita).
*   **"Sinto que o grave está distorcendo as outras partes da música."**  
    *   *Diagnóstico:* A mixagem original já tinha excesso de peso abaixo de $100\text{ Hz}$ e você tentou forçar o perfil `Thunder`.  
    *   *Correção:* Remasterize no perfil **`Clear Sky`**. O algoritmo dele é o mais plano e transparente, preservando o equilíbrio tonal original sem forçar os subgraves.
*   **"O volume ficou muito baixo se comparado às tracks comerciais do Spotify."**  
    *   *Diagnóstico:* Você utilizou o perfil `Aurora` (que foca em dinâmica suave) em uma música que exigia energia de pista.  
    *   *Correção:* Remasterize no perfil **`Sunroof`** para empurrar o RMS da música de forma agressiva.


## Guia Definitivo de Seleção (O Livro de Regras RQS)

---

### 🎯 A Pergunta de Ouro antes de Masterizar
Olhe para a sua track crua vinda do Suno e se pergunte: **"Qual é o elemento mais importante que guia essa música?"**

* Se for a **VOZ** ou o brilho de um instrumento solo ➡️ **CÉU CLARO (Clear Sky)**
* Se for o **GRAVE** físico no peito (sub-bass/groove) ➡️ **TROVÃO (Thunder)**
* Se for a **PRESSÃO** e energia de sintetizadores gigantes ➡️ **TETO SOLAR (Sunroof)**
* Se for a **AMBIÊNCIA** e as texturas espaciais (reverbs/viagem) ➡️ **AURORA (Aurora)**

---

### 🎛️ O Livro de Regras por Gênero Musical

#### 1. PROGRESSIVE HOUSE (Seu foco atual)

| Tipo de Progressive House | Perfil Recomendado | Por que usar? | O que ele faz no som? |
| :--- | :--- | :--- | :--- |
| **Vocal e Melódico** *(Estilo Deadmau5, Lane 8)* | 🌤️ **Clear Sky** | Vocais femininos e melodias de plucks precisam de ar e definição. | Puxa a voz para o centro, abre o estéreo acima de $8\text{ kHz}$ e limpa o bolo de frequências baixas [1.2.2]. |
| **Groove de Clube / Dark** *(Estilo Pryda, John Digweed)* | ⛈️ **Thunder** | Músicas focadas na batida e no subgrave precisam de peso físico na pista de dança. | Dá ganho focado abaixo de $60\text{ Hz}$ e usa uma compressão de graves mais firme para segurar o bumbo [1.2.2]. |
| **Mainstage / Festival** *(Estilo Alesso, Avicii)* | ☀️ **Sunroof** | Chords gigantes de dente de serra (*supersaws*) precisam soar massivos e competitivos. | Espreme a dinâmica para atingir volume comercial máximo ($-8\text{ LUFS}$) e dá brilho aos synths [1.2.6]. |
| **Deep / Melodic House** *(Estilo Ben Böhmer, Rufus Du Sol)* | 🌌 **Aurora** | Músicas profundas e orgânicas precisam de calor para não parecerem "plásticas" ou frias. | Aplica uma saturação harmônica sutil (simulando fita cassete) e espalha os reverbs pelas laterais [1.2.2]. |

---

#### 2. SYNTHWAVE
* **Se for o clássico Melódico / Retrowave** *(Estilo The Midnight)* ➡️ **🌌 Aurora**
  * *Por quê?* O Synthwave vive da nostalgia dos anos 80. O perfil Aurora adiciona saturação de fita analógica no canal central e espalha o efeito de *chorus* característico das guitarras e sintetizadores vintage nas laterais.
* **Se for Darksynth / Cyberpunk rápido** *(Estilo Carpenter Brut)* ➡️ **☀️ Sunroof**
  * *Por quê?* Exige o volume comercial esmagador ($-8\text{ LUFS}$) e a compressão rápida de festival para que a parede de sintetizadores agressivos soe imponente [1.2.6].

---

#### 3. INDUSTRIAL METAL & AGGROTECH
* **Se for Industrial Metal** *(Estilo Rammstein / Ministry)* ➡️ **☀️ Sunroof**
  * *Por quê?* Guitarras distorcidas precisam de densidade. O Sunroof espreme o som para dar a sensação de "parede", mas usa o crossover multibanda para impedir que a bateria acústica rápida suma no meio das guitarras.
* **Se for Aggrotech** *(Estilo Combichrist)* ➡️ **⛈️ Thunder**
  * *Por quê?* O Aggrotech é guiado por bumbos eletrônicos de techno industrial extremamente distorcidos. O Thunder garante o peso desse subgrave na pista, enquanto aplica um filtro cirúrgico nos agudos para que os vocais ultra-distorcidos não firam os ouvidos do ouvinte.

---

### Resumo prático para o seu fluxo no Frontend:
Se você estiver na dúvida entre os quatro, **a regra geral para Progressive House moderno é usar o `Clear Sky` para faixas melódicas/vocais e o `Thunder` para faixas instrumentais de pista.** Deixe o `Sunroof` estritamente para quando você precisar de volume ensurdecedor de rádio e o `Aurora` para músicas introspectivas e espaciais.
