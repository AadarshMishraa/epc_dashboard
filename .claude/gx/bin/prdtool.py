#!/usr/bin/env python3
"""PRD tooling for the GX kit. Standard library only.

  prdtool.py init                 scaffold docs/prd/ from the kit templates (never overwrites)
  prdtool.py lint [--strict]      validate docs/prd/01-prd.md (+ 02-roadmap.md); exit 1 on errors
  prdtool.py check                validate STATUS.md and the roadmap against the PRD (drift); exit 1 on errors
  prdtool.py trace                write docs/prd/03-traceability.md (goal -> need -> feature -> milestone -> task)
  prdtool.py report [--date D]    write docs/prd/reports/<date>.md from STATUS.md
  prdtool.py status               short summary (used by the SessionStart hook)
  prdtool.py baseline             strict lint, then print the commands that tag prd-v1.0 (it does not tag)
  add --root <dir> to run against another project directory.

The PRD format is documented in the gx-project-bootstrap skill. IDs: G goal, U user, N need, F feature, NF non-functional,
X out of scope, R risk, Q question, D decision, M milestone, T task, CR change request.
"""
import datetime as dt
import glob
import os
import re
import shutil
import sys

PRIORITIES = {"must", "should", "later"}
STATES = {"not started", "in progress", "in review", "blocked", "done", "deferred"}
RAGS = {"GREEN", "AMBER", "RED"}
PHASES = {"P0", "P1", "P2", "P3", "P4", "P5"}
PROJECT_STATUS = {"draft", "in-review", "signed-off"}
VAGUE = ["fast", "quick", "quickly", "easy", "easily", "user-friendly", "intuitive", "robust", "seamless", "scalable",
         "modern", "flexible", "world-class", "best-in-class", "high performance", "as needed", "appropriate", "etc",
         "and so on", "state-of-the-art", "cutting-edge"]
UI_WORDS = ["button", "screen", "page", "click", "tap", "dropdown", "menu", "modal", "tab", "icon"]
PLACEHOLDER = re.compile(r"<[^<>\n]{1,80}>")
ID_RX = re.compile(r"^(NF|G|U|N|F|X|R|Q|D|M|T|CR)-\d+$")


# ---------------------------------------------------------------- parsing
def find_root(arg=None):
    if arg:
        return os.path.abspath(arg)
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    if env:
        return env
    d = os.getcwd()
    while True:
        if os.path.isdir(os.path.join(d, "docs", "prd")) or os.path.isdir(os.path.join(d, ".claude")):
            return d
        p = os.path.dirname(d)
        if p == d:
            return os.getcwd()
        d = p


def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return None


def cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def parse_tables(text):
    """Return a list of (headers, rows). Row keys are lower-cased headers plus '_line'."""
    lines = text.splitlines()
    out, i = [], 0
    while i < len(lines):
        if lines[i].lstrip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|[\s:\-|]+\|\s*$", lines[i + 1]):
            hdr = [h.lower() for h in cells(lines[i])]
            rows, j = [], i + 2
            while j < len(lines) and lines[j].lstrip().startswith("|"):
                row = dict(zip(hdr, cells(lines[j])))
                row["_line"] = j + 1
                rows.append(row)
                j += 1
            out.append((hdr, rows))
            i = j
        else:
            i += 1
    return out


def entities(text):
    """All table rows whose first cell is an ID, keyed by ID. Duplicates are reported separately."""
    ents, dups = {}, []
    for hdr, rows in parse_tables(text):
        key = hdr[0] if hdr else ""
        for r in rows:
            rid = r.get(key, "")
            if ID_RX.match(rid):
                if rid in ents:
                    dups.append((rid, r["_line"]))
                ents[rid] = r
    return ents, dups


def front_matter(text):
    m = re.match(r"^---\s*\n(.*?)\n---\s*(\n|$)", text, re.S)
    fm = {}
    if m:
        for ln in m.group(1).splitlines():
            if ":" in ln and not ln.startswith(" "):
                k, v = ln.split(":", 1)
                fm[k.strip()] = v.split("#")[0].strip()
    return fm


def col(row, *names):
    for n in names:
        for k, v in row.items():
            if k.startswith(n):
                return v
    return ""


