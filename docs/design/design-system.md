# GX design system

Status: Proposed. Source of truth for how every screen looks and behaves. Tokens live in `design/tokens.css`, components in `design/components.css`, and a living reference in `design/reference/index.html` (open it in a browser; toggle light and dark; every menu is live).

The target is a dense, calm, professional business application in the Salesforce Lightning mould: one global header, a left navigation rail, object tabs, list views with real toolbars, record pages, a utility bar. It is not a marketing site and it is not a card-per-metric toy dashboard.

## 1. Principles

1. **Dense, not cramped.** 13px body, 28px controls, 32px table rows, 8px gaps. A screen shows the work, not the whitespace.
2. **No dead space.** Every row of a grid is filled and every card in a row is the same height with content that earns it. If a card is short, it gets more useful content, not padding.
3. **One primary action per view.** It is orange, top right of the page header. Everything else is secondary or ghost.
4. **Predictable placement.** The same action is in the same place on every screen (section 6).
5. **The server decides.** The UI hides what you cannot do and says why when it disables; it never is the access control.
6. **Both themes are first class.** Light and dark are designed together, tested together, and ship together.
7. **Tokens only.** No raw hex, no magic pixel values in components.

## 2. Color

Brand: **midnight blue `#0A0F1E`** and **action orange `#F4600C`**.

### The 80/20 budget

- **80% midnight family.** Canvas, chrome (header and rail), surfaces, text, borders, links, selection and every chart series except one.
- **20% orange, as a ceiling.** Working target is 5 to 10%. It appears only in the places below.

Orange is allowed on:

| Use | Example |
| --- | --- |
| The primary button, one per view | New quote |
| The active-navigation marker | rail item bar, active tab underline |
| The single highlighted KPI or series | Collections tile, the Quote bar |
| "Needs you today" counts | overdue invoices count |
| An attention banner | invoices overdue more than 30 days |
| Capacity or limit reached | owner at 8 of 8 |

Orange is **not** allowed on: body text, links (links are blue), borders of ordinary controls, decorative gradients, more than one series in a chart, status "warning" (that is amber), or two primary buttons in one view.

Measure it, do not eyeball it: `python3 design/tools/colorbudget.py shot.png` reports orange as a share of brand-hued pixels and fails above 20. On the reference dashboard it reads about 3% light, 1% dark.

### Contrast rules (WCAG 2.2 AA)

- Text on an **orange fill is midnight** (5.9:1). White on orange is 3.2:1 and is banned.
- Orange as **text or icon on a light surface** uses `--accent-text` (darker), never `--accent`.
- Control edges need 3:1 (`--border-strong`). Decorative dividers use `--border`.
- Status colors always travel with an icon or a word. Color is never the only signal.
- `python3 design/tools/contrast.py` audits every pair in both themes and exits 1 on a failure. It runs in CI.

### Themes

- **Light:** midnight chrome (header and rail), blue-tinted canvas `#EEF1F7`, white surfaces.
- **Dark:** midnight canvas `#0A0F1E`, surfaces step up in lightness (`#111833`, `#172043`), chrome is darker than the canvas. Elevation is a border, not a shadow.
- The theme is `data-theme` on `<html>`: `light`, `dark`, or absent to follow the OS. The user's choice is stored per browser and, once signed in, in their profile.
- Dark is not an inverted light theme. Orange, the status hues and chart series are re-tuned in `tokens.css`.

### Tenant branding

A tenant may change: logo, product name, and the accent fill. A tenant may **not** change text colors, surface colors or status colors, and the accent they pick is rejected unless midnight text on it still passes 4.5:1 and it differs from the danger hue. The check is the same `contrast.py` logic, run at save time (task UI-T08).

## 3. Typography

- **UI:** DM Sans. **Page titles only:** Syne 700 at 20px. Syne is a display face; it is never used in tables, forms or menus.
- Scale: 11 badges and axis labels, 12 helper text and menus, 13 body and controls, 15 card and section titles, 20 page title, 22 KPI value.
- Numerals are tabular everywhere (`font-variant-numeric: tabular-nums`) and right aligned in tables.
- Currency is shown in the tenant's format (₹ with lakh and crore grouping for India). Never format money by string concatenation; use the shared formatter.

