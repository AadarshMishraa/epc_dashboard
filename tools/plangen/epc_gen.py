#!/usr/bin/env python3
"""Generate the EPC pack PRD, roadmap, status, task register, module briefs and foundation map.

  python3 tools/plangen/epc_gen.py            writes packs/epc/docs/** (briefs keep ticked boxes)
  python3 tools/plangen/epc_gen.py prd        PRD, roadmap and project card only
  python3 tools/plangen/epc_gen.py status     also write STATUS.md (refuses if it shows progress; use --force)

Inputs next to this file: epc_project.py, epc_features.py, epc_tasks.psv. Foundation features are read from
features.py, so the wave of every foundation feature the pack uses comes from the live catalogue.
Run the PRD tools against the pack with:  python3 .claude/gx/bin/prdtool.py lint --root packs/epc
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = "packs/epc"
sys.path.insert(0, HERE)
import epc_project as PJ  # noqa: E402
import epc_features as EF  # noqa: E402
import features as FND  # noqa: E402  (foundation catalogue)

MOD = {
    "E0": ("epc-core", "Pack core, roles, configuration, demo and privacy handlers", "Money and tax library, working calendar, classification, roles and approval policies, configuration bundle, demo tenant, erase and export handlers."),
    "E1": ("epc-projects", "Import, customers, handoff and baseline", "Bring sheets in safely; hold customers and sites; turn a won deal into a baselined project with templates."),
    "E2": ("epc-utility", "Utility and subsidy tracker", "Stage templates, stage record and clock, document gates and evidence, escalation, cash blocked and compliance flags."),
    "E3": ("epc-control", "Exceptions, owner home, approvals and tasks", "Rules and evaluator, lifecycle, ranking, portfolio widgets, approval queue, tasks and reminders, digest."),
    "E4": ("epc-materials", "BOM, suppliers and procurement", "Supplier master, BOM and quantity states, quotation requests, comparison, purchase orders, promises, returns and change control."),
    "E5": ("epc-stock", "Receiving, stock and readiness", "Goods receipt, inspection, serials, stock ledger, reservations, availability and the readiness gate."),
    "E6": ("epc-cost", "Cost and margin", "Budget, commitments and actuals, forecast margin and floor, supplier bills and field expenses."),
    "E7": ("epc-billing", "Billing records and collections", "Milestone plan, invoice records, receipts, ageing, blocked-by chain and collections."),
    "E8": ("epc-field", "Site app and handover", "Offline-safe site app, daily work, crew calendar, quality and punch list, commissioning and handover."),
    "E9": ("epc-integrations", "Email, export, Tally and WhatsApp", "Message adapters, export everything, Tally sync and sync health."),
}
UI_TASKS = {"E0-T10", "E3-T08", "E3-T09", "E3-T13", "E3-T17", "E8-T02", "E8-T04", "E9-T05", "E1-T02", "E3-T11"}
HUMAN_GATES = {
    "E2-T02": "Default now: Maharashtra (the state utility) plus one example state from public information, each marked unverified. Refinement (Q-01) confirms or replaces the stage lists; the change is data only.",
    "E3-T01": "Default now: gx-planner drafts the five definitions with worked numbers and Aadarsh accepts them. Refinement (Q-02) with a design partner may change them; rules read definitions and thresholds from configuration, so a change is data.",
    "E8-T01": "Decide Q-05 (what the phone may keep offline). gx-planner drafts the ADR; Aadarsh accepts it before any other E8 task starts.",
    "E9-T03": "Default now: Tally Prime file exchange (Q-08 lean). The file format is confirmed at refinement before the first live sync.",
    "E9-T06": "Needs the provider and cost decision (Q-09) before code; this task is not in the common must-haves.",
    "E7-T02": "Default now: record and sync (Q-03 lean). A chartered accountant confirms at refinement; issuing invoices would be a new Later feature.",
    "E5-T04": "Default now: both warehouse and site locations (Q-04 lean); refinement trims what is shown.",
}
SEC_NOTES = {
    "E1-T01": "Threat: malicious or malformed upload (macro, formula injection, zip bomb, oversize). Control: type sniffing, size and row caps, text-only cells, no macro execution, parse in a limited-memory worker.",
    "E4-T05": "Threat: guessed or leaked supplier link, data exposure to the wrong supplier. Control: 128-bit random token, expiry, per-link scope, rate limit, minimal data, no personal data in the URL (CMP-15).",
    "E4-T08": "Threat: one person raises and approves their own order. Control: separation of duties by threshold enforced on the server; denied attempts audited.",
    "E3-T10": "Threat: requester approves own request; approval lost in a half-applied change. Control: server-side separation, decision and state change in one transaction, audit actor.",
    "E0-T06": "Threat: privilege escalation or cross-branch reads. Control: roles are data, deny by default, scopes applied in the data layer, property tests over random grants.",
    "E0-T11": "Threat: incomplete erasure or over-erasure. Control: every module registers handlers; statutory records are kept with the reason; per-handler outcome is reported.",
    "E8-T01": "Threat: personal data on a lost or shared phone. Control: ADR with minimal fields, encryption, wipe on sign-out and after 72 hours.",
    "E8-T02": "Threat: data left in the cache or storage. Control: shell-only cache, no personal data outside the ADR, wipe on sign-out, strict content security policy.",
    "E8-T03": "Threat: silent overwrite or replay of a queued change. Control: idempotency keys, version checks, conflicts surfaced to the user.",
    "E9-T02": "Threat: bulk exfiltration and spreadsheet formula injection. Control: permission and step-up, audited job, neutralised cells, short-lived signed link, tenant-scoped file.",
    "E9-T03": "Threat: accounting credentials or vouchers leak. Control: file exchange first; secrets only through the secrets port; nothing sensitive in the browser.",
    "E9-T06": "Threat: messaging without consent or with leaked tokens. Control: per-contact opt-in, template-only outside the window, opt-out at once, secrets through the secrets port (CMP-18).",
}
STAGES_NOTE = "Waves are the foundation's: 0 core, 1 tenancy, 2 events and audit log, 3 configuration, 4 identity and workflow, 5 files and privacy desk."


# ------------------------------------------------------------------ load
def fnd_waves():
    wave_of_ms = {"M-01": 0, "M-02": 1, "M-03": 2, "M-04": 3, "M-05": 4, "M-06": 4, "M-07": 5, "M-08": 1}
    w = {}
    for mid, _, fl, _ in FND.MILESTONES:
        for f in fl:
            w[f] = wave_of_ms[mid]
    names = {f["id"]: f["name"] for f in FND.F}
    return w, names


def load():
    fw, fnames = fnd_waves()
    tasks = {}
    for ln in open(os.path.join(HERE, "epc_tasks.psv"), encoding="utf-8"):
        if not ln.strip():
            continue
        c = [x.strip() for x in ln.rstrip("\n").split(" | ")]
        tid, title, needs, size, sec, uses, done, tests = c
        tasks[tid] = dict(id=tid, title=title, needs=[] if needs == "-" else [n.strip() for n in needs.split(",")],
                          size=size, sec=sec, uses=[] if uses == "-" else [u.strip() for u in uses.split(",")],
                          done=done, tests=tests, mod=tid.split("-")[0])
    order = sorted(tasks, key=lambda x: (int(x[1]), int(x.split("T")[1])))
    for i, t in enumerate(order, 1):
        tasks[t]["tno"] = "T-%03d" % i
    # features
    feats = {}
    slug2id = {}
    for i, f in enumerate(EF.F, 1):
        f = dict(f)
        f["id"] = "F-%02d" % i
        feats[f["id"]] = f
        slug2id[f["slug"]] = f["id"]
    owner = {}
    for f in feats.values():
        for t in f["tasks"]:
            if t not in tasks:
                raise SystemExit("feature %s lists unknown task %s" % (f["id"], t))
            if t in owner:
                raise SystemExit("task %s is in two features" % t)
            owner[t] = f["id"]
    miss = [t for t in tasks if t not in owner]
    if miss:
        raise SystemExit("tasks without a feature: %s" % miss)
    ms = []
    ms_of = {}
    for mid, outcome, slugs, demo in PJ.MILESTONES:
        ids = []
        for s in slugs:
            if s not in slug2id:
                raise SystemExit("milestone %s names unknown feature %s" % (mid, s))
            ids.append(slug2id[s])
            if slug2id[s] in ms_of:
                raise SystemExit("feature %s is in two milestones" % slug2id[s])
            ms_of[slug2id[s]] = mid
        ms.append((mid, outcome, ids, demo))
    for fid in feats:
        if fid not in ms_of:
            raise SystemExit("feature %s (%s) has no milestone" % (fid, feats[fid]["name"]))
    for t, d in tasks.items():
        d["feature"] = owner[t]
        d["milestone"] = ms_of[owner[t]]
        for n in d["needs"]:
            if n not in tasks:
                raise SystemExit("task %s needs unknown %s" % (t, n))
        for u in d["uses"]:
            if u not in fw:
                raise SystemExit("task %s uses unknown foundation feature %s" % (t, u))
        d["fwave"] = max([fw[u] for u in d["uses"]] or [0])
    # levels and pack waves
    lvl, pw = {}, {}

    def band(w):
        return 0 if w <= 2 else (1 if w == 3 else (2 if w == 4 else 3))

    def level(t, stack=()):
        if t in lvl:
            return lvl[t]
        if t in stack:
            raise SystemExit("task cycle: " + " -> ".join(stack + (t,)))
        lvl[t] = 0 if not tasks[t]["needs"] else 1 + max(level(n, stack + (t,)) for n in tasks[t]["needs"])
        pw[t] = max([band(tasks[t]["fwave"])] + [pw_of(n, stack + (t,)) for n in tasks[t]["needs"]])
        return lvl[t]

    def pw_of(n, stack):
        level(n, stack)
        return pw[n]

    for t in tasks:
        level(t)
        tasks[t]["level"] = lvl[t]
        tasks[t]["pwave"] = "ABCD"[pw[t]]
    # milestone order check
    ms_idx = {m[0]: i for i, m in enumerate(ms)}
    for t, d in tasks.items():
        for n in d["needs"]:
            if ms_idx[tasks[n]["milestone"]] > ms_idx[d["milestone"]]:
                print("warn: %s (%s) needs %s from a later milestone %s" % (t, d["milestone"], n, tasks[n]["milestone"]))
    for fid, f in feats.items():
        deps = set()
        for t in f["tasks"]:
            for n in tasks[t]["needs"]:
                if owner[n] != fid:
                    deps.add(owner[n])
        f["deps"] = sorted(deps)
    return tasks, feats, ms, ms_of, fw, fnames


# ------------------------------------------------------------------ helpers
def w(path, text):
    full = os.path.join(ROOT, OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(text if text.endswith("\n") else text + "\n")
    print("wrote", os.path.join(OUT, path))


def agents(d):
    tid = d["id"]
    build = "Aadarsh decides, then gx-implementer" if tid in HUMAN_GATES else "gx-implementer"
    tests = d["tests"].lower()
    qa = "gx-qa-engineer" if d["sec"] == "S3" or re.search(r"matrix|property|chaos|fuzz|negative|concurrency|conformance|seeded", tests) else "-"
    rv = []
    if tid in UI_TASKS:
        rv.append("gx-ux-reviewer")
    if d["size"] == "M":
        rv.append("gx-staff-reviewer")
    rv.append("gx-security-reviewer (blocking)" if d["sec"] == "S3" else "gx-security-reviewer (module gate)" if d["sec"] == "S2" else "")
    return build, qa, ", ".join(x for x in rv if x) or "module gate"


def skills(d):
    s = ["gx-modular-platform", "gx-code-quality", "gx-test-feature"]
    low = (d["title"] + " " + d["done"] + " " + d["tests"]).lower()
    if d["id"] in UI_TASKS:
        s = ["gx-cognitive-ux", "epc-design-system"] + s[1:]
    if re.search(r"table|ledger|migration|rls|isolation|append-only|record", low):
        s.append("gx-database-design")
    if d["id"] in ("E5-T05", "E4-T03", "E3-T05", "E6-T02", "E8-T03", "E2-T07"):
        s.append("gx-high-concurrency")
    if re.search(r"consent|personal|erase|retention|privacy|customer|opt-in", low) or d["id"] in ("E0-T04", "E0-T11", "E0-T12", "E9-T02", "E9-T06"):
        s += ["gx-compliance", "epc-compliance-privacy"]
    return list(dict.fromkeys(s))


def lane(t):
    return MOD[t.split("-")[0]][0]


# ------------------------------------------------------------------ PRD
def write_prd(tasks, feats, ms, ms_of):
    n_must = sum(1 for f in feats.values() if f["pri"] == "Must")
    w("docs/prd/00-project-card.md", """# Project card

