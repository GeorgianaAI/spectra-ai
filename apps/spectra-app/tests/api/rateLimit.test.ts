import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvTestHarness } from "@/tests/utils/envTestHarness";
import { TEST_JWT_SECRET, VALID_INFRA_ENVS } from "@/tests/utils/constants";

const mockLimit = vi.fn().mockResolvedValue({ success: true });
const mockSlidingWindow = vi.fn().mockReturnValue("window-config");

const MockRatelimit = function Ratelimit() {
  return { limit: mockLimit };
};
MockRatelimit.slidingWindow = mockSlidingWindow;

vi.mock("@upstash/ratelimit", () => ({ Ratelimit: MockRatelimit }));
vi.mock("@upstash/redis", () => {
  const MockRedis = function Redis() {};
  (MockRedis as unknown as { fromEnv: () => object }).fromEnv = () => ({});
  return { Redis: MockRedis };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: function S3Client() {
    return { send: vi.fn().mockResolvedValue({}) };
  },
  PutObjectCommand: function PutObjectCommand() {},
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/presigned"),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid credentials" },
      }),
    },
  }),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: { send: vi.fn().mockResolvedValue({}) },
}));

const BASE_ENV = { JWT_SECRET: TEST_JWT_SECRET, ...VALID_INFRA_ENVS };

describe("Rate-limit: POST /api/upload", () => {
  const { setEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockResolvedValue({ success: true });
    mockSlidingWindow.mockClear();
    setEnv(BASE_ENV);
  });

  afterEach(() => {
    restoreEnv();
  });

  it("configures a sliding window of 3 requests per day", async () => {
    await import("@/app/api/upload/route");
    expect(mockSlidingWindow).toHaveBeenCalledWith(3, "1 d");
  });

  it("returns 429 with RATE_LIMITED code when limit is exhausted", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const { POST } = await import("@/app/api/upload/route");
    const req = new Request("http://localhost:3000/api/upload", { method: "POST" });
    const res = await POST(req as never);
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("passes the first IP from x-forwarded-for to the counter", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    await POST(req as never);
    expect(mockLimit).toHaveBeenCalledWith("203.0.113.1");
  });

  it("falls back to 'unknown' when x-forwarded-for is absent", async () => {
    const { POST } = await import("@/app/api/upload/route");
    const req = new Request("http://localhost:3000/api/upload", { method: "POST" });
    await POST(req as never);
    expect(mockLimit).toHaveBeenCalledWith("unknown");
  });

  it("allows the request through when the counter has capacity", async () => {
    mockLimit.mockResolvedValue({ success: true });
    const { POST } = await import("@/app/api/upload/route");
    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.1" },
    });
    const res = await POST(req as never);
    expect(res.status).not.toBe(429);
  });
});

describe("Rate-limit: POST /api/upload/presign", () => {
  const { setEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockResolvedValue({ success: true });
    mockSlidingWindow.mockClear();
    setEnv(BASE_ENV);
  });

  afterEach(() => {
    restoreEnv();
  });

  it("configures a sliding window of 3 requests per day", async () => {
    await import("@/app/api/upload/presign/route");
    expect(mockSlidingWindow).toHaveBeenCalledWith(3, "1 d");
  });

  it("returns 429 with RATE_LIMITED code when limit is exhausted", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const { POST } = await import("@/app/api/upload/presign/route");
    const req = new Request("http://localhost:3000/api/upload/presign", { method: "POST" });
    const res = await POST(req as never);
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("passes the first IP from x-forwarded-for to the counter", async () => {
    const { POST } = await import("@/app/api/upload/presign/route");
    const req = new Request("http://localhost:3000/api/upload/presign", {
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.5, 172.16.0.1" },
    });
    await POST(req as never);
    expect(mockLimit).toHaveBeenCalledWith("198.51.100.5");
  });

  it("falls back to 'unknown' when x-forwarded-for is absent", async () => {
    const { POST } = await import("@/app/api/upload/presign/route");
    const req = new Request("http://localhost:3000/api/upload/presign", { method: "POST" });
    await POST(req as never);
    expect(mockLimit).toHaveBeenCalledWith("unknown");
  });
});

