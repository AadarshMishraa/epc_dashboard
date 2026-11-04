#!/usr/bin/env python3
"""Generate the PRD, roadmap, status, task register and module briefs from the catalogue.

  python3 tools/plangen/gen.py plans     task register, playbook and module briefs (safe to rerun any time)
  python3 tools/plangen/gen.py prd       docs/prd source files (refuses once STATUS.md shows progress; use --force)
  python3 tools/plangen/gen.py all       both

Inputs live next to this file: features.py, project.py, assign.py, tasks.psv, ui_tasks.psv, modules_a.py, modules_b.py.
Progress is never stored in generated files except the task checkboxes in module briefs, so rerun with care:
briefs are rewritten with unticked boxes unless the task id is already ticked in the existing file (kept).
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import features as FT  # noqa: E402
import project as PJ  # noqa: E402
import assign as AS  # noqa: E402
import modules_a  # noqa: E402
import modules_b  # noqa: E402

MODS = {}
MODS.update(modules_a.M)
MODS.update(modules_b.M)
MODS["UI"] = dict(name="Design system", wave=0, pkg="design", needs="K0-T01 for bindings; K1-T09 and K7-T06 for two tasks",
                  purpose="Turn the reference design in design/ into a shipped, tested UI package with gates that keep it on brand and accessible.",
                  features=[], entities="none", ports_out="UI components and templates", ports_in="none", events="none", ext="Framework bindings", failure=[])

NAMES = {"K0": "core", "K1": "tenancy", "K2": "identity", "K3": "entitlements", "K4": "config", "K5": "workflow",
         "K6": "events", "K7": "audit-privacy", "K8": "files"}
PRI = {"Must": "Must", "Should": "Should", "Later": "Later"}


# ------------------------------------------------------------------ load
def load_tasks():
    tasks = {}
    for fn in ("tasks.psv", "ui_tasks.psv"):
        for ln in open(os.path.join(HERE, fn), encoding="utf-8"):
            if not ln.strip():
                continue
            c = [x.strip() for x in ln.rstrip("\n").split(" | ")]
            tid, title, needs, size, done, tests = c[:6]
            tasks[tid] = dict(id=tid, title=title, needs=[] if needs == "-" else [n.strip() for n in needs.split(",")],
                              size=size, done=done, tests=tests, mod=tid.split("-")[0])
    return tasks


def build():
    tasks = load_tasks()
    # sequential T ids: foundation by module then number, UI as T-9nn
    found = sorted([t for t in tasks if t.startswith("K")], key=lambda x: (int(x[1]), int(x.split("T")[1])))
    for i, t in enumerate(found, 1):
        tasks[t]["tno"] = "T-%03d" % i
    for t in tasks:
        if t.startswith("UI"):
            tasks[t]["tno"] = "T-9%02d" % int(t.split("T")[1])
    # features
    feats = {f["id"]: f for f in FT.F}
    owner = {}
    for f in FT.F:
        for t in f["tasks"]:
            if t not in tasks:
                raise SystemExit("feature %s lists unknown task %s" % (f["id"], t))
            if t in owner:
                raise SystemExit("task %s is in two features: %s and %s" % (t, owner[t], f["id"]))
            owner[t] = f["id"]
    missing = [t for t in tasks if t not in owner]
    if missing:
        raise SystemExit("tasks without a feature: %s" % ", ".join(missing))
    ms_of = {}
    for mid, _, fl, _ in FT.MILESTONES:
        for fid in fl:
            ms_of[fid] = mid
    for fid in feats:
        if fid not in ms_of:
            raise SystemExit("feature %s has no milestone" % fid)
    for t, d in tasks.items():
        d["feature"] = owner[t]
        d["milestone"] = ms_of[owner[t]]
        for n in d["needs"]:
            if n not in tasks:
                raise SystemExit("task %s needs unknown %s" % (t, n))
    # levels (topological)
    lvl = {}

    def level(t, stack=()):
        if t in lvl:
            return lvl[t]
        if t in stack:
            raise SystemExit("task dependency cycle: " + " -> ".join(stack + (t,)))
        v = 0 if not tasks[t]["needs"] else 1 + max(level(n, stack + (t,)) for n in tasks[t]["needs"])
        lvl[t] = v
        return v

    for t in tasks:
        tasks[t]["level"] = level(t)
    # feature dependencies from task needs
    for fid, f in feats.items():
        deps = set()
        for t in f["tasks"]:
            for n in tasks[t]["needs"]:
                if owner[n] != fid:
                    deps.add(owner[n])
        f["deps"] = sorted(deps)
    for fid, f in feats.items():
        for d in f["deps"]:
            if f["pri"] == "Must" and feats[d]["pri"] != "Must":
                print("warn: Must %s depends on %s %s" % (fid, feats[d]["pri"], d))
    return tasks, feats, found


def lane(t):
    m = t.split("-")[0]
    if m == "K7":
        return "k7a-audit" if int(t.split("T")[1]) <= 8 else "k7b-privacy"
    if m == "UI":
        return "design"
    return "core" if m == "K0" else MODS[m]["pkg"]


def w(path, text):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(text if text.endswith("\n") else text + "\n")
    print("wrote", path)


# ------------------------------------------------------------------ PRD
def write_prd(tasks, feats, status=True):
    n_must = sum(1 for f in feats.values() if f["pri"] == "Must")
    n_acs = sum(len(f["acs"]) for f in feats.values())
    w("docs/prd/brand/brand.json", """{
  "name": "GarunaCDX",
  "note": "Design tokens live in design/tokens.css (single source). Do not run brandtokens.py: it would create a second token source.",
  "colors": {
    "primary": "#F4600C",
    "background": "#EEF1F7",
    "foreground": "#0A0F1E",
    "secondary": "#E6EAF2",
    "accent": "#2F4BB8"
  },
  "fonts": { "heading": "Syne", "body": "DM Sans", "mono": "ui-monospace" },
  "radius": "4px"
}
""")
    w("docs/prd/00-project-card.md", """# Project card

