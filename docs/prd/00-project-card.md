# Project card

| Field | Value |
|---|---|
| Project | GX Foundation Kernel (layer L0) and design system |
| Client / sponsor | GarunaCDX (internal product), sponsor Aadarsh Mishra |
| Industry and sub-segment | Horizontal kernel; first vertical is a solar EPC and distributor owner dashboard |
| Country and regions served | India first (Navi Mumbai base); region and data residency are tenant settings |
| Compliance regime (initial guess) | DPDP Act 2023 and Rules, CERT-In incident reporting, GST for the EPC pack; see docs/compliance |
| Platforms | Web (responsive); AI clients through an MCP gateway; native apps out of scope |
| Tech stack (given or preferred) | Open until ADR-0006; PostgreSQL fixed by ADR-0002 |
| Scale expected at launch and in 12 months | Design targets only: tens of tenants at launch, 1,000 tenants in 12 months (NF-08) |
| Contested inventory (bookings, slots, stock)? | No in the foundation; the EPC pack may have stock |
| Integrations and account owners | Identity providers (OIDC), message senders, object storage; adapters chosen per ADR; accounts owned by Aadarsh |
| Existing systems and data to migrate | None for the foundation |
| Deadline and why it is fixed | None fixed; waves close at gates, not dates |
| Budget range | Not set |
| Team and roles | Aadarsh (decisions, acceptance); agents gx-implementer, gx-qa-engineer, gx-security-reviewer, gx-staff-reviewer, gx-ux-reviewer, gx-planner |
| Decision makers and approvers | Aadarsh Mishra |
