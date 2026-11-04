# System design

_Curated. Keep in step with code (skill `gx-system-design`). Generated views: `.claude/map/system-design.html`. Status: initial design from ADR-0001 to 0005, 2026-11-04. Stack (language, framework, hosting vendor) is **not chosen yet**: see `.claude/memory/OPEN_QUESTIONS.md`._

## 1. Context
```mermaid
flowchart LR
  owner["Owner and staff"] --> app["EPC dashboard<br/>(kernel + packs)"]
  cust["Customers<br/>(public links)"] --> app
  ai["Owner's Claude or ChatGPT"] -->|"MCP, per-user OAuth"| app
  app --> wa["WhatsApp provider"]
  app --> pay["Payment aggregator<br/>(hosted links)"]
  app --> gst["GST / e-invoice provider<br/>(per-tenant switch)"]
  app --> acc["Tenant's accounting tool<br/>(export)"]
```

## 2. Containers
```mermaid
flowchart TB
  subgraph Front["Front doors (same service layer)"]
    web["Web and mobile app"]
    api["REST API (versioned)"]
    mcp["AI gateway P9 (MCP)"]
    pub["Public links (tokenised)"]
  end
  subgraph Mono["Modular monolith"]
    L4["L4 packs (config)"]
    L3["L3 domain modules"]
    L2["L2 shared business S1..S20"]
    L1["L1 platform services P1..P10"]
    L0["L0 kernel K1..K8"]
  end
  Front --> Mono
  L4 --> L3 --> L2 --> L1 --> L0
  Mono --> db[("PostgreSQL<br/>shared schema + RLS")]
  Mono --> obj[("Private object storage")]
  Mono --> q["Outbox -> queue -> workers"]
```
Workers run the same code as the app. Side effects (messages, webhooks, PDFs) are asynchronous, never in the request path.

## 3. Key sequences
**Idempotent payment webhook**
```mermaid
sequenceDiagram
  participant G as Payment aggregator
  participant P2 as P2 gateway layer
  participant S8 as S8 payments
  participant S7 as S7 billing
  G->>P2: webhook (provider id)
  P2->>P2: seen this provider id?
  alt first time
    P2->>S8: record payment
    S8->>S7: allocate to invoice (same transaction, outbox event)
  else replay
    P2-->>G: 200, no change
  end
```
**AI tool call (read)**
```mermaid
sequenceDiagram
  participant C as Claude or ChatGPT
  participant P9 as P9 AI gateway
  participant M as Module service
  C->>P9: tool call + user OAuth token
  P9->>P9: tenant, entitlement, permission, admin switch
  P9->>M: same service call as the web app
  M-->>P9: data (RLS applies)
  P9-->>C: masked, untrusted-data output; audit row written
```

## 4. Data ownership
Each module owns its tables (prefix = module id) and exposes an interface and events. No cross-module table reads. Catalog of modules: `module-catalog.md`; contract: `module-manifest.md`.

## 5. Tenancy and security boundaries
Pooled by default: shared schema, `tenant_id` on every table, RLS, tenant set per transaction (ADR-0002). Silo option: same codebase on a dedicated database or region. Compliance rules: `docs/compliance/register.md`. API security: `gx-architecture` security reference.

## 6. Deployment
Indian region (CMP-12). One deployable plus workers; pooled production, silo per tenant on demand. Infra vendor and stack: open.

## 7. Change log
- 2026-11-04: initial design from ADR-0001 to ADR-0005
