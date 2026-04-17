/**
 * GET /api/job/[id]/trace
 *
 * Phase 3 implementation:
 *   1. Validate JWT.
 *   2. Fetch job row from Supabase, enforce user ownership.
 *   3. Return governance_trace array from the completed job.
 *
 * Returns consistent error shape: { error: string, code: string }
 */

import { NextResponse } from 'next/server';

export async function GET() {
  // Phase 3: implement governance trace fetch
  return NextResponse.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, { status: 501 });
}
