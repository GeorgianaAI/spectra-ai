import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/jwt";

export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function requireAuth(
  request: NextRequest,
): Promise<{ userId: string; email: string } | NextResponse> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing token", code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const claims = await verifyJwt(auth.slice(7));
    return { userId: claims.sub, email: claims.email };
  } catch {
    return NextResponse.json({ error: "Invalid token", code: "UNAUTHORIZED" }, { status: 401 });
  }
}
