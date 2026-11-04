# ADR-0004: Five-layer module model, vertical-free nouns, rule of two

- Status: Accepted (Aadarsh, 2026-11-04)
- Date: 2026-11-04

## Decision
Five layers; a layer may depend only on layers below it:

| Layer | Name | Holds |
|---|---|---|
| L0 | Kernel | Tenancy, identity and roles, entitlements, config and custom fields, workflow engine, event bus and jobs, audit and consent, files |
| L1 | Platform services | Messaging, payment gateway, documents, tax and rules, reporting, search, import and export, integrations, AI gateway (MCP), localization |
| L2 | Shared business | Parties, catalog, leads, quotes, orders and contracts, booking, billing, payments, procurement, inventory, assets, work orders, tickets, tasks, staff, approvals, accounting bridge, Today feed, portal, commissions |
| L3 | Domain modules | Real logic one vertical family needs: site survey, clinical records, exams, leases |
| L4 | Packs | Configuration and templates for a vertical |

- **Vertical-free nouns below L3.** Party (not Patient, Student, Customer), Booking (not Appointment), Work order (not Installation). A pack renames them and adds roles and fields.
- **Rule of two.** A module is promoted into L2 only when a second vertical needs it. Until then it lives in the first vertical's L3.
- **Three placement tests.** Every vertical needs it: L2 or below. Only some, with real logic: L3. Only labels, fields, stages or templates differ: pack.

The full module list is `docs/architecture/module-catalog.md`. The research behind it is the Claude Doc "Kernel Module Catalog: The Building Complex" (https://claude.ai/artifact/QVkopNNobk2V4QEYmjurZw).

## Consequences
Reuse is decided at L2. If L2 nouns leak vertical words, every pack pays. CI lint enforces direction and table ownership.

## Build order
Six waves with gates: kernel, utilities, money spine (S1, S2, S7, S8, S18), solar EPC pack, second vertical, third vertical plus remaining shared modules. Detail in the Doc.

## Revisit if
The second vertical needs kernel changes other than additions.
