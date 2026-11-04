"""Agent assignment, security level and security requirements per task.

Rules (applied by gen.py):
  Builder   gx-implementer builds every task. Human-gated tasks are decided by Aadarsh first; gx-planner drafts the ADR.
  Tests     gx-qa-engineer writes the test pack when the tests column names matrix, property, chaos, soak, contract,
            conformance, escalation, seeded or negative cases.
  Review    gx-staff-reviewer reviews every M task and every task that changes a public API; S tasks at the module gate.
            gx-security-reviewer blocks the merge on S3 tasks and reviews S2 tasks at the module gate.
            gx-ux-reviewer reviews every UI task.
  Map       gx-cartographer refreshes the code map at the end of each wave.
"""
import re

HUMAN_GATES = {
    "K0-T01": "Done: ADR-0006 accepted 2026-11-04. Before K0-T02, create the Supabase and Vercel projects in Mumbai and record the Postgres major version in the K0 brief.",
    "K2-T15": "ADR-0006 sets the direction: delegate the protocol to Supabase Auth. Before code, confirm GA, connector conformance and password-policy fit; if any fails, gx-planner drafts a follow-up ADR and Aadarsh decides.",
    "K4-T06": "Record the custom-field storage ADR (column per field, JSON document, or EAV) with a benchmark before code. gx-planner drafts; Aadarsh decides.",
    "K3-T09": "Decide Q-07 (licence and IP model) with counsel before code. gx-planner drafts; Aadarsh decides.",
    "UI-T03": "Decided in ADR-0006: React wrappers over the CSS classes. Record conventions in the package README; no new decision needed.",
}

# S3 = security-critical: authN, authZ, tenancy, crypto, secrets, ingress of untrusted input, audit integrity, privacy erasure.
S3 = {
    "K0-T10", "K0-T14", "K0-T04",
    "K1-T02", "K1-T03", "K1-T05", "K1-T06", "K1-T11",
    "K2-T02", "K2-T03", "K2-T04", "K2-T05", "K2-T06", "K2-T08", "K2-T09", "K2-T10", "K2-T12", "K2-T13", "K2-T14", "K2-T15", "K2-T16", "K2-T18",
    "K3-T04", "K3-T09",
    "K4-T05", "K4-T08",
    "K5-T03",
    "K6-T02",
    "K7-T01", "K7-T04", "K7-T05", "K7-T06", "K7-T07", "K7-T10", "K7-T13", "K7-T14",
    "K8-T03", "K8-T04", "K8-T06", "K8-T11",
    "UI-T11", "UI-T14",
}

SEC_MODULE = {
    "K0": ["No secret, key or personal data in the repository, fixtures or logs; secrets come only through SecretsProvider.",
           "Pin and lock dependencies; the build fails on known critical advisories and on committed secret patterns.",
           "Fakes must fail closed: the fake Authorizer denies by default, the fake EntitlementGate denies unknown keys."],
    "K1": ["Tenant context is mandatory and fails closed; no default tenant exists.",
           "Every tenant table has forced row-level security, a restrictive policy and composite foreign keys; the app role is not the owner and has no BYPASSRLS.",
           "Unknown or suspended tenants get the same generic response; no tenant names or counts appear in errors.",
           "Add a negative cross-tenant test for every new table and every new query path."],
    "K2": ["Deny by default; every decision returns a reason code; the service layer authorizes, never the UI.",
           "Secrets, tokens and hashes are never logged; compare in constant time; responses for unknown accounts match known ones.",
           "Rate limit and lock out on every credential-bearing endpoint; raise auth events for the audit log.",
           "Follow NIST SP 800-63B-4 and OAuth 2.1 practice: PKCE S256 only, exact redirect matching, no tokens in URLs, rotating refresh tokens."],
    "K3": ["Entitlement checks fail closed for security-relevant keys; the per-key failure policy is explicit and tested.",
           "Admin interfaces require platform-operator permissions and are audited; overrides carry an expiry and a reason.",
           "Licence verification is offline, signature-checked and rejects downgrade and clock rollback."],
    "K4": ["Validate every write against the registered schema at the boundary; reject unknown keys.",
           "Every custom field carries a data classification; classified values are masked in logs, diffs and exports.",
           "The expression evaluator has a closed grammar, no I/O, bounded depth, size and time; evaluate untrusted input only inside it.",
           "Config bundles are verified before apply; a failed apply changes nothing."],
    "K5": ["Transitions authorize the actor on every call; guards and actions run with the acting tenant context.",
           "Actions cannot escalate privileges; the loop guard bounds cascades.",
           "Workflow definitions are validated before publish; published versions are immutable."],
    "K6": ["Events and jobs always carry a tenant; the worker restores context before running and fails closed without it.",
           "Payloads exclude classified data unless the event type declares it; large or sensitive data is passed by reference.",
           "Handlers are idempotent; poison messages cannot block a queue; replay requires a permission and is audited."],
    "K7": ["Audit rows are append-only and written in the same transaction; critical actions fail closed when the audit write fails.",
           "Diffs and exports mask classified values; exports neutralise formula injection.",
           "Consent, notices, requests and incidents keep evidence (who, what, when, version) and never overwrite history.",
           "Erasure and export handlers are registered by every module that stores personal data; statutory holds are recorded, not skipped silently."],
    "K8": ["Buckets are private; downloads use short-lived signed URLs after a permission check; keys are tenant-prefixed.",
           "Validate size, declared type and sniffed content; store under generated names; reject path traversal; never serve user content from the application origin.",
           "Quarantine until scanned when scanning is enabled; strip metadata by policy; log sensitive downloads."],
    "UI": ["No innerHTML, eval or inline handlers; render text as text; sanitize any rich text with an allow-list.",
           "No secrets or personal data in browser storage, URLs or the bundle; the interface never replaces server authorization.",
           "Components work under script-src 'self' and style-src 'self' with no inline style attributes."],
}

