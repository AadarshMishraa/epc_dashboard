# Decisions (append-only)

Format per entry:

## YYYY-MM-DD — <decision in one line>
- Context: why this came up
- Options considered: A / B / C
- Chosen: B, because …
- Consequences / what we gave up:
- Revisit if: <condition that would make this wrong>
- Evidence: OBSERVED / INFERRED (link to code, doc, or ADR)

## 2026-11-04 — Compliance posture: tenant is fiduciary, we are processor; build to DPDP 14 May 2027 standard now
- Context: setting up compliance and privacy rules for the EPC dashboard; DPDP Rules 2025 notified 13 Nov 2025, most duties start 14 May 2027, Consent Manager provisions 14 Nov 2026.
- Options considered: A) wait for the 2027 date, B) build to the 2027 standard from day one, C) act as fiduciary for all data.
- Chosen: B with tenant as fiduciary (DPA at signup), because retrofitting consent, logs and erasure is costlier and launch likely lands before the date.
- Consequences / what we gave up: more upfront build (consent table, retention engine, requests desk, breach runbook); end-customer requests route via the tenant.
- Revisit if: legal counsel advises we are fiduciary for end-customer data in any feature (e.g. direct-to-consumer calculator).
- Evidence: OBSERVED, sources in docs/compliance/register.md (Protiviti, Mondaq, Sansa Legal, GST s.36), checked 2026-11-04.

## 2026-11-04 — Never store Aadhaar numbers, card data, or consumer bank details
- Context: subsidy is credited to the consumer, not the EPC; card data is out of scope via hosted payment links.
- Chosen: schema forbids these fields; privacycheck.py flags them (CMP-03, CMP-21, CMP-27).
- Revisit if: product takes on subsidy disbursement or lending (needs counsel first).
- Evidence: OBSERVED (register.md).

## 2026-11-04 — Kernel architecture proposed: ADR-0001..0005 (status Proposed, pending Aadarsh's acceptance)
- Context: planning a reusable multi-tenant kernel sold as SaaS and as custom product.
- Chosen (proposed): modular monolith; pooled tenancy with RLS and a silo option; packs + entitlements + three customisation levels; five-layer module model with rule of two; MCP as a first-class surface.
- Evidence: docs/adr/, docs/architecture/module-catalog.md, Claude Doc "Kernel Module Catalog: The Building Complex".

## 2026-11-04 — Foundation plan 001 drafted: 9 modules, 10 packages, 119 tasks, 6 waves (not started)
- Context: Aadarsh asked for a foundation map, architecture for robustness and modularity, per-module breakdown and executable tasks.
- Chosen (proposed): waves K0 → K1 → K6 + K7a → K4 → K2 + K3 + K5 → K8 + K7b, each ending at a gate; an extraction drill at waves 1, 3 and 5; EraserRegistry added as a core port so K7b and K8 stay decoupled.
- Evidence: docs/plans/001-foundation/, Claude Doc "Foundation Map: Kernel Layer L0".

## 2026-11-04 — Design system adopted: midnight and orange at 80/20, light and dark, dense Salesforce-style shell
- Context: Aadarsh asked for both themes, two brand colours at 80% and 20% accent, tight layout with no blank space, well-placed menus and buttons.
- Chosen (proposed): tokens in design/tokens.css as the single source; orange is a ceiling of 20% of brand-hued pixels, working target 5 to 10%, only for the one primary button, active-navigation marker, one highlighted KPI or series, and "needs you" counts; text on orange is midnight (white fails at 3.2:1); links, selection and focus are blue.
- Consequences / what we gave up: orange is rare by design; tenants may change logo, name and accent only, with a contrast check.
- Revisit if: the brand owner wants orange to carry more surface area, or a tenant needs full theming.
- Evidence: OBSERVED. design/tools/contrast.py reports 0 failures; reference page about 3% orange in light and 1% in dark. docs/design/design-system.md.

## 2026-11-04 — Work breakdown: 67 features, 133 tasks, generated from tools/plangen; PRD draft in docs/prd
- Context: Aadarsh asked for the foundation map divided into a feature list with tasks agents can execute, following security guidelines.
- Chosen (proposed): 8 milestones (M-01 to M-08), 50 Must and 17 Should features with 170 acceptance criteria, 133 tasks (119 foundation, 14 design) with agent, reviewers, skills, security level (42 S3), rollback and human gates; agents work in lanes (one package each).
- Consequences: feature analysis files (docs/prd/features/F-xx) are not written; prdtool trace lists 50 gaps for Must features. gx-analyst fills them before each feature's first task.
- Evidence: OBSERVED. prdtool lint 0 errors, check 0 errors. docs/plans/README.md, docs/plans/TASKS.md.

