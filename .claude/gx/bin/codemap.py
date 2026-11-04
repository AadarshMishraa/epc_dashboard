#!/usr/bin/env python3
"""codemap: a living, tiered map of a codebase for humans and agents.

Generates (default out dir: .claude/map/):
  MAP.md              level 0: modules, entry points, counts (read this first, small)
  modules/<mod>.md    level 1: every file in a module, one line each (symbols, calls)
  ROUTES.md           UI routes, API routes, server functions, and their files
  DATA.md             tables/models, where defined, who reads and who writes them
  diagrams/*.mmd      Mermaid: module graph, request flow, ER diagram
  system-design.html  open in a browser: all diagrams rendered
  map.json            everything, machine-readable (used for incremental updates)

Commands:
  codemap.py build                  full scan
  codemap.py update <file>...       incremental: re-scan only these files, re-render
  codemap.py find <term>            where does <term> live (files, symbols, routes, tables)
  codemap.py impact <file>          who depends on this file (transitive) + routes/tables touched
  codemap.py check                  is the map stale vs the working tree?

Options: --root <repo> (default: git toplevel or cwd)  --out <dir>
Python 3.9+, standard library only. Heuristic (regex) extraction: treat results as a
navigation aid, not as proof. Verify by reading the file before relying on a detail.
"""
import argparse
import datetime as _dt
import fnmatch
import hashlib
import json
import os
import re
import subprocess
import sys
from collections import defaultdict

VERSION = 1

CODE_EXT = {
    ".ts": "ts", ".tsx": "ts", ".js": "js", ".jsx": "js", ".mjs": "js", ".cjs": "js",
    ".py": "py", ".dart": "dart", ".go": "go", ".sql": "sql", ".prisma": "prisma",
    ".kt": "kotlin", ".swift": "swift", ".rb": "ruby", ".java": "java", ".php": "php",
    ".vue": "js", ".svelte": "js",
}
SKIP_DIRS = {
    "node_modules", ".git", ".next", "dist", "build", "out", ".turbo", ".vercel", "coverage",
    "__pycache__", ".venv", "venv", "env", ".dart_tool", "Pods", ".gradle", "vendor",
    ".expo", ".cache", ".idea", ".vscode", "target", ".svelte-kit", ".nuxt", "storybook-static",
}
SKIP_GLOBS = [
    "*.min.js", "*.d.ts", "*.g.dart", "*.freezed.dart", "*.generated.*", "*.lock",
    "*-lock.json", "*.map", ".claude/*", ".agents/*", "**/migrations/*.pyc",
]
MAX_FILE_BYTES = 400_000


# ----------------------------------------------------------------------------- utils

def sh(args, cwd):
    try:
        return subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=30).stdout
    except Exception:
        return ""


def repo_root(start):
    out = sh(["git", "rev-parse", "--show-toplevel"], start).strip()
    return out or os.path.abspath(start)


def load_config(root):
    p = os.path.join(root, ".claude", "gx", "config.json")
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return {}


def skipped(rel, cfg):
    parts = rel.split("/")
    if any(p in SKIP_DIRS for p in parts[:-1]):
        return True
    globs = SKIP_GLOBS + cfg.get("exclude", [])
    return any(fnmatch.fnmatch(rel, g) or fnmatch.fnmatch(parts[-1], g) for g in globs)


def list_files(root, cfg):
    out = sh(["git", "ls-files", "-co", "--exclude-standard"], root)
    files = out.splitlines() if out.strip() else None
    if files is None:
        files = []
        for d, dirs, names in os.walk(root):
            dirs[:] = [x for x in dirs if x not in SKIP_DIRS and not x.startswith(".")]
            for n in names:
                files.append(os.path.relpath(os.path.join(d, n), root).replace(os.sep, "/"))
    res = []
    for rel in files:
        ext = os.path.splitext(rel)[1].lower()
        if ext in CODE_EXT and not skipped(rel, cfg):
            res.append(rel)
    return sorted(set(res))


def module_of(rel, cfg):
    for pattern, name in cfg.get("modules", {}).items():
        if fnmatch.fnmatch(rel, pattern):
            return name
    depth = int(cfg.get("module_depth", 2))
    parts = rel.split("/")[:-1]
    if not parts:
        return "(root)"
    # skip wrapper dirs so web/src/components -> web/components
    if len(parts) > 2 and parts[1] in ("src", "lib", "app_src"):
        parts = [parts[0]] + parts[2:]
    return "/".join(parts[:depth])


def safe_read(path):
    try:
        if os.path.getsize(path) > MAX_FILE_BYTES:
            return None
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return None


