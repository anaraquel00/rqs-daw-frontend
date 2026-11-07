# Waitlist plan interest and Commercial Admin — deployment gates

Este documento descreve propostas para revisão. Nenhuma alteração abaixo foi aplicada.

## Gate 1 — Supabase admin membership

Aplicar `supabase/review/studio_admin_memberships_migration.sql` primeiro em ambiente local ou
Staging. A tabela é independente de `profiles.role` e de planos comerciais. O cliente autenticado
só pode consultar a própria membership ativa; somente `service_role` pode administrar memberships.

Validar `supabase/review/studio_admin_memberships_tests.sql` e o endpoint `/api/admin/session` antes
de cadastrar qualquer administrador real.

## Gate 2 — Firestore IAM dedicado

A role custom existente deve conservar `datastore.entities.get`, `datastore.entities.list` e
`datastore.entities.create` e receber somente `datastore.entities.update`. O binding continua
condicionado ao database dedicado:

```text
resource.name.startsWith("projects/raquel-synths-platform/databases/rqs-referral-preview")
```

O acesso ao `(default)` permanece zero. O dashboard usa `runAggregationQuery`; ele não necessita
retornar documentos individuais para o browser. Não adicionar `delete`, permissões administrativas
ou service-account key.

## Gate 3 — reserved Uplink slug

O arquivo já existente `supabase/review/uplink_canonical_host_reserved_slugs_migration.sql` inclui
`admin` na lista reservada. Ele permanece unapplied e não é pré-requisito para testar a aplicação
em Staging. Antes da aplicação, repetir a auditoria isolada já definida para essa migration.

## Gate 4 — Staging application

Depois dos Gates 1 e 2 em Staging, publicar o código em deployment não público e validar:

1. inscrição anônima continua create-only;
2. conta autenticada com e-mail verificado lê e altera apenas o documento derivado de seu e-mail;
3. campos de Founding Referral permanecem inalterados;
4. `/admin` exige membership ativa e responde somente contagens agregadas;
5. `/admin` tem `noindex, nofollow`, não aparece no sitemap e é contido no host canônico;
6. PT-BR, EN, PL e FR permanecem completos.

## Mudança futura de e-mail

O ownership atual é compatível com a normalização/hash já existente: o document ID continua sendo
derivado de `trim().toLowerCase()` do e-mail. Se o e-mail verificado da conta mudar, a preferência
antiga não é movida automaticamente; o endpoint retorna 404 para impedir takeover implícito. Uma
futura migração de ownership exigirá prova dos dois endereços e gate separado.
