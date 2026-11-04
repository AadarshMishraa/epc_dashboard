---
name: gx-cognitive-ux
description: Design screens, components, flows, charts and copy around how human perception and memory actually work, so a user understands each view at a glance. Use for any UI design, review or build - layouts, buttons, forms, tables, dashboards, KPI cards, charts, empty states, errors, notifications, onboarding. Project design-system skills supply the tokens; this supplies the reasoning.
---

# Cognitive UX: design for how the brain reads

People don't read screens; they scan for the thing they came for, decide in a fraction of a second
whether it's there, and act. Design so that scan succeeds. Component-level rules:
`references/components.md`. Dashboards and charts: `references/data-display.md`.

## The model you're designing for
1. **Pre-attentive vision (≈ under 250 ms).** Before conscious reading, the eye picks up size,
   colour/contrast, position, shape, motion. Use these for the one thing that matters most on the
   view; if everything is bold, nothing is.
2. **Working memory is tiny (about 4 chunks).** Don't make users remember between screens, compare
   numbers across pages, or decode codes. Show it; chunk it (group of 3–5); label it.
3. **Recognition beats recall.** Visible options, recent items, defaults, autocomplete, examples
   in placeholders (never as the only label).
4. **Gestalt grouping.** Proximity (things close together belong together, so spacing is
   structure), similarity (same look means same function), common region (a card groups),
   alignment (one grid; ragged edges read as noise).
5. **Scanning patterns.** Text-heavy pages are scanned in an F-pattern, sparse ones in a Z. Put the
   key information top-left of the content area, the primary action where the scan ends, and
   front-load labels and sentences with the meaningful word.
6. **Decision cost grows with choices (Hick).** One primary action per view. Progressive
   disclosure for the rest. Defaults for the common case.
7. **Targets: bigger and closer are faster (Fitts).** Primary actions large and near where the
   eye/thumb already is; destructive actions small and away from the primary.
8. **Familiarity (Jakob).** Users spend most of their time in other products. Use conventions
   (search top, logo home, tables sort by header click, swipe/kebab for row actions) unless you have
   evidence a change is better.
9. **Speed is perceived as quality.** Under 0.1 s feels instant, under 1 s keeps flow, over 10 s
   loses attention. Show feedback within 100 ms, a skeleton for anything over ~1 s, progress for
   anything over ~10 s; prefer optimistic updates with undo for safe actions.
10. **Emotion and memory.** People judge an experience by its peak and its end; attractive and
    calm interfaces are perceived as easier (aesthetic-usability). Make success moments clear and
    failure recoverable. Never blame the user.
11. **Loss framing and defaults are powerful; use them honestly.** "₹2.4L blocked in 3 jobs" moves
    an owner more than "collection rate 71%". Never use dark patterns (fake urgency, pre-ticked consent,
    hard-to-find cancel); they also breach consumer and data-protection law.

## Procedure for any view
1. **Name the one question this view answers** for its primary user ("which jobs need me today?").
   If you can't, the view does too much: split it.
2. **Rank information**: the answer (level 1), the context to act on it (level 2), everything else
   (level 3, behind a click). Assign visual weight in that order: size → weight → colour → position.
3. **One primary action.** Verb + object ("Approve invoice"), visually dominant, placed at the end of
   the scan path. Secondary actions quieter. Destructive actions separated and confirmed (or undoable).
4. **Chunk and group** with spacing first, then dividers or cards only if spacing isn't enough.
5. **Design every state**: loading, empty (why empty + the one action to fix it), partial, error
   (what happened, why, what to do, keep their input), success, no permission, offline, stale data.
6. **Write the words last but seriously**: plain language, the user's terms not ours, numbers as
   digits, units always shown, labels ≤ 3 words, sentences front-loaded.
7. **Test before shipping**:
   - *5-second test*: show it for 5 s; can someone say what it's for and what to do first?
   - *Squint test*: blur it; is the most important element still the most visible?
   - *Thumb test* (mobile): can the main action be done one-handed?
   - *Colour-off test*: grayscale it; is every status still distinguishable (icon/label/position)?
   - *Stranger test*: would a new employee understand every label without asking?

## Non-negotiables
- Contrast WCAG 2.2 AA (text 4.5:1, large text and UI parts 3:1); visible focus; full keyboard use.
- Colour never carries meaning alone. Pair with icon, text or position.
- Touch targets ≥ 44×44 px on mobile (WCAG 2.2 floor is 24×24 px). Spacing between adjacent targets.
- Respect reduced motion. Motion only to explain change (where did it go, what's new), never to decorate.
- Text: 16 px base on mobile, line length ~45–75 characters, sufficient line height (~1.5 body).
- Numbers people compare: tabular figures, right-aligned, same precision, units in the header.
- Every number shows its timeframe and, when it matters, its source and freshness.

## Output when designing or reviewing
For each view: the question it answers · hierarchy (L1/L2/L3) · primary action · states covered ·
test results (5-second, squint, colour-off) · issues ranked blocker/should/nit with the specific fix.
