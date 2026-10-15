import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  prepareSnapshot,
  serializeConfigurationV2,
  type EvaluationDetails,
  type EvaluationSnapshot,
  type EvaluationContext,
  type ConfigurationV2,
} from "@feature-rollout/evaluation";

export type Context = Omit<EvaluationContext, "schemaVersion">;
export type ClientStatus = {
  state: "idle" | "loading" | "ready" | "stale" | "closed";
  version?: number;
  lastError?: string;
};
export type Bootstrap = { configuration: ConfigurationV2; validatedAt: number };
type Observer<T extends object> = (value: Readonly<T>) => unknown;
export type ClientOptions = {
  url: string;
  token: string;
  environment: string;
  refreshIntervalMs?: number;
  requestTimeoutMs?: number;
  initializationTimeoutMs?: number;
  maxAgeMs?: number;
  maxConfigurationBytes?: number;
  bootstrap?: Bootstrap;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  onStatus?: Observer<ClientStatus>;
  onEvaluation?: Observer<EvaluationDetails<boolean | string>>;
};

function notifyObserver<T extends object>(
  observer: Observer<T> | undefined,
  value: T,
): void {
  if (!observer) return;
  try {
    const pending = observer(Object.freeze({ ...value }));
    if (pending) void Promise.resolve(pending).catch(() => undefined);
  } catch {
    // Observers cannot change results or interrupt client lifecycle work.
  }
}

/** Preserve descriptors so validation can reject accessors without executing them. */
function versionContext(context: Context): unknown {
  try {
    const prototype: unknown = Object.getPrototypeOf(context);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const descriptors = Object.getOwnPropertyDescriptors(context);
    if (Object.hasOwn(descriptors, "schemaVersion")) return undefined;
    return Object.create(prototype, {
      ...descriptors,
      schemaVersion: { value: "evaluation-context-v1", enumerable: true },
    }) as unknown;
  } catch {
    return undefined;
  }
}

