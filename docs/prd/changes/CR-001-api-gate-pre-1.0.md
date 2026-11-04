---
id: CR-001
title: Public-API gate wording for versions before 1.0.0
status: proposed
requested: 2026-11-04
decided:
impact: wording of F-04-AC4 only; no scope, date or cost change
---
# CR-001 Public-API gate wording for versions before 1.0.0

Requested by: gx-staff-reviewer, raised during the K0-T09 review   Type: change
What is asked: change F-04-AC4 from "a removed public export without a major version bump" to "a removed public export without the required version bump (major from 1.0.0; minor before 1.0.0)".
Why: under semantic versioning, anything may change before 1.0.0, so the gate requires a minor bump for a break and none for an addition while packages are unpublished and at 0.x. Every foundation package is at 0.0.0 today, so the current wording describes behaviour that applies only after 1.0.0. The 1.0.0 case is tested and passes (exit 1 without a major bump, exit 0 with one).
IDs touched: F-04, N-03
Defect or change? Change of wording; the gate meets the current wording for versions from 1.0.0.
Impact: scope none; dates none; cost none; risk none.
Options considered: (a) change the wording (recommended); (b) require a major bump even before 1.0.0, which makes every break during the foundation build a 1.0.0, 2.0.0 and so on, and loses the meaning of 1.0.0 as "published".
Decision: pending Aadarsh.
After approval: update F-04-AC4 in tools/plangen/features.py and docs/prd/01-prd.md, then link this file in the commit.
