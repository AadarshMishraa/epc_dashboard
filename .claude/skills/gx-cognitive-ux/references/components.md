# Component rules (why each one exists is in SKILL.md)

## Buttons
- Label = verb + object: "Save draft", "Send quote". Never "OK", "Submit", "Click here".
- One primary per view or dialog. Secondary = outline/ghost. Tertiary = text link.
- Order follows platform convention; be consistent across the product. Primary at the end of the reading path.
- Destructive: red text or outline (not a big red filled button next to the primary), confirm with the object's name ("Delete job JB-104?") or offer undo.
- Loading: keep width, show spinner + "Saving…", disable to prevent double submit, re-enable on error.
- Disabled buttons must explain why (tooltip or helper text) or be hidden; a dead button with no reason is a trap.
- Size: ≥ 44 px tall on touch; icon-only buttons need an accessible name and a visible tooltip on desktop.

## Forms
- One column. Labels above fields (fast to scan, survives translation and long labels).
- Ask only what you need now; defer the rest. Each field costs completion rate.
- Group related fields under a heading; long forms become steps with a progress indicator and save-as-you-go.
- Correct input types (tel, email, number with inputmode, date picker), autofill attributes, sensible defaults.
- Mark the minority: if most fields are required, mark "(optional)" ones; never rely on a lone asterisk.
- Validate on blur, not on every keystroke; re-validate on change after an error. Errors next to the field, in text, saying how to fix ("Enter a 10-digit mobile number"), plus a summary at the top for long forms.
- Never clear the user's input on error. Preserve drafts across navigation.
- Placeholder is an example, never the label.
- Indian context: phone with +91 handling, PIN code → auto city/state, GSTIN/PAN format validation, ₹ with Indian grouping (12,34,567).

## Tables
- For comparing rows. Left-align text, right-align numbers, tabular figures, consistent decimals, units in the header.
- Sticky header and first column; sortable headers with visible sort direction (`aria-sort`).
- Default sort answers the view's question (most overdue first), not database order.
- Row actions: one visible primary action per row; the rest in an overflow menu.
- Density: comfortable default, compact option for power users. Zebra striping only if rows are wide and dense.
- Filters visible as chips with counts; "Clear all". Saved views for repeated questions.
- Empty, loading (skeleton rows), and "no results for filter" states are different messages.
- Bulk actions appear only when rows are selected, with the count ("3 selected").
- On mobile, a table becomes a list of cards showing the 2–3 most important columns, with drill-down.

## KPI / stat cards
- The number is the hero (large, tabular). Label above in plain words. Timeframe always.
- Comparison gives meaning: vs target, vs last period, with direction AND sign (▲ 12% vs last month). Decide whether up is good, and colour accordingly.
- Max 4–6 cards in a row; more is a report, not a dashboard.
- Every card is a door: clicking opens the filtered list behind the number.

## Status chips / badges
- Fixed vocabulary across the product (e.g. Overdue, At risk, On track, Waiting on third party, Done).
- Icon + text + colour; never colour alone. Short labels; same width family.
- Show duration where it matters ("Waiting on DISCOM · 23 days").

## Navigation
- ≤ 7 top-level items, ordered by frequency of use. Current location always visible.
- Names are nouns the user uses ("Jobs", "Payments"), not internal module names.
- Deep pages show breadcrumbs or a clear back target. Preserve filters and scroll position on back.
- Global search when there are more than ~50 records of anything.

## Modals, drawers, popovers
- Modal only for decisions that must block (confirm destructive action, resolve a conflict). Not for reading or long forms.
- Drawer for viewing/editing a record without losing the list context.
- Esc closes, focus is trapped inside and returned on close, title says what it is.

## Notifications and alerts
- Every notification answers: what happened, does it need me, what's the one action. Link straight to it.
- Batch low-urgency items into a digest; real-time only for things that lose value if delayed.
- Respect quiet hours; let users choose channels. Track and kill notifications nobody acts on.
- Inline alerts: persistent for unresolved problems, toasts only for confirmations (with undo), never for errors that need action.

## Empty states
- Say why it's empty and what to do: "No jobs yet. Import your sheet or add your first job." One primary button.
- First-run empty states can show sample data, clearly labelled, removable.
- "No results" after a filter suggests clearing or changing the filter.

## Loading and feedback
- Respond within 100 ms (pressed state). Skeletons matching the final layout for > ~1 s. Progress with steps for long jobs (imports), and let the user leave and get notified.
- Optimistic update for safe, reversible actions; reconcile and show an error with retry if the server disagrees.

## Errors
- Human sentence: what happened, why (if known), what to do. Keep their input. Offer retry or a path forward.
- Error codes go in a details area for support, not in the headline.
- Never blame ("You entered an invalid…"); describe ("This PIN code isn't recognised. Check the 6 digits.").

## Copy
- Plain words, the user's vocabulary, active voice, front-loaded. Sentence case.
- Numbers as digits; dates unambiguous (30 Oct 2026, not 10/30); relative time with exact time on hover.
- Consistent terms: one name per concept across UI, docs and code.
- Bilingual: design for 30–40% text expansion; don't put text in images; keep icons paired with text.

## Icons
- Familiar icons for familiar actions only (search, settings, delete, edit, close). Everything else gets a text label.
- Same icon = same meaning everywhere.