def ids_in(s, prefix):
    return re.findall(rf"\b{prefix}-\d+\b", s or "")


def real(s):
    return bool(s) and not PLACEHOLDER.search(s) and s.strip() not in {"-", "n/a", "tbd", "TBD"}


class Report:
    def __init__(self):
        self.items = []

    def add(self, level, code, ref, msg, line=None):
        self.items.append((level, code, ref, msg, line))

    def error(self, *a, **k):
        self.add("ERROR", *a, **k)

    def warn(self, *a, **k):
        self.add("WARN", *a, **k)

    def print(self, title, strict=False):
        errs = [i for i in self.items if i[0] == "ERROR" or (strict and i[0] == "WARN")]
        for level, code, ref, msg, line in self.items:
            lvl = "ERROR" if (strict and level == "WARN") else level
            print(f"{lvl:5} {code} {ref}{(':' + str(line)) if line else ''} {msg}")
        w = sum(1 for i in self.items if i[0] == "WARN")
        e = sum(1 for i in self.items if i[0] == "ERROR")
        print(f"{title}: {e} error(s), {w} warning(s)" + (" (strict: warnings count as errors)" if strict else ""))
        return 1 if errs else 0


# ---------------------------------------------------------------- PRD lint
def lint_prd(root, rep):
    path = os.path.join(root, "docs", "prd", "01-prd.md")
    text = read(path)
    if text is None:
        rep.error("P000", "01-prd.md", "docs/prd/01-prd.md not found. Run: prdtool.py init")
        return None
    fm = front_matter(text)
    status = fm.get("status", "draft")
    for k in ("project", "client", "version", "status", "owner", "approvers"):
        if not real(fm.get(k, "")):
            rep.error("P001", "front-matter", f"'{k}' is missing or still a placeholder")
    if fm.get("status") and fm["status"] not in PROJECT_STATUS:
        rep.error("P001", "front-matter", f"status must be one of {sorted(PROJECT_STATUS)}")
    heads = {int(m.group(1)) for m in re.finditer(r"^# (\d+)\. ", text, re.M)}
    for n in range(1, 13):
        if n not in heads:
            rep.error("P002", f"section {n}", "required section heading '# %d. ...' not found" % n)

    ents, dups = entities(text)
    for rid, ln in dups:
        rep.error("P003", rid, "duplicate ID", ln)
    by = lambda p: {k: v for k, v in ents.items() if re.match(rf"^{p}-\d+$", k)}
    G, U, N, F, NF, X, R = by("G"), by("U"), by("N"), by("F"), by("NF"), by("X"), by("R")

    # placeholders left behind
    ph_level = rep.warn if status == "draft" else rep.error
    for i, ln in enumerate(text.splitlines(), 1):
        if ln.startswith(("Writing rules", "```")):
            continue
        if PLACEHOLDER.search(ln) and not ln.lstrip().startswith(("<!--", "#")):
            ph_level("P004", "placeholder", f"unfilled placeholder: {PLACEHOLDER.search(ln).group(0)}", i)
            break  # one is enough to say it; the count follows
    count = len(PLACEHOLDER.findall(text))
    if count:
        ph_level("P004", "placeholder", f"{count} placeholder(s) still in the PRD" + (" (fine while draft)" if status == "draft" else ""))

    if not G:
        rep.error("P010", "goals", "no goals (G-xx rows) found")
    for gid, r in G.items():
        for c in ("metric", "baseline", "target", "by when"):
            if not real(col(r, c)):
                rep.error("P011", gid, f"goal needs a real '{c}' value (a number and a date make it testable)", r["_line"])
    if not U:
        rep.error("P020", "users", "no users (U-xx rows) found")
    primaries = [uid for uid, r in U.items() if col(r, "primary").lower().startswith("y")]
    if U and len(primaries) != 1:
        rep.error("P021", "users", f"exactly one primary user is required, found {len(primaries)}")
    for uid, r in U.items():
        for c in ("device", "how they do it today", "biggest pain"):
            if not real(col(r, c)):
                rep.warn("P022", uid, f"'{c}' is empty: Claude will have to guess it", r["_line"])

    used_users, served_goals, served_needs = set(), set(), set()
    for nid, r in N.items():
        txt = " ".join(v for k, v in r.items() if k != "_line")
        us = ids_in(col(r, "as", "i need"), "U") or ids_in(txt, "U")
        for u in us:
            used_users.add(u)
            if u not in U:
                rep.error("P030", nid, f"refers to {u}, which does not exist", r["_line"])
        if not us:
            rep.error("P031", nid, "need does not say which user (U-xx) it is for", r["_line"])
        gs = ids_in(col(r, "serves"), "G")
        if not gs:
            rep.error("P032", nid, "need must serve at least one goal (G-xx)", r["_line"])
        for g in gs:
            served_goals.add(g)
            if g not in G:
                rep.error("P033", nid, f"serves {g}, which does not exist", r["_line"])
        if col(r, "priority").lower() not in PRIORITIES:
            rep.error("P034", nid, "priority must be Must, Should or Later", r["_line"])
        for w in UI_WORDS:
            if re.search(rf"\b{w}\b", col(r, "as", "i need").lower()):
                rep.warn("P035", nid, f"need mentions UI word '{w}': describe the capability, not the control", r["_line"])
                break
    for gid in G:
        if gid not in served_goals:
            rep.warn("P036", gid, "no need serves this goal")
    for uid in U:
        if uid not in used_users:
            rep.warn("P037", uid, "no need is written for this user")

    musts = [fid for fid, r in F.items() if col(r, "priority").lower() == "must"]
    if F and not musts:
        rep.error("P040", "features", "no Must feature: what blocks launch?")
    deps = {}
    for fid, r in F.items():
        ns = ids_in(col(r, "serves"), "N")
        if not ns:
            rep.error("P041", fid, "feature serves no need (N-xx): cut it or write the need", r["_line"])
        for n in ns:
            served_needs.add(n)
            if n not in N:
                rep.error("P042", fid, f"serves {n}, which does not exist", r["_line"])
        if col(r, "priority").lower() not in PRIORITIES:
            rep.error("P043", fid, "priority must be Must, Should or Later", r["_line"])
        d = ids_in(col(r, "depends"), "F")
        deps[fid] = d
        for x in d:
            if x not in F:
                rep.error("P044", fid, f"depends on {x}, which does not exist", r["_line"])
    for nid in N:
        if nid not in served_needs:
            rep.warn("P045", nid, "no feature serves this need (a gap, or the need is not real)")
    # dependency cycles
    state = {}

    def visit(f, path):
        if state.get(f) == 1:
            rep.error("P046", f, "dependency cycle: " + " -> ".join(path + [f]))
            return
        if state.get(f) == 2:
            return
        state[f] = 1
        for x in deps.get(f, []):
            if x in deps:
                visit(x, path + [f])
        state[f] = 2
    for f in deps:
        visit(f, [])

    # acceptance criteria
    acs = {}
    for m in re.finditer(r"^\s*(F-\d+)-AC(\d+)\s*[:\-]?\s*(.*)$", text, re.M):
        acs.setdefault(m.group(1), []).append((m.group(2), m.group(3), text[:m.start()].count("\n") + 1))
    for fid in acs:
        if fid not in F:
            rep.error("P050", fid, "acceptance criteria written for a feature that is not in the feature table")
    for fid in musts:
        lst = acs.get(fid, [])
        if len(lst) < 3:
            rep.error("P051", fid, f"Must feature needs at least 3 acceptance criteria, found {len(lst)}")
    for fid, lst in acs.items():
        for n, body, ln in lst:
            low = body.lower()
            if not (re.search(r"\bgiven\b", low) and re.search(r"\bwhen\b", low) and re.search(r"\bthen\b", low)):
                rep.error("P052", f"{fid}-AC{n}", "use Given / When / Then", ln)
            elif not re.search(r"\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|zero|none|never|no|all|every|each)\b", low) and "<" not in body:
                rep.warn("P053", f"{fid}-AC{n}", "no number in the result: how will a tester decide pass or fail?", ln)

    # non-functional requirements
    if not NF:
        rep.warn("P060", "non-functional", "no NF-xx rows: performance, availability, security, accessibility and scale need numbers")
    for nid, r in NF.items():
        if not re.search(r"\d", col(r, "requirement")) and real(col(r, "requirement")):
            rep.warn("P061", nid, "requirement has no number", r["_line"])
        if not real(col(r, "how verified")):
            rep.warn("P062", nid, "no way to verify it", r["_line"])

    # scope and risks
    if not X:
        rep.error("P070", "out of scope", "no out-of-scope rows: list what the client may assume is included")
    elif len(X) < 3:
        rep.warn("P071", "out of scope", f"only {len(X)} out-of-scope item(s); aim for the three most likely assumptions")
    if not R:
        rep.warn("P072", "risks", "no risks or assumptions recorded")

    # vague words in testable sections
    for rid, r in {**G, **N, **F, **NF}.items():
        for k, v in r.items():
            if k.startswith("_") or k in ("id", "serves", "priority", "depends on"):
                continue
            for w in VAGUE:
                if re.search(rf"(?<![\w-]){re.escape(w)}(?![\w-])", v.lower()):
                    rep.warn("P080", rid, f"vague word '{w}' in '{k}': replace with a number or a testable statement", r["_line"])
                    break
    for fid, lst in acs.items():
        for n, body, ln in lst:
            for w in VAGUE:
                if re.search(rf"(?<![\w-]){re.escape(w)}(?![\w-])", body.lower()):
                    rep.warn("P080", f"{fid}-AC{n}", f"vague word '{w}'", ln)
                    break
    return {"fm": fm, "ents": ents, "G": G, "U": U, "N": N, "F": F, "NF": NF, "X": X, "R": R, "acs": acs, "text": text}


