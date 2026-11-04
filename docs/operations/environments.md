# Environments: Supabase and Vercel

Status: configured with placeholders on 2026-11-04. Nothing is provisioned yet. This is the runbook for the owner steps, and the contract every package and app follows. Decision: [ADR-0006](../adr/0006-stack-hosting-and-repo-shape.md).

| Environment | Database and storage | Hosting | State |
|---|---|---|---|
| local | Supabase CLI stack (`supabase start`, Docker), Postgres 17 | `pnpm` on the developer machine | config in `supabase/config.toml`; one-command start and seed come with K0-T11 |
| preview | staging Supabase project | Vercel preview deployments | not created |
| staging | staging Supabase project (Mumbai) | Vercel, staging domain | not created |
| production | production Supabase project (Mumbai) | Vercel production | not created |

Use separate Supabase projects, with separate credentials, for staging and production (security guidelines 4.9). Previews use staging, never production.

## Owner checklist (Aadarsh)

Tick these as you go. Every value goes into a password manager or a provider's environment store, never into git or chat.

### Supabase (each of staging and production)
- [ ] Create the project in region **South Asia (Mumbai), `ap-south-1`**.
- [ ] Confirm that **Settings → Infrastructure** shows **Postgres 17**. If it shows another major, stop and tell the team: `supabase/config.toml`, CI (K0-T10) and the local image must all move together.
- [ ] Set a generated database password (32 or more characters) and store it.
- [ ] **Settings → API → Data API: turn it off**, or expose no schemas. The browser never reads tenant tables through PostgREST (ADR-0006 rule 1).
- [ ] Database → SSL: enforce SSL connections.
- [ ] Storage → Settings: enable the **S3 protocol** and create an access key pair for the server. Buckets stay private; the files module (K8) creates them through its migrations.
- [ ] Auth: leave it unused until decision D-05 (before K2-T15).
- [ ] Copy into the environment store (below): the transaction-pooler URL (port 6543), the session-pooler URL (port 5432), the S3 endpoint and the key pair.
- [ ] Do **not** copy the `anon` or `service_role` keys anywhere the app reads. Neither is used by application code.

### Vercel
- [ ] Create one project from this repository. Leave the Root Directory as the repository root; the build command is set when the web app lands (UI-T07 and the EPC demo views).
- [ ] Settings → General: Node.js **24.x**.
- [ ] Function region comes from `vercel.json` (`bom1`, Mumbai). Do not override it in the dashboard.
- [ ] Settings → Environment Variables: add the variables below, scoped **Production** to the production Supabase project and **Preview** to staging. Never tick "expose to the browser"; no variable gets a `NEXT_PUBLIC_` prefix.
- [ ] Git deployments are off in `vercel.json` (`git.deploymentEnabled: false`) until there is an app to build. The pull request that adds the web app turns them on.

### GitHub (for CI, K0-T10)
- [ ] Repository secrets: `DATABASE_MIGRATION_URL_STAGING`, `DATABASE_MIGRATION_URL_PRODUCTION`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Production secrets live in a protected environment that needs approval.

## Variables

Placeholders are in [.env.example](../../.env.example). Copy it to `.env.local` for local work; git ignores every `.env*` file except the example.

| Variable | Used by | Production value comes from |
|---|---|---|
| `GX_ENV` | composition root | `production`, `staging`, `preview` or `local` |
| `DATABASE_URL` | application, as role `gx_app`: non-owner, no BYPASSRLS, transaction pooler | Supabase → Connect → Transaction pooler, with the `gx_app` user created by K1-T03 |
| `DATABASE_MIGRATION_URL` | migration runner only (K0-T05), never the running app | Supabase → Connect → Session pooler, `postgres` user |
| `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `STORAGE_BUCKET` | BlobStore adapter (K8) | Supabase → Storage → S3 connection |
| `SMTP_URL` | MessageSender email adapter (later) | mail provider, chosen later |

## Migrations

You will run migrations later. The runner arrives with K0-T05 and will run as one command against `DATABASE_MIGRATION_URL`: from empty to head on a new project, and from the previous release in CI. Do not use `supabase db push` or the `supabase/migrations` folder: each foundation package owns its own namespaced migrations (`k1_`, `k2_` and so on), and they run in dependency order.

## Rules that do not bend (ADR-0006)

1. The browser never talks to Postgres, PostgREST or Storage for tenant data.
2. Application queries never use `service_role` or the `postgres` owner role.
3. No foundation package imports a Supabase or Vercel SDK; each is reached through a port (`BlobStore`, `IdentityProvider`, `SecretsProvider`, broker).
4. Secrets are read only through `SecretsProvider`, and are never given a client-exposed prefix.
5. A silo tenant is a separate Supabase project and Vercel project, built from the same code and migrations.
6. The pooler mode and the Postgres version are pinned the same way in CI, local and production.

## Security headers

`vercel.json` sets HSTS, `nosniff`, a strict referrer policy, `X-Frame-Options: DENY` and a permissions policy. The policy allows camera and location for our own origin only: site photos and check-in need them. The Content Security Policy (security guidelines 4.11) is set by the web app with per-request nonces, because Next.js needs them for its inline scripts. It lands with the app.
