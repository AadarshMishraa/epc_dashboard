---
name: gx-system-design
description: Keep a living system design document (docs/architecture/system-design.md) with Mermaid diagrams of components, API calls, data flow, tenancy and deployment, updated in the same change as the code. Use when a component, endpoint, integration, queue, table or data flow is added or changed, when onboarding someone, or when asked how the system works.
---

# Living system design

Two layers, because generated diagrams show structure but not intent:
- **Generated** (`.claude/map/diagrams/*.mmd`, `.claude/map/system-design.html`): module graph, request
  flow (code → server functions → tables), ER diagram. Always current; never hand-edited.
- **Curated** (`docs/architecture/system-design.md`): the diagrams a human needs to understand *why*:
  context, containers, key sequences, tenancy, deployment. Updated by you in the same PR as the change.

## The curated document (create from this outline if missing)
1. **Context** (C4 level 1): users/roles, our system, external systems (payments, SMS, maps, auth).
2. **Containers** (C4 level 2): apps, API/edge functions, DB, storage, queues/schedulers, third parties,
   with protocol on each arrow (HTTPS/REST, Realtime WS, webhook, cron).
3. **Key sequences**: one `sequenceDiagram` per critical flow (login, the core transaction, payment,
   notification, import). Show auth checks, idempotency keys, retries, and what happens on failure.
4. **Data ownership**: which component is the source of truth for each entity; derived copies marked.
5. **Tenancy and security boundaries**: where tenant id is resolved, where RLS/authorization is enforced.
6. **Deployment**: environments, CI → preview → staging → prod, where secrets live, backups.
7. **Change log**: date, what changed in the design, link to PR/ADR.

## When code changes, update the design if any of these changed
New/removed service, function, endpoint, queue, cron, external provider · a new call between
components · a new table or a change in who writes a table · auth/tenancy enforcement point · deployment
topology. Steps: run `codemap.py build`, diff `.claude/map/diagrams/` against the last commit to see
structural change, update the curated sections affected, add a change-log line.

## Diagram rules (so a human gets it in one look)
- One diagram, one question. If it needs a paragraph to explain, split it.
- Max ~12 nodes per diagram; group the rest in a subgraph.
- Left-to-right for flows, top-down for hierarchies. Label every arrow with the verb and protocol.
- Same shape means same kind of thing everywhere: rounded = function/service, cylinder = data store,
  plain box = UI/app, hexagon/stadium = external system.
- Show failure paths in sequences (`alt`/`opt` blocks), not just the happy path.
- Diagrams are Mermaid in Markdown so they diff in PRs and render on GitHub.

## Checks
- [ ] Curated doc reflects the change (or you stated why no update was needed)
- [ ] Generated map rebuilt and committed
- [ ] Every external call on the containers diagram has auth + failure behaviour noted
- [ ] Change log updated
