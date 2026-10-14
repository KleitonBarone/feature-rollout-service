# Development

Install Node.js 24 and pnpm 11, then run `pnpm install --frozen-lockfile`.

- `pnpm dev` watches the evaluator and reruns a synthetic example.
- `pnpm test:watch` runs focused tests on edits. Pass a test filename to select it.
- `pnpm check` checks formatting, lint, types, and unit/conformance tests.
- `pnpm test:e2e` installs packed artifacts in a disposable external consumer.
- `pnpm dev:db` runs native PostgreSQL on localhost:55432 with data in `.local/postgres`. Stop with Ctrl+C or `pnpm dev:stop`.
- `docker compose up -d --wait postgres` is an alternative database launcher. Do not run both on the same port.

Database tests own disposable native PostgreSQL clusters and never use `DATABASE_URL`. The binary comes from the pinned development dependency; a global PostgreSQL installation or Docker is unnecessary. Only the explicitly allowlisted native package installation scripts run.

Normal database restarts retain development data. Tests clean only the temporary directories they create. Keep secrets in an ignored `.env`, not committed files.
