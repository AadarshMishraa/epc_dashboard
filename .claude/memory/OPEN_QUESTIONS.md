# Open questions

| # | Question | Blocks | Who can answer | Status |
|---|---|---|---|---|

- 2026-11-04: Tech stack (language, framework, hosting vendor, auth server) not chosen. Needed before the implementation plan. Owner: Aadarsh.
- 2026-11-04: Kernel repo shape: recommended monorepo (kernel/ modules/ packs/) until the second vertical ships, then extract. Awaiting Aadarsh.
- 2026-11-04: Confirm ADR-0001..0005 (Proposed) and the second vertical (recommended BookYourPandit-style marketplace pack).
- 2026-11-04: Payout rails (S20): needs counsel before launch.
- 2026-11-04: Foundation plan 001 decisions: (1) stack, (2) repo shape, (3) accept ADRs, (4) second vertical for the wave 3 drill, (5) OAuth server build or delegate (K2-T15), (6) workflow in-house or adopt (K5-T01), (7) licence and IP model for client custom builds (K3-T09). Owner: Aadarsh. See docs/plans/001-foundation/README.md.
- 2026-11-04: Front-end binding for the design system (Q-08 in docs/prd/01-prd.md) follows the stack decision. Blocks UI-T03 and everything after it in plan 002. Owner: Aadarsh.
- 2026-11-04: Feature analysis files (docs/prd/features/F-xx) are not written for the 50 Must features; run gx-analyst per feature before its first task. prdtool trace lists the gaps.
- 2026-11-04: Milestone dates are TBD until features are sized; PRD stays draft until Aadarsh signs off v1.0.
- 2026-11-04 RESOLVED: stack, repo shape, ADR-0001..0005 acceptance and front-end binding (see DECISIONS and ADR-0006). Still open: second vertical (D-04), workflow engine in-house or adopt (D-06), licence and IP model (D-07), OAuth server direction pending Supabase Auth checks before K2-T15, payout rails counsel, Mumbai Supabase and Vercel projects and Postgres major version to record before K0-T02.
- 2026-11-04: EPC pack decisions Q-01 to Q-12 in packs/epc/docs/prd/01-prd.md: first states and utilities, design partner owner and 3 to 5 pilots, record-and-sync versus issue invoices, warehouse versus direct-to-site stock, offline storage on the phone (ADR before any E8 task), pilot offer and price, plan limits, accounting tools beyond Tally, WhatsApp provider and cost, foundation wave 4 order (identity and workflow first, entitlements last). Owner: Aadarsh.
- 2026-11-04: Phase 0 validation (8 to 10 owner conversations, 5 real sheets, definitions of stuck, cash blocked, forecast margin, material due and overdue) has not started; gate G0 needs 3 paid-pilot commitments.

- 2026-11-04: ADR-0006 gate still open: create the Supabase and Vercel projects in Mumbai and record the Postgres major version in the K0 brief (docs/plans/001-foundation/K0-core.md). K0-T02 went ahead (no database dependency); the gate now blocks K0-T05, K0-T10 and K0-T11. Container has Postgres 16 locally, which only matches if Supabase gives 16. Owner: Aadarsh.
