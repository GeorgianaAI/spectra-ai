/**
 * GovernanceTrace — collapsible decision log table.
 *
 * Phase 3 implementation:
 *   - Collapsible bottom panel (collapsed by default, expands on click).
 *   - Each row: timestamp, agent name (colored by modality), finding (monospace),
 *     confidence score, NIST RMF tag badge.
 *   - Subtle amber left border on each row.
 *   - Accepts entries: GovernanceEntry[] prop.
 *
 * Style: CSS modules or inline styles only — no Tailwind utility classes.
 */

'use client';

import { useState } from 'react';
import type { GovernanceEntry } from '@/lib/types';

const AGENT_COLORS: Record<string, string> = {
  document: 'var(--modality-doc)',
  vision: 'var(--modality-vision)',
  audio: 'var(--modality-audio)',
  synthesis: 'var(--accent)',
};

interface GovernanceTraceProps {
  entries: GovernanceEntry[];
}

// Phase 3: implement collapsible table with full entry rendering
export default function GovernanceTrace({ entries }: GovernanceTraceProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          background: 'var(--surface)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--text-secondary)',
          fontSize: '0.75rem',
          textAlign: 'left',
        }}
      >
        <span style={{ color: 'var(--accent)', fontSize: '0.7rem' }}>{expanded ? '▼' : '▶'}</span>
        Governance Trace
        <span
          style={{
            marginLeft: 'auto',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '1px 6px',
            fontSize: '0.65rem',
            fontFamily: 'monospace',
          }}
        >
          {entries.length} entries
        </span>
      </button>

      {expanded && (
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {entries.length === 0 ? (
            <p
              style={{
                padding: '1rem',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
              }}
            >
              No entries yet.
            </p>
          ) : (
            entries.map((entry, i) => (
              <div
                key={i}
                style={{
                  borderLeft: '3px solid var(--accent)',
                  padding: '0.6rem 1rem',
                  borderBottom: '1px solid var(--border)',
                  display: 'grid',
                  gridTemplateColumns: '120px 80px 1fr 48px 80px',
                  gap: '0.75rem',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                }}
              >
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span style={{ color: AGENT_COLORS[entry.agent] ?? 'var(--text-primary)' }}>
                  {entry.agent}
                </span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {entry.finding}
                </span>
                <span style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>
                  {entry.confidence}%
                </span>
                <span
                  style={{
                    background: '#c8922a22',
                    border: '1px solid var(--accent)',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    color: 'var(--accent)',
                    fontSize: '0.65rem',
                    fontFamily: 'monospace',
                    textAlign: 'center',
                  }}
                >
                  {entry.nistTag}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
