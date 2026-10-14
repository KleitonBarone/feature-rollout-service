import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  serializeConfigurationV2,
  type ConfigurationV2,
} from "@feature-rollout/evaluation";
import { RolloutClient } from "../src/index.js";

const configuration: ConfigurationV2 = {
  schemaVersion: "configuration-v2",
  environment: "test",
  configurationVersion: 1,
  generatedAt: "2026-10-14T00:00:00.000Z",
  flags: [
    {
      key: "feature",
      type: "boolean",
      defaultValue: false,
      rules: [],
      rollout: {
        id: "all",
        salt: "stable",
        bucketBy: "targetingKey",
        allocations: [{ serve: true, weight: 100000 }],
      },
    },
  ],
};
function response(input: ConfigurationV2 = configuration) {
  const body = serializeConfigurationV2(input);
  return new Response(body, {
    headers: { etag: `"${createHash("sha256").update(body).digest("hex")}"` },
  });
}
describe("SDK freshness and invalid updates", () => {
  it("polls automatically and releases its scheduler at shutdown", async () => {
    vi.useFakeTimers();
    let body = configuration;
    let calls = 0;
    const client = new RolloutClient({
      url: "http://localhost",
      token: "synthetic-token",
      environment: "test",
      refreshIntervalMs: 100,
      fetch: () => {
        calls++;
        return Promise.resolve(response(body));
      },
    });
    try {
      await client.start();
      expect(calls).toBe(1);
      body = { ...configuration, configurationVersion: 2 };
      await vi.advanceTimersByTimeAsync(110);
      expect(client.status().version).toBe(2);
      await client.close();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      await client.close();
      vi.useRealTimers();
    }
  });
  it("bounds initialization and rejects waiters on close", async () => {
    vi.useFakeTimers();
    const client = new RolloutClient({
      url: "http://localhost",
      token: "synthetic-token",
      environment: "test",
      initializationTimeoutMs: 100,
      fetch: () => Promise.resolve(new Response(null, { status: 503 })),
    });
    try {
      const startup = expect(client.start()).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(101);
      await startup;
      const waiter = expect(client.waitForReady()).rejects.toThrow("closed");
      await client.close();
      await waiter;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      await client.close();
      vi.useRealTimers();
    }
  });
  it("uses local checks, renews a matching 304, defaults at the exact age, and recovers", async () => {
    let now = 0;
    let requests = 0;
    let mode = "valid";
    const client = new RolloutClient({
      url: "http://localhost:3100",
      token: "synthetic-token",
      environment: "test",
      now: () => now,
      maxAgeMs: 100,
      fetch: () => {
        requests++;
        return Promise.resolve(
          mode === "valid"
            ? response()
            : mode === "304"
              ? new Response(null, {
                  status: 304,
                  headers: { etag: response().headers.get("etag") ?? "" },
                })
              : new Response(null, { status: 503 }),
        );
      },
    });
    try {
      await client.refresh();
      for (let i = 0; i < 10; i++)
        expect(
          client.boolean("feature", { targetingKey: "subject-a" }, false),
        ).toBe(true);
      expect(requests).toBe(1);
      now = 99;
      mode = "304";
      expect(await client.refresh()).toBe(true);
      now = 198;
      expect(
        client.boolean("feature", { targetingKey: "subject-a" }, false),
      ).toBe(true);
      now = 199;
      expect(
        client.booleanDetails("feature", { targetingKey: "subject-a" }, true)
          .reasonCode,
      ).toBe("DEFAULT_STALE_CONFIGURATION");
      mode = "failure";
      expect(await client.refresh()).toBe(false);
      mode = "valid";
      expect(await client.refresh()).toBe(true);
      expect(client.status().state).toBe("ready");
    } finally {
      await client.close();
    }
  });
  it("rejects lower or changed equal versions and coalesces refreshes", async () => {
    let body = { ...configuration, configurationVersion: 2 };
    let calls = 0;
    const client = new RolloutClient({
      url: "http://localhost",
      token: "synthetic-token",
      environment: "test",
      fetch: () => {
        calls++;
        return Promise.resolve(response(body));
      },
    });
    try {
      await Promise.all([client.refresh(), client.refresh()]);
      expect(calls).toBe(1);
      body = configuration;
      expect(await client.refresh()).toBe(false);
      expect(client.status().version).toBe(2);
      body = { ...configuration, configurationVersion: 2, flags: [] };
      expect(await client.refresh()).toBe(false);
      body = {
        ...configuration,
        configurationVersion: 3,
        environment: "other",
      };
      expect(await client.refresh()).toBe(false);
    } finally {
      await client.close();
    }
  });
  it("rejects oversized responses and defaults immediately on revoked credentials", async () => {
    let revoked = false;
    const client = new RolloutClient({
      url: "http://localhost",
      token: "synthetic-token",
      environment: "test",
      fetch: () =>
        Promise.resolve(
          revoked ? new Response(null, { status: 403 }) : response(),
        ),
    });
    try {
      await client.refresh();
      revoked = true;
      await client.refresh();
      expect(client.status().state).toBe("stale");
      expect(
        client.boolean("feature", { targetingKey: "subject-a" }, true),
      ).toBe(false);
    } finally {
      await client.close();
    }
    const small = new RolloutClient({
      url: "http://localhost",
      token: "synthetic-token",
      environment: "test",
      maxConfigurationBytes: 8,
      fetch: () => Promise.resolve(response()),
    });
    try {
      expect(await small.refresh()).toBe(false);
      expect(small.status().lastError).toBe("CONFIGURATION_TOO_LARGE");
    } finally {
      await small.close();
    }
  });
});
