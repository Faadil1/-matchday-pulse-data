import { useState, useRef, useCallback } from 'react'
import { investigate } from '../lib/agentClient'
import InvestigationFeed from './InvestigationFeed'

/*
  AgentConsole — P1 adds a pinned VERDICT banner on completion.
  Repo path: src/components/AgentConsole.jsx   (replaces the previous version)
  ------------------------------------------------------------------
  ALL streaming/investigation logic is identical (investigate(), the event reducers,
  startInvestigation, handleReset, onPhaseChange / onToolCall). The only addition is the
  <Verdict /> sub-component, rendered above the feed when phase === 'done'.

  NOTE on Verdict figures: they are the STABLE structural facts of the seeded dataset
  (Zone 3 = 48.6%, 3 fingerprints, 214/222 declines, $37,159 attempted) — the same
  approach the dashboard already uses. They never contradict the agent's run-to-run prose
  (which reports the variable *leaked* amount). To make the verdict fully dynamic later,
  pass these as props from the agent's final structured output.
*/

// ── Constants ─────────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Something looks wrong tonight',
  'Check Zone 3 declines',
  'Any bot activity?',
]

const STAT_PILLS = [
  { label: '5,000', sub: 'transactions' },
  { label: '6',     sub: 'zones'        },
  { label: '11.8%', sub: 'decline rate' },
  { label: 'live',  sub: 'feed', live: true },
]

const VERDICT_FIGURES = [
  { v: '48.6%',   k: 'Zone 3 decline' },
  { v: '3',       k: 'Fingerprints'   },
  { v: '214/222', k: 'Zone 3 declines' },
  { v: '$37,159', k: 'Attempted', money: true },
]

// ── Shared sub-components ─────────────────────────────────────────────────────

function SituationStrip() {
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', width: '100%',
      border: '1px solid var(--line)', background: 'var(--panel)',
    }}>
      {STAT_PILLS.map(({ label, sub, live }, i) => (
        <div key={sub} style={{
          display: 'flex', alignItems: 'baseline', gap: 8, padding: '12px 16px',
          borderRight: i < STAT_PILLS.length - 1 ? '1px solid var(--line)' : 'none',
        }}>
          {live && (
            <span className="mp-pip" aria-hidden style={{
              alignSelf: 'center', background: 'var(--ink)',
              animation: 'mp-breathe 2s ease-in-out infinite',
            }} />
          )}
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 500, color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
          }}>{label}</span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--ink-3)',
          }}>{sub}</span>
        </div>
      ))}
      <div style={{
        marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '12px 16px',
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--ink-3)',
      }}>Toronto</div>
    </div>
  )
}

function QueryInput({ value, onChange, onSubmit, disabled }) {
  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) onSubmit() }
  const ready = !disabled && value.trim()

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', width: '100%',
      border: '1px solid var(--line)', background: 'var(--panel)',
      transition: 'border-color 0.16s var(--ease)',
    }}>
      <span aria-hidden style={{
        display: 'flex', alignItems: 'center', paddingLeft: 16,
        color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 500,
      }}>&gt;</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="ask the agent to investigate"
        disabled={disabled}
        style={{
          flex: 1, padding: '14px 14px', background: 'transparent', border: 'none',
          color: 'var(--ink)', fontSize: 14, fontFamily: 'var(--mono)', outline: 'none',
          letterSpacing: '0.01em', opacity: disabled ? 0.55 : 1, minWidth: 0,
        }}
        onFocus={e => { e.target.parentElement.style.borderColor = 'var(--ink-2)' }}
        onBlur={e => { e.target.parentElement.style.borderColor = 'var(--line)' }}
      />
      <button
        className="mp-btn"
        onClick={onSubmit}
        disabled={!ready}
        style={{ borderLeft: '1px solid var(--line)', minWidth: 124 }}
      >
        {disabled ? 'Running…' : 'Investigate'}
      </button>
    </div>
  )
}