| Field | Value |
|---|---|
| Project | GX Foundation Kernel (layer L0) and design system |
| Client / sponsor | GarunaCDX (internal product), sponsor Aadarsh Mishra |
| Industry and sub-segment | Horizontal kernel; first vertical is a solar EPC and distributor owner dashboard |
| Country and regions served | India first (Navi Mumbai base); region and data residency are tenant settings |
| Compliance regime (initial guess) | DPDP Act 2023 and Rules, CERT-In incident reporting, GST for the EPC pack; see docs/compliance |
| Platforms | Web (responsive); AI clients through an MCP gateway; native apps out of scope |
| Tech stack (given or preferred) | Open until ADR-0006; PostgreSQL fixed by ADR-0002 |
| Scale expected at launch and in 12 months | Design targets only: tens of tenants at launch, 1,000 tenants in 12 months (NF-08) |
| Contested inventory (bookings, slots, stock)? | No in the foundation; the EPC pack may have stock |
| Integrations and account owners | Identity providers (OIDC), message senders, object storage; adapters chosen per ADR; accounts owned by Aadarsh |
| Existing systems and data to migrate | None for the foundation |
| Deadline and why it is fixed | None fixed; waves close at gates, not dates |
| Budget range | Not set |
| Team and roles | Aadarsh (decisions, acceptance); agents gx-implementer, gx-qa-engineer, gx-security-reviewer, gx-staff-reviewer, gx-ux-reviewer, gx-planner |
| Decision makers and approvers | Aadarsh Mishra |
""")
    out = ["""---
project: GX Foundation Kernel
client: GarunaCDX
version: 0.1-draft
status: draft
owner: Aadarsh Mishra
approvers: [Aadarsh Mishra]
---

