---
name: epc-design-system
description: Project design system for the EPC dashboard and every GX product: midnight blue and orange at an 80/20 budget, light and dark themes, dense Salesforce-style layout, menu, button and table rules, accessibility and secure-UI rules. Use before designing or building any screen, component, theme, chart, form, table, menu, dialog or tenant branding, and when reviewing UI work. Overrides generic frontend design guidance in this repo.
---

# EPC design system

Source of truth: `docs/design/design-system.md`. Code: `design/tokens.css`, `design/components.css`, `design/gx.js`. Living reference: `design/reference/index.html` (open it, toggle themes, operate the menus).

## Non-negotiables

1. **Tokens only.** Use CSS variables from `design/tokens.css`. No raw hex, no new pixel constants in components.
2. **80/20 colour.** Midnight-blue family is about 80% of brand-hued pixels. Orange (`--accent`) is at most 20% and normally 5 to 10%: one primary button per view, the active-navigation marker, one highlighted KPI or series, "needs you" counts, attention banners. Never orange body text, links, ordinary borders, gradients, or two primaries in a view.
3. **Text on orange is midnight** (`--on-accent`), never white. Orange text on light surfaces uses `--accent-text`.
4. **Both themes, always.** Check every change in light and dark. Use `data-theme`; do not hard-code a theme.
5. **Dense and gap-free.** 13px body, 28px controls, 32px rows, 8px gaps. Grid rows sum to 12 columns; cards in a row share height and are filled with useful content. No dead space, no centred narrow column.
6. **Placement is fixed.** Primary create top right of the page header; filters left in the list toolbar; row actions in the last column overflow menu with the destructive item last; dialog actions right with Cancel before the action; theme, help, notifications and account in the global header right.
7. **Menus are accessible.** `role="menu"` and `menuitem*`, `aria-expanded`, arrows, Home, End, Escape returns focus, Tab closes; over 8 items add search and scroll at 320px; use `gx-menu--end` at the right edge.
8. **Accessible.** WCAG 2.2 AA, visible focus ring, keyboard operation, 24px minimum targets, reduced motion respected, colour never the only signal.
9. **Secure UI.** No inline handlers or styles in shipped components, no `innerHTML` or `eval`, no secrets or personal data in browser storage or URLs, masked classified data with audited reveal, confirm destructive actions, the interface never replaces server authorization.

## Workflow

- Start from a template (dashboard, list, record, settings) and the reference page. Reuse classes in `components.css`; add a new component only with its rule in the design doc, a class, a live reference example and keyboard behaviour.
- Run the gates before review: `python3 design/tools/contrast.py` (0 failures) and, on a screenshot, `python3 design/tools/colorbudget.py <png>` (orange at most 20%).
- Tenant branding may change logo, product name and accent only, and the accent must keep 4.5:1 with midnight text and differ from the danger hue (task UI-T14).
- UI tasks live in `docs/plans/002-design-system/README.md` (T-901 to T-914) and are reviewed by gx-ux-reviewer.

## Review checklist

- One primary button; actions in the placement table positions.
- Orange only in the allowed uses; contrast audit clean in both themes.
- No blank cells, equal-height rows, no horizontal scroll at 1280px.
- Every menu and dialog operable by keyboard; focus returns correctly.
- Empty, loading, error, partial and no-permission states designed.
- Sensitive values masked; nothing sensitive in storage or URLs.
