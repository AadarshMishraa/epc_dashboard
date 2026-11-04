# Project memory

Local, versioned memory for every agent session in this repo. Commit it: teammates and future
sessions read the same truth. Protocol and rules: the `gx-project-memory` skill.

| File | What goes in it | Size rule |
|---|---|---|
| `CURRENT_STATE.md` | Where the project stands right now. Rewritten, not appended. | ≤ 150 lines |
| `sessions/YYYY-MM-DD-<slug>.md` | One per working session: goal, done, verified, not verified, next. | ≤ 60 lines each |
| `DECISIONS.md` | Append-only decision log (ADR-lite). Big ones also get `docs/adr/NNN-*.md`. | one entry ≤ 12 lines |
| `LEARNINGS.md` | Traps, gotchas, "looks like X but is Y". The thing you wish you'd known. | condense when > 200 lines |
| `OPEN_QUESTIONS.md` | Unknowns that block or bias work, with who can answer. | close items, don't let them rot |
| `IMPROVEMENTS.md` | Product and engineering suggestions from `gx-product-introspect`, with status. | triage monthly |
| `GLOSSARY.md` | Domain terms and the exact names used in code. | one line per term |

Never store secrets, credentials, personal data of real users, or customer data here.
`sessions/_autosave.md` is written by the pre-compaction hook; replace its entries with a real summary.
