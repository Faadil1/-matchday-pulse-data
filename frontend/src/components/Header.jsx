/*
  Header — restyled to the Matchday Pulse system (Tactical Telemetry × Quiet Luxury).
  Repo path: src/components/Header.jsx  (drop-in, no props — matches <Header /> in App.jsx)
  ------------------------------------------------------------------
  Requires the shared stylesheet + className="mp-app" on the App root.
  Notes vs original: dropped the ⚡ emoji and cyan wordmark (minimalist-ui bans emojis;
  brutalist reserves colour). Status is monochrome — red is kept exclusively for the
  fraud signal downstream. If you want the header status to track the live phase, accept
  a `phase` prop and pass it from App; left propless here to match the current contract.
*/

export default function Header() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 22px',
      borderBottom: '1px solid var(--line)',
      background: 'rgba(10,10,10,0.82)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      flexShrink: 0,
    }}>
      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span aria-hidden style={{
          width: 24, height: 24, flex: 'none',
          border: '1px solid var(--ink)', position: 'relative',
        }}>
          <span style={{ position: 'absolute', top: 5, right: 5, bottom: 5, left: 5, background: 'var(--red)' }} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 500,
            letterSpacing: '0.01em', lineHeight: 1, color: 'var(--ink)',
          }}>
            Matchday Pulse
          </span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'var(--ink-3)', lineHeight: 1,
          }}>
            Fraud investigation agent
          </span>
        </div>
      </div>

      {/* Right cluster: registration + system status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--ink-3)',
        }}>
          MP-2026-0606 · Toronto
        </span>
        <span className="mp-status" data-state="idle">
          <span className="mp-pip" aria-hidden />
          agent online
        </span>
      </div>
    </header>
  )
}