# ----------------------------------------------------------------------- extraction

RX = {
    "ts_sym": re.compile(
        r"^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)",
        re.M),
    "ts_default_anon": re.compile(r"^\s*export\s+default\s+(?:async\s+)?function\s*\(", re.M),
    "ts_import": re.compile(
        r"""(?:import\s[^'"]*?from\s*|import\s*\(\s*|require\(\s*|export\s[^'"]*?from\s*|import\s+)['"]([^'"]+)['"]"""),
    "py_sym": re.compile(r"^(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)", re.M),
    "py_import": re.compile(r"^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))", re.M),
    "dart_sym": re.compile(r"^(?:abstract\s+|sealed\s+|final\s+|base\s+)*(?:class|mixin|enum|extension|typedef)\s+([A-Za-z_]\w*)", re.M),
    "dart_import": re.compile(r"""^\s*(?:import|export|part)\s+['"]([^'"]+)['"]""", re.M),
    "go_sym": re.compile(r"^(?:func\s+(?:\([^)]*\)\s*)?|type\s+)([A-Za-z_]\w*)", re.M),
    "sql_table": re.compile(r"create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.\"]+)", re.I),
    "sql_ref": re.compile(r"references\s+([\w.\"]+)", re.I),
    "sql_fn": re.compile(r"create\s+(?:or\s+replace\s+)?function\s+([\w.\"]+)", re.I),
    "sql_policy": re.compile(r"create\s+policy\s+\"?([^\"\n]+?)\"?\s+on\s+([\w.\"]+)", re.I),
    "prisma_model": re.compile(r"^model\s+(\w+)\s*\{", re.M),
    "django_model": re.compile(r"^class\s+(\w+)\(([\w.]*Model)\)", re.M),
    "fetch": re.compile(r"""\bfetch\(\s*[`'"]([^`'"]+)[`'"]"""),
    "axios": re.compile(r"""\b(?:axios|api|http|client)\.(get|post|put|patch|delete)\(\s*[`'"]([^`'"]+)[`'"]"""),
    "table_call": re.compile(r"""\.from\(\s*['"]([\w.]+)['"]\s*\)(?=([^;]{0,300}))""", re.S),
    "rpc": re.compile(r"""\.rpc\(\s*['"]([\w.]+)['"]"""),
    "invoke": re.compile(r"""functions\.invoke\(\s*['"]([\w-]+)['"]"""),
    "env": re.compile(
        r"""process\.env\.([A-Z][A-Z0-9_]+)|Deno\.env\.get\(\s*['"]([A-Z][A-Z0-9_]+)['"]|os\.(?:environ(?:\.get)?[\[(]|getenv\()\s*['"]([A-Z][A-Z0-9_]+)['"]|fromEnvironment\(\s*['"]([A-Z][A-Z0-9_]+)['"]|import\.meta\.env\.([A-Z][A-Z0-9_]+)"""),
    "django_path": re.compile(r"""\b(?:re_)?path\(\s*r?['"]([^'"]*)['"]\s*,\s*([\w.]+)"""),
    "express": re.compile(r"""\b(?:app|router|server|fastify)\.(get|post|put|patch|delete|all)\(\s*['"`]([^'"`]+)['"`]"""),
    "next_methods": re.compile(r"^\s*export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b", re.M),
    "server_action": re.compile(r"""^\s*['"]use server['"]""", re.M),
    "client_comp": re.compile(r"""^\s*['"]use client['"]""", re.M),
}
WRITE_RX = re.compile(r"\.(insert|update|upsert|delete)\(")


def first_sql_name(raw):
    return raw.replace('"', "").split(".")[-1].lower()


def next_route_from_path(rel):
    """app/(group)/foo/[id]/page.tsx -> /foo/[id]."""
    parts = rel.split("/")
    if "app" not in parts:
        return None
    seg = parts[parts.index("app") + 1:-1]
    seg = [s for s in seg if not (s.startswith("(") and s.endswith(")")) and not s.startswith("@")]
    return "/" + "/".join(seg)