# ---------------------------------------------------------------- roadmap and status
def load_roadmap(root):
    text = read(os.path.join(root, "docs", "prd", "02-roadmap.md"))
    if text is None:
        return None
    ents, dups = entities(text)
    M = {k: v for k, v in ents.items() if k.startswith("M-")}
    return {"text": text, "M": M, "dups": dups}


def lint_roadmap(root, prd, rep):
    rm = load_roadmap(root)
    if rm is None:
        rep.warn("R000", "roadmap", "docs/prd/02-roadmap.md not found yet (expected after the review gate)")
        return None
    for rid, ln in rm["dups"]:
        rep.error("R001", rid, "duplicate ID", ln)
    placed = {}
    last_date = None
    for mid, r in rm["M"].items():
        feats = ids_in(col(r, "features"), "F")
        if not feats:
            rep.error("R002", mid, "milestone has no features, so nothing can be demonstrated", r["_line"])
        for f in feats:
            placed.setdefault(f, []).append(mid)
            if prd and f not in prd["F"]:
                rep.error("R003", mid, f"lists {f}, which is not in the PRD", r["_line"])
        d = col(r, "date")
        try:
            dd = dt.date.fromisoformat(d)
            if last_date and dd < last_date:
                rep.warn("R004", mid, f"date {d} is earlier than the previous milestone", r["_line"])
            last_date = dd
        except ValueError:
            rep.warn("R005", mid, f"date '{d}' is not YYYY-MM-DD (dates stay 'TBD' until features are sized)", r["_line"])
        if col(r, "phase").upper() not in PHASES:
            rep.error("R006", mid, "phase must be P0..P5", r["_line"])
        if not real(col(r, "demo")) and not real(col(r, "acceptance")):
            rep.warn("R007", mid, "no demo script or acceptance reference", r["_line"])
    if prd:
        for fid, r in prd["F"].items():
            if col(r, "priority").lower() in ("must", "should") and fid not in placed:
                rep.warn("R008" if col(r, "priority").lower() == "should" else "R009", fid,
                         f"{col(r, 'priority')} feature is not assigned to any milestone")
    for f, ms in placed.items():
        if len(ms) > 1:
            rep.error("R010", f, f"assigned to more than one milestone: {', '.join(ms)}")
    return {"M": rm["M"], "placed": placed}


