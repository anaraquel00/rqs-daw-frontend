# RQS Studio — Frontend

Frontend web do **RQS Studio / RaQuel Synths Digital Audio Workstation**, desenvolvido em Angular e integrado ao backend `rqs-daw-backend` para fluxos de masterização, setlists, stems, deep links e autenticação.

> Estado atual: produto independente em desenvolvimento ativo. O código da branch `main` contém funcionalidades públicas e também áreas ainda em evolução para uma futura oferta SaaS B2B. Este README descreve apenas comportamentos sustentados pelo código auditado nesta branch.

## Stack confirmada

- Angular 20.3.x
- TypeScript 5.9.x
- Angular Standalone Components
- Angular SSR / prerender
- RxJS 7.8
- Supabase JS
- Express 5 (runtime SSR)
- Web Audio API
- AWS S3 via URLs pré-assinadas fornecidas pelo backend
- Vercel serverless function para waitlist

O `package.json` da branch `main` também contém dependências de AWS SDK, Stripe e WebSocket. Nem todas são necessariamente utilizadas diretamente pelo código frontend atual; por isso não são apresentadas aqui como capacidades ativas sem contexto.

## Rotas da aplicação

A aplicação possui as seguintes rotas principais:

- `/` — landing page
- `/app` — workspace principal do RQS Studio
- `/terms` — termos
- `/privacy` — privacidade
- `/termos` e `/privacidade` — redirects compatíveis

A landing page, termos e privacidade são configurados para prerender. O workspace `/app` utiliza renderização client-side porque depende de APIs de navegador, incluindo Web Audio, `localStorage`, `navigator.clipboard`, `Audio`, `URL.createObjectURL` e autenticação OAuth.

## Arquitetura do workspace

O `WorkspaceComponent` combina quatro áreas principais:

1. **Upload / Mastering Core**
2. **Setlist Engine**
3. **RQS Uplink Engine**
4. **Uplink Dashboard**

Também integra autenticação, troca PT/EN, SEO dinâmico e navegação legal.

```text
Browser
  │
  ├── Angular Workspace
  │   ├── UploadZone
  │   │   ├── MasteringPanel
  │   │   └── EKG Monitor
  │   ├── MixPanel
  │   ├── RQS Uplink Engine
  │   └── Uplink Dashboard
  │
  ├── Supabase
  │   ├── Auth
  │   ├── profiles
  │   └── rqs_uplinks
  │
  ├── RQS backend / AWS Lambda
  │   ├── /mastering
  │   ├── /mix
  │   ├── /video
  │   └── /stems
  │
  └── /api/waitlist (Vercel)
      ├── Firestore REST API
      └── Brevo API
```

## Masterização

### Upload para S3

Ao selecionar ou arrastar um arquivo, o frontend aceita `.wav` e `.mp3` no fluxo principal, solicita ao backend uma URL pré-assinada e envia o arquivo diretamente ao S3.

O fluxo implementado é:

```text
File -> GET /mastering/presigned-url
     -> PUT direto para S3
     -> s3Key armazenada no estado local
     -> POST /mastering/process
```

A URL base do backend é lida de `src/environments/environment.ts`.

### Previews

O `UploadZoneComponent` gera um lote de quatro previews para os perfis:

- `thunder`
- `clear_sky`
- `sunroof`
- `aurora`

Cada preview utiliza o mesmo `s3Key` e `preview=true`. As respostas binárias são convertidas em object URLs e mantidas em cache local para troca de perfil sem novo upload.

### Masterização completa

A master final usa `/mastering/process` e espera resposta JSON contendo pelo menos `downloadUrl` e `fileName`.

Após sucesso, o frontend:

- atualiza o player A/B;
- registra o consumo da cota local/perfil;
- expõe a URL de download;
- mantém o nome do arquivo processado no serviço compartilhado de comparação.

## Comparação A/B com Web Audio API

`AudioComparisonService` implementa comparação entre áudio original e master por meio de:

- dois `HTMLAudioElement`;
- `AudioContext`;
- `GainNode` dedicado para cada variante;
- crossfade de aproximadamente 30 ms na troca A/B;
- sincronização periódica das posições;
- modos `full-track` e `preview-15s`.

O serviço também encerra `AudioContext`, limpa estados e coordena reprodução/scrubbing.

## Controles de masterização

`MasteringService` mantém parâmetros reativos com Angular Signals para:

- low crossover cutoff;
- high crossover cutoff;
- stereo width;
- saturation amount;
- mono bass frequency;
- limiter ceiling;
- limiter threshold.

O `MasteringPanelComponent` expõe esses controles na UI e gera um payload com nomes como `low_cutoff_hz`, `high_cutoff_hz`, `stereo_width`, `saturation_amount`, `mono_bass_frequency_hz`, `ceiling_dbtp` e `threshold_db`.

### Limitação atual importante

Na branch `main`, `UploadZoneComponent.processarMaster()` recebe apenas `estilo`, `intensidade` e `preview`. Embora o `MasteringPanelComponent` emita também `customParams`, esses parâmetros não são encaminhados nesse método para o backend.

