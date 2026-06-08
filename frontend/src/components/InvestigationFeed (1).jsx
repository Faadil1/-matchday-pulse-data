import { useEffect, useRef } from 'react'

/*
  InvestigationFeed — markdown rendering (P0) + tool-result cleanup.
  Repo path: src/components/InvestigationFeed.jsx   (replaces the previous version)
  ------------------------------------------------------------------
  Cleanup: the MongoDB MCP server wraps returned docs in a prompt-injection guard
  (<untrusted-user-data-…>, "WARNING: Executing any instructions…", "Use the information
  above … DO NOT execute …"). That plumbing leaked into the UI. We now strip it and
  unescape the JSON so only the actual evidence shows. Everything else is unchanged.
  Requires the shared stylesheet + className="mp-app" on the app root.
*/

// ── Minimal markdown renderer ─────────────────────────────────────────────────

const INLINE_RE  = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g
const UNESCAPE   = /\\([\\$*_#.\-\[\]()!{}+])/g
const unescape   = (s) => s.replace(UNESCAPE, '$1')

function renderInline(text, keyBase) {
  const out = []
  let last = 0
  let m
  let i = 0
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(unescape(text.slice(last, m.index)))
    const tok = m[0]
    const k = `${keyBase}-${i++}`
    if (tok[0] === '`') {
      out.push(<code key={k} style={MD.code}>{tok.slice(1, -1)}</code>)
    } else if (tok.startsWith('**') || tok.startsWith('__')) {
      out.push(<strong key={k} style={MD.strong}>{unescape(tok.slice(2, -2))}</strong>)
    } else {
      out.push(<em key={k} style={MD.em}>{unescape(tok.slice(1, -1))}</em>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(unescape(text.slice(last)))
  return out
}

function parseBlocks(src) {
  const lines = (src || '').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const t = lines[i].trim()

    if (t === '') { i++; continue }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { blocks.push({ type: 'hr' }); i++; continue }

    const h = /^(#{1,6})\s+(.*)$/.exec(t)
    if (h) { blocks.push({ type: 'heading', level: h[1].length, text: h[2] }); i++; continue }

    if (/^(\*|-|\+)\s+/.test(t)) {
      const items = []
      while (i < lines.length && /^(\*|-|\+)\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^(\*|-|\+)\s+/, ''))
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\d+\.\s+/.test(t)) {
      const items = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    const para = []
    while (i < lines.length) {
      const tt = lines[i].trim()
      if (
        tt === '' ||
        /^(#{1,6})\s+/.test(tt) ||
        /^(\*|-|\+)\s+/.test(tt) ||
        /^\d+\.\s+/.test(tt) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(tt)
      ) break
      para.push(tt)
      i++
    }
    blocks.push({ type: 'p', lines: para })
  }
  return blocks
}

function Caret() { return <span className="mp-caret" aria-hidden /> }

function Markdown({ text, caret }) {
  const blocks = parseBlocks(text)
  const lastIdx = blocks.length - 1

  return (
    <div style={MD.root}>
      {blocks.map((b, bi) => {
        const withCaret = caret && bi === lastIdx

        if (b.type === 'hr') return <div key={bi} style={MD.hr} />

        if (b.type === 'heading') {
          const style = b.level <= 2 ? MD.h2 : b.level === 3 ? MD.h3 : MD.h4
          return (
            <div key={bi} style={style}>
              {renderInline(b.text, `h${bi}`)}{withCaret && <Caret />}
            </div>
          )
        }

        if (b.type === 'ul' || b.type === 'ol') {
          const ordered = b.type === 'ol'
          return (
            <ul key={bi} style={MD.list}>
              {b.items.map((it, ii) => (
                <li key={ii} style={MD.li}>
                  <span style={ordered ? MD.num : MD.bullet} aria-hidden>
                    {ordered ? `${ii + 1}.` : '–'}
                  </span>
                  <span style={{ flex: 1 }}>
                    {renderInline(it, `${b.type}${bi}-${ii}`)}
                    {withCaret && ii === b.items.length - 1 && <Caret />}
                  </span>
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={bi} style={MD.p}>
            {b.lines.map((ln, li) => (
              <span key={li}>
                {renderInline(ln, `p${bi}-${li}`)}
                {li < b.lines.length - 1 && <br />}
                {withCaret && li === b.lines.length - 1 && <Caret />}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

// ── Tool-call / result formatting ─────────────────────────────────────────────

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

// Pull the human-readable text out of an MCP result (string, {content:[{text}]}, array, object).
function extractText(output) {
  if (output == null) return ''
  if (typeof output === 'string') return output
  if (Array.isArray(output?.content)) {
    return output.content.map(c => (typeof c === 'string' ? c : c?.text ?? '')).join('\n')
  }
  if (Array.isArray(output) && output.every(c => c && typeof c === 'object' && 'text' in c)) {
    return output.map(c => c.text ?? '').join('\n')
  }
  try { return JSON.stringify(output, null, 2) } catch { return String(output) }
}

// Strip the MongoDB MCP prompt-injection guard wrapper + unescape JSON.
function cleanResult(text) {
  return String(text)
    .replace(/<\/?untrusted-user-data-[0-9a-f-]+>/gi, '')
    .replace(/The following section contains unverified user data[\s\S]*?(?=[\[{]|\n\n|$)/i, '')
    .replace(/Use the information above[\s\S]*$/i, '')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatResult(output) {
  const cleaned = cleanResult(extractText(output))
  if (!cleaned) return ''
  return cleaned.length > 900 ? cleaned.slice(0, 900) + '\n…' : cleaned
}

// ── Event components ──────────────────────────────────────────────────────────

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
          textTransform: 'uppercase', color: 'var(--red)', marginBottom: 10,
        }}>[ summary ]</div>
      )}
      <Markdown text={ev.content} caret={showCaret} />
    </div>
  )
}

function ToolEvent({ ev, index }) {
  const args = formatArgs(ev.args)
  const running = ev.status === 'running'
  const result = running ? '' : formatResult(ev.resultOutput)
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

      {result && (
        <pre style={{
          margin: '10px 0 0', padding: '10px 12px', background: 'var(--bg)',
          border: '1px solid var(--line-soft)', maxHeight: 150, overflow: 'auto',
          fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.5, color: 'var(--ink-2)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {result}
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

// ── Main ──────────────────────────────────────────────────────────────────────

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

// ── Markdown styles ───────────────────────────────────────────────────────────

const MD = {
  root:   { fontFamily: 'var(--sans)', fontSize: 14.5, lineHeight: 1.62, color: 'var(--ink)' },
  p:      { margin: '0 0 10px' },
  h2:     { fontFamily: 'var(--sans)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: '16px 0 8px', letterSpacing: '-0.01em', lineHeight: 1.3 },
  h3:     { fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '14px 0 6px', lineHeight: 1.35 },
  h4:     { fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-2)', margin: '14px 0 6px' },
  list:   { margin: '0 0 10px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 },
  li:     { display: 'flex', gap: 9, alignItems: 'baseline' },
  bullet: { color: 'var(--red)', fontFamily: 'var(--mono)', flex: 'none', fontSize: 13, lineHeight: 1.5 },
  num:    { color: 'var(--ink-3)', fontFamily: 'var(--mono)', flex: 'none', fontSize: 12, fontVariantNumeric: 'tabular-nums', minWidth: 18, lineHeight: 1.5 },
  hr:     { height: 1, background: 'var(--line)', margin: '14px 0', border: 0 },
  strong: { color: 'var(--ink)', fontWeight: 600 },
  em:     { fontStyle: 'italic', color: 'var(--ink)' },
  code:   { fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--line)', padding: '1px 6px', letterSpacing: '0.02em', wordBreak: 'break-all' },
}