def load_status(root):
    text = read(os.path.join(root, "docs", "prd", "STATUS.md"))
    if text is None:
        return None
    ents, _ = entities(text)
    st = {"text": text, "M": {}, "F": {}, "T": {}, "D": {}}
    for k, v in ents.items():
        if k.startswith("M-"):
            st["M"][k] = v
        elif k.startswith("F-"):
            st["F"][k] = v
        elif k.startswith("T-"):
            st["T"][k] = v
    for hdr, rows in parse_tables(text):
        if hdr and hdr[0] == "id" and "decision" in hdr:
            for r in rows:
                if real(col(r, "decision")):
                    st["D"][r["id"]] = r
    m = re.search(r"Overall:\s*(\w+)", text)
    st["overall"] = m.group(1).upper() if m else ""
    m = re.search(r"Current phase:\s*(P\d)\s*([^\n]*?)(?:\s{2,}|\s+Overall|$)", text)
    st["phase"] = (m.group(1) + (" " + m.group(2).strip() if m.group(2).strip() else "")) if m else ""
    m = re.search(r"Release target:\s*([^\n]*?)(?:\s{2,}|\s+Current|$)", text)
    st["target"] = m.group(1).strip() if m else ""
    return st


def check_status(root, prd, rm, rep, today):
    st = load_status(root)
    if st is None:
        rep.error("S000", "STATUS.md", "docs/prd/STATUS.md not found. Run: prdtool.py init")
        return None
    if st["overall"] not in RAGS:
        rep.error("S001", "STATUS.md", "header must contain 'Overall: GREEN|AMBER|RED'")
    worst = {"GREEN": 0, "AMBER": 1, "RED": 2}
    for mid, r in st["M"].items():
        s = col(r, "state").lower()
        if s not in STATES:
            rep.error("S010", mid, f"state '{col(r, 'state')}' is not one of {sorted(STATES)} (no percentages)", r["_line"])
        rag = col(r, "rag").upper()
        if rag not in RAGS and s not in ("done", "deferred"):
            rep.error("S011", mid, "RAG must be GREEN, AMBER or RED", r["_line"])
        if rm and mid not in rm["M"]:
            rep.error("S012", mid, "milestone is not in 02-roadmap.md (drift)", r["_line"])
        try:
            if dt.date.fromisoformat(col(r, "date")) < today and s not in ("done", "deferred") and rag == "GREEN":
                rep.warn("S013", mid, "date has passed, not done, but marked GREEN", r["_line"])
        except ValueError:
            pass
        if st["overall"] in worst and rag in worst and worst[rag] > worst[st["overall"]]:
            rep.warn("S014", mid, f"milestone is {rag} but overall is {st['overall']}", r["_line"])
        if s == "done" and not real(col(r, "evidence")):
            rep.error("S015", mid, "a Done milestone needs evidence (demo link, sign-off record)", r["_line"])
    for fid, r in st["F"].items():
        s = col(r, "state").lower()
        if s not in STATES:
            rep.error("S020", fid, f"state '{col(r, 'state')}' is not one of {sorted(STATES)}", r["_line"])
        if prd and fid not in prd["F"]:
            rep.error("S021", fid, "feature is not in the PRD (scope drift: needs a change request)", r["_line"])
        m = re.search(r"(\d+)\s+of\s+(\d+)", col(r, "acceptance"))
        if s == "done" and not (m and m.group(1) == m.group(2) and int(m.group(2)) > 0):
            rep.error("S022", fid, "Done requires acceptance 'N of N pass' (every criterion passing)", r["_line"])
        if rm:
            want = [mid for mid, mr in rm["M"].items() if fid in ids_in(col(mr, "features"), "F")]
            got = col(r, "milestone")
            if want and got and got not in want:
                rep.error("S023", fid, f"milestone {got} disagrees with the roadmap ({', '.join(want)})", r["_line"])
    if prd:
        for fid, r in prd["F"].items():
            if col(r, "priority").lower() == "must" and fid not in st["F"]:
                rep.warn("S030", fid, "Must feature missing from STATUS.md")
    for tid, r in st["T"].items():
        if col(r, "state").lower() not in STATES:
            rep.error("S040", tid, f"state '{col(r, 'state')}' is not one of {sorted(STATES)}", r["_line"])
        f = col(r, "feature")
        if not re.match(r"^F-\d+$", f):
            rep.error("S041", tid, "every task belongs to exactly one feature (F-xx)", r["_line"])
        elif prd and f not in prd["F"]:
            rep.error("S042", tid, f"task belongs to {f}, which is not in the PRD (out of scope until a change request)", r["_line"])
    if rm:
        for mid, r in st["M"].items():
            if col(r, "state").lower() == "done" and mid in rm["M"]:
                for f in ids_in(col(rm["M"][mid], "features"), "F"):
                    fr = st["F"].get(f)
                    if not fr or col(fr, "state").lower() != "done":
                        rep.error("S050", mid, f"milestone is Done but {f} is not Done")
    return st


