# Dashboards and charts

## Dashboard rules
- A dashboard answers a small set of recurring questions for one role. Write those questions first; every element must serve one.
- Layout by importance: the exception list or the single most important number top-left; supporting context next; detail behind clicks.
- Exceptions over averages for operators ("4 jobs stuck > 15 days") ; trends over snapshots for owners reviewing weekly.
- Show freshness ("updated 9:12 am") and source on the page. Stale data must look stale.
- Every element drills down to the records behind it. A number nobody can act on should be removed.
- Fit the primary view in one screen at the target device width without scrolling for the L1 answer.

## Choose the chart by the question
| Question | Use | Avoid |
|---|---|---|
| How much, compared across categories | Horizontal bar, sorted | Pie with > 3 slices, 3D anything |
| How it changed over time | Line (many points), column (few periods) | Area stacks with many series |
| Part of a whole, 2–3 parts | Stacked bar or a single number with % | Donuts with tiny slices |
| Relationship between two measures | Scatter | Dual-axis lines (misleading) |
| Progress to a target | Bullet chart or bar with target marker | Gauges/speedometers |
| Distribution | Histogram / box plot | Averages alone |
| Exact values matter | A table | A chart |

## Chart hygiene
- Bars start at zero. Lines may not, but say so with the axis.
- Label series directly at the end of the line or on the bar; legends force memory lookups.
- ≤ 5 colours; grey for context, one strong colour for the thing to notice. Colour-blind safe palettes, plus shape or label redundancy.
- Annotate the event that explains the change ("New DISCOM rule from 1 Jun").
- Title states the takeaway when it's for decision-making ("Collections fell 18% in October"), the measure when it's for exploration.
- Indian number grouping and units (₹ L, ₹ Cr) consistently; tooltips show exact values.
- Every chart needs a text or table alternative for screen readers and export.