| Field | Value |
|---|---|
| Project | EPC pack: owner control tower for Indian solar EPCs, on the GX foundation |
| Client / sponsor | GarunaCDX (internal product), sponsor Aadarsh Mishra |
| Industry and sub-segment | Solar EPC and installer: rooftop residential, commercial and 100 kW and above |
| Country and regions served | India; first one or two states (decision Q-01); Mumbai hosting region |
| Compliance regime (initial guess) | DPDP Act 2023 and Rules 2025, CERT-In incident reporting, GST records, state utility and PM Surya Ghar documentation; see docs/compliance/register.md |
| Platforms | Web for office roles; installable web app for site roles; Hindi, Marathi, Gujarati and English labels |
| Tech stack (given or preferred) | Fixed by ADR-0006: TypeScript, Next.js on Vercel, Supabase Postgres in Mumbai, pnpm and Turborepo; pack lives in packs/epc |
| Scale expected at launch and in 12 months | 3 pilot companies at launch; 30 companies in 12 months; 40 live projects per company |
| Contested inventory (bookings, slots, stock)? | Yes: stock reservations across projects (E5-T05) |
| Integrations and account owners | Tally (file exchange), email provider, WhatsApp business provider (later), object storage via the foundation; accounts owned by Aadarsh or the tenant |
| Existing systems and data to migrate | Owner's Excel sheets and exports from their CRM; imported by the guided import |
| Deadline and why it is fixed | None fixed; gates decide. Subsidy scheme timing makes earlier pilots more valuable (risk R-01) |
| Budget range | Not set |
| Team and roles | Aadarsh (decisions, acceptance); a design partner owner; agents gx-implementer, gx-qa-engineer, gx-security-reviewer, gx-staff-reviewer, gx-ux-reviewer, gx-planner, gx-analyst |
| Decision makers and approvers | Aadarsh Mishra |
""")
    out = ["""---
