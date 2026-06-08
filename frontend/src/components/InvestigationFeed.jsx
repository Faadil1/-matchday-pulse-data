import { useEffect, useRef } from 'react'

/*
  InvestigationFeed — P4: the centre column is now a clean fraud-investigation REPORT.
  Repo path: src/components/InvestigationFeed.jsx   (replaces the previous version)
  ------------------------------------------------------------------
  - Tool-call plumbing is no longer rendered here (no pipeline / JSON / aggregate /
    "database matchday" in the centre). The agent's narrative + verdict carry the report;
    the investigation timeline lives in ActionLog.
  - Markdown rendering (headings, **bold**, lists, `code`, ---) is kept.
  - Fixed: repeated "1." in numbered lists — numbering now runs continuously across
    interrupted blocks and resets at each section heading / rule.
  Requires the shared stylesheet + className="mp-app" on the app root.
*/

const INLINE_RE = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g
const UNESCAPE  = /\\([\\$*_#.\-\[\]()!{}+])/g
const unescape  = (s) => s.replace(UNESCAPE, '$1')

function renderInline(text, keyBase) {
  const out = []
  let last = 0, m, i = 0
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(unescape(text.slice(last, m.index)))
    const tok = m[0]
    const k = `${keyBase}-${i++}`
    if (tok[0] === '`') out.push(<code key={k} style={MD.code}>{tok.slice(1, -1)}</code>)
    else if (tok.startsWith('**') || tok.startsWith('__')) out.push(<strong key={k} style={MD.strong}>{unescape(tok.slice(2, -2))}</strong>)
    else out.push(<em key={k} style={MD.em}>{unescape(tok.slice(1, -1))}</em>)
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

  // Continuous numbering for ordered lists; reset at each heading / rule.
  let oc = 0
  for (const b of blocks) {
    if (b.type === 'heading' || b.type === 'hr') oc = 0
    else if (b.type === 'ol') { b.startNum = oc; oc += b.items.length }
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
          return <div key={bi} style={style}>{renderInline(b.text, `h${bi}`)}{withCaret && <Caret />}</div>
        }

        if (b.type === 'ul' || b.type === 'ol') {
          const ordered = b.type === 'ol'
          const start = b.startNum || 0
          return (
            <ul key={bi} style={MD.list}>
              {b.items.map((it, ii) => (
                <li key={ii} style={MD.li}>
                  <span style={ordered ? MD.num : MD.bullet} aria-hidden>
                    {ordered ? `${start + ii + 1}.` : '–'}
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

function TextEvent({ ev, showCaret }) {
  return (
    <div className="mp-rise" style={{
      padding: '16px 18px',
      background: ev.isFinal ? 'var(--panel-2)' : 'var(--panel)',
      borderBottom: '1px solid var(--line-soft)',
      borderLeft: ev.isFinal ? '2px solid var(--red)' : '2px solid transparent',
    }}>
      {ev.isFinal && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 10 }}>
          [ summary ]
        </div>
      )}
      <Markdown text={ev.content} caret={showCaret} />
    </div>
  )
}

function ErrorEvent({ ev }) {
  return (
    <div className="mp-rise" style={{
      padding: '13px 18px', borderBottom: '1px solid var(--line-soft)',
      borderLeft: '2px solid var(--red)', background: 'var(--red-soft)',
    }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--red-hi)' }}>[ error ]</span>
      <p style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink)', margin: '6px 0 0', lineHeight: 1.5 }}>{ev.message}</p>
    </div>
  )
}

export default function InvestigationFeed({ events = [], phase = 'idle' }) {
  const endRef = useRef(null)
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }) }, [events])

  const streaming = phase === 'streaming'
  const textEvents = events.filter(e => e.type === 'text' || e.type === 'error')
  const hasText = textEvents.some(e => e.type === 'text')
  const lastTextId = textEvents.length ? textEvents[textEvents.length - 1].id : null

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--line)', background: 'var(--panel)' }}>
      {streaming && !hasText && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--ink-2)', letterSpacing: '0.02em' }}>
          <span className="mp-pip" aria-hidden style={{ background: 'var(--ink)', animation: 'mp-breathe 1.2s ease-in-out infinite' }} />
          agent analyzing…
        </div>
      )}

      {/* Tool calls are intentionally not rendered here — they live in the timeline (ActionLog).
          The centre is the investigation report: the agent's narrative + the final summary. */}
      {textEvents.map(ev => {
        if (ev.type === 'text') {
          return <TextEvent key={ev.id} ev={ev} showCaret={streaming && !ev.isFinal && ev.id === lastTextId} />
        }
        return <ErrorEvent key={ev.id} ev={ev} />
      })}

      <div ref={endRef} />
    </div>
  )
}

const MD = {
  root:   { fontFamily: 'var(--sans)', fontSize: 14.5, lineHeight: 1.62, color: 'var(--ink)' },
  p:      { margin: '0 0 11px' },
  h2:     { fontFamily: 'var(--sans)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', margin: '18px 0 9px', letterSpacing: '-0.01em', lineHeight: 1.3 },
  h3:     { fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', margin: '15px 0 7px', lineHeight: 1.35 },
  h4:     { fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-2)', margin: '15px 0 7px' },
  list:   { margin: '0 0 11px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 },
  li:     { display: 'flex', gap: 9, alignItems: 'baseline' },
  bullet: { color: 'var(--red)', fontFamily: 'var(--mono)', flex: 'none', fontSize: 13, lineHeight: 1.5 },
  num:    { color: 'var(--ink-3)', fontFamily: 'var(--mono)', flex: 'none', fontSize: 12, fontVariantNumeric: 'tabular-nums', minWidth: 18, lineHeight: 1.5 },
  hr:     { height: 1, background: 'var(--line)', margin: '16px 0', border: 0 },
  strong: { color: 'var(--ink)', fontWeight: 600 },
  em:     { fontStyle: 'italic', color: 'var(--ink)' },
  code:   { fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--line)', padding: '1px 6px', letterSpacing: '0.02em', wordBreak: 'break-all' },
}