# ---------------------------------------------------------------- commands
def cmd_init(root):
    here = os.path.dirname(os.path.abspath(__file__))
    src = os.path.join(os.path.dirname(here), "templates", "prd")
    dst = os.path.join(root, "docs", "prd")
    if not os.path.isdir(src):
        print(f"templates not found at {src}")
        return 2
    n = 0
    for d, _, files in os.walk(src):
        rel = os.path.relpath(d, src)
        for f in files:
            t = os.path.normpath(os.path.join(dst, rel, f))
            if os.path.exists(t):
                print(f"keep   {os.path.relpath(t, root)}")
                continue
            os.makedirs(os.path.dirname(t), exist_ok=True)
            shutil.copy2(os.path.join(d, f), t)
            print(f"create {os.path.relpath(t, root)}")
            n += 1
    for d in ("features", "changes", "reports", "brand"):
        os.makedirs(os.path.join(dst, d), exist_ok=True)
    print(f"{n} file(s) created. Fill docs/prd/00-project-card.md and docs/prd/01-prd.md, add the brand guide to docs/prd/brand/, then run: prdtool.py lint")
    return 0


def cmd_lint(root, strict):
    rep = Report()
    prd = lint_prd(root, rep)
    lint_roadmap(root, prd, rep) if prd else None
    return rep.print("PRD lint", strict)


