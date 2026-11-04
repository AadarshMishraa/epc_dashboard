---
name: gx-project-bootstrap
description: Turn a signed-off PRD plus brand material into a tracked delivery - lint the PRD, convert brand to accessible tokens, analyse every feature with sourced research, baseline the scope, build the roadmap and keep STATUS.md and client reports true. Use at the start of any new project, when the user adds or changes a PRD, brand guide or scope, or asks for status, a milestone report or a change request.
---

# Project bootstrap: from PRD to tracked delivery

The user supplies **scope** (the PRD) and **brand**. You supply everything else. The PRD is the contract;
`STATUS.md` is the truth about progress; the client report is generated from both. Never hand-write a
number the files can compute.

Tools (stdlib Python, already in the repo): `python3 .claude/gx/bin/prdtool.py` (`init lint check trace report status baseline`)
and `brandtokens.py`. Formats, IDs, states, RAG and gates: `references/framework.md`. Read it once per project.

## The flow (do the steps in order; each ends with a checkable result)

1. **Init.** `prdtool.py init` copies the templates to `docs/prd/`. If `01-prd.md` already has content, do not init; go to step 2.
   Ask for the missing inputs in one message: project card fields, the PRD, brand material. Do not start analysis on guesses.
2. **Lint the PRD.** `prdtool.py lint`. Fix what is mechanical (IDs, links, missing sections). For anything that changes meaning
   (a vague word, a missing metric, a missing out-of-scope list) ask the user; propose wording, never invent a business fact.
   Exit 0 with no errors is the gate.
3. **Brand to tokens.** Put the material in `docs/prd/brand/`, create `brand.json`, run `brandtokens.py`. Show the user every
   adjustment in `contrast-report.md` (what moved, by how much, why). Brand fills stay as given; only text/border/focus move.
   No brand guide: say so, propose a derived or neutral palette, record who approved it.
4. **Industry brief.** Delegate to the `gx-analyst` agent: `features/_industry-brief.md`, every claim sourced with a link and the
   date read. Unsourced claims are tagged `INFERRED`. Read it yourself and list the 5 facts that most change the product.
5. **Per-feature analysis.** One `features/F-xx-<slug>.md` per Must and Should feature (Could: only on request), from
   `_feature-template.md`. Use `gx-analyst` for the research parts (precedents, industry user types, edge cases); you own flow, UX
   (`gx-cognitive-ux`), data (`gx-database-design`), compliance (`gx-compliance`), concurrency (`gx-high-concurrency` when a unit is
   contested). Run independent features in parallel agents; a reviewer agent verifies sources and never reviews its own research.
6. **Review gate (human).** Present, per feature: *keep, cut, change, defer* with the gaps you found, ranked. Short and opinionated:
   say what you would cut and why. Apply the user's decisions to the PRD (not to the analysis files), then `lint` again.
7. **Baseline.** `prdtool.py baseline` (strict lint, then prints the tag commands). The user sets `status: signed-off`, `version: 1.0`.
   Run the git commands only when the user says so. After this, scope moves only through `changes/CR-xxx.md`.
8. **Architecture and roadmap.** ADRs for every stack/provider/data-boundary decision (`gx-architecture`, `gx-system-design`);
   a walking skeleton milestone first (login, one feature end to end, deploy, CI with `gx-delivery-pipeline`).
   Fill `02-roadmap.md` (phases P0 to P5, milestones as demoable outcomes with a date and the F-ids they close, gates). Propose; the user approves.
   `prdtool.py check` must pass, then `prdtool.py trace`.
9. **Plan the first milestone** with `gx-feature-plan`, tasks as `T-nn` under exactly one F-id, session-sized. Copy them into
   `STATUS.md`. Plans for later milestones are written when they become current, not before.
10. **Build loop.** For each task: plan, implement, `gx-test-feature`, update `STATUS.md`, `prdtool.py check`. Then at milestone end:
    demo evidence, gate checklist, `prdtool.py report`.

## Every session after baseline

- Start: read `prdtool.py status` (the hook prints it), then `STATUS.md`, then the current milestone plan, then only the F-xx files
  for the task in hand. Do not read the whole PRD.
- End: update `STATUS.md` (state, acceptance "n of N pass", blockers, next), run `prdtool.py check`; it must be clean before you stop.
- Weekly or on request: `prdtool.py report`; give the user the headline and anything Amber/Red with its fix date.

## Rules that stop mix-ups

1. **IDs are permanent.** Never renumber, reuse or reword an ID to mean something else. Retire with `Deferred` or `Cut (CR-xx)`.
2. **One source per fact.** Scope in the PRD, dates in the roadmap, status in STATUS.md. Copy nowhere; link by ID.
3. **Done means proven.** A feature is Done only when every acceptance criterion passes (`N of N pass`) and the evidence is linked.
   A milestone is Done only when its features are Done and a demo/sign-off record exists.
4. **No work without an F-id.** A task, PR or commit that matches no feature is either a defect in an existing feature (free) or a
   change (needs a CR). Say which. New ideas go to the CR file or `IMPROVEMENTS.md`, not into the build.
5. **Change control.** `changes/CR-xxx.md`: what, why, which F/N/G it touches, cost in days, effect on dates, options, your recommendation.
   The user decides; only then edit the PRD (minor version bump) and the roadmap. Never absorb a change silently, even a small one.
6. **Honest RAG.** Colours come from the rules in `references/framework.md`, not from mood. Bad news goes in the headline with a fix date.
7. **Testable words.** "Fast, easy, secure, scalable, intuitive, robust" never appear without a number or a check.
8. **Sources or INFERRED.** Research claims carry a link and a read date, or the tag `INFERRED`. No invented competitors, statistics or
   regulations. A source you could not open is `UNKNOWN - REQUIRES VERIFICATION`.
9. **Stop and ask** when the PRD contradicts itself, a Must feature cannot meet its acceptance criteria at the stated scale, or a
   deadline cannot hold. Say it plainly, with options, once.

## When the user hands you a thin PRD

Do not refuse and do not pad. Lint it, list what is missing in order of damage (goals without a metric, features without a need,
no out-of-scope, no primary user), draft the missing parts as clearly marked proposals, and ask for the five decisions that unblock
the rest. A thin PRD with honest holes beats a complete-looking one built on guesses.

## Report to the user (end of any bootstrap step)

```
Step done: <n and name>   Gate: <command -> result>
Decisions needed from you: <numbered, with my recommendation>
Next: <one line>
```
