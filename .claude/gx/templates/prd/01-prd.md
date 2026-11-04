---
project: <name>
client: <name>
version: 0.1-draft        # becomes 1.0 at sign-off
status: draft             # draft | in-review | signed-off
owner: <name>
approvers: [<client contact>, <you>]
---

# 1. Objective
Problem (3 sentences max): <who suffers, how, what it costs them today>
Why now: <trigger>

| ID | Goal | Metric | Baseline | Target | By when |
|----|------|--------|----------|--------|---------|
| G-01 | <outcome, not a feature> | <number + unit> | <today> | <target> | <date> |

# 2. Users
| ID | Role | Who they are | Device / language / tech comfort | How they do it today | Biggest pain | Primary? |
|----|------|--------------|----------------------------------|----------------------|--------------|----------|
| U-01 | <role> | <one line> | <phone, Hindi+English, low> | <Excel + WhatsApp> | <pain> | yes |

Buyer / payer: <who signs and pays, if not a user>

# 3. Needs
| ID | As (U-xx) I need | so that | Serves | Priority |
|----|------------------|---------|--------|----------|
| N-01 | As U-01 I need <capability, no UI words> | <outcome> | G-01 | Must |

# 4. Features
| ID | Feature | One line | Serves | Priority | Depends on |
|----|---------|----------|--------|----------|------------|
| F-01 | <name> | <what it does> | N-01 | Must | - |

Acceptance criteria (at least 3 per Must feature, Given / When / Then, with a number in the result):
F-01-AC1 Given <state> When <action> Then <observable result with a number>
F-01-AC2 Given <state> When <action> Then <observable result with a number>
F-01-AC3 Given <state> When <action> Then <observable result with a number>

# 5. Non-functional requirements
| ID | Area | Requirement | How verified |
|----|------|-------------|--------------|
| NF-01 | Performance | p95 page load under 2 s on 4G with 10,000 records | load test |
| NF-02 | Availability | 99.5% monthly; daily backups; restore tested once before launch | runbook drill |
| NF-03 | Security and privacy | <roles, data classes, retention in days, data residency> | review plus tests |
| NF-04 | Accessibility | WCAG 2.2 AA on all screens | axe scan plus manual keyboard pass |
| NF-05 | Scale | <users, peak concurrent, any limited-inventory flows> | load test |
| NF-06 | Devices and languages | <browsers, OS versions, languages> | test matrix |

# 6. Constraints
Industry and country: <decides the compliance regime>
Integrations: <payments, WhatsApp, maps, ERP, with the owner of each account>
Tech mandates: <must use / must not use>
Existing systems and data to migrate: <what, where, how clean>
Budget: <range>
Deadline: <date and why it is fixed>
Team: <who>

# 7. Out of scope
| ID | Not building | Why | Revisit |
|----|--------------|-----|---------|
| X-01 | <thing people will assume is included> | <reason> | <phase or never> |
| X-02 | <thing> | <reason> | <phase or never> |
| X-03 | <thing> | <reason> | <phase or never> |

# 8. Assumptions and risks
| ID | Assumption or risk | Likelihood | Impact | Mitigation | Owner |
|----|--------------------|-----------|--------|------------|-------|
| R-01 | <e.g. client data is incomplete> | M | H | <action> | <name> |

# 9. Success and launch criteria
Success (90 days after launch): <metrics tied to G-xx>
Launch gate: <must be true to go live: tests green, data migrated, users trained, sign-off>

# 10. Brand
Guide: docs/prd/brand/
Tone of voice: <3 adjectives>
References: <2-3 products whose feel you want>

# 11. Open questions and decisions
| ID | Question | Owner | Needed by | Answer |
|----|----------|-------|-----------|--------|
| Q-01 | <question> | <name> | <date> | |

# 12. Sign-off
Baseline v1.0 approved by: <name, date>
Later changes only via docs/prd/changes/CR-xxx.md