project: EPC pack on the GX foundation
client: GarunaCDX
version: 0.1-draft
status: draft
owner: Aadarsh Mishra
approvers: [Aadarsh Mishra]
---

# 1. Objective
Problem (3 sentences max): Indian solar EPC owners run jobs on Excel, WhatsApp and Tally, so they learn too late which jobs are stuck at the utility, which material is missing and which jobs lose margin. Cash sits blocked after installation while approvals age unseen. The pack gives the owner one ranked list of what is stuck, why, who owns it and what it costs.
Why now: Rooftop installations are at record levels but the subsidy window is ending and the domestic-cell rule raises execution risk, so mid-size and commercial EPCs need control after the sale more than another CRM. The foundation decisions (ADR-0001 to ADR-0006) are accepted, so the pack can be planned in step with the foundation waves.
""", "| ID | Goal | Metric | Baseline | Target | By when |", "|----|------|--------|----------|--------|---------|"]
    for g in PJ.GOALS:
        out.append("| " + " | ".join(g) + " |")
    out += ["", "# 2. Users", "| ID | Role | Who they are | Device / language / tech comfort | How they do it today | Biggest pain | Primary? |",
            "|----|------|--------------|----------------------------------|----------------------|--------------|----------|"]
    for u in PJ.USERS:
        out.append("| " + " | ".join(u) + " |")
    out += ["", "Buyer / payer: the EPC owner pays a monthly subscription per company (hypothesis: 5,000 rupees including a defined user and project allowance; decision Q-06).", "",
            "# 3. Needs", "| ID | As (U-xx) I need | so that | Serves | Priority |", "|----|------------------|---------|--------|----------|"]
    for n in sorted(PJ.NEEDS, key=lambda x: int(x[0].split("-")[1])):
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
Industry and country: Indian solar EPC; DPDP duties, GST records, state utility and PM Surya Ghar stages; ALMM and DCR flags. Rates, stages and flags are data because they change.
Integrations: Tally by file exchange first; email now; WhatsApp later through a provider; utility and subsidy portals have no public API, so stages and evidence are recorded by people.
Tech mandates: ADR-0006 stack; the pack uses foundation public APIs only and adds 0 industry words to foundation packages (G-01).
Existing systems and data to migrate: owner sheets and CRM exports through the guided import.
Budget: Not set.
Deadline: None fixed; each pilot gate decides the next phase.
Team: Aadarsh decides and accepts; a design partner owner confirms definitions and stage lists; agents build and review under packs/epc/docs/plans/README.md.
""", "# 7. Out of scope", "| ID | Not building | Why | Revisit |", "|----|--------------|-----|---------|"]
    for r in PJ.OUT_OF_SCOPE:
        out.append("| " + " | ".join(r) + " |")
    out += ["", "# 8. Assumptions and risks", "| ID | Assumption or risk | Likelihood | Impact | Mitigation | Owner |", "|----|--------------------|-----------|--------|------------|-------|"]
    for r in PJ.RISKS:
        out.append("| " + " | ".join(r) + " |")
    out += ["", """# 9. Success and launch criteria
Success (90 days after the first paid pilot starts): G-02 holds for 5 of 5 cold owners, G-03 holds for 3 of 3 pilots, and G-06 reaches 3 paid conversions.
Launch gate: all Must features pass their acceptance criteria on staging; 0 open Critical or High security findings; the 10-request privacy drill passes; restore drill passed; a pilot owner signs the paid plan.
""", """# 10. Brand
Guide: docs/design/design-system.md and docs/prd/brand/ in the repository root
Tone of voice: precise, calm, businesslike; plain words for crews in Hindi, Marathi and Gujarati
References: Salesforce Lightning density and structure; one orange action per view
""", "# 11. Open questions and decisions", "| ID | Question | Owner | Needed by | Answer |", "|----|----------|-------|-----------|--------|"]
    for q in PJ.DECISIONS:
        out.append("| %s | %s | %s | %s | %s |" % q)
    out += ["", """# 12. Sign-off
Baseline v1.0 approved by: pending (Aadarsh Mishra)
Later changes only via docs/prd/changes/CR-xxx.md in this pack
"""]
    w("docs/prd/01-prd.md", "\n".join(out))

    rm = ["# Roadmap", "",
          "Dates stay TBD until each Must feature has its analysis and size. A phase closes at its gate, not on a date. The pack builds in step with the foundation: see docs/plans/README.md for the wave sequencing.", "",
          "## Phases and gates", "| Phase | Name | Gate | Gate criteria | Target date |", "|-------|------|------|---------------|-------------|",
          "| P0 | Refine (runs in parallel, does not gate the build) | Gate 0 | Refinement inputs recorded: first states and stage lists confirmed, 5 real sheets tested against the importer, definitions confirmed with a design partner, pilot offer set. Changes land as data or change requests | TBD |",
          "| P1 | Demo and import | Gate 1 | Demo shown to 5 owners with the cold-viewer test passed; import of 3 real sheets with all row errors explained | TBD |",
          "| P2 | Control loop | Gate 2 | Pilot owners open the exceptions list and utility tracker weekly instead of their sheet; stage accuracy 95% or more on sampled jobs | TBD |",
          "| P3 | Material loop | Gate 3 | A pilot runs a live job through BOM, order, receipt and readiness with no parallel spreadsheet | TBD |",
          "| P4 | Margin, cash and field | Gate 4 | Forecast margin and readiness reconcile to source documents; field updates used on live jobs; 3 pilots convert to paid | TBD |",
          "| P5 | Launch and operate | - | Two weeks without a severity-1 issue; support runbook handed over; change control for new scope | - |", "",
          "## Milestones", "A milestone is an outcome Aadarsh can verify, one demoable every 1 to 2 weeks of build.", "",
          "| ID | Outcome the client can verify | Features | Date | Phase | Demo script (5 steps max) |",
          "|----|-------------------------------|----------|------|-------|----------------------------|"]
    phase = {"M-01": "P1", "M-02": "P1", "M-03": "P2", "M-04": "P2", "M-05": "P3", "M-06": "P4", "M-07": "P4", "M-08": "P5"}
    for mid, outcome, fl, demo in ms:
        rm.append("| %s | %s | %s | TBD | %s | %s |" % (mid, outcome, ", ".join(fl), phase[mid], demo))
    w("docs/prd/02-roadmap.md", "\n".join(rm))


