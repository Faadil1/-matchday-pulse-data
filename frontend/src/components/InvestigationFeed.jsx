import { useEffect, useRef, useState } from 'react'

// ── Inline markdown renderer ─────────────────────────────────────────────────
// Handles: **bold**, `code`, # headings, unordered lists, ordered lists.
// Deliberately minimal — no extra deps, fast, easy to extend.

function renderInline(text, keyPrefix = '') {
  // Split on **bold** and `code` spans (capturing group keeps delimiters)
  const tokens = text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g)
  return tokens.map((tok, i) => {
    const key = `${keyPrefix}-${i}`
    if (tok.startsWith('**') && tok.endsWith('**'))
      return <strong key={key} style={{ color: '#E5E7EB', fontWeight: 600 }}>{tok.slice(2, -2)}</strong>
    if (tok.startsWith('`') && tok.endsWith('`'))
      return (
        <code key={key} style={{
          fontFamily:  "'JetBrains Mono', monospace",
          background:  'rgba(34,211,238,0.1)',
          color:       '#22D3EE',
          padding:     '1px 5px',
          borderRadius: 4,
          fontSize:    '0.88em',
        }}>
          {tok.slice(1, -1)}
        </code>
      )
    return tok
  })
}

function MarkdownBlock({ text }) {
  if (!text) return null
  // Normalise Windows line endings
  const normalised = text.replace(/\r\n/g, '\n')
  const blocks = normalised.split(/\n{2,}/)

  return (
    <>
      {blocks.map((block, bi) => {
        const trimmed = block.trim()
        if (!trimmed) return null

        // Heading
        if (trimmed.startsWith('### '))
          return <p key={bi} style={{ color: '#E5E7EB', fontWeight: 600, fontSize: 13, margin: '6px 0 2px' }}>{renderInline(trimmed.slice(4), `h3-${bi}`)}</p>
        if (trimmed.startsWith('## '))
          return <p key={bi} style={{ color: '#E5E7EB', fontWeight: 700, fontSize: 14, margin: '8px 0 3px' }}>{renderInline(trimmed.slice(3), `h2-${bi}`)}</p>
        if (trimmed.startsWith('# '))
          return <p key={bi} style={{ color: '#E5E7EB', fontWeight: 700, fontSize: 15, margin: '8px 0 3px' }}>{renderInline(trimmed.slice(2), `h1-${bi}`)}</p>

        // Unordered list (-, *, •)
        const lines = trimmed.split('\n')
        if (lines.length > 0 && /^[-*•]\s/.test(lines[0])) {
          return (
            <ul key={bi} style={{ margin: '4px 0', paddingLeft: 18, listStyle: 'none' }}>
              {lines.filter(l => /^[-*•]\s/.test(l.trim())).map((l, li) => (
                <li key={li} style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 1.75, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#22D3EE', marginTop: 2, flexShrink: 0 }}>›</span>
                  <span>{renderInline(l.trim().replace(/^[-*•]\s/, ''), `ul-${bi}-${li}`)}</span>
                </li>
              ))}
            </ul>
          )
        }

        // Ordered list
        if (lines.length > 0 && /^\d+[.)]\s/.test(lines[0])) {
          return (
            <ol key={bi} style={{ margin: '4px 0', paddingLeft: 18, listStyle: 'none', counterReset: 'md-ol' }}>
              {lines.filter(l => /^\d+[.)]\s/.test(l.trim())).map((l, li) => {
                const content = l.trim().replace(/^\d+[.)]\s/, '')
                return (
                  <li key={li} style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 1.75, display: 'flex', gap: 8 }}>
                    <span style={{ color: '#22D3EE', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                      {li + 1}.
                    </span>
                    <span>{renderInline(content, `ol-${bi}-${li}`)}</span>
                  </li>
                )
              })}
            </ol>
          )
        }

        // Paragraph — preserve single newlines as <br>
        const inlineLines = lines.flatMap((l, li) => [
          ...renderInline(l, `p-${bi}-${li}`),
          li < lines.length - 1 ? <br key={`br-${bi}-${li}`} /> : null,
        ]).filter(x => x !== null)

        return (
          <p key={bi} style={{ color: '#CBD5E1', fontSize: 13, lineHeight: 1.8, margin: '3px 0' }}>
            {inlineLines}
          </p>
        )
      })}
    </>
  )
}

