# Changelog

Notable changes to `@gx/testkit`. Versions follow semver over the public API in `src/index.ts`.

## Unreleased

## 0.1.1 (2026-11-05)

### Added

- `MemoryLogSink` and `LogRecord` (K0-T04): an in-memory `LogSink` that keeps raw lines for leak assertions and parses them into records. It rejects multi-line writes, and `failWith` makes writes throw.

## 0.1.0 (2026-11-05)

### Added

- In-memory fakes for the core ports (K0-T14): `FakeAuthorizer`, `FakeEntitlementGate`, `FakeQuotaProvider`, `FakeClassificationLookup`, `FakeTenantSecretsProvider`, `FakePlatformSecretsProvider`, `FakeAuditSink`, `FakeEventPublisher`, `FakeMessageSender`, `FakeEraserRegistry`. They start empty, so they deny. Seeding is explicit. `failWith` and `failNext` inject failures.
- Adapter-agnostic contract suites, one per port (`authorizerContract` and the others), plus `ContractSuite`, `ContractCase`, `ContractViolation`, `AdapterFactory`, `TenantReader`, `SecretsUnderTest`, and the fixture ids `CONTRACT_TENANTS` and `CONTRACT_USERS`. The fakes pass them, and real adapters (K1 to K8) must run the same suites over empty storage.
- Package skeleton: public-API file, register entry, README and changelog (K0-T02).
