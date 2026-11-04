---
name: gx-delivery-pipeline
description: Branching, CI quality gates, tests before merge, preview/staging/production environments, migrations in the pipeline, feature flags, release, auto-revert on failed acceptance, mark-bad-build, emergency stop (deploy freeze), deploy windows and rollback. Use when setting up a repo's CI/CD, before merging or deploying, when adding a test suite, or when a release goes wrong.
---

# Delivery pipeline

Rule: **main is always releasable.** Nothing reaches main without passing the gates; nothing reaches
production without passing staging. Templates (GitHub Actions, Node + Supabase; adapt per stack):
`templates/ci.yml` proves a commit is releasable, `templates/deploy.yml` ships it with guards and auto-revert,
`templates/release-controls.yml` holds the manual levers, `templates/scripts/` the helpers.

## Branches and work units
- Trunk-based: short-lived branches `feat/<plan>-T03-short-name`, `fix/...`, merged within days.
- One plan task (from `gx-feature-plan`) = one branch = one PR. Agents working in parallel use
  separate branches or git worktrees and never touch the same files.
- Conventional commits; PR description uses the GX report format (changed / risk / verified / not verified).
- Protected main: required checks, at least one review (a human, or `gx-staff-reviewer` plus a human for HIGH/CRITICAL), no force-push.

## Gates (in order, fail fast)
1. **Static**: format check, lint, type check, import-boundary check, secret scan.
2. **Unit tests** + changed-line coverage report.
3. **Build** every app that changed.
4. **Integration tests** against an ephemeral DB with migrations applied and RLS on: tenant-isolation tests, constraint tests, idempotency/concurrency tests.
5. **Migration safety**: migrations apply cleanly from the last release; no destructive change without the expand/contract plan; generated SQL attached to the PR.
6. **Contract/compat**: API schema diff; breaking changes fail unless versioned.
7. **Security**: dependency audit (block critical), SAST (CodeQL/Semgrep) on PRs.
8. **Preview deploy** per PR (Vercel/Netlify/Expo preview) + **E2E smoke** on the money/trust journeys.
9. **Design gates** for UI changes: contrast script, axe scan, visual snapshot where configured.

## Environments
| Env | Data | Deploys | Purpose |
|---|---|---|---|
| Local | seed/fixtures | developer | build and unit/integration tests |
| Preview | seed per PR | every PR | review, E2E smoke |
| Staging | anonymised or synthetic, production-like volume | merge to main | full regression, migration rehearsal, UAT |
| Production | real | manual promote (tag/release) | customers |
Separate projects, keys and secrets per environment. Never point staging at production data or providers' live mode.

