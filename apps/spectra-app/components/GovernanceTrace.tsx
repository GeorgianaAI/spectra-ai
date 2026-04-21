'use client';

import { useState } from 'react';
import type { GovernanceEntry } from '@/lib/types';

const AGENT_COLORS: Record<string, string> = {
  document:  '#2dd4bf',
  vision:    '#38bdf8',
  audio:     '#f87171',
  synthesis: '#00f2ff',
};

const NIST_COLORS: Record<string, string> = {
  GOVERN:  '#00f2ff',
  MAP:     '#38bdf8',
  MEASURE: '#2dd4bf',
  MANAGE:  '#f87171',
};

interface GovernanceTraceProps {
  entries: GovernanceEntry[];
}

export default function GovernanceTrace({ entries }: GovernanceTraceProps) {
  const [expanded, setExpanded] = useState<boolean>(false);

  return (
    <div style={{ overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          padding: '0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          color: 'rgba(255,255,255,0.2)',
          fontSize: '0.65rem',
          fontWeight: 700,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          textAlign: 'left',
        }}
      >
        <span style={{ color: '#00f2ff', opacity: 0.8 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ color: '#00f2ff', opacity: 0.8 }}>Governance</span>
        <span>{'// Trace'}</span>
        <span
          style={{
            marginLeft: 'auto',
            background: 'rgba(0,242,255,0.05)',
            border: '1px solid rgba(0,242,255,0.2)',
            borderRadius: '4px',
            padding: '1px 8px',
            color: '#00f2ff',
            opacity: 0.7,
            fontSize: '0.6rem',
          }}
        >
          {entries.length} entries
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: '1rem', maxHeight: '280px', overflowY: 'auto' }}>
          {entries.length === 0 ? (
            <p
              style={{
                color: 'rgba(255,255,255,0.2)',
                fontSize: '0.7rem',
                fontFamily: 'monospace',
              }}
            >
              No entries yet.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 72px 1fr 44px 76px',
                gap: '0',
              }}
            >
              {/* Header */}
              {(['Time', 'Agent', 'Finding', '%', 'NIST'] as const).map((h) => (
                <div
                  key={h}
                  style={{
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.55rem',
                    color: 'rgba(255,255,255,0.2)',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {h}
                </div>
              ))}

              {entries.map((entry, i) => {
                const agentColor = AGENT_COLORS[entry.agent] ?? '#fff';
                const nistColor = NIST_COLORS[entry.nistTag] ?? '#00f2ff';
                return (
                  <>
                    <div
                      key={`${i}-ts`}
                      style={{
                        padding: '0.45rem 0.5rem',
                        borderLeft: `2px solid ${agentColor}40`,
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        fontSize: '0.65rem',
                        color: 'rgba(255,255,255,0.3)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                    <div
                      key={`${i}-agent`}
                      style={{
                        padding: '0.45rem 0.5rem',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        fontSize: '0.65rem',
                        color: agentColor,
                        fontFamily: 'monospace',
                        textTransform: 'uppercase',
                      }}
                    >
                      {entry.agent}
                    </div>
                    <div
                      key={`${i}-finding`}
                      style={{
                        padding: '0.45rem 0.5rem',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        fontSize: '0.65rem',
                        color: '#e8e6df',
                        fontFamily: 'monospace',
                        lineHeight: 1.4,
                      }}
                    >
                      {entry.finding}
                    </div>
                    <div
                      key={`${i}-conf`}
                      style={{
                        padding: '0.45rem 0.5rem',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        fontSize: '0.65rem',
                        color: 'rgba(255,255,255,0.4)',
                        fontFamily: 'monospace',
                        textAlign: 'right',
                      }}
                    >
                      {entry.confidence}%
                    </div>
                    <div
                      key={`${i}-nist`}
                      style={{
                        padding: '0.45rem 0.5rem',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          background: `${nistColor}12`,
                          border: `1px solid ${nistColor}40`,
                          borderRadius: '3px',
                          padding: '1px 5px',
                          color: nistColor,
                          fontSize: '0.55rem',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                        }}
                      >
                        {entry.nistTag}
                      </span>
                    </div>
                  </>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
