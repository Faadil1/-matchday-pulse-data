import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  Cell, LabelList, ReferenceArea, ResponsiveContainer,
} from 'recharts'

// ── Real dataset figures from seeded MongoDB ──────────────────────────────────

const APPROVED    = 4411
const DECLINED    = 589
const DECLINE_PCT = '11.8'

const HOURLY = [
  { hour: '15h', declines: 72,  isSpike: false },
  { hour: '16h', declines: 58,  isSpike: false },
  { hour: '17h', declines: 273, isSpike: true  },
  { hour: '18h', declines: 57,  isSpike: false },
  { hour: '19h', declines: 78,  isSpike: false },
  { hour: '20h', declines: 51,  isSpike: false },
]

// Sorted descending — Zone3 leads
const ZONES = [
  { name: 'Zone3', declines: 286, isHot: true  },
  { name: 'Zone5', declines: 71,  isHot: false },
  { name: 'Zone2', declines: 64,  isHot: false },
  { name: 'Zone6', declines: 61,  isHot: false },
  { name: 'Zone1', declines: 58,  isHot: false },
  { name: 'Zone4', declines: 49,  isHot: false },
]
const MAX_ZONE_DECLINES = ZONES[0].declines  // 286

// ── Design tokens (match existing system) ────────────────────────────────────
const C = {
  bg:      '#0B0E14',
  surface: '#141925',
  border:  '#1F2937',
  accent:  '#22D3EE',
  danger:  '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
  text:    '#E5E7EB',
  muted:   '#94A3B8',
  faint:   '#374151',
  mono:    "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
  sans:    "'Inter', system-ui, sans-serif",
}

// ── Recharts custom pieces ────────────────────────────────────────────────────

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const isSpike = HOURLY.find(h => h.hour === label)?.isSpike
  return (
    <div style={{
      background:   C.surface,
      border:       `1px solid ${isSpike ? C.danger : C.border}`,
      borderRadius: 8,
      padding:      '8px 12px',
      fontFamily:   C.mono,
      fontSize:     12,
    }}>
      <div style={{ color: C.muted, marginBottom: 2 }}>{label}</div>
      <div style={{ color: isSpike ? C.danger : C.text, fontWeight: 600 }}>
        {payload[0].value} declines
      </div>
      {isSpike && (
        <div style={{ color: C.danger, fontSize: 10, marginTop: 2 }}>▲ 4.7× baseline</div>
      )}
    </div>
  )
}

