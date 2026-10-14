# 0003: Portable local PostgreSQL

Status: accepted, 2026-10-14

Docker is absent on the implementation machine. Use pinned native PostgreSQL binaries through the development-only `embedded-postgres` launcher for local development and disposable tests. This is real PostgreSQL, not a SQL emulator. Production still uses an ordinary PostgreSQL deployment.

Tests choose ephemeral localhost ports, random passwords, and owned temporary directories. They never use the caller's `DATABASE_URL`. Keep native installation scripts explicitly allowlisted. Never create host system users to run the database.

Compose remains the documented alternative and deployment path. This removes Docker as a prerequisite for contributing without changing storage semantics.
