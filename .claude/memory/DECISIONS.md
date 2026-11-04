# Decisions (append-only)

Format per entry:

## YYYY-MM-DD — <decision in one line>
- Context: why this came up
- Options considered: A / B / C
- Chosen: B, because …
- Consequences / what we gave up:
- Revisit if: <condition that would make this wrong>
- Evidence: OBSERVED / INFERRED (link to code, doc, or ADR)

## 2026-11-04 — Compliance posture: tenant is fiduciary, we are processor; build to DPDP 14 May 2027 standard now
- Context: setting up compliance and privacy rules for the EPC dashboard; DPDP Rules 2025 notified 13 Nov 2025, most duties start 14 May 2027, Consent Manager provisions 14 Nov 2026.
- Options considered: A) wait for the 2027 date, B) build to the 2027 standard from day one, C) act as fiduciary for all data.
- Chosen: B with tenant as fiduciary (DPA at signup), because retrofitting consent, logs and erasure is costlier and launch likely lands before the date.
- Consequences / what we gave up: more upfront build (consent table, retention engine, requests desk, breach runbook); end-customer requests route via the tenant.
- Revisit if: legal counsel advises we are fiduciary for end-customer data in any feature (e.g. direct-to-consumer calculator).
- Evidence: OBSERVED, sources in docs/compliance/register.md (Protiviti, Mondaq, Sansa Legal, GST s.36), checked 2026-11-04.

## 2026-11-04 — Never store Aadhaar numbers, card data, or consumer bank details
- Context: subsidy is credited to the consumer, not the EPC; card data is out of scope via hosted payment links.
- Chosen: schema forbids these fields; privacycheck.py flags them (CMP-03, CMP-21, CMP-27).
- Revisit if: product takes on subsidy disbursement or lending (needs counsel first).
- Evidence: OBSERVED (register.md).

## 2026-11-04 — Kernel architecture proposed: ADR-0001..0005 (status Proposed, pending Aadarsh's acceptance)
- Context: planning a reusable multi-tenant kernel sold as SaaS and as custom product.
- Chosen (proposed): modular monolith; pooled tenancy with RLS and a silo option; packs + entitlements + three customisation levels; five-layer module model with rule of two; MCP as a first-class surface.
- Evidence: docs/adr/, docs/architecture/module-catalog.md, Claude Doc "Kernel Module Catalog: The Building Complex".

## 2026-11-04 — Foundation plan 001 drafted: 9 modules, 10 packages, 119 tasks, 6 waves (not started)
- Context: Aadarsh asked for a foundation map, architecture for robustness and modularity, per-module breakdown and executable tasks.
- Chosen (proposed): waves K0 → K1 → K6 + K7a → K4 → K2 + K3 + K5 → K8 + K7b, each ending at a gate; an extraction drill at waves 1, 3 and 5; EraserRegistry added as a core port so K7b and K8 stay decoupled.
- Evidence: docs/plans/001-foundation/, Claude Doc "Foundation Map: Kernel Layer L0".

## 2026-11-04 — Design system adopted: midnight and orange at 80/20, light and dark, dense Salesforce-style shell
- Context: Aadarsh asked for both themes, two brand colours at 80% and 20% accent, tight layout with no blank space, well-placed menus and buttons.
- Chosen (proposed): tokens in design/tokens.css as the single source; orange is a ceiling of 20% of brand-hued pixels, working target 5 to 10%, only for the one primary button, active-navigation marker, one highlighted KPI or series, and "needs you" counts; text on orange is midnight (white fails at 3.2:1); links, selection and focus are blue.
- Consequences / what we gave up: orange is rare by design; tenants may change logo, name and accent only, with a contrast check.
- Revisit if: the brand owner wants orange to carry more surface area, or a tenant needs full theming.
- Evidence: OBSERVED. design/tools/contrast.py reports 0 failures; reference page about 3% orange in light and 1% in dark. docs/design/design-system.md.

