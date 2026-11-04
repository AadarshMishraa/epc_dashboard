# ADR-0001: Modular monolith, not microservices

- Status: Accepted (Aadarsh, 2026-11-04)
- Date: 2026-11-04

## Context
The kernel must be multi-tenant, reusable across verticals, and sellable as SaaS or as a custom build. The team is small. The money spine (order, invoice, payment, stock) needs atomic transactions. Module boundaries are not yet proven, because only one vertical exists.

## Decision
One deployable application. Every module is a package with its own tables, a public interface and domain events. Boundaries are enforced by lint in CI (see ADR-0004, `docs/architecture/module-manifest.md`). Workers run the same code as the app.

## Options considered
- **Microservices from day one.** Rejected: distributed transactions for the money spine, per-service tenant isolation, and wrong boundaries are expensive to undo across a network.
- **Monolith without enforced boundaries.** Rejected: becomes a big ball of mud, and the second vertical then forces a rewrite.

## Consequences
- Cheap to run and to change. A module can later move out because it already talks only through interface and events.
- Discipline is mandatory: the layering lint and table-ownership rule are not optional.

## Extraction order, if load or compliance ever demands it
1. Messaging hub (P1), AI gateway (P9), reporting (P5), document rendering (P3): spiky load, no transaction coupling.
2. Siloed deployment of the same monolith for a tenant (ADR-0002), not a split.
3. Parties, billing and payments last, or never.

## Revisit if
A module needs independent scaling or a different runtime, or separate teams own modules and deploys collide.
