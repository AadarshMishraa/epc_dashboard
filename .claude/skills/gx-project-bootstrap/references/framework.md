# Framework reference (IDs, states, RAG, gates, document set)

## IDs
G goal · U user · N need · F feature · NF non-functional · X out of scope · R risk · Q question · D decision ·
M milestone · T task · CR change request. Sub-IDs: `F-03-AC2` acceptance criterion, `F-03-E1` edge case.
Chain: Goal -> User -> Need -> Feature -> Acceptance -> Task -> Test -> Release. `prdtool.py trace` writes the chain and lists gaps.

## Document set (`docs/prd/`)
00-project-card · 01-prd · brand/ · features/_industry-brief + F-xx-*.md · 02-roadmap · 03-traceability (generated) ·
STATUS · reports/YYYY-MM-DD (generated) · changes/CR-xxx. Each fact lives in exactly one of them.

## States (closed set)
Not started · In progress · In review · Blocked · Done · Deferred. Anything else ("60%", "almost") fails `check`.
Progress is counted, never estimated: acceptance `n of N pass`, features Done of total, milestones Done of total.

## RAG for milestones (rules, not mood)
- GREEN: on the date in the roadmap, no unowned blocker.
- AMBER: slip of 3 working days or less, or a blocker with an owner and a fix date.
- RED: slip over 3 working days, or blocked with no fix date, or a Must feature cannot meet its criteria.
Overall = the worst milestone RAG that is current or next. Red always carries a recovery option in the report.

## Phases and gates
| Phase | Purpose | Gate to leave |
|---|---|---|
| P0 Discovery | PRD, brand, industry brief, feature analysis | Gate 0: PRD lints clean, review done, baseline `prd-v1.0` signed |
| P1 Foundation | Stack ADRs, walking skeleton, CI/CD, environments | Gate 1: skeleton deployed to staging through the pipeline, acceptance green |
| P2 Core build | Must features, milestone by milestone | Gate 2 per milestone: features Done, demo recorded, client sign-off |
| P3 Harden | Security, accessibility, load/concurrency, compliance, data migration | Gate 3: reviewer agents clean, load test and invariants pass, a11y report, restore drill |
| P4 Launch | Pilot users, go-live, hypercare | Gate 4: launch criteria in PRD section 9 met, rollback rehearsed |
| P5 Operate | Support, monitoring, Should/Could, changes via CR | Ongoing |

## Defects vs changes
A defect fails an existing acceptance criterion: fixed free, tracked as a task under the same F-id.
Anything the criteria do not cover is a change: CR first.

## Weekly report (generated)
Headline (overall RAG, features done, next milestone and date) · milestone board · done this week · planned next week ·
decisions needed · change requests · top risks · proof (counts by state, blockers). Written by `prdtool.py report`; refuses to run
when `check` finds drift.

## Research standards for gx-analyst
- 2-3 precedents per feature, real products or documented cases, each with link + read date, what to copy, what to avoid.
- Industry user types: who actually uses this in this industry, with their device, language and interruption pattern.
- Regulations: the clause or page, not "GDPR applies".
- Numbers (market size, conversion, speed) only with a source; otherwise omit.
