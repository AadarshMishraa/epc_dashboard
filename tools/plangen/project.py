"""Project-level PRD content: goals, users, needs, non-functional requirements, scope, risks, questions."""

GOALS = [
    ("G-01", "The EPC pack runs on the foundation through public APIs only, so later verticals can cherry-pick",
     "Foundation files edited for the EPC pack plus industry words found in foundation packages", "no foundation exists", "0 edits and 0 words", "end of wave 5 extraction drill"),
    ("G-02", "No tenant can read or change another tenant's data",
     "Cross-tenant reads or writes that succeed in the tenant matrix", "not measured", "0 across 100% of tenant tables", "every merge to main from wave 1"),
    ("G-03", "A vertical feature ships on foundation primitives alone",
     "Working days to ship a record-plus-workflow feature using only manifests, fields and workflows", "not measured", "5 working days or fewer", "end of wave 5"),
    ("G-04", "Privacy duties are product behaviour, not manual work",
     "Seeded access, correction and erasure requests completed inside the configured SLA", "0 of 20 (no desk exists)", "20 of 20", "end of wave 5 drill"),
    ("G-05", "Owners can connect their own AI assistant safely",
     "Connector conformance checks that pass (Claude, ChatGPT)", "0 of 2", "2 of 2", "end of wave 4"),
    ("G-06", "Every screen is dense, accessible and on brand in both themes",
     "Contrast failures and orange share of brand-hued pixels on shipped templates", "reference page: 0 failures, 3% orange in light", "0 failures and at most 20% orange on every template", "end of wave 5"),
]

USERS = [
    ("U-01", "Platform builder", "Aadarsh and the agents that build verticals and the foundation", "laptop, English, high", "each project rebuilds sign-in, tenancy and audit by hand", "repeated work and unproven isolation", "yes"),
    ("U-02", "Tenant owner or admin", "Owner of a business on a vertical pack, for example a solar EPC firm", "laptop and phone, Hindi and English, medium", "spreadsheets and chat groups", "no single view of money, work and people", "no"),
    ("U-03", "Staff member", "Sales, site, accounts or operations user in a tenant", "phone first, Hindi and English, low to medium", "calls, chat groups and paper", "slow handoffs and lost context", "no"),
    ("U-04", "AI assistant user", "An owner or manager asking an AI assistant about their business", "laptop or phone, English, medium", "copying numbers into a chat by hand", "no safe way to let the assistant read live data", "no"),
    ("U-05", "Data protection contact", "Person in a tenant who answers privacy requests", "laptop, English, medium", "email threads and spreadsheets", "no clock, no evidence, no routing", "no"),
    ("U-06", "Platform operator", "GarunaCDX staff who support tenants and run plans", "laptop, English, high", "manual changes and ad hoc access", "support access is unaudited and plans are edited by hand", "no"),
]

NEEDS = [
    ("N-01", "As U-01 I need tenant isolation enforced below the application code", "a forgotten filter cannot leak data", "G-02", "Must"),
    ("N-02", "As U-01 I need to add a vertical by declaring entities, fields, permissions and workflows as data", "new products reuse the foundation unchanged", "G-01, G-03", "Must"),
    ("N-03", "As U-01 I need contracts, fakes and automated checks around every module", "modules stay independent and extractable", "G-01", "Must"),
    ("N-04", "As U-01 I need events, jobs and schedules that survive crashes", "no side effect is lost or applied twice", "G-03", "Must"),
    ("N-05", "As U-01 I need an audit trail that proves who did what and shows tampering", "disputes and reviews can be settled with evidence", "G-02, G-04", "Must"),
    ("N-06", "As U-02 I need to control who can see and do what, down to branch and amount limits", "staff see only what their job needs", "G-02", "Must"),
    ("N-07", "As U-02 I need to change labels, fields, lists and forms for my business without a developer", "the product fits how my firm works", "G-03", "Must"),
    ("N-08", "As U-02 I need my plan and enabled modules to decide what my staff can use", "I pay for and get exactly what I chose", "G-03", "Must"),
    ("N-09", "As U-03 I need to sign in securely and recover access without calling support", "work is not blocked by lost passwords", "G-02", "Must"),
    ("N-10", "As U-02 I need approvals and deadlines to run on any record with a clear history", "work moves on time and decisions are traceable", "G-03", "Must"),
    ("N-11", "As U-04 I need to connect my AI assistant with my own permissions", "the assistant sees only what I may see", "G-05", "Must"),
    ("N-12", "As U-05 I need access, correction and erasure requests and breach clocks handled in the product", "privacy duties are met on time with evidence", "G-04", "Must"),
    ("N-13", "As U-02 I need to store documents with expiry tracking and share them safely", "paperwork is complete and not exposed", "G-04", "Must"),
    ("N-14", "As U-06 I need time-boxed, consented and audited access to a tenant", "support is possible without silent access", "G-02", "Should"),
    ("N-15", "As U-02 I need single sign-on through my company identity provider", "staff use one managed identity", "G-02", "Later"),
    ("N-16", "As U-01 I need one dense, accessible interface standard in light and dark themes", "every screen looks and behaves the same", "G-06", "Must"),
    ("N-17", "As U-02 I need my own logo, name and accent colour that cannot break readability", "the product looks like mine and stays legible", "G-06", "Should"),
    ("N-18", "As U-06 I need trials, expiry and licences handled by rules", "plan changes need no manual work", "G-03", "Should"),
    ("N-19", "As U-01 I need dedicated-database deployments for clients who require them", "regulated clients can be served from the same code", "G-01", "Later"),
]

