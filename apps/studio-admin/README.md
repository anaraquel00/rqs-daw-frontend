# RQS Studio Admin — Phase 1

Aplicação Angular e runtime Vercel independentes para `studio-admin.raquelsynths.com`.
Esta fase é estritamente read-only: as únicas operações administrativas expostas são
consultas agregadas por `GET`.

## Vercel Project

Criar um segundo projeto Vercel conectado ao mesmo repositório GitHub com:

- **Root Directory:** `apps/studio-admin`
- **Framework Preset:** Angular
- **Production Branch:** `main`
- **Domain (após QA e merge autorizado):** `studio-admin.raquelsynths.com`

Não executar `vercel deploy`, `vercel --prod` ou promoção manual. Preview é produzido
exclusivamente pela Git Integration ao fazer push da branch.

O gate inicial de Preview usa o projeto `rqs-studio-admin`
(`prj_JbgOtjerk4bclrPnEnr7gJywP4tJ`) no team `raquelsynths-projects`. As variáveis GCP,
Firestore e Supabase são configuradas somente no target Preview. `ADMIN_ALLOWED_ORIGINS` deve ser
adicionado apenas depois que a Git Integration gerar a origem exata do primeiro Preview; wildcard
e domínios Vercel genéricos permanecem proibidos.

## Environment variables

Configurar no projeto Vercel administrativo, com valores separados por ambiente:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `RQS_ADMIN_DATA_ENVIRONMENT` (`staging` em Preview; `production` em Production)
- `ADMIN_ALLOWED_ORIGINS` (lista explícita, separada por vírgula, dos Preview URLs aprovados)
- `GCP_PROJECT_ID`
- `GCP_PROJECT_NUMBER`
- `GCP_WORKLOAD_IDENTITY_POOL_ID`
- `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- `GCP_ADMIN_FIRESTORE_DATABASE_ID` (`rqs-studio-admin-staging` em Preview)
- `GCP_REFERRAL_FIRESTORE_DATABASE_ID` (`rqs-referral-staging` em Preview)

Não é necessário `SUPABASE_SERVICE_ROLE_KEY`, service-account JSON ou Firebase private key.
Firestore usa Vercel OIDC + Workload Identity Federation com token temporário.

O Admin datastore e a fonte Referral são namespaces independentes. O primeiro pode permanecer
vazio na Phase 1. `pro_waitlist` e `founding_referral_participants` continuam pertencendo ao
Referral e são consultados somente por aggregations read-only. A identidade federada deve receber
permissão administrativa estritamente necessária no database Admin e apenas
`datastore.entities.get`/`datastore.entities.list` no database Referral, com IAM Conditions por
database.

Os endpoints de dados da Phase 1 aceitam exclusivamente `VERCEL_ENV=preview`,
`RQS_ADMIN_DATA_ENVIRONMENT=staging` e os dois database IDs de Staging acima. Production permanece
fail-closed até um rollout explicitamente autorizado. O datastore futuro do Admin é
`rqs-studio-admin-production`; o nome da fonte Referral Production não é inferido nem configurado
neste patch.

## Supabase review gate

1. Auditar e aplicar manualmente `supabase/review/studio_admin_memberships_migration.sql`
   no projeto Supabase correto.
2. Obter o UUID real da conta Supabase Auth da Ana sem inferir ou buscar por e-mail no app.
3. Executar `supabase/review/studio_admin_owner_bootstrap.sql` passando `owner_user_id` via `psql -v`.
4. Adicionar os redirect URLs exatos do Preview e de
   `https://studio-admin.raquelsynths.com/` à allowlist do Supabase Auth.

## Local gates

```bash
npm ci
npm run test:api
npm run test:security
npm test
npm run build
```
