# Improvement backlog (from gx-product-introspect and reviews)

| # | Suggestion | Why (user or risk evidence) | Effort S/M/L | Impact | Status |
|---|---|---|---|---|---|
| 1 | Retire or narrow legacy `privacycheck:ignore` (any rule, any path, no reason) so it cannot hide a real `aadhaar_no` column | Today one comment silences CMP-03 on a schema line | S | High | open |
| 2 | Run `.claude/gx/bin/test_privacycheck.py` in the K0-T10 CI privacycheck stage | Keeps the checker's own guarantees from regressing | S | Medium | open |