def write_status(tasks, feats, ms, ms_of, force):
    p = os.path.join(ROOT, OUT, "docs/prd/STATUS.md")
    if os.path.exists(p) and not force:
        if re.search(r"\|\s*(In progress|In review|Blocked|Done|Deferred)\s*\|", open(p, encoding="utf-8").read()):
            print("STATUS.md shows progress; left alone (use --force to overwrite)")
            return
    st = ["# STATUS (updated 2026-11-04 by session 1)",
          "Release target: first paid pilot (date TBD)   Current phase: P1 Demo and import (common must-haves)   Overall: GREEN", "",
          "GREEN: the build starts on the common must-haves with default assumptions (decision 2026-11-05). Refinement with owners runs in parallel and changes data or scope through change requests. The pack waits only on the foundation tasks it uses.", "",
          "States are a closed set: Not started, In progress, In review, Blocked, Done, Deferred. No percentages.",
          'RAG: GREEN on date and unblocked; AMBER slip of 3 working days or less, or a blocker with an owner and a fix date; RED slip over 3 working days or blocked with no fix date.',
          'Done for a feature means every acceptance criterion passes on staging ("N of N pass"). Done for a milestone needs evidence.', "",
          "## Milestones", "| ID | Outcome the client can verify | Features | Date | State | RAG | Evidence |", "|----|-------------------------------|----------|------|-------|-----|----------|"]
    for mid, outcome, fl, demo in ms:
        st.append("| %s | %s | %s | TBD | Not started | %s | - |" % (mid, outcome, ", ".join(fl), "GREEN"))
    st += ["", "## Features", "| ID | Name | Priority | Milestone | State | Acceptance | Tests | PR |", "|----|------|----------|-----------|-------|-----------|-------|----|"]
    for f in feats.values():
        acc = "0 of %d pass" % len(f["acs"]) if f["acs"] else "-"
        st.append("| %s | %s | %s | %s | Not started | %s | - | - |" % (f["id"], f["name"], f["pri"], ms_of[f["id"]], acc))
    st += ["", "## Tasks (current milestone only)", "| ID | Feature | Task | State | Blocked by |", "|----|---------|------|-------|-----------|"]
    for tid, d in sorted(tasks.items(), key=lambda kv: kv[1]["tno"]):
        if d["milestone"] != "M-01":
            continue
        blocked = ", ".join(tasks[n]["tno"] for n in d["needs"]) or "-"
        st.append("| %s | %s | %s %s | Not started | %s |" % (d["tno"], d["feature"], tid, d["title"], blocked))
    st += ["", "## Decisions needed from the client", "| ID | Decision | Needed by | Impact if late |", "|----|----------|-----------|----------------|"]
    impact = {"Q-01": "Stage templates cannot be written", "Q-02": "Definitions cannot be agreed", "Q-03": "Invoice records design blocked",
              "Q-04": "Stock model unproven", "Q-05": "No offline site app", "Q-06": "First pilot offer unset", "Q-07": "Plan limits unset",
              "Q-08": "Tally scope unclear", "Q-09": "WhatsApp blocked", "Q-12": "Pilot start slips"}
    for i, q in enumerate(PJ.DECISIONS, 1):
        if q[4].startswith(("Decided", "Deferred")):
            continue
        st.append("| D-%02d | %s | %s | %s |" % (i, q[1], q[3], impact.get(q[0], "Later work blocked")))
    w("docs/prd/STATUS.md", "\n".join(st))