def extract(rel, text, lang):
    info = {"lang": lang, "loc": text.count("\n") + 1, "symbols": [], "imports": [],
            "routes": [], "calls": [], "tables_read": [], "tables_write": [],
            "rpcs": [], "invokes": [], "env": [], "defines_tables": [], "table_refs": {},
            "kind": []}
    sym = []
    if lang in ("ts", "js"):
        sym = RX["ts_sym"].findall(text)
        if RX["ts_default_anon"].search(text):
            sym.append("default")
        info["imports"] = RX["ts_import"].findall(text)
        if RX["client_comp"].search(text[:300]):
            info["kind"].append("client")
        if RX["server_action"].search(text[:300]):
            info["kind"].append("server-action")
    elif lang == "py":
        sym = RX["py_sym"].findall(text)
        info["imports"] = [a or b for a, b in RX["py_import"].findall(text)]
        for name, base in RX["django_model"].findall(text):
            info["defines_tables"].append(name.lower())
        for url, view in RX["django_path"].findall(text):
            info["routes"].append({"type": "api", "path": "/" + url.lstrip("^/"), "handler": view})
    elif lang == "dart":
        sym = RX["dart_sym"].findall(text)
        info["imports"] = RX["dart_import"].findall(text)
    elif lang == "go":
        sym = RX["go_sym"].findall(text)
    elif lang == "sql":
        for raw in RX["sql_table"].findall(text):
            t = first_sql_name(raw)
            if t:
                info["defines_tables"].append(t)
        # attach references to the nearest preceding create table
        for m in re.finditer(r"create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.\"]+)(.*?)\);", text, re.I | re.S):
            t = first_sql_name(m.group(1))
            refs = sorted({first_sql_name(r) for r in RX["sql_ref"].findall(m.group(2))} - {t})
            if refs:
                info["table_refs"][t] = refs
        sym = [first_sql_name(x) + "()" for x in RX["sql_fn"].findall(text)]
        pol = RX["sql_policy"].findall(text)
        if pol:
            info["kind"].append(f"{len(pol)} policies")
    elif lang == "prisma":
        info["defines_tables"] = [m.lower() for m in RX["prisma_model"].findall(text)]

    info["symbols"] = list(dict.fromkeys(sym))[:40]

    if lang in ("ts", "js", "dart", "py"):
        info["calls"] = sorted({u for u in RX["fetch"].findall(text)} |
                               {f"{m.upper()} {u}" for m, u in RX["axios"].findall(text)})[:30]
        for table, tail in RX["table_call"].findall(text):
            t = table.split(".")[-1].lower()
            w = WRITE_RX.search(re.split(r"\.from\(|\n\s*\n", tail)[0])
            (info["tables_write"] if w else info["tables_read"]).append(t)
        info["tables_read"] = sorted(set(info["tables_read"]))
        info["tables_write"] = sorted(set(info["tables_write"]))
        info["rpcs"] = sorted(set(RX["rpc"].findall(text)))
        info["invokes"] = sorted(set(RX["invoke"].findall(text)))
        for groups in RX["env"].findall(text):
            info["env"].extend(g for g in groups if g)
        info["env"] = sorted(set(info["env"]))
        for m, p in RX["express"].findall(text):
            info["routes"].append({"type": "api", "path": p, "method": m.upper()})

    # framework routes by path convention
    base = rel.rsplit("/", 1)[-1]
    if lang in ("ts", "js"):
        r = next_route_from_path(rel)
        if r is not None and base.split(".")[0] == "page":
            info["routes"].append({"type": "page", "path": r})
        elif r is not None and base.split(".")[0] == "route":
            meth = RX["next_methods"].findall(text) or ["?"]
            info["routes"].append({"type": "api", "path": r, "method": ",".join(meth)})
        elif r is not None and base.split(".")[0] == "layout":
            info["kind"].append("layout")
        if "/pages/api/" in "/" + rel:
            p = "/" + rel.split("pages/", 1)[1].rsplit(".", 1)[0]
            info["routes"].append({"type": "api", "path": re.sub(r"/index$", "", p)})
        m = re.search(r"(?:^|/)supabase/functions/([\w-]+)/index\.ts$", rel)
        if m:
            info["routes"].append({"type": "function", "path": m.group(1)})
        if base.startswith("middleware."):
            info["kind"].append("middleware")
    return info


# ---------------------------------------------------------------- import resolution

def ts_aliases(root, files_set):
    """Find tsconfig/jsconfig 'paths' aliases. Returns list of (dir, prefix, target_dir)."""
    out = []
    for rel in sh(["git", "ls-files", "*tsconfig*.json", "*jsconfig.json"], root).splitlines() or []:
        txt = safe_read(os.path.join(root, rel))
        if not txt:
            continue
        txt = re.sub(r"//.*", "", txt)
        txt = re.sub(r",(\s*[}\]])", r"\1", txt)
        try:
            co = json.loads(txt).get("compilerOptions", {})
        except Exception:
            continue
        cdir = os.path.dirname(rel)
        base_url = co.get("baseUrl", ".")
        for alias, targets in (co.get("paths") or {}).items():
            if not targets:
                continue
            prefix = alias.rstrip("*")
            tgt = os.path.normpath(os.path.join(cdir, base_url, targets[0].rstrip("*"))).replace(os.sep, "/")
            out.append((cdir, prefix, "" if tgt == "." else tgt))
    return out


