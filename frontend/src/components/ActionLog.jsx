import { useRef, useEffect } from 'react'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  surface: '#141925',
  border:  '#1F2937',
  accent:  '#22D3EE',
  danger:  '#EF4444',
  success: '#22C55E',
  text:    '#E5E7EB',
  muted:   '#94A3B8',
  faint:   '#374151',
  mono:    "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
}

// Per-type styling
const TYPE_META = {
  query:     { color: '#22D3EE', bg: 'rgba(34,211,238,0.07)',  border: 'rgba(34,211,238,0.2)'  },
  aggregate: { color: '#A78BFA', bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.2)' },
  count:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.2)'  },
  mutation:  { color: '#34D399', bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.2)'  },
  unknown:   { color: C.muted,   bg: 'rgba(148,163,184,0.05)', border: 'rgba(148,163,184,0.15)' },
}

// ── Tool-call → human description ─────────────────────────────────────────────
// Matches on name (case-insensitive, handles snake_case, camelCase, kebab-case).
// Falls back gracefully when the ADK tool name is unfamiliar.

function extractZone(args) {
  const s = JSON.stringify(args ?? {})
  const m = s.match(/Zone[1-6]/i)
  return m ? m[0] : null
}

function extractCategory(args) {
  const s = JSON.stringify(args ?? {})
  if (s.includes('ticket_resale')) return 'ticket_resale'
  if (s.includes('merch'))         return 'merch'
  if (s.includes('food'))          return 'food'
  if (s.includes('transport'))     return 'transport'
  if (s.includes('hotel'))         return 'hotel'
  return null
}

function extractCollection(args) {
  return args?.collection ?? args?.collectionName ?? null
}

const RULES = [
  {
    test: /list.?database|databases/i,
    type: 'query',
    icon: '🗄',
    describe: () => 'Listed available databases',
  },
  {
    test: /list.?collection|collections/i,
    type: 'query',
    icon: '📋',
    describe: (args) => {
      const col = extractCollection(args)
      return col ? `Scanned "${col}" collection` : 'Scanned transaction collections'
    },
  },
  {
    test: /^count$|count_documents|countDocuments/i,
    type: 'count',
    icon: '🔢',
    describe: (args) => {
      const zone = extractZone(args)
      const cat  = extractCategory(args)
      if (zone && cat) return `Counted ${zone} ${cat} records`
      if (zone)        return `Counted ${zone} transactions`
      if (cat)         return `Counted ${cat} transactions`
      return 'Counted matching transactions'
    },
  },
  {
    test: /aggregate/i,
    type: 'aggregate',
    icon: '📊',
    describe: (args) => {
      const zone = extractZone(args)
      const cat  = extractCategory(args)
      if (zone && cat) return `Aggregated ${zone} ${cat} pipeline`
      if (zone)        return `Aggregated ${zone} decline data`
      return 'Ran aggregation pipeline'
    },
  },
  {
    test: /^find$|find_one|findOne/i,
    type: 'query',
    icon: '🔍',
    describe: (args) => {
      const zone = extractZone(args)
      if (zone) return `Fetched ${zone} transaction samples`
      return 'Fetched transaction records'
    },
  },
  {
    test: /query|search/i,
    type: 'query',
    icon: '🔍',
    describe: (args) => {
      const zone = extractZone(args)
      if (zone) return `Queried ${zone} transactions`
      return 'Queried transaction records'
    },
  },
  {
    test: /insert|create/i,
    type: 'mutation',
    icon: '➕',
    describe: () => 'Inserted investigation record',
  },
  {
    test: /update|replace/i,
    type: 'mutation',
    icon: '✏️',
    describe: () => 'Updated investigation record',
  },
  {
    test: /delete|drop|remove/i,
    type: 'mutation',
    icon: '🗑',
    describe: () => 'Removed stale records',
  },
]

function describe(name, args) {
  for (const rule of RULES) {
    if (rule.test.test(name)) {
      return {
        icon:  rule.icon,
        text:  rule.describe(args),
        type:  rule.type,
        ...TYPE_META[rule.type],
      }
    }
  }
  // Unknown tool — show it verbatim but still styled
  return {
    icon:  '⚡',
    text:  `Executed: ${name}`,
    type:  'unknown',
    ...TYPE_META.unknown,
  }
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour12:  false,
    hour:    '2-digit',
    minute:  '2-digit',
    second:  '2-digit',
  })
}

// ── Log entry ─────────────────────────────────────────────────────────────────