# ------------------------------------------------------------------ plans
def render_task(d, tasks, ticked):
    b, qa, rv = agents(d)
    box = "x" if d["id"] in ticked else " "
    needs = ", ".join("%s (%s)" % (n, tasks[n]["tno"]) for n in d["needs"]) or "none"
    uses = ", ".join(d["uses"]) or "none"
    o = ["- [%s] **%s** (%s) %s (%s)" % (box, d["id"], d["tno"], d["title"], d["size"]),
         "  - Feature: %s | Milestone: %s | Pack wave: %s | Level: %d | Lane: %s" % (d["feature"], d["milestone"], d["pwave"], d["level"], lane(d["id"])),
         "  - Needs: %s" % needs,
         "  - Foundation features used (public APIs only): %s (needs foundation wave %d)" % (uses, d["fwave"]),
         "  - Agents: build %s | tests %s | review %s" % (b, qa, rv),
         "  - Skills: %s" % ", ".join(skills(d)),
         "  - Security: %s. %s" % (d["sec"], SEC_NOTES.get(d["id"], "Module security baseline applies.")),
         "  - Done when: %s" % d["done"],
         "  - Tests: %s" % d["tests"],
         "  - Rollback: Revert the commit; migrations are expand-only, so a schema fault is fixed forward. User-visible change ships behind a flag."]
    if d["id"] in HUMAN_GATES:
        o.append("  - Human gate: %s" % HUMAN_GATES[d["id"]])
    return o


def ticked_ids(path):
    full = os.path.join(ROOT, OUT, path)
    if not os.path.exists(full):
        return set()
    return set(re.findall(r"- \[x\] \*\*(E\d+-T\d+)\*\*", open(full, encoding="utf-8").read()))


SEC_BASE = ["Every pack table has a tenant, forced row-level security and a negative cross-tenant test; the app role is not the owner.",
            "Every new action is a declared permission with a negative test (caller without it is denied); the server decides, the interface only hides.",
            "Every new field has a data class; personal data is masked in logs and audit diffs and has an erase and export handler.",
            "Amounts are integer paise; issued invoice and receipt records are never edited, only corrected by linked records.",
            "Files, links and imports are untrusted input: type, size and content checks, signed short-lived access, no personal data in URLs."]


def write_briefs(tasks, feats):
    for k, (pkg, name, purpose) in MOD.items():
        ts = [d for d in sorted(tasks.values(), key=lambda x: x["tno"]) if d["mod"] == k]
        path = "docs/plans/%s-%s.md" % (k, pkg.replace("epc-", ""))
        ticked = ticked_ids(path)
        fl = []
        for d in ts:
            if d["feature"] not in fl:
                fl.append(d["feature"])
        o = ["# %s %s\n" % (k, name), "%s\n" % purpose,
             "- **Lane:** `packs/epc/%s`\n- **Tasks:** %d\n- **Foundation waves needed:** %s\n" % (pkg, len(ts), ", ".join(str(x) for x in sorted({d["fwave"] for d in ts}))),
             "Tick a task when its done-when and tests pass and the definition of done in [the playbook](README.md) holds. Scope and acceptance criteria live in [the pack PRD](../prd/01-prd.md).\n",
             "## Features delivered\n"]
        for fid in fl:
            f = feats[fid]
            o.append("- **%s** %s (%s, %d acceptance criteria)" % (fid, f["name"], f["pri"], len(f["acs"])))
        o += ["\n## Security baseline for this module\n", "Applies to every task below, on top of the repository [security guidelines](../../../../docs/guidelines/security-guidelines.md).\n"]
        o += ["- %s" % s for s in SEC_BASE]
        o.append("\n## Tasks\n")
        for d in ts:
            o += render_task(d, tasks, ticked)
        w(path, "\n".join(o))


