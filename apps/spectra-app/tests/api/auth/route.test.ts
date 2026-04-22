import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvTestHarness } from "@/tests/utils/envTestHarness";
import { TEST_JWT_SECRET, TEST_USER_ID, TEST_USER_EMAIL } from "@/tests/utils/constants";

const mockLimit = vi.fn().mockResolvedValue({ success: true });

const MockRatelimit = function Ratelimit() {
  return { limit: mockLimit };
};
MockRatelimit.slidingWindow = vi.fn().mockReturnValue({});

vi.mock("@upstash/ratelimit", () => ({ Ratelimit: MockRatelimit }));
vi.mock("@upstash/redis", () => {
  const MockRedis = function Redis() {};
  (MockRedis as unknown as { fromEnv: () => object }).fromEnv = () => ({});
  return { Redis: MockRedis };
});

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn(),
}));

describe("POST /api/auth/token", () => {
  const { setEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({ success: true });
    setEnv({ JWT_SECRET: TEST_JWT_SECRET });
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("@/app/api/auth/token/route");
    const req = new Request("http://localhost:3000/api/auth/token", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("returns 400 when email or password is missing", async () => {
    const { POST } = await import("@/app/api/auth/token/route");
    const req = new Request("http://localhost:3000/api/auth/token", {
      method: "POST",
      body: JSON.stringify({ email: "bad-email" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid credentials", async () => {
    const { getSupabaseClient } = await import("@/lib/supabase");
    vi.mocked(getSupabaseClient).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "Invalid login credentials" },
        }),
      },
    } as never);

    const { POST } = await import("@/app/api/auth/token/route");
    const req = new Request("http://localhost:3000/api/auth/token", {
      method: "POST",
      body: JSON.stringify({ email: "wrong@example.com", password: "wrong" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 200 with a token for valid credentials", async () => {
    const { getSupabaseClient } = await import("@/lib/supabase");
    vi.mocked(getSupabaseClient).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: TEST_USER_ID, email: TEST_USER_EMAIL } },
          error: null,
        }),
      },
    } as never);

    const { POST } = await import("@/app/api/auth/token/route");
    const req = new Request("http://localhost:3000/api/auth/token", {
      method: "POST",
      body: JSON.stringify({ email: TEST_USER_EMAIL, password: "spectra-demo" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, string>;
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
  });
});
