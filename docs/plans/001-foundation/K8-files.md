# K8 Files and vault

Store and serve documents and photos safely: private by default, scanned, versioned, quota-aware and erasable.

- **Wave:** 5
- **Package:** `k8-files`
- **Needs:** K3, K4, K6, K7a
- **Tasks:** 12

Status: tick a task when its done-when and tests pass and the definition of done in [README](README.md) holds. Scope and acceptance live in [the PRD](../../prd/01-prd.md); the execution rules are in [the playbook](../README.md).

## Contract

- **Data:** file, file_version, file_link, doc_type, upload_session
- **Offers:** Files (put, get, signUrl, link), BlobStore, Scanner, Derivatives
- **Uses:** TenantContext, Authorizer, AuditSink, EraserRegistry (core ports); UsageMeter from K3; JobQueue from K6; Fields from K4
- **Events:** file.uploaded, file.quarantined, file.version_added, file.expiring, file.deleted
- **Extension points:** BlobStore, Scanner and Derivatives adapters; document types from packs

## Features delivered

- **F-57** Blob storage port and file model (Must, 3 acceptance criteria)
- **F-58** Secure upload and download (Must, 4 acceptance criteria)
- **F-59** Document types and expiry tracking (Must, 3 acceptance criteria)
- **F-60** Malware scan and derivatives (Should, 0 acceptance criteria)
- **F-61** File quotas and integrity (Should, 0 acceptance criteria)

### Capabilities

- [MVP] BlobStore port with S3-compatible and local-disk adapters
- [MVP] File model: metadata, hash, versions, links to entity references, document type
- [MVP] Upload flow: signed direct upload, size and type limits, content sniffing, checksum, resumable sessions for poor networks
- [MVP] Access classes (internal, restricted) and signed short-lived download URLs with a permission check
- [MVP] Tenant-prefixed keys; path-traversal and cross-tenant tests
- [v1] Document type registry from packs: required metadata, expiry dates that raise events
- [v1] Malware scan port with a quarantine state
- [v1] Derivatives (thumbnails, previews) through jobs; metadata stripping policy configurable
- [v1] Storage quotas and accounting through entitlements
- [v1] Orphan garbage collection and integrity verification
- [v1] Export and erase handlers for K7b; sensitive-access logging for K7a

### Failure modes and guards

- **Public bucket by mistake:** Deny-public check at startup and in CI; only signed URLs
- **Path traversal or cross-tenant read:** Server-generated tenant-prefixed keys only; negative tests
- **Malicious upload:** Type sniffing, size limits, scan port, quarantine
- **Orphan blobs after failed uploads:** Upload sessions expire; garbage collector
- **Download link leaks:** Short expiry, audience binding, access logged
- **Location metadata exposure:** Stripping policy per document type; geo-tag kept only where the pack needs it

## Security baseline for this module

Applies to every task below, on top of [the security guidelines](../../guidelines/security-guidelines.md).

- Buckets are private; downloads use short-lived signed URLs after a permission check; keys are tenant-prefixed.
- Validate size, declared type and sniffed content; store under generated names; reject path traversal; never serve user content from the application origin.
- Quarantine until scanned when scanning is enabled; strip metadata by policy; log sensitive downloads.

## Tasks

- [ ] **K8-T01** (T-108) BlobStore port with S3-compatible and local-disk adapters (M)
  - Feature: F-57 | Milestone: M-07 | Level: 4 | Lane: k8-files
  - Needs: K0-T06 (T-006)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: Both adapters pass the contract suite
  - Tests: contract suite
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K8-T02** (T-109) File model: metadata, hash, versions, entity links, document type (M)
  - Feature: F-57 | Milestone: M-07 | Level: 5 | Lane: k8-files
  - Needs: K1-T03 (T-017)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: Versions are immutable; links reference entities by id
  - Tests: unit tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K8-T03** (T-110) Upload flow: signed direct upload, limits, content sniffing, checksum, resumable sessions (M)
  - Feature: F-58 | Milestone: M-07 | Level: 6 | Lane: k8-files
  - Needs: K8-T01 (T-108), K8-T02 (T-109)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: malicious upload (type spoofing, oversize, zip bombs). Control: size caps, content sniffing, allow-listed types, generated names, checksum, resumable-session expiry.
  - Done when: An interrupted upload resumes; a wrong type or oversize file is refused
  - Tests: upload tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K8-T04** (T-111) Access classes and signed short-lived download URLs with permission check; no public bucket (M)
  - Feature: F-58 | Milestone: M-07 | Level: 6 | Lane: k8-files
  - Needs: K8-T02 (T-109), K0-T14 (T-014)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: unauthorised or shared downloads. Control: permission check before signing, 5-minute URLs, private buckets, no public ACLs.
  - Done when: A URL expires and is bound to its audience; a public bucket fails the startup check
  - Tests: access tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K8-T05** (T-112) Document type registry from packs: required metadata, expiry dates that raise events (S)
  - Feature: F-59 | Milestone: M-07 | Level: 7 | Lane: k8-files
  - Needs: K8-T02 (T-109), K4-T05 (T-060)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: An expiring document raises file.expiring on time
  - Tests: event test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K8-T06** (T-113) Malware scan port with quarantine state (S)
  - Feature: F-60 | Milestone: M-07 | Level: 7 | Lane: k8-files
  - Needs: K8-T03 (T-110)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: malware stored and served. Control: scan port with quarantine state; quarantined files are never downloadable.
  - Done when: A flagged file is quarantined and not downloadable
  - Tests: fake-scanner test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K8-T07** (T-114) Derivatives (thumbnails, previews) through jobs; metadata stripping policy (M)
  - Feature: F-60 | Milestone: M-07 | Level: 7 | Lane: k8-files
  - Needs: K8-T03 (T-110), K6-T06 (T-086)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: Derivatives appear after upload; stripping follows the document type policy
  - Tests: job and policy tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K8-T08** (T-115) Storage quotas and accounting through entitlements (S)
  - Feature: F-61 | Milestone: M-07 | Level: 9 | Lane: k8-files
  - Needs: K8-T02 (T-109), K3-T05 (T-049)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: Over-quota uploads are refused with a clear message
  - Tests: quota tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K8-T09** (T-116) Orphan garbage collection and integrity verification (S)
  - Feature: F-61 | Milestone: M-07 | Level: 6 | Lane: k8-files
  - Needs: K8-T02 (T-109), K6-T08 (T-088)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: Orphans are removed after the grace period; checksum mismatches are reported
  - Tests: gc and integrity tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K8-T10** (T-117) Export and erase handlers for K7b through the core EraserRegistry (S)
  - Feature: F-57 | Milestone: M-07 | Level: 6 | Lane: k8-files
  - Needs: K8-T02 (T-109), K0-T14 (T-014)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: A subject's files export and erase through the registry
  - Tests: drill test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K8-T11** (T-118) Tenant-prefixed keys, path-traversal and cross-tenant access tests (S)
  - Feature: F-58 | Milestone: M-07 | Level: 7 | Lane: k8-files
  - Needs: K8-T03 (T-110)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S3. Threat: path traversal and cross-tenant object access. Control: tenant-prefixed generated keys, normalised paths, negative tests for ../ and foreign prefixes.
  - Done when: No input can address another tenant's object
  - Tests: negative tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K8-T12** (T-119) Sensitive access logging through K7a (S)
  - Feature: F-58 | Milestone: M-07 | Level: 7 | Lane: k8-files
  - Needs: K8-T04 (T-111), K7-T06 (T-097)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: Every restricted download is audited
  - Tests: audit test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