function LogEntry({ name, args, timestamp, isNew }) {
  const { icon, text, color, bg, border } = describe(name, args)

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           4,
      padding:       '8px 10px',
      borderRadius:  8,
      background:    bg,
      border:        `1px solid ${border}`,
      animation:     isNew ? 'slide-in-log 0.22s ease-out' : 'none',
    }}>
      {/* Top row: icon + description */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontSize: 12, flexShrink: 0, lineHeight: 1.6 }}>{icon}</span>
        <span style={{
          fontFamily:  C.mono,
          fontSize:    11,
          color:       C.text,
          lineHeight:  1.55,
          wordBreak:   'break-word',
        }}>
          {text}
        </span>
      </div>

      {/* Bottom row: timestamp + tool name badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontFamily: C.mono, fontSize: 10, color: C.faint }}>
          {formatTime(timestamp)}
        </span>
        <span style={{
          fontFamily:    C.mono,
          fontSize:      9,
          color,
          background:    'rgba(0,0,0,0.25)',
          border:        `1px solid ${border}`,
          borderRadius:  4,
          padding:       '1px 5px',
          letterSpacing: '0.04em',
          textTransform: 'lowercase',
          whiteSpace:    'nowrap',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
          maxWidth:      100,
        }}>
          {name}
        </span>
      </div>
    </div>
  )
}

// ── Empty / waiting state ─────────────────────────────────────────────────────

function WaitingState() {
  return (
    <div style={{
      flex:           1,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            10,
      padding:        24,
      textAlign:      'center',
    }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display:      'inline-block',
            width:        5,
            height:       5,
            borderRadius: '50%',
            background:   C.faint,
            animation:    `bounce-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <span style={{ fontFamily: C.mono, fontSize: 10, color: C.faint, letterSpacing: '0.06em' }}>
        Waiting for agent actions…
      </span>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ActionLog({ entries, phase }) {
  const bottomRef  = useRef(null)
  const prevLength = useRef(0)

  useEffect(() => {
    if (entries.length > prevLength.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    prevLength.current = entries.length
  }, [entries.length])

  const isStreaming = phase === 'streaming'
  const isDone      = phase === 'done'
  const count       = entries.length

  return (
    <aside style={{
      width:          256,
      minWidth:       256,
      flexShrink:     0,
      borderLeft:     `1px solid ${C.border}`,
      background:     '#0D1117',
      display:        'flex',
      flexDirection:  'column',
      overflow:       'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding:       '12px 14px 10px',
        borderBottom:  `1px solid ${C.border}`,
        flexShrink:    0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isStreaming && (
              <span style={{
                width:        6,
                height:       6,
                borderRadius: '50%',
                background:   C.accent,
                animation:    'pulse-glow 1s ease-in-out infinite',
                flexShrink:   0,
              }} />
            )}
            {isDone && (
              <span style={{ color: C.success, fontSize: 11 }}>✓</span>
            )}
            <span style={{
              fontFamily:    C.mono,
              fontSize:      10,
              color:         C.muted,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight:    600,
            }}>
              Agent Actions
            </span>
          </div>

          {/* Action counter */}
          {count > 0 && (
            <span style={{
              fontFamily:  C.mono,
              fontSize:    11,
              fontWeight:  700,
              color:       C.accent,
              background:  'rgba(34,211,238,0.1)',
              border:      '1px solid rgba(34,211,238,0.2)',
              borderRadius: 4,
              padding:     '1px 6px',
            }}>
              {count}
            </span>
          )}
        </div>

        {/* Sub-label */}
        <p style={{
          margin:      0,
          fontFamily:  C.mono,
          fontSize:    10,
          color:       C.faint,
          lineHeight:  1.5,
        }}>
          {count === 0
            ? 'Autonomous MCP queries will appear here'
            : `${count} autonomous action${count === 1 ? '' : 's'} this investigation`
          }
        </p>
      </div>

      {/* ── Legend ── */}
      <div style={{
        display:      'flex',
        gap:          10,
        padding:      '6px 14px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink:   0,
        flexWrap:     'wrap',
      }}>
        {[
          { label: 'query',     color: TYPE_META.query.color     },
          { label: 'aggregate', color: TYPE_META.aggregate.color },
          { label: 'count',     color: TYPE_META.count.color     },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 2, background: color, display: 'inline-block' }} />
            <span style={{ fontFamily: C.mono, fontSize: 9, color: C.faint, textTransform: 'lowercase' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Entries ── */}
      <div className="feed-scroll" style={{
        flex:          1,
        overflowY:     'auto',
        padding:       '10px 10px',
        display:       'flex',
        flexDirection: 'column',
        gap:           6,
      }}>
        {entries.length === 0 && isStreaming && <WaitingState />}

        {entries.map((entry, idx) => (
          <LogEntry
            key={entry.id}
            name={entry.name}
            args={entry.args}
            timestamp={entry.timestamp}
            isNew={idx === entries.length - 1}
          />
        ))}

        {isDone && entries.length > 0 && (
          <div style={{
            padding:     '6px 10px',
            borderRadius: 6,
            background:  'rgba(34,197,94,0.06)',
            border:      '1px solid rgba(34,197,94,0.2)',
            fontFamily:  C.mono,
            fontSize:    10,
            color:       C.success,
            textAlign:   'center',
          }}>
            ✓ Investigation complete
          </div>
        )}

        <div ref={bottomRef} />
      </div>

    </aside>
  )
}
