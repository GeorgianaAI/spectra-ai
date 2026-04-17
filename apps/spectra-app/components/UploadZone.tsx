/**
 * UploadZone — three side-by-side modality drop targets.
 *
 * Phase 3 implementation:
 *   - Three targets: Document (teal), Vision (sky blue), Audio (coral).
 *   - Each accepts specific file types via HTML5 File API (no external drag-drop lib).
 *   - Dashed border on each target, modality color accent on hover and when a file is loaded.
 *   - Shows filename once a file is dropped or selected.
 *   - Calls onUpload(files) callback when files change.
 *
 * Style: CSS modules or inline styles only — no Tailwind utility classes.
 */

'use client';

import type { UploadedFiles } from '@/lib/types';

interface UploadZoneProps {
  onUpload: (files: UploadedFiles) => void;
}

// Phase 3: implement drag-and-drop upload zone
export default function UploadZone({ onUpload: _onUpload }: UploadZoneProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '0.75rem',
      }}
    >
      {(['document', 'vision', 'audio'] as const).map((modality) => (
        <div
          key={modality}
          style={{
            border: '1.5px dashed var(--border)',
            borderRadius: '8px',
            padding: '1.5rem 1rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          <p style={{ textTransform: 'capitalize', marginBottom: '0.25rem' }}>{modality}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Phase 3</p>
        </div>
      ))}
    </div>
  );
}
