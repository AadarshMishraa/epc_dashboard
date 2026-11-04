# Breach runbook (one page)

Clocks start when we **notice** the incident, not when it began. Fill the names and phone numbers before launch.

| Within | Action | Owner |
|---|---|---|
| Now | Contain: revoke keys, disable the account or route, snapshot logs. Do not delete evidence. | On-call engineer |
| 1 hour | Classify: what data, whose, how many tenants, still happening? Open an incident record. | On-call, Aadarsh |
| 6 hours | Report to CERT-In if it is a reportable cyber incident (**verify** the current list). | Aadarsh |
| 24 hours (propose in the DPA) | Tell each affected tenant what happened, what data, what we did, what they must do. | Aadarsh |
| Without delay | Tenants tell the Board and affected people; we supply the facts and help. | Tenant, us |
| 72 hours | Detailed report to the Data Protection Board with the prescribed contents (Rule 7). Applies from 14 May 2027; practise it now. | Tenant, with our facts |
| After | Root cause, fix, test added, rule updated in `register.md`, entry in `.claude/memory/LEARNINGS.md`. | Team |

Contacts to fill: on-call engineer, Aadarsh, Harsh, counsel, CERT-In reporting channel, hosting provider support.
Evidence to keep: access logs (1 year minimum), the incident record, every message sent to tenants and the Board.