# 1. Objective
Problem (3 sentences max): Each new business application rebuilds sign-in, tenancy, permissions, audit and privacy handling, and each rebuild risks a data leak between customers. Industry products cannot be sold as subscriptions or custom builds quickly while that base is repeated. The foundation is built once, proven isolated, and reused by every vertical.
Why now: The solar EPC owner dashboard is the first vertical and the architecture decisions (ADR-0001 to ADR-0005) are proposed and waiting on a stack decision.
""", "| ID | Goal | Metric | Baseline | Target | By when |", "|----|------|--------|----------|--------|---------|"]
    for g in PJ.GOALS:
        out.append("| " + " | ".join(g) + " |")
    out += ["", "# 2. Users", "| ID | Role | Who they are | Device / language / tech comfort | How they do it today | Biggest pain | Primary? |",
            "|----|------|--------------|----------------------------------|----------------------|--------------|----------|"]
    for u in PJ.USERS:
        out.append("| " + " | ".join(u) + " |")
    out += ["", "Buyer / payer: Tenant owners pay a subscription or a custom build fee; Aadarsh funds the foundation.", "",
            "# 3. Needs", "| ID | As (U-xx) I need | so that | Serves | Priority |", "|----|------------------|---------|--------|----------|"]
    for n in PJ.NEEDS:
        out.append("| " + " | ".join(n) + " |")
    out += ["", "# 4. Features", "| ID | Feature | One line | Serves | Priority | Depends on |", "|----|---------|----------|--------|----------|------------|"]
    for f in feats.values():
        out.append("| %s | %s | %s | %s | %s | %s |" % (f["id"], f["name"], f["line"], ", ".join(f["needs"]), f["pri"], ", ".join(f["deps"]) or "-"))
    out += ["", "Acceptance criteria (at least 3 per Must feature, Given / When / Then, with a number in the result):"]
    for f in feats.values():
        for i, (g, wh, th) in enumerate(f["acs"], 1):
            out.append("%s-AC%d Given %s When %s Then %s" % (f["id"], i, g, wh, th))
        if f["acs"]:
            out.append("")
    out += ["# 5. Non-functional requirements", "| ID | Area | Requirement | How verified |", "|----|------|-------------|--------------|"]
    for r in PJ.NFS:
        out.append("| " + " | ".join(r) + " |")
    out += ["", """# 6. Constraints
Industry and country: Horizontal foundation; India privacy and incident rules shape the privacy desk (docs/compliance).
Integrations: Identity provider, message sender and object storage are ports with adapters; the owner of every external account is Aadarsh.
Tech mandates: PostgreSQL with row-level security (ADR-0002); modular monolith (ADR-0001); no vertical words in foundation packages.
Existing systems and data to migrate: None.
Budget: Not set.
Deadline: None fixed; each wave closes at its gate.
Team: Aadarsh decides and accepts; agents build and review under docs/plans/README.md.
""", "# 7. Out of scope", "| ID | Not building | Why | Revisit |", "|----|--------------|-----|---------|"]
    for r in PJ.OUT_OF_SCOPE:
        out.append("| " + " | ".join(r) + " |")
    out += ["", "# 8. Assumptions and risks", "| ID | Assumption or risk | Likelihood | Impact | Mitigation | Owner |", "|----|--------------------|-----------|--------|------------|-------|"]
    for r in PJ.RISKS:
        out.append("| " + " | ".join(r) + " |")
    out += ["", """# 9. Success and launch criteria
Success (90 days after the first vertical goes live on the foundation): G-02 holds with 0 cross-tenant incidents, G-03 is met on 2 real features, and no foundation file was edited for the vertical (G-01).
Launch gate: All Must features pass their acceptance criteria on staging; the extraction drill passes; 0 open Critical or High security findings; the data-request drill completes 20 of 20 seeded requests; Aadarsh signs off.
""", """# 10. Brand
Guide: docs/prd/brand/ and docs/design/design-system.md
Tone of voice: precise, calm, businesslike
References: Salesforce Lightning density and structure; a quiet enterprise tone with one orange action per view
""", "# 11. Open questions and decisions", "| ID | Question | Owner | Needed by | Answer |", "|----|----------|-------|-----------|--------|"]
    for q in PJ.DECISIONS:
        out.append("| %s | %s | %s | %s | %s |" % q)
    out += ["", """# 12. Sign-off
