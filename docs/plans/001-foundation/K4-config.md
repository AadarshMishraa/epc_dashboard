# K4 Config and custom fields

Let every customer and pack change fields, labels, lists and rules as data, and host the shared condition language.

- **Wave:** 3
- **Package:** `k4-config`
- **Needs:** K1, K6
- **Tasks:** 12

Status: tick a task when its done-when and tests pass and the definition of done in [README](README.md) holds. Scope and acceptance live in [the PRD](../../prd/01-prd.md); the execution rules are in [the playbook](../README.md).

## Contract

- **Data:** config_schema, config_value, config_version, label, lookup_list, lookup_item, field_def, field_value, form_layout, pack_install
- **Offers:** Config, Labels, Lookups, Fields (also implements core ClassificationLookup), Expr, BundleImporter
- **Uses:** TenantContext, EventPublisher, AuditSink
- **Events:** config.changed, field.defined, field.deprecated, pack.applied
- **Extension points:** Hosts: any module may register an entity as a custom-field host; named functions for expr registered by modules

## Features delivered

- **F-23** Scoped configuration with versions (Must, 3 acceptance criteria)
- **F-24** Labels and lookup lists (Must, 3 acceptance criteria)
- **F-25** Custom fields (Must, 4 acceptance criteria)
- **F-26** Custom field indexing and filtering (Should, 0 acceptance criteria)
- **F-27** Condition language (Must, 3 acceptance criteria)
- **F-28** Computed fields and form layouts (Should, 0 acceptance criteria)
- **F-29** Configuration bundles (Must, 3 acceptance criteria)

### Capabilities

- [MVP] Config schema registry: modules declare typed keys; scoped values (default, pack, tenant, branch, user) with a fixed resolution order
- [MVP] Versioned config with audit, rollback and change events
- [MVP] Labels and vocabulary layer with locale fallback and a missing-key report
- [MVP] Lookup lists (tenant-managed enums) with ordering, deactivation, translations
- [MVP] Custom field definitions: text, number, money, date, enum, multi-select, boolean, reference, file, geo; validation; required and conditional; data-classification tag
- [MVP] Custom field value storage with write-time validation
- [MVP] Condition language (expr): declarative, sandboxed, versioned; shared by flags, permissions, workflow guards and form rules
- [v1] Field indexing registry with filter and sort API (capped per entity)
- [v1] Computed fields with dependency order and cycle detection
- [v1] Form layout definitions as data
- [v1] Field lifecycle: deprecate, hide, forbid type change once data exists
- [v1] Config bundle import and export: dry-run diff, idempotent re-apply, pack version pinning

### Failure modes and guards

- **Field change breaks existing data:** Definitions are versioned; type change is forbidden once values exist; deprecate instead of delete
- **Custom fields make reports and filters slow:** Only fields flagged indexable are filterable, capped per entity
- **Formula or condition runs arbitrary code:** Expr is a closed grammar with a sandbox and step limits; no eval
- **Tenants drift from their pack:** Pack version is pinned; upgrades go through dry-run diff
- **Personal data hides in a free-form field:** Every field carries a classification; unclassified fields are rejected

## Security baseline for this module

Applies to every task below, on top of [the security guidelines](../../guidelines/security-guidelines.md).

- Validate every write against the registered schema at the boundary; reject unknown keys.
- Every custom field carries a data classification; classified values are masked in logs, diffs and exports.
- The expression evaluator has a closed grammar, no I/O, bounded depth, size and time; evaluate untrusted input only inside it.
- Config bundles are verified before apply; a failed apply changes nothing.

## Tasks

