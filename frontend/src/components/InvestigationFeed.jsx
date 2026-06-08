import { useEffect, useRef } from 'react'

/*
  InvestigationFeed — reconstructed from the event contract in AgentConsole.
  Repo path: src/components/InvestigationFeed.jsx
  ------------------------------------------------------------------
  Event shapes (exactly as AgentConsole emits them):
    text      → { id, type:'text', content:string, isFinal:boolean }
    tool_call → { id, type:'tool_call', name, args, status:'running'|'done', resultOutput? }
    error     → { id, type:'error', message:string }

  NOTE: this is a faithful reconstruction. If your original feed renders resultOutput
  in a specific shape, send it and I'll port that rendering instead of guessing.
  Requires the shared stylesheet + className="mp-app" on the app root.
*/

function formatArgs(args) {
  if (args == null) return []
  if (typeof args === 'string') return [['', args]]
  if (typeof args === 'object') {
    return Object.entries(args).map(([k, v]) => [
      k,
      v != null && typeof v === 'object' ? JSON.stringify(v) : String(v),
    ])
  }
  return [['', String(args)]]
}

function formatResult(output) {
  if (output == null) return ''
  let text
  if (typeof output === 'string') text = output
  else { try { text = JSON.stringify(output, null, 2) } catch { text = String(output) } }
  return text.length > 1200 ? text.slice(0, 1200) + '\n…' : text
}

function TextEvent({ ev, showCaret }) {
  return (
    <div className="mp-rise" style={{
      padding: '16px 18px',
      background: ev.isFinal ? 'var(--panel-2)' : 'var(--panel)',
      borderBottom: '1px solid var(--line-soft)',
      borderLeft: ev.isFinal ? '2px solid var(--red)' : '2px solid transparent',
    }}>
      {ev.isFinal && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: 'var(--red)', marginBottom: 9,
        }}>[ summary ]</div>
      )}
      <p style={{
        fontFamily: 'var(--sans)', fontSize: 14.5, lineHeight: 1.6, margin: 0,
        color: ev.isFinal ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'pre-wrap',
      }}>
        {ev.content}
        {showCaret && <span className="mp-caret" aria-hidden />}
      </p>
    </div>
  )
}

function ToolEvent({ ev, index }) {
  const args = formatArgs(ev.args)
  const running = ev.status === 'running'
  return (
    <div className="mp-rise" style={{ padding: '13px 18px', borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <samp style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 500, color: 'var(--ink)', letterSpacing: '0.02em' }}>
          [ {ev.name} ]
        </samp>
        <span style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7,
          fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: running ? 'var(--ink-2)' : 'var(--ink-3)',
        }}>
          {running ? (
            <>
              <span className="mp-pip" aria-hidden style={{ background: 'var(--ink)', animation: 'mp-breathe 1.2s ease-in-out infinite' }} />
              running
            </>
          ) : '+ done'}
        </span>
      </div>

      {args.length > 0 && (
        <dl style={{ margin: '9px 0 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {args.map(([k, v], j) => (
            <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              {k && <dt style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', flex: 'none', letterSpacing: '0.02em' }}>{k}</dt>}
              <dd style={{
                fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', margin: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
              }} title={v}>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {!running && ev.resultOutput != null && (
        <pre style={{
          margin: '10px 0 0', padding: '10px 12px', background: 'var(--bg)',
          border: '1px solid var(--line-soft)', maxHeight: 160, overflow: 'auto',
          fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.5, color: 'var(--ink-2)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {formatResult(ev.resultOutput)}
        </pre>
      )}
    </div>
  )
}

function ErrorEvent({ ev }) {
  return (
    <div className="mp-rise" style={{
      padding: '13px 18px', borderBottom: '1px solid var(--line-soft)',
      borderLeft: '2px solid var(--red)', background: 'var(--red-soft)',
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--red-hi)' }}>
        [ error ]
      </span>
      <p style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink)', margin: '6px 0 0', lineHeight: 1.5 }}>
        {ev.message}
      </p>
    </div>
  )
}

export default function InvestigationFeed({ events = [], phase = 'idle' }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [events])

  const streaming = phase === 'streaming'
  const lastIndex = events.length - 1

  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto',
      border: '1px solid var(--line)', background: 'var(--panel)',
    }}>
      {events.length === 0 && streaming && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px',
          fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink-2)', letterSpacing: '0.02em',
        }}>
          <span className="mp-pip" aria-hidden style={{ background: 'var(--ink)', animation: 'mp-breathe 1.2s ease-in-out infinite' }} />
          agent analyzing…
        </div>
      )}

      {events.map((ev, i) => {
        if (ev.type === 'text') {
          return <TextEvent key={ev.id} ev={ev} showCaret={streaming && !ev.isFinal && i === lastIndex} />
        }
        if (ev.type === 'tool_call') {
          return <ToolEvent key={ev.id} ev={ev} index={i} />
        }
        if (ev.type === 'error') {
          return <ErrorEvent key={ev.id} ev={ev} />
        }
        return null
      })}

      <div ref={endRef} />
    </div>
  )
}
