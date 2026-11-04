# Module manifest (contract)

Status: implemented by K0-T07 (2026-11-04); implements ADR-0001, 0004, 0005. Every module ships one manifest, as `manifest.json` in its package (or in a pack module's folder). It is JSON, not the YAML sketched below: no parser dependency, and the same validation tools as `packages/register.json`. Validate with `pnpm check:manifests`; the schema is `manifestSchema` in `@gx/toolchain`. Changes from the sketch: `table_prefix`; `events_emitted` as `{ name, version, schema }` and `events_consumed` as `{ name, version }`; `tools[].permission`; `extension_points`; `errors` (codes colliding with core or another module fail); and `tests_planned` replaces `tests`, because nothing enforces it until K0-T10. Entities are the unit of ownership: each entity has one owning module, and that module's permissions, workflow hooks, events and custom-field hosts must name its own entities. Foundation manifests must match their register entry and be L0; pack manifests need no foundation edit.

```yaml
id: billing                  # S7 in module-catalog.md; lowercase, unique
layer: L2                    # L0 | L1 | L2 | L3
version: 1.0.0
depends: [kernel.tenancy, kernel.workflow, platform.documents, platform.tax, shared.parties]
entities: [invoice, invoice_line, credit_note, receipt]
events_emitted: [invoice.issued, invoice.overdue, payment.allocated]
events_consumed: [order.confirmed, payment.received]
permissions: [invoice.read, invoice.issue, invoice.void_request]
custom_field_hosts: [invoice, invoice_line]
workflow_hooks: [invoice.issue, invoice.send]
tools:                       # exposed through the AI gateway (ADR-0005)
  - { name: receivables_due, mode: read }
  - { name: draft_invoice, mode: draft }    # needs human approval
config_schema: billing.config.json          # series, due days, late-fee rule
tests: [tenant_isolation, immutability, idempotency, pack_conformance]
```

## Rules
1. **Own your tables.** Table prefix = the manifest's `table_prefix`, owned by exactly one module (foundation packages use `k1_` and so on); `tenant_id NOT NULL`; RLS policy on every table. No module reads another module's tables, only its public interface or its events.
2. **Declare what varies.** Config schema, custom-field hosts, workflow hooks and labels are listed. Undeclared means not configurable.
3. **Events are versioned contracts.** Add fields freely; never remove or rename; consumers ignore unknown fields. Events are written in the same transaction as the state change (outbox).
4. **Tools have a mode: `read` or `draft`.** Anything that moves money, sends messages, issues documents or deletes is never exposed directly.
5. **Disable, don't drop.** Disabling hides the module and keeps data; removal is a migration with an export.
6. **Ship the tests:** cross-tenant negative test, permission test, idempotency test, and a pack-conformance test that runs the module under two different packs.
7. **Layering is enforced in CI:** a lower layer must not import a higher one; a module must not touch another module's tables.

## Checks the CI tool must make (to build in the implementation setup)
- every `depends` entry exists and sits in the same or a lower layer;
- every table named in code has a prefix owned by exactly one manifest, a `tenant_id` column and an RLS policy;
- every emitted or consumed event is declared; every tool has a mode and no tool performs a forbidden action;
- no industry word in L0 to L2 code or schema (see skill `gx-modular-platform`).

## Naming
Module ids: lowercase words. Events: `entity.past_tense_verb`. Permissions: `entity.action`. Tools: verb-noun, task level (`receivables_due`, not `list_invoices`).
