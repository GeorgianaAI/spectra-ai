import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logAuthEvent, type AuthEventType } from "@/lib/authLogger";

describe("logAuthEvent", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("logs valid JSON with required fields", () => {
    logAuthEvent({ type: "login_success", ip: "1.2.3.4" });
    expect(consoleSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string) as Record<string, string>;
    expect(logged.type).toBe("login_success");
    expect(logged.ip).toBe("1.2.3.4");
    expect(logged.service).toBe("spectra-auth");
    expect(typeof logged.timestamp).toBe("string");
  });

  it("timestamp is a valid ISO 8601 string", () => {
    logAuthEvent({ type: "login_failed", ip: "1.2.3.4" });
    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string) as Record<string, string>;
    expect(() => new Date(logged.timestamp)).not.toThrow();
    expect(new Date(logged.timestamp).toISOString()).toBe(logged.timestamp);
  });

  it("handles all event types without throwing", () => {
    const types: AuthEventType[] = [
      "login_success",
      "login_failed",
      "login_rate_limited",
      "refresh_success",
      "refresh_invalid_token",
      "refresh_rate_limited",
    ];
    for (const type of types) {
      expect(() => logAuthEvent({ type, ip: "1.2.3.4" })).not.toThrow();
    }
  });
});
