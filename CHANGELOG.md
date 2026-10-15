# Changelog

## Unreleased

- Detect stale copied SDK artifacts and portable schemas before regenerating them.
- Isolate SDK observer payloads and contain synchronous and asynchronous observer errors.
- Reject unsafe context accessors and deeply nested invalid input without throwing from evaluation. Callback payload types are now readonly; flag schemas, reason codes, and percentage hashes are unchanged.

## 0.1.0

- Compatible v1 evaluation and prepared v2 snapshots.
- PostgreSQL drafts, immutable publication, authenticated audit, kill, and rollback.
- Scoped HTTP management and conditional configuration delivery.
- Node.js SDK with local checks, polling, stale defaults, and recovery.
- Portable PostgreSQL development, installed-artifact tests, and release candidates.

The SDK is distributed as a copyable repository folder. No npm publishing or external account is required.
