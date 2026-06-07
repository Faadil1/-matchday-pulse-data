export default function Header() {
  return (
    <header
      style={{ borderBottom: '1px solid #1F2937', background: 'rgba(20,25,37,0.85)' }}
      className="sticky top-0 z-50 backdrop-blur-md px-6 py-4 flex items-center justify-between"
    >
      {/* Wordmark */}
      <div className="flex flex-col gap-0.5">
        <span
          className="text-xl font-bold tracking-tight leading-none"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: '#22D3EE' }}
        >
          ⚡ Matchday Pulse
        </span>
        <span className="text-xs" style={{ color: '#94A3B8' }}>
          Real-time fraud investigation agent
        </span>
      </div>

      {/* Status pill */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
        style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E' }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: '#22C55E',
            boxShadow: '0 0 6px 2px rgba(34,197,94,0.5)',
            animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
          }}
        />
        Agent online
      </div>
    </header>
  )
}
