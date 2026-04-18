import type { CSSProperties, ReactNode } from 'react';

interface SectionLabelProps {
  children: ReactNode;
  style?: CSSProperties;
}

export default function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <p
      style={{
        color: '#00f2ff',
      opacity: 0.8,
        fontSize: '0.65rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        fontFamily: 'monospace',
        marginBottom: '1.25rem',
        ...style,
      }}
    >
      {children}
    </p>
  );
}