NFS = [
    ("NF-01", "Performance", "A permission decision takes p95 under 5 ms with 10,000 grants and a warm cache; a tenant-scoped list query takes p95 under 100 ms at 1,000,000 rows", "nightly benchmark in CI"),
    ("NF-02", "Isolation", "0 cross-tenant rows readable or writable across 100% of tenant tables", "tenant matrix and pool-leak test on every merge"),
    ("NF-03", "Reliability", "0 events lost and 0 applied twice across 1,000 forced worker kills", "chaos and soak test"),
    ("NF-04", "Security", "0 open Critical or High findings at each milestone gate; 1 STRIDE threat model per Must feature", "gx-security-reviewer gate plus dependency and secret scans"),
    ("NF-05", "Privacy", "Erasure and export finish inside the tenant SLA (default 30 days) for 100% of 20 seeded requests; personal data masked on 100% of lines in the redaction test", "seeded drill and log-redaction test"),
    ("NF-06", "Accessibility", "WCAG 2.2 AA on 4 templates in 2 themes with 0 serious or critical axe violations", "axe in CI plus a keyboard pass per template"),
    ("NF-07", "Extractability", "0 imports from vertical packages and 0 industry words in 10 foundation packages", "boundary lint and the extraction drill"),
    ("NF-08", "Scale", "1,000 tenants and 200 concurrent requests per node on pooled Postgres with 0 pool leaks", "load test and pool-leak test"),
    ("NF-09", "Compatibility", "100% of public-API changes carry a semver bump; migrations apply from the previous release with 0 failures", "API diff gate and migrate-from-previous check"),
    ("NF-10", "Brand budget", "Orange at most 20% of brand-hued pixels and text contrast at least 4.5:1 on every template", "colorbudget.py and contrast.py in CI"),
]

OUT_OF_SCOPE = [
    ("X-01", "Industry features: quotes, bills of material, GST invoices, site surveys, solar design", "They belong to vertical packs on top of the foundation", "EPC pack PRD"),
    ("X-02", "Utilities layer (L1): notifications, templates, payment adapters, reporting engine", "Mapped separately after the foundation", "after wave 5"),
    ("X-03", "Native mobile apps", "Web first; the design system is responsive", "later phase"),
    ("X-04", "Collecting subscription payments", "Only a provider port and a stub are built", "v2"),
    ("X-05", "External message broker and multi-region active-active", "Database-backed queue is enough for launch", "v2"),
    ("X-06", "Visual workflow designer", "Workflows are data first; a designer comes after the model is stable", "later phase"),
]

RISKS = [
    ("R-01", "Stack not decided, so wave 0 cannot start", "M", "H", "Decide ADR-0006 before any task; the planner agent drafts the options", "Aadarsh"),
    ("R-02", "Foundation grows ahead of real need (dumping ground)", "M", "H", "Rule of two: nothing is generalised before a second vertical needs it; size and import budget reviewed each wave", "Aadarsh"),
    ("R-03", "A missed row-level security policy leaks data across tenants", "L", "H", "Forced RLS, tenant matrix on every table, security review on every S3 task", "gx-security-reviewer"),
    ("R-04", "OAuth server complexity delays AI connectors", "M", "H", "ADR to delegate the protocol and keep permissions in house (K2-T15)", "Aadarsh"),
    ("R-05", "Agent-written code drifts from the architecture", "M", "M", "Boundary lint, staff review on every M task, definition of done per task", "gx-staff-reviewer"),
    ("R-06", "Custom-field storage hurts query performance", "M", "M", "ADR before K4-T06; capped index registry; 20% read-time budget in F-25", "gx-implementer"),
    ("R-07", "Privacy rules or interpretations change", "M", "M", "Policies are data; compliance register reviewed by counsel before launch", "Aadarsh"),
    ("R-08", "Wave 4 holds 42 tasks and is a bottleneck", "H", "M", "Three parallel lanes (K2, K3, K5) with separate agents", "Aadarsh"),
    ("R-09", "Brand colour budget erodes through drift", "L", "L", "colorbudget.py and contrast.py gates in CI", "gx-ux-reviewer"),
]

DECISIONS = [
    ("Q-01", "Stack and hosting: language, framework, Postgres version, queue approach, package manager", "Aadarsh", "before K0-T01", "Decided 2026-11-04: TypeScript, Next.js on Vercel, Supabase Postgres in Mumbai, database-backed queue (ADR-0006)"),
    ("Q-02", "Repo shape: monorepo or a separate foundation repo", "Aadarsh", "before K0-T02", "Decided 2026-11-04: monorepo (ADR-0006)"),
    ("Q-03", "Accept ADR-0001 to ADR-0005", "Aadarsh", "before wave 0", "Decided 2026-11-04: ADR-0001 to ADR-0005 accepted"),
    ("Q-04", "Name the second vertical for the rule of two", "Aadarsh", "when a second vertical starts", "Deferred 2026-11-04: EPC only for now; a later vertical cherry-picks from the foundation"),
    ("Q-05", "OAuth server: build or delegate", "Aadarsh", "before K2-T15", "Direction 2026-11-04: delegate the protocol to Supabase Auth behind the identity port; confirm GA, connector conformance and password policy before K2-T15 (ADR-0006)"),
    ("Q-06", "Workflow engine: in-house or adopt", "Aadarsh", "before K5-T01", "Open. Lean: in-house"),
    ("Q-07", "Licence and IP model for client custom builds", "Aadarsh and counsel", "before K3-T09", "Open. K3-T09 is now Later, so this can wait"),
    ("Q-08", "Front-end binding for the design system (framework wrappers)", "Aadarsh", "before UI-T03", "Decided 2026-11-04: React wrappers over the CSS classes (ADR-0006)"),
]
