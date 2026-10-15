# Development

Install Node.js 24 and pnpm 11, then run `pnpm install --frozen-lockfile`.

- `pnpm dev` watches all packages and reruns the complete service/SDK demo. `pnpm demo` runs it once until Ctrl+C.
- `pnpm test` and `pnpm test:watch` run directly against maintained source, including evaluator imports in SDK tests. No build is required. Pass a test filename to select it.
- `pnpm typecheck` builds the evaluator declarations required by workspace imports, then checks all package source and tests.
- `pnpm check` runs source tests before type checking, formatting, and linting. CI uses this order on fresh Ubuntu and Windows checkouts so a previous build cannot hide missing-output problems.
- `pnpm verify` adds real PostgreSQL/HTTP integration and installed SDK end-to-end tests.
- `pnpm artifacts:check` compares the existing SDK and portable schemas with freshly generated temporary output. `pnpm test:sdk-copy` tests the existing folder without rebuilding it. Both run before SDK regeneration in verification and CI.
- After evaluator or SDK changes, run `pnpm build` and include the generated SDK. After schema changes, also run `pnpm schemas:generate`. These checks compare working files, so correct uncommitted updates are supported.
- `pnpm build` regenerates the dependency-free `sdk/` folder. `pnpm test:package` verifies strict types and external consumers on Windows and Ubuntu. `pnpm benchmark` reports local costs.
- `pnpm test:e2e` installs packed artifacts in a disposable external consumer.
- `pnpm dev:db` runs native PostgreSQL on localhost:55432 with data in `.local/postgres`. Stop with Ctrl+C or `pnpm dev:stop`.
- `docker compose up -d --wait postgres` is an alternative database launcher. Do not run both on the same port.

Database tests own disposable native PostgreSQL clusters and never use `DATABASE_URL`. The binary comes from the pinned development dependency; a global PostgreSQL installation or Docker is unnecessary. Only the explicitly allowlisted native package installation scripts run.

Normal database restarts retain development data. Tests clean only the temporary directories they create. Keep secrets in an ignored `.env`, not committed files.