Baseline v1.0 approved by: pending (Aadarsh Mishra)
Later changes only via docs/prd/changes/CR-xxx.md
"""]
    w("docs/prd/01-prd.md", "\n".join(out))

    # roadmap
    rm = ["# Roadmap", "",
          "Dates stay TBD until the feature analysis has sized every feature (S, M, L). A phase closes at its gate, not on a date.",
          "This roadmap covers the foundation and design system only. The EPC pack has its own PRD in packs/epc/docs/prd and enters at its P2.", "",
          "## Phases and gates", "| Phase | Name | Gate | Gate criteria | Target date |", "|-------|------|------|---------------|-------------|",
          "| P0 | Discovery | Gate 0 | PRD v1.0 signed; decisions Q-01 to Q-03 answered; feature analysis reviewed; roadmap approved | TBD |",
          "| P1 | Foundation | Gate 1 | Milestones M-01 to M-08 demonstrated; extraction drill passes with 0 foundation edits; 0 open Critical or High findings | TBD |",
          "| P2 | Vertical build | Gate 2 | First vertical pack passes its Must criteria on the foundation (tracked in the vertical PRD) | TBD |",
          "| P3 | Harden | Gate 3 | Load, security, accessibility and privacy drills pass; migration rehearsed; rollback written | TBD |",
          "| P4 | Launch | Gate 4 | Two weeks live with no severity-1 issue; support runbook handed over | TBD |",
          "| P5 | Operate | - | Continuous improvement under change control | - |", "",
          "## Milestones", "A milestone is an outcome Aadarsh can verify, one demoable every 1 to 2 weeks of build.", "",
          "| ID | Outcome the client can verify | Features | Date | Phase | Demo script (5 steps max) |",
          "|----|-------------------------------|----------|------|-------|----------------------------|"]
    for mid, outcome, fl, demo in FT.MILESTONES:
        rm.append("| %s | %s | %s | TBD | P1 | %s |" % (mid, outcome, ", ".join(fl), demo))
    w("docs/prd/02-roadmap.md", "\n".join(rm))

    if not status:
        return
    # status
    st = ["# STATUS (updated 2026-11-04 by session 1)",
          "Release target: foundation v1.0 (date TBD)   Current phase: P1 Foundation   Overall: AMBER", "",
          "AMBER because wave 0 cannot start until Q-01 and Q-02 are answered (owner Aadarsh, no date set yet).", "",
          "States are a closed set: Not started, In progress, In review, Blocked, Done, Deferred. No percentages.",
          'RAG: GREEN on date and unblocked; AMBER slip of 3 working days or less, or a blocker with an owner and a fix date; RED slip over 3 working days or blocked with no fix date.',
          'Done for a feature means every acceptance criterion passes on staging ("N of N pass"). Done for a milestone needs evidence.', "",
          "## Milestones", "| ID | Outcome the client can verify | Features | Date | State | RAG | Evidence |", "|----|-------------------------------|----------|------|-------|-----|----------|"]
    for mid, outcome, fl, demo in FT.MILESTONES:
        st.append("| %s | %s | %s | TBD | Not started | %s | - |" % (mid, outcome, ", ".join(fl), "AMBER" if mid == "M-01" else "GREEN"))
    st += ["", "## Features", "| ID | Name | Priority | Milestone | State | Acceptance | Tests | PR |", "|----|------|----------|-----------|-------|-----------|-------|----|"]
    ms_of = {fid: mid for mid, _, fl, _ in FT.MILESTONES for fid in fl}
    for f in feats.values():
        acc = "0 of %d pass" % len(f["acs"]) if f["acs"] else "-"
        st.append("| %s | %s | %s | %s | Not started | %s | - | - |" % (f["id"], f["name"], f["pri"], ms_of[f["id"]], acc))
    st += ["", "## Tasks (current milestone only)", "| ID | Feature | Task | State | Blocked by |", "|----|---------|------|-------|-----------|"]
    for tid, d in sorted(tasks.items(), key=lambda kv: kv[1]["tno"]):
        if d["milestone"] != "M-01":
            continue
        blocked = ", ".join(tasks[n]["tno"] for n in d["needs"]) or ("Q-01" if tid == "K0-T01" else "-")
        st.append("| %s | %s | %s %s | Not started | %s |" % (d["tno"], d["feature"], tid, d["title"].split(":")[0], blocked))
    st += ["", "## Decisions needed from the client", "| ID | Decision | Needed by | Impact if late |", "|----|----------|-----------|----------------|"]
    impact = {"Q-01": "Nothing starts", "Q-02": "Workspace layout blocked", "Q-03": "Wave 0 starts on unaccepted ADRs",
              "Q-04": "Rule of two cannot be proven at the wave 3 drill", "Q-05": "AI connectors blocked",
              "Q-06": "Workflow engine blocked", "Q-07": "Licence task blocked", "Q-08": "Component bindings blocked"}
    for i, q in enumerate(PJ.DECISIONS, 1):
        if q[4].startswith(("Decided", "Deferred")):
            continue
        st.append("| D-%02d | %s | %s | %s |" % (i, q[1], q[3], impact[q[0]]))
    w("docs/prd/STATUS.md", "\n".join(st))


# ------------------------------------------------------------------ plans
def agent_line(t, d):
    tid = d["id"]
    build = "Aadarsh decides, then gx-implementer" if tid in AS.HUMAN_GATES else "gx-implementer"
    qa = "gx-qa-engineer" if AS.qa_needed(d["tests"], tid) else "-"
    rv = ", ".join(AS.reviewers(tid, d["size"])) or "module gate"
    return build, qa, rv


def render_task(d, tasks, ticked):
    tid = d["id"]
    build, qa, rv = agent_line(tid, d)
    box = "x" if tid in ticked else " "
    needs = ", ".join("%s (%s)" % (n, tasks[n]["tno"]) for n in d["needs"]) or "none"
    lvl = AS.sec_level(tid)
    o = ["- [%s] **%s** (%s) %s (%s)" % (box, tid, d["tno"], d["title"], d["size"]),
         "  - Feature: %s | Milestone: %s | Level: %d | Lane: %s" % (d["feature"], d["milestone"], d["level"], lane(tid)),
         "  - Needs: %s" % needs,
         "  - Agents: build %s | tests %s | review %s" % (build, qa, rv),
         "  - Skills: %s" % ", ".join(AS.skills_for(tid, d["title"], d["tests"])),
         "  - Security: %s. %s" % (lvl, AS.SEC_TASK.get(tid, "Module security baseline applies.")),
         "  - Done when: %s" % d["done"],
         "  - Tests: %s" % d["tests"],
         "  - Rollback: %s" % AS.rollback(tid, d["title"])]
    if tid in AS.HUMAN_GATES:
        o.append("  - Human gate: %s" % AS.HUMAN_GATES[tid])
    return o


def ticked_ids(path):
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        return set()
    return set(re.findall(r"- \[x\] \*\*([A-Z0-9]+-T\d+)\*\*", open(full, encoding="utf-8").read()))


def write_brief(k, tasks, feats, path, intro_links=True):
    m = MODS[k]
    ts = [d for d in sorted(tasks.values(), key=lambda x: x["tno"]) if d["mod"] == k]
    fl = []
    for d in ts:
        if d["feature"] not in fl:
            fl.append(d["feature"])
    ticked = ticked_ids(path)
    o = ["# %s %s\n" % (k, m["name"]), "%s\n" % m["purpose"],
         "- **Wave:** %s\n- **Package:** `%s`\n- **Needs:** %s\n- **Tasks:** %d\n" % (m["wave"], m["pkg"], m["needs"], len(ts)),
         "Status: tick a task when its done-when and tests pass and the definition of done in %s holds. Scope and acceptance live in [the PRD](../../prd/01-prd.md); the execution rules are in [the playbook](../README.md).\n" % ("[README](README.md)" if k != "UI" else "[the design system](../../design/design-system.md)")]
    if k != "UI":
        o += ["## Contract\n",
              "- **Data:** %s\n- **Offers:** %s\n- **Uses:** %s\n- **Events:** %s\n- **Extension points:** %s\n" % (m["entities"], m["ports_out"], m["ports_in"], m["events"], m["ext"])]
    o += ["## Features delivered\n"]
    for fid in fl:
        f = feats[fid]
        o.append("- **%s** %s (%s, %d acceptance criteria)" % (fid, f["name"], f["pri"], len(f["acs"])))
    if m["features"]:
        o.append("\n### Capabilities\n")
        for f, p in m["features"]:
            o.append("- [%s] %s" % (p, f))
    if m["failure"]:
        o.append("\n### Failure modes and guards\n")
        for a, b in m["failure"]:
            o.append("- **%s:** %s" % (a, b))
    o.append("\n## Security baseline for this module\n")
    o.append("Applies to every task below, on top of [the security guidelines](../../guidelines/security-guidelines.md).\n")
    for s in AS.SEC_MODULE[k]:
        o.append("- %s" % s)
    o.append("\n## Tasks\n")
    for d in ts:
        o += render_task(d, tasks, ticked)
    w(path, "\n".join(o))


def write_register(tasks, feats):
    ms_name = {mid: o for mid, o, _, _ in FT.MILESTONES}
    rows = ["# Task register", "",
            "Generated by `python3 tools/plangen/gen.py plans`. Do not edit by hand; change the catalogue in tools/plangen and rerun.",
            "State is tracked in the module briefs (checkboxes) and in docs/prd/STATUS.md (current milestone). This file is the work queue.", "",
            "Level is the dependency depth: tasks at the same level with no shared lane can run in parallel. Lane is the package; one agent works in a lane at a time.", "",
            "| T | Plan id | Task | Feature | Milestone | Size | Needs | Level | Lane | Build | Tests | Review | Sec |",
            "|---|---------|------|---------|-----------|------|-------|-------|------|-------|-------|--------|-----|"]
    for tid, d in sorted(tasks.items(), key=lambda kv: kv[1]["tno"]):
        b, q, r = agent_line(tid, d)
        rows.append("| %s | %s | %s | %s | %s | %s | %s | %d | %s | %s | %s | %s | %s |" % (
            d["tno"], tid, d["title"].split(":")[0], d["feature"], d["milestone"], d["size"],
            ", ".join(d["needs"]) or "-", d["level"], lane(tid), b, q, r, AS.sec_level(tid)))
    w("docs/plans/TASKS.md", "\n".join(rows))


PLAYBOOK = """# Plans and agent playbook