def resolve_candidates(base):
    exts = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".dart", ".py", "/index.ts", "/index.tsx",
            "/index.js", "/__init__.py"]
    return [base + e for e in exts]


def resolve_import(rel, spec, lang, ctx):
    files_set = ctx["files"]
    here = os.path.dirname(rel)
    cands = []
    if lang in ("ts", "js"):
        if spec.startswith("."):
            cands = resolve_candidates(os.path.normpath(os.path.join(here, spec)).replace(os.sep, "/"))
        else:
            for cdir, prefix, tgt in ctx["aliases"]:
                if prefix and spec.startswith(prefix) and (not cdir or rel.startswith(cdir + "/")):
                    rest = spec[len(prefix):]
                    cands += resolve_candidates("/".join(x for x in (tgt, rest) if x))
    elif lang == "dart":
        if spec.startswith("package:"):
            pkg, _, rest = spec[8:].partition("/")
            for pdir in ctx["dart_pkgs"].get(pkg, []):
                cands.append("/".join(x for x in (pdir, "lib", rest) if x))
        elif not spec.startswith("dart:"):
            cands.append(os.path.normpath(os.path.join(here, spec)).replace(os.sep, "/"))
    elif lang == "py":
        if spec.startswith("."):
            return None
        p = spec.replace(".", "/")
        for root_dir in ctx["py_roots"]:
            cands += [x for x in resolve_candidates("/".join(y for y in (root_dir, p) if y))]
    for c in cands:
        c = c.lstrip("./") if c.startswith("./") else c
        if c in files_set:
            return c
    return None


def build_ctx(root, files):
    files_set = set(files)
    dart_pkgs = defaultdict(list)
    for rel in sh(["git", "ls-files", "*pubspec.yaml"], root).splitlines():
        txt = safe_read(os.path.join(root, rel)) or ""
        m = re.search(r"^name:\s*([\w_]+)", txt, re.M)
        if m:
            dart_pkgs[m.group(1)].append(os.path.dirname(rel))
    py_roots = {""}
    for rel in files:
        if rel.endswith("manage.py") or rel.endswith("pyproject.toml") or rel.endswith("setup.py"):
            py_roots.add(os.path.dirname(rel))
    return {"files": files_set, "aliases": ts_aliases(root, files_set),
            "dart_pkgs": dict(dart_pkgs), "py_roots": sorted(py_roots)}


# ------------------------------------------------------------------------- scanning

def scan_file(root, rel, cfg):
    text = safe_read(os.path.join(root, rel))
    if text is None:
        return None
    lang = CODE_EXT[os.path.splitext(rel)[1].lower()]
    info = extract(rel, text, lang)
    info["module"] = module_of(rel, cfg)
    info["hash"] = hashlib.sha1(text.encode("utf-8", "replace")).hexdigest()[:12]
    return info


def link_imports(data, root):
    ctx = build_ctx(root, list(data["files"].keys()))
    for rel, info in data["files"].items():
        deps = []
        for spec in info.get("imports", []):
            tgt = resolve_import(rel, spec, info["lang"], ctx)
            if tgt and tgt != rel:
                deps.append(tgt)
        info["deps"] = sorted(set(deps))


def git_head(root):
    return sh(["git", "rev-parse", "--short", "HEAD"], root).strip() or "no-git"


def full_build(root, cfg):
    data = {"version": VERSION, "root": os.path.basename(root), "files": {}}
    for rel in list_files(root, cfg):
        info = scan_file(root, rel, cfg)
        if info:
            data["files"][rel] = info
    link_imports(data, root)
    return data


# ------------------------------------------------------------------------ rendering

def esc(s):
    return re.sub(r"[^\w]", "_", s)


def mm_label(s):
    return s.replace('"', "'")


