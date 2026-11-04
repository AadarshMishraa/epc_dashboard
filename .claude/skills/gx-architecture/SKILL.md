---
name: gx-architecture
description: Architecture, infrastructure, scaling, security, distributed-systems behaviour, backend data validation and edge cases for any product. Use before choosing where logic lives, adding a service, queue, cache, cron, integration or webhook, designing an API, handling money or concurrency, preparing for more load, or reviewing a design for failure modes.
---

# Architecture

Default stance: **a well-structured monolith on managed services** until a measured bottleneck says
otherwise. Most products fail from unclear boundaries and unhandled failure, not from lack of
microservices. Depth on demand:
- `references/distributed-systems.md`: idempotency, retries, queues, outbox, consistency, webhooks, time.
- `references/security.md`: threat model, authN/authZ, secrets, input handling, OWASP mapping, supply chain.
- `references/edge-cases.md`: the backend data-check and edge-case catalogue to run on every endpoint.

## Decide where logic lives
| Logic | Put it in | Never in |
|---|---|---|
| Authorization, tenant isolation, invariants (balance ≥ 0, one active booking per slot) | Server + database constraints/RLS | Client |
| Validation | Both: client for UX, server for truth (same schema shared, e.g. zod) | Client only |
| Multi-step state changes, money, external side effects | Server function/transaction with idempotency key | Client orchestration |
| Slow or retryable work (emails, PDFs, imports, syncs) | Background job/queue with retries + dead-letter | Request path |
| Derived numbers shown everywhere (margin, overdue) | One server-side definition (view/function), tested | Re-computed per screen |
| Scheduled checks | Scheduler + idempotent job that can re-run safely | A user's browser tab |

## Boundaries
- Organise by **domain module** (jobs, billing, inventory), not by technical layer alone. Each module
  owns its tables and exposes functions/endpoints; others don't write its tables directly.
- One source of truth per entity. Copies are derived, rebuildable, and labelled.
- Third-party providers sit behind an adapter interface in our code (payments, SMS, email, storage,
  LLMs), so they can be swapped, mocked in tests, and observed.

## Scaling checklist (ask in this order; fix the first real bottleneck)
1. Queries: indexes for every filter/sort/join used in hot paths; no N+1; paginate (keyset for big lists).
2. Payloads: return only fields the screen needs; compress; cache static and rarely-changing reads.
3. Work off the request path: queues for anything > ~300 ms or calling a third party.
4. Connections: pooling (e.g. PgBouncer/Supavisor); serverless functions must not open a connection per call without a pooler.
5. Per-tenant fairness: rate limits and quotas so one tenant's import can't slow everyone.
6. Read replicas / caching layers / partitioning: only with measurements showing the need.
7. Cost per tenant: know it; it decides pricing and limits.

## Infrastructure baseline
Managed Postgres with point-in-time recovery · object storage with private buckets and signed URLs ·
region chosen for data-residency needs (India: a Mumbai/Hyderabad region) · CDN for static assets ·
infrastructure and config as code where the platform allows · separate projects/accounts for
dev/staging/prod with separate keys · least-privilege service accounts · health check endpoint ·
structured logs + error tracking from day one (`gx-ops-readiness`).
For contested inventory (bookings, slots, stock, balances, launch spikes) use `gx-high-concurrency`.

## Design review questions (answer before building anything non-trivial)
1. What is the source of truth, and who may write it?
2. What happens on timeout, retry, duplicate request, concurrent request, partial failure?
3. Where is the tenant resolved and enforced? Can a crafted request cross tenants?
4. What is the contract (API/event/schema) and how does it evolve without breaking old clients?
5. What do we log and measure, and how will we know it is broken before the customer does?
6. How do we roll it back?
7. What does it cost at 10x and 100x usage?
8. Is there a simpler, more boring way?

## When to write an ADR (`docs/adr/NNN-title.md`)
New dependency or provider · new datastore/queue/cache · cross-module data access · auth model
change · anything hard to reverse. Format: context, options, decision, consequences, revisit-if.
