# Brand folder

Put the client's brand material here: logo files, brand guide PDF, screenshots of the existing site or app.
Then create `brand.json` (copy `brand.json.example`) and run:

    python3 .claude/gx/bin/brandtokens.py docs/prd/brand/brand.json --out docs/prd/brand

It writes `tokens.json`, `tokens.css` and `contrast-report.md`. Brand colours are kept as given for fills and logos.
Text, border and focus colours are adjusted only as far as needed to pass WCAG 2.2 AA, and every adjustment is listed in the report.
If there is no brand guide, record the decision here (derive from the client's site, or choose a neutral palette) and say who approved it.
