# Development guidelines

Status: Proposed. How code is written, tested, reviewed and shipped in this repo, by people and by agents. Pair with `docs/guidelines/security-guidelines.md` and `docs/design/design-system.md`. Architecture decisions are in `docs/adr/` and `docs/architecture/`.

## 1. Rules that never bend

1. **No work without an F id.** Every change traces to a task in `docs/plans/TASKS.md`, which traces to a feature in `docs/prd/01-prd.md`.
2. **Foundation packages know no industry.** No solar, EPC, GST or customer nouns in K0 to K8. The boundary lint enforces it.
3. **Packages talk through public APIs and events.** No cross-package internals, no other package's tables.
4. **Tenant first.** Every table, query, event, job and file carries a tenant.
5. **Tests before code, and a negative test for every permission and every tenant table.**
6. **Migrations are expand-only.** Rollback is a forward fix.
7. **Main stays releasable.** User-visible change ships behind a flag.
8. **Generated files are not edited by hand** (`docs/plans/TASKS.md`, `docs/prd/03-traceability.md`, `.claude/map/`). Change the source and regenerate.

## 2. Repo layout (ADR-0006: monorepo, TypeScript, pnpm and Turborepo)

```
design/            tokens, components, reference page, design tools
docs/adr           architecture decisions
docs/architecture  module catalog, manifest spec, system design
docs/compliance    register, data inventory, breach runbook
docs/design        design system
docs/guidelines    this file and security guidelines
docs/plans         task register, playbook, module briefs
docs/prd           PRD, roadmap, status, features, changes
tools/plangen      catalogue and generator for the plan and PRD files
packages/          one folder per foundation package (created by K0-T02)
apps/sandbox       sandbox host (K0-T12)
apps/web           Next.js app on Vercel (thin routes over package APIs)
```

Package names: `core` (with testkit and toolchain), `k1-tenancy`, `k2-identity`, `k3-entitlements`, `k4-config`, `k5-workflow`, `k6-events`, `k7a-audit`, `k7b-privacy`, `k8-files`. Verticals live in `packs/<name>` and depend on the foundation, never the reverse.

Each package has: a single public-API file, a manifest, `README.md`, `CHANGELOG.md`, its own migrations prefixed with the package (`k1_`), contract suites for the ports it implements, and tests beside the code.

## 3. Module rules

- Declare everything in the manifest (`docs/architecture/module-manifest.md`): permissions, events, entities, tools, extension points, data classification of every field.
- Depend downward only (layer L0 on L0 per the dependency table in the wave plan). Cycles fail the lint.
- Use core ports (`EventPublisher`, `AuditSink`, `Authorizer`, `EntitlementGate`, `QuotaProvider`, `ClassificationLookup`, `SecretsProvider`, `MessageSender`, `EraserRegistry`) instead of importing another module. Every port has an in-memory fake and a contract suite that runs against the fake and every real adapter.
- Public API changes follow semver. The API diff gate fails a removal or a break without a major bump. Deprecate for one minor version first. After changing a package's exports, run `pnpm api:update`, bump the package version (removal or break: major, or minor before 1.0.0; addition: minor, or patch before 1.0.0) and add a changelog entry; CI runs `pnpm api:check --base <base branch>`.
- The rule of two: do not generalise until a second vertical needs it. Record the second user in the pull request.

## 4. Workflow

| Step | Rule |
|---|---|
| Branch | `feat/<PLAN-ID>` (for example `feat/K1-T03`); fixes `fix/<PLAN-ID>-<slug>`; one task per branch |
| Commits | `feat(K1-T03): short summary`; imperative, under 72 characters; body explains why; footer lists breaking changes |
| Pull request | Title like the commit; description lists the task id, feature id, acceptance criteria covered, security level, threat-model link for S3, test evidence, migration notes, rollback |
| Size | One task per pull request; if the diff exceeds about 600 changed lines excluding generated files and tests, split the task first |
| Reviews | As named in the task brief; unresolved Critical or High findings block merge |
| Merge | Squash; CI green; box ticked in the brief; STATUS updated if the task is in the current milestone |
| Release | Tag per package when its public API changes; changelog entry required |

## 5. Definition of done (every task)

- Done-when and tests in the brief pass; new ports have fakes and contract suites.
- The tenant matrix is green, including every new table.
- The manifest is updated; the API diff is clean or the semver bump is included.
- The migrate-from-previous check passes.
- `python3 .claude/gx/bin/privacycheck.py` is clean; new fields have a classification; new personal data has erase and export handlers.
- The security line of the brief is satisfied and reviewers approved; 0 open Critical or High.
- README and changelog of the package are updated; the code map is refreshed at wave end.
- For UI tasks: the design gates pass in both themes (contrast, colour budget, accessibility scan, screenshot diff).

## 6. Testing

