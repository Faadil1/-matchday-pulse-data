import { useState } from 'react'

/*
  ActionLog — drop-in replacement.  Repo path: src/components/ActionLog.jsx
  ------------------------------------------------------------------
  Contract (defined by App.jsx, unchanged):
    props.entries : Array<{ id, name, args, timestamp:Date }>   // MCP tool calls
    props.phase   : 'idle' | 'streaming' | <any completion phase>

  Optional (production wiring — pass the verdict-driven action from AgentConsole):
    props.proactiveAction : {
      primary, primaryDone, secondary?, secondaryDone?, detail?: string[],
      onPrimary?: () => void, onSecondary?: () => void
    }

  Requires the shared stylesheet imported once at the app root:
    import './styles/matchday-ui.css'   (and className="mp-app" on the App root)
*/

const DEFAULT_ACTION = {
  primary: 'Blocklist 3 device fingerprints',
  primaryDone: 'blocklist issued',
  secondary: 'Flag Zone 3 acquirer',
  secondaryDone: 'zone 3 flagged',
  detail: ['44a40e06…00dabc36', 'f85b2479…555bd9601', 'b56083ab…c4d31ea80'],
}

function formatTime(d) {
  try {
    const date = d instanceof Date ? d : new Date(d)
    return date.toLocaleTimeString('en-GB', { hour12: false })
  } catch {
    return ''
  }
}

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

export default function ActionLog({ entries = [], phase = 'idle', proactiveAction }) {
  const [primaryDone, setPrimaryDone] = useState(false)
  const [secondaryDone, setSecondaryDone] = useState(false)

  const streaming = phase === 'streaming'
  const complete = phase !== 'idle' && phase !== 'streaming'
  const action = proactiveAction || DEFAULT_ACTION

  return (
    <aside style={styles.panel} aria-label="Agent trace">
      <div style={styles.head}>
        <span
          className="mp-status"
          data-state={streaming ? 'streaming' : complete ? 'done' : 'idle'}
        >
          <span className="mp-pip" aria-hidden="true" />
          {streaming ? '>>> tracing' : complete ? '[ agent trace ]' : 'standby'}
        </span>
        <span style={styles.count}>
          {entries.length} {entries.length === 1 ? 'call' : 'calls'}
        </span>
      </div>

      <div style={styles.scroll}>
        {entries.length === 0 ? (
          <p style={styles.empty}>
            {streaming ? 'awaiting first tool call…' : 'no tool calls recorded'}
          </p>
        ) : (
          <ol style={styles.list}>
            {entries.map((e, i) => {
              const args = formatArgs(e.args)
              return (
                <li key={e.id} className="mp-rise" style={styles.entry}>
                  <div style={styles.entryTop}>
                    <span style={styles.idx} aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <samp style={styles.name}>[ {e.name} ]</samp>
                    <time style={styles.time}>{formatTime(e.timestamp)}</time>
                  </div>
                  {args.length > 0 && (
                    <dl style={styles.args}>
                      {args.map(([k, v], j) => (
                        <div key={j} style={styles.argRow}>
                          {k && <dt style={styles.argKey}>{k}</dt>}
                          <dd style={styles.argVal} title={v}>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {complete && (
        <div className="mp-rise">
          {action.detail && (primaryDone) && (
            <div style={styles.receipt}>
              {action.detail.map((d) => (
                <samp key={d} style={styles.fp}>
                  <span style={styles.fpMark} aria-hidden="true">×</span>
                  {d}
                </samp>
              ))}
            </div>
          )}
          <div className="mp-act">
            <button
              className={'mp-primary' + (primaryDone ? ' ok' : '')}
              disabled={primaryDone}
              onClick={() => { setPrimaryDone(true); action.onPrimary && action.onPrimary() }}
            >
              <span>{primaryDone ? `[ ${action.primaryDone} ]` : action.primary}</span>
              <span className="mp-primary-m" aria-hidden="true">{primaryDone ? '+' : '>>>'}</span>
            </button>
            {action.secondary && (
              <button
                className={'mp-secondary' + (secondaryDone ? ' on' : '')}
                disabled={secondaryDone}
                onClick={() => { setSecondaryDone(true); action.onSecondary && action.onSecondary() }}
              >
                {secondaryDone ? `[ ${action.secondaryDone || 'done'} ]` : action.secondary}
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}

const styles = {
  panel: {
    flex: 'none',
    width: 340,
    maxWidth: '42vw',
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid var(--line)',
    background: 'var(--panel)',
    minHeight: 0,
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--line)',
    flex: 'none',
  },
  count: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: 'var(--ink-3)',
  },
  scroll: { flex: 1, overflowY: 'auto', minHeight: 0 },
  empty: {
    padding: '20px 16px',
    fontFamily: 'var(--mono)',
    fontSize: 12,
    color: 'var(--ink-3)',
    letterSpacing: '.02em',
  },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  entry: { padding: '13px 16px', borderBottom: '1px solid var(--line-soft)' },
  entryTop: { display: 'flex', alignItems: 'baseline', gap: 10 },
  idx: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.06em' },
  name: {
    fontFamily: 'var(--mono)',
    fontSize: 12.5,
    fontWeight: 500,
    color: 'var(--ink)',
    letterSpacing: '.02em',
  },
  time: {
    marginLeft: 'auto',
    fontFamily: 'var(--mono)',
    fontSize: 10.5,
    color: 'var(--ink-3)',
    fontVariantNumeric: 'tabular-nums',
  },
  args: { margin: '9px 0 0', display: 'flex', flexDirection: 'column', gap: 3 },
  argRow: { display: 'flex', gap: 8, alignItems: 'baseline' },
  argKey: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    color: 'var(--ink-3)',
    flex: 'none',
    minWidth: 0,
    letterSpacing: '.02em',
  },
  argVal: {
    fontFamily: 'var(--mono)',
    fontSize: 11,
    color: 'var(--ink-2)',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  receipt: { borderTop: '1px solid var(--line)' },
  fp: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    fontFamily: 'var(--mono)',
    fontSize: 11,
    color: 'var(--ink-2)',
    padding: '10px 16px',
    borderBottom: '1px solid var(--line-soft)',
    letterSpacing: '.02em',
  },
  fpMark: { color: 'var(--red-hi)' },
}
