---
name: gx-code-quality
description: How to write and review code so it stays clean, modular and robust as the codebase and team grow - structure, boundaries, typing, error handling, naming, frontend component architecture, testing strategy, dependency hygiene and review checklist. Use whenever writing, refactoring or reviewing code in any language.
---

# Code quality

Sloppiness compounds: each shortcut makes the next change slower and riskier. The cure is a few
strict conventions applied every time, enforced by tooling rather than memory.

## Structure
- **Feature/domain folders** (`features/jobs/{api,components,hooks,lib,types,tests}`), shared code in
  `shared/` or `lib/` only once two features need it. No `utils.ts` dumping ground: name modules for what they do.
- **Layers inside a feature**: UI → hooks/state → service (business rules) → data access/adapters.
  Dependencies point inward; UI never talks to the DB client directly in complex features.
- **Public surface**: each module exports through an index; others import that, not deep files.
- **File size**: split above ~300 lines or when a file has two reasons to change.
- **Config over conditionals**: industry/tenant variation lives in config or data, not `if (tenant === 'x')`.

## Types and contracts
- Strict typing everywhere (`"strict": true`, mypy/pyright strict for new Python code, Dart sound null safety).
- One schema per boundary (zod/valibot/pydantic) used for runtime validation AND inferred types; share it between client and server.
- Generate DB and API types (Supabase gen types, OpenAPI codegen); never hand-copy shapes.
- No `any`, no non-null assertions without a comment explaining the guarantee.

## Errors
- Fail loudly at boundaries, handle deliberately inside. Never swallow (`catch {}`) or return 400 for server faults.
- Typed/result errors for expected failures (validation, conflict, not found); exceptions for the unexpected.
- Every error the user can see has a human message and a stable code; every error we can't handle is logged with context (request id, tenant id, no PII) and reported to error tracking.
- Retries only for idempotent operations with backoff (`gx-architecture`).

## Naming and readability
- Names say intent and unit: `dueDate`, `amountPaise`, `isOverdue`, `fetchOpenJobs`. Booleans read as questions.
- One concept, one name across DB, API, UI and docs (keep a glossary in memory).
- Functions do one thing; ≤ ~40 lines is a good smell test. Early returns over nesting.
- Comments explain *why* and non-obvious constraints; code explains *what*.
- No magic numbers or strings: named constants, with units.

## Frontend architecture
- Components: presentational (props in, events out, no data fetching) vs containers (fetch, state, wire). Design-system primitives live in one place; features compose them.
- Every data view handles loading, empty, error, partial and success states (a shared `<AsyncState>` pattern helps).
- Server state through one library (TanStack Query, SWR, RSC) with clear cache keys; local UI state stays local; global stores only for genuinely global state.
- Forms through one library (react-hook-form + schema) with the shared schema.
- Accessibility built into primitives (labels, focus, keyboard), so features inherit it.
- No hardcoded colours/spacing; tokens only (project design system).

## Testing strategy (pyramid, risk-weighted)
- **Unit**: business rules, calculations (money, dates, margins), state transitions. Fast, many.
- **Integration**: endpoint/function + DB with RLS on: permissions, tenant isolation, constraints, idempotency, concurrency.
- **Contract**: API responses against the schema; old-client compatibility for mobile.
- **E2E**: the 3–5 journeys that make money or break trust (Playwright/Maestro), on preview deploys.
- **Regression rule**: every bug fix ships with a test that fails before the fix.
- Test data via factories/fixtures; never production data.

## Dependencies
- Add one only with a reason (what it saves vs its size, maintenance, licence, security record).
- One package manager per app; lockfile committed; automated updates with CI.
- Wrap third-party SDKs behind our adapter so swapping or mocking is a one-file change.

## Tooling that enforces this (set up once per repo)
Formatter (Prettier/Black/dart format) · linter with strict rules (ESLint + typescript-eslint,
Ruff, dart analyze) · type check in CI · import boundary rules (eslint-plugin-boundaries or
dependency-cruiser) · pre-commit hooks (lint-staged, gitleaks) · test coverage reported (gate on
changed lines, not a global %) · conventional commits.

## Review checklist (author and reviewer)
- [ ] Does what the plan says; nothing unrelated
- [ ] Boundaries respected; no new cross-module reach-ins
- [ ] Inputs validated at the boundary; authZ on the server
- [ ] All UI states; accessible; tokens only
- [ ] Errors handled and observable; no swallowed exceptions
- [ ] Tests for rules and the bug; tenant isolation where data is touched
- [ ] Names clear; no magic values; no dead or commented-out code
- [ ] Docs, map and system design updated if structure changed
