import { createHash, timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyRequest } from "fastify";
import swagger from "@fastify/swagger";
import {
  TypeBoxValidatorCompiler,
  type TypeBoxTypeProvider,
} from "@fastify/type-provider-typebox";
import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  FlagSchema as ContractFlagSchema,
  ConfigurationV2Schema as ContractConfigurationSchema,
  ContractValidationError,
  parseConfigurationV2,
} from "@feature-rollout/evaluation";
import { Store, ServiceError } from "./store.js";

function withoutIds<T extends TSchema>(input: T): T {
  const schema = Value.Clone(input);
  function visit(value: unknown): void {
    if (!value || typeof value !== "object") return;
    Reflect.deleteProperty(value, "$id");
    const children: unknown[] = Object.values(value);
    for (const child of children) visit(child);
  }
  visit(schema);
  return schema;
}
const FlagSchema = withoutIds(ContractFlagSchema);
const ConfigurationV2Schema = withoutIds(ContractConfigurationSchema);

const Identifier = Type.String({
  minLength: 1,
  maxLength: 128,
  pattern: "^[a-zA-Z0-9][a-zA-Z0-9_.-]*$",
});
const Revision = Type.Integer({ minimum: 0, maximum: 2147483646 });
const Params = Type.Object(
  { environment: Identifier },
  { additionalProperties: false },
);
const FlagParams = Type.Object(
  { environment: Identifier, key: Identifier },
  { additionalProperties: false },
);
const PublishBody = Type.Object(
  {
    expectedRevision: Revision,
    expectedActiveVersion: Revision,
    idempotencyKey: Type.String({ minLength: 1, maxLength: 128 }),
  },
  { additionalProperties: false },
);
const DraftSchema = Type.Object({
  environment: Identifier,
  revision: Revision,
  baseVersion: Revision,
  activeVersion: Revision,
  flags: Type.Array(FlagSchema, { maxItems: 1000 }),
  archivedFlags: Type.Array(FlagSchema, { maxItems: 1000 }),
});
const PublicationSchema = Type.Object({
  environment: Identifier,
  version: Revision,
  digest: Type.String(),
});
const CredentialSchema = Type.Object(
  {
    token: Type.String({ minLength: 16 }),
    actor: Identifier,
    permission: Type.Union([Type.Literal("read"), Type.Literal("write")]),
    environments: Type.Array(Type.String(), { minItems: 1 }),
  },
  { additionalProperties: false },
);
export const CredentialsSchema = Type.Array(CredentialSchema, { minItems: 1 });
export type Credential = Static<typeof CredentialSchema>;
const Failure = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.String(),
});
const failures = {
  400: Failure,
  401: Failure,
  403: Failure,
  404: Failure,
  409: Failure,
  410: Failure,
  413: Failure,
  503: Failure,
};
const response = <T extends TSchema>(schema: T) => ({
  200: schema,
  ...failures,
});

