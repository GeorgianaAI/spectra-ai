/**
 * AgentGraph — visual node graph showing the six agent nodes.
 *
 * Phase 3 implementation:
 *   - Five visible nodes: Router (top center), Document + Vision + Audio (middle row),
 *     Synthesis (bottom center). Auditor shown as a sub-indicator on Synthesis.
 *   - Each node is a dark surface card with its label, modality color accent, and
 *     a status indicator: idle / processing / complete.
 *   - Processing nodes show a soft amber pulsing ring via CSS animation.
 *   - Connecting edges are SVG lines between nodes.
 *   - Driven by agentStatuses prop — pure visual, no API calls.
 *
 * Style: CSS modules or inline styles only — no Tailwind utility classes.
 */

'use client';

import type { AgentStatuses } from '@/lib/types';

interface AgentGraphProps {
  agentStatuses: AgentStatuses;
}

// Phase 3: implement visual node graph with SVG edges and CSS pulse animation
export default function AgentGraph({ agentStatuses: _agentStatuses }: AgentGraphProps) {
  const nodes = [
    { id: 'router', label: 'Router', color: 'var(--accent)' },
    { id: 'document', label: 'Document', color: 'var(--modality-doc)' },
    { id: 'vision', label: 'Vision', color: 'var(--modality-vision)' },
    { id: 'audio', label: 'Audio', color: 'var(--modality-audio)' },
    { id: 'synthesis', label: 'Synthesis', color: 'var(--accent)' },
  ];

  return (
    <div style={{ padding: '1rem' }}>
      {nodes.map((node) => (
        <div
          key={node.id}
          style={{
            background: 'var(--bg)',
            border: `1px solid ${node.color}44`,
            borderLeft: `3px solid ${node.color}`,
            borderRadius: '6px',
            padding: '0.5rem 0.75rem',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ color: node.color, fontSize: '0.75rem', fontFamily: 'monospace' }}>
            {node.label}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginLeft: 'auto' }}>
            idle
          </span>
        </div>
      ))}
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginTop: '0.5rem' }}>
        SVG edges + pulse animation — Phase 3
      </p>
    </div>
  );
}