## 4. Space and density

4px grid. Gap between cards 8px. Card padding 12px. Card header 36px. Control heights 24, 28 (default), 32. Table row 32px, compact 26px. Page header 52px, tab bar 36px, global header 44px, utility bar 28px. A **density toggle** (comfortable, compact) is a user preference, not a per-screen decision.

## 5. Layout

### Shell anatomy

```
+------------------------------------------------------------------+
| Global header 44: panel, logo, search (center), create, AI, bell, |
|                   help, theme, account menu                       |
+-----------+------------------------------------------------------+
| Rail 208  | Tab bar 36  (object or section tabs, More menu)       |
| (48 when  | Page header 52 (breadcrumb, title, meta, actions)     |
| collapsed)| Content: 12-column grid, 8px gaps, fills the width    |
| pinned    |                                                       |
| views,    |                                                       |
| tenant    |                                                       |
+-----------+------------------------------------------------------+
| Utility bar 28: notes, history, tenant, sync state, shortcuts     |
+------------------------------------------------------------------+
```

- The rail groups by business area, shows counts, pins saved views, and carries tenant and data-residency status at the bottom. Below 1100px it collapses to icons; below 720px it becomes a menu.
- The content width is fluid. There is no centered max-width column.
- Design target 1440x900, supported down to 1280. Tablet is supported. Phone gets list and record views, not the full dashboard.

### Page templates

| Template | Structure |
| --- | --- |
| Dashboard | KPI strip (6 tiles at span 2) then rows of cards that sum to 12 columns, equal heights |
| List view | Toolbar (view switcher, filter chips, filter button, count, columns, export), optional bulk bar, table, pager |
| Record page | Header with key facts, two-column body, related lists, activity side panel |
| Settings and forms | Two-column form grid, label above, sticky footer with Cancel and Save |

### No dead space

- Rows are built from spans that sum to 12. A short card shares a row with a taller one only if both are filled.
- Tables and lists are sized to their card: add rows or columns of real information, do not stretch padding.
- Empty states are compact and offer the next action.

## 6. Placement rules

| Action | Where |
| --- | --- |
| Primary create | Page header, right end (split button when there are variants) |
| Date range, view, scope switchers | Page header, left of the primary |
| Filters and list view | List toolbar, left |
| Bulk actions | Replace the toolbar when rows are selected |
| Row actions | Last column, an overflow menu. Destructive item last, in danger color, below a separator |
| Dialog actions | Footer, right aligned, Cancel before the action. Destructive is never the default focus |
| Form save | Sticky card footer, right |
| Theme, help, notifications, account | Global header, right |
| Navigation | Rail for areas, tab bar for views within an area |

## 7. Components

Reference: `design/reference/index.html`, Components view.

**Buttons.** Primary (orange, one per view), secondary (outline), ghost (toolbars, icon buttons), danger (outline), danger solid (confirm step only). Sizes 24, 28, 32. States: hover, active, focus ring, disabled (45%, with a reason where possible), busy (spinner, no double submit). Icon-only buttons always have an `aria-label`.

**Dropdown menus.** Action menu, single select (radio items, check on the chosen one), searchable list. Opens below the trigger, left aligned; `gx-menu--end` at the right edge. Keyboard: Enter or arrow opens, arrows move, Home and End jump, Esc closes and returns focus, Tab closes. Max height 320 with scroll; over 8 items add a search field. Items have a leading icon only when every item in the menu does. Use `role="menu"` with `menuitem`, `menuitemradio` or `menuitemcheckbox`.

**Forms.** Label above, 12px semibold muted. Required marked with an asterisk. Helper text below. Errors replace the helper, with an icon, and are announced (`aria-describedby`, `aria-invalid`). Two columns by default; one column on narrow screens. Validate on blur and on submit; never block typing.

**Tables.** Sticky header, 32px rows, tabular right-aligned numbers, truncation with a title, checkbox column, overflow menu column, status as a badge with icon or word, progress as a thin bar with a text alternative. Sorting is shown in the header and announced. Column chooser and export are in the toolbar. No horizontal scroll at 1440; at 1280 the first column truncates before anything scrolls.

