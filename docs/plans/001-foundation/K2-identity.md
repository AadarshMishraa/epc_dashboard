# K2 Identity and access

Know who is acting, decide what they may do, and let customers, staff, services and AI clients sign in safely.

- **Wave:** 4
- **Package:** `k2-identity`
- **Needs:** K1, K4, K6, K7a
- **Tasks:** 18

Status: tick a task when its done-when and tests pass and the definition of done in [README](README.md) holds. Scope and acceptance live in [the PRD](../../prd/01-prd.md); the execution rules are in [the playbook](../README.md).

## Contract

- **Data:** user, credential, membership, role, permission_grant, session, api_key, invitation, oauth_client, oauth_token
- **Offers:** IdentityProvider, SessionStore, Authorizer (implements core Authorizer), ApiKeys, OAuthServer
- **Uses:** TenantContext, EventPublisher, AuditSink, SecretsProvider, MessageSender, EntitlementGate (core ports); Expr and Config from K4
- **Events:** user.invited, user.joined, user.deactivated, role.changed, session.revoked, login.failed, login.new_device, api_key.created, api_key.revoked
- **Extension points:** IdentityProvider adapters; named attribute functions; permission definitions from module manifests

## Features delivered

- **F-30** Identity and credentials (Must, 4 acceptance criteria)
- **F-31** Sign-in and sessions (Must, 4 acceptance criteria)
- **F-32** Multi-factor authentication and step-up (Must, 3 acceptance criteria)
- **F-33** Invitations, recovery and abuse protection (Must, 3 acceptance criteria)
- **F-34** Roles and permission engine (Must, 4 acceptance criteria)
- **F-35** Attribute conditions on permissions (Should, 0 acceptance criteria)
- **F-36** Service accounts and API keys (Must, 3 acceptance criteria)
- **F-37** Single sign-on with OIDC (Later, 0 acceptance criteria)
- **F-38** OAuth for AI clients (Must, 4 acceptance criteria)
- **F-39** Authentication events and anomaly signals (Should, 0 acceptance criteria)

### Capabilities

- [MVP] Global user identity with one membership per tenant
- [MVP] Password and one-time-code sign-in through a built-in provider; memory-hard hashing with rehash on login
- [MVP] Password policy aligned to NIST SP 800-63B-4: 15 characters minimum when the password is the only factor, allow 64 or more, no composition rules, no forced rotation, screen against a blocklist
- [MVP] Sessions: short-lived access tokens, rotating refresh tokens with reuse detection, device list, revoke, idle and absolute timeouts
- [MVP] Permission registry built from module manifests; roles as data; grants with scopes (own, team, branch, tenant)
- [MVP] Authorizer: deny by default, decision with reason, cached and invalidated on role change
- [MVP] Invitations with role and scope; recovery; lockout and rate limits with uniform responses
- [v1] MFA: TOTP, recovery codes, step-up for sensitive actions
- [v1] Attribute conditions (amount caps, discount limits) using expr
- [v1] Role administration guards: no escalation above own level, last-admin protection
- [v1] Service accounts and API keys: scoped, hashed, shown once, rotated, expiring
- [v1] OIDC adapter for external identity providers and SSO
- [v1] OAuth 2.0 authorization server for API and AI clients: authorization code with PKCE (S256), client registration (DCR and CIMD), discovery metadata, refresh rotation
- [v1] Auth events and anomaly signals

### Failure modes and guards

- **Privilege escalation through role edits:** Cannot grant above own level; role changes audited and optionally approved
- **Stale permissions after a role change:** Cache invalidated by role.changed; bounded TTL
- **Token theft or refresh reuse:** Rotation with reuse detection revokes the whole family
- **Account enumeration:** Uniform responses and timing for sign-in and reset
- **Brute force:** Rate limits per account, IP and tenant; lockout with backoff
- **Permission checked only in the UI:** The service layer calls the Authorizer; UI hints are cosmetic
- **Leaked API key:** Hashed at rest, scoped, last-used tracking, quick revoke

## Security baseline for this module

Applies to every task below, on top of [the security guidelines](../../guidelines/security-guidelines.md).

- Deny by default; every decision returns a reason code; the service layer authorizes, never the UI.
- Secrets, tokens and hashes are never logged; compare in constant time; responses for unknown accounts match known ones.
- Rate limit and lock out on every credential-bearing endpoint; raise auth events for the audit log.
- Follow NIST SP 800-63B-4 and OAuth 2.1 practice: PKCE S256 only, exact redirect matching, no tokens in URLs, rotating refresh tokens.

## Tasks