def aggregate(data):
    files = data["files"]
    mods = defaultdict(lambda: {"files": [], "loc": 0, "deps": set(), "used_by": set(),
                                "routes": [], "tables_r": set(), "tables_w": set(), "invokes": set(),
                                "rpcs": set(), "env": set()})
    for rel, f in files.items():
        m = mods[f["module"]]
        m["files"].append(rel)
        m["loc"] += f["loc"]
        m["tables_r"] |= set(f.get("tables_read", []))
        m["tables_w"] |= set(f.get("tables_write", []))
        m["invokes"] |= set(f.get("invokes", []))
        m["rpcs"] |= set(f.get("rpcs", []))
        m["env"] |= set(f.get("env", []))
        for r in f.get("routes", []):
            m["routes"].append((r, rel))
    for rel, f in files.items():
        for d in f.get("deps", []):
            dm = files[d]["module"]
            if dm != f["module"]:
                mods[f["module"]]["deps"].add(dm)
                mods[dm]["used_by"].add(f["module"])
    tables = defaultdict(lambda: {"defined_in": set(), "read_by": set(), "written_by": set(), "refs": set()})
    for rel, f in files.items():
        for t in f.get("defines_tables", []):
            tables[t]["defined_in"].add(rel)
        for t, refs in f.get("table_refs", {}).items():
            tables[t]["refs"] |= set(refs)
        for t in f.get("tables_read", []):
            tables[t]["read_by"].add(rel)
        for t in f.get("tables_write", []):
            tables[t]["written_by"].add(rel)
    # a table defined in a real migration should not also list test fixtures as definitions
    for t, v in tables.items():
        real = {p for p in v["defined_in"] if not TEST_PATH.search(p)}
        if real:
            v["defined_in"] = real
    tables.pop("", None)
    return mods, tables


TEST_PATH = re.compile(r"(^|/)(tests?|__tests__|spec|manual-tests|fixtures?|load-tests|seeds?|e2e)(/|$)|_test\.|\.test\.|\.spec\.|fixture", re.I)


def file_line(rel, f):
    bits = []
    if f["symbols"]:
        s = f["symbols"][:6]
        bits.append(", ".join(s) + (" …" if len(f["symbols"]) > 6 else ""))
    for r in f.get("routes", []):
        bits.append(f"{r['type']} {r.get('method', '')} {r['path']}".replace("  ", " "))
    if f.get("tables_write"):
        bits.append("writes " + ",".join(f["tables_write"]))
    if f.get("tables_read"):
        bits.append("reads " + ",".join(f["tables_read"]))
    if f.get("invokes"):
        bits.append("invokes " + ",".join(f["invokes"]))
    if f.get("rpcs"):
        bits.append("rpc " + ",".join(f["rpcs"]))
    if f.get("defines_tables"):
        bits.append("defines " + ",".join(f["defines_tables"][:8]))
    if f.get("kind"):
        bits.append("[" + ",".join(f["kind"]) + "]")
    return f"- `{rel}` ({f['loc']}) — " + " · ".join(bits) if bits else f"- `{rel}` ({f['loc']})"