## 2026-11-04 — Work breakdown: 67 features, 133 tasks, generated from tools/plangen; PRD draft in docs/prd
- Context: Aadarsh asked for the foundation map divided into a feature list with tasks agents can execute, following security guidelines.
- Chosen (proposed): 8 milestones (M-01 to M-08), 50 Must and 17 Should features with 170 acceptance criteria, 133 tasks (119 foundation, 14 design) with agent, reviewers, skills, security level (42 S3), rollback and human gates; agents work in lanes (one package each).
- Consequences: feature analysis files (docs/prd/features/F-xx) are not written; prdtool trace lists 50 gaps for Must features. gx-analyst fills them before each feature's first task.
- Evidence: OBSERVED. prdtool lint 0 errors, check 0 errors. docs/plans/README.md, docs/plans/TASKS.md.

## 2026-11-04 — Stack locked: TypeScript, Next.js on Vercel, Supabase Postgres (Mumbai), monorepo (ADR-0006); ADR-0001 to 0005 Accepted
- Context: Aadarsh answered the wave-0 blockers: Supabase and Vercel are fine, monorepo as recommended, accepted the ADRs ("lock it").
- Chosen: managed Postgres and Storage only (no browser SDK or PostgREST for tenant data, never service_role for app queries, own non-owner role over the pooler with SET LOCAL); no vendor SDKs inside foundation packages (ports and adapters); database-backed queue triggered by Vercel Cron or Queues, worker later; Kysely plus plain SQL migrations; React wrappers over the design CSS.
- Consequences / what we gave up: long-running work is triggered not hosted until a worker is added; Supabase and Vercel limits feed NF-08.
- Revisit if: Supabase Auth fails the K2-T15 checks (GA, connector conformance, password policy), Vercel limits block the dispatcher, or a client needs another host (silo path).
- Evidence: OBSERVED. docs/adr/0006-stack-hosting-and-repo-shape.md; Supabase OAuth 2.1 server docs and Vercel duration limits checked 2026-11-04.

## 2026-11-04 — EPC-first: second vertical deferred, nothing generalised beyond what EPC needs
- Context: Aadarsh: focus on EPC only; when another vertical comes he will cherry-pick from the foundation.
- Chosen: Q-04 (second vertical) deferred; goal G-01 reworded to "EPC pack uses public APIs only, 0 foundation edits, 0 industry words"; boundary and industry-word lint stay on every merge (cheap, keeps cherry-picking possible); full extraction drill runs once at the end of wave 5 instead of waves 1, 3 and 5; features F-12 silo routing, F-37 OIDC SSO, F-44 licence file and F-45 pack pinning moved from Should to Later.
- Consequences: less foundation to build before EPC work can start; EPC pack needs its own PRD and tasks mapped onto foundation primitives.
- Revisit if: a second vertical or an enterprise client needing silo or SSO appears.
- Evidence: OBSERVED. tools/plangen catalogue; prdtool lint and check 0 errors.

## 2026-11-04 — Industry intelligence: skill epc-industry-news, agent epc-industry-scout, weekly scheduled brief
- Chosen: Monday 07:47 IST scheduled task (push notification, no email) producing a ~400-word Indian solar EPC brief; same skill runs on demand.

## 2026-11-04 — EPC pack plan: scope, sequencing and what the foundation lacks
- Chosen (planning, pending Aadarsh sign-off): pack PRD at packs/epc/docs/prd (65 features: 37 Must, 17 Should, 11 Later; 92 tasks; 8 milestones; gates G0 to G4). Pack MVP starts at won-deal handoff (import sheets or CRM export), not at leads or quotes. Wedge: utility-stage tracker, owner exceptions list, cash blocked, material readiness, forecast margin. Invoices are recorded and synced with Tally, not issued (lean for Q-03). Distributor (Trade) features are Later.
- Sequencing: pack wave A (domain code on core ports and fakes) runs alongside foundation waves 0 to 2; B needs configuration (wave 3); C identity and workflow (wave 4); D files and privacy desk (wave 5). First pilot on real customer data follows foundation wave 5. Phase 0 (owner conversations, paid-pilot ask, definitions) starts now with no code.
- Generic capabilities missing from the foundation (record timeline, exceptions engine, tasks, import, money library, stock and cost ledgers, message adapters, PDF generation, in-app notices, search) are built inside the pack and listed in packs/epc/docs/foundation-map.md as extraction candidates for the L1 utilities map; they move only when a second vertical needs them.
- Revisit if: pilots reject the owner-first scope, or an owner needs invoices issued in-app (Q-03).
- Evidence: OBSERVED. prdtool lint and check on packs/epc: 0 errors; sources are the three earlier EPC documents and docs/compliance/register.md.