- [ ] **K2-T01** (T-027) Identity model: global user and per-tenant membership (S)
  - Feature: F-30 | Milestone: M-05 | Level: 5 | Lane: k2-identity
  - Needs: K1-T03 (T-017)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design, gx-compliance, epc-compliance-privacy
  - Security: S2. Module security baseline applies.
  - Done when: One person can belong to several tenants with separate roles
  - Tests: unit tests
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K2-T02** (T-028) Credential storage: memory-hard hashing, versioned parameters, rehash on login, pepper through SecretsProvider (S)
  - Feature: F-30 | Milestone: M-05 | Level: 6 | Lane: k2-identity
  - Needs: K2-T01 (T-027)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-database-design
  - Security: S3. Threat: offline cracking of stolen hashes. Control: memory-hard hash with versioned parameters, pepper from SecretsProvider, rehash on login.
  - Done when: Hash parameters can be upgraded without forcing resets
  - Tests: rehash test
  - Rollback: Revert the commit; the migration is expand-only, so a schema fault is fixed forward, never edited in place.
- [ ] **K2-T03** (T-029) Password policy per NIST SP 800-63B-4: 15 characters minimum as sole factor, allow 64 or more, no composition rules, no forced rotation, blocklist screening (S)
  - Feature: F-30 | Milestone: M-05 | Level: 7 | Lane: k2-identity
  - Needs: K2-T02 (T-028), K4-T01 (T-056)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: weak or breached passwords. Control: minimum 15 characters as the only factor, allow 64 or more, blocklist screening, no forced rotation, no composition rules.
  - Done when: Policy matches the rules; blocklist rejects breached passwords
  - Tests: policy tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T04** (T-030) IdentityProvider port and built-in provider: password and one-time code via MessageSender (M)
  - Feature: F-31 | Milestone: M-05 | Level: 7 | Lane: k2-identity
  - Needs: K2-T02 (T-028), K0-T14 (T-014)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: account enumeration and one-time-code guessing. Control: uniform responses, code expiry and attempt limits, codes stored hashed.
  - Done when: Sign-in works with the fake sender; port has a contract suite
  - Tests: contract and integration tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T05** (T-031) Sessions: short access tokens, rotating refresh tokens with reuse detection, device list, revoke, idle and absolute timeouts (M)
  - Feature: F-31 | Milestone: M-05 | Level: 8 | Lane: k2-identity
  - Needs: K2-T04 (T-030)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: token theft and replay. Control: 15-minute access tokens, rotating refresh with reuse detection revoking the family, httpOnly cookies, device list and revoke.
  - Done when: Reusing a refresh token revokes the whole family
  - Tests: token-theft test
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T06** (T-032) MFA: TOTP, recovery codes, step-up hook for sensitive actions (M)
  - Feature: F-32 | Milestone: M-05 | Level: 9 | Lane: k2-identity
  - Needs: K2-T05 (T-031)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: MFA bypass and recovery-code abuse. Control: single-use hashed recovery codes, TOTP replay window, rate limit, step-up freshness of 5 minutes.
  - Done when: Step-up is required where a module declares it
  - Tests: enrolment and step-up tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T07** (T-033) Invitations and onboarding: role and scope, expiry, single use (M)
  - Feature: F-33 | Milestone: M-05 | Level: 7 | Lane: k2-identity
  - Needs: K2-T01 (T-027), K2-T09 (T-035)
  - Agents: build gx-implementer | tests - | review gx-staff-reviewer, gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Expired and reused invitations are rejected
  - Tests: invitation tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T08** (T-034) Recovery and abuse protection: reset, lockout, rate limits, uniform responses (M)
  - Feature: F-33 | Milestone: M-05 | Level: 8 | Lane: k2-identity
  - Needs: K2-T04 (T-030), K1-T10 (T-024)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: reset poisoning, brute force and enumeration. Control: single-use expiring reset tokens, uniform timing and body, lockout and rate limits.
  - Done when: Responses and timing do not reveal whether an account exists
  - Tests: enumeration and brute-force tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T09** (T-035) Permission registry from manifests, roles as data, grants with scopes (M)
  - Feature: F-34 | Milestone: M-05 | Level: 6 | Lane: k2-identity
  - Needs: K1-T08 (T-022), K0-T07 (T-007)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: permission sprawl and undeclared actions. Control: permissions only from validated manifests; roles are data with tenant scope; unknown permission strings are rejected.
  - Done when: Permissions come only from manifests; roles are bundles of them
  - Tests: registry tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T10** (T-036) Authorizer: can(subject, action, resource), deny by default, reasons, cache invalidated on role change; implements core Authorizer (M)
  - Feature: F-34 | Milestone: M-05 | Level: 8 | Lane: k2-identity
  - Needs: K2-T09 (T-035), K6-T04 (T-084)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-high-concurrency
  - Security: S3. Threat: allow by mistake or stale cache. Control: deny by default, reason codes, cache invalidation on role change within 5 seconds, negative tests for every module action.
  - Done when: An ungranted action is refused with a reason; role change takes effect within the TTL or on event
  - Tests: matrix and invalidation tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T11** (T-037) Attribute conditions (amount caps, discount limits) using expr (S)
  - Feature: F-35 | Milestone: M-05 | Level: 9 | Lane: k2-identity
  - Needs: K2-T10 (T-036), K4-T08 (T-063)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: A condition can deny an otherwise allowed action
  - Tests: condition tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T12** (T-038) Role administration guards: no escalation, last-admin protection (S)
  - Feature: F-34 | Milestone: M-05 | Level: 9 | Lane: k2-identity
  - Needs: K2-T10 (T-036)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: privilege escalation and lock-out. Control: cannot grant what you lack, last-admin protection, all role changes audited.
  - Done when: A user cannot grant above their own level; the last admin cannot be removed
  - Tests: escalation tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T13** (T-039) Service accounts and API keys: scoped, hashed, shown once, rotation, expiry, last-used (M)
  - Feature: F-36 | Milestone: M-05 | Level: 9 | Lane: k2-identity
  - Needs: K2-T10 (T-036)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: leaked or over-scoped keys. Control: show once, store hash only, scoped, expiring, rotation, last-used and anomaly alerts.
  - Done when: The key is visible once; revoked keys fail at once
  - Tests: key lifecycle tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T14** (T-040) OIDC adapter and claim-to-role mapping; SSO gated by the core EntitlementGate (M)
  - Feature: F-37 | Milestone: M-05 | Level: 8 | Lane: k2-identity
  - Needs: K2-T04 (T-030), K0-T14 (T-014)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: forged or replayed identity assertions. Control: validate issuer, audience, nonce and signature; map claims through an allow-list; no auto-created admins.
  - Done when: A tenant with SSO enabled signs in through its provider
  - Tests: integration test with a mock provider
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T15** (T-041) Authorization server decision (build or delegate, ADR) and authorization code with PKCE S256 (M)
  - Feature: F-38 | Milestone: M-05 | Level: 9 | Lane: k2-identity
  - Needs: K2-T05 (T-031), K2-T10 (T-036)
  - Agents: build Aadarsh decides, then gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature, gx-architecture
  - Security: S3. Threat: authorization-code interception, open redirect, confused deputy. Control: PKCE S256 only, exact redirect URI match, short code life, audience-bound tokens, consent record.
  - Done when: Code flow works with S256 only; plain PKCE is refused
  - Tests: flow and negative tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
  - Human gate: ADR-0006 sets the direction: delegate the protocol to Supabase Auth. Before code, confirm GA, connector conformance and password-policy fit; if any fails, gx-planner drafts a follow-up ADR and Aadarsh decides.
