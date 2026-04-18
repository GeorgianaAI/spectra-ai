import GlassPanel from '@/components/GlassPanel';
import SectionLabel from '@/components/SectionLabel';

export default function DashboardPage() {
  return (
    <div
      style={{
        padding: '2rem',
        minHeight: '100vh',
        backgroundColor: '#060609',
        backgroundImage: `
          radial-gradient(circle at 50% -20%, rgba(0, 242, 255, 0.12) 0%, transparent 40%),
          linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 40px 40px, 40px 40px',
        color: '#fff',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          marginBottom: '2.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '1.5rem',
        }}
      >
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            letterSpacing: '0.2em',
            color: '#00f2ff',
            textTransform: 'uppercase',
          }}
        >
          SPECTRA AI{' '}
          <span style={{
            fontWeight: 500,
            letterSpacing: '0.05em',
            background: 'linear-gradient(to bottom, #fff 40%, rgba(255, 255, 255, 0.4))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            DASHBOARD
          </span>
        </h1>

        <span
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            padding: '3px 10px',
            fontSize: '0.7rem',
            fontFamily: 'monospace',
            color: 'rgba(255, 255, 255, 0.5)',
            letterSpacing: '0.1em',
          }}
        >
          MISSION-001
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem' }}>
          <span
            style={{
              fontSize: '0.65rem',
              color: '#00f2ff',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              padding: '4px 12px',
              borderRadius: '50px',
              border: '1px solid rgba(0, 242, 255, 0.3)',
              background: 'rgba(0, 242, 255, 0.05)',
            }}
          >
            ● STATUS: NOMINAL
          </span>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40% 1fr',
          gap: '1.5rem',
          alignItems: 'stretch',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <GlassPanel>
            <SectionLabel>OPERATOR // UPLOAD_ZONE</SectionLabel>
          </GlassPanel>

          <GlassPanel style={{ flex: 1 }}>
            <SectionLabel>SYSTEM // AGENT_GRAPH</SectionLabel>
          </GlassPanel>
        </div>

        <GlassPanel style={{ minHeight: '450px' }}>
          <SectionLabel>ANALYSIS // SYNTHESIS_PANEL</SectionLabel>
        </GlassPanel>
      </div>

      <GlassPanel
        style={{
          marginTop: '1.5rem',
          borderRadius: '24px',
          padding: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          color: 'rgba(255, 255, 255, 0.2)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        <span>
          AUTH: <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>ENFORCED</span>
        </span>
        <span>
          NODE: <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>SPECTRA_PRIME</span>
        </span>
        <span style={{ color: '#00f2ff', opacity: 0.6 }}>
          GOVERNANCE_TRACE // ACTIVE
        </span>
      </GlassPanel>
    </div>
  );
}
