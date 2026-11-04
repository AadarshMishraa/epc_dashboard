# Global regimes (apply when users, customers or data are there; verify before launch)

| Regime | Applies when | Engineering must-haves |
|---|---|---|
| GDPR (EU/EEA) / UK GDPR | Offering goods/services to, or monitoring, people in the EU/UK | Lawful basis per purpose, DPA with processors, records of processing, DPIA for high risk, rights within one month, breach notice to authority within 72 hours, transfer mechanism (SCCs/adequacy), EU representative if no EU establishment |
| CCPA/CPRA (California) | Business meets revenue or data-volume thresholds | Notice at collection, opt-out of sale/sharing, rights to know/delete/correct, service-provider contracts |
| HIPAA (US) | Serving US covered entities or business associates with health data | BAA, safeguards, audit logs, breach notification, minimum necessary |
| COPPA (US) | Children under 13 | Verifiable parental consent, limited collection |
| PCI DSS v4.0 | Handling card data anywhere | Use hosted payment fields/redirect to stay in the smallest scope (SAQ A); never log PAN |
| CAN-SPAM / TCPA (US) | Marketing email / calls and texts | Unsubscribe, sender identity; prior consent for automated texts/calls |
| UAE PDPL (Federal Decree-Law 45 of 2021); DIFC/ADGM own laws | Processing data of people in the UAE | Lawful basis, rights, breach notification, cross-border conditions (verify executive regulations status) |
| Saudi PDPL | Processing data of people in KSA | Registration with SDAIA where required, consent, transfer restrictions, breach reporting (verify implementing regulations) |
| Australia Privacy Act 1988 (APPs) | Entities above the turnover threshold or certain sectors | APP privacy policy, cross-border disclosure accountability, Notifiable Data Breaches scheme |

## Enterprise assurance (what B2B buyers ask for)
- Security questionnaire answers kept in a living document.
- SOC 2 Type II (US buyers) or ISO/IEC 27001 (global/Indian enterprises): start with the controls
  (access reviews, change management, backups, incident response, vendor management, logging) long
  before the audit; tools like Vanta/Drata/Sprinto shorten the path.
- Public trust page: sub-processors, data location, security practices, status page, contact.
- DPA template, SLA, data retention and deletion on contract end.
