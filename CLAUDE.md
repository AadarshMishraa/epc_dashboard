
<!-- gx-kit:start -->
@.claude/gx/GX-RULES.md
## GX kit (memory, code map, live system design)
- Session memory: `.claude/memory/` (start: CURRENT_STATE.md; protocol: skill `gx-project-memory`).
- Code map: `.claude/map/MAP.md`; `python3 .claude/gx/bin/codemap.py find <term>` / `impact <file>`.
- Plans: `docs/plans/`; decisions: `docs/adr/` and `.claude/memory/DECISIONS.md`.
- System design: `docs/architecture/system-design.md` (curated) + `.claude/map/system-design.html` (generated).
- Delivery tracking (when `docs/prd/` exists): read `docs/prd/STATUS.md` first, then the current milestone plan, then only the `features/F-xx` file for your task. Scope is `docs/prd/01-prd.md` (change it only via `changes/CR-xxx.md`). Update STATUS.md before you stop; `python3 .claude/gx/bin/prdtool.py check` must be clean. New project: skill `gx-project-bootstrap`.
- Compliance and privacy (DPDP, GST, messaging, payments): skill `epc-compliance-privacy`; rules `docs/compliance/register.md`; data map `docs/compliance/data-inventory.md`; check `python3 .claude/gx/bin/privacycheck.py`. Read before touching personal data, links, messages, invoices or payments.
- Project-specific skills in this repo take precedence over the universal `gx-*` skills where they overlap.
<!-- gx-kit:end -->

## Project standards
- Design system (colour 80/20, light and dark, dense layout, menus, placement): skill `epc-design-system`; `docs/design/design-system.md`; code in `design/`.
- Development rules: `docs/guidelines/development-guidelines.md`. Security rules: `docs/guidelines/security-guidelines.md`. Both bind every task.
- Product scope and tracking: `docs/prd/` (PRD, roadmap, STATUS). Work queue and agent playbook: `docs/plans/README.md` and `docs/plans/TASKS.md`; module briefs in `docs/plans/001-foundation/` and `docs/plans/002-design-system/`.
- EPC pack (the first vertical): `packs/epc/docs/prd/` (PRD, roadmap, STATUS), `packs/epc/docs/plans/README.md` (sequencing with the foundation waves) and `TASKS.md`, `packs/epc/docs/foundation-map.md`, `packs/epc/docs/domain-notes.md`. Pack code never edits foundation packages.
- Plan and PRD files are generated from `tools/plangen`; change the catalogue, then run `python3 tools/plangen/gen.py plans`.