def write_register(tasks, feats):
    rows = ["# EPC pack task register", "",
            "Generated by `python3 tools/plangen/epc_gen.py`. Do not edit by hand; change the catalogue in tools/plangen and rerun.",
            "Pack wave: A runs alongside foundation waves 0 to 2 (core ports, fakes, tenancy, events, audit log); B needs configuration (wave 3); C needs identity and workflow (wave 4); D needs files and the privacy desk (wave 5). " + STAGES_NOTE, "",
            "| T | Plan id | Task | Feature | Milestone | Size | Needs | Pack wave | Level | Lane | Build | Tests | Review | Sec |",
            "|---|---------|------|---------|-----------|------|-------|-----------|-------|------|-------|-------|--------|-----|"]
    for tid, d in sorted(tasks.items(), key=lambda kv: kv[1]["tno"]):
        b, q, r = agents(d)
        rows.append("| %s | %s | %s | %s | %s | %s | %s | %s | %d | %s | %s | %s | %s | %s |" % (
            d["tno"], tid, d["title"], d["feature"], d["milestone"], d["size"], ", ".join(d["needs"]) or "-", d["pwave"], d["level"], lane(tid), b, q, r, d["sec"]))
    w("docs/plans/TASKS.md", "\n".join(rows))


def write_playbook(tasks, feats, ms, ms_of):
    n = len(tasks)
    n_must = sum(1 for f in feats.values() if f["pri"] == "Must")
    n_should = sum(1 for f in feats.values() if f["pri"] == "Should")
    n_later = sum(1 for f in feats.values() if f["pri"] == "Later")
    n_ac = sum(len(f["acs"]) for f in feats.values())
    n_s3 = sum(1 for d in tasks.values() if d["sec"] == "S3")
    by_wave = {k: sum(1 for d in tasks.values() if d["pwave"] == k) for k in "ABCD"}
    m_wave = {}
    for mid, _, fl, _ in ms:
        ts = [d for d in tasks.values() if d["milestone"] == mid]
        m_wave[mid] = ("-" if not ts else "".join(sorted({d["pwave"] for d in ts})))
    rows = ["| Milestone | Outcome | Tasks | Pack waves | Earliest real-data demo |", "|---|---|---|---|---|"]
    for mid, outcome, fl, demo in ms:
        ts = [d for d in tasks.values() if d["milestone"] == mid]
        mx = max([d["fwave"] for d in ts] or [0])
        rows.append("| %s | %s | %d | %s | foundation wave %d done |" % (mid, outcome, len(ts), m_wave[mid], mx))
    text = """# EPC pack: plan and agent playbook

The pack plan for the solar EPC owner control tower. Scope and acceptance criteria are in [the pack PRD](../prd/01-prd.md); the work queue is [TASKS.md](TASKS.md); the mapping onto the foundation and the list of generic capabilities the pack builds first are in [foundation-map.md](../foundation-map.md); domain rules and sources are in [domain-notes.md](../domain-notes.md). Execution rules (roles, ready and done, start prompts, escalation) are the repository's [plan playbook](../../../../docs/plans/README.md) and apply here unchanged; this file adds the pack-specific sequencing.

## Numbers

- %(nf)d features: %(must)d Must, %(should)d Should, %(later)d Later (no tasks until promoted); %(ac)d acceptance criteria
- %(nt)d tasks in 10 lanes; %(s3)d are security-critical (S3: threat model first, blocking security review)
- Pack waves: A %(a)d tasks, B %(b)d, C %(c)d, D %(d)d
- %(nm)d milestones and 5 gates (G0 to G4)

## Sequencing with the foundation

The pack uses only the foundation's public APIs, so it can start as soon as the ports and fakes exist and swap in real adapters as waves land. The pack never waits for a whole wave: a task starts when the foundation features it uses (listed per task) are merged.

| Pack wave | Starts when | What runs | Foundation |
|---|---|---|---|
| A | Foundation wave 0 done (ports, fakes, toolchain); tables from wave 1 (tenancy); outbox and jobs from wave 2 | Pure domain code that needs no identity or configuration: money and calendar libraries, import engine, BOM and stock state machines, exception evaluator, cost ledger, demo seed and demo views | Waves 0 to 2 |
| B | Foundation wave 3 (configuration, custom fields, condition language, bundles) | Configuration bundle, company setup, project templates, stage templates, exception rules as data | Wave 3 |
| C | Foundation wave 4 (identity, roles, workflow, approvals, SLA timers) | Roles and approval policies, stage tracker on workflow, approval queue, escalation, readiness gate overrides, site app sign-in | Wave 4 |
| D | Foundation wave 5 (files, privacy desk, retention, erasure) | Evidence and document attachments, goods-receipt photos, handover pack, erase and export handlers, export everything | Wave 5 |

Refinement (Phase 0) runs in parallel and does not gate the build (decision 2026-11-05). The build starts on the common must-haves with default assumptions; owner conversations, real sheets, state stage lists and the pilot offer then tune data, thresholds and scope through change requests.

## Milestones and what unlocks them

%(rows)s

## Honest timing

- A pilot on real customer data needs identity, workflow, files and the privacy desk, so the first real pilot is after foundation wave 5. Before that, owners see the demo and a sample-data walkthrough (milestone M-01) and send real sheets for import testing (M-02).
- Foundation wave 4 holds identity, entitlements and workflow. The pack needs identity and workflow first and entitlements last (decision Q-12): split wave 4 that way, then run wave 5 straight after, so pilots do not wait for plan limits.
- The pack builds generic capabilities first (exceptions, tasks, import, stock ledger, cost ledger, message adapters). They are marked as extraction candidates in [foundation-map.md](../foundation-map.md); they move to a shared utilities layer only when a second vertical needs them (rule of two).

## Pack rules

1. No work without an F id in the pack PRD. New scope is a change request in `packs/epc/docs/prd/changes/`.
2. Foundation packages are never edited for the pack. A missing capability is a foundation defect: stop and raise it (change request on the foundation PRD), or build it inside the pack and record it in the foundation map.
3. No solar words in foundation packages; the boundary and industry-word lints run on every merge.
4. Stage lists, document checklists, thresholds, rates, flags and labels are data in the configuration bundle, never code.
5. Every figure on the owner home opens its records and says how fresh it is.
6. A Must feature needs its sourced analysis file (gx-analyst) before its first task starts.

## Commands

```
python3 tools/plangen/epc_gen.py                       regenerate PRD, roadmap, register, briefs and foundation map
python3 .claude/gx/bin/prdtool.py lint --root packs/epc
python3 .claude/gx/bin/prdtool.py check --root packs/epc
python3 .claude/gx/bin/prdtool.py trace --root packs/epc
```

## Briefs

""" % dict(nf=len(feats), must=n_must, should=n_should, later=n_later, ac=n_ac, nt=n, s3=n_s3, a=by_wave["A"], b=by_wave["B"], c=by_wave["C"], d=by_wave["D"],
           nm=len(ms), rows="\n".join(rows))
    for k, (pkg, name, purpose) in MOD.items():
        text += "- [%s %s](%s-%s.md)\n" % (k, name, k, pkg.replace("epc-", ""))
    w("docs/plans/README.md", text)