describe("Rate-limit: POST /api/auth/token", () => {
  const { setEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockResolvedValue({ success: true });
    mockSlidingWindow.mockClear();
    setEnv(BASE_ENV);
  });

  afterEach(() => {
    restoreEnv();
  });

  it("configures a sliding window of 10 requests per hour", async () => {
    await import("@/app/api/auth/token/route");
    expect(mockSlidingWindow).toHaveBeenCalledWith(10, "1 h");
  });

  it("returns 429 with RATE_LIMITED code when limit is exhausted", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const { POST } = await import("@/app/api/auth/token/route");
    const req = new Request("http://localhost:3000/api/auth/token", {
      method: "POST",
      body: JSON.stringify({ email: "demo@spectra.app", password: "spectra-demo" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("passes the first IP from x-forwarded-for to the counter", async () => {
    const { POST } = await import("@/app/api/auth/token/route");
    const req = new Request("http://localhost:3000/api/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "192.0.2.10, 10.0.0.2",
      },
      body: JSON.stringify({ email: "x@x.com", password: "y" }),
    });
    await POST(req as never);
    expect(mockLimit).toHaveBeenCalledWith("192.0.2.10");
  });

  it("falls back to 'unknown' when x-forwarded-for is absent", async () => {
    const { POST } = await import("@/app/api/auth/token/route");
    const req = new Request("http://localhost:3000/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "x@x.com", password: "y" }),
    });
    await POST(req as never);
    expect(mockLimit).toHaveBeenCalledWith("unknown");
  });
});

describe("Rate-limit: POST /api/auth/refresh", () => {
  const { setEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockResolvedValue({ success: true });
    mockSlidingWindow.mockClear();
    setEnv(BASE_ENV);
  });

  afterEach(() => {
    restoreEnv();
  });

  it("configures a sliding window of 5 requests per minute", async () => {
    await import("@/app/api/auth/refresh/route");
    expect(mockSlidingWindow).toHaveBeenCalledWith(5, "1 m");
  });

  it("returns 429 with RATE_LIMITED code when limit is exhausted", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const { POST } = await import("@/app/api/auth/refresh/route");
    const req = new Request("http://localhost:3000/api/auth/refresh", { method: "POST" });
    const res = await POST(req as never);
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("passes the first IP from x-forwarded-for to the counter", async () => {
    const { POST } = await import("@/app/api/auth/refresh/route");
    const req = new Request("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.3" },
    });
    await POST(req as never);
    expect(mockLimit).toHaveBeenCalledWith("203.0.113.5");
  });

  it("falls back to 'unknown' when x-forwarded-for is absent", async () => {
    const { POST } = await import("@/app/api/auth/refresh/route");
    const req = new Request("http://localhost:3000/api/auth/refresh", { method: "POST" });
    await POST(req as never);
    expect(mockLimit).toHaveBeenCalledWith("unknown");
  });

  it("allows the request through when the counter has capacity", async () => {
    mockLimit.mockResolvedValue({ success: true });
    const { POST } = await import("@/app/api/auth/refresh/route");
    const req = new Request("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.5" },
    });
    const res = await POST(req as never);
    expect(res.status).not.toBe(429);
  });
});