export async function createService({
  store,
  credentials,
  logger = false,
}: {
  store: Store;
  credentials: readonly Credential[];
  logger?: boolean;
}) {
  if (!Value.Check(CredentialsSchema, credentials))
    throw new Error("Invalid credentials configuration");
  const authenticated = new WeakMap<FastifyRequest, Credential>();
  const configured = credentials.map((credential) => ({
    credential,
    hash: createHash("sha256").update(credential.token).digest(),
  }));
  const app = Fastify({
    bodyLimit: 1024 * 1024,
    requestTimeout: 10000,
    logger: logger
      ? { redact: ["req.headers.authorization"], level: "info" }
      : false,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  }).withTypeProvider<TypeBoxTypeProvider>();
  app.setValidatorCompiler(TypeBoxValidatorCompiler);
  await app.register(swagger, {
    openapi: {
      info: { title: "Feature Rollout Service", version: "1.0.0" },
      components: {
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      },
      security: [{ bearerAuth: [] }],
    },
  });
  app.setErrorHandler((error, request, reply) => {
    const status =
      error instanceof ServiceError
        ? error.status
        : error instanceof ContractValidationError ||
            (typeof error === "object" &&
              error !== null &&
              "validation" in error)
          ? 400
          : typeof error === "object" &&
              error !== null &&
              "statusCode" in error &&
              error.statusCode === 413
            ? 413
            : 503;
    const code =
      error instanceof ServiceError
        ? error.code
        : status === 400
          ? "INVALID_INPUT"
          : status === 413
            ? "BODY_TOO_LARGE"
            : "SERVICE_UNAVAILABLE";
    reply.code(status).send({
      code,
      message:
        error instanceof ServiceError
          ? error.message
          : status === 400
            ? "Request failed validation"
            : status === 413
              ? "Request exceeds size limit"
              : "Service temporarily unavailable",
      requestId: request.id,
    });
  });
  app.addHook("onRequest", (request, _reply, done) => {
    if (request.url === "/health/live" || request.url === "/health/ready") {
      done();
      return;
    }
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new ServiceError(
        401,
        "UNAUTHENTICATED",
        "A bearer token is required",
      );
    const hash = createHash("sha256").update(header.slice(7)).digest();
    const match = configured.find((entry) => timingSafeEqual(hash, entry.hash));
    if (!match)
      throw new ServiceError(401, "UNAUTHENTICATED", "Invalid bearer token");
    authenticated.set(request, match.credential);
    done();
  });
  function authorize(
    request: FastifyRequest,
    environment: string,
    write = false,
  ) {
    const credential = authenticated.get(request);
    if (
      !credential ||
      (write && credential.permission !== "write") ||
      (!credential.environments.includes("*") &&
        !credential.environments.includes(environment))
    )
      throw new ServiceError(
        403,
        "FORBIDDEN",
        "Credential lacks the required environment permission",
      );
    return credential.actor;
  }
  app.get(
    "/health/live",
    {
      schema: {
        security: [],
        response: { 200: Type.Object({ status: Type.Literal("ok") }) },
      },
    },
    () => ({ status: "ok" as const }),
  );
  app.get(
    "/health/ready",
    {
      schema: {
        security: [],
        response: response(Type.Object({ status: Type.Literal("ready") })),
      },
    },
    async () => {
      await store.pool.query("SELECT 1 FROM schema_migrations");
      return { status: "ready" as const };
    },
  );
  app.get("/v1/openapi.json", (request) => {
    authorize(request, "*", true);
    return app.swagger();
  });
  app.post(
    "/v1/environments",
    {
      schema: {
        body: Type.Object(
          { name: Identifier },
          { additionalProperties: false },
        ),
        response: response(DraftSchema),
      },
    },
    async (request) =>
      store.createEnvironment(
        request.body.name,
        authorize(request, request.body.name, true),
      ),
  );
  app.get(
    "/v1/environments",
    {
      schema: {
        response: response(
          Type.Array(
            Type.Object({ name: Identifier, archived: Type.Boolean() }),
          ),
        ),
      },
    },
    async (request) => {
      const credential = authenticated.get(request);
      if (!credential)
        throw new ServiceError(
          401,
          "UNAUTHENTICATED",
          "Authentication required",
        );
      return (
        await store.pool.query<{ name: string; archived: boolean }>(
          "SELECT name,archived FROM environments ORDER BY name",
        )
      ).rows.filter(
        (row) =>
          credential.environments.includes("*") ||
          credential.environments.includes(row.name),
      );
    },
  );
  app.get(
    "/v1/environments/:environment/draft",
    { schema: { params: Params, response: response(DraftSchema) } },
    async (request) => {
      authorize(request, request.params.environment, true);
      return store.draft(request.params.environment);
    },
  );
  app.put(
    "/v1/environments/:environment/flags/:key",
    {
      schema: {
        params: FlagParams,
        body: Type.Object(
          { expectedRevision: Revision, flag: FlagSchema },
          { additionalProperties: false },
        ),
        response: response(DraftSchema),
      },
    },
    async (request) => {
      const actor = authorize(request, request.params.environment, true);
      if (request.body.flag.key !== request.params.key)
        throw new ServiceError(
          400,
          "INVALID_INPUT",
          "Flag key must match the path",
        );
      const draft = await store.draft(request.params.environment);
      if (
        draft.flags.length >= 1000 &&
        !draft.flags.some((flag) => flag.key === request.params.key)
      )
        throw new ServiceError(
          400,
          "LIMIT_EXCEEDED",
          "At most 1000 active flags per environment",
        );
      return store.edit(
        request.params.environment,
        request.body.expectedRevision,
        actor,
        { type: "put", flag: request.body.flag },
      );
    },
  );
  for (const operation of ["archive", "restore"] as const)
    app.post(
      `/v1/environments/:environment/flags/:key/${operation}`,
      {
        schema: {
          params: FlagParams,
          body: Type.Object(
            { expectedRevision: Revision },
            { additionalProperties: false },
          ),
          response: response(DraftSchema),
        },
      },
      (request) =>
        store.edit(
          request.params.environment,
          request.body.expectedRevision,
          authorize(request, request.params.environment, true),
          { type: operation, key: request.params.key },
        ),
    );
  app.post(
    "/v1/environments/:environment/rebase",
    {
      schema: {
        params: Params,
        body: Type.Object(
          { expectedRevision: Revision, expectedActiveVersion: Revision },
          { additionalProperties: false },
        ),
        response: response(DraftSchema),
      },
    },
    (request) =>
      store.edit(
        request.params.environment,
        request.body.expectedRevision,
        authorize(request, request.params.environment, true),
        { type: "rebase", activeVersion: request.body.expectedActiveVersion },
      ),
  );
  app.post(
    "/v1/environments/:environment/publish",
    {
      schema: {
        params: Params,
        body: PublishBody,
        response: response(PublicationSchema),
      },
    },
    async (request) => {
      const publication = await store.publish(
        request.params.environment,
        request.body,
        authorize(request, request.params.environment, true),
      );
      return {
        environment: publication.environment,
        version: publication.version,
        digest: publication.digest,
      };
    },
  );
  app.post(
    "/v1/environments/:environment/rollback",
    {
      schema: {
        params: Params,
        body: Type.Composite(
          [PublishBody, Type.Object({ version: Type.Integer({ minimum: 1 }) })],
          { additionalProperties: false },
        ),
        response: response(PublicationSchema),
      },
    },
    async (request) => {
      const { version, ...input } = request.body;
      return store.publish(
        request.params.environment,
        input,
        authorize(request, request.params.environment, true),
        { type: "rollback", version },
      );
    },
  );
  app.post(
    "/v1/environments/:environment/flags/:key/kill",
    {
      schema: {
        params: FlagParams,
        body: PublishBody,
        response: response(PublicationSchema),
      },
    },
    async (request) =>
      store.publish(
        request.params.environment,
        request.body,
        authorize(request, request.params.environment, true),
        { type: "kill", key: request.params.key },
      ),
  );
  app.post(
    "/v1/environments/:environment/archive",
    {
      schema: {
        params: Params,
        body: Type.Object(
          { expectedRevision: Revision },
          { additionalProperties: false },
        ),
        response: response(Type.Object({ archived: Type.Boolean() })),
      },
    },
    async (request) => {
      await store.archiveEnvironment(
        request.params.environment,
        authorize(request, request.params.environment, true),
        request.body.expectedRevision,
      );
      return { archived: true };
    },
  );
  app.get(
    "/v1/environments/:environment/configuration",
    {
      schema: {
        params: Params,
        response: { 200: ConfigurationV2Schema, 304: Type.Null(), ...failures },
      },
    },
    async (request, reply) => {
      authorize(request, request.params.environment);
      const publication = await store.publication(request.params.environment);
      const etag = `"${publication.digest}"`;
      reply.header("ETag", etag).header("Cache-Control", "private, no-cache");
      if (request.headers["if-none-match"] === etag)
        return reply.code(304).send(null);
      return reply
        .type("application/json")
        .serializer(() => publication.canonical)
        .send(
          parseConfigurationV2(JSON.parse(publication.canonical) as unknown),
        );
    },
  );
  app.get(
    "/v1/environments/:environment/publications/:version",
    {
      schema: {
        params: Type.Object({
          environment: Identifier,
          version: Type.String({ pattern: "^[1-9][0-9]*$" }),
        }),
        response: { 200: ConfigurationV2Schema, ...failures },
      },
    },
    async (request, reply) => {
      authorize(request, request.params.environment, true);
      const publication = await store.publication(
        request.params.environment,
        Number(request.params.version),
      );
      return reply
        .type("application/json")
        .serializer(() => publication.canonical)
        .send(
          parseConfigurationV2(JSON.parse(publication.canonical) as unknown),
        );
    },
  );
  const pagination = Type.Object(
    {
      after: Type.Optional(Type.String({ pattern: "^[0-9]{1,16}$" })),
      limit: Type.Optional(Type.String({ pattern: "^[0-9]{1,3}$" })),
    },
    { additionalProperties: false },
  );
  app.get(
    "/v1/environments/:environment/publications",
    {
      schema: {
        params: Params,
        querystring: pagination,
        response: response(
          Type.Array(Type.Object({ version: Revision, digest: Type.String() })),
        ),
      },
    },
    async (request) => {
      authorize(request, request.params.environment, true);
      return store.history(
        request.params.environment,
        Number(request.query.after ?? 0),
        Math.max(1, Math.min(100, Number(request.query.limit ?? 50))),
      );
    },
  );
  app.get(
    "/v1/environments/:environment/audit",
    { schema: { params: Params, querystring: pagination } },
    async (request) => {
      authorize(request, request.params.environment, true);
      return store.events(
        request.params.environment,
        request.query.after ?? "0",
        Math.max(1, Math.min(100, Number(request.query.limit ?? 50))),
      );
    },
  );
  await app.ready();
  return app;
}
