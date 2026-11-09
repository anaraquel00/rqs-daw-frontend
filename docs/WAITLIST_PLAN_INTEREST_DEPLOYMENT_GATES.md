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

## Gate 2 — Firestore exclusivo de Staging

Proposta de recurso, ainda não provisionada:

```text
project:  raquel-synths-platform
database: rqs-referral-staging
```

O database deve começar vazio e conter somente fixtures sintéticas `.invalid`. Nenhum documento
de `rqs-referral-preview` ou `(default)` pode ser copiado.

## Gate 3 — identidade IAM exclusiva

Proposta, ainda não provisionada:

```text
service account: rqs-referral-staging@raquel-synths-platform.iam.gserviceaccount.com
custom role:     RqsReferralStagingFirestoreAccess
permissions:     datastore.entities.create
                 datastore.entities.get
                 datastore.entities.list
                 datastore.entities.update
```

O binding deve usar igualdade exata:

```text
resource.type == "firestore.googleapis.com/Database" &&
resource.name == "projects/raquel-synths-platform/databases/rqs-referral-staging"
```

O subject de `roles/iam.workloadIdentityUser` deve aceitar somente Preview/Staging. Antes de definir
a condition, o gate deve inspecionar as claims reais do token Vercel e fixar o claim exato da branch
ou custom environment; não se deve adivinhar o nome do claim nem usar wildcard. O subject Production
não pode impersonar essa service account.

## Gate 4 — configuração Firestore fail-closed

Proposta de código posterior:

- uma variável server-only identifica o ambiente de dados (`staging` ou `production`);
- uma allowlist imutável mapeia `staging -> rqs-referral-staging` e
  `production -> rqs-referral-preview` enquanto esse for o database Production aprovado;
- `GCP_FIRESTORE_DATABASE_ID` precisa coincidir exatamente com o database permitido;
- combinação ausente, desconhecida ou cruzada interrompe a requisição antes de obter token;
- `(default)` permanece proibido;
- a allowlist de collections permanece limitada a `pro_waitlist` e
  `founding_referral_participants`;
- o emulador só é permitido com `NODE_TEST_CONTEXT`.

A implementação local usa `RQS_DATA_ENVIRONMENT` como seletor server-only e valida o conjunto
completo antes de solicitar credenciais OIDC ou executar uma operação:

```text
staging    -> rqs-referral-staging / rqs-referral-staging provider e service account
production -> rqs-referral-preview / rqs-referral-preview provider e service account
```

Também são validados o project ID `raquel-synths-platform`, project number, audience derivada do
provider, `VERCEL_TARGET_ENV` e `VERCEL_ENV`. A compatibilidade temporária com a configuração
Production publicada aceita ausência de `RQS_DATA_ENVIRONMENT` somente quando o contexto Vercel é
inequivocamente `production`; Preview/Staging sem a variável falha fechado.

Testes obrigatórios devem rejeitar: variável ausente, ambiente desconhecido, `(default)`, database
Production em Staging, database Staging em Production e collection fora da allowlist.

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
- database `rqs-referral-staging`;
- service account exclusiva;
- audience/provider exclusivos ou condition Preview-only;
- lista Brevo de teste ou modo `noop`;
- nenhuma variável global Preview/Production compartilhada.

## Gate 7 — provas de contenção

Antes do smoke de aplicação:

1. a identidade Staging cria, lê, lista e atualiza fixtures somente em `rqs-referral-staging`;
2. a mesma identidade recebe negação em `rqs-referral-preview` e `(default)`;
3. a identidade Production recebe negação em `rqs-referral-staging`;
4. o código rejeita database cruzado antes da autenticação GCP;
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
- **IAM:** remover o binding e desabilitar a service account exclusiva; não alterar a identidade
  Production.
- **Firestore Staging:** bloquear acesso antes de considerar exclusão do database; nunca tocar em
  `rqs-referral-preview` ou `(default)`.
- **Vercel:** remover somente os IDs de variáveis branch-scoped criados no gate.
- **Brevo:** remover a lista de teste ou desativar o modo de integração; nenhum contato comercial é
  afetado.

## Mudança futura de e-mail

O document ID continua derivado de `trim().toLowerCase()` do e-mail verificado. Se o e-mail da conta
mudar, a preferência antiga não é movida automaticamente e o endpoint retorna `404`, impedindo
takeover implícito. Migração de ownership exige prova dos dois endereços e gate separado.