| Layer | What | Where it runs |
|---|---|---|
| Unit | Pure logic, validators, expression evaluator | every commit |
| Contract | Every port against its fake and each adapter | every commit |
| Tenant matrix | Read, write and delete as tenant A against tenant B rows for every tenant table | every commit |
| Integration | Real Postgres and object-storage emulator; transactions, outbox, RLS | every commit |
| Property and fuzz | Permission escalation, expression grammar, id ordering, hash chain | every commit, bounded time |
| Chaos and soak | Kill mid-dispatch, duplicate, skew, poison | nightly |
| Migration | Empty to head; previous release to head | every commit |
| Performance | Permission decision p95 5 ms; list query p95 100 ms at 1,000,000 rows (NF-01) | nightly |
| Accessibility and visual | axe and screenshots in light and dark | every UI commit |
| Extraction drill | Foundation copied to an empty repo with only the sandbox host | once at the end of wave 5; boundary lint and industry-word lint on every merge |

Rules: tests are deterministic (frozen clock, seeded randomness), independent, and named for behaviour. No test depends on another's data. Fixtures contain no real personal data.

## 7. Code quality

- Small functions, explicit names, no dead code, no commented-out code. Comments explain why.
- Errors are values from the error catalogue (`core`), with stable codes. No stringly-typed errors, no swallowed errors, no generic catch that hides cause.
- No global state; time comes from the `Clock`; ids come from the id generator.
- Configuration through typed config, never read from the environment inside domain code.
- Logging: structured, one event per line, correlation id, tenant, no personal data (redaction by classification is on by default).
- Dependencies: add deliberately (see security guidelines 4.10).
- Money, dates and numbers use shared formatters; money is integer minor units with a currency code.

## 8. API conventions

- Versioned in the path (`/v1`). Additive changes only within a version.
- Resources are plural nouns; actions that are not CRUD are explicit sub-resources or verbs on the resource.
- Pagination is cursor-based with a stable sort; list responses carry `next` and a count only when cheap.
- Writes accept an `Idempotency-Key`; a repeat returns the original result.
- Concurrency uses `ETag` or a version field; conflict is `409` with the current version.
- Error shape: `{ "error": { "code": "STABLE_CODE", "message": "plain words", "fields": [], "correlation_id": "..." } }`. Codes come from the catalogue. Messages never reveal tenants, accounts or internals.
- Status codes: 400 validation, 401 unauthenticated, 403 unauthorized, 404 not found (also for other tenants' records), 409 conflict, 422 semantic failure, 429 limit with `Retry-After`, 5xx never carries internals.
- Every endpoint declares its permission and entitlement key in the manifest; undeclared routes do not mount.
- MCP tools follow the same permissions and entitlements and declare their schema, risk level and whether confirmation is required (ADR-0005).

## 9. Data and migrations

- One schema namespace per package; table prefix equals package prefix. Only the owning package writes its tables.
- Each tenant table: `tenant_id`, forced RLS, composite keys, timestamps, soft-delete only where retention requires it.
- Expand then contract: add nullable or defaulted columns, backfill in jobs, switch reads, remove in a later release. Never rename or drop in one step.
- Large backfills run as tenant-aware jobs with progress and resume.
- Every migration runs from empty and from the previous release in CI.
- Indexes follow measured queries; the index registry caps custom-field indexes per entity.

## 10. Events and jobs

- Event names `entity.verb_past` (`tenant.created`). The envelope carries id, type, version, tenant, actor, time, correlation and causation ids.
- Publish only through the outbox, inside the transaction that changed the state.
- Consumers are idempotent and ordered per entity; never assume exactly-once delivery.
- Schema changes follow compatibility rules checked in CI; breaking changes add a new version and run both until consumers move.
- Jobs declare timeout, retries and tenant fairness weight; long jobs checkpoint.

## 11. Feature flags and rollout

- User-visible change is behind a flag from K3 once it exists; before that, behind a config switch.
- Flags have an owner and removal date. Kill switches are tested.
- Roll out: tenant list, then percentage, then default on; remove the flag after 2 releases.

## 12. Observability and operations

- Metrics: request rate, errors, latency (p50, p95, p99), queue depth and lag, dead-letter size, audit-chain verifier result, pool saturation, per-tenant usage.
- Traces carry correlation id across request, job and event.
- Health: liveness and readiness endpoints; readiness reports dependency state.
- Alerts have an owner and a runbook line. Operational readiness is reviewed with `gx-ops-readiness` before each milestone demo.

## 13. Documentation

- Decisions: an ADR for anything hard to reverse (stack, storage model, OAuth build or delegate); open questions in `.claude/memory/OPEN_QUESTIONS.md`.
- Each package README states purpose, public API, ports, events, extension points, and how to run its tests.
- Keep the module catalog and manifests the source of truth; do not duplicate them in prose.

## 14. Working with agents

- One agent per lane. Hand-offs happen through the pull request and the brief checkbox, not chat.
- Agents stop and ask at human gates, public-API breaks, cross-lane edits and Critical or High findings.
- Agents never edit generated files, never loosen a gate to pass, and never mark a task done without evidence.
- Memory and learnings go to `.claude/memory/` through the protocol in `gx-project-memory`.