def render(data, root, out):
    files = data["files"]
    mods, tables = aggregate(data)
    now = _dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    head = git_head(root)
    os.makedirs(os.path.join(out, "modules"), exist_ok=True)
    os.makedirs(os.path.join(out, "diagrams"), exist_ok=True)
    banner = (f"<!-- GENERATED by .claude/gx/bin/codemap.py at {now} (git {head}). Do not edit by hand; "
              f"run `python3 .claude/gx/bin/codemap.py build`. -->\n")

    # MAP.md (level 0)
    lines = [banner, f"# Code map — {data['root']}", "",
             f"{len(files)} code files · {sum(f['loc'] for f in files.values()):,} lines · "
             f"{len(mods)} modules · {len(tables)} tables · generated {now} at `{head}`", "",
             "How to navigate: find the module below → open `modules/<module>.md` for its files → read only "
             "the file you need. `codemap.py find <term>` and `codemap.py impact <file>` answer most "
             "\"where is / what breaks\" questions without a repo-wide grep.", "",
             "| Module | Files | Lines | Depends on | Used by | Touches |", "|---|---|---|---|---|---|"]
    for name in sorted(mods, key=lambda n: -mods[n]["loc"]):
        m = mods[name]
        touch = []
        if m["tables_w"]:
            touch.append("writes " + ", ".join(sorted(m["tables_w"])[:5]) + ("…" if len(m["tables_w"]) > 5 else ""))
        if m["invokes"]:
            touch.append("invokes " + ", ".join(sorted(m["invokes"])[:4]))
        lines.append(f"| [{name}](modules/{esc(name)}.md) | {len(m['files'])} | {m['loc']:,} | "
                     f"{', '.join(sorted(m['deps'])[:5]) or '—'} | {', '.join(sorted(m['used_by'])[:5]) or '—'} | "
                     f"{'; '.join(touch) or '—'} |")
    entry = [rel for rel, f in files.items() if "middleware" in f.get("kind", []) or
             rel.endswith(("main.dart", "manage.py", "main.py", "app.py", "server.ts", "index.ts")) and rel.count("/") <= 2]
    if entry:
        lines += ["", "## Entry points", ""] + [f"- `{e}`" for e in sorted(entry)[:20]]
    env = sorted({e for f in files.values() for e in f.get("env", [])})
    if env:
        lines += ["", f"## Environment variables referenced ({len(env)})", "", ", ".join(f"`{e}`" for e in env)]
    lines += ["", "Other views: [ROUTES.md](ROUTES.md) · [DATA.md](DATA.md) · "
              "[system-design.html](system-design.html) · diagrams/*.mmd", ""]
    write(os.path.join(out, "MAP.md"), "\n".join(lines))

    # modules/*.md (level 1)
    keep = set()
    for name, m in mods.items():
        fn = esc(name) + ".md"
        keep.add(fn)
        body = [banner, f"# Module `{name}`", "",
                f"{len(m['files'])} files · {m['loc']:,} lines", "",
                f"Depends on: {', '.join(sorted(m['deps'])) or '—'}  ",
                f"Used by: {', '.join(sorted(m['used_by'])) or '—'}", ""]
        body += [file_line(rel, files[rel]) for rel in sorted(m["files"])]
        write(os.path.join(out, "modules", fn), "\n".join(body) + "\n")
    for old in os.listdir(os.path.join(out, "modules")):
        if old.endswith(".md") and old not in keep:
            os.remove(os.path.join(out, "modules", old))

    # ROUTES.md
    rl = [banner, "# Routes and server entry points", ""]
    for typ, title in (("page", "UI pages"), ("api", "API endpoints"), ("function", "Server / edge functions")):
        rows = sorted((r["path"], r.get("method", ""), rel) for rel, f in files.items()
                      for r in f.get("routes", []) if r["type"] == typ)
        if rows:
            rl += [f"## {title} ({len(rows)})", "", "| Path | Method | File |", "|---|---|---|"]
            rl += [f"| `{p}` | {m or '—'} | `{rel}` |" for p, m, rel in rows]
            rl.append("")
    write(os.path.join(out, "ROUTES.md"), "\n".join(rl))

    # DATA.md
    dl = [banner, "# Data: tables and who touches them", "",
          "Write detection is heuristic (`.from(t)` followed by insert/update/upsert/delete). "
          "Server-side SQL functions and triggers are not traced.", "",
          "| Table | Defined in | Written by | Read by | References |", "|---|---|---|---|---|"]
    for t in sorted(tables):
        v = tables[t]
        short = lambda s: ", ".join(f"`{x}`" for x in sorted(s)[:4]) + (f" +{len(s) - 4}" if len(s) > 4 else "")
        dl.append(f"| {t} | {short(v['defined_in']) or '—'} | {short(v['written_by']) or '—'} | "
                  f"{short(v['read_by']) or '—'} | {', '.join(sorted(v['refs'])) or '—'} |")
    write(os.path.join(out, "DATA.md"), "\n".join(dl) + "\n")

    # diagrams
    mg = ["flowchart LR"]
    for name in sorted(mods):
        mg.append(f'  {esc(name)}["{mm_label(name)}<br/>{len(mods[name]["files"])} files"]')
    for name in sorted(mods):
        for d in sorted(mods[name]["deps"]):
            mg.append(f"  {esc(name)} --> {esc(d)}")
    write(os.path.join(out, "diagrams", "modules.mmd"), "\n".join(mg) + "\n")

    fl = ["flowchart LR", "  subgraph Code", ]
    client_mods = [n for n in mods if mods[n]["tables_r"] or mods[n]["tables_w"] or mods[n]["invokes"] or mods[n]["rpcs"]]
    fn_mods = {}
    for rel, f in files.items():
        for r in f.get("routes", []):
            if r["type"] == "function":
                fn_mods[r["path"]] = f
    for n in sorted(client_mods):
        fl.append(f'    m_{esc(n)}["{mm_label(n)}"]')
    fl.append("  end")
    if fn_mods or any(mods[n]["invokes"] for n in mods):
        fl.append("  subgraph Server functions")
        for fn in sorted(set(fn_mods) | {i for n in mods for i in mods[n]["invokes"]}):
            fl.append(f'    f_{esc(fn)}(["{mm_label(fn)}"])')
        fl.append("  end")
    all_t = sorted(tables)
    if all_t:
        fl.append("  subgraph Database")
        for t in all_t:
            if tables[t]["read_by"] or tables[t]["written_by"]:
                fl.append(f'    t_{esc(t)}[("{mm_label(t)}")]')
        fl.append("  end")
    for n in sorted(client_mods):
        m = mods[n]
        for i in sorted(m["invokes"]):
            fl.append(f"  m_{esc(n)} -->|invoke| f_{esc(i)}")
        for t in sorted(m["tables_w"]):
            fl.append(f"  m_{esc(n)} -->|write| t_{esc(t)}")
        for t in sorted(m["tables_r"] - m["tables_w"]):
            fl.append(f"  m_{esc(n)} -.->|read| t_{esc(t)}")
    write(os.path.join(out, "diagrams", "request-flow.mmd"), "\n".join(fl) + "\n")

    er = ["erDiagram"]
    defined = [t for t in all_t if tables[t]["defined_in"]]
    for t in defined:
        er.append(f"  {esc(t)} {{\n    id pk\n  }}")
    for t in defined:
        for r in sorted(tables[t]["refs"]):
            if r in tables:
                er.append(f'  {esc(r)} ||--o{{ {esc(t)} : "has"')
    write(os.path.join(out, "diagrams", "er.mmd"), "\n".join(er) + "\n")

    html = HTML_TMPL.replace("{{TITLE}}", data["root"]).replace("{{META}}", f"generated {now} · git {head}")
    for key in ("modules", "request-flow", "er"):
        with open(os.path.join(out, "diagrams", f"{key}.mmd")) as f:
            html = html.replace("{{" + key + "}}", f.read().replace("<", "&lt;").replace("&lt;br/>", "<br/>"))
    write(os.path.join(out, "system-design.html"), html)

    data["generated"] = now
    data["head"] = head
    write(os.path.join(out, "map.json"), json.dumps(data, indent=1, sort_keys=True))


