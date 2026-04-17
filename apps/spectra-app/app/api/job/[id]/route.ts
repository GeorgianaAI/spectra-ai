/**
 * GET /api/job/[id]
 *
 * Phase 3 implementation:
 *   1. Validate JWT.
 *   2. Fetch job row from Supabase by id.
 *   3. Enforce user ownership (job.user_id === requesting user id).
 *   4. Return { id, status, confidence_scores, governance_trace, modalities_used, completed_at }.
 *
 * Returns consistent error shape: { error: string, code: string }
 */

import { NextResponse } from 'next/server';

export async function GET() {
  // Phase 3: implement job status fetch
  return NextResponse.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, { status: 501 });
}
