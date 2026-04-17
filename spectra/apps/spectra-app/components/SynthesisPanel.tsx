/**
 * SynthesisPanel — streaming report panel with inline citation badges.
 *
 * Phase 3 implementation:
 *   - Receives a ReadableStream from the Vercel AI SDK and renders markdown progressively.
 *   - Parses citation tags from the stream using regex \[([DVA]\d+)\].
 *   - Citation badges: [D1] in teal, [V2] in sky blue, [A1] in coral — small monospace pills.
 *   - Renders ConfidenceBar above the report.
 *
 * Style: CSS modules or inline styles only — no Tailwind utility classes.
 */

'use client';

import ConfidenceBar from './ConfidenceBar';
import type { ConfidenceScores } from '@/lib/types';

interface SynthesisPanelProps {
  stream?: ReadableStream;
  confidenceScores: ConfidenceScores;
}

// Phase 3: implement streaming markdown rendering with citation badge parsing
export default function SynthesisPanel({ stream: _stream, confidenceScores }: SynthesisPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      <ConfidenceBar scores={confidenceScores} />

      <div
        style={{
          flex: 1,
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          color: 'var(--text-primary)',
          lineHeight: 1.7,
          overflowY: 'auto',
        }}
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Streaming synthesis report will appear here — Phase 3
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
          Citation badges: <span style={{ color: 'var(--modality-doc)' }}>[D1]</span>{' '}
          <span style={{ color: 'var(--modality-vision)' }}>[V2]</span>{' '}
          <span style={{ color: 'var(--modality-audio)' }}>[A1]</span>
        </p>
      </div>
    </div>
  );
}
