import { useState, useRef, useCallback } from 'react'
import { investigate } from '../lib/agentClient'
import InvestigationFeed from './InvestigationFeed'

// ── Constants ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Something looks wrong tonight',
  'Check Zone 3 declines',
  'Any bot activity?',
]

const STAT_PILLS = [
  { label: '5,000', sub: 'transactions' },
  { label: '6',     sub: 'zones'        },
  { label: '~8%',   sub: 'decline rate' },
  { label: 'live',  sub: 'feed', live: true },
]

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatBar() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
      {STAT_PILLS.map(({ label, sub, live }) => (
        <div key={sub} style={{
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          padding:      '5px 12px',
          borderRadius: 8,
          background:   '#141925',
          border:       '1px solid #1F2937',
          fontSize:     13,
        }}>
          {live && (
            <span style={{
              width:        6,
              height:       6,
              borderRadius: '50%',
              background:   '#22C55E',
              boxShadow:    '0 0 5px 2px rgba(34,197,94,0.5)',
              animation:    'pulse-glow 2s ease-in-out infinite',
              flexShrink:   0,
            }} />
          )}
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#E5E7EB', fontWeight: 600 }}>
            {label}
          </span>
          <span style={{ color: '#94A3B8' }}>{sub}</span>
        </div>
      ))}
      <span style={{ color: '#94A3B8', fontSize: 13 }}>· Toronto</span>
    </div>
  )
}

function QueryInput({ value, onChange, onSubmit, disabled }) {
  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) onSubmit() }

  return (
    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Ask the agent to investigate…"
        disabled={disabled}
        style={{
          flex:         1,
          padding:      '13px 16px',
          background:   '#141925',
          border:       '1px solid #1F2937',
          borderRadius: 12,
          color:        '#E5E7EB',
          fontSize:     14,
          fontFamily:   "'Inter', sans-serif",
          outline:      'none',
          opacity:      disabled ? 0.6 : 1,
          transition:   'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocus={e => {
          e.target.style.borderColor = '#22D3EE'
          e.target.style.boxShadow   = '0 0 0 3px rgba(34,211,238,0.08)'
        }}
        onBlur={e => {
          e.target.style.borderColor = '#1F2937'
          e.target.style.boxShadow   = 'none'
        }}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        style={{
          padding:      '13px 24px',
          background:   disabled || !value.trim() ? 'rgba(34,211,238,0.25)' : '#22D3EE',
          color:        '#0B0E14',
          border:       'none',
          borderRadius: 12,
          fontSize:     14,
          fontWeight:   600,
          cursor:       disabled || !value.trim() ? 'not-allowed' : 'pointer',
          whiteSpace:   'nowrap',
          transition:   'background 0.15s, box-shadow 0.15s',
          minWidth:     120,
        }}
        onMouseEnter={e => {
          if (!disabled && value.trim()) {
            e.currentTarget.style.background  = '#38E5FF'
            e.currentTarget.style.boxShadow   = '0 0 20px rgba(34,211,238,0.3)'
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background  = disabled || !value.trim() ? 'rgba(34,211,238,0.25)' : '#22D3EE'
          e.currentTarget.style.boxShadow   = 'none'
        }}
      >
        {disabled ? 'Running…' : 'Investigate'}
      </button>
    </div>
  )
}

