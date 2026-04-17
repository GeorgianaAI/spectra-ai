/**
 * POST /api/inngest — Inngest serve handler
 *
 * Phase 4 implementation:
 *   Wire the Inngest client serve handler to expose the spectra/job.process function.
 *   Inngest calls this endpoint to deliver job events and receive execution results.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  // Phase 4: wire Inngest serve handler
  return NextResponse.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, { status: 501 });
}

export async function GET() {
  // Inngest uses GET for introspection in dev mode
  return NextResponse.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, { status: 501 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, { status: 501 });
}