**KPI tile.** Label, value, delta or status, optional sparkline. One tile per row of tiles may be the key tile (orange edge). The tile states what changed against what period.

**Badges and counts.** Status badges use the semantic palette and an icon. Counts are quiet by default; an orange count means "needs the owner today".

**Banners, toasts, modals.** Banner for persistent state, toast for confirmation with Undo, modal only for decisions that need focus. Modals trap focus, close on Esc, return focus to the trigger, and name the object in the title ("Archive this project?").

**Charts.** Token colors only. One highlighted series in orange at most. Every chart has a text alternative (a caption or a hidden table) and never relies on color alone. Axis labels 11px.

**Empty, loading, error, partial, no-permission.** Every data view designs all five. Skeletons match the final layout; spinners are for actions, not pages. "No permission" says which permission and who can grant it.

## 8. Accessibility

WCAG 2.2 AA. Visible focus ring on everything focusable (2px, offset 2). Full keyboard operation, logical tab order, skip link to main. Target size 24px minimum. Respect `prefers-reduced-motion` (tokens zero the transitions). Test with axe in CI plus a manual keyboard pass per template.

## 9. Secure UI rules

These are the front-end half of `docs/guidelines/security-guidelines.md`.

1. **UI is not access control.** Hide and disable for usability; the service layer authorizes every call. A hidden button is not a permission.
2. **No secrets or personal data in the bundle,** in `localStorage`, or in URLs. Keep the theme and density preference in storage; keep tokens in httpOnly cookies.
3. **No `innerHTML`, `dangerouslySetInnerHTML`, `eval`, `document.write`.** Render text as text. Rich text goes through an allow-list sanitizer.
4. **CSP-friendly.** No inline scripts, no inline event handlers, no inline `style` attributes in shipped components. `design/components.css` and `gx.js` satisfy `script-src 'self'; style-src 'self'` as written. (The reference page itself uses a few inline styles for layout demos; the shipped components do not.)
5. **Classified data is masked by default.** Show last four, a reveal control, and log the reveal as a sensitive read (K7-T06). Never put Aadhaar-like numbers or card data on screen at all.
6. **Confirm destructive and irreversible actions** with a named dialog; require step-up authentication for the actions a module marks sensitive.
7. **Session honesty.** Show idle-timeout warnings, handle 401 by returning to sign-in without losing unsaved work where possible, and never show another tenant's name or data in an error.
8. **Exports neutralise formula injection** (cells starting with `=`, `+`, `-`, `@`).
9. **Links to the outside** use `rel="noopener noreferrer"`; never put a customer identifier in a URL query.
10. **AI surfaces** label model output, never auto-submit it, and show what data the assistant can see (ADR-0005, CMP-30).

## 10. Governance

- Change tokens or rules here first, then `tokens.css`, then components, then the reference page, in one change.
- CI gates (task UI-T02, UI-T03): `contrast.py`, a lint that bans raw hex and inline styles outside `tokens.css` and the reference page, axe on the reference page in both themes, and a screenshot diff of the reference page in both themes.
- A new component needs: the rule here, the class in `components.css`, a live example in the reference page, keyboard behaviour, and an accessibility note.
- Framework bindings (React or otherwise) wrap these classes; they do not fork the look. The stack is fixed by ADR-0006 (React on Next.js); the CSS stays the contract and the React components wrap its classes.

## 11. Files

| File | Purpose |
| --- | --- |
| `design/tokens.css` | Color, type, space, density, motion, both themes |
| `design/components.css` | Shell, grid, cards, buttons, menus, forms, tables, badges, overlays |
| `design/gx.js` | Theme, menus, rail, tabs, row selection, modal. No inline handlers, no eval |
| `design/reference/` | The living reference page (dashboard and component catalogue) |
| `design/tools/contrast.py` | WCAG audit of tokens in both themes |
| `design/tools/colorbudget.py` | 80/20 measurement on a screenshot |
| `docs/plans/002-design-system/` | Tasks to turn this into a shipped, tested UI package |