// ── Fraud detection utilities ─────────────────────────────────────────────────

const FRAUD_REGEX = /bot.?ring|fraud(?:ulent)?|card.?test(?:ing)?|coordinated|suspicious.?(?:pattern|activity|device)|anomal(?:y|ous).?spike/i

function detectFraud(text) {
  return FRAUD_REGEX.test(text)
}

function extractFingerprints(text) {
  // Prefer explicit fp_ prefixed IDs the agent received from MongoDB
  const fpMatches = text.match(/fp_[a-zA-Z0-9]{8,24}/g)
  if (fpMatches?.length) return [...new Set(fpMatches)]
  // Fallback: long hex-like quoted strings
  const hexMatches = text.match(/["'`]([a-f0-9]{12,32})["'`]/g)
  if (hexMatches?.length) return [...new Set(hexMatches.map(m => m.slice(1, -1)))]
  return []
}

function extractRecommendations(text) {
  const lines = text.split('\n')
  const recs  = []
  let capturing = false
  for (const line of lines) {
    const t = line.trim()
    if (/^#{1,3}\s*(recommend|action|suggest|next.?step|mitigation|remediat|response)/i.test(t)) {
      capturing = true; continue
    }
    if (capturing && /^#{1,3}\s/.test(t) && !/recommend|action|suggest/i.test(t)) {
      capturing = false
    }
    if (capturing && /^[-*•]\s/.test(t)) {
      const c = t.replace(/^[-*•]\s+/, '').trim()
      if (c) recs.push(c)
    }
    if (capturing && /^\d+[.)]\s/.test(t)) {
      const c = t.replace(/^\d+[.)]\s+/, '').trim()
      if (c) recs.push(c)
    }
  }
  return recs.slice(0, 6)
}

function playAlertTone() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.55)
  } catch (_) {}
}

// ── ThreatLevelMeter ──────────────────────────────────────────────────────────

function ThreatLevelMeter({ phase, fraudDetected }) {
  // step 0=none 1=green 2=amber 3=red
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (phase === 'idle') { setStep(0); return }
    if (phase === 'streaming') {
      setStep(1)
      const t = setTimeout(() => setStep(2), 2200)
      return () => clearTimeout(t)
    }
    if (phase === 'done' || phase === 'error') {
      setStep(fraudDetected ? 3 : 2)
    }
  }, [phase, fraudDetected])

  if (phase === 'idle') return null

  const SEGS = [
    { label: 'SAFE',     color: '#22C55E', active: step >= 1 },
    { label: 'ELEVATED', color: '#F59E0B', active: step >= 2 },
    { label: 'CRITICAL', color: '#EF4444', active: step >= 3 },
  ]

  const labelColor = step >= 3 ? '#EF4444' : step >= 2 ? '#F59E0B' : '#22C55E'
  const labelText  = step >= 3 ? 'critical' : step >= 2 ? 'elevated' : 'nominal'

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          8,
      padding:      '5px 16px',
      borderBottom: '1px solid #1F2937',
      background:   '#0D1117',
      flexShrink:   0,
    }}>
      <span style={{
        fontFamily:    "'JetBrains Mono', monospace",
        fontSize:      9,
        color:         '#374151',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        flexShrink:    0,
      }}>
        Threat
      </span>
      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
        {SEGS.map(({ label, color, active }) => (
          <div
            key={label}
            title={label}
            style={{
              flex:         1,
              height:       3,
              borderRadius: 2,
              background:   active ? color : '#1F2937',
              transition:   'background 0.9s ease',
              animation:    (active && label === 'CRITICAL') ? 'threat-pulse 1.6s ease-in-out infinite' : 'none',
            }}
          />
        ))}
      </div>
      <span style={{
        fontFamily:    "'JetBrains Mono', monospace",
        fontSize:      9,
        color:         labelColor,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        flexShrink:    0,
        transition:    'color 0.9s ease',
        minWidth:      44,
        textAlign:     'right',
      }}>
        {labelText}
      </span>
    </div>
  )
}

