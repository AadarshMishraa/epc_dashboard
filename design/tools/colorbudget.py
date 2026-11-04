#!/usr/bin/env python3
"""Measure the 80/20 color budget on a screenshot.

usage: colorbudget.py shot.png [--max-orange 20]

Pixels are bucketed by hue:
  orange  : hue 10-35 deg, saturation >= 0.55, value >= 0.45   (brand orange and its hover states)
  midnight: hue 200-265 deg with saturation >= 0.08            (blue family: chrome, tinted surfaces, charts, links)
  neutral : everything else (white, gray, text antialiasing)
Reports orange as a share of brand-hued pixels (orange + midnight). Fails if it exceeds --max-orange.
The 20 is a hard ceiling. The working target is 5 to 10, because dense data screens look noisy above that.
"""
import sys, colorsys, warnings
warnings.simplefilter('ignore')
from PIL import Image

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    limit = 20.0
    if '--max-orange' in sys.argv:
        limit = float(sys.argv[sys.argv.index('--max-orange') + 1])
    im = Image.open(sys.argv[1]).convert('RGB')
    im.thumbnail((720, 720))
    o = m = n = 0
    for r, g, b in im.getdata():
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        h *= 360
        if 10 <= h <= 35 and s >= 0.55 and v >= 0.45:
            o += 1
        elif 200 <= h <= 265 and s >= 0.08:
            m += 1
        else:
            n += 1
    tot = o + m + n
    brand = o + m
    share = 100 * o / brand if brand else 0
    print(f"orange {100*o/tot:.1f}% of frame | midnight family {100*m/tot:.1f}% | neutral {100*n/tot:.1f}%")
    print(f"orange share of brand-hued pixels: {share:.1f}% (limit {limit:.0f}%)")
    sys.exit(0 if share <= limit else 1)

if __name__ == '__main__':
    main()
