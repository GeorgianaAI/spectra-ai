// Probe functions for /api/health. Extracted so tests can mock them independently.

type ProbeResult = { state: "ok" | "missing" | "error"; detail?: string };

export async function probeSupabase(url: string, key: string): Promise<ProbeResult> {
  try {
    // Query a real table — the API gateway root returns 200 even when the DB is paused.
    const res = await fetch(`${url}/rest/v1/jobs?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? { state: "ok" } : { state: "error", detail: `status_${res.status}` };
  } catch (err) {
    return { state: "error", detail: err instanceof Error ? err.message : "probe_failed" };
  }
}

export async function probeRedis(url: string, token: string): Promise<ProbeResult> {
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    const body = (await res.json()) as { result?: string };
    return body?.result === "PONG"
      ? { state: "ok" }
      : { state: "error", detail: "unexpected_pong_response" };
  } catch (err) {
    return { state: "error", detail: err instanceof Error ? err.message : "probe_failed" };
  }
}
