import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvTestHarness } from "@/tests/utils/envTestHarness";
import { makeTestRequest } from "@/tests/utils/httpTestRequest";
import { VALID_INFRA_ENVS } from "@/tests/utils/constants";

vi.mock("@/lib/health-probes", () => ({
  probeSupabase: vi.fn(),
  probeRedis: vi.fn(),
}));

async function loadProbes() {
  return import("@/lib/health-probes");
}

describe("GET /api/health", () => {
  const { setEnv, unsetEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreEnv();
    vi.clearAllMocks();
  });

  it("returns 200 with ok deps when both probes succeed", async () => {
    setEnv({
      NODE_ENV: "test",
      ...VALID_INFRA_ENVS,
    });

    const probes = await loadProbes();
    vi.mocked(probes.probeSupabase).mockResolvedValue({ state: "ok" });
    vi.mocked(probes.probeRedis).mockResolvedValue({ state: "ok" });

    const { GET } = await import("@/app/api/health/route");
    const res = await GET(makeTestRequest("/api/health"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const deps = body.dependencies as Record<string, string>;
    expect(body.status).toBe("ok");
    expect(deps.supabase).toBe("ok");
    expect(deps.redis).toBe("ok");
  });

  it("returns 200 in non-production even when probes are missing", async () => {
    setEnv({ NODE_ENV: "test" });
    unsetEnv(...Object.keys(VALID_INFRA_ENVS));

    const { GET } = await import("@/app/api/health/route");
    const res = await GET(makeTestRequest("/api/health"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    const deps = body.dependencies as Record<string, string>;
    expect(deps.supabase).toBe("missing");
    expect(deps.redis).toBe("missing");
  });

  it("returns 503 in production when redis probe errors", async () => {
    setEnv({
      NODE_ENV: "production",
      ...VALID_INFRA_ENVS,
    });

    const probes = await loadProbes();
    vi.mocked(probes.probeSupabase).mockResolvedValue({ state: "ok" });
    vi.mocked(probes.probeRedis).mockResolvedValue({
      state: "error",
      detail: "redis_probe_timeout",
    });

    const { GET } = await import("@/app/api/health/route");
    const res = await GET(makeTestRequest("/api/health"));

    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    const deps = body.dependencies as Record<string, string>;
    const details = body.details as Record<string, string>;
    expect(body.status).toBe("degraded");
    expect(deps.redis).toBe("error");
    expect(details.redis).toBe("redis_probe_timeout");
  });

  it("returns 503 in production when supabase probe errors", async () => {
    setEnv({
      NODE_ENV: "production",
      ...VALID_INFRA_ENVS,
    });

    const probes = await loadProbes();
    vi.mocked(probes.probeSupabase).mockResolvedValue({ state: "error", detail: "status_503" });
    vi.mocked(probes.probeRedis).mockResolvedValue({ state: "ok" });

    const { GET } = await import("@/app/api/health/route");
    const res = await GET(makeTestRequest("/api/health"));

    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    const details = body.details as Record<string, string>;
    expect(body.status).toBe("degraded");
    expect(details.supabase).toBe("status_503");
  });

  it("returns 503 in production when critical env vars are missing", async () => {
    setEnv({ NODE_ENV: "production" });
    unsetEnv(...Object.keys(VALID_INFRA_ENVS));

    const { GET } = await import("@/app/api/health/route");
    const res = await GET(makeTestRequest("/api/health"));

    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    const deps = body.dependencies as Record<string, string>;
    expect(deps.supabase).toBe("missing");
    expect(deps.redis).toBe("missing");
  });

  it("does not leak secret values in the response body", async () => {
    setEnv({
      NODE_ENV: "production",
      ...VALID_INFRA_ENVS,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "super-secret-anon-key",
      SUPABASE_SERVICE_KEY: "super-secret-service-key",
      UPSTASH_REDIS_REST_TOKEN: "super-secret-redis-token",
    });

    const probes = await loadProbes();
    vi.mocked(probes.probeSupabase).mockResolvedValue({ state: "ok" });
    vi.mocked(probes.probeRedis).mockResolvedValue({ state: "ok" });

    const { GET } = await import("@/app/api/health/route");
    const res = await GET(makeTestRequest("/api/health"));
    const text = await res.text();

    expect(text).not.toContain("super-secret-anon-key");
    expect(text).not.toContain("super-secret-service-key");
    expect(text).not.toContain("super-secret-redis-token");
  });

  it("calls probeSupabase and probeRedis with the correct env values", async () => {
    setEnv({
      NODE_ENV: "test",
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      SUPABASE_SERVICE_KEY: "service-xyz",
      UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token-xyz",
    });

    const probes = await loadProbes();
    vi.mocked(probes.probeSupabase).mockResolvedValue({ state: "ok" });
    vi.mocked(probes.probeRedis).mockResolvedValue({ state: "ok" });

    const { GET } = await import("@/app/api/health/route");
    await GET(makeTestRequest("/api/health"));

    expect(vi.mocked(probes.probeSupabase)).toHaveBeenCalledWith(
      "https://abc.supabase.co",
      "service-xyz",
    );
    expect(vi.mocked(probes.probeRedis)).toHaveBeenCalledWith(
      "https://redis.upstash.io",
      "token-xyz",
    );
  });
});
