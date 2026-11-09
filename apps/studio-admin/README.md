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
- `GCP_FIRESTORE_DATABASE_ID`

Não é necessário `SUPABASE_SERVICE_ROLE_KEY`, service-account JSON ou Firebase private key.
Firestore usa Vercel OIDC + Workload Identity Federation com token temporário.

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