# ------------------------------------------------------------------ foundation map
GAPS = [
    ("Record timeline (calls, messages, documents, photos, money on one history)", "Audit trail is evidence, not a user-facing activity feed", "E3-T16", "Likely, any vertical with customers"),
    ("Exceptions and rules engine", "Condition language exists (K4); no rule evaluation, dedupe or lifecycle", "E3-T02 to E3-T05", "Likely"),
    ("Tasks and reminders", "Workflow approvals and SLA timers exist; no general task entity", "E3-T14, E3-T15", "Likely"),
    ("Import engine with mapping and row errors", "Config bundles exist; no spreadsheet import", "E1-T01 to E1-T03", "Likely"),
    ("Export everything", "Tenant exit export exists in the privacy desk; no per-record export with attachments job", "E9-T02 builds on it", "Partly foundation; confirm at K7b"),
    ("Message adapters (email, WhatsApp, SMS)", "Message-sender port and fake exist; no adapters", "E9-T01, E9-T06", "Likely"),
    ("Money and tax library", "None", "E0-T02", "Likely, any vertical with invoices"),
    ("Stock ledger and reservations", "None", "E5-T04, E5-T05", "Only if another vertical holds stock"),
    ("Cost ledger (commitment, actual, payment)", "None", "E6-T02", "Only if another vertical tracks job cost"),
    ("Document generation (PDF for orders and handover packs)", "None; file storage exists", "E0-T13, E4-T14", "Likely"),
    ("Notification centre (in-app)", "Design system has the shell slot; no store", "E3-T17", "Likely"),
    ("Global search", "None", "Later", "Likely"),
]

CMP_MAP = [
    ("CMP-01, CMP-02, CMP-03", "Processor role, notice and consent, data minimisation", "E1-T04, E0-T04, E0-T12"),
    ("CMP-04, CMP-05, CMP-16", "Security safeguards, log retention, no personal data in logs", "E0-T04 and the foundation audit and logging"),
    ("CMP-07, CMP-08, CMP-09, CMP-10", "Retention, statutory records, request desk, tenant exit", "E0-T11, E0-T12, E9-T02"),
    ("CMP-13", "Staff location only at check-in", "E8-T04"),
    ("CMP-15", "Private expiring links, no sequential ids", "E4-T05"),
    ("CMP-18, CMP-19, CMP-20", "WhatsApp opt-in, SMS registration, email authentication", "E9-T06, E9-T01"),
    ("CMP-22, CMP-23, CMP-24", "GST invoice content, e-invoicing, rates as data", "E0-T02, E7-T02 and decision Q-03"),
    ("CMP-25", "E-way bill on dispatch", "Later (transfers) if goods move above the threshold"),
]


