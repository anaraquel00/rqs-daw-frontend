# Waitlist plan interest and RQS Studio Admin — isolated deployment gates

Este documento é uma proposta para revisão. Nenhum recurso, secret, binding, migration ou
deployment descrito abaixo foi criado ou alterado.

## Princípio de isolamento

Staging não pode compartilhar escrita, lista de contatos nem identidade privilegiada com
Production. A configuração deve falhar fechada quando ambiente, database, identidade ou modo de
notificação não corresponderem a uma combinação explicitamente permitida.

## Gate 1 — RLS descartável

Validar `supabase/review/studio_admin_memberships_migration.sql` e
`supabase/review/studio_admin_memberships_tests.sql` em uma stack Supabase local descartável, nunca
nos projetos compartilhados.

Procedimento proposto:

1. confirmar Docker e a versão do Supabase CLI com `supabase --version`;
2. criar um diretório temporário fora do repositório;
3. inicializar a stack local com `supabase init`;
4. criar arquivos locais com `supabase migration new studio_admin_memberships` e
   `supabase test new studio_admin_memberships_rls`;
5. copiar o conteúdo dos dois artefatos de review para os arquivos gerados;
6. iniciar a stack local, resetar o banco e executar `supabase test db`;
7. exigir 14 assertions pgTAP aprovadas;
8. destruir a stack sem backup e remover o diretório temporário.

A migration recusa qualquer tabela `studio_admin_memberships` preexistente. Uma tabela existente
exige auditoria explícita de schema; ela nunca é aceita por `if not exists`.

## Gate 2 — datastores isolados de Staging

Datastore administrativo proposto, ainda não provisionado:

```text
project:  raquel-synths-platform
database: rqs-studio-admin-staging
```

O database pode começar vazio. Nenhuma collection artificial, documento Referral ou fixture deve
ser copiada apenas para materializar uso.

A fonte externa read-only permanece separada:

```text
project:  raquel-synths-platform
database: rqs-referral-staging
collections: pro_waitlist, founding_referral_participants
```

Essas collections continuam pertencendo ao sistema Referral/Waitlist e não são migradas para o
datastore administrativo.

## Gate 3 — autorização IAM separável por database

A federação Vercel OIDC + Google Workload Identity Federation pode ser reutilizada, mas os grants
devem permanecer distinguíveis por database. Proposta, ainda não provisionada:

```text
Admin database:    rqs-studio-admin-staging
Admin permissions: somente o acesso administrativo necessário ao backoffice

Referral database:    rqs-referral-staging
Referral permissions: datastore.entities.get
                      datastore.entities.list
```

Os bindings devem usar igualdade exata no respectivo database. O binding Referral, por exemplo:

```text
resource.type == "firestore.googleapis.com/Database" &&
resource.name == "projects/raquel-synths-platform/databases/rqs-referral-staging"
```

O subject de `roles/iam.workloadIdentityUser` deve aceitar somente Preview/Staging. Antes de definir
a condition, o gate deve inspecionar as claims reais do token Vercel e fixar o claim exato da branch
ou custom environment; não se deve adivinhar o nome do claim nem usar wildcard. Phase 1 não recebe
permissão de escrita na fonte Referral.

## Gate 4 — configuração Firestore fail-closed e source-aware

O runtime administrativo exige:

- `VERCEL_ENV=preview` e `RQS_ADMIN_DATA_ENVIRONMENT=staging`;
- `GCP_ADMIN_FIRESTORE_DATABASE_ID=rqs-studio-admin-staging`;
- `GCP_REFERRAL_FIRESTORE_DATABASE_ID=rqs-referral-staging`;
- módulos e funções distintos para Admin e Referral;
- combinação ausente, desconhecida ou cruzada interrompe a requisição antes de obter token;
- `(default)` permanece proibido;
- a allowlist de `pro_waitlist` e `founding_referral_participants` existe somente no módulo Referral;
- o emulador só é permitido com `NODE_TEST_CONTEXT`.

A implementação valida o conjunto completo antes de solicitar credenciais OIDC ou executar uma
aggregation:

```text
Admin datastore  -> rqs-studio-admin-staging
Referral source  -> rqs-referral-staging (read-only)
```

O datastore futuro do Admin será `rqs-studio-admin-production`, mas não é configurado neste gate.
A fonte Referral Production exige identificação e auditoria separadas; seu nome não é inferido.
Qualquer combinação Production permanece bloqueada na Phase 1.

