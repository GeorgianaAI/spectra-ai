/**
 * POST /api/auth/token
 *
 * Phase 3 implementation:
 *   1. Parse { email, password } from request body (Zod validated).
 *   2. Sign in via Supabase Auth (email/password).
 *   3. Issue a JWT signed with JWT_SECRET, payload: { sub: userId, email }.
 *   4. Return { token }.
 *
 * No rate limiting on this route.
 * Returns consistent error shape: { error: string, code: string }
 */

import { NextResponse } from 'next/server';

export async function POST() {
  // Phase 3: implement JWT issuance
  return NextResponse.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, { status: 501 });
}
