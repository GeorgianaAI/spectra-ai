import { NextRequest, NextResponse } from "next/server";
import { issueJwt, verifyJwt } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing token", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let sub: string;
  let email: string;
  try {
    const claims = await verifyJwt(auth.slice(7));
    sub = claims.sub;
    email = claims.email;
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired token", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const token = await issueJwt(sub, email);
  return NextResponse.json({ token });
}