## 2026-11-04 — Workspace shape (K0-T02): 12 packages, packages/register.json as the module register
- Context: F-01-AC2 counts 10 packages with exactly 1 public-API file each; the K0 lane is "core + testkit + toolchain"; core must have no I/O and no dependencies.
- Options considered: A) testkit and toolchain inside core as subpath exports; B) separate support packages in the core lane.
- Chosen: B. Folding them into core would give core more than one public-API file and pull I/O (Postgres driver, file system, TypeScript compiler) into it. The 10 module packages satisfy the AC; testkit and toolchain follow the same rules. The register lists each package's allowed `depends`; at the skeleton stage all depend on core only.
- Consequences: manifests (K0-T07) also declare `depends`; K0-T08 must make one of them derive from or cross-check the other so there is a single source of truth.
- Revisit if: a reviewer reads F-01-AC2 as "exactly 10 workspace packages".
- Evidence: OBSERVED. packages/register.json, `pnpm check:imports` → 12 packages, 0 violations.

## 2026-11-04 — Toolchain pins: TypeScript 6.0.3, pnpm 10.34.9, Vitest 5.0.5, ESLint 10.13.0
- Context: TypeScript 7.0.2 (native port) is npm `latest`, pnpm 12 is `latest`.
- Chosen: TypeScript 6.0.3, because 7.0 exposes only `unstable/*` APIs and typescript-eslint 8.72.1 requires `typescript <6.1.0`; the API-diff gate (K0-T09) needs a stable compiler API. pnpm 10.34.9, because the 10.x line is still patched (2026-10-25) and its supply-chain settings are known; moving to 12.x is its own reviewed chore.
- Revisit if: typescript-eslint supports TypeScript 7 and 7 ships a stable API; pnpm 10 stops receiving security patches.
- Evidence: OBSERVED. `npm view typescript-eslint@8.72.1 peerDependencies`, `npm view typescript@7.0.2 exports`, `npm view pnpm time` (2026-11-04).

## 2026-11-04 — Supply-chain install policy (security guidelines 4.10)
- Chosen: pnpm `minimumReleaseAge` 7 days, `strictDepBuilds` with no install scripts approved, `engineStrict` (Node 24 only), `strictPeerDependencies`, exact versions (`savePrefix: ''`), lockfile committed.
- Consequences: a new release cannot be adopted for 7 days; an urgent security fix goes through `minimumReleaseAgeExclude` with the reason in the pull request.
- Evidence: OBSERVED. pnpm-workspace.yaml; install on Node 22 fails with ERR_PNPM_UNSUPPORTED_ENGINE.

## 2026-11-04 — Started K0-T02 before the ADR-0006 Supabase and Vercel gate was closed
- Context: ADR-0006 says "Before K0-T02: create the Supabase and Vercel projects in Mumbai; record the Postgres major version in the K0 brief". The projects are not recorded anywhere in the repo. Aadarsh asked to start implementing.
- Chosen: build K0-T02, which has no database, hosting or Postgres dependency. The gate stays open and now blocks the first tasks that need it: K0-T05 (migrations), K0-T11 (local database image) and K0-T10 (CI Postgres pin).
- Revisit if: Aadarsh wants the gate held literally; nothing in K0-T02 depends on the version, so no rework follows.
- Evidence: OBSERVED. grep for a recorded Postgres version finds none; .claude/memory/OPEN_QUESTIONS.md.

