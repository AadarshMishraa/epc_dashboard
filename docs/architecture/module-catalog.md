# Module catalog (L0 to L2)

Mirror of the Claude Doc "Kernel Module Catalog: The Building Complex" (https://claude.ai/artifact/QVkopNNobk2V4QEYmjurZw), which holds the research, the vertical matrix and the sources. Phases are scheduled against solar EPC first. L3 domain modules are per vertical and listed in the Doc.

## L0 Kernel
| ID | Module | What it does | Build |
|---|---|---|---|
| K1 | Tenancy and isolation | Tenant, branches, row-level security, per-tenant region and branding | MVP |
| K2 | Identity and access | Users, roles as data, scopes, MFA; SSO later | MVP |
| K3 | Entitlements and module registry | Plans, limits, enabled modules; the SaaS-versus-custom switch | MVP |
| K4 | Config and custom fields | Typed fields on any entity, labels, enums, validation | MVP |
| K5 | Workflow engine | Stages, transitions, guards, SLAs, automations as data | MVP |
| K6 | Event bus and jobs | Outbox events, scheduler, retries, dead-letter queue | MVP |
| K7 | Audit and consent | Append-only log, consent records, data-request desk, retention | MVP |
| K8 | Files and vault | Private storage, signed short-lived links, versions, access classes | MVP |

## L1 Platform services
| ID | Module | What it does | Build |
|---|---|---|---|
| P1 | Messaging hub | WhatsApp, SMS, email, push; templates; consent gate; opt-out | MVP |
| P2 | Payment gateway layer | Hosted links, idempotent webhooks, daily reconciliation | MVP |
| P3 | Document engine | PDF and print templates, numbering series, e-sign hook | MVP |
| P4 | Tax and rules engine | Dated rates, place of supply, rounding, e-invoicing switch | MVP |
| P5 | Reporting and analytics | Metric definitions, saved reports, scheduled exports | MVP (basic) |
| P6 | Search and views | Global search, saved filters, list, board, calendar views | MVP |
| P7 | Import, export, migration | Spreadsheet mapper, validation, tenant exit export | MVP |
| P8 | Integration connectors | Webhooks in and out, API keys, connector SDK | v1 |
| P9 | AI gateway (MCP) | Tools from manifests, per-user OAuth, approval queue (ADR-0005) | MVP (read-only) |
| P10 | Localization | Languages, currency, dates, number formats, regional scripts | MVP |

## L2 Shared business
| ID | Module | What it does | Build |
|---|---|---|---|
| S1 | Parties | People and organisations with roles, contacts, relationships, one timeline | MVP |
| S2 | Catalog | Items, services, plans, units, variants, price lists | MVP |
| S3 | Leads and pipeline | Sources, stages, owners, follow-ups, duplicate detection | MVP |
| S4 | Quotes and proposals | Line items, versions, discounts with approval, accept link | MVP |
| S5 | Orders and contracts | Confirmed work, subscriptions, agreements, renewals | MVP |
| S6 | Booking and scheduling | Resources, calendars, slots, reminders, no-shows | MVP (basic) |
| S7 | Billing | Invoices, credit notes, recurring and instalment billing, ageing | MVP |
| S8 | Payments and collections | Receipts, allocation, reminders and dunning, refunds | MVP |
| S9 | Procurement and payables | Vendors, purchase orders, goods receipt, vendor bills | MVP |
| S10 | Inventory | Stock, batches and serials, locations, transfers, reorder | v1 |
| S11 | Assets and warranties | Registered assets, warranty clock, service history, AMC | v1 |
| S12 | Work orders and field service | Jobs, checklists, geo check-in, proof photos, parts used | MVP |
| S13 | Tickets and service desk | Requests, categories, SLAs, escalation | v1 |
| S14 | Tasks and projects | Milestones, dependencies, owners, due dates | MVP |
| S15 | Staff and attendance | Rosters, shifts, attendance, leave, expenses, incentives | v1 |
| S16 | Approvals and document tracking | Multi-step approvals, required-document checklists, expiry alerts | MVP |
| S17 | Accounting bridge | Chart mapping and journal export; not a full ledger | v1 |
| S18 | Today feed | Ranked Act now, Decide, Watch items with the reason shown | MVP |
| S19 | Customer portal and public links | Unguessable expiring links: track, accept, pay, upload | v1 |
| S20 | Commissions and payouts | Commission rules, statements, settlement runs, payout approvals (needs counsel) | v1 |

Rule of two: promote a module into L2 only when a second vertical needs it (ADR-0004).