- [ ] **K4-T01** (T-056) Config schema registry and scoped values: default, pack, tenant, branch, user (M)
  - Feature: F-23 | Milestone: M-04 | Level: 5 | Lane: k4-config
  - Needs: K1-T03 (T-017), K0-T07 (T-007)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S2. Module security baseline applies.
  - Done when: Modules declare typed keys; resolution order is fixed and tested
  - Tests: resolution-order tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K4-T02** (T-057) Config versioning, audit, rollback, change events (M)
  - Feature: F-23 | Milestone: M-04 | Level: 6 | Lane: k4-config
  - Needs: K4-T01 (T-056), K6-T02 (T-082)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Every change is versioned and audited; rollback restores the previous value
  - Tests: rollback tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K4-T03** (T-058) Labels and vocabulary layer with locale fallback and missing-key report (S)
  - Feature: F-24 | Milestone: M-04 | Level: 6 | Lane: k4-config
  - Needs: K4-T01 (T-056)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Label lookup falls back by scope and locale; missing keys are reported
  - Tests: fallback tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K4-T04** (T-059) Lookup lists: tenant-managed enums with ordering, deactivation, translations (S)
  - Feature: F-24 | Milestone: M-04 | Level: 6 | Lane: k4-config
  - Needs: K4-T01 (T-056)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Deactivated items stay valid on old records and vanish from pickers
  - Tests: unit tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K4-T05** (T-060) Custom field definitions: types, validation, required and conditional, classification tag, host registration (M)
  - Feature: F-25 | Milestone: M-04 | Level: 6 | Lane: k4-config
  - Needs: K4-T01 (T-056)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: unclassified personal data enters the system. Control: classification tag is mandatory; fields without one are rejected; tags feed masking and the data inventory.
  - Done when: A field with an unclassified tag is rejected; hosts register entities
  - Tests: validation tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K4-T06** (T-061) Custom field value storage with write-time validation (decision recorded in an ADR) (M)
  - Feature: F-25 | Milestone: M-04 | Level: 7 | Lane: k4-config
  - Needs: K4-T05 (T-060)
  - Agents: build Aadarsh decides, then gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-architecture
  - Security: S2. Module security baseline applies.
  - Done when: Values validate on write; a wrong type is rejected; adding a field needs no migration
  - Tests: validation and performance tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
  - Human gate: Record the custom-field storage ADR (column per field, JSON document, or EAV) with a benchmark before code. gx-planner drafts; Aadarsh decides.
- [ ] **K4-T07** (T-062) Field indexing registry with filter and sort API, capped per entity (M)
  - Feature: F-26 | Milestone: M-04 | Level: 8 | Lane: k4-config
  - Needs: K4-T06 (T-061)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-high-concurrency
  - Security: S2. Module security baseline applies.
  - Done when: Only indexable fields filter; the cap is enforced
  - Tests: query-plan checks
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K4-T08** (T-063) Condition language (expr): closed grammar, sandboxed evaluator, versioned (M)
  - Feature: F-27 | Milestone: M-04 | Level: 3 | Lane: k4-config
  - Needs: K0-T03 (T-003)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: denial of service or code execution through expressions. Control: closed grammar, depth, size and step limits, no I/O, fuzz tests with hostile input.
  - Done when: Hostile input cannot loop or reach data outside its scope
  - Tests: property and fuzz tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K4-T09** (T-064) Computed fields on expr with dependency order and cycle detection (M)
  - Feature: F-28 | Milestone: M-04 | Level: 8 | Lane: k4-config
  - Needs: K4-T08 (T-063), K4-T06 (T-061)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Cycles are rejected at definition time; values recompute in order
  - Tests: cycle and ordering tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K4-T10** (T-065) Form layout definitions as data with visibility rules (S)
  - Feature: F-28 | Milestone: M-04 | Level: 7 | Lane: k4-config
  - Needs: K4-T05 (T-060), K4-T08 (T-063)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Layout validates against defined fields
  - Tests: validation tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K4-T11** (T-066) Field lifecycle: deprecate, hide, forbid type change once data exists (S)
  - Feature: F-25 | Milestone: M-04 | Level: 8 | Lane: k4-config
  - Needs: K4-T06 (T-061)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Type change after data is refused; deprecated fields stay readable
  - Tests: lifecycle tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K4-T12** (T-067) Config bundle import and export with dry-run diff, idempotent re-apply, version pinning (M)
  - Feature: F-29 | Milestone: M-04 | Level: 7 | Lane: k4-config
  - Needs: K4-T02 (T-057), K4-T05 (T-060)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Applying twice changes nothing; dry-run shows the diff
  - Tests: idempotency test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