- [ ] **K2-T16** (T-042) Client registration (DCR and CIMD), discovery metadata, refresh rotation; Claude and ChatGPT connector conformance checks (M)
  - Feature: F-38 | Milestone: M-05 | Level: 10 | Lane: k2-identity
  - Needs: K2-T15 (T-041)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: malicious client registration and SSRF through metadata fetch. Control: allow-listed metadata fetch with size and time caps, no private address ranges, scoped client permissions.
  - Done when: A custom connector completes sign-in in a test harness; endpoints answer well under 10 seconds
  - Tests: conformance and latency tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T17** (T-043) Auth events and anomaly signals: failures, new device (S)
  - Feature: F-39 | Milestone: M-05 | Level: 9 | Lane: k2-identity
  - Needs: K2-T05 (T-031), K7-T01 (T-092)
  - Agents: build gx-implementer | tests - | review gx-security-reviewer (module gate)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S2. Module security baseline applies.
  - Done when: Events are audited and published
  - Tests: event tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
- [ ] **K2-T18** (T-044) Permission-engine property and escalation test pack (M)
  - Feature: F-34 | Milestone: M-05 | Level: 10 | Lane: k2-identity
  - Needs: K2-T12 (T-038)
  - Agents: build gx-implementer | tests gx-qa-engineer | review gx-staff-reviewer, gx-security-reviewer (blocking)
  - Skills: gx-modular-platform, gx-code-quality, gx-test-feature
  - Security: S3. Threat: undiscovered escalation path. Control: property tests over random role and grant sequences prove no subject gains a permission it was not granted.
  - Done when: No role ever gains a permission it was not granted
  - Tests: property tests
  - Rollback: Revert the commit; the change is behind the module's public API and a flag where user-visible.