function SuggestionChips({ onSelect, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: 'var(--ink-3)',
      }}>[ try ]</span>
      {SUGGESTIONS.map(text => (
        <button
          key={text}
          onClick={() => !disabled && onSelect(text)}
          disabled={disabled}
          style={{
            padding: '8px 13px', background: 'transparent', border: '1px solid var(--line)',
            color: 'var(--ink-2)', fontSize: 11.5, fontFamily: 'var(--mono)',
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
            letterSpacing: '0.01em', transition: 'color 0.16s var(--ease), border-color 0.16s var(--ease)',
          }}
          onMouseEnter={e => {
            if (!disabled) { e.currentTarget.style.borderColor = 'var(--ink-2)'; e.currentTarget.style.color = 'var(--ink)' }
          }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-2)' }}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

function Verdict() {
  return (
    <div className="mp-rise" style={{
      border: '2px solid var(--red)', background: 'var(--panel)', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', padding: '14px 18px 12px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: 'var(--red)',
        }}>
          <span aria-hidden style={{ width: 7, height: 7, background: 'var(--red)' }} />
          Confirmed
        </span>
        <span style={{
          fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 600,
          color: 'var(--ink)', letterSpacing: '-0.01em',
        }}>
          Coordinated bot fraud
        </span>
        <span style={{
          marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)',
        }}>
          Zone 3 · ticket_resale
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '1px solid var(--line)' }}>
        {VERDICT_FIGURES.map((f, i) => (
          <div key={f.k} style={{
            flex: '1 1 0', minWidth: 110, padding: '12px 16px',
            borderRight: i < VERDICT_FIGURES.length - 1 ? '1px solid var(--line)' : 'none',
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 600,
              color: f.money ? 'var(--red)' : 'var(--ink)',
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', lineHeight: 1,
            }}>{f.v}</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 7,
            }}>{f.k}</div>
          </div>
        ))}
      </div>
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
  const isDone      = phase === 'done'

  // ── Idle state: command console (no centered marketing hero) ────────────────
  if (phase === 'idle') {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '40px 28px', overflowY: 'auto', minHeight: 0,
      }}>
        <div style={{
          width: '100%', maxWidth: 760, margin: '0 auto',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 22,
        }}>
          <SituationStrip />

          <div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 12,
            }}>
              [ fraud intelligence ]
            </div>
            <h1 style={{
              fontFamily: 'var(--sans)', fontSize: 24, fontWeight: 600, lineHeight: 1.3,
              letterSpacing: '-0.01em', margin: 0, color: 'var(--ink)', maxWidth: '24ch',
            }}>
              Issue a directive. The agent investigates a match-day anomaly from a single signal.
            </h1>
          </div>

          <QueryInput
            value={query}
            onChange={setQuery}
            onSubmit={() => startInvestigation(query)}
            disabled={false}
          />

          <SuggestionChips onSelect={text => startInvestigation(text)} disabled={false} />

          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 4,
          }}>
            MP-2026-0606 · UNIT D-01 · matchday pulse
          </div>
        </div>
      </div>
    )
  }

  // ── Active state: investigation view ────────────────────────────────────────
  const statusState = isStreaming ? 'streaming' : phase === 'error' ? 'error' : 'done'
  const statusLabel = isStreaming ? '>>> agent analyzing' : phase === 'error' ? '[ error ]' : '[ complete ]'

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '20px 24px 24px', gap: 14, maxWidth: 860, width: '100%', margin: '0 auto', minHeight: 0,
    }}>

      {/* Active query context bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        border: '1px solid var(--line)', background: 'var(--panel)', flexShrink: 0,
      }}>
        <span
          className="mp-status"
          data-state={statusState}
          style={statusState === 'error' ? { color: 'var(--red)' } : undefined}
        >
          <span className="mp-pip" aria-hidden style={statusState === 'error' ? { background: 'var(--red)' } : undefined} />
          {statusLabel}
        </span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--ink-3)', flexShrink: 0,
        }}>investigating</span>
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)', fontWeight: 500, minWidth: 0,
        }}>
          "{activeQ}"
        </span>
        <button
          onClick={handleReset}
          style={{
            padding: '7px 13px', background: 'transparent', border: '1px solid var(--line)',
            color: 'var(--ink-2)', fontSize: 11, fontFamily: 'var(--mono)', letterSpacing: '0.08em',
            textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0,
            transition: 'color 0.16s var(--ease), border-color 0.16s var(--ease)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink-2)'; e.currentTarget.style.color = 'var(--ink)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-2)' }}
        >
          ← new
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

      {/* P1 — pinned verdict banner on completion (above the scrolling feed) */}
      {isDone && <Verdict />}

      {/* The live feed */}
      <InvestigationFeed events={events} phase={phase} />
    </div>
  )
}