## Release
1. Promote the build that passed staging (same artifact; don't rebuild). `deploy.yml` enforces this: production refuses a commit without a `good/staging/*` tag.
2. Backup/PITR confirmed before migrations. Apply additive migrations first, then deploy code.
3. Feature flags for user-visible change: release dark, enable for one tenant, then all (see Progressive rollout).
4. Watch error rate, latency and key business events for 30 minutes (`gx-ops-readiness`); `scripts/watch.sh` does it and a breach triggers auto-revert.
5. Release notes: what changed for users, what admins must know.
Mobile: native releases are one-way (store review, users on old versions for months); keep the API
backward compatible and use OTA updates only for JS-level changes where the platform allows.

## Release controls (four guardrails)
Modelled on what HubSpot has described publicly about its deploy system (auto-revert on failed acceptance tests,
marking bad builds, emergency stop, deploy gates). This is a GitHub Actions approximation, not their system.

| # | Control | Rule | Where it lives |
|---|---|---|---|
| 1 | **Auto-revert** | If the deploy, acceptance tests or post-deploy watch fail, the pipeline marks the commit bad, redeploys the last good build, re-runs acceptance, and opens an issue. If there is no good build or the revert fails, it opens a loud issue and stays red. | `deploy.yml` job `deploy`, `scripts/ci/last-good.sh` |
| 2 | **Mark bad build** | A bad commit (tag `bad/<sha>`) can never be deployed again and is never chosen as a revert target. Set automatically by control 1, or by hand. | `deploy.yml` guard, `release-controls.yml` action `mark-bad` / `unmark-bad` |
| 3 | **Emergency stop** | One switch (`DEPLOY_FREEZE=true`) blocks every deploy, cancels queued and waiting ones (running ones optionally), and calls your app-level kill-switch hook. | `release-controls.yml` action `freeze` / `unfreeze`, `scripts/emergency-stop.sh` |
| 4 | **Deploy window** | Production deploys only on set days and hours in your time zone, never on blocked dates (festivals, customer peaks, audits). A hotfix override needs a written reason, is logged, and still needs the production approver. | `scripts/ci/deploy-window.sh`, `deploy.yml` guard |

How the state is kept: git tags, so it survives and is auditable. `good/<env>/<utc-ts>` = passed acceptance in that
environment. `bad/<sha>` = never deploy. The revert target is the newest `good/<env>/*` that is not bad and not the build being replaced.

**Choose the window by two questions:** is traffic low, and are the people who can fix it at their desks? A B2B
dashboard: weekday daytime, not Friday. A consumer booking product: off-peak, not before a release weekend or a
big event. Default in the template: Mon-Thu 10:00-17:00 IST.

**What auto-revert does not do (say this in every release plan):**
- It reverts code and flags, not the database. This is why migrations must be expand/contract: the previous
  version must keep working on the new schema. If a release includes a contract (destructive) step, set `AUTO_REVERT=false`
  for that release, and forward-fix instead.
- It is only as good as the acceptance tests. A green smoke test on a broken feature reverts nothing. Keep
  acceptance on the money and trust journeys, and add the failing check for every incident.
- `deploy.sh` must be able to redeploy an old SHA (keep the last N artifacts). A revert that has to rebuild
  from scratch is slow and may not reproduce.
- Freezing stops new releases, not damage from what is live. Pair it with kill switches (`gx-ops-readiness`).
  Cancelling a running deploy can leave a half-deployed state; that is why running deploys are cancelled only on request.

### Setup checklist (once per repo)
1. Copy `templates/deploy.yml` and `templates/release-controls.yml` to `.github/workflows/`; keep the CI workflow named `ci`.
2. Copy `templates/scripts/*.sh` to `scripts/ci/`. Copy each `*.example` to `scripts/` (without `.example`) and implement
   `deploy.sh`, `acceptance.sh`, `watch.sh`. The stubs fail closed on purpose; `emergency-stop.sh` is optional.
3. Create GitHub Environments `staging` and `production`; on production add required reviewers (the human approval step).
4. Repo variables: `DEPLOY_FREEZE=false`. Optional: `DEPLOY_TZ`, `DEPLOY_DAYS`, `DEPLOY_START_HOUR`, `DEPLOY_END_HOUR`,
   `DEPLOY_BLOCKED_DATES`, `AUTO_REVERT`, `WATCH_MINUTES`.
5. Secret `RELEASE_ADMIN_TOKEN` (fine-grained token, this repo only, Variables read/write and Actions write) for freeze/unfreeze.
   Without it, set `DEPLOY_FREEZE` by hand in repo settings.
6. Protect tags `good/*` and `bad/*` so only the bot and admins can create or delete them.
7. Practise once on staging: break the acceptance test on purpose and watch the revert; run freeze and unfreeze; mark a commit bad.
   A control nobody has rehearsed is a hope.

### Progressive rollout
Deploy is not release. Ship the code dark, then widen: your own tenant, one friendly customer, 10%, 50%, everyone,
with the watch on at each step and a one-click flag-off as the fastest rollback. Per-tenant flags are the natural
unit for B2B SaaS; per-percentage flags suit consumer apps. A host-level canary (a slice of traffic on the new
version) is a further layer if your platform offers it; HubSpot has not described one publicly, so don't copy it by assumption.

## Rollback
- Code: automatic for a failed release (control 1); by hand, run `deploy.yml` with the SHA from `last-good.sh`. Keep the last N artifacts. Flags: turn off first, it is the fastest.
- Data: forward fix preferred; down-migrations only when written and rehearsed; PITR for disasters.
- Write the rollback for each risky release in the plan before deploying.

## Definition of done (per task)
Gates green · reviewed · deployed to staging and verified · rollback target known and the migration is expand/contract ·
docs, map, system design and memory updated · what was not verified stated in the PR.
