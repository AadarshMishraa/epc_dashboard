---
name: gx-database-design
description: Secure, modular, hard-to-break database design - multi-tenancy, row-level security, constraints, keys, money and time types, audit, soft delete, migrations (expand/contract), indexing and query safety. Use for any new table, column, migration, policy, index, report query, import, or data model review. Project schema skills remain the source of truth for names.
---

# Database design

Principle: **the database enforces what must always be true.** Application code has bugs and new
clients; constraints and policies don't forget. SQL patterns: `references/patterns.sql`.

## Every table gets
- `id uuid primary key default gen_random_uuid()` (or UUIDv7 / ULID if you need time ordering). Never expose sequential ids publicly.
- `tenant_id uuid not null references tenants(id)` on every tenant-owned table, first column of most indexes.
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (trigger), `created_by`, `updated_by`.
- `version int not null default 1` on rows edited concurrently (optimistic locking).
- Explicit `not null` everywhere it should be; `check` constraints for ranges/enums; `unique` for business keys scoped by tenant (`unique (tenant_id, code)`).
- A comment (`comment on table/column`) for anything non-obvious.

## Multi-tenancy (pooled model, default)
- Tenant id resolved from the session (JWT claim or membership lookup), never from the request body.
- RLS enabled and **forced** on every tenant table; policies per operation (select/insert/update/delete), all keyed on tenant membership and role. Insert policies use `with check`.
- Service-role/admin connections bypass RLS: used only in server code, never shipped to clients, every use reviewed.
- Test: a cross-tenant read and write attempt for each table must fail (`gx-delivery-pipeline` gate).
- Escape hatch: design so a large tenant could be moved to its own database later (no cross-tenant joins in app code, tenant id on every row).

## Modularity (plug-and-play across industries)
- Core tables are industry-neutral: `parties`, `items`, `jobs` (or `work_orders`), `stages`, `documents`, `payments`, `tasks`, `events`. Industry words live in configuration, labels and lookup data, not table names.
- Configurable workflow as data: `workflow_templates`, `stage_definitions` (order, SLA days, required documents), `custom_field_definitions` + typed values or a validated `jsonb` column with a JSON Schema stored per tenant/pack.
- `jsonb` is for genuinely variable attributes; anything you filter, join, sum or constrain on becomes a real column.
- Lookups as tables with codes (`stage_code`), not Postgres enums, when tenants or packs need to add values.

## Types
- Money: `bigint` paise (or `numeric(14,2)`) + `currency char(3)`. Never `float`/`real`/`money`.
- Time: `timestamptz` (stored UTC). Calendar dates: `date`. Durations: `interval`.
- Quantities: `numeric(p,s)` with unit column. Percentages: `numeric(5,2)` with a check.
- Phone: E.164 text with check; email `citext`; GSTIN/PAN with format checks.
- Status: lookup table or check-constrained text. State transitions guarded in a function.

## Data integrity patterns
- Foreign keys always; choose `on delete restrict` by default, `cascade` only for true children.
- Soft delete (`deleted_at`) for user-facing records with a partial unique index `where deleted_at is null`; hard delete for personal data on erasure requests (with anonymisation of aggregates).
- Audit: an append-only `audit_log` (tenant, actor, table, row id, action, before, after, at, request id), written by trigger or in the same transaction. No updates/deletes on it (revoke).
- Ledgers for money/stock: append-only entries; balances are views or maintained with constraints and reconciled.
- Idempotency table: `(tenant_id, key) unique` with stored response.
- Personal data in clearly named columns/tables (so DPDP export and erasure are queries, not archaeology). Sensitive fields encrypted (pgcrypto/app-level) if high risk.

## Migrations
- Forward-only, versioned, in git, reviewed; generated SQL read before applying.
- **Expand → migrate → contract** for any breaking change: add new column/table → dual-write/backfill in batches → switch reads → remove old after all clients updated. Never rename/drop in one step.
- Backfills in batches with progress, idempotent, off peak; `create index concurrently` on big tables.
- Every migration has a tested rollback note (down-migration or forward fix).
- Backup verified before destructive migrations in production.

## Indexes and queries
- Index for each hot filter/sort: usually `(tenant_id, <filter>, <sort>)`. Partial indexes for "open/active" subsets. Check with `explain analyze` on realistic data.
- Keyset pagination for large lists; cap `limit`.
- No `select *` in app code; select the fields the caller may see.
- Reports: views or materialised views with refresh strategy; heavy analytics off the primary (replica or warehouse) once size demands.
- Watch: missing FK indexes, sequential scans on big tables, N+1 from ORMs, long transactions holding locks.

## Review checklist
- [ ] Tenant id + RLS (forced) + policies for all four operations + cross-tenant negative test
- [ ] Constraints express the business rules (not null, check, unique, FK, exclusion)
- [ ] Correct types for money, time, quantities
- [ ] Audit for important changes; personal data identifiable for export/erasure
- [ ] Migration is additive or expand/contract; rollback written; big-table operations safe
- [ ] Indexes match the queries; explain plan checked on realistic volume
