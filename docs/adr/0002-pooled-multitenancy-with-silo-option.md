# ADR-0002: Pooled multi-tenancy with row-level security, siloed deployment as an option

- Status: Accepted (Aadarsh, 2026-11-04)
- Date: 2026-11-04

## Context
One product must be sold as subscription SaaS and as a custom product. Enterprise, hospital and some custom buyers will ask for isolation. Compliance rules `CMP-04`, `CMP-10`, `CMP-12` require isolation, tenant exit and India hosting.

## Decision
- **Default: pooled.** One database, shared schema, `tenant_id NOT NULL` on every tenant table, Postgres row-level security (RLS) on every one.
- **Tenant is set once per request, inside the transaction** (`SET LOCAL app.tenant_id = ...`), so it survives transaction-mode connection pooling. Application code never writes `WHERE tenant_id =` by hand.
- **Option: silo.** The same codebase and migrations deployed against a dedicated database (and region if needed). Sold as the enterprise or custom tier.
- Per-tenant quotas and rate limits protect against noisy neighbours.
- Tenant export and tenant delete operate by `tenant_id` and are tested (`CMP-10`).

## Options considered
- **Schema-per-tenant:** rejected, migrations across many schemas become permanent operations work.
- **Database-per-tenant for all:** rejected as default, too costly for small tenants; kept as the silo option.

## Consequences
- Cheapest to run; one migration path; isolation proven by tests, not by topology.
- Every table needs a policy, and a missing policy is a leak. CI must fail a table without one.
- Required tests: for each table, a cross-tenant read and write attempt must fail.

## Revisit if
A tenant's load or contractual isolation needs make pooled unsuitable. Move that tenant to a silo; do not change the default.
