---
name: gx-product-introspect
description: Find what is missing in plain sight before and after building - real-world usage, hurdles, failure modes, operational needs, and improvements that make the product better. Use before planning a significant feature, after a feature is built, before a release or demo, and when the user asks what we are missing or how to make it better.
---

# Product introspection: what's hidden in plain sight

Software usually works in the demo and fails in the field because nobody walked through a real day.
This skill makes that walk explicit and produces a ranked list of gaps.

## Modes
- **Quick** (small feature, ~10 min): steps 1, 3, 4, 7.
- **Full** (new feature, module, release): all steps.

## 1. Cast and context
Name every human who touches this: primary user, their boss, the admin/support person, the new hire,
the customer of our customer, the auditor. For each: device, connectivity, time pressure, skill, and
what they used before (Excel, WhatsApp, paper). The old tool is the real competitor.

## 2. A day in the life (full mode)
Write the timeline of one realistic day using the feature: where they are, what triggers each use,
what they need to know at that moment, what interrupts them. Mark every moment they would leave our
product to do something elsewhere (call someone, open Excel, check WhatsApp, ask the accountant).
Each exit is a candidate feature or a missing integration.

## 3. Walk the journey and its edges
For the main flow, check each:
- **First use**: empty state, sample data, import from what they had, how long to first value.
- **Daily use**: number of taps for the most common action; can it be done one-handed on a phone?
- **Mistakes**: undo, edit after submit, delete with recovery, duplicate detection, wrong units/format.
- **Concurrency**: two people editing, stale screen, notifications for changes made by others.
- **Scale of their data**: 10 rows vs 10,000; search, filters, pagination, export.
- **Time**: deadlines, reminders, overdue states, time zones, end of month/quarter/financial year.
- **Money**: rounding, taxes, partial payments, refunds, credit notes, currency, Indian number format.
- **Permissions**: who must not see this (cost, margin, personal data); delegation when someone is on leave.
- **Offline/poor network**: what happens mid-action; is the user told?
- **Language and literacy**: Hindi/regional labels, icons with text, numbers over words.
- **Trust**: where did this number come from; last updated; audit trail of who changed what.
- **Leaving**: export everything; account deletion; data portability.

## 4. Pre-mortem
"It's six months later and customers stopped using this. Why?" Write 5 plausible reasons
(too slow to enter data, numbers didn't match their sheet, boss never saw value, notifications ignored,
one wrong figure destroyed trust…). Each reason → a mitigation.

## 5. Operator's view (full mode)
What will support be asked on day one? What does an admin need to fix a customer's mistake without a
developer (impersonation with audit, bulk edit, re-run import, resend notification)? What will we need
to measure to know it works (activation, weekly active, task completion, time-to-first-value)?

## 6. Compare to the best (full mode)
How do the best tools in this category handle the same job (look it up if needed)? What do users
praise or complain about in their reviews? What can we copy, and what's our reason to be different?

## 7. Output
Write the ranked list into the plan (or reply), and log the rest in `.claude/memory/IMPROVEMENTS.md`:

| # | Gap / suggestion | Who hits it, when | Evidence | Impact H/M/L | Effort S/M/L | Now / next / later |

Rank by impact on the user's core job first, then trust and data correctness, then effort.
Be specific ("show 'last imported 9:12am from Sheet1' above the table"), never generic ("improve UX").
Max 3 items go into the current scope unless the user asks for more; the rest are logged.

## Rules
- Evidence beats opinion: cite the code, a review, a support pattern, or the user's own words. Mark guesses as INFERRED.
- Don't gold-plate: a suggestion that doesn't serve the core job goes to "later".
- Revisit after shipping: compare what happened with the pre-mortem and update LEARNINGS.
