import { useState } from 'react'

/*
  ActionLog — P4: the MCP "agent trace" becomes a business-language investigation timeline.
  Repo path: src/components/ActionLog.jsx   (replaces the previous version)
  ------------------------------------------------------------------
  By default a non-technical judge sees ONLY plain-language investigation steps — never the
  words database / collection / aggregate / pipeline / JSON. Each step can be expanded
  (▸ query) to reveal the real MongoDB Atlas aggregation behind it — kept on purpose, opt-in,
  because that is the strongest evidence for the MongoDB track.

  Contract (from App.jsx, unchanged): entries [{id,name,args,timestamp}], phase.
  Optional: proactiveAction (see DEFAULT_ACTION). Requires the shared stylesheet + mp-app.
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
  } catch { return '' }
}

// Map a raw tool call to a plain-language investigation step (no DB / pipeline jargon).
function businessLabel(entry) {
  const name = String(entry.name || '').toLowerCase()
  let blob = ''
  try { blob = JSON.stringify(entry.args || '').toLowerCase() } catch { blob = String(entry.args || '').toLowerCase() }
  const has = (s) => name.includes(s) || blob.includes(s)

  if (name.includes('list-database') || name.includes('list-collection')) return 'Connecting to transaction records'
  if (name.includes('schema')) return 'Reviewing the data structure'
  if (has('devicefingerprint') || has('"device"') || has('fingerprint')) return 'Correlating device fingerprints'
  if (has('merchant') || has('ticket_resale') || has('resale') || has('category')) return 'Isolating the merchant category'
  if (has('hour') || has('timestamp') || has('minute') || has('"time"')) return 'Reconstructing the timeline'
  if (has('$sum') || has('amount') || has('"total"') || has('totalamount')) return 'Quantifying the financial impact'
  if (has('zone')) return 'Analyzing zone-level declines'
  if (has('status') || has('declined') || has('approved')) return 'Establishing the baseline'
  return 'Querying transaction intelligence'
}

// Pretty-print the underlying Atlas aggregation for the opt-in expand.
function atlasQuery(entry) {
  const a = entry.args
  if (a == null) return ''
  try {
    const pipeline = (a && typeof a === 'object' && a.pipeline != null) ? a.pipeline : a
    const obj = typeof pipeline === 'string' ? JSON.parse(pipeline) : pipeline
    return JSON.stringify(obj, null, 2)
  } catch {
    return typeof a === 'string' ? a : (() => { try { return JSON.stringify(a, null, 2) } catch { return String(a) } })()
  }
}

// Collapse consecutive identical labels into single timeline steps.
function buildSteps(entries) {
  const steps = []
  for (const e of entries) {
    const label = businessLabel(e)
    const last = steps[steps.length - 1]
    if (last && last.label === label) {
      last.count += 1
      last.entries.push(e)
    } else {
      steps.push({ label, count: 1, ts: e.timestamp, entries: [e] })
    }
  }
  return steps
}

export default function ActionLog({ entries = [], phase = 'idle', proactiveAction }) {
  const [primaryDone, setPrimaryDone] = useState(false)
  const [secondaryDone, setSecondaryDone] = useState(false)
  const [openIdx, setOpenIdx] = useState(-1)

  const streaming = phase === 'streaming'
  const complete = phase !== 'idle' && phase !== 'streaming'
  const action = proactiveAction || DEFAULT_ACTION
  const steps = buildSteps(entries)

  return (
    <aside style={styles.panel} aria-label="Investigation timeline">
      <div style={styles.head}>
        <span
          className="mp-status"
          data-state={streaming ? 'streaming' : complete ? 'done' : 'idle'}
        >
          <span className="mp-pip" aria-hidden />
          {streaming ? '>>> investigating' : complete ? '[ investigation timeline ]' : 'standby'}
        </span>
        <span style={styles.badge}>MongoDB Atlas</span>
      </div>

      <div style={styles.scroll}>
        {steps.length === 0 ? (
          <p style={styles.empty}>
            {streaming ? 'opening the investigation…' : 'no steps recorded'}
          </p>
        ) : (
          <ol style={styles.list}>
            {steps.map((s, i) => {
              const open = openIdx === i
              const last = i === steps.length - 1
              return (
                <li key={i} className="mp-rise" style={styles.step}>
                  {!last && <span style={styles.line} aria-hidden />}
                  <span style={{ ...styles.node, ...(streaming && last ? styles.nodeActive : {}) }} aria-hidden />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <time style={styles.ts}>{formatTime(s.ts)}</time>
                    <div style={styles.labelRow}>
                      <span style={styles.label}>{s.label}</span>
                      {s.count > 1 && <span style={styles.count}>×{s.count}</span>}
                    </div>
                    <button
                      style={styles.toggle}
                      onClick={() => setOpenIdx(open ? -1 : i)}
                      aria-expanded={open}
                    >
                      {open ? '▾ hide query' : '▸ query'}
                    </button>
                    {open && (
                      <div style={styles.queryBox}>
                        <div style={styles.queryHead}>Atlas aggregation</div>
                        {s.entries.map((e, j) => (
                          <pre key={j} style={styles.query}>{atlasQuery(e) || '—'}</pre>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {complete && (
        <div className="mp-rise">
          {action.detail && primaryDone && (
            <div style={styles.receipt}>
              {action.detail.map((d) => (
                <samp key={d} style={styles.fp}>
                  <span style={styles.fpMark} aria-hidden>×</span>{d}
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
              <span className="mp-primary-m" aria-hidden>{primaryDone ? '+' : '>>>'}</span>
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
    flex: 'none', width: 340, maxWidth: '42vw',
    display: 'flex', flexDirection: 'column',
    borderLeft: '1px solid var(--line)', background: 'var(--panel)', minHeight: 0,
  },
  head: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', borderBottom: '1px solid var(--line)', flex: 'none', gap: 8,
  },
  badge: {
    fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--ink-2)', border: '1px solid var(--line-2)', padding: '3px 8px', whiteSpace: 'nowrap',
  },
  scroll: { flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px 0' },
  empty: { padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.02em' },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  step: { position: 'relative', display: 'flex', gap: 14, padding: '11px 16px 11px 18px' },
  line: { position: 'absolute', left: 23, top: 22, bottom: -11, width: 1, background: 'var(--line-2)' },
  node: {
    width: 9, height: 9, marginTop: 5, flex: 'none', borderRadius: '50%',
    background: 'var(--panel)', border: '1px solid var(--ink-3)', zIndex: 1,
  },
  nodeActive: { borderColor: 'var(--ink)', background: 'var(--ink)', animation: 'mp-breathe 1.4s ease-in-out infinite' },
  ts: { display: 'block', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums', marginBottom: 3 },
  labelRow: { display: 'flex', alignItems: 'baseline', gap: 7 },
  label: { fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink)', letterSpacing: '0.01em', lineHeight: 1.4 },
  count: { fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' },
  toggle: {
    marginTop: 6, padding: 0, background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)',
  },
  queryBox: { marginTop: 8, border: '1px solid var(--line-soft)', background: 'var(--bg)' },
  queryHead: { fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-2)', padding: '7px 10px', borderBottom: '1px solid var(--line-soft)' },
  query: { margin: 0, padding: '8px 10px', maxHeight: 150, overflow: 'auto', fontFamily: 'var(--mono)', fontSize: 10.5, lineHeight: 1.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  receipt: { borderTop: '1px solid var(--line)' },
  fp: { display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', padding: '10px 16px', borderBottom: '1px solid var(--line-soft)', letterSpacing: '0.02em' },
  fpMark: { color: 'var(--red-hi)' },
}
