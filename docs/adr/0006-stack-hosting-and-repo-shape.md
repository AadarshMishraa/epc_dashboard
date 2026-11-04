# ADR-0006: Stack, hosting and repo shape

- Status: Accepted (Aadarsh, 2026-11-04)
- Date: 2026-11-04
- Closes: Q-01, Q-02, Q-05 (direction), Q-08 in docs/prd/01-prd.md

## Context
ADR-0001 to ADR-0005 fix the architecture (modular monolith, pooled tenancy with RLS, packs, five layers, AI connector) but not the technology. Aadarsh ships fastest in TypeScript, Next.js and Supabase and proposed Supabase with Vercel. This ADR checks that choice against the architecture and sets the rules that make it safe.

## Decision

| Area | Choice |
|---|---|
| Language and runtime | TypeScript (strict), Node.js 24 LTS |
| Web and API | Next.js App Router on Vercel; the service layer lives in packages, routes stay thin |
| Database | Supabase-managed PostgreSQL, Mumbai region; newest major version the project offers, same major in CI and local; CI image pinned |
| Object storage | Supabase Storage (S3-compatible) behind the `BlobStore` port |
| Data access | Typed SQL builder (Kysely) with plain SQL migrations run by our own package-namespaced runner (K0-T05). No ORM that hides SQL or RLS |
| Validation | Zod schemas at every boundary |
| Tests | Vitest; Playwright for browser, axe and screenshot checks |
| Package manager and layout | pnpm workspaces and Turborepo; one monorepo (see below) |
| Queue and scheduler | Database-backed outbox and job tables (ADR-0001, K6). The dispatcher is a library invoked by Vercel Cron or Queues at launch; Vercel Daemons or a small worker host later, behind the K6 broker port |
| Identity protocol | Delegate the OAuth 2.1 server (PKCE S256, client registration, refresh rotation) to Supabase Auth behind the `IdentityProvider` port, subject to the checks below. Permissions, tenancy and audit stay in our code |
| Front-end binding | React components that wrap the classes in `design/components.css`; the CSS stays the contract |
| Region and residency | Supabase and Vercel Functions pinned to Mumbai; residency is a tenant setting |

### Repo shape
One monorepo until the second vertical ships and the public APIs are stable. Layout:

```
packages/   foundation packages (core, k1-tenancy ... k8-files)
apps/       sandbox host, web app
packs/      verticals (epc first); depend on the foundation, never the reverse
design/     tokens, components, reference page
docs/       as today
```

Extraction happens through the drill at the end of waves 1, 3 and 5. After the second vertical is live, publish the foundation as private packages or split the repo.

### Rules that make Supabase and Vercel safe for this architecture
1. Supabase is managed Postgres and Storage. The browser never talks to Postgres, PostgREST or Storage directly for tenant data.
2. Application queries never use `service_role` or the `postgres` owner role (both bypass RLS). They use our own non-owner role with no `BYPASSRLS`, over the pooler in transaction mode, with `SET LOCAL app.tenant_id` inside every transaction (ADR-0002).
3. No foundation package imports a Supabase or Vercel SDK. Each is reached through a port with an adapter (`BlobStore`, `IdentityProvider`, `SecretsProvider`, broker). The sandbox host runs on local Postgres and an object-storage emulator.
4. Secrets live in Vercel and Supabase environment stores, are read only through `SecretsProvider`, and are never prefixed for client exposure.
5. Silo tenants are a separate Supabase project and Vercel project from the same code and migrations.
6. The pooler and Postgres version are pinned in CI; the pool-leak test (K1-T04) runs against the pooler configuration used in production.

### Checks owed before dependent tasks start
- Before K2-T15: confirm Supabase's OAuth 2.1 server is generally available; confirm its client-registration and refresh behaviour pass the Claude and ChatGPT connector conformance checks; confirm it can enforce our password policy (15 characters minimum as sole factor, 64 or more allowed, breached-password screening) or that our own credential store handles that and Supabase handles only the protocol. If any check fails, record a follow-up ADR (build or adopt another server). Q-05 stays a direction until then.
- Before K6-T08: confirm the Vercel plan allows the cron frequency the scheduler needs, or move the dispatcher trigger to Queues or a worker.
- Before K0-T02: create the Supabase project and Vercel project in Mumbai; record the Postgres major version in the K0 brief.

## Options considered
- **Supabase and Vercel (chosen).** Fastest for the owner, Postgres with RLS fits ADR-0002, regional hosting, low operating load. Cost: serverless limits on long-running work, vendor coupling.
- **Self-managed VPS or AWS.** Full control and always-on workers, but more operations for a solo builder and a slower start. Kept as the silo and exit path through the ports.
- **Separate foundation repo from day one.** Forces versioning and release overhead before a second consumer exists. Rejected for now.
- **ORM-centred data layer.** Hides SQL and RLS behaviour and complicates package-owned migrations. Rejected.

## Consequences
- Wave 0 is unblocked. K0-T01 is complete with this record.
- Jobs and schedules are triggered rather than hosted until a worker is added; the K6 chaos tests must run against the cron-triggered dispatcher.
- Supabase vendor limits (connections, storage, Auth features) become inputs to the NF-08 load test.
- Supabase Auth would count each user toward its monthly active user billing; revisit if per-tenant pricing makes that material.

## Revisit if
Supabase Auth fails the checks above; Vercel limits block the dispatcher; the pooled connection budget cannot meet NF-08; or a client requires a host outside these vendors (use the silo path).
