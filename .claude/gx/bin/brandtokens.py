#!/usr/bin/env python3
"""Brand colours to accessible design tokens. Standard library only.

  brandtokens.py brand.json [--out DIR] [--check-only]

brand.json: {"name": "...", "colors": {"primary": "#hex", "background": "#hex", "foreground": "#hex",
             "secondary": "#hex (optional)", "accent": "#hex (optional)"},
             "fonts": {"heading": "...", "body": "...", "mono": "..."}, "radius": "8px"}

Brand colours are kept exactly as given where they are used as FILLS (buttons, logos, charts' first series).
Text, border and focus colours are derived or nudged only as far as needed to pass WCAG 2.2 AA (4.5:1 text,
3:1 UI components and large text). Every nudge is listed in contrast-report.md. Exit code 1 if a required pair still fails.
"""
import colorsys
import datetime as dt
import json
import os
import re
import sys

ADJ = []   # (token, from, to, reason)


def hex_to_rgb(h):
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        raise ValueError(f"not a hex colour: {h!r}")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return "#" + "".join(f"{max(0, min(255, round(c))):02X}" for c in rgb)


def lum(h):
    def f(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = hex_to_rgb(h)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def mix(a, b, t):
    """t=0 gives a, t=1 gives b."""
    ra, rb = hex_to_rgb(a), hex_to_rgb(b)
    return rgb_to_hex(tuple(x * (1 - t) + y * t for x, y in zip(ra, rb)))


def nudge(color, against, need, token, reason):
    """Move lightness away from the background(s) until the ratio passes. Hue and saturation are kept."""
    bgs = against if isinstance(against, list) else [against]
    if all(ratio(color, b) >= need for b in bgs):
        return color
    dark_bg = sum(lum(b) for b in bgs) / len(bgs) < 0.18
    r, g, b = (c / 255 for c in hex_to_rgb(color))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    step = 0.005 * (1 if dark_bg else -1)
    cur = l
    for _ in range(200):
        cur = max(0.0, min(1.0, cur + step))
        out = rgb_to_hex(tuple(c * 255 for c in colorsys.hls_to_rgb(h, cur, s)))
        if all(ratio(out, bg) >= need for bg in bgs):
            ADJ.append((token, color.upper(), out, reason))
            return out
        if cur in (0.0, 1.0):
            break
    fallback = "#FFFFFF" if dark_bg else "#000000"
    ADJ.append((token, color.upper(), fallback, reason + " (fell back to black/white)"))
    return fallback


def build(brand):
    c = brand.get("colors", {})
    if "primary" not in c:
        raise SystemExit("brand.json needs colors.primary")
    bg = c.get("background", "#FFFFFF").upper()
    fg_in = c.get("foreground", "#111827").upper()
    primary = c["primary"].upper()
    dark = lum(bg) < 0.18
    T = {}
    T["bg"] = bg
    T["fg"] = fg_in
    sec = c.get("secondary", "").upper()
    use_sec = bool(sec) and ratio(sec, bg) < 1.5
    if sec and not use_sec:
        ADJ.append(("surface-subtle", sec, "(derived)", "secondary is too far from the background to be a quiet surface; derived one instead"))
    surface = sec if use_sec else mix(bg, T["fg"], 0.05)
    for _ in range(4):   # body text must reach 7:1 on the page AND on the quiet surface; the derived surface moves with it
        T["fg"] = nudge(T["fg"], [bg, surface], 7.0, "fg", "body text needs 7:1 on the background and on the quiet surface")
        if use_sec:
            break
        surface = mix(bg, T["fg"], 0.05)
    T["surface-subtle"] = surface
    t = 0.35
    muted = mix(T["fg"], bg, t)
    while t > 0 and not all(ratio(muted, b) >= 4.5 for b in (bg, T["surface-subtle"])):
        t -= 0.02
        muted = mix(T["fg"], bg, max(t, 0))
    T["fg-muted"] = muted
    T["border"] = mix(bg, T["fg"], 0.14)
    t = 0.40
    strong = mix(bg, T["fg"], t)
    while t < 1 and not all(ratio(strong, b) >= 3.0 for b in (bg, T["surface-subtle"])):
        t += 0.02
        strong = mix(bg, T["fg"], min(t, 1))
    T["border-strong"] = strong
    T["primary"] = primary
    cands = [T["fg"], bg, "#FFFFFF", "#000000"]
    on = next((x for x in cands if ratio(x, primary) >= 4.5), None)
    T["on-primary"] = on or max(cands, key=lambda x: ratio(x, primary))
    T["primary-text"] = nudge(primary, [bg, T["surface-subtle"]], 4.5, "primary-text", "brand colour used as text/links must reach 4.5:1")
    hover = nudge(mix(primary, "#FFFFFF" if dark else "#000000", 0.10), bg, 1.0, "primary-hover", "")
    T["primary-hover"] = hover if ratio(T["on-primary"], hover) >= 4.5 else primary
    ring = T["primary-text"] if all(ratio(T["primary-text"], b) >= 3.0 for b in (bg, T["surface-subtle"])) else T["fg"]
    T["focus-ring"] = ring
    if c.get("accent"):
        T["accent"] = c["accent"].upper()
        T["accent-text"] = nudge(T["accent"], [bg, T["surface-subtle"]], 4.5, "accent-text", "accent used as text must reach 4.5:1")
    status = {"danger": ("#B42318", "#FEF3F2"), "warning": ("#92400E", "#FFFAEB"),
              "success": ("#067647", "#ECFDF3"), "info": ("#0F766E", "#F0FDFA")}
    for name, (txt, tint) in status.items():
        if dark:
            tint = mix(bg, txt, 0.18)
        T[f"{name}-bg"] = tint
        T[f"{name}-text"] = nudge(txt, tint, 4.5, f"{name}-text", "status text on its tint needs 4.5:1")
        T[f"{name}-border"] = T[f"{name}-text"]
    chart = [T["fg"], T["primary-text"], T["info-text"], "#6D28D9", T["fg-muted"]]
    for i, col in enumerate(chart, 1):
        T[f"chart-{i}"] = nudge(col.upper(), bg, 3.0, f"chart-{i}", "chart marks need 3:1 against the background")
    return T


def pairs(T):
    P = [("Body text", "fg", "bg", 7.0), ("Body text on quiet surface", "fg", "surface-subtle", 7.0),
         ("Muted text", "fg-muted", "bg", 4.5), ("Muted text on quiet surface", "fg-muted", "surface-subtle", 4.5),
         ("Button label on primary fill", "on-primary", "primary", 4.5), ("Button label on hover", "on-primary", "primary-hover", 4.5),
         ("Primary as text/link", "primary-text", "bg", 4.5), ("Primary as text on quiet surface", "primary-text", "surface-subtle", 4.5),
         ("Input / control border", "border-strong", "bg", 3.0), ("Control border on quiet surface", "border-strong", "surface-subtle", 3.0),
         ("Focus ring", "focus-ring", "bg", 3.0), ("Focus ring on quiet surface", "focus-ring", "surface-subtle", 3.0)]
    if "accent-text" in T:
        P.append(("Accent as text", "accent-text", "bg", 4.5))
    for n in ("danger", "warning", "success", "info"):
        P.append((f"{n.capitalize()} text on its tint", f"{n}-text", f"{n}-bg", 4.5))
    for i in range(1, 6):
        P.append((f"Chart series {i} on background", f"chart-{i}", "bg", 3.0))
    return P


def main(argv):
    args = argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return 2
    out_dir = None
    if "--out" in args:
        i = args.index("--out")
        out_dir = args[i + 1]
        del args[i:i + 2]
    check_only = "--check-only" in args
    path = [a for a in args if not a.startswith("--")][0]
    with open(path, encoding="utf-8") as f:
        brand = json.load(f)
    T = build(brand)
    P = pairs(T)
    rows, failed = [], 0
    for name, f, b, need in P:
        r = ratio(T[f], T[b])
        ok = r >= need
        failed += 0 if ok else 1
        rows.append((name, f, b, T[f], T[b], r, need, ok))
    print(f"{len(rows) - failed}/{len(rows)} pairs pass; {len(ADJ)} adjustment(s)")
    for tok, a, b, why in ADJ:
        print(f"  adjusted {tok}: {a} -> {b}  ({why})")
    for r in rows:
        if not r[7]:
            print(f"  FAIL {r[0]}: {r[1]} on {r[2]} = {r[5]:.2f}:1, needs {r[6]}:1")
    if check_only:
        return 1 if failed else 0
    out_dir = out_dir or os.path.dirname(os.path.abspath(path))
    os.makedirs(out_dir, exist_ok=True)
    fonts, radius = brand.get("fonts", {}), brand.get("radius", "8px")
    tokens = {"name": brand.get("name", ""), "generated": dt.date.today().isoformat(), "theme": "dark" if lum(T["bg"]) < 0.18 else "light",
              "color": T, "font": fonts, "radius": radius,
              "adjustments": [{"token": a, "from": b, "to": c, "reason": d} for a, b, c, d in ADJ],
              "pairs": [{"name": r[0], "fg": r[1], "bg": r[2], "ratio": round(r[5], 2), "required": r[6], "pass": r[7]} for r in rows]}
    with open(os.path.join(out_dir, "tokens.json"), "w", encoding="utf-8") as f:
        json.dump(tokens, f, indent=2)
        f.write("\n")
    css = ["/* Generated by brandtokens.py. Change brand.json, not this file. */", ":root {"]
    css += [f"  --color-{k}: {v};" for k, v in T.items()]
    css += [f"  --font-{k}: {v!r}, system-ui, sans-serif;".replace("'", '"') for k, v in fonts.items() if k != "mono"]
    if "mono" in fonts:
        css.append(f'  --font-mono: "{fonts["mono"]}", ui-monospace, monospace;')
    css += [f"  --radius: {radius};", "}"]
    with open(os.path.join(out_dir, "tokens.css"), "w", encoding="utf-8") as f:
        f.write("\n".join(css) + "\n")
    md = [f"# Contrast report: {brand.get('name', '')}", "", f"Generated {dt.date.today()} · standard: WCAG 2.2 AA (4.5:1 text, 3:1 large text and UI components)", "",
          f"**Result: {len(rows) - failed} of {len(rows)} pairs pass.**" + ("" if not failed else " FAILURES BELOW MUST BE FIXED."), "",
          "| Pair | Foreground | Background | Ratio | Needed | Result |", "|---|---|---|---|---|---|"]
    md += [f"| {r[0]} | {r[1]} {r[3]} | {r[2]} {r[4]} | {r[5]:.2f}:1 | {r[6]}:1 | {'pass' if r[7] else 'FAIL'} |" for r in rows]
    md += ["", "## Adjustments", "", "Brand colours used as fills are never changed. These tokens were derived or nudged:", ""]
    md += [f"- `{a}`: {b} to {c}. {d}" for a, b, c, d in ADJ] or ["- none: every derived colour passed as it was"]
    md += ["", "## Usage rules", "",
           "- Use `primary` only as a fill or large graphic; use `primary-text` for any text or link in the brand colour.",
           "- Text on a `primary` fill is `on-primary`, never white by default.",
           "- Never convey meaning by colour alone: pair status colours with an icon and a word.",
           "- Decorative borders may use `border`; any border that identifies a control (input, checkbox, card with action) uses `border-strong`.",
           "- Re-run this tool whenever brand.json changes; commit the three outputs together."]
    with open(os.path.join(out_dir, "contrast-report.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")
    print(f"wrote tokens.json, tokens.css, contrast-report.md in {out_dir}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
