---
id: F-00
name: <feature>
serves: [N-00]
source-status: researched     # researched | partly-inferred
---
# F-00 <feature>

1. Job to be done: <what the user is really trying to achieve, in their words>

2. Precedents (2-3 real products or cases; every row has a link and the date it was read)
| Product | How it solves this | Copy | Avoid | Source |
|---|---|---|---|---|

3. Users and context: <which U-xx; device; connectivity; language; interruptions; who else touches it>

4. Flow: <numbered happy path, then the 3 most likely detours>

5. Edge cases and failure modes
| ID | Case | What must happen | Test type |
|---|---|---|---|
| F-00-E1 | <double tap, two tabs, offline, wrong units, duplicate data, role clash, import with bad rows> | <expected> | unit |

6. UX: <screens; states: empty, loading, error, partial, no permission, offline; key components; copy tone; cognitive-load notes>

7. Data and permissions: <tables touched; who can read or write each field; audit needs; retention>

8. Compliance: <rules that apply; consent; logs; residency>

9. Concurrency and scale: <contested units? yes or no; if yes the invariant in one sentence; see gx-high-concurrency>

10. Acceptance criteria (refined from the PRD, testable)
F-00-AC1 Given <state> When <action> Then <result with a number>

11. Size S/M/L: <size>. Dependencies: <F-xx>. Open questions: <Q-xx>. Risks: <R-xx>

12. Gaps spotted (related things the PRD forgot, ranked by impact):
- <gap>
