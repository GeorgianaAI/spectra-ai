import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: "missing_env" }, { status: 500 });
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/jobs?select=id&limit=1`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "User-Agent": "SpectraAI-Keepalive",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error(
        JSON.stringify({
          component: "spectra.api.keepalive",
          event: "ping_failed",
          status: res.status,
        }),
      );
      return NextResponse.json({ ok: false, status: res.status }, { status: 502 });
    }

    console.log(JSON.stringify({ component: "spectra.api.keepalive", event: "ping_ok" }));
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    console.error(
      JSON.stringify({ component: "spectra.api.keepalive", event: "ping_error", detail }),
    );
    return NextResponse.json({ ok: false, error: detail }, { status: 502 });
  }
}