def cmd_check(root):
    rep = Report()
    prd = lint_prd(root, Report())  # parse only; PRD problems are reported by `lint`
    rm = lint_roadmap(root, prd, rep)
    check_status(root, prd, rm, rep, dt.date.today())
    return rep.print("Drift check")


def feature_file_state(root, fid):
    for p in glob.glob(os.path.join(root, "docs", "prd", "features", f"{fid}-*.md")) + \
             glob.glob(os.path.join(root, "docs", "prd", "features", f"{fid}.md")):
        fm = front_matter(read(p) or "")
        return fm.get("source-status", "present") or "present"
    return "missing"


def cmd_trace(root):
    rep = Report()
    prd = lint_prd(root, rep)
    if not prd:
        return 1
    rm = load_roadmap(root)
    st = load_status(root)
    mile = {}
    if rm:
        for mid, r in rm["M"].items():
            for f in ids_in(col(r, "features"), "F"):
                mile[f] = mid
    tasks = {}
    if st:
        for tid, r in st["T"].items():
            tasks.setdefault(col(r, "feature"), []).append(tid)
    out = ["# Traceability matrix", "", f"_Generated by prdtool.py on {dt.date.today()}. Do not edit by hand._", "",
           "| Feature | Priority | Needs | Goals | Users | Criteria | Analysis | Milestone | Tasks | State |",
           "|---|---|---|---|---|---|---|---|---|---|"]
    gaps = []
    for fid, r in prd["F"].items():
        ns = ids_in(col(r, "serves"), "N")
        gs = sorted({g for n in ns if n in prd["N"] for g in ids_in(col(prd["N"][n], "serves"), "G")})
        us = sorted({u for n in ns if n in prd["N"] for u in ids_in(col(prd["N"][n], "as", "i need"), "U")})
        ac = len(prd["acs"].get(fid, []))
        an = feature_file_state(root, fid)
        ms = mile.get(fid) or (col(st["F"][fid], "milestone") if st and fid in st["F"] else "") or "-"
        tk = ", ".join(tasks.get(fid, [])) or "-"
        state = col(st["F"][fid], "state") if st and fid in st["F"] else "-"
        out.append(f"| {fid} {col(r, 'feature')} | {col(r, 'priority')} | {', '.join(ns) or '-'} | {', '.join(gs) or '-'} | "
                   f"{', '.join(us) or '-'} | {ac} | {an} | {ms} | {tk} | {state} |")
        if col(r, "priority").lower() == "must":
            if ac < 3:
                gaps.append(f"{fid}: fewer than 3 acceptance criteria")
            if an == "missing":
                gaps.append(f"{fid}: no analysis file in docs/prd/features/")
            if ms == "-":
                gaps.append(f"{fid}: not assigned to a milestone")
    out += ["", "## Gaps", ""] + ([f"- {g}" for g in gaps] or ["- none"])
    path = os.path.join(root, "docs", "prd", "03-traceability.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"wrote {os.path.relpath(path, root)} ({len(prd['F'])} features, {len(gaps)} gap(s))")
    return 0


def latest_report_before(root, date):
    files = sorted(p for p in glob.glob(os.path.join(root, "docs", "prd", "reports", "????-??-??.md"))
                   if os.path.basename(p)[:10] < date)
    return files[-1] if files else None


def cmd_report(root, date):
    st = load_status(root)
    if not st:
        print("STATUS.md not found")
        return 1
    rep = Report()
    prd = lint_prd(root, Report())
    check_status(root, prd, load_roadmap(root), rep, dt.date.fromisoformat(date))
    errs = [i for i in rep.items if i[0] == "ERROR"]
    if errs:
        print("Refusing to report from an inconsistent STATUS.md. Fix these first:")
        rep.print("Drift check")
        return 1
    fm = (prd or {}).get("fm", {})
    done = [f for f, r in st["F"].items() if col(r, "state").lower() == "done"]
    prev = latest_report_before(root, date)
    prev_done = set(re.findall(r"F-\d+", (read(prev) or "").split("## Done")[-1].split("## ")[0])) if prev else set()
    new_done = [f for f in done if f not in prev_done]
    open_m = [(m, r) for m, r in st["M"].items() if col(r, "state").lower() not in ("done", "deferred")]
    nxt = open_m[0] if open_m else None
    total = len(st["F"])
    head = f"**Overall: {st['overall']}.** {len(done)} of {total} features done."
    if nxt:
        due = col(nxt[1], "date")
        verb = "was due" if due and due < date else "is due"
        head += f" Next milestone {nxt[0]} ({col(nxt[1], 'outcome')}) {verb} {due} and is {col(nxt[1], 'rag')}."
    out = [f"# Weekly report: {fm.get('project', 'Project')}", "", f"Date: {date} · Phase: {st['phase'] or '-'} · Release target: {st['target'] or '-'}", "",
           "## Headline", "", head, "", "## Milestone board", "",
           "| ID | Outcome | Date | State | RAG | Evidence |", "|---|---|---|---|---|---|"]
    shown = [(m, r) for m, r in st["M"].items() if col(r, "state").lower() != "deferred"]
    for m, r in shown:
        out.append(f"| {m} | {col(r, 'outcome')} | {col(r, 'date')} | {col(r, 'state')} | {col(r, 'rag') or '-'} | {col(r, 'evidence') or '-'} |")
    out += ["", "## Done this week", ""]
    out += [f"- {f} {col(st['F'][f], 'name')}" for f in new_done] or ["- nothing new reached Done"]
    out += ["", "## Planned next week", ""]
    cur = nxt[0] if nxt else None
    plan = [t for t, r in st["T"].items() if col(r, "state").lower() in ("in progress", "not started")]
    plan += [f for f, r in st["F"].items() if col(r, "state").lower() == "in review"]
    label = {**{t: f"{t} {col(r, 'task')} ({col(r, 'feature')})" for t, r in st["T"].items()},
             **{f: f"{f} {col(r, 'name')} (in review: needs your acceptance)" for f, r in st["F"].items()}}
    out += [f"- {label.get(p, p)}" for p in plan[:8]] or ["- see the milestone board"]
    out += ["", "## Decisions and inputs needed from you", ""]
    out += [f"- {r.get('id')}: {col(r, 'decision')}, needed by {col(r, 'needed by') or 'TBD'} (impact if late: {col(r, 'impact') or '-'})"
            for r in st["D"].values()] or ["- none"]
    out += ["", "## Changes", ""]
    prev_date = os.path.basename(prev)[:10] if prev else "0000-00-00"
    crs = []
    for p in sorted(glob.glob(os.path.join(root, "docs", "prd", "changes", "CR-*.md"))):
        if os.path.basename(p).startswith("CR-template"):
            continue
        f = front_matter(read(p) or "")
        s = f.get("status", "")
        if s == "proposed" or (s == "approved" and f.get("decided", "0000") > prev_date):
            crs.append(f"- {f.get('id', os.path.basename(p))}: {f.get('title', '')} ({s}; effect: {f.get('impact', 'see file')})")
    out += crs or ["- no change requests this week"]
    out += ["", "## Top risks", ""]
    risks = sorted((prd or {}).get("R", {}).items(), key=lambda kv: 0 if col(kv[1], "impact").upper().startswith("H") else 1)[:3]
    out += [f"- {k}: {col(r, 'assumption or risk')}. Mitigation: {col(r, 'mitigation')}" for k, r in risks] or ["- none recorded"]
    counts = {}
    for r in st["F"].values():
        counts[col(r, "state")] = counts.get(col(r, "state"), 0) + 1
    out += ["", "## Proof", "", "- Features by state: " + (", ".join(f"{k} {v}" for k, v in sorted(counts.items())) or "-")]
    blocked = [k for k, r in {**st["F"], **st["T"]}.items() if col(r, "state").lower() == "blocked"]
    out += [f"- Blocked: {', '.join(blocked) if blocked else 'none'}"]
    path = os.path.join(root, "docs", "prd", "reports", f"{date}.md")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"wrote {os.path.relpath(path, root)}")
    return 0