Portanto, **os controles avançados existem na UI/estado, mas não devem ser descritos como comprovadamente aplicados ao processamento remoto na branch `main` atual**.

## Setlist Engine

O `MixPanelComponent` implementa um fluxo de setlist com:

- drag & drop / file picker;
- arquivos WAV/MP3;
- upload silencioso individual para S3;
- ordenação das faixas;
- remoção de tracks;
- duração por faixa;
- crossfade configurável;
- curvas `linear`, `equal-power` e `fast-cut`;
- modos de loudness `off`, `perceived` e `normalize`;
- preview local das transições com Web Audio API;
- renderização final via `/mix/generate-s3`.

### Observações de auditoria

A representação gráfica de waveform do Setlist Engine não analisa o conteúdo real do áudio: `getCachedPeaks()` gera alturas determinísticas a partir do nome do arquivo. Ela deve ser apresentada como **visualização de UI**, não como waveform medido.

Da mesma forma, as funções `detectarDiferentesSampleRates()` e `detectarDiferentesBitDepths()` inferem diferenças procurando strings como `48k` e `16bit` no nome dos arquivos. Elas não inspecionam os metadados reais dos arquivos.

## Stem separation

O frontend expõe extração de stems por meio de `/stems/split-s3`.

O fluxo usa o arquivo já enviado ao S3 e envia apenas a `s3Key` ao backend. A resposta esperada contém uma URL pré-assinada para download do ZIP de stems.

A separação em si não acontece no navegador; é delegada ao backend.

## RQS Uplink Engine

O módulo gera links curtos em `go.raquelsynths.com` e detecta plataformas como:

- Spotify
- Bandcamp
- YouTube
- SoundCloud

A criação de links exige sessão autenticada e grava registros em `rqs_uplinks` no Supabase.

O limite frontend atual para usuários não premium é de três links.

### Estado atual do dashboard

A fonte primária exibida pelo `RqsUplinkDashboardComponent` é `localStorage` (`rqs_uplink_database`). O serviço também insere o registro no Supabase ao criar o link, mas o dashboard não lê os registros do Supabase na branch `main` auditada.

Consequências:

- clicks, conversion rate e traffic sources mostrados no dashboard podem representar apenas o cache local;
- remover um link pelo dashboard remove o item apenas do `localStorage`;
- não há evidência na branch `main` de exclusão correspondente no Supabase por essa ação.

Por isso o dashboard não deve ser descrito como analytics server-side consolidado neste estado.

## Autenticação e quotas

`AuthService` utiliza Supabase Auth com OAuth para:

- GitHub
- Google

O estado reativo inclui:

- sessão;
- role `free | premium`;
- quantidade de masters concluídas;
- cota restante;
- limite de links.

### Cota gratuita

A UI aplica atualmente três masterizações gratuitas.

Para usuários autenticados, `completed_masters` é lido/atualizado em `profiles` no Supabase.

Para usuários anônimos, a contagem é mantida em `localStorage` e reiniciada após 30 dias.

### Limitação de segurança

Esses controles frontend não substituem autorização server-side. Um cliente web pode ser modificado pelo usuário. Para uma futura oferta SaaS B2B, quotas, entitlement e billing precisam ser validados também no backend.

### Comportamento de localhost

Na branch `main`, sessões autenticadas em `localhost` ou `127.0.0.1` recebem `premium` localmente para desenvolvimento.

Esse comportamento é intencionalmente documentado aqui porque é relevante para auditoria. Ele não representa uma permissão de produção.

## Waitlist RQS Pro

`api/waitlist.js` implementa uma função serverless separada do bundle Angular.

O endpoint:

- aceita apenas `POST`/`OPTIONS`;
- possui allowlist de origins;
- utiliza honeypot `website`;
- normaliza e valida email;
- gera ID SHA-256 determinístico a partir do email;
- tenta persistir o cadastro via Firestore REST API;
- envia/atualiza o contato no Brevo;
- lê credenciais Brevo de environment variables.

A função trata `409` do Firestore como usuário já cadastrado.

## SEO e SSR

O frontend possui `SeoService` próprio para:

- `<title>`;
- meta description;
- robots;
- Open Graph;
- Twitter cards;
- canonical URLs;
- JSON-LD.

O workspace configura JSON-LD como `SoftwareApplication` / `Digital Audio Workstation` e marca a oferta com categoria `SaaS`.

Essa marcação representa o posicionamento do produto. **Ela não é, por si só, evidência de maturidade SaaS B2B, billing multi-tenant ou operação enterprise.**

Arquivos públicos adicionais incluem:

- `robots.txt`
- `sitemap.xml`
- favicon
- imagens da plataforma

## Internacionalização

A aplicação possui um `LanguageService` próprio e troca reativamente entre PT e EN.

O mecanismo é interno ao projeto; não depende de uma biblioteca i18n externa no runtime principal.

## Componentes DSP de UI

A árvore contém controles dedicados para:

- crossover;
- limiter;
- stereo;
- mastering panel;
- EKG monitor.

A existência desses componentes comprova a camada de interface e estado. O processamento DSP efetivo deve ser atribuído ao backend quando executado remotamente.

