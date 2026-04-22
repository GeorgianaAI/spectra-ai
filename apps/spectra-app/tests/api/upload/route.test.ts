import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvTestHarness } from "@/tests/utils/envTestHarness";
import { TEST_JWT_SECRET, VALID_INFRA_ENVS, TEST_USER_ID, TEST_USER_EMAIL } from "@/tests/utils/constants";

const mockSend = vi.fn().mockResolvedValue({});
const mockLimit = vi.fn().mockResolvedValue({ success: true });

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: function S3Client() {
    return { send: mockSend };
  },
  PutObjectCommand: function PutObjectCommand() {},
}));

const MockRatelimit = function Ratelimit() {
  return { limit: mockLimit };
};
MockRatelimit.slidingWindow = vi.fn().mockReturnValue({});

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: MockRatelimit,
}));

vi.mock("@upstash/redis", () => {
  const MockRedis = function Redis() {};
  (MockRedis as { fromEnv: () => object }).fromEnv = () => ({});
  return { Redis: MockRedis };
});

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { send: vi.fn().mockResolvedValue({}) },
}));

describe("POST /api/upload", () => {
  const { setEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
    mockLimit.mockResolvedValue({ success: true });
    setEnv({
      JWT_SECRET: TEST_JWT_SECRET,
      AWS_REGION: "eu-west-1",
      S3_BUCKET_NAME: "spectra-uploads",
      ...VALID_INFRA_ENVS,
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const req = new Request("http://localhost:3000/api/upload", { method: "POST" });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when token is invalid", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { Authorization: "Bearer not-a-valid-jwt" },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const { POST } = await import("@/app/api/upload/route");
    const req = new Request("http://localhost:3000/api/upload", { method: "POST" });
    const res = await POST(req as never);
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("returns 400 when no valid files are provided", async () => {
    const { issueJwt } = await import("@/lib/jwt");
    const token = await issueJwt(TEST_USER_ID, TEST_USER_EMAIL);
    const { POST } = await import("@/app/api/upload/route");
    const form = new FormData();
    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });
});