HTML_TMPL = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{{TITLE}} system design</title>
<style>
:root{--bg:#fff;--fg:#0A0F1E;--muted:#475569;--line:#E2E8F0}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0A0F1E;--fg:#F1F5F9;--muted:#94A3B8;--line:#1E293B}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px}h1{font-size:22px;margin:0 0 4px}
p{color:var(--muted);margin:0 0 16px}nav a{margin-right:16px;color:inherit}
section{border-top:1px solid var(--line);padding:16px 0;overflow-x:auto}h2{font-size:17px}
</style></head><body><main>
<h1>{{TITLE}}: system design (generated)</h1><p>{{META}} · regenerate with <code>codemap.py build</code></p>
<nav><a href="#m">Modules</a><a href="#f">Request flow</a><a href="#e">Data model</a></nav>
<section id="m"><h2>Module dependencies</h2><pre class="mermaid">{{modules}}</pre></section>
<section id="f"><h2>Request flow: code modules → server functions → tables</h2><pre class="mermaid">{{request-flow}}</pre></section>
<section id="e"><h2>Data model (foreign keys found in SQL)</h2><pre class="mermaid">{{er}}</pre></section>
</main>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script>mermaid.initialize({startOnLoad:true,securityLevel:'strict',maxEdges:2000,
theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'default'});</script>
</body></html>
"""


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


# ------------------------------------------------------------------------- commands

def load_map(out):
    try:
        with open(os.path.join(out, "map.json")) as f:
            return json.load(f)
    except Exception:
        return None


def cmd_update(root, out, cfg, paths):
    data = load_map(out)
    if data is None:
        data = full_build(root, cfg)
    else:
        for p in paths:
            rel = os.path.relpath(os.path.abspath(p), root).replace(os.sep, "/")
            ext = os.path.splitext(rel)[1].lower()
            if rel.startswith("..") or ext not in CODE_EXT or skipped(rel, cfg):
                continue
            if os.path.exists(os.path.join(root, rel)):
                info = scan_file(root, rel, cfg)
                if info:
                    data["files"][rel] = info
            else:
                data["files"].pop(rel, None)
        link_imports(data, root)
    render(data, root, out)


def cmd_find(out, term):
    data = load_map(out)
    if not data:
        print("No map yet. Run: codemap.py build")
        return 2
    t = term.lower()
    hits = []
    for rel, f in data["files"].items():
        why = []
        if t in rel.lower():
            why.append("path")
        why += [f"symbol {s}" for s in f["symbols"] if t in s.lower()][:3]
        why += [f"{r['type']} {r['path']}" for r in f.get("routes", []) if t in r["path"].lower()]
        why += [f"table {x}" for x in f.get("tables_read", []) + f.get("tables_write", []) + f.get("defines_tables", []) if t in x]
        why += [f"invokes {x}" for x in f.get("invokes", []) if t in x.lower()]
        why += [f"env {x}" for x in f.get("env", []) if t in x.lower()]
        if why:
            hits.append((rel, f["module"], why))
    for rel, mod, why in sorted(hits)[:60]:
        print(f"{rel}  [{mod}]  {'; '.join(dict.fromkeys(why))}")
    if len(hits) > 60:
        print(f"... {len(hits) - 60} more; narrow the term")
    if not hits:
        print("No match in the map. Fall back to a targeted grep.")
    return 0


def cmd_impact(root, out, target):
    data = load_map(out)
    if not data:
        print("No map yet. Run: codemap.py build")
        return 2
    rel = os.path.relpath(os.path.abspath(target), root).replace(os.sep, "/")
    if rel not in data["files"]:
        print(f"{rel} is not in the map (not a code file, excluded, or map stale).")
        return 2
    rev = defaultdict(set)
    for r, f in data["files"].items():
        for d in f.get("deps", []):
            rev[d].add(r)
    seen, frontier, depth = {}, [rel], 0
    while frontier and depth < 6:
        depth += 1
        nxt = []
        for x in frontier:
            for u in rev.get(x, ()):
                if u not in seen and u != rel:
                    seen[u] = depth
                    nxt.append(u)
        frontier = nxt
    f = data["files"][rel]
    print(f"# Impact of changing {rel}\n")
    print(f"Module: {f['module']} · exports: {', '.join(f['symbols'][:10]) or '—'}")
    if f.get("tables_write") or f.get("tables_read") or f.get("defines_tables"):
        print(f"Data: writes {f.get('tables_write') or '—'} · reads {f.get('tables_read') or '—'} · defines {f.get('defines_tables') or '—'}")
    print(f"\nDirect + transitive dependents ({len(seen)}):")
    routes = []
    for u, d in sorted(seen.items(), key=lambda kv: (kv[1], kv[0]))[:80]:
        print(f"  {'  ' * (d - 1)}{d}: {u}")
        routes += [(r, u) for r in data["files"][u].get("routes", [])]
    routes += [(r, rel) for r in f.get("routes", [])]
    if routes:
        print("\nUser-facing surfaces affected:")
        for r, u in routes[:40]:
            print(f"  {r['type']} {r.get('method', '')} {r['path']}  ({u})")
    tables = set(f.get("defines_tables", []))
    if tables:
        users = sorted({r for r, x in data["files"].items() if tables & set(x.get("tables_read", []) + x.get("tables_write", []))})
        print(f"\nFiles touching tables defined here ({len(users)}):")
        for u in users[:40]:
            print(f"  {u}")
    print("\nHeuristic: dynamic imports, string-built queries, DB triggers and other repos are NOT traced.")
    return 1 if seen else 0


def cmd_check(root, out, cfg):
    data = load_map(out)
    if not data:
        print("STALE: no map. Run codemap.py build")
        return 1
    current = set(list_files(root, cfg))
    mapped = set(data["files"])
    changed = [r for r in current & mapped
               if (scan_hash(root, r) or "") != data["files"][r]["hash"]]
    added, removed = sorted(current - mapped), sorted(mapped - current)
    if not (changed or added or removed):
        print(f"FRESH: map matches working tree ({len(current)} files, generated {data.get('generated')}).")
        return 0
    print(f"STALE: {len(changed)} changed, {len(added)} new, {len(removed)} deleted since {data.get('generated')}.")
    for r in (changed + added + removed)[:20]:
        print("  " + r)
    return 1


def scan_hash(root, rel):
    t = safe_read(os.path.join(root, rel))
    return hashlib.sha1(t.encode("utf-8", "replace")).hexdigest()[:12] if t is not None else None


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["build", "update", "find", "impact", "check"])
    ap.add_argument("args", nargs="*")
    ap.add_argument("--root")
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    root = os.path.abspath(a.root) if a.root else repo_root(os.getcwd())
    cfg = load_config(root)
    out = os.path.abspath(a.out) if a.out else os.path.join(root, cfg.get("map_dir", ".claude/map"))
    if a.cmd == "build":
        data = full_build(root, cfg)
        render(data, root, out)
        print(f"Mapped {len(data['files'])} files into {os.path.relpath(out, root)}/ (MAP.md, modules/, ROUTES.md, DATA.md, diagrams/, system-design.html)")
        return 0
    if a.cmd == "update":
        cmd_update(root, out, cfg, a.args)
        return 0
    if a.cmd == "find":
        return cmd_find(out, " ".join(a.args))
    if a.cmd == "impact":
        return cmd_impact(root, out, a.args[0]) if a.args else 2
    if a.cmd == "check":
        return cmd_check(root, out, cfg)


if __name__ == "__main__":
    sys.exit(main())
