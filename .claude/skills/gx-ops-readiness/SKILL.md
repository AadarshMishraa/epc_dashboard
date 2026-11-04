---
name: gx-ops-readiness
description: What a product needs to run in production and be supported - logging, metrics, alerts, error tracking, audit, backups and restore drills, incident response, status page, cost control, admin and support tooling, onboarding and data import, analytics. Use before a first launch, when adding a critical path, after an incident, or when asked "are we production ready".
---

# Operations readiness

Most "it works on my machine" products fail on day 30, not day 1: nobody sees errors, a restore was
never tested, support can't fix a customer's data, and cost quietly grows. Check these before launch.

## Observability
- **Structured logs** (JSON) with request id, tenant id, user id (hashed if needed), route, latency, outcome. Never log secrets, OTPs, tokens, full card or ID numbers, or health details.
- **Error tracking** (Sentry or similar) on every app and function, with release tags and source maps.
- **Golden signals** per service: latency (p50/p95), traffic, errors, saturation. Plus business signals: sign-ups, imports completed, key transactions per hour.
- **Alerts** on symptoms users feel (error rate, p95 latency, failed jobs, webhook failures, queue depth), routed to a person, with a runbook link. No alert without an owner and an action.
- **Health check** endpoint and uptime monitor; public status page once you have paying customers.
- **Audit log** for important business changes, viewable by the customer's admin.

## Data safety
- Automated backups with point-in-time recovery; retention matches contracts.
- **Restore drill** at least quarterly, timed, documented: a backup you haven't restored is a hope.
- Object storage versioning or backups for documents.
- Per-tenant export (also helps sales: no lock-in) and per-tenant restore procedure.

## Incidents
- Severity levels (SEV1 customer-wide outage or data exposure … SEV4 minor).
- Runbook: detect → assign incident lead → stabilise → communicate (status page, affected customers) → fix → postmortem (blameless, with actions and owners).
- Regulatory clocks in the runbook (e.g. CERT-In 6 hours, DPDP breach intimation; see `gx-compliance`).

## Support and admin tooling (build early; it saves your evenings)
- Internal admin: find a tenant/user, see their recent errors and jobs, impersonate with consent and audit, resend notifications, re-run failed imports/jobs, fix data with a recorded reason.
- Customer-facing: in-app help, contact channel, changelog, onboarding checklist.
- Feature flags console.

## Onboarding and data import
- Time-to-first-value target (e.g. "sees their own jobs on the dashboard within 10 minutes").
- Import from what they use today (Excel/CSV/Tally/WhatsApp exports) with mapping, preview, row errors, re-import as update.
- Sample data mode for demos, clearly separated from real data.

## Product analytics
- Event plan before launch: activation, the core action, retention cohort, feature adoption. Privacy-safe (no PII in events, consent where required).
- One weekly review of the numbers that decide the next build.

## Cost
- Know cost per tenant (DB, storage, functions, messaging, AI tokens, third-party APIs). Alert on spikes.
- Quotas and plan limits enforced in code. Messaging and AI calls rate-limited per tenant.

## Readiness checklist
- [ ] Logs, error tracking, alerts with owners, health check
- [ ] Backups + a restore drill done this quarter
- [ ] Incident runbook with regulatory clocks
- [ ] Admin tooling for the top 5 support requests
- [ ] Import path from the customer's current tool
- [ ] Analytics event plan live; cost per tenant known
- [ ] Status page and support channel (once paid)
