# Data inventory

One row per kind of personal data. Add a row before adding a field. "Basis" is the tenant's call (we are the processor); we default to consent for marketing and to the customer voluntarily providing data for a named purpose for everything else. Retention values are **proposed defaults, RECOMMENDED**, set per tenant; legal minimums are marked.

| Data | Examples | Purpose | Features | Access | Retention (default) | Notes |
|---|---|---|---|---|---|---|
| Contact | Name, phone, email, address | Quote, install, service, billing | F-10, F-11, F-30 | Sales, accounts, supervisor | While the customer relationship is active, then anonymise on request | Masked in logs (CMP-16) |
| Lead capture | Source, ad form answers, enquiry text | Follow-up and source ROI | F-10, F-16 | Sales | Lost leads: set by tenant (propose 12 months) | Consent row mandatory (CMP-02) |
| Site and survey | Roof photos, geo-tag, shadow notes, load | Design and quote | F-20, F-21 | Survey crew, sales | Project life plus warranty period | Photos may show people: no faces required |
| Electricity data | Consumer number, bill photos, units | Sizing, DISCOM and subsidy filing | F-20, F-50, F-51 | Sales, approvals desk | Project life plus warranty period | Consumer number is personal data |
| Approval documents | DISCOM forms, commissioning certificate, inspection reports | Approvals and handover | F-52, F-36 | Approvals desk, accounts | Warranty period | ID proofs, if any: restricted role, never a text field (CMP-03) |
| Invoices and payments | Invoice, amount, GSTIN, UPI or bank reference | Billing, collections, tax | F-60 to F-67 | Accounts, owner | **6 years from the annual return due date** (CMP-08) | No card data (CMP-21) |
| Subsidy status | Stage, dates | Tracking only | F-51, F-54 | Approvals desk | Project life | No consumer bank details (CMP-27) |
| Equipment records | Serial numbers, install date, warranty end | Warranty and service | F-43, F-82 | Service, procurement | Warranty period | Not personal until linked to a customer |
| Messages | WhatsApp threads, call logs | Service and follow-up | F-90, F-92 | Assigned staff, owner | Tenant sets (propose 24 months) | Recordings off by default (CMP-14) |
| Tenant staff | Name, phone, role, attendance, field location, expenses, commission | Operations and payroll inputs | F-100 to F-104 | Owner, accounts | Employment plus statutory period: **verify** | Location only on check-in or job events (CMP-13) |
| Vendors and partners | Business contacts, GSTIN, bank details for payables | Procurement, payables, commission | F-41, F-68, F-102 | Procurement, accounts | While the vendor is active plus statutory period | Bank details encrypted, restricted role |
| Our account data | Staff logins, billing contacts | Run the service | Kernel | Us | While the account is active plus statutory period | We are the fiduciary here |
| Access and audit logs | Who did what, when | Security and accountability | F-211 | Admin, us | **At least 1 year** (CMP-05) | Held in India |
