# Stack recipes (adapt to what the repo already uses)

## TypeScript / Next.js (Vitest or Jest, Testing Library, Playwright)
- Pure logic and server actions: Vitest/Jest unit tests; table-driven cases for boundaries (`it.each`).
- Zod/schema: assert both accepted and rejected payloads, including extra fields (strip or reject, whichever the contract says).
- Components: Testing Library; query by role/label (this tests accessibility for free); assert each state by mocking the data hook (loading/empty/error/success).
- A11y in tests: `jest-axe` / `vitest-axe` on rendered components; in E2E `@axe-core/playwright` per page at 360 and 1280 widths.
- E2E (Playwright): tag the money/trust journeys `@smoke`; use network interception to inject 500s and timeouts (failure angle 9); `context.setOffline(true)` for offline.
- Concurrency at API level: `await Promise.all(Array.from({length: 20}, () => call()))`, then assert exactly one success and the DB invariant.

## Supabase / Postgres
- pgTAP (`supabase test db`): `has_column`, `col_not_null`, `throws_ok` for constraints, `is_empty` for RLS denials. Pattern for tenant isolation:
  ```sql
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<user-in-tenant-B>","role":"authenticated"}';
  select is_empty($$ select 1 from jobs where tenant_id = '<tenant-A>' $$, 'B cannot read A');
  select throws_ok($$ insert into jobs (tenant_id, code, title, stage_code) values ('<tenant-A>','X','t','new') $$, '42501');
  ```
  Run it for select, insert, update and delete on every table, per role.
- Migrations: apply on a dump with realistic volume; `explain (analyze, buffers)` for new queries; run the down/forward-fix path once.
- Edge Functions (Deno): `deno test --allow-env`, inject the Supabase client as a dependency so it can be faked; test with an idempotency key twice and with a stale `version`.
- Webhooks: send with a bad signature, a stale timestamp, a duplicate event id, and out-of-order events.

## Python / Django / DRF (pytest-django)
- `APIClient` per role; parametrize `(role, expected_status)` for the permission matrix.
- `django_assert_num_queries` to catch N+1. `transaction=True` tests with threads for concurrency; assert `select_for_update` effect.
- Migrations: `makemigrations --check --dry-run` in CI; test data migrations with `django-test-migrations`.
- Response envelope and old-client shape: snapshot the JSON of key endpoints; a diff that removes or renames a field fails the test.

## Flutter / Dart
- `flutter test` for logic and widgets (`testWidgets`, `pumpAndSettle`); fake the repository layer; golden tests for states.
- Offline and kill-and-resume: integration tests with a fake connectivity service; assert queued writes replay in order.
- Realtime: simulate reconnect and assert the screen refetches current state.

## React Native / Expo
- Jest + `@testing-library/react-native`; Maestro or Detox for the 3–5 critical flows; test on a low-end Android profile for performance.

## Cross-cutting checks worth scripting
- Contrast: `python3 scripts/contrast.py` (design kit) after any colour change.
- Secret scan on the diff: `gitleaks detect --no-git --source .` or `git diff | gitleaks`.
- Dead exports / unused deps: `knip`, `ts-prune`, `depcheck`.
- Load smoke on a list endpoint: `k6` or `autocannon` with 50 concurrent users for 30 s; compare p95 before/after.
