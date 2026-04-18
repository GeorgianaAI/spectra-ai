import type { CSSProperties } from 'react';

interface AzureButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  style?: CSSProperties;
}

const baseStyle: CSSProperties = {
  display: 'inline-block',
  background: '#00f2ff',
  color: '#000',
  border: 'none',
  borderRadius: '50px',
  padding: '1rem 3rem',
  fontWeight: 800,
  fontSize: '0.8rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: '0 10px 30px rgba(0, 242, 255, 0.3)',
  transition: 'transform 0.2s ease',
  fontFamily: 'inherit',
};

const disabledStyle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  color: 'rgba(255,255,255,0.3)',
  boxShadow: 'none',
  cursor: 'not-allowed',
};

export default function AzureButton({ children, onClick, href, type = 'button', disabled, style }: AzureButtonProps) {
  const merged: CSSProperties = { ...baseStyle, ...(disabled ? disabledStyle : {}), ...style };

  if (href) {
    return <a href={href} style={merged}>{children}</a>;
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={merged}>
      {children}
    </button>
  );
}