def cmd_status(root):
    prd_path = os.path.join(root, "docs", "prd", "01-prd.md")
    if not os.path.exists(prd_path):
        return 0
    prd_text = read(prd_path) or ""
    fm = front_matter(prd_text)
    st = load_status(root)
    line = [f"PRD: {fm.get('project', '?')} v{fm.get('version', '?')} ({fm.get('status', '?')})"]
    if st:
        counts = {}
        for r in st["F"].values():
            counts[col(r, "state")] = counts.get(col(r, "state"), 0) + 1
        cur = next(((m, r) for m, r in st["M"].items() if col(r, "state").lower() not in ("done", "deferred")), None)
        line.append(f"Phase {st['phase'] or '?'}, overall {st['overall'] or '?'}, target {st['target'] or '?'}")
        if cur:
            line.append(f"Current milestone {cur[0]}: {col(cur[1], 'outcome')} (due {col(cur[1], 'date')}, {col(cur[1], 'rag')})")
        line.append("Features: " + (", ".join(f"{k} {v}" for k, v in sorted(counts.items())) or "none listed"))
        blocked = [k for k, r in {**st["F"], **st["T"]}.items() if col(r, "state").lower() == "blocked"]
        if blocked:
            line.append("Blocked: " + ", ".join(blocked))
        if st["D"]:
            line.append(f"{len(st['D'])} decision(s) waiting on the client (see STATUS.md)")
    print("\n".join(line))
    return 0