## 2026-11-04 — Stack locked: TypeScript, Next.js on Vercel, Supabase Postgres (Mumbai), monorepo (ADR-0006); ADR-0001 to 0005 Accepted
- Context: Aadarsh answered the wave-0 blockers: Supabase and Vercel are fine, monorepo as recommended, accepted the ADRs ("lock it").
- Chosen: managed Postgres and Storage only (no browser SDK or PostgREST for tenant data, never service_role for app queries, own non-owner role over the pooler with SET LOCAL); no vendor SDKs inside foundation packages (ports and adapters); database-backed queue triggered by Vercel Cron or Queues, worker later; Kysely plus plain SQL migrations; React wrappers over the design CSS.
- Consequences / what we gave up: long-running work is triggered not hosted until a worker is added; Supabase and Vercel limits feed NF-08.
- Revisit if: Supabase Auth fails the K2-T15 checks (GA, connector conformance, password policy), Vercel limits block the dispatcher, or a client needs another host (silo path).
- Evidence: OBSERVED. docs/adr/0006-stack-hosting-and-repo-shape.md; Supabase OAuth 2.1 server docs and Vercel duration limits checked 2026-11-04.

## 2026-11-04 — EPC-first: second vertical deferred, nothing generalised beyond what EPC needs
- Context: Aadarsh: focus on EPC only; when another vertical comes he will cherry-pick from the foundation.
- Chosen: Q-04 (second vertical) deferred; goal G-01 reworded to "EPC pack uses public APIs only, 0 foundation edits, 0 industry words"; boundary and industry-word lint stay on every merge (cheap, keeps cherry-picking possible); full extraction drill runs once at the end of wave 5 instead of waves 1, 3 and 5; features F-12 silo routing, F-37 OIDC SSO, F-44 licence file and F-45 pack pinning moved from Should to Later.
- Consequences: less foundation to build before EPC work can start; EPC pack needs its own PRD and tasks mapped onto foundation primitives.
- Revisit if: a second vertical or an enterprise client needing silo or SSO appears.
- Evidence: OBSERVED. tools/plangen catalogue; prdtool lint and check 0 errors.

## 2026-11-04 — Industry intelligence: skill epc-industry-news, agent epc-industry-scout, weekly scheduled brief
- Chosen: Monday 07:47 IST scheduled task (push notification, no email) producing a ~400-word Indian solar EPC brief; same skill runs on demand.

## 2026-11-04 — EPC pack plan: scope, sequencing and what the foundation lacks
- Chosen (planning, pending Aadarsh sign-off): pack PRD at packs/epc/docs/prd (65 features: 37 Must, 17 Should, 11 Later; 92 tasks; 8 milestones; gates G0 to G4). Pack MVP starts at won-deal handoff (import sheets or CRM export), not at leads or quotes. Wedge: utility-stage tracker, owner exceptions list, cash blocked, material readiness, forecast margin. Invoices are recorded and synced with Tally, not issued (lean for Q-03). Distributor (Trade) features are Later.
- Sequencing: pack wave A (domain code on core ports and fakes) runs alongside foundation waves 0 to 2; B needs configuration (wave 3); C identity and workflow (wave 4); D files and privacy desk (wave 5). First pilot on real customer data follows foundation wave 5. Phase 0 (owner conversations, paid-pilot ask, definitions) starts now with no code.
- Generic capabilities missing from the foundation (record timeline, exceptions engine, tasks, import, money library, stock and cost ledgers, message adapters, PDF generation, in-app notices, search) are built inside the pack and listed in packs/epc/docs/foundation-map.md as extraction candidates for the L1 utilities map; they move only when a second vertical needs them.
- Revisit if: pilots reject the owner-first scope, or an owner needs invoices issued in-app (Q-03).
- Evidence: OBSERVED. prdtool lint and check on packs/epc: 0 errors; sources are the three earlier EPC documents and docs/compliance/register.md.


## 2026-11-04 — privacycheck: narrow inline allow for CMP-03 prose, not a rule weakening
- Context: privacycheck flagged generator prose "Do not store Aadhaar numbers (CMP-03)" in tools/plangen/epc_gen.py; K0-T10 (F-05) makes privacycheck a blocking CI stage.
- Options considered: A) inline `privacycheck: allow CMP-03 <reason>` marker, B) limit CMP-03 to code contexts, C) reword the prose to avoid the word.
- Chosen: A, honoured only in `tools/plangen/` or .md/.txt, only for CMP-03, only with a reason, and only when every match is the bare word "Aadhaar"; identifiers (aadhaar_no, aadhaarNumber) always flag. ALLOW lines print in CI. The generator line was split so the marker sits in Python source, not in domain-notes.md (output byte-identical).
- Consequences / what we gave up: B rejected because SQL inside Python strings is a real field; C rejected because future Aadhaar/KYC prose (PM Surya Ghar) would trip it again and hiding the word hurts readers.
- Revisit if: another rule needs prose suppression, or the legacy blanket `privacycheck:ignore` gets used on a field.
- Evidence: OBSERVED — .claude/gx/bin/test_privacycheck.py (12 tests; mutation that ignores path/identifier checks fails 6).