How work is planned, assigned and executed. The EPC pack plan is in [packs/epc/docs/plans/README.md](../../packs/epc/docs/plans/README.md). Scope and acceptance criteria are in [docs/prd/01-prd.md](../prd/01-prd.md); the full work queue is [TASKS.md](TASKS.md); per-module briefs are in [001-foundation](001-foundation/README.md) and [002-design-system](002-design-system/README.md).

## Numbers

%(counts)s

## The chain

Goal (G) to need (N) to feature (F) to milestone (M) to task. A task is the unit an agent executes: one working session, size S or M, one lane, one branch, one pull request. No work without an F id (gx-delivery-pipeline).

## Roles

| Role | Agent | Does |
|---|---|---|
| Decider | Aadarsh | Answers the decisions, accepts ADRs, accepts features at gates |
| Planner | gx-planner | Drafts ADRs and options for human-gated tasks; splits a task that is too big |
| Builder | gx-implementer | Builds one task from its brief, test first, inside one lane |
| Tests | gx-qa-engineer | Writes the negative, property, chaos, contract and matrix tests named in the brief |
| Security | gx-security-reviewer | Threat-models S3 tasks before build; blocks merge on S3; reviews S2 at the module gate |
| Staff review | gx-staff-reviewer | Reviews every M task for design, boundaries and public API |
| UX review | gx-ux-reviewer | Reviews every UI task against docs/design/design-system.md |
| Analyst | gx-analyst | Writes the sourced feature analysis for each Must feature before its first task starts |
| Map | gx-cartographer | Refreshes the code map at the end of each wave |