def write_foundation_map(tasks, feats, fw, fnames):
    o = ["# Foundation map for the EPC pack", "",
         "Generated by `python3 tools/plangen/epc_gen.py`. Shows which foundation features each pack feature uses (public APIs only), when they land, and which generic capabilities the pack must build first because the foundation does not provide them.", "",
         "## Foundation features the pack uses", "", "| Foundation feature | Wave | Pack tasks that use it |", "|---|---|---|"]
    used = {}
    for d in tasks.values():
        for u in d["uses"]:
            used.setdefault(u, []).append(d["id"])
    for u in sorted(used, key=lambda x: int(x.split("-")[1])):
        o.append("| %s %s | %d | %s |" % (u, fnames[u], fw[u], ", ".join(sorted(used[u]))))
    o += ["", "## Pack features and their foundation needs", "", "| Pack feature | Priority | Milestone | Foundation features used | Latest foundation wave |", "|---|---|---|---|---|"]
    for f in feats.values():
        ts = [tasks[t] for t in f["tasks"]]
        us = sorted({u for d in ts for u in d["uses"]}, key=lambda x: int(x.split("-")[1]))
        mx = max([d["fwave"] for d in ts] or [0])
        o.append("| %s %s | %s | %s | %s | %s |" % (f["id"], f["name"], f["pri"], "-" if not ts else ts[0]["milestone"], ", ".join(us) or "-", mx if ts else "-"))
    o += ["", "## Generic capabilities the pack builds first (extraction candidates)", "",
          "The foundation does not provide these. The pack builds them behind clean seams. They move into a shared utilities layer (L1) only when a second vertical needs them (rule of two). Treat this list as the starting backlog for the L1 map.", "",
          "| Capability | What the foundation has | Where the pack builds it | Reuse outlook |", "|---|---|---|---|"]
    for a, b, c, d in GAPS:
        o.append("| %s | %s | %s | %s |" % (a, b, c, d))
    o += ["", "## Compliance register mapping", "", "| Rules | Subject | Pack tasks |", "|---|---|---|"]
    for a, b, c in CMP_MAP:
        o.append("| %s | %s | %s |" % (a, b, c))
    o += ["", "Status of each rule is kept in docs/compliance/register.md at the repository root. A rule is done only when its test exists.", ""]
    w("docs/foundation-map.md", "\n".join(o))


DOMAIN = """# Domain notes for agents

Short, sourced facts an agent needs before touching EPC logic. Where a figure comes from a vendor page it is marked. Confirm anything marked verify with the design partner or a chartered accountant before it drives a rule. Last checked 2026-11-04.

## The business in one paragraph

An Indian solar EPC sells and installs rooftop systems (residential, commercial, 100 kW and above), buys panels, inverters and structure from suppliers, files approvals with the state distribution utility and the national subsidy scheme, installs with its own and subcontracted crews, bills in milestones and collects. Cash gets stuck after installation while utility approvals (net meter, inspection, commissioning) age. Most small and mid-size EPCs run this on Excel, WhatsApp and Tally.

## Stage flow the pack models

Won deal, baseline, buy material, receive and inspect, readiness check, install and quality check, commissioning and handover, invoice and collect, close job and final margin. The utility and subsidy track runs in parallel because a finished job earns nothing until the utility acts. Steps 3 to 9 and the utility stages can each raise an exception.

## Rules the build must keep

1. Won means the customer accepted and paid the advance, not a verbal yes (owner-day feature map).
2. Subsidy is credited to the consumer's account (or loan account), so it is never a receivable of the EPC and a customer waiting for subsidy is not a late payer (CMP-27; vendor guidance, verify).
3. Commitment (purchase order), actual (bill or expense) and payment are three events; never count a rupee twice.
4. Amounts are integer paise. Invoice and receipt records are never edited; corrections are linked credit-note records.
5. GST rates, HSN and SAC codes are dated data. Renewable equipment GST fell from 12% to 5% on 22 September 2025; a vendor blog puts the blended EPC rate near 8.9% under a 70:30 goods and services split; a chartered accountant must confirm before launch (CMP-24).
6. Since 1 June 2026 net-metering and open-access projects must use domestic ALMM List-II cells (about 3,000 rupees per kW more, industry estimates). Flags are data; the rule will change (verify).
7. MNRE deactivated vendors for hoarding applications and advises no application pending over 60 days: the backlog widget warns before day 60.
8. Utility and subsidy portals have no public API and the pack never stores the owner's portal passwords: people record stage, reference number and evidence.
9. Do not store Aadhaar numbers, card numbers or a consumer's bank account (CMP-03).

## What is evidence and what is hypothesis

- Evidence (vendor-run survey, sample size not stated): utility delays are the top pain at 71% of installers; price pressure 66%; follow-up 63%; subsidy paperwork 56%; working capital 52%. 64 to 70% of solo and small EPCs run the pipeline in Excel or Sheets and 96 to 98% talk to customers on WhatsApp.
- Hypotheses to test in Phase 0: procurement and BOM control is a top pain for mid-size EPCs; owners will pay about 5,000 rupees per company per month; supervisors will update from a phone; one or two states cover the first customers.

## Competitors (public pages, no demos run)

Quickest Solar CRM, SolarOps360 (nearest rival: similar price and scope, thin public evidence of depth), Sunbase, SurgePV, OpenSolar, Zoho or Salesforce with configuration, Udyog Software and similar Indian ERPs, Tally Prime, in-house builds, and Excel with WhatsApp. None shows quote to purchase order to receipt, job-level forecast margin and utility-stage tracking together on public pages. The defence is India depth: state stage templates, ALMM and DCR flags, Tally sync.

## Sources

Earlier research documents in this project: "Solar EPC Operations Dashboard: Research and PRD" (27 October 2026), "EPC Dashboard: Feature Map" and "Build Plan: EPC Operations Dashboard". Compliance: docs/compliance/register.md. Industry changes: the weekly industry brief (skill epc-industry-news).
"""


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "all"
    force = "--force" in sys.argv
    tasks, feats, ms, ms_of, fw, fnames = load()
    if mode in ("prd", "all", "status"):
        write_prd(tasks, feats, ms, ms_of)
    if mode in ("status", "all"):
        write_status(tasks, feats, ms, ms_of, force)
    if mode == "all":
        write_briefs(tasks, feats)
        write_register(tasks, feats)
        write_playbook(tasks, feats, ms, ms_of)
        write_foundation_map(tasks, feats, fw, fnames)
        w("docs/domain-notes.md", DOMAIN)
    print("features %d (Must %d), tasks %d" % (len(feats), sum(1 for f in feats.values() if f["pri"] == "Must"), len(tasks)))


if __name__ == "__main__":
    main()