## 2026-11-04 — K0-T02 staff review: 6 findings fixed, 4 deferred to K0-T08
- Context: gx-staff-reviewer did not approve the first version. It found 2 High false negatives (the preprocessor scan missed `export * as` and `export type *`; local aliases bypassed the register), plus Medium and Low items.
- Chosen: fixed 1, 2, 3 (`isolated` register flag and `isolation` rule for core), 5 (turbo globalDependencies), 8 and 9 with tests and mutation checks. Deferred to K0-T08 (boundary lint): 4, read the pnpm-workspace globs and decide how packs register; 6, a pnpm catalog for the shared typescript and zod pins; 7, scan files outside `src/`; 10, pnpm `trustPolicy` and `blockExoticSubdeps` (support in 10.34 unverified). Re-review (approved) added two Low items for K0-T08: reject `@gx/*` keys in `overrides` (pnpm-workspace.yaml and root package.json), and check `git:`, `github:` and tarball specs, which `minimumReleaseAge` does not cover. Item 4 must be settled before the EPC pack joins the workspace.
- Evidence: OBSERVED. 102 tests; each new rule disabled in turn turns a test red.

## 2026-11-04 — Postgres 17 pinned; Supabase and Vercel configured with placeholders
- Context: Aadarsh: "use Supabase for database and Vercel for hosting, set these up, leave placeholders; I add keys and run migrations later".
- Chosen: Postgres 17 (Supabase platform default and CLI default on 2026-11-04). In supabase/config.toml, the Data API, Realtime, Edge Functions, Auth and analytics are off, and the pooler is on in transaction mode. vercel.json pins bom1, sets security headers and keeps git deploys off until an app exists. .env.example holds placeholders, with no anon or service_role key and no client prefix; a test guards all of this. The Supabase CLI is not a repo dependency, because its install script downloads a binary, which the strictDepBuilds policy blocks; developers install it themselves.
- Revisit if: the hosted project shows another Postgres major; D-05 adopts Supabase Auth (turn [auth] on then).
- Evidence: OBSERVED. supabase.com changelog 46080 ("Postgres 17 ... platform default"); `supabase init` with CLI 2.122.0 writes major_version = 17; packages/toolchain/src/environment-config.test.ts.

## 2026-11-04 — K0-T03 core type shape after staff review
- Chosen: `TenantId` is its own brand; tenant-scoped code takes `TenantContext`, which only `requireTenant` produces, so a skipped check is a compile error. `Clock` has wall time and monotonic time. AppError carries `retryAfterSeconds` (whole seconds) and `currentVersion`. Context carries `initiatedBy` for jobs. Errors are values with a public message; `detail` and `cause` are for logs only.
- Deferred, now in the briefs: error-code collisions across catalogues (K0-T07 done-when); summarising `cause` in logs (K0-T04 threat line).
- Accepted risk: a UUIDv7 reveals the record's creation time, and its counter hints at volume. Before ids appear in public or customer links (pack S19), use an opaque token instead of the id.
- Evidence: OBSERVED. 200 tests; 14 mutations across core each turn a test red; reviewer approved.

## 2026-11-04 — Migration runner is its own package, @gx/migrate; database tests are a separate suite
- Context: K0-T05 needs I/O (pg), so not core; the sandbox host must migrate at boot (F-06-AC4), so not toolchain, which ships the TypeScript compiler.
- Chosen: `@gx/migrate` (support, depends on core and pg 8.23.1). Database tests are `*.db.test.ts`, run with `pnpm test:db` against GX_TEST_DATABASE_URL; they fail loudly without it and never skip. CI provides a postgres:17 service (K0-T10).
- Rejected: the embedded-postgres npm binaries (postinstall script, single maintainer, newest 17.x build inside the 7-day window). Downloaded Postgres 17 binaries could not be run in this sandbox (permission policy), so local verification uses the container's system Postgres 16; the SQL used (DDL, advisory locks, transactions) behaves the same in 16 and 17.
- Evidence: OBSERVED. 15 of 15 db tests on Postgres 16.15; 7 mutations turned tests red (one was equivalent, and a fault-injection test was added for it).
