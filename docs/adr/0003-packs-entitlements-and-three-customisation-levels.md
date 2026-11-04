# ADR-0003: Packs, entitlements, and three customisation levels

- Status: Accepted (Aadarsh, 2026-11-04)
- Date: 2026-11-04

## Context
The product is sold both as SaaS and as custom builds. Forking code per customer ends the SaaS business.

## Decision
Every customer need is handled at the lowest level that works:
1. **Configure.** The tenant admin changes custom fields, stages, roles, templates, rules. No developer. This is SaaS.
2. **Extend.** A new module or hook written against public interfaces and events, enabled for named tenants through **entitlements**. Priced as a custom project.
3. **Isolate.** Dedicated deployment (ADR-0002). Priced as enterprise.

Verticals are **packs**: workflows, field sets, templates, roles, labels, report definitions, and a module list. A pack contains no core code. Tenants pin a pack version; pack upgrades are migrations.

Entitlements (plan, limits, enabled modules) are separate from feature flags (rollout only).

## Rules
- No `if (tenant == X)` anywhere in code. A hit is a failed design.
- Custom code for one customer is a module with its own manifest, enabled by entitlement.
- Existing skill `gx-modular-platform` applies: core uses neutral words; grep core for industry words.

## Consequences
SaaS and custom share one codebase, one release train, one test suite. Some custom requests will be declined or priced as new modules.

## Revisit if
More than a few extend-level modules are one-off; that is a sign a shared module or a config point is missing.