## Ready, then done

A task is **ready** when: its needs are merged, the decision gates it names are answered, its feature has an analysis file (Must features), and an S3 task has a threat model written by gx-security-reviewer in the task branch or pull request description.

A task is **done** when: the done-when and tests in its brief pass; the definition of done in [001-foundation/README.md](001-foundation/README.md) holds; the reviewers named in the brief approved; security findings of Critical or High are closed; the box is ticked in the brief; and STATUS is updated if the task is in the current milestone.

## Parallel work

- Work in lanes: one agent per package at a time. Different lanes run in parallel in separate worktrees.
- Level is the depth in the dependency graph. Start the lowest-level ready tasks first; every task at a level can start once its own needs are merged.
- Shared files (the workspace manifest, the module registry and migrations ledger) change in small, separate pull requests merged quickly to avoid conflicts.
- Wave 4 has three lanes (K2, K3, K5): run them as three agents.

## Start prompt for a build agent

```
You are gx-implementer. Execute task <PLAN-ID> (<T-ID>) from docs/plans/<module brief>.
1. Read the brief entry, its feature and acceptance criteria in docs/prd/01-prd.md, the module brief header, docs/guidelines/development-guidelines.md and docs/guidelines/security-guidelines.md.
2. Confirm every need is merged and every human gate is answered. If not, stop and report what is missing.
3. Create branch feat/<PLAN-ID>. Write the failing tests first, then the code, inside your lane only.
4. Satisfy the security line of the brief and the module security baseline. S3: do not start until the threat model exists.
5. Run the checks in the definition of done. Tick the box. Open a pull request titled feat(<PLAN-ID>): <summary> and list reviewers from the brief.
6. If the task needs a change outside your lane or to a public API, stop and ask instead of widening scope. Never edit generated files by hand.
```

## Start prompt for a review agent