/** One client per environment. All flag checks are synchronous and use a local snapshot. */
export class RolloutClient {
  private snapshot: EvaluationSnapshot | undefined;
  private etag: string | undefined;
  private lastValidated = -Infinity;
  private verifiedAt = 0;
  private started = false;
  private closed = false;
  private forcedStale = false;
  private error: string | undefined;
  private timer: NodeJS.Timeout | undefined;
  private inFlight: Promise<boolean> | undefined;
  private abort: AbortController | undefined;
  private failures = 0;
  private readonly waiters = new Set<{
    resolve: () => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private readonly clock: () => number;
  private readonly transport: typeof globalThis.fetch;
  private readonly endpoint: URL;
  private readonly refreshInterval: number;
  private readonly requestTimeout: number;
  private readonly initializationTimeout: number;
  private readonly maxAge: number;
  private readonly maxBytes: number;

  constructor(private readonly options: ClientOptions) {
    const url = new URL(options.url);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "Use an HTTP service URL without credentials, query, or fragment.",
      );
    if (!options.token || !options.environment)
      throw new Error("Token and environment are required");
    this.endpoint = new URL(
      `${url.pathname.replace(/\/$/, "")}/v1/environments/${encodeURIComponent(options.environment)}/configuration`,
      url.origin,
    );
    this.clock = options.now ?? (() => performance.now());
    this.transport = options.fetch ?? globalThis.fetch;
    this.refreshInterval = options.refreshIntervalMs ?? 30000;
    this.requestTimeout = options.requestTimeoutMs ?? 2000;
    this.initializationTimeout = options.initializationTimeoutMs ?? 5000;
    this.maxAge = options.maxAgeMs ?? 300000;
    this.maxBytes = options.maxConfigurationBytes ?? 1024 * 1024;
    for (const value of [
      this.refreshInterval,
      this.requestTimeout,
      this.initializationTimeout,
      this.maxAge,
      this.maxBytes,
    ])
      if (!Number.isSafeInteger(value) || value <= 0)
        throw new Error(
          "Timing and size limits must be positive safe integers",
        );
    if (options.bootstrap) {
      const snapshot = prepareSnapshot(options.bootstrap.configuration);
      const age = Date.now() - options.bootstrap.validatedAt;
      if (
        snapshot.configuration.environment !== options.environment ||
        !Number.isFinite(age) ||
        age < 0 ||
        age >= this.maxAge
      )
        throw new Error("Bootstrap is stale or belongs to another environment");
      this.snapshot = snapshot;
      this.etag = this.digest(snapshot.configuration);
      this.lastValidated = this.clock() - age;
      this.verifiedAt = options.bootstrap.validatedAt;
    }
  }
  private digest(configuration: ConfigurationV2) {
    return `"${createHash("sha256").update(serializeConfigurationV2(configuration)).digest("hex")}"`;
  }
  status(): ClientStatus {
    const age = this.clock() - this.lastValidated;
    const state = this.closed
      ? "closed"
      : !this.snapshot
        ? this.started
          ? "loading"
          : "idle"
        : this.forcedStale ||
            !Number.isFinite(age) ||
            age < 0 ||
            age >= this.maxAge
          ? "stale"
          : "ready";
    return {
      state,
      ...(this.snapshot
        ? { version: this.snapshot.configuration.configurationVersion }
        : {}),
      ...(this.error ? { lastError: this.error } : {}),
    };
  }
  private notify() {
    const status = this.status();
    if (status.state === "ready")
      for (const waiter of this.waiters) {
        clearTimeout(waiter.timer);
        waiter.resolve();
        this.waiters.delete(waiter);
      }
    notifyObserver(this.options.onStatus, status);
  }
  async start(): Promise<void> {
    if (this.closed) throw new Error("Client is closed");
    if (!this.started) {
      this.started = true;
      void this.refresh();
    }
    await this.waitForReady();
  }
  waitForReady(timeoutMs = this.initializationTimeout): Promise<void> {
    if (this.closed) return Promise.reject(new Error("Client is closed"));
    if (this.status().state === "ready") return Promise.resolve();
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters.delete(waiter);
          reject(
            new Error(
              `Configuration initialization timed out: ${this.error ?? "not ready"}`,
            ),
          );
        }, timeoutMs),
      };
      this.waiters.add(waiter);
    });
  }
  refresh(): Promise<boolean> {
    if (this.closed) return Promise.resolve(false);
    if (this.inFlight) return this.inFlight;
    if (this.timer) clearTimeout(this.timer);
    this.inFlight = this.load().finally(() => {
      this.inFlight = undefined;
      this.abort = undefined;
      if (this.started && !this.closed) {
        const delay = this.failures
          ? Math.min(
              this.refreshInterval * 10,
              250 * 2 ** Math.min(10, this.failures - 1),
            )
          : this.refreshInterval;
        this.timer = setTimeout(
          () => {
            void this.refresh();
          },
          Math.max(1, Math.round(delay * (0.9 + Math.random() * 0.2))),
        );
        this.timer.unref();
      }
    });
    return this.inFlight;
  }
  private async load(): Promise<boolean> {
    this.abort = new AbortController();
    try {
      const response = await this.transport(this.endpoint, {
        headers: {
          authorization: `Bearer ${this.options.token}`,
          ...(this.etag ? { "if-none-match": this.etag } : {}),
        },
        signal: AbortSignal.any([
          this.abort.signal,
          AbortSignal.timeout(this.requestTimeout),
        ]),
        redirect: "error",
      });
      if (this.closed) return false;
      if (response.status === 304) {
        if (!this.snapshot || response.headers.get("etag") !== this.etag)
          throw new Error("UNEXPECTED_NOT_MODIFIED");
      } else {
        if (!response.ok) {
          if ([401, 403, 410].includes(response.status))
            this.forcedStale = true;
          await response.body?.cancel();
          throw new Error(`HTTP_${String(response.status)}`);
        }
        if (
          Number(response.headers.get("content-length") ?? 0) > this.maxBytes
        ) {
          await response.body?.cancel();
          throw new Error("CONFIGURATION_TOO_LARGE");
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error("EMPTY_CONFIGURATION");
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          let next = await reader.read();
          while (!next.done) {
            const chunk: unknown = next.value;
            if (!(chunk instanceof Uint8Array))
              throw new Error("INVALID_RESPONSE_BODY");
            bytes += chunk.byteLength;
            if (bytes > this.maxBytes)
              throw new Error("CONFIGURATION_TOO_LARGE");
            chunks.push(chunk);
            next = await reader.read();
          }
        } finally {
          await reader.cancel().catch(() => undefined);
        }
        const snapshot = prepareSnapshot(
          JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
        );
        if (snapshot.configuration.environment !== this.options.environment)
          throw new Error("WRONG_ENVIRONMENT");
        const etag = this.digest(snapshot.configuration);
        if (response.headers.get("etag") !== etag)
          throw new Error("INVALID_ETAG");
        if (
          this.snapshot &&
          (snapshot.configuration.configurationVersion <
            this.snapshot.configuration.configurationVersion ||
            (snapshot.configuration.configurationVersion ===
              this.snapshot.configuration.configurationVersion &&
              etag !== this.etag))
        )
          throw new Error("VERSION_REGRESSION");
        if (this.status().state === "closed") return false;
        this.snapshot = snapshot;
        this.etag = etag;
      }
      this.lastValidated = this.clock();
      this.verifiedAt = Date.now();
      this.forcedStale = false;
      this.failures = 0;
      this.error = undefined;
      this.notify();
      return true;
    } catch (error) {
      this.failures++;
      this.error =
        error instanceof Error && /^[A-Z_0-9]+$/.test(error.message)
          ? error.message
          : "REFRESH_FAILED";
      this.notify();
      return false;
    }
  }
  booleanDetails(
    key: string,
    context: Context,
    fallbackValue: boolean,
  ): EvaluationDetails<boolean> {
    const result = this.snapshot?.boolean(
      key,
      versionContext(context),
      fallbackValue,
      this.status().state !== "ready",
    ) ?? {
      flagKey: key,
      value: fallbackValue,
      reasonCode: "FALLBACK_INVALID_CONFIGURATION" as const,
    };
    notifyObserver(this.options.onEvaluation, result);
    return result;
  }
  boolean(key: string, context: Context, fallbackValue: boolean): boolean {
    return this.booleanDetails(key, context, fallbackValue).value;
  }
  multivariateDetails(
    key: string,
    context: Context,
    fallbackValue: string,
  ): EvaluationDetails<string> {
    const result = this.snapshot?.multivariate(
      key,
      versionContext(context),
      fallbackValue,
      this.status().state !== "ready",
    ) ?? {
      flagKey: key,
      value: fallbackValue,
      reasonCode: "FALLBACK_INVALID_CONFIGURATION" as const,
    };
    notifyObserver(this.options.onEvaluation, result);
    return result;
  }
  multivariate(key: string, context: Context, fallbackValue: string): string {
    return this.multivariateDetails(key, context, fallbackValue).value;
  }
  exportSnapshot(): Bootstrap | undefined {
    return this.snapshot
      ? {
          configuration: structuredClone(this.snapshot.configuration),
          validatedAt: this.verifiedAt,
        }
      : undefined;
  }
  async close(): Promise<void> {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.abort?.abort();
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("Client is closed"));
    }
    this.waiters.clear();
    await this.inFlight;
    this.notify();
  }
}
export {
  type ConfigurationV2,
  type EvaluationDetails,
} from "@feature-rollout/evaluation";