// ── FraudAlertBanner ──────────────────────────────────────────────────────────

function FraudAlertBanner({ soundEnabled, onToggleSound }) {
  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          10,
      padding:      '9px 16px',
      background:   'linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.06) 100%)',
      borderBottom: '1px solid rgba(239,68,68,0.3)',
      flexShrink:   0,
      animation:    'slide-down-banner 0.38s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <span style={{
        fontSize:  13,
        flexShrink: 0,
        animation: 'alert-pulse 2.2s ease-in-out infinite',
        color:     '#EF4444',
      }}>
        ⚠
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily:    "'JetBrains Mono', monospace",
          fontSize:      11,
          fontWeight:    700,
          color:         '#EF4444',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          lineHeight:    1.3,
        }}>
          Fraud Detected
        </div>
        <div style={{
          fontFamily:   "'JetBrains Mono', monospace",
          fontSize:     10,
          color:        '#FCA5A5',
          marginTop:    2,
          whiteSpace:   'nowrap',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
        }}>
          Coordinated bot ring · Zone 3 · ticket_resale
        </div>
      </div>
      <button
        onClick={onToggleSound}
        title={soundEnabled ? 'Mute alert sound' : 'Enable alert sound'}
        style={{
          background:   'rgba(239,68,68,0.1)',
          border:       '1px solid rgba(239,68,68,0.2)',
          borderRadius: 6,
          color:        soundEnabled ? '#EF4444' : '#4B5563',
          fontSize:     12,
          cursor:       'pointer',
          padding:      '3px 8px',
          fontFamily:   "'JetBrains Mono', monospace",
          flexShrink:   0,
          transition:   'all 0.15s',
          lineHeight:   1,
        }}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>
    </div>
  )
}

// ── BlocklistCard ─────────────────────────────────────────────────────────────

