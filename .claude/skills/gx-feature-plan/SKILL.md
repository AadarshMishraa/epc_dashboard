---
name: gx-feature-plan
description: Introspect the codebase and produce the safest plan to add or change a feature, split into session-sized tasks with impact, risk, tests and rollback. Use before writing code for any non-trivial feature, change request, refactor or migration, and when a session is about to get long.
---

# Feature plan: the safest way in

Goal: before any edit, know what exists, what the change touches, how it can fail, how we'll know it
works, and how we back out. Then cut it into tasks one session can finish and verify.
Output: `docs/plans/NNN-<slug>.md` (next free number) and, for multi-session work, briefs in
`docs/plans/NNN-<slug>/T01-*.md`.

## Phase 1 — Understand (no code yet)
1. **Restate** the request (if `docs/prd/` exists, name the F-id and acceptance criteria it serves; no F-id means defect or change request, say which): user, job to be done, success criteria (observable), out of scope.
2. **Load context**: memory brief, `DECISIONS.md` for the area, the project's domain skills
   (e.g. schema, compliance, feature-map skills). If the project has a scope authority skill and this
   isn't in it, stop: it's a change request.
3. **Introspect the code** with the map: `codemap.py find <feature terms>`, read the module pages, then
   read the existing implementation end to end. Record what already exists that can be reused.
   Never plan against assumed code.
3b. **Contested units?** If the feature has limited quantity, slots, balances, a payment between reserve and
   confirm, or a launch spike, load `gx-high-concurrency` and name the invariant before designing.
4. **Run `gx-product-introspect`** (quick mode for small features, full for big ones) and fold its
   must-haves into scope.

## Phase 2 — Impact and risk
5. `codemap.py impact <file>` for each file you expect to touch; plus the project's own impact rules
   if it has any (e.g. `.claude/impact.yaml`). List: dependents, routes/pages, tables, external
   providers, installed clients (mobile apps that can't update), background jobs, docs.
6. **Contracts**: API shape, DB schema, events, permissions, URLs. Is every change additive? If not,
   design expand → migrate → contract.
7. **Classify risk**: LOW (local, reversible) · MEDIUM (one module, tested path) · HIGH (shared
   contract, data migration, auth, many users) · CRITICAL (money, personal data, irreversible,
   production infra). HIGH/CRITICAL → present the plan and wait for approval.
8. **Failure-first questions** for any critical flow: normal path · timeout · retry · double submit ·
   two users at once · slow DB · provider down · app killed mid-flow · offline · partial failure ·
   how it recovers. "Don't know" becomes a task.

## Phase 3 — Design the change
9. Data (→ `gx-database-design`), API (method, path, auth, validation, errors, idempotency,
   pagination), UI (→ `gx-cognitive-ux`: states loading/empty/error/partial/success/no-permission),
   security and privacy (→ `gx-compliance` if personal data), observability (what we log/measure).
10. **Choose the safest sequence**: backend before frontend; additive migration before code that
    uses it; feature flag for user-visible change; dark launch for risky paths; old and new paths
    side by side until verified.
11. **Rollback**: exactly how to undo each step (revert, flag off, down-migration or forward fix).
    If a step can't be undone, say so and isolate it.

## Phase 4 — Cut into tasks
12. Each task: one outcome, ≤ ~1 session, independently verifiable, leaves main releasable.
    Format per task:
    ```
    T03 — <outcome>
    Needs: T01, T02 · Files: … · Skills: …
    Steps: …
    Tests: unit … · integration … · manual check …
    Done when: <observable>
    Rollback: …
    Parallel-safe: yes/no (touches shared files?)
    ```
13. Mark tasks that can run in parallel on separate branches/agents (no shared files, no ordering).
14. List decisions needed from the owner, with your recommendation.

## Plan document template
```
# NNN — <feature>
Status: draft | approved | in progress | done   Risk: …   Owner decisions needed: …
## Problem and success criteria
## Out of scope
## What exists today (OBSERVED, with file refs)
## Introspection findings (must-have / should-have / later)
## Impact (files, routes, tables, clients, providers)  ← paste codemap impact summary
## Design (data · API · UI states · security/privacy · observability)
## Failure modes and handling
## Sequence, flags and rollback
## Tasks (T01…; with a PRD: `T-nn` under exactly one F-id, copied into docs/prd/STATUS.md)
## Test plan
## Docs to update (system-design, API docs, README, memory)
```

## Rules
- The plan is a contract with the next session: specific file paths, names, commands. No "etc.".
- Prefer reusing an existing pattern in the repo over introducing a new one; if you must diverge, record why in DECISIONS.md.
- Never plan a destructive migration, auth change or money-path change without an approval step.
- Update the plan's status and task checkboxes as you go; it's the resume point after context loss.
