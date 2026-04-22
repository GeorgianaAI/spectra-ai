import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvTestHarness } from "@/tests/utils/envTestHarness";
import { TEST_JWT_SECRET, TEST_USER_ID, TEST_USER_EMAIL } from "@/tests/utils/constants";

const OWNER_ID = "owner-uuid-0000-0000-000000000001";
const OTHER_ID = "other-uuid-0000-0000-000000000002";
const JOB_ID = "job-uuid-0000-0000-0000-000000000001";

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn(),
}));

async function makeToken(sub: string) {
  const { issueJwt } = await import("@/lib/jwt");
  return issueJwt(sub, TEST_USER_EMAIL);
}

describe("GET /api/job/[id]", () => {
  const { setEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setEnv({ JWT_SECRET: TEST_JWT_SECRET });
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("@/app/api/job/[id]/route");
    const req = new Request(`http://localhost:3000/api/job/${JOB_ID}`);
    const res = await GET(req as never, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when token is invalid", async () => {
    const { GET } = await import("@/app/api/job/[id]/route");
    const req = new Request(`http://localhost:3000/api/job/${JOB_ID}`, {
      headers: { Authorization: "Bearer invalid-token" },
    });
    const res = await GET(req as never, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when job belongs to a different user", async () => {
    const { getSupabaseClient } = await import("@/lib/supabase");
    vi.mocked(getSupabaseClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: JOB_ID, user_id: TEST_USER_ID, status: "completed" },
          error: null,
        }),
      }),
    } as never);

    const token = await makeToken(OTHER_ID);
    const { GET } = await import("@/app/api/job/[id]/route");
    const req = new Request(`http://localhost:3000/api/job/${JOB_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET(req as never, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 200 when job belongs to the requesting user", async () => {
    const jobData = { id: JOB_ID, user_id: TEST_USER_ID, status: "completed" };
    const { getSupabaseClient } = await import("@/lib/supabase");
    vi.mocked(getSupabaseClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: jobData, error: null }),
      }),
    } as never);

    const token = await makeToken(TEST_USER_ID);
    const { GET } = await import("@/app/api/job/[id]/route");
    const req = new Request(`http://localhost:3000/api/job/${JOB_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET(req as never, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(200);
  });

  it("returns 404 when job does not exist", async () => {
    const { getSupabaseClient } = await import("@/lib/supabase");
    vi.mocked(getSupabaseClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
      }),
    } as never);

    const token = await makeToken(TEST_USER_ID);
    const { GET } = await import("@/app/api/job/[id]/route");
    const req = new Request(`http://localhost:3000/api/job/${JOB_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET(req as never, { params: Promise.resolve({ id: JOB_ID }) });
    expect(res.status).toBe(404);
  });
});