function BlocklistCard({ fingerprints }) {
  const [blocked, setBlocked] = useState({})
  const [toast,   setToast  ] = useState(null)

  function handleBlock(fp) {
    if (blocked[fp]) return
    setBlocked(prev => ({ ...prev, [fp]: true }))
    setToast(fp)
    setTimeout(() => setToast(null), 2400)
  }

  if (!fingerprints.length) return null

  return (
    <div style={{
      background:   'rgba(239,68,68,0.04)',
      border:       '1px solid rgba(239,68,68,0.18)',
      borderLeft:   '3px solid #EF4444',
      borderRadius: 10,
      padding:      '12px 14px',
      position:     'relative',
      animation:    'slide-in-log 0.3s ease-out',
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position:     'absolute',
          top:          -40,
          right:        10,
          background:   '#22C55E',
          color:        '#0B0E14',
          fontFamily:   "'JetBrains Mono', monospace",
          fontSize:     11,
          fontWeight:   700,
          padding:      '5px 12px',
          borderRadius: 6,
          whiteSpace:   'nowrap',
          animation:    'slide-in-log 0.18s ease-out',
          zIndex:       10,
          boxShadow:    '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          ✓ Device blocked
        </div>
      )}

      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           6,
        marginBottom:  10,
        paddingBottom: 8,
        borderBottom:  '1px solid rgba(239,68,68,0.12)',
      }}>
        <span style={{ fontSize: 10, flexShrink: 0 }}>🚫</span>
        <span style={{
          fontFamily:    "'JetBrains Mono', monospace",
          fontSize:      10,
          fontWeight:    600,
          color:         '#EF4444',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Identified Device Fingerprints
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {fingerprints.map(fp => (
          <div key={fp} style={{
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            padding:      '6px 10px',
            background:   blocked[fp] ? 'rgba(34,197,94,0.05)' : 'rgba(0,0,0,0.2)',
            border:       `1px solid ${blocked[fp] ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.08)'}`,
            borderRadius: 6,
            transition:   'all 0.35s',
          }}>
            <span style={{
              fontFamily:     "'JetBrains Mono', monospace",
              fontSize:       11,
              color:          blocked[fp] ? '#374151' : '#FCA5A5',
              flex:           1,
              textDecoration: blocked[fp] ? 'line-through' : 'none',
              transition:     'all 0.35s',
            }}>
              {fp}
            </span>
            <button
              onClick={() => handleBlock(fp)}
              disabled={blocked[fp]}
              style={{
                padding:       '3px 10px',
                background:    blocked[fp] ? 'rgba(34,197,94,0.08)' : '#EF4444',
                color:         blocked[fp] ? '#22C55E' : '#fff',
                border:        blocked[fp] ? '1px solid rgba(34,197,94,0.25)' : 'none',
                borderRadius:  5,
                fontSize:      10,
                fontWeight:    700,
                fontFamily:    "'JetBrains Mono', monospace",
                cursor:        blocked[fp] ? 'default' : 'pointer',
                letterSpacing: '0.07em',
                transition:    'all 0.25s',
                whiteSpace:    'nowrap',
                flexShrink:    0,
              }}
            >
              {blocked[fp] ? '✓ BLOCKED' : 'BLOCK'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── RecommendedActionsCard ────────────────────────────────────────────────────

function RecommendedActionsCard({ recommendations }) {
  const [checked, setChecked] = useState({})

  if (!recommendations.length) return null

  const doneCount = Object.values(checked).filter(Boolean).length

  return (
    <div style={{
      background:   'rgba(245,158,11,0.04)',
      border:       '1px solid rgba(245,158,11,0.18)',
      borderLeft:   '3px solid #F59E0B',
      borderRadius: 10,
      padding:      '12px 14px',
      animation:    'slide-in-log 0.3s ease-out 0.12s both',
    }}>
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   10,
        paddingBottom:  8,
        borderBottom:   '1px solid rgba(245,158,11,0.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, flexShrink: 0 }}>📋</span>
          <span style={{
            fontFamily:    "'JetBrains Mono', monospace",
            fontSize:      10,
            fontWeight:    600,
            color:         '#F59E0B',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Recommended Actions
          </span>
        </div>
        <span style={{
          fontFamily:  "'JetBrains Mono', monospace",
          fontSize:    10,
          color:       doneCount === recommendations.length ? '#22C55E' : '#374151',
          transition:  'color 0.4s',
        }}>
          {doneCount}/{recommendations.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {recommendations.map((rec, i) => (
          <label
            key={i}
            style={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          9,
              cursor:       'pointer',
              padding:      '4px 6px',
              borderRadius: 6,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.05)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'           }}
          >
            <input
              type="checkbox"
              checked={!!checked[i]}
              onChange={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
              style={{ marginTop: 3, accentColor: '#F59E0B', flexShrink: 0 }}
            />
            <span style={{
              fontFamily:     "'Inter', sans-serif",
              fontSize:       12,
              color:          checked[i] ? '#374151' : '#CBD5E1',
              textDecoration: checked[i] ? 'line-through' : 'none',
              lineHeight:     1.65,
              transition:     'all 0.25s',
            }}>
              {rec}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Individual event renderers ────────────────────────────────────────────────

function TextCard({ content, isFinal, isStreaming, isLastEvent }) {
  const showCursor = isStreaming && isLastEvent

  if (isFinal) {
    return (
      <div style={{
        background:   'rgba(34,211,238,0.06)',
        border:       '1px solid rgba(34,211,238,0.35)',
        borderLeft:   '3px solid #22D3EE',
        borderRadius: 10,
        padding:      '14px 16px',
      }}>
        <div style={{
          display:       'flex',
          alignItems:    'center',
          gap:           6,
          marginBottom:  10,
          paddingBottom: 8,
          borderBottom:  '1px solid rgba(34,211,238,0.15)',
        }}>
          <span style={{ color: '#22D3EE', fontSize: 12 }}>✦</span>
          <span style={{
            color:         '#22D3EE',
            fontSize:      10,
            fontFamily:    "'JetBrains Mono', monospace",
            fontWeight:    600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Investigation Summary
          </span>
        </div>
        <MarkdownBlock text={content} />
      </div>
    )
  }

  return (
    <div style={{
      background:   'rgba(255,255,255,0.02)',
      border:       '1px solid #1F2937',
      borderLeft:   '3px solid rgba(34,211,238,0.4)',
      borderRadius: 10,
      padding:      '12px 16px',
    }}>
      <MarkdownBlock text={content} />
      {showCursor && (
        <span style={{
          display:       'inline-block',
          width:         2,
          height:        14,
          background:    '#22D3EE',
          marginLeft:    2,
          verticalAlign: 'text-bottom',
          animation:     'cursor-blink 0.9s step-end infinite',
        }} />
      )}
    </div>
  )
}

function ToolRow({ name, status }) {
  const running = status === 'running'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
      {/* Vertical rail connecting text cards */}
      <div style={{
        width:      28,
        display:    'flex',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{ width: 1, height: 28, background: 'rgba(34,211,238,0.12)' }} />
      </div>

      {/* Status dot */}
      {running ? (
        <span style={{
          width:        8,
          height:       8,
          borderRadius: '50%',
          background:   '#22D3EE',
          flexShrink:   0,
          animation:    'pulse-glow 1.1s ease-in-out infinite',
        }} />
      ) : (
        <span style={{ fontSize: 12, color: '#22C55E', flexShrink: 0, lineHeight: 1 }}>✓</span>
      )}

      {/* Badge */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          6,
        padding:      '4px 10px',
        borderRadius: 6,
        background:   running ? 'rgba(34,211,238,0.07)' : 'rgba(34,197,94,0.05)',
        border:       `1px solid ${running ? 'rgba(34,211,238,0.2)' : 'rgba(34,197,94,0.15)'}`,
        transition:   'all 0.3s ease',
      }}>
        <span style={{ fontSize: 9 }}>⚡</span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize:   12,
          fontWeight: 500,
          color:      running ? '#22D3EE' : '#6B7280',
          transition: 'color 0.3s',
        }}>
          {name}
        </span>
      </div>

      {running && (
        <span style={{
          fontSize:   11,
          color:      '#374151',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          running…
        </span>
      )}
    </div>
  )
}

function ErrorCard({ message }) {
  // Detect network / CORS failures so the user knows what to fix
  const lc = message.toLowerCase()
  const isCors =
    lc.includes('failed to fetch') ||
    lc.includes('networkerror')    ||
    lc.includes('cors')            ||
    lc.includes('load failed')

  // Always log to console with clear CORS hint
  if (isCors) {
    console.error(
      '%c[Matchday Pulse] CORS / network error detected.',
      'color:#EF4444;font-weight:bold',
      '\nThe backend needs: Access-Control-Allow-Origin: *',
      '\nCheck: Network tab → OPTIONS preflight → response headers.',
      '\nOriginal error:', message
    )
  }

  return (
    <div style={{
      background:   'rgba(239,68,68,0.06)',
      border:       '1px solid rgba(239,68,68,0.3)',
      borderLeft:   '3px solid #EF4444',
      borderRadius: 10,
      padding:      '12px 16px',
    }}>
      <div style={{ color: '#EF4444', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
        {isCors ? '🚫 Network / CORS error' : '⚠ Agent error'}
      </div>
      <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: isCors ? 8 : 0 }}>
        {message}
      </div>
      {isCors && (
        <div style={{
          fontFamily:   "'JetBrains Mono', monospace",
          fontSize:     11,
          color:        '#64748B',
          background:   'rgba(0,0,0,0.25)',
          borderRadius: 6,
          padding:      '7px 10px',
          lineHeight:   1.7,
        }}>
          Backend fix needed:{' '}
          <code style={{ color: '#22D3EE' }}>Access-Control-Allow-Origin: *</code>
          <br />
          See browser DevTools → Console for full details.
        </div>
      )}
    </div>
  )
}

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display:      'inline-block',
            width:        6,
            height:       6,
            borderRadius: '50%',
            background:   '#22D3EE',
            animation:    `bounce-dot 1.2s ease-in-out ${i * 0.18}s infinite`,
          }} />
        ))}
      </div>
      <span style={{ color: '#4B5563', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
        Agent thinking…
      </span>
    </div>
  )
}

function DoneBadge() {
  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        8,
      padding:    '6px 0 2px',
      borderTop:  '1px solid #1F2937',
      marginTop:  4,
    }}>
      <span style={{ color: '#22C55E', fontSize: 13 }}>✓</span>
      <span style={{
        color:      '#374151',
        fontSize:   11,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        Investigation complete
      </span>
    </div>
  )
}

function ProgressBar({ phase }) {
  if (phase === 'idle') return null
  return (
    <div style={{ height: 2, background: '#0D1117', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
      {phase === 'streaming' && (
        <div style={{
          position:   'absolute',
          inset:      0,
          background: 'linear-gradient(90deg, transparent 0%, #22D3EE 50%, transparent 100%)',
          width:      '30%',
          animation:  'shimmer 1.4s linear infinite',
        }} />
      )}
      {(phase === 'done') && (
        <div style={{ position: 'absolute', inset: 0, background: '#22C55E', transition: 'all 0.6s' }} />
      )}
      {(phase === 'error') && (
        <div style={{ position: 'absolute', inset: 0, background: '#EF4444' }} />
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function InvestigationFeed({ events, phase }) {
  const bottomRef      = useRef(null)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const alertFiredRef  = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [events])

  // Reset alert guard at the start of each new investigation
  useEffect(() => {
    if (events.length === 0) alertFiredRef.current = false
  }, [events.length])

  // Derive fraud context from the final text event
  const finalEvent      = [...events].reverse().find(e => e.type === 'text' && e.isFinal) ?? null
  const fraudDetected   = finalEvent ? detectFraud(finalEvent.content) : false
  const fingerprints    = (fraudDetected && finalEvent) ? extractFingerprints(finalEvent.content)    : []
  const recommendations = (fraudDetected && finalEvent) ? extractRecommendations(finalEvent.content) : []

  // Fire tone once when fraud is confirmed (only if user enabled sound)
  useEffect(() => {
    if (fraudDetected && phase === 'done' && !alertFiredRef.current) {
      alertFiredRef.current = true
      if (soundEnabled) playAlertTone()
    }
  }, [fraudDetected, phase, soundEnabled])

  function handleToggleSound() {
    const next = !soundEnabled
    setSoundEnabled(next)
    // If the user enables sound after fraud already confirmed, play immediately
    if (next && fraudDetected && phase === 'done') playAlertTone()
  }

  const hasEvents    = events.length > 0
  const isStreaming  = phase === 'streaming'
  const showFraudUI  = fraudDetected && phase === 'done'

  // Find index of last text event (for cursor placement)
  let lastTextIdx = -1
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'text') { lastTextIdx = i; break }
  }

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      flex:          1,
      background:    '#141925',
      border:        `1px solid ${showFraudUI ? 'rgba(239,68,68,0.35)' : '#1F2937'}`,
      borderRadius:  14,
      overflow:      'hidden',
      minHeight:     280,
      transition:    'border-color 0.6s ease',
    }}>
      <ProgressBar phase={phase} />
      <ThreatLevelMeter phase={phase} fraudDetected={fraudDetected} />

      {showFraudUI && (
        <FraudAlertBanner
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
        />
      )}

      <div
        className="feed-scroll"
        style={{
          flex:          1,
          overflowY:     'auto',
          padding:       '18px 20px',
          display:       'flex',
          flexDirection: 'column',
          gap:           10,
        }}
      >
        {/* Empty + streaming → show thinking dots */}
        {!hasEvents && isStreaming && <ThinkingDots />}

        {events.map((ev, idx) => (
          <div key={ev.id}>
            {ev.type === 'text' && (
              <TextCard
                content={ev.content}
                isFinal={ev.isFinal}
                isStreaming={isStreaming}
                isLastEvent={idx === lastTextIdx}
              />
            )}
            {ev.type === 'tool_call' && (
              <ToolRow name={ev.name} status={ev.status} />
            )}
            {ev.type === 'error' && (
              <ErrorCard message={ev.message} />
            )}
          </div>
        ))}

        {/* Still streaming but events already showing → keep dots after last item */}
        {isStreaming && hasEvents && <ThinkingDots />}

        {/* Fraud-specific cards slot in just before the done badge */}
        {showFraudUI && (
          <>
            {fingerprints.length > 0 && (
              <BlocklistCard fingerprints={fingerprints} />
            )}
            {recommendations.length > 0 && (
              <RecommendedActionsCard recommendations={recommendations} />
            )}
          </>
        )}

        {phase === 'done' && <DoneBadge />}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