Testes obrigatórios devem rejeitar: variável ausente, ambiente desconhecido, `(default)`, qualquer
database Production em Preview, datastores Admin/Referral iguais e collection fora da allowlist
Referral.

## Gate 5 — Brevo sem dados comerciais

Escolher uma das opções, sem fallback automático:

1. lista Brevo exclusiva de teste, com credencial não-Production; ou
2. `WAITLIST_NOTIFICATION_MODE=noop` em Staging.

No modo `noop`, a API registra explicitamente que a notificação foi suprimida sem chamar Brevo. Se
o ambiente for Staging e o modo/lista de teste não estiver configurado, a integração deve falhar
antes da inscrição, nunca reutilizar `BREVO_WAITLIST_LIST_ID` de Production.

A implementação local restringe `noop` a Staging e `brevo` a Production. O modo Production sem a
nova variável preserva temporariamente o comportamento publicado (`brevo`), mas exige chave e list
ID completos antes da escrita Firestore. `noop`, valores desconhecidos e configuração incompleta
falham antes da inscrição. O endpoint `/api/contact` não compartilha esse seletor: sem sua própria
configuração Brevo ele retorna erro antes de qualquer escrita ou chamada externa, evitando que um
Preview herde implicitamente o modo da waitlist.

## Gate 6 — variáveis Vercel restritas à branch

Todas as variáveis GCP, OIDC, Firestore e Brevo de Staging devem ser criadas como Preview overrides
restritos à branch aprovada. Nenhum valor Production deve ser copiado. Antes do deployment, listar
somente metadados das variáveis e comprovar:

- branch correta;
- Admin database `rqs-studio-admin-staging`;
- Referral database `rqs-referral-staging`;
- service account exclusiva;
- audience/provider exclusivos ou condition Preview-only;
- lista Brevo de teste ou modo `noop`;
- nenhuma variável global Preview/Production compartilhada.

## Gate 7 — provas de contenção

Antes do smoke de aplicação:

1. o runtime reconhece `rqs-studio-admin-staging` como datastore Admin, mesmo vazio;
2. a identidade Staging agrega somente as collections permitidas em `rqs-referral-staging`;
3. a mesma identidade recebe negação de escrita em `rqs-referral-staging` e negação em `(default)`;
4. o código rejeita database cruzado ou Production antes da autenticação GCP;
5. o teste do emulador preserva os campos de Founding Referral;
6. o dashboard retorna somente contagens agregadas e nenhum campo de documento;
7. a configuração Brevo não alcança a lista comercial.

## Gate 8 — deployment sem aliases

Somente depois dos gates anteriores, criar um deployment Preview sem aliases públicos e validar:

1. inscrição nova persiste exatamente o plano escolhido;
2. inscrição existente permanece create-only e não gera nova conversão;
3. `/app/account` atualiza somente `plan_interest` e seu timestamp;
4. referral original permanece inalterado;
5. `studio-admin.raquelsynths.com` exige membership `owner` ativa e responde somente agregados;
6. toda rota do app administrativo mantém `noindex`, `nofollow` e canonical no hostname isolado;
7. PT-BR, EN, PL e FR continuam completos.

## Rollback por dependência

- **Código:** descartar o deployment sem alias ou reverter os commits da branch.
- **Supabase local:** destruir a stack descartável sem backup.
- **Supabase Staging futuro:** remover a membership bootstrap pelo UUID exato; remover a tabela
  somente se vazia e sem dependências.
- **IAM:** remover somente os bindings Preview por database; não alterar identidades Production.
- **Admin Firestore Staging:** bloquear acesso antes de considerar exclusão do database vazio.
- **Referral Firestore Staging:** remover somente o grant read-only do Admin; não alterar ou copiar
  as collections de Referral e nunca tocar em `(default)`.
- **Vercel:** remover somente os IDs de variáveis branch-scoped criados no gate.
- **Brevo:** remover a lista de teste ou desativar o modo de integração; nenhum contato comercial é
  afetado.

## Mudança futura de e-mail

O document ID continua derivado de `trim().toLowerCase()` do e-mail verificado. Se o e-mail da conta
mudar, a preferência antiga não é movida automaticamente e o endpoint retorna `404`, impedindo
takeover implícito. Migração de ownership exige prova dos dois endereços e gate separado.
