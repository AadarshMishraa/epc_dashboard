#!/usr/bin/env python3
"""Claude Code hook handler for the GX kit. Standard library only.

  gx_hook.py session-start   prints a context brief (memory + map status) into the session
  gx_hook.py post-edit       after Edit/Write: refresh the code map for that file, count edits
  gx_hook.py stop            before stopping: ask for tests if code changed without them, and for a memory checkpoint after N edits
  gx_hook.py pre-compact     before context compaction: auto-save a checkpoint to memory

Hooks must never break a session: every failure path exits 0 silently.
"""
import datetime as _dt
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
MEM = os.path.join(ROOT, ".claude", "memory")
STATE = os.path.join(ROOT, ".claude", "gx", "state")
DEFAULTS = {"test_nudge": True, "checkpoint_every_edits": 8, "brief_state_lines": 80, "auto_map": True}


def cfg():
    try:
        with open(os.path.join(ROOT, ".claude", "gx", "config.json")) as f:
            return {**DEFAULTS, **json.load(f)}
    except Exception:
        return dict(DEFAULTS)


def read_stdin():
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def sh(args, timeout=20):
    try:
        return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=timeout).stdout
    except Exception:
        return ""


def state_path(sid):
    os.makedirs(STATE, exist_ok=True)
    return os.path.join(STATE, f"{(sid or 'default')[:40]}.json")


def load_state(sid):
    try:
        with open(state_path(sid)) as f:
            return json.load(f)
    except Exception:
        return {"edits": [], "since_checkpoint": 0, "started": _dt.datetime.now().isoformat(timespec="minutes")}


def save_state(sid, st):
    try:
        with open(state_path(sid), "w") as f:
            json.dump(st, f)
    except Exception:
        pass


def head(path, n):
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()
        return lines[:n], len(lines)
    except Exception:
        return None, 0


def latest_sessions(k=2):
    d = os.path.join(MEM, "sessions")
    try:
        files = sorted((f for f in os.listdir(d) if f.endswith(".md") and not f.startswith("_") and f != "TEMPLATE.md"), reverse=True)
    except Exception:
        return []
    return [os.path.join(d, f) for f in files[:k]]


def section(path, title, n=8):
    lines, _ = head(path, 400)
    if not lines:
        return []
    out, on = [], False
    for ln in lines:
        if ln.startswith("## "):
            on = ln[3:].strip().lower().startswith(title)
            continue
        if on and ln.strip():
            out.append(ln)
            if len(out) >= n:
                break
    return out


def session_start():
    c = cfg()
    out = ["# GX context brief (auto-generated at session start)", ""]
    branch = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"]).strip()
    dirty = [l for l in sh(["git", "status", "--porcelain"]).splitlines() if l.strip()]
    if branch:
        out.append(f"Git: branch `{branch}`, {len(dirty)} uncommitted paths. Uncommitted files may be someone else's work.")
    st_lines, total = head(os.path.join(MEM, "CURRENT_STATE.md"), c["brief_state_lines"])
    if st_lines and any("YYYY-MM-DD by <session>" in l for l in st_lines[:4]):
        out += ["", "CURRENT_STATE.md is still the blank template. Initialise it this session from what you observe "
                "in the repo (skill: gx-project-memory)."]
    elif st_lines:
        out += ["", "## CURRENT_STATE.md" + (f" (first {len(st_lines)} of {total} lines)" if total > len(st_lines) else "")]
        out += st_lines
    else:
        out += ["", "No .claude/memory/CURRENT_STATE.md yet. Create it from the template before ending this session "
                "(skill: gx-project-memory)."]
    for p in latest_sessions(2):
        nxt = section(p, "next", 6)
        nv = section(p, "not verified", 4)
        out += ["", f"## Last session: {os.path.basename(p)}"]
        if nxt:
            out += ["Next:"] + nxt
        if nv:
            out += ["Not verified:"] + nv
    learn, n = head(os.path.join(MEM, "LEARNINGS.md"), 60)
    if learn:
        bullets = [l for l in learn if l.startswith("- ")][-10:]
        if bullets:
            out += ["", f"## Recent learnings ({len(bullets)} shown; full file: .claude/memory/LEARNINGS.md)"] + bullets
    pt = os.path.join(HERE, "prdtool.py")
    if os.path.exists(pt) and os.path.exists(os.path.join(ROOT, "docs", "prd", "01-prd.md")):
        ps = sh([sys.executable, pt, "status", "--root", ROOT], timeout=30).strip()
        if ps:
            out += ["", "## Project delivery status (docs/prd/STATUS.md)", ps,
                    "Work only on tasks that trace to an F-id in the PRD. Update STATUS.md before you stop "
                    "(skill: gx-project-bootstrap)."]
    cm = os.path.join(HERE, "codemap.py")
    if os.path.exists(cm) and c.get("auto_map", True):
        chk = sh([sys.executable, cm, "check"], timeout=60).strip().splitlines()
        if chk and chk[0].startswith("STALE"):
            sh([sys.executable, cm, "build"], timeout=120)
            out += ["", "Code map was stale and has been rebuilt: .claude/map/MAP.md"]
        elif chk:
            out += ["", "Code map: " + chk[0] + " Start navigation at .claude/map/MAP.md."]
    out += ["", "Protocol: plan non-trivial work with gx-feature-plan before editing; checkpoint memory with "
            "gx-project-memory before you stop or when asked; keep docs/architecture/system-design.md current "
            "(gx-system-design)."]
    print("\n".join(out))