describe("Rate-limit: GET /api/jobs", () => {
  const { setEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockResolvedValue({ success: true });
    mockSlidingWindow.mockClear();
    setEnv(BASE_ENV);
  });

  afterEach(() => {
    restoreEnv();
  });

  it("configures a sliding window of 60 requests per minute", async () => {
    await import("@/app/api/jobs/route");
    expect(mockSlidingWindow).toHaveBeenCalledWith(60, "1 m");
  });

  it("returns 429 with RATE_LIMITED code when limit is exhausted", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const { GET } = await import("@/app/api/jobs/route");
    const req = new Request("http://localhost:3000/api/jobs");
    const res = await GET(req as never);
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("passes the first IP from x-forwarded-for to the counter", async () => {
    const { GET } = await import("@/app/api/jobs/route");
    const req = new Request("http://localhost:3000/api/jobs", {
      headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1" },
    });
    await GET(req as never);
    expect(mockLimit).toHaveBeenCalledWith("198.51.100.1");
  });

  it("falls back to 'unknown' when x-forwarded-for is absent", async () => {
    const { GET } = await import("@/app/api/jobs/route");
    const req = new Request("http://localhost:3000/api/jobs");
    await GET(req as never);
    expect(mockLimit).toHaveBeenCalledWith("unknown");
  });
});

describe("Rate-limit: GET /api/job/[id]", () => {
  const { setEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockResolvedValue({ success: true });
    mockSlidingWindow.mockClear();
    setEnv(BASE_ENV);
  });

  afterEach(() => {
    restoreEnv();
  });

  it("configures a sliding window of 60 requests per minute", async () => {
    await import("@/app/api/job/[id]/route");
    expect(mockSlidingWindow).toHaveBeenCalledWith(60, "1 m");
  });

  it("returns 429 with RATE_LIMITED code when limit is exhausted", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const { GET } = await import("@/app/api/job/[id]/route");
    const req = new Request("http://localhost:3000/api/job/test-id");
    const res = await GET(req as never, { params: Promise.resolve({ id: "test-id" }) });
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("passes the first IP from x-forwarded-for to the counter", async () => {
    const { GET } = await import("@/app/api/job/[id]/route");
    const req = new Request("http://localhost:3000/api/job/test-id", {
      headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1" },
    });
    await GET(req as never, { params: Promise.resolve({ id: "test-id" }) });
    expect(mockLimit).toHaveBeenCalledWith("198.51.100.2");
  });

  it("falls back to 'unknown' when x-forwarded-for is absent", async () => {
    const { GET } = await import("@/app/api/job/[id]/route");
    const req = new Request("http://localhost:3000/api/job/test-id");
    await GET(req as never, { params: Promise.resolve({ id: "test-id" }) });
    expect(mockLimit).toHaveBeenCalledWith("unknown");
  });
});

describe("Rate-limit: GET /api/job/[id]/trace", () => {
  const { setEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockResolvedValue({ success: true });
    mockSlidingWindow.mockClear();
    setEnv(BASE_ENV);
  });

  afterEach(() => {
    restoreEnv();
  });

  it("configures a sliding window of 60 requests per minute", async () => {
    await import("@/app/api/job/[id]/trace/route");
    expect(mockSlidingWindow).toHaveBeenCalledWith(60, "1 m");
  });

  it("returns 429 with RATE_LIMITED code when limit is exhausted", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const { GET } = await import("@/app/api/job/[id]/trace/route");
    const req = new Request("http://localhost:3000/api/job/test-id/trace");
    const res = await GET(req as never, { params: Promise.resolve({ id: "test-id" }) });
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("passes the first IP from x-forwarded-for to the counter", async () => {
    const { GET } = await import("@/app/api/job/[id]/trace/route");
    const req = new Request("http://localhost:3000/api/job/test-id/trace", {
      headers: { "x-forwarded-for": "198.51.100.3, 10.0.0.1" },
    });
    await GET(req as never, { params: Promise.resolve({ id: "test-id" }) });
    expect(mockLimit).toHaveBeenCalledWith("198.51.100.3");
  });

  it("falls back to 'unknown' when x-forwarded-for is absent", async () => {
    const { GET } = await import("@/app/api/job/[id]/trace/route");
    const req = new Request("http://localhost:3000/api/job/test-id/trace");
    await GET(req as never, { params: Promise.resolve({ id: "test-id" }) });
    expect(mockLimit).toHaveBeenCalledWith("unknown");
  });
});
