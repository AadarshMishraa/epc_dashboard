# Technical debt

| # | Debt | Why it waits | Owner task | Logged |
|---|---|---|---|---|
| TD-1 | A pack manifest's `version` and `depends` are not compared with any package or registry | Packs have no package.json or registry yet | K3-T01 module registry | 2026-11-04 |
| TD-2 | Migration ordering edges across packages (`gx:after`) | Package order is safe while no package touches another's objects; needed only if a contract migration removes something shared, such as a role | K1-T03 or the first shared object | 2026-11-04 |
| TD-3 | Public-API gate does not see module augmentation of an exported interface from another file | No package augments modules; add when one does | first module augmentation | 2026-11-04 |
| TD-4 | Declaration-emit error messages from the API gate include absolute source paths (error output only, never the report) | Cosmetic | K0-T10 CI output review | 2026-11-04 |