TEST_RX = re.compile(r"(^|/)(tests?|__tests__|spec|e2e|cypress|integration_test|supabase/tests)(/|$)|(\.|_)(test|spec)\.[a-z]+$|_test\.(py|go|dart)$|(^|/)test_[^/]+\.py$", re.I)
CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".dart", ".go", ".sql", ".kt", ".swift", ".rb", ".java", ".php", ".vue", ".svelte"}


def classify(rel):
    ext = os.path.splitext(rel)[1].lower()
    if ext not in CODE_EXT:
        return None
    if TEST_RX.search(rel):
        return "test"
    if rel.startswith((".claude/", "docs/")) or "/node_modules/" in rel or rel.endswith((".d.ts", ".config.js", ".config.ts")):
        return None
    return "code"


def is_memory(path):
    return os.path.abspath(path).startswith(os.path.abspath(MEM) + os.sep)


def post_edit():
    data = read_stdin()
    ti = data.get("tool_input") or {}
    path = ti.get("file_path") or ti.get("path") or ""
    if not path:
        return
    if not os.path.isabs(path):
        path = os.path.join(ROOT, path)
    sid = data.get("session_id")
    st = load_state(sid)
    if path.replace(os.sep, "/").endswith("docs/prd/STATUS.md"):
        st["status_touched"] = True
    if is_memory(path):
        st["since_checkpoint"] = 0
        st["last_checkpoint"] = _dt.datetime.now().isoformat(timespec="minutes")
    elif "/.claude/map/" not in path and "/.claude/gx/state/" not in path:
        rel = os.path.relpath(path, ROOT)
        if rel not in st["edits"]:
            st["edits"].append(rel)
        st["since_checkpoint"] = st.get("since_checkpoint", 0) + 1
        kind = classify(rel)
        if kind == "code":
            st["code_edits"] = st.get("code_edits", 0) + 1
        if kind == "code" and rel not in st.setdefault("untested", []):
            st["untested"].append(rel)
        elif kind == "test":
            st["tests_touched"] = st.get("tests_touched", 0) + 1
        cm = os.path.join(HERE, "codemap.py")
        if cfg().get("auto_map", True) and os.path.exists(cm) and os.path.exists(os.path.join(ROOT, ".claude", "map", "map.json")):
            sh([sys.executable, cm, "update", path], timeout=60)
    save_state(sid, st)


def stop():
    data = read_stdin()
    if data.get("stop_hook_active"):
        return
    sid = data.get("session_id")
    st = load_state(sid)
    n = st.get("since_checkpoint", 0)
    parts = []
    untested = st.get("untested", [])
    if untested and cfg().get("test_nudge", True):
        shown = ", ".join(untested[:8]) + (f" +{len(untested) - 8} more" if len(untested) > 8 else "")
        had = st.get("tests_touched", 0)
        parts.append(
            f"GX test gate: source files were edited this session ({shown}) and "
            + (f"only {had} test edit(s) were made." if had else "no test files were touched.")
            + " Before stopping, run the gx-test-feature skill on what changed: pick the applicable angles "
            "(happy path, boundaries, invalid input, permissions, tenant isolation, idempotency, concurrency, "
            "failure injection, data/migration, UI states, accessibility, old-client compatibility, performance, "
            "security), write the missing tests in the project's framework, run them, do the mutation check, and "
            "report the angle matrix. If a change genuinely needs no tests (docs, rename, config), say so and why.")
        st["untested"] = []
        st["tests_touched"] = 0
    if n >= int(cfg()["checkpoint_every_edits"]):
        st["since_checkpoint"] = 0
        recent = ", ".join(st["edits"][-8:])
        parts.append(
            f"GX checkpoint: {n} file edits since the last memory update ({recent}). Use gx-project-memory: "
            "append to today's .claude/memory/sessions/ file (done / verified / not verified / next), update "
            "CURRENT_STATE.md if status changed, add traps to LEARNINGS.md, and update "
            "docs/architecture/system-design.md if a component, API call or data flow changed. Keep it short.")
    if (st.get("code_edits", 0) and not st.get("status_touched") and not st.get("status_nudged")
            and os.path.exists(os.path.join(ROOT, "docs", "prd", "STATUS.md"))):
        st["status_nudged"] = True
        parts.append(
            "GX delivery status: code changed this session but docs/prd/STATUS.md was not updated. Update the task and "
            "feature rows you touched (state from the closed set; acceptance as 'n of N pass'; blockers with an owner "
            "and a fix date), then run `python3 .claude/gx/bin/prdtool.py check` and fix any drift. If the work traces to "
            "no F-id, say so: it is a defect in an existing feature or it needs a change request.")
    if parts:
        save_state(sid, st)
        print(json.dumps({"decision": "block", "reason": " ALSO: ".join(parts)}))


def pre_compact():
    data = read_stdin()
    sid = data.get("session_id")
    st = load_state(sid)
    os.makedirs(os.path.join(MEM, "sessions"), exist_ok=True)
    now = _dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    status = sh(["git", "status", "--short"]).strip().splitlines()[:30]
    lines = [f"\n## Auto-checkpoint before compaction, {now} ({data.get('trigger', 'auto')})",
             f"Session started {st.get('started', '?')}; files edited: {', '.join(st['edits'][-30:]) or 'none'}",
             "git status:", *[f"    {s}" for s in status],
             "This entry is mechanical. The agent should replace it with a real summary via gx-project-memory."]
    try:
        with open(os.path.join(MEM, "sessions", "_autosave.md"), "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    except Exception:
        pass


if __name__ == "__main__":
    try:
        {"session-start": session_start, "post-edit": post_edit, "stop": stop,
         "pre-compact": pre_compact}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: None)()
    except Exception:
        pass
    sys.exit(0)