function SuggestionChips({ onSelect, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
      <span style={{ color: '#94A3B8', fontSize: 12 }}>Try:</span>
      {SUGGESTIONS.map(text => (
        <button
          key={text}
          onClick={() => !disabled && onSelect(text)}
          style={{
            padding:      '5px 14px',
            background:   'transparent',
            border:       '1px solid #1F2937',
            borderRadius: 999,
            color:        '#94A3B8',
            fontSize:     12,
            cursor:       disabled ? 'not-allowed' : 'pointer',
            fontFamily:   "'Inter', sans-serif",
            transition:   'all 0.15s',
            opacity:      disabled ? 0.4 : 1,
          }}
          onMouseEnter={e => {
            if (!disabled) {
              e.currentTarget.style.borderColor = '#22D3EE'
              e.currentTarget.style.color       = '#22D3EE'
              e.currentTarget.style.background  = 'rgba(34,211,238,0.05)'
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#1F2937'
            e.currentTarget.style.color       = '#94A3B8'
            e.currentTarget.style.background  = 'transparent'
          }}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentConsole({ onPhaseChange, onToolCall }) {
  const [query,   setQuery  ] = useState('')
  const [phase,   setPhase  ] = useState('idle')   // 'idle' | 'streaming' | 'done' | 'error'

  // Keeps parent (App) in sync without touching investigation logic.
  const syncPhase = (p) => { setPhase(p); onPhaseChange?.(p) }
  const [events,  setEvents ] = useState([])
  const [activeQ, setActiveQ] = useState('')

  const idRef  = useRef(0)
  const nextId = () => { idRef.current += 1; return idRef.current }

  // Merge consecutive text chunks into one growing block (typewriter effect).
  const appendText = useCallback(chunk => {
    setEvents(prev => {
      const last = prev[prev.length - 1]
      if (last?.type === 'text') {
        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
      }
      return [...prev, { id: nextId(), type: 'text', content: chunk, isFinal: false }]
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Add a new tool_call event (status: 'running').
  const addToolCall = useCallback(({ name, args }) => {
    setEvents(prev => [...prev, { id: nextId(), type: 'tool_call', name, args, status: 'running' }])
    onToolCall?.({ name, args })  // notify App so ActionLog can record it
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Transition the matching tool_call to status: 'done'.
  const resolveToolCall = useCallback(({ name, output }) => {
    setEvents(prev => {
      // Prefer: most recent *running* event with this name
      let idx = -1
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].type === 'tool_call' && prev[i].status === 'running' && prev[i].name === name) {
          idx = i; break
        }
      }
      // Fallback: any running tool_call (handles name mismatch edge cases)
      if (idx === -1) {
        idx = prev.findIndex(ev => ev.type === 'tool_call' && ev.status === 'running')
      }
      if (idx === -1) return prev
      return prev.map((ev, i) =>
        i === idx ? { ...ev, status: 'done', resultOutput: output } : ev
      )
    })
  }, [])

  // Mark last text event as the final summary card.
  const markFinal = useCallback(() => {
    setEvents(prev => {
      let lastText = -1
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].type === 'text') { lastText = i; break }
      }
      if (lastText === -1) return prev
      return prev.map((ev, i) => i === lastText ? { ...ev, isFinal: true } : ev)
    })
  }, [])

  function startInvestigation(q) {
    const text = (q ?? query).trim()
    if (!text || phase === 'streaming') return

    setActiveQ(text)
    setQuery(text)
    syncPhase('streaming')
    setEvents([])
    idRef.current = 0

    investigate(text, {
      onText:       chunk   => appendText(chunk),
      onToolCall:   tool    => addToolCall(tool),
      onToolResult: result  => resolveToolCall(result),
      onDone:       ()      => { markFinal(); syncPhase('done') },
      onError:      err     => {
        setEvents(prev => [...prev, { id: nextId(), type: 'error', message: err.message }])
        syncPhase('error')
      },
    })
  }

  function handleReset() {
    setQuery('')
    setActiveQ('')
    syncPhase('idle')
    setEvents([])
    idRef.current = 0
  }

  const isStreaming = phase === 'streaming'

  // ── Idle state: centered hero ───────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        flex:           1,
        padding:        '48px 24px',
        position:       'relative',
      }}>
        {/* Ambient glow */}
        <div aria-hidden style={{
          position:      'absolute',
          width:         700,
          height:        400,
          background:    'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(34,211,238,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          position:       'relative',
          zIndex:         1,
          width:          '100%',
          maxWidth:       640,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:            32,
        }}>
          <StatBar />

          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontSize:      38,
              fontWeight:    700,
              letterSpacing: '-0.5px',
              lineHeight:    1.2,
              margin:        '0 0 10px',
              color:         '#E5E7EB',
            }}>
              Monitoring{' '}
              <span style={{ color: '#22D3EE' }}>5,000 transactions</span>
              <br />
              across <span style={{ color: '#22D3EE' }}>6 zones</span>
            </h1>
            <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>
              Ask the agent to investigate an anomaly, surface fraud patterns, or explain a spike.
            </p>
          </div>

          <QueryInput
            value={query}
            onChange={setQuery}
            onSubmit={() => startInvestigation(query)}
            disabled={false}
          />

          <SuggestionChips onSelect={text => startInvestigation(text)} disabled={false} />

          <p style={{
            color:       '#1F2937',
            fontSize:    11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontFamily:  "'JetBrains Mono', monospace",
          }}>
            Matchday Pulse · Fraud Intelligence Platform
          </p>
        </div>
      </div>
    )
  }

  // ── Active state: investigation view ───────────────────────────────────────
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      flex:          1,
      padding:       '20px 24px 24px',
      gap:           14,
      maxWidth:      860,
      width:         '100%',
      margin:        '0 auto',
    }}>

      {/* Active query context bar */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '10px 16px',
        borderRadius: 12,
        background:   '#141925',
        border:       '1px solid #1F2937',
        flexShrink:   0,
      }}>
        {isStreaming ? (
          <span style={{
            width:        8,
            height:       8,
            borderRadius: '50%',
            background:   '#22D3EE',
            flexShrink:   0,
            animation:    'pulse-glow 1s ease-in-out infinite',
          }} />
        ) : (
          <span style={{ color: phase === 'error' ? '#EF4444' : '#22C55E', fontSize: 14, flexShrink: 0 }}>
            {phase === 'error' ? '✕' : '✓'}
          </span>
        )}
        <span style={{ color: '#94A3B8', fontSize: 13, flexShrink: 0 }}>Investigating:</span>
        <span style={{
          flex:       1,
          overflow:   'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize:   13,
          color:      '#E5E7EB',
          fontWeight: 500,
        }}>
          "{activeQ}"
        </span>
        <button
          onClick={handleReset}
          style={{
            padding:      '4px 12px',
            background:   'transparent',
            border:       '1px solid #1F2937',
            borderRadius: 8,
            color:        '#94A3B8',
            fontSize:     12,
            cursor:       'pointer',
            flexShrink:   0,
            transition:   'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#22D3EE'; e.currentTarget.style.color = '#22D3EE' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1F2937'; e.currentTarget.style.color = '#94A3B8' }}
        >
          ← New
        </button>
      </div>

      {/* Input row — disabled while streaming, ready for follow-up when done */}
      <QueryInput
        value={isStreaming ? '' : query}
        onChange={setQuery}
        onSubmit={() => startInvestigation(query)}
        disabled={isStreaming}
      />

      {/* Suggestion chips — hidden while streaming to reduce noise */}
      {!isStreaming && (
        <SuggestionChips onSelect={text => startInvestigation(text)} disabled={false} />
      )}

      {/* The live feed */}
      <InvestigationFeed events={events} phase={phase} />
    </div>
  )
}