SEC_TASK = {
    "K0-T04": "Threat: personal data leaks through logs. Control: redact by classification before write; test with seeded phone, email and ID values.",
    "K0-T10": "Threat: vulnerable or tampered dependency, leaked secret. Control: lockfile, advisory scan, secret scan, pinned CI actions, no secrets in CI logs.",
    "K0-T14": "Threat: a fake or port that fails open. Control: deny-by-default fakes; contract suite proves denial on missing permission, key or classification.",
    "K1-T02": "Threat: code path runs without tenant. Control: requireTenant throws TENANT_REQUIRED; context survives async hops; test with background jobs.",
    "K1-T03": "Threat: RLS bypass through owner role, missing policy or pooled-connection setting leak. Control: non-owner role, forced RLS, set-local per transaction, pool-leak test.",
    "K1-T05": "Threat: tenant enumeration and host-header spoofing. Control: generic 404, allow-list of domains, claim and host must agree.",
    "K1-T06": "Threat: routing sends one tenant to another's database. Control: routing table is signed or admin-only, audited, and verified by a canary query.",
    "K1-T11": "Threat: silent or open-ended operator access. Control: reason, tenant consent policy, hard expiry, read-only by default, every action audited.",
    "K2-T02": "Threat: offline cracking of stolen hashes. Control: memory-hard hash with versioned parameters, pepper from SecretsProvider, rehash on login.",
    "K2-T03": "Threat: weak or breached passwords. Control: minimum 15 characters as the only factor, allow 64 or more, blocklist screening, no forced rotation, no composition rules.",
    "K2-T04": "Threat: account enumeration and one-time-code guessing. Control: uniform responses, code expiry and attempt limits, codes stored hashed.",
    "K2-T05": "Threat: token theft and replay. Control: 15-minute access tokens, rotating refresh with reuse detection revoking the family, httpOnly cookies, device list and revoke.",
    "K2-T06": "Threat: MFA bypass and recovery-code abuse. Control: single-use hashed recovery codes, TOTP replay window, rate limit, step-up freshness of 5 minutes.",
    "K2-T08": "Threat: reset poisoning, brute force and enumeration. Control: single-use expiring reset tokens, uniform timing and body, lockout and rate limits.",
    "K2-T09": "Threat: permission sprawl and undeclared actions. Control: permissions only from validated manifests; roles are data with tenant scope; unknown permission strings are rejected.",
    "K2-T10": "Threat: allow by mistake or stale cache. Control: deny by default, reason codes, cache invalidation on role change within 5 seconds, negative tests for every module action.",
    "K2-T12": "Threat: privilege escalation and lock-out. Control: cannot grant what you lack, last-admin protection, all role changes audited.",
    "K2-T13": "Threat: leaked or over-scoped keys. Control: show once, store hash only, scoped, expiring, rotation, last-used and anomaly alerts.",
    "K2-T14": "Threat: forged or replayed identity assertions. Control: validate issuer, audience, nonce and signature; map claims through an allow-list; no auto-created admins.",
    "K2-T15": "Threat: authorization-code interception, open redirect, confused deputy. Control: PKCE S256 only, exact redirect URI match, short code life, audience-bound tokens, consent record.",
    "K2-T16": "Threat: malicious client registration and SSRF through metadata fetch. Control: allow-listed metadata fetch with size and time caps, no private address ranges, scoped client permissions.",
    "K2-T18": "Threat: undiscovered escalation path. Control: property tests over random role and grant sequences prove no subject gains a permission it was not granted.",
    "K3-T04": "Threat: stale or bypassed limits. Control: event-based invalidation, per-key failure policy, fail closed for security keys, tests under store outage.",
    "K3-T09": "Threat: forged or replayed licence. Control: asymmetric signature, offline verification, expiry, tenant binding, clock-rollback detection.",
    "K4-T05": "Threat: unclassified personal data enters the system. Control: classification tag is mandatory; fields without one are rejected; tags feed masking and the data inventory.",
    "K4-T08": "Threat: denial of service or code execution through expressions. Control: closed grammar, depth, size and step limits, no I/O, fuzz tests with hostile input.",
    "K5-T03": "Threat: guard bypass and code injection. Control: declarative guards use the expression sandbox; named guards come only from registered module code.",
    "K6-T02": "Threat: events without tenant or with sensitive payloads. Control: envelope requires tenant; payload schema marks classified fields; publish inside the transaction only.",
    "K7-T01": "Threat: missing or forgeable audit. Control: append-only table, same transaction, no update or delete grants for the app role.",
    "K7-T04": "Threat: undetected history rewrite. Control: per-tenant hash chain, daily verifier, alert on break, chain head stored outside the table.",
    "K7-T05": "Threat: action succeeds without evidence. Control: critical-action list fails closed; others queue with alert; test by failing the sink.",
    "K7-T06": "Threat: silent bulk reads of personal data. Control: decorator logs classified reads and downloads with actor and purpose; volume anomaly signal.",
    "K7-T07": "Threat: audit data exposure and formula injection in exports. Control: audit.read permission, masked diffs, neutralised export cells, export itself audited.",
    "K7-T10": "Threat: consent forged or backdated. Control: append-only consent events with notice version, language, actor and time; withdrawal is immediate.",
    "K7-T13": "Threat: incomplete erasure or over-erasure. Control: every module registers handlers; orchestrator reports per-handler outcome; statutory holds recorded with reason.",
    "K7-T14": "Threat: export leaks or deletes the wrong tenant. Control: tenant-scoped, permission and step-up required, checksum, deletion record, two-person confirmation by policy.",
    "K8-T03": "Threat: malicious upload (type spoofing, oversize, zip bombs). Control: size caps, content sniffing, allow-listed types, generated names, checksum, resumable-session expiry.",
    "K8-T04": "Threat: unauthorised or shared downloads. Control: permission check before signing, 5-minute URLs, private buckets, no public ACLs.",
    "K8-T06": "Threat: malware stored and served. Control: scan port with quarantine state; quarantined files are never downloadable.",
    "K8-T11": "Threat: path traversal and cross-tenant object access. Control: tenant-prefixed generated keys, normalised paths, negative tests for ../ and foreign prefixes.",
    "UI-T11": "Threat: personal data exposed on screen or in storage. Control: masked by default, audited reveal, nothing sensitive in browser storage or URLs.",
    "UI-T14": "Threat: tenant branding breaks legibility or injects markup. Control: contrast validation at save, colour parsed to a fixed format, logo type and size checks, audited change.",
}