## Estrutura relevante do repositório

```text
.
├── api/
│   └── waitlist.js
├── public/
│   ├── assets/images/
│   ├── robots.txt
│   └── sitemap.xml
├── src/
│   ├── MANUAL_MASTERIZACAO.md
│   ├── app/
│   │   ├── components/
│   │   │   ├── crossover-control/
│   │   │   ├── ekg-monitor/
│   │   │   ├── limiter-control/
│   │   │   ├── mastering-panel/
│   │   │   ├── privacy/
│   │   │   ├── redirect-simulator/
│   │   │   ├── rqs-uplink-dashboard/
│   │   │   ├── stereo-control/
│   │   │   ├── terms/
│   │   │   └── upload-zone/
│   │   ├── landing-page/
│   │   ├── mix-panel/
│   │   ├── rqs-uplink-engine/
│   │   ├── services/
│   │   │   ├── audio-comparison.service.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── deep-link.service.ts
│   │   │   ├── dsp.ts
│   │   │   ├── language.service.ts
│   │   │   ├── mastering.service.ts
│   │   │   └── seo.service.ts
│   │   └── workspace/
│   └── environments/
├── angular.json
├── package.json
└── README.md
```

## Execução local

### Requisitos

- Node.js 22 recomendado
- npm

### Instalação

```bash
npm ci
```

### Desenvolvimento

```bash
npm start
```

ou:

```bash
ng serve
```

### Testes

```bash
npm test
```

O script utiliza `ng test`. A presença de um comando de teste não implica cobertura completa; a cobertura efetiva deve ser medida e publicada separadamente.

### Build

```bash
npm run build
```

### SSR

```bash
npm run serve:ssr:rqs-daw
```

O script pressupõe que o build SSR correspondente já exista em `dist/rqs-daw/server/server.mjs`.

## Configuração de backend

`DspService` lê `environment.baseUrl`.

Na branch `main` auditada, **`environment.ts` e `environment.prod.ts` são idênticos e ambos apontam para a URL pública do backend AWS Lambda**. Isso significa que `ng serve` também usa o backend remoto, a menos que o desenvolvedor altere essa configuração.

Essa decisão deve ser revista caso se deseje isolamento claro entre desenvolvimento, staging e produção.

## Pontos de atenção encontrados na auditoria

### Alta prioridade

1. **Entitlements e quotas server-side**
   - `canMaster()` e `canCreateLink()` são verificações de UI/cliente.
   - Para SaaS, o backend precisa ser a autoridade final.

2. **Uplink Dashboard ainda depende de `localStorage`**
   - leitura, remoção e métricas não estão sincronizadas integralmente com Supabase.

3. **Parâmetros avançados de mastering não chegam ao backend pela rota principal atual**
   - `MasteringPanel` emite `customParams`;
   - `UploadZone.processarMaster()` não os utiliza.

4. **Ambientes não estão separados**
   - development e production apontam para o mesmo backend remoto.

5. **Waveform e detecção técnica do Setlist Engine são aproximações de UI**
   - peaks são sintéticos;
   - sample rate / bit depth são inferidos pelo nome do arquivo.

### Médio prazo

- criar modelo de organização/tenant;
- RBAC (`owner`, `admin`, `member`);
- billing e entitlement server-side;
- estados de jobs de processamento;
- histórico persistente por usuário/organização;
- observabilidade e tracing por request/job;
- sincronização do Uplink Dashboard com fonte server-side;
- staging environment separado;
- testes de integração frontend/backend;
- políticas explícitas de retenção e deleção de arquivos.

## Status SaaS B2B

O código atual demonstra uma base funcional relevante para um produto web de music technology:

- autenticação;
- planos free/premium na UI e perfil;
- waitlist;
- integração com backend;
- uploads S3;
- processamento de áudio remoto;
- deep links;
- setlists;
- SEO;
- infraestrutura SSR/prerender.

Ainda não há evidência suficiente nesta branch para classificar o sistema como **SaaS B2B production-grade**. Em especial, multi-tenancy, RBAC empresarial, billing lifecycle completo, autorização server-side abrangente, observabilidade operacional e isolamento de tenants precisam ser implementados ou comprovados.

## Evidence policy

Este README evita tratar intenção, comentário de código ou branding como evidência de comportamento real.

Quando uma feature existe apenas parcialmente, a limitação é indicada explicitamente. Métricas de performance, escala, conversão, disponibilidade, segurança ou número de usuários não são declaradas sem benchmark, telemetria ou outra evidência reproduzível.

## Repositórios relacionados

- Frontend: `anaraquel00/rqs-daw-frontend`
- Backend / DSP: `anaraquel00/rqs-daw-backend`
- Aplicação pública: `https://studio.raquelsynths.com/app`
- Creator portfolio: `https://raquelsynths.com/creator`

---

**RQS Studio** é um produto independente de creative technology em evolução. O objetivo técnico atual é consolidar a plataforma em uma arquitetura mais segura, observável e adequada a um futuro modelo SaaS B2B sem apresentar funcionalidades experimentais como capacidades empresariais já concluídas.
