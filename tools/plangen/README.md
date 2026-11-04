# plangen

Catalogue and generator for the PRD, roadmap, status, task register and module briefs.

| File | What it holds |
|---|---|
| `tasks.psv`, `ui_tasks.psv` | Task id, title, needs, size, done-when, tests (foundation and design system) |
| `modules_a.py`, `modules_b.py` | Module contracts, capabilities and failure modes used in the briefs |
| `features.py` | Features, priority, tasks per feature, acceptance criteria, milestones |
| `project.py` | Goals, users, needs, non-functional requirements, scope, risks, decisions |
| `assign.py` | Agent roles, human gates, security levels, per-task threats, skills, rollback text |
| `gen.py` | The generator for the foundation and design system |
| `epc_project.py`, `epc_features.py`, `epc_tasks.psv` | EPC pack catalogue: goals, users, needs, features with acceptance criteria, milestones, tasks |
| `epc_gen.py` | Generator for `packs/epc/docs` (PRD, roadmap, status, register, briefs, foundation map, domain notes) |

```
python3 tools/plangen/gen.py plans          # task register, playbook, module briefs (ticked boxes are kept)
python3 tools/plangen/gen.py prd            # docs/prd source files; refuses once STATUS.md shows progress
python3 tools/plangen/gen.py prd --force    # overwrite anyway (loses STATUS edits)
python3 .claude/gx/bin/prdtool.py lint && python3 .claude/gx/bin/prdtool.py check
```

After the first build task starts, STATUS.md is edited by hand. Change scope through `docs/prd/changes/CR-xxx.md`, update `features.py` and rerun `plans`.

EPC pack: `python3 tools/plangen/epc_gen.py` (all) or `epc_gen.py prd`; check with `python3 .claude/gx/bin/prdtool.py lint --root packs/epc` and `check --root packs/epc`. STATUS.md for the pack is left alone once it shows progress.
