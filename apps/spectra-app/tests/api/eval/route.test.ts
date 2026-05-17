import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvTestHarness } from "@/tests/utils/envTestHarness";

vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn();
  const MockAnthropic = function Anthropic() {
    return {
      messages: { create: mockCreate },
    };
  };
  (MockAnthropic as unknown as { _mockCreate: typeof mockCreate })._mockCreate = mockCreate;
  return { default: MockAnthropic };
});

async function loadMockCreate() {
  const sdk = await import("@anthropic-ai/sdk");
  return (sdk.default as unknown as { _mockCreate: ReturnType<typeof vi.fn> })._mockCreate;
}

function makePostRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/eval", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("POST /api/eval", () => {
  const { setEnv, restoreEnv } = useEnvTestHarness();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setEnv({ ANTHROPIC_API_KEY: "test-key" });
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("@/app/api/eval/route");
    const req = new Request("http://localhost:3000/api/eval", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("returns 400 when input is missing", async () => {
    const { POST } = await import("@/app/api/eval/route");
    const res = await POST(makePostRequest({ metadata: {} }) as never);
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("returns 400 when input is an empty string", async () => {
    const { POST } = await import("@/app/api/eval/route");
    const res = await POST(makePostRequest({ input: "" }) as never);
    expect(res.status).toBe(400);
  });

  it("returns 401 when EVAL_API_KEY is set and header is missing", async () => {
    setEnv({ EVAL_API_KEY: "secret-key" });
    const { POST } = await import("@/app/api/eval/route");
    const res = await POST(makePostRequest({ input: "test input" }) as never);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when EVAL_API_KEY is set and header is wrong", async () => {
    setEnv({ EVAL_API_KEY: "secret-key" });
    const { POST } = await import("@/app/api/eval/route");
    const res = await POST(
      makePostRequest({ input: "test input" }, { "x-eval-api-key": "wrong-key" }) as never,
    );
    expect(res.status).toBe(401);
  });

  it("calls Claude and returns output on success", async () => {
    const mockCreate = await loadMockCreate();
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Revenue was $2.4M with 67% gross margin." }],
    });

    const { POST } = await import("@/app/api/eval/route");
    const res = await POST(
      makePostRequest({
        input: "Q3 revenue: $2.4M, gross margin: 67%, active users: 500K",
      }) as never,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, string>;
    expect(body.output).toBe("Revenue was $2.4M with 67% gross margin.");
  });

  it("passes when EVAL_API_KEY is set and correct header is provided", async () => {
    setEnv({ EVAL_API_KEY: "secret-key" });
    const mockCreate = await loadMockCreate();
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Findings summary." }],
    });

    const { POST } = await import("@/app/api/eval/route");
    const res = await POST(
      makePostRequest({ input: "test input" }, { "x-eval-api-key": "secret-key" }) as never,
    );
    expect(res.status).toBe(200);
  });

  it("returns 500 when Claude returns non-text content", async () => {
    const mockCreate = await loadMockCreate();
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
    });

    const { POST } = await import("@/app/api/eval/route");
    const res = await POST(makePostRequest({ input: "test input" }) as never);
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, string>;
    expect(body.code).toBe("INTERNAL_ERROR");
  });
});
