# 2026-11-14 — go-to-market-deck-and-docs

## Goal
Give the marketing team a company profile, buyer personas, three role voices (owner or CEO, COO, CTO), a product feature document (technical design, capacity, AI connector, EPC features), and a diagram and mockup deck with a campaign, while the product is still in build.

## Done
- Deck (claude.ai artifact, 34 slides): https://claude.ai/artifact/EEwHLiSdpYTFvLwHRp5YBE . Market gaps, profile, committee, three voices, offer, two flows, seven mockup screens, architecture, AI sign-in, plug-in approach, capacity, message house, funnel, 12-week plan, channels, objections, guardrails, gap register, sources, ask. Speaker notes on every slide.
- Product Feature Document (doc): https://claude.ai/artifact/428kiaAMasSJGQaBikTCNk . Status, users, feature map, workflows, technical design (diagram), capacity, AI connector (sign-in diagram, tools, guardrails, phasing), security, integrations, gap register, roadmap, decisions and risks, sources.
- Go-to-Market Brief (doc): https://claude.ai/artifact/SqDrfq841oRLbWdyzQnQ9J . Company profile, committee, offer, positioning, three voices with draft copy and objections, interview script, campaign, claims guardrails with unlock evidence, content gaps, open questions, sources.
- Nothing in the repository changed except this log. The artifacts are private; sharing is the owner's call.

## Verified (command → result)
- Deck rendered locally with Playwright (scripts in the session scratchpad) and checked slide by slide; overlaps fixed. System fonts were used for the check, so line breaks may differ slightly with web fonts.
- Doc diagrams: widget render check passed (no overlaps) after one fix to the architecture diagram.
- Counts quoted (72 features, 40 Must, 22 Should, 10 Later, 170 criteria, 104 tasks, 8 of 119 foundation tasks) were taken from the repo on 2026-11-14.

## Not verified (and why)
- Every outside fact (market sizes, scheme clocks, rule dates, tax rule) comes from web search summaries; no primary page was opened. Sources are listed in each artifact with that caveat.
- The new gap leads (vendor standing, consumer wait, serial pre-check and others) are not in the build plan; they are in IMPROVEMENTS.md and the gap register.
- Mockups are illustrative with demo data; they are not built screens.

## Decisions made
- Mockups follow the product design system (midnight and one orange accent, DM Sans and Syne), scaled up for slide legibility.
- Guardrails: only design-level and planned claims; no price, no savings, no compliance or certification claims.

## Traps found
- A person edited five slides in the deck editor while I was publishing; the publish refused. Read, keep their edits, send only my other files.

## Next
- Owner: share the three artifacts with the team (private by default); confirm Q-01 (first two states) and Q-06 (pilot offer).
- Marketing: the five tasks on the last slide of the deck.
- Product: foundation work continues (K0-T06 test kit next); commit branch `feat/K0-T04` and the CR-001 files.

## Files touched
.claude/memory/sessions/2026-11-14-go-to-market-deck-and-docs.md
