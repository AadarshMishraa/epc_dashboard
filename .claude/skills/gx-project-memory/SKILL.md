---
name: gx-project-memory
description: Read and write the project's local memory in .claude/memory (current state, session logs, decisions, learnings, open questions, improvements). Use at session start, at checkpoints, before ending a session, when the Stop hook asks, and whenever the user says remember, note, log, or "where were we".
---

# Project memory

Sessions forget; the repo shouldn't. `.claude/memory/` is the shared, versioned memory every session
reads first and writes last. It replaces re-explaining context and re-reading the codebase.

## Read (session start)
The SessionStart hook already printed CURRENT_STATE, the last session's Next/Not-verified, recent
learnings and map status. Only open more if the task needs it:
- `DECISIONS.md` → before reopening an architectural question (it may be settled; respect it or argue to change it).
- `LEARNINGS.md` → before touching an area with known traps (search for the area tag).
- `OPEN_QUESTIONS.md` → before building on an assumption.
If `.claude/memory/` doesn't exist: copy the templates from `~/.claude/gx/project/.claude/memory/` (or run the
GX installer for this project) and fill CURRENT_STATE from what you can observe in the repo.

## Write (checkpoint and end)
Write in this order; each step takes a minute, not ten.
1. **Session file** `sessions/YYYY-MM-DD-<slug>.md` (template in `sessions/TEMPLATE.md`). Append if it exists.
   Must have: Goal · Done · Verified (command → result) · Not verified · Next. Facts, not narrative.
2. **CURRENT_STATE.md**: rewrite the parts that changed (status table, in progress, next, blockers,
   environment facts). It is a snapshot, not a diary. Keep it under 150 lines.
3. **DECISIONS.md**: append an entry for any choice a future session might reopen (template in file).
4. **LEARNINGS.md**: one bullet per trap: `- YYYY-MM-DD [area] what is true — why it matters (evidence)`.
5. **OPEN_QUESTIONS.md / IMPROVEMENTS.md**: add or close rows.
6. If `docs/prd/STATUS.md` exists: it holds delivery status (tasks, features, milestones). Update it in the same checkpoint, run `prdtool.py check`, and link the session file from the task row if useful. Do not duplicate status in CURRENT_STATE.md; point to STATUS.md.
7. If `sessions/_autosave.md` has mechanical entries from compaction, fold them into the real session file and delete them.

## Rules
- Write what a stranger needs to continue tomorrow. If it can be derived from code or git log in seconds, don't store it.
- Evidence tags on claims (`OBSERVED`, `INFERRED`, `UNKNOWN`). Never record "done" without how it was verified.
- Never store secrets, tokens, credentials, real customer or patient data, or personal data. Names of env vars are fine; values never.
- Prefer editing and condensing over appending. When LEARNINGS passes ~200 lines, merge duplicates and move area-specific traps into the relevant project skill or doc.
- Memory is not the plan. Plans live in `docs/plans/NNN-*.md`; memory points to them.
- A long session should checkpoint at least every ~8 file edits (the Stop hook enforces this) and before any risky step.

## Checks
- [ ] Session file has Verified and Not verified sections with real content
- [ ] CURRENT_STATE "Next up" matches what you'd tell the next person
- [ ] No secrets or personal data written
- [ ] Decisions with lasting impact recorded
