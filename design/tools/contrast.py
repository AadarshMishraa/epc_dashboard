#!/usr/bin/env python3
"""WCAG contrast audit for tokens.css. Exit 1 on any failure.

usage: contrast.py [path/to/tokens.css]
Text pairs need 4.5, UI component edges and icons need 3.0.
"""
import re, sys, pathlib

path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).parent.parent / 'tokens.css')
css = path.read_text()

def block(selector):
    m = re.search(re.escape(selector) + r'\s*\{(.*?)\n\}', css, re.S)
    return m.group(1) if m else ''

def vars_of(text):
    return {k: v.strip() for k, v in re.findall(r'--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;', text)}

light = vars_of(block(':root,\n:root[data-theme="light"]'))
dark = {**light, **vars_of(block(':root[data-theme="dark"]'))}
base = vars_of(block(':root'))
light = {**base, **light}
dark = {**base, **dark}

def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

def lum(h):
    h = h.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

TEXT = 4.5
UI = 3.0
pairs = [
    ('text', 'bg-surface', TEXT), ('text', 'bg-app', TEXT), ('text', 'bg-subtle', TEXT), ('text', 'select-bg', TEXT),
    ('text-muted', 'bg-surface', TEXT), ('text-muted', 'bg-app', TEXT), ('text-muted', 'bg-subtle', TEXT),
    ('text-subtle', 'bg-surface', TEXT), ('text-subtle', 'bg-subtle', TEXT),
    ('text-on-chrome', 'bg-chrome', TEXT), ('text-on-chrome-muted', 'bg-chrome', TEXT), ('text-on-chrome-muted', 'bg-chrome-hover', TEXT),
    ('on-accent', 'accent', TEXT), ('on-accent', 'accent-hover', TEXT), ('on-accent', 'accent-active', TEXT),
    ('accent-text', 'bg-surface', TEXT), ('accent-text', 'accent-tint', TEXT),
    ('link', 'bg-surface', TEXT), ('link', 'bg-app', TEXT), ('select-text', 'select-bg', TEXT),
    ('success', 'success-bg', TEXT), ('warning', 'warning-bg', TEXT), ('danger', 'danger-bg', TEXT), ('info', 'info-bg', TEXT),
    ('success', 'bg-surface', TEXT), ('danger', 'bg-surface', TEXT),
    ('border-strong', 'bg-surface', UI), ('focus', 'bg-surface', UI), ('focus', 'bg-app', UI),
    ('accent', 'bg-chrome', UI), ('chart-1', 'bg-surface', UI), ('chart-accent', 'bg-surface', 1.0),
]
fail = 0
for theme, t in (('light', light), ('dark', dark)):
    for fg, bg, need in pairs:
        if fg not in t or bg not in t:
            continue
        r = ratio(t[fg], t[bg])
        if fg == 'accent' and bg == 'bg-surface':
            continue
        ok = r >= need
        if not ok:
            fail += 1
            print(f'FAIL {theme:5} {fg} on {bg}: {r:.2f} < {need}')
print('contrast audit:', 'FAILED' if fail else 'ok', f'({fail} failures)')
sys.exit(1 if fail else 0)
