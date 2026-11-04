---
name: gx-modular-platform
description: Design a product as an industry-neutral core plus swappable industry packs (configuration, templates, rules) so the same platform serves solar, EV, healthcare, logistics or other verticals without forking code. Use when designing a new product, adding a vertical, deciding whether something belongs in the core or a pack, or reviewing code for industry-specific leakage.
---

# Modular platform: core + packs

Goal: a second industry costs weeks of configuration, not a rewrite. The test is simple:
**could a new pack be added without changing core code?** If not, the core leaked.

## The split
| Core (shared code, neutral words) | Pack (data and config per industry) |
|---|---|
| Tenancy, users, roles, auth, audit | Role names and default permissions |
| Entities: party, item, job/order, stage, document, payment, task, event, note | Labels ("Installation", "Dealer"), icons, terminology glossary |
| Workflow engine: stages, transitions, SLA timers, required documents, approvals | Stage templates, SLA days, document checklists per stage |
| Rules/exceptions engine (condition → severity → money at stake → action) | The rules themselves (rows) |
| Custom fields (typed definitions + validated values) | The field definitions |
| Import (mapper, staging, errors), export, notifications, reports framework | Import templates (column aliases), notification templates, report definitions |
| Billing, plans, feature flags | Which modules a pack enables |
| Integrations framework (adapter interface) | The concrete adapters a pack needs (e.g. a subsidy portal export) |

## Mechanics
- **Pack manifest** (`packs/<pack>/pack.json` or a `packs` table): id, version, terminology, stage
  templates, custom fields, rules, document types, import templates, enabled modules, default
  dashboards. Versioned; tenants pin a pack version; migrations upgrade them.
- **Extension points**, not forks: typed hooks the core calls (`validateStageTransition`,
  `computeDerivedFields`, `exportFormats`). Pack code, if any, implements these interfaces only.
- **Terminology layer**: UI strings resolve through `t(key, pack)`, so "Job" can read "Installation" or "Order".
- **Feature flags** per tenant/pack to enable modules.
- **Schema stays neutral**: no table or column named after one industry. Industry-only attributes are custom fields or a pack-owned table with a clear prefix.

## Deciding core vs pack
Put it in core only if at least two target industries need the same behaviour with different data.
If only one needs it, it's a pack extension. If you're unsure, build it in the pack first; promote it to
core when the second industry proves the shape. Premature generalisation is as costly as forking.

## Review for leakage
- `grep` the core for industry words (solar, panel, kW, DISCOM, vehicle, patient…): every hit is a leak or a pack default in the wrong place.
- Hardcoded stage names, document lists, SLA numbers or role names in core code are leaks.
- A core test suite runs with a minimal "generic" pack to prove the core works without any industry.

## Validation before building a second pack
Interview 5–10 target users of the new industry; map their workflow onto the core entities; list the
gaps. If more than ~30% of their core workflow doesn't map, it's a different product, not a pack:
say so before committing to the rebuild.
