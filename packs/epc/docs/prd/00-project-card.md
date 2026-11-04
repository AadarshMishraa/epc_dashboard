# Project card

| Field | Value |
|---|---|
| Project | EPC pack: owner control tower for Indian solar EPCs, on the GX foundation |
| Client / sponsor | GarunaCDX (internal product), sponsor Aadarsh Mishra |
| Industry and sub-segment | Solar EPC and installer: rooftop residential, commercial and 100 kW and above |
| Country and regions served | India; first one or two states (decision Q-01); Mumbai hosting region |
| Compliance regime (initial guess) | DPDP Act 2023 and Rules 2025, CERT-In incident reporting, GST records, state utility and PM Surya Ghar documentation; see docs/compliance/register.md |
| Platforms | Web for office roles; installable web app for site roles; Hindi, Marathi, Gujarati and English labels |
| Tech stack (given or preferred) | Fixed by ADR-0006: TypeScript, Next.js on Vercel, Supabase Postgres in Mumbai, pnpm and Turborepo; pack lives in packs/epc |
| Scale expected at launch and in 12 months | 3 pilot companies at launch; 30 companies in 12 months; 40 live projects per company |
| Contested inventory (bookings, slots, stock)? | Yes: stock reservations across projects (E5-T05) |
| Integrations and account owners | Tally (file exchange), email provider, WhatsApp business provider (later), object storage via the foundation; accounts owned by Aadarsh or the tenant |
| Existing systems and data to migrate | Owner's Excel sheets and exports from their CRM; imported by the guided import |
| Deadline and why it is fixed | None fixed; gates decide. Subsidy scheme timing makes earlier pilots more valuable (risk R-01) |
| Budget range | Not set |
| Team and roles | Aadarsh (decisions, acceptance); a design partner owner; agents gx-implementer, gx-qa-engineer, gx-security-reviewer, gx-staff-reviewer, gx-ux-reviewer, gx-planner, gx-analyst |
| Decision makers and approvers | Aadarsh Mishra |