function SpikeLabel(props) {
  const { x, y, width, index } = props
  if (!HOURLY[index]?.isSpike) return null
  const cx = x + width / 2
  return (
    <g>
      <text x={cx} y={y - 18} textAnchor="middle" fill={C.danger} fontSize={9}
        fontFamily={C.mono} letterSpacing="1">SPIKE</text>
      <text x={cx} y={y - 6} textAnchor="middle" fill={C.danger} fontSize={11}
        fontFamily={C.mono} fontWeight="700">273</text>
    </g>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{
        color: C.muted, fontSize: 10, fontFamily: C.mono,
        letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600,
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function Stat({ value, label, color }) {
  return (
    <div style={{
      flex: 1, padding: '12px 10px', background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: 10,
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <span style={{
        fontFamily: C.mono, fontSize: 22, fontWeight: 700,
        color: color ?? C.text, lineHeight: 1, letterSpacing: '-0.5px',
      }}>
        {value}
      </span>
      <span style={{
        color: C.muted, fontSize: 10, fontFamily: C.mono,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  )
}

// ── Horizontal zone bar ───────────────────────────────────────────────────────
function ZoneBar({ name, declines, isHot, pct, animated, phase, isFlashing }) {
  const fillWidth  = animated ? `${(declines / MAX_ZONE_DECLINES) * 100}%` : '0%'
  const isActive   = isHot && phase === 'streaming'   // agent is looking at it
  const isConfirmed = isHot && phase === 'done'        // fraud confirmed

  // Container glow: subtle ambient haze around Zone3 during investigation
  const containerStyle = isActive ? {
    borderRadius:  6,
    outline:       '1px solid rgba(239,68,68,0.3)',
    outlineOffset: '3px',
    boxShadow:     '0 0 16px 2px rgba(239,68,68,0.12)',
    padding:       '2px 0',
    transition:    'box-shadow 0.6s ease, outline 0.4s ease',
  } : {
    transition: 'box-shadow 0.6s ease, outline 0.4s ease',
    padding:    '2px 0',
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{
          fontFamily:  C.mono,
          fontSize:    12,
          fontWeight:  isHot ? 700 : 400,
          color:       isHot ? C.danger : C.muted,
          // Subtle pulse on the label when agent is actively streaming
          animation:   isActive ? 'pulse-glow 2s ease-in-out infinite' : 'none',
          display:     'inline-block',
        }}>
          {name}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontFamily: C.mono, fontSize: 12, color: isHot ? C.danger : C.text, fontWeight: 600 }}>
            {declines}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: 10, color: C.faint }}>{pct}%</span>
        </div>
      </div>

      <div style={{ height: 6, background: '#0D1117', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height:       '100%',
          width:        fillWidth,
          background:   isHot
            ? `linear-gradient(90deg, ${C.danger}, #ff6b6b)`
            : `linear-gradient(90deg, ${C.accent}88, ${C.accent}44)`,
          borderRadius: 3,
          transition:   'width 0.9s cubic-bezier(0.25, 1, 0.5, 1)',
          // Idle: standard glow; streaming: stronger glow; flash on done
          boxShadow:    isActive
            ? '0 0 14px 4px rgba(239,68,68,0.55)'
            : isHot ? '0 0 8px 1px rgba(239,68,68,0.35)' : 'none',
          // flash-confirm runs once when phase flips to done
          animation:    isConfirmed && isFlashing ? 'flash-confirm 0.85s ease-out forwards' : 'none',
        }} />
      </div>
    </div>
  )
}

// ── Collapsed strip ───────────────────────────────────────────────────────────
function CollapsedStrip({ onOpen }) {
  return (
    <aside style={{
      width: 44, minWidth: 44, flexShrink: 0,
      borderRight: `1px solid ${C.border}`, background: '#0D1117',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 16, gap: 14,
    }}>
      <button onClick={onOpen} title="Open dashboard" style={{
        width: 28, height: 28, borderRadius: 8, background: C.surface,
        border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, lineHeight: 1,
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}
      >
        ›
      </button>
      <span style={{
        color: C.faint, fontSize: 9, fontFamily: C.mono, letterSpacing: '0.1em',
        textTransform: 'uppercase', writingMode: 'vertical-rl',
        transform: 'rotate(180deg)', userSelect: 'none',
      }}>
        Dashboard
      </span>
    </aside>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function TransactionDashboard({ phase = 'idle' }) {
  const [open,      setOpen     ] = useState(true)
  const [animated,  setAnimated ] = useState(false)   // zone bar entrance
  const [isFlashing, setFlashing] = useState(false)   // one-shot flash on done

  const prevPhaseRef = useRef('idle')

  // Entrance animation for zone bars
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120)
    return () => clearTimeout(t)
  }, [])

  // Detect idle→streaming→done transitions
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase

    if (prev !== 'done' && phase === 'done') {
      // Fire the one-shot flash
      setFlashing(true)
      const t = setTimeout(() => setFlashing(false), 1000)
      return () => clearTimeout(t)
    }
  }, [phase])

  const isStreaming  = phase === 'streaming'
  const isDone       = phase === 'done'

  if (!open) return <CollapsedStrip onOpen={() => setOpen(true)} />

  return (
    <aside style={{
      width: 300, minWidth: 300, flexShrink: 0,
      borderRight: `1px solid ${C.border}`, background: '#0D1117',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
      gap: 24, padding: '18px 16px 32px',
    }} className="feed-scroll">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: C.success,
            boxShadow: `0 0 6px 2px rgba(34,197,94,0.5)`,
            animation: 'pulse-glow 2s ease-in-out infinite', flexShrink: 0,
          }} />
          <span style={{
            fontFamily: C.mono, fontSize: 10, color: C.success,
            letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
          }}>
            Live
          </span>
          <span style={{ color: C.faint, fontSize: 10, fontFamily: C.mono }}>· Match Day</span>
        </div>
        <button onClick={() => setOpen(false)} title="Collapse dashboard" style={{
          width: 24, height: 24, borderRadius: 6, background: 'transparent',
          border: `1px solid ${C.border}`, color: C.faint, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, lineHeight: 1, flexShrink: 0,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.faint }}
        >
          ‹
        </button>
      </div>

      {/* ── Overview stats ── */}
      <div>
        <SectionLabel>Overview</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Stat value="5,000" label="transactions" />
          <Stat value={`${DECLINE_PCT}%`} label="decline rate" color={C.danger} />
        </div>
        <div style={{
          padding: '10px 12px', background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div>
              <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 600, color: C.success }}>
                {APPROVED.toLocaleString()}
              </div>
              <div style={{ color: C.faint, fontSize: 10, fontFamily: C.mono, textTransform: 'uppercase' }}>Approved</div>
            </div>
            <div style={{ width: 1, background: C.border }} />
            <div>
              <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 600, color: C.danger }}>{DECLINED}</div>
              <div style={{ color: C.faint, fontSize: 10, fontFamily: C.mono, textTransform: 'uppercase' }}>Declined</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: C.mono, fontSize: 13, color: C.muted }}>6 zones</div>
            <div style={{ fontFamily: C.mono, fontSize: 11, color: C.faint }}>Toronto</div>
          </div>
        </div>
      </div>

      {/* ── Hourly decline chart ── */}
      <div>
        <SectionLabel>Hourly Decline Pattern</SectionLabel>

        {/*
          Agent-scanning indicator: a thin banner that appears while streaming
          to signal the chart is "being looked at"
        */}
        <div style={{
          padding: '12px 8px 4px', background: C.surface,
          border: `1px solid ${isStreaming ? 'rgba(239,68,68,0.35)' : isDone ? 'rgba(239,68,68,0.2)' : C.border}`,
          borderRadius: 10,
          boxShadow: isStreaming ? '0 0 18px 2px rgba(239,68,68,0.1)' : 'none',
          transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingLeft: 4 }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: 2,
              background: C.danger,
              // Pulse the badge while streaming
              animation: isStreaming ? 'pulse-glow 1.2s ease-in-out infinite' : 'none',
            }} />
            <span style={{ fontFamily: C.mono, fontSize: 10, color: C.danger }}>
              17:30–18:00 UTC spike detected
            </span>
          </div>

          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={HOURLY} margin={{ top: 28, right: 6, bottom: 0, left: -18 }} barCategoryGap="30%">
              <XAxis
                dataKey="hour"
                tick={{ fill: C.muted, fontSize: 10, fontFamily: C.mono }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: C.faint, fontSize: 9, fontFamily: C.mono }}
                axisLine={false} tickLine={false} width={34}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 4 }} />

              {/* Scanning glow: highlight the spike column while agent is working */}
              {phase !== 'idle' && (
                <ReferenceArea
                  x1="17h" x2="17h"
                  fill={C.danger}
                  fillOpacity={isStreaming ? 0.09 : 0.04}
                  stroke={isStreaming ? C.danger : 'none'}
                  strokeOpacity={0.25}
                  strokeDasharray="3 3"
                />
              )}

              <Bar dataKey="declines" radius={[3, 3, 0, 0]} animationDuration={900} animationEasing="ease-out">
                {HOURLY.map(entry => (
                  <Cell
                    key={entry.hour}
                    fill={entry.isSpike ? C.danger : C.accent}
                    fillOpacity={entry.isSpike ? 1 : 0.5}
                    // Glow the spike bar via SVG drop-shadow while agent scans
                    filter={
                      entry.isSpike && isStreaming
                        ? 'drop-shadow(0px 0px 7px rgba(239,68,68,0.85))'
                        : entry.isSpike && isFlashing
                          ? 'drop-shadow(0px 0px 14px rgba(239,68,68,1)) brightness(1.8)'
                          : 'none'
                    }
                  />
                ))}
                <LabelList dataKey="declines" content={SpikeLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Zone breakdown ── */}
      <div>
        <SectionLabel>Zone Decline Breakdown</SectionLabel>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          padding: '12px 14px', background: C.surface,
          border: `1px solid ${isStreaming ? 'rgba(239,68,68,0.25)' : isDone ? 'rgba(239,68,68,0.15)' : C.border}`,
          borderRadius: 10,
          boxShadow: isStreaming ? '0 0 18px 2px rgba(239,68,68,0.08)' : 'none',
          transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
        }}>
          {ZONES.map(z => (
            <ZoneBar
              key={z.name}
              name={z.name}
              declines={z.declines}
              isHot={z.isHot}
              pct={((z.declines / DECLINED) * 100).toFixed(1)}
              animated={animated}
              phase={phase}
              isFlashing={isFlashing}
            />
          ))}

          <div style={{
            marginTop: 4, padding: '7px 10px',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7,
          }}>
            <span style={{ fontFamily: C.mono, fontSize: 10, color: C.danger }}>
              Zone3 accounts for <strong style={{ color: C.danger }}>48.6%</strong> of all declines
            </span>
          </div>
        </div>
      </div>

      {/* ── Signal summary ── */}
      <div>
        <SectionLabel>Signal Summary</SectionLabel>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '12px 14px', background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 10,
        }}>
          {[
            { icon: '⚡', label: 'Volume spike',        value: '24×',       color: C.danger  },
            { icon: '↘',  label: 'Decline rate',        value: '68.6%',     color: C.danger  },
            { icon: '🖥',  label: 'Device fingerprints', value: '3 unique',  color: C.warning },
            { icon: '📍', label: 'Zone',                value: 'Zone 3',    color: C.muted   },
          ].map(({ icon, label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11 }}>{icon}</span>
                <span style={{ fontFamily: C.mono, fontSize: 11, color: C.faint }}>{label}</span>
              </div>
              <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 600, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

    </aside>
  )
}