```
You are <gx-staff-reviewer | gx-security-reviewer | gx-ux-reviewer>. Review the pull request for <PLAN-ID>.
Check the done-when, tests, definition of done and the security line of the brief. For S3 verify the threat model rows have controls and tests.
Report findings as Critical, High, Medium or Low with file and line. Approve only when no Critical or High remains.
```

## Escalate to Aadarsh when

A decision gate is open; a task needs a public-API change that breaks a consumer; a Critical or High finding cannot be closed in the task; the estimate doubles; or two agents need the same file.

## Change control

New scope is a change request in docs/prd/changes/ with a new or changed F id. Task and feature catalogues change in tools/plangen, then `python3 tools/plangen/gen.py plans` regenerates the register and briefs (ticked boxes are kept) and `python3 .claude/gx/bin/prdtool.py lint` and `check` must stay clean.
"""

APPEND_MARK = ("<!-- gen:agent-exec -->", "<!-- /gen:agent-exec -->")


def write_playbook(tasks, feats):
    n_found = sum(1 for t in tasks if t.startswith("K"))
    n_ui = sum(1 for t in tasks if t.startswith("UI"))
    n_must = sum(1 for f in feats.values() if f["pri"] == "Must")
    n_should = sum(1 for f in feats.values() if f["pri"] == "Should")
    n_ac = sum(len(f["acs"]) for f in feats.values())
    n_s3 = sum(1 for t in tasks if AS.sec_level(t) == "S3")
    levels = max(d["level"] for d in tasks.values()) + 1
    counts = ("- %d features (%d Must, %d Should) with %d acceptance criteria\n- %d tasks: %d foundation and %d design system\n"
              "- %d tasks are security-critical (S3) and need a threat model and a blocking security review\n"
              "- %d dependency levels; lanes are packages\n- %d milestones" %
              (len(feats), n_must, n_should, n_ac, len(tasks), n_found, n_ui, n_s3, levels, len(FT.MILESTONES)))
    w("docs/plans/README.md", PLAYBOOK % dict(counts=counts))
    # append agent section to 001 README, idempotent
    p = os.path.join(ROOT, "docs/plans/001-foundation/README.md")
    text = open(p, encoding="utf-8").read()
    block = (APPEND_MARK[0] + "\n## Agent execution\n\n"
             "Tasks now carry feature, level, lane, agents, skills, security level, rollback and human gates. "
             "Execution rules, roles and start prompts are in [the playbook](../README.md); the full queue is [TASKS.md](../TASKS.md); "
             "scope and acceptance criteria are in [the PRD](../../prd/01-prd.md). The design system has its own plan: [002-design-system](../002-design-system/README.md).\n\n"
             "Human gates (an agent stops and asks): K2-T15 confirm the Supabase Auth checks in ADR-0006, K4-T06 custom-field storage ADR, K3-T09 licence and IP.\n" + APPEND_MARK[1] + "\n")
    if APPEND_MARK[0] in text:
        text = re.sub(re.escape(APPEND_MARK[0]) + r".*?" + re.escape(APPEND_MARK[1]) + r"\n?", block, text, flags=re.S)
    else:
        text = text.rstrip("\n") + "\n\n" + block
    open(p, "w", encoding="utf-8").write(text)
    print("updated docs/plans/001-foundation/README.md")


def write_plans(tasks, feats):
    for k in ["K0", "K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8"]:
        write_brief(k, tasks, feats, "docs/plans/001-foundation/%s-%s.md" % (k, NAMES[k]))
    write_brief("UI", tasks, feats, "docs/plans/002-design-system/README.md")
    write_register(tasks, feats)
    write_playbook(tasks, feats)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "plans"
    force = "--force" in sys.argv
    tasks, feats, _ = build()
    if mode == "prd-docs":
        write_prd(tasks, feats, status=False)
    if mode in ("prd", "all"):
        sp = os.path.join(ROOT, "docs/prd/STATUS.md")
        if os.path.exists(sp) and not force:
            txt = open(sp, encoding="utf-8").read()
            if re.search(r"\|\s*(In progress|In review|Blocked|Done|Deferred)\s*\|", txt):
                raise SystemExit("STATUS.md shows progress; refusing to overwrite. Use --force only if you mean it.")
        write_prd(tasks, feats)
    if mode in ("plans", "all"):
        write_plans(tasks, feats)


if __name__ == "__main__":
    main()
