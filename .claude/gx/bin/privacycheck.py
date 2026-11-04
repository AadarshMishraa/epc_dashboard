#!/usr/bin/env python3
"""privacycheck.py - cheap static checks for the rules in docs/compliance/register.md.

Usage: python3 .claude/gx/bin/privacycheck.py [ROOT] [--strict]
Exit 1 on any ERROR (and on WARN with --strict). Not a substitute for review: it catches the
mistakes that are easy to make and easy to grep for (CMP-03, 12, 15, 16).
"""
import os, re, sys

SKIP_DIRS = {".git", "node_modules", ".claude", "docs", "dist", "build", ".next", "venv", ".venv", "__pycache__", "coverage"}
EXTS = {".py", ".js", ".jsx", ".ts", ".tsx", ".sql", ".prisma", ".json", ".yml", ".yaml", ".env", ".html", ".tf", ".go", ".java", ".kt", ".swift", ".dart"}
SKIP_NAMES = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock"}

PII = r"(phone|mobile|email|aadhaar|aadhar|address|pan_?no|dob|consumer_?(no|number)|gstin)"
RULES = [
    # (id, level, regex, message)
    ("CMP-03", "ERROR", re.compile(r"\b(aadhaar|aadhar)[_-]?(no|number|num|id)?\b", re.I), "Aadhaar field/value: never store it (CMP-03)"),
    ("CMP-03", "ERROR", re.compile(r"\b(cvv|cvc|card_?number|card_?no|pan_?card_?number)\b", re.I), "card data field: we never store card data (CMP-03, CMP-21)"),
    ("CMP-27", "ERROR", re.compile(r"\b(consumer|customer|homeowner)_?(bank|ifsc|account_?no|account_?number)\b", re.I), "consumer bank detail: subsidy is credited to the consumer, not us (CMP-27)"),
    ("CMP-15", "ERROR", re.compile(r"[?&](phone|mobile|email|name|address|aadhaar)=", re.I), "personal data in a URL query string (CMP-15)"),
    ("CMP-16", "ERROR", re.compile(r"(console\.(log|info|debug|error|warn)|logger\.\w+|logging\.\w+|\blog\.\w+|print)\s*\(.*\b" + PII + r"\b", re.I), "personal data in a log call: mask it (CMP-16)"),
    ("CMP-12", "WARN", re.compile(r"\b(us-(east|west)-\d|eu-(west|central|north)-\d|ap-southeast-\d|ap-northeast-\d|sa-east-\d|westeurope|eastus|northeurope)\b", re.I), "non-India region string: hosting must be in India (CMP-12)"),
    ("CMP-16", "WARN", re.compile(r"(googletagmanager\.com|connect\.facebook\.net|static\.hotjar\.com|clarity\.ms|fullstory\.com|mixpanel\.com/lib|cdn\.segment\.com)", re.I), "third-party tracker: needs a DPA and no personal data (CMP-16)"),
    ("CMP-15", "WARN", re.compile(r"/(customers?|leads?|invoices?|projects?)/:?\{?(id|\d+)\}?/(track|pay|accept|public)", re.I), "public link uses a plain id: use an unguessable expiring token (CMP-15)"),
]

def scan(root):
    hits = []
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            if fn in SKIP_NAMES:
                continue
            ext = os.path.splitext(fn)[1].lower() or ("." + fn.lstrip(".") if fn.startswith(".env") else "")
            if ext not in EXTS and not fn.startswith(".env"):
                continue
            p = os.path.join(dp, fn)
            try:
                with open(p, encoding="utf-8", errors="ignore") as f:
                    for n, line in enumerate(f, 1):
                        if "privacycheck:ignore" in line:
                            continue
                        for rid, lvl, rx, msg in RULES:
                            if rx.search(line):
                                hits.append((lvl, rid, os.path.relpath(p, root), n, msg))
            except OSError:
                pass
    return hits

def main(argv):
    strict = "--strict" in argv
    args = [a for a in argv[1:] if not a.startswith("--")]
    root = args[0] if args else "."
    hits = scan(root)
    for lvl, rid, p, n, msg in sorted(hits):
        print(f"{lvl} {rid} {p}:{n} {msg}")
    errors = sum(1 for h in hits if h[0] == "ERROR")
    warns = len(hits) - errors
    print(f"privacycheck: {errors} error(s), {warns} warning(s)")
    return 1 if errors or (strict and warns) else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
