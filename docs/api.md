# Managing flags

Wildcard management credentials can fetch generated OpenAPI at `/v1/openapi.json`. Routes use bearer tokens. HTTP API and configuration schema versions are independent.

Start with the [integration quickstart](quickstart.md). Its [publish script](../examples/quickstart/publish.mjs) includes complete create, upsert, and publication request bodies.

| Method and route                                       | Purpose                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `POST /v1/environments`                                | Create with `{ "name": "demo" }`.                                       |
| `GET /v1/environments`                                 | List visible environments.                                              |
| `GET /v1/environments/:environment/draft`              | Read flags, archived flags, revision, base version, and active version. |
| `PUT .../flags/:key`                                   | Upsert with `expectedRevision` and `flag`.                              |
| `POST .../flags/:key/archive` and `restore`            | Archive/restore with `expectedRevision`.                                |
| `POST .../publish`                                     | Publish a reviewed draft.                                               |
| `GET .../configuration`                                | Fetch canonical content with a read token and conditional ETag.         |
| `GET .../publications` and `.../publications/:version` | List/retrieve immutable publications.                                   |
| `POST .../flags/:key/kill`                             | Publish default-only behavior from active content.                      |
| `POST .../rollback`                                    | Copy history into a new publication.                                    |
| `POST .../rebase`                                      | Acknowledge a reviewed active version as the draft base.                |
| `GET .../audit`                                        | Retrieve authenticated actors and change metadata.                      |
| `POST .../archive`                                     | Archive an environment with its expected revision.                      |

Publish, kill, and rollback require `expectedRevision`, `expectedActiveVersion`, and `idempotencyKey`. Rollback also includes `version`. Retrying a key with the same payload returns the original version; different input returns `409`. Versions increase per environment. Kill and rollback never publish pending drafts. Rebase preserves those edits and explicitly acknowledges review against the new active version.

History and audit accept `after` and `limit` strings. They sort ascending. Use the last version or audit ID as the next cursor; page size is capped at 100. Errors contain `code`, safe `message`, and `requestId`, never SQL errors or tokens.

Environment names and flag path keys use 1 to 128 ASCII letters, digits, dots, underscores, or hyphens, starting with a letter or digit. Malformed JSON and schema errors return `400`, bodies over 1 MiB return `413`, and unsupported request content types return `415`. Storage failures return `503`.

Audit entries contain decimal-string `id`, `actor`, `action`, `revision`, `version`, UTC `created_at`, and a `details` object. OpenAPI describes the response and standard errors. IDs stay strings so clients do not lose integer precision.

Flag definitions follow the [evaluation reference](evaluation.md). Writes validate weights and variant references. Publication uses `configuration-v2` without transport expiry.