SKILLS_BASE = ["gx-modular-platform", "gx-code-quality", "gx-test-feature"]


def module_of(tid):
    return tid.split("-")[0]


def skills_for(tid, title, tests):
    m = module_of(tid)
    s = list(SKILLS_BASE)
    low = (title + " " + tests).lower()
    if m == "UI":
        return ["gx-cognitive-ux", "epc-design-system", "gx-code-quality", "gx-test-feature"]
    if re.search(r"model|table|migration|rls|partition|index|store|storage|ledger|schema|foreign", low):
        s.append("gx-database-design")
    if m in ("K6",) or tid in ("K3-T05", "K1-T10", "K4-T07", "K8-T03", "K2-T10"):
        s.append("gx-high-concurrency")
    if m in ("K7", "K8") or tid in ("K2-T01", "K4-T05", "K1-T07"):
        s += ["gx-compliance", "epc-compliance-privacy"]
    if tid in ("K0-T10", "K0-T13", "K6-T10", "K6-T11", "K7-T08"):
        s.append("gx-ops-readiness")
    if tid in ("K0-T01", "K2-T15", "K4-T06", "K3-T09"):
        s.append("gx-architecture")
    return s


def qa_needed(tests, tid=""):
    if tid in S3:
        return True
    return bool(re.search(r"matrix|property|chaos|soak|contract|conformance|escalation|seeded|negative|fuzz", tests.lower()))


def sec_level(tid):
    if tid in S3:
        return "S3"
    return "S1" if tid.startswith("K0-") or tid.startswith("UI-") else "S2"


def reviewers(tid, size):
    r = []
    if tid.startswith("UI-"):
        r.append("gx-ux-reviewer")
    if size == "M" or tid in ("K0-T09", "K0-T07"):
        r.append("gx-staff-reviewer")
    lvl = sec_level(tid)
    if lvl == "S3":
        r.append("gx-security-reviewer (blocking)")
    elif lvl == "S2":
        r.append("gx-security-reviewer (module gate)")
    return r


def rollback(tid, title):
    low = title.lower()
    if re.search(r"model|table|migration|rls|partition|storage|ledger|schema", low):
        return "Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place."
    if tid.startswith("UI-"):
        return "Revert the commit; no data is affected. Gate checks stay on."
    return "Revert the commit; the change is behind the module's public API and a flag where user-visible."