def cmd_baseline(root):
    rep = Report()
    prd = lint_prd(root, rep)
    lint_roadmap(root, prd, rep) if prd else None
    code = rep.print("PRD lint (strict)", strict=True)
    if code:
        print("\nNot ready to baseline. Fix the items above.")
        return 1
    v = (prd["fm"].get("version") or "1.0").lstrip("v")
    print("\nReady. Set 'status: signed-off' and 'version: 1.0' in the PRD front matter, then run:")
    print("  git add docs/prd && git commit -m 'docs(prd): baseline v1.0' && git tag -a prd-v1.0 -m 'PRD baseline approved by <names> on <date>'")
    print(f"(current version field: {v})")
    return 0


def main(argv):
    args = argv[1:]
    root_arg = None
    if "--root" in args:
        i = args.index("--root")
        root_arg = args[i + 1]
        del args[i:i + 2]
    date = dt.date.today().isoformat()
    if "--date" in args:
        i = args.index("--date")
        date = args[i + 1]
        del args[i:i + 2]
    strict = "--strict" in args
    args = [a for a in args if a != "--strict"]
    if not args:
        print(__doc__)
        return 2
    root = find_root(root_arg)
    cmd = args[0]
    if cmd == "init":
        return cmd_init(root)
    if cmd == "lint":
        return cmd_lint(root, strict)
    if cmd == "check":
        return cmd_check(root)
    if cmd == "trace":
        return cmd_trace(root)
    if cmd == "report":
        return cmd_report(root, date)
    if cmd == "status":
        return cmd_status(root)
    if cmd == "baseline":
        return cmd_baseline(root)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
