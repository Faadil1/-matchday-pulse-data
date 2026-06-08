import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  Cell, LabelList, ReferenceArea, ResponsiveContainer,
} from 'recharts'

/*
  TransactionDashboard — restyled to the Matchday Pulse system (Tactical Telemetry × Quiet Luxury).
  Repo path: src/components/TransactionDashboard.jsx
  ------------------------------------------------------------------
  ALL logic is preserved verbatim: open/collapse, entrance animation, the
  idle→streaming→done phase reactivity (the dashboard reacts as the agent investigates),
  the recharts data and structure. Only the visual language changed — glows / gradients /
  drop-shadows / emoji removed; hard corners; red reserved for the fraud signal; the old
  "scanning glow" is now a hairline + red state shift. Requires the shared stylesheet +
  className="mp-app" on the App root (it loads the fonts and tokens used below).
*/

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

// ── Design tokens (Tactical Telemetry × Quiet Luxury) ─────────────────────────
const C = {
  bg:      '#0A0A0A',
  surface: '#0E0E0E',
  raised:  '#131313',
  border:  'rgba(234,234,234,0.14)',
  borderSoft: 'rgba(234,234,234,0.07)',
  accent:  '#EAEAEA',          // neutral bars (monochrome ink)
  danger:  '#E5251C',          // fraud signal — the only chromatic accent
  dangerHi:'#FF5247',
  warning: '#E5251C',          // fraud actors → red
  success: '#EAEAEA',          // "live" → ink (monochrome discipline)
  text:    '#EAEAEA',
  muted:   '#A6A299',
  faint:   '#8C8676',
  mono:    "'Spline Sans Mono', ui-monospace, monospace",
  sans:    "'Instrument Sans', system-ui, sans-serif",
}

// ── Recharts custom pieces ────────────────────────────────────────────────────

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const isSpike = HOURLY.find(h => h.hour === label)?.isSpike
  return (
    <div style={{
      background:   C.raised,
      border:       `1px solid ${isSpike ? C.danger : C.border}`,
      borderRadius: 0,
      padding:      '8px 12px',
      fontFamily:   C.mono,
      fontSize:     12,
    }}>
      <div style={{ color: C.faint, marginBottom: 2, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ color: isSpike ? C.danger : C.text, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
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
        fontFamily={C.mono} letterSpacing="1.5">SPIKE</text>
      <text x={cx} y={y - 6} textAnchor="middle" fill={C.danger} fontSize={11}
        fontFamily={C.mono} fontWeight="600">273</text>
    </g>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{
        color: C.muted, fontSize: 10, fontFamily: C.mono,
        letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
      }}>
        [ {children} ]
      </span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function Stat({ value, label, color }) {
  return (
    <div style={{
      flex: 1, padding: '13px 12px', background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: 0,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <span style={{
        fontFamily: C.mono, fontSize: 22, fontWeight: 500,
        color: color ?? C.text, lineHeight: 1, letterSpacing: '-0.015em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
      <span style={{
        color: C.faint, fontSize: 10, fontFamily: C.mono,
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  )
}

// ── Horizontal zone bar ───────────────────────────────────────────────────────
function ZoneBar({ name, declines, isHot, pct, animated, phase, isFlashing }) {
  const fillWidth   = animated ? `${(declines / MAX_ZONE_DECLINES) * 100}%` : '0%'
  const isActive    = isHot && phase === 'streaming'   // agent is looking at it
  const isConfirmed = isHot && phase === 'done'        // fraud confirmed

  // Active: a restrained red hairline outline (no glow/haze).
  const containerStyle = {
    padding: '2px 0',
    outline: isActive ? `1px solid ${C.danger}` : '1px solid transparent',
    outlineOffset: 3,
    transition: 'outline-color 0.4s ease',
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontFamily: C.mono,
          fontSize:   12,
          fontWeight: isHot ? 600 : 400,
          color:      isHot ? C.danger : C.muted,
          animation:  isActive ? 'mp-breathe 1.6s ease-in-out infinite' : 'none',
          display:    'inline-block',
          letterSpacing: '0.02em',
        }}>
          {name}
        </span>
        <div style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
          <span style={{ fontFamily: C.mono, fontSize: 12, color: isHot ? C.danger : C.text, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            {declines}
          </span>
          <span style={{ fontFamily: C.mono, fontSize: 10, color: C.faint }}>{pct}%</span>
        </div>
      </div>

      <div style={{ height: 5, background: C.bg, borderRadius: 0, overflow: 'hidden' }}>
        <div style={{
          height:     '100%',
          width:      fillWidth,
          background: isHot ? C.danger : C.accent,
          opacity:    isHot ? 1 : (isConfirmed ? 0.35 : 0.4),
          borderRadius: 0,
          transition: 'width 0.9s cubic-bezier(0.23, 1, 0.32, 1)',
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
      borderRight: `1px solid ${C.border}`, background: C.surface,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 16, gap: 14,
    }}>
      <button onClick={onOpen} title="Open dashboard" style={{
        width: 28, height: 28, borderRadius: 0, background: C.raised,
        border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, lineHeight: 1, fontFamily: C.mono,
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.muted; e.currentTarget.style.color = C.text }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}
      >
        ›
      </button>
      <span style={{
        color: C.faint, fontSize: 9, fontFamily: C.mono, letterSpacing: '0.14em',
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
  const [isFlashing, setFlashing] = useState(false)   // one-shot signal on done

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
      // Fire the one-shot confirm signal
      setFlashing(true)
      const t = setTimeout(() => setFlashing(false), 1000)
      return () => clearTimeout(t)
    }
  }, [phase])

  const isStreaming  = phase === 'streaming'
  const isDone       = phase === 'done'

  // State-aware spike caption
  const spikeCaption = isStreaming
    ? '[ scanning ] 17:30–18:00 UTC'
    : isDone
      ? '[ confirmed ] 17:30–18:00 UTC'
      : '17:30–18:00 UTC spike detected'

  if (!open) return <CollapsedStrip onOpen={() => setOpen(true)} />

  return (
    <aside style={{
      width: 300, minWidth: 300, flexShrink: 0,
      borderRight: `1px solid ${C.border}`, background: C.surface,
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
      gap: 24, padding: '18px 16px 32px',
    }} className="feed-scroll">

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{
            width: 6, height: 6, borderRadius: 0, background: C.text,
            animation: 'mp-breathe 2s ease-in-out infinite', flexShrink: 0,
          }} />
          <span style={{
            fontFamily: C.mono, fontSize: 10, color: C.text,
            letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 500,
          }}>
            Live
          </span>
          <span style={{ color: C.faint, fontSize: 10, fontFamily: C.mono, letterSpacing: '0.06em' }}>· Match day</span>
        </div>
        <button onClick={() => setOpen(false)} title="Collapse dashboard" style={{
          width: 24, height: 24, borderRadius: 0, background: 'transparent',
          border: `1px solid ${C.border}`, color: C.faint, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, lineHeight: 1, flexShrink: 0, fontFamily: C.mono,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.muted; e.currentTarget.style.color = C.text }}
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
          padding: '11px 12px', background: C.surface,
          border: `1px solid ${C.border}`, borderRadius: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <div>
              <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 500, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                {APPROVED.toLocaleString()}
              </div>
              <div style={{ color: C.faint, fontSize: 10, fontFamily: C.mono, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>Approved</div>
            </div>
            <div style={{ width: 1, background: C.border }} />
            <div>
              <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 500, color: C.danger, fontVariantNumeric: 'tabular-nums' }}>{DECLINED}</div>
              <div style={{ color: C.faint, fontSize: 10, fontFamily: C.mono, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>Declined</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: C.mono, fontSize: 13, color: C.muted }}>6 zones</div>
            <div style={{ fontFamily: C.mono, fontSize: 11, color: C.faint, marginTop: 3 }}>Toronto</div>
          </div>
        </div>
      </div>

      {/* ── Hourly decline chart ── */}
      <div>
        <SectionLabel>Hourly Decline Pattern</SectionLabel>

        <div style={{
          padding: '12px 8px 4px', background: C.surface,
          border: `1px solid ${isStreaming || isDone ? C.danger : C.border}`,
          borderRadius: 0,
          transition: 'border-color 0.5s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, paddingLeft: 4 }}>
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: 0,
              background: C.danger,
              animation: isStreaming ? 'mp-breathe 1.2s ease-in-out infinite' : 'none',
            }} />
            <span style={{ fontFamily: C.mono, fontSize: 10, color: C.danger, letterSpacing: '0.04em' }}>
              {spikeCaption}
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
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(234,234,234,0.04)' }} />

              {/* Spike-column highlight while the agent works (subtle, no glow) */}
              {phase !== 'idle' && (
                <ReferenceArea
                  x1="17h" x2="17h"
                  fill={C.danger}
                  fillOpacity={isStreaming ? 0.1 : 0.05}
                  stroke={isStreaming ? C.danger : 'none'}
                  strokeOpacity={0.3}
                  strokeDasharray="3 3"
                />
              )}

              <Bar dataKey="declines" radius={[0, 0, 0, 0]} animationDuration={900} animationEasing="ease-out">
                {HOURLY.map(entry => (
                  <Cell
                    key={entry.hour}
                    fill={entry.isSpike ? C.danger : C.accent}
                    fillOpacity={entry.isSpike ? 1 : 0.4}
                    filter="none"
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
          padding: '13px 14px', background: C.surface,
          border: `1px solid ${isStreaming || isDone ? C.danger : C.border}`,
          borderRadius: 0,
          transition: 'border-color 0.5s ease',
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
            marginTop: 4, padding: '8px 11px',
            background: 'rgba(229,37,28,0.10)',
            border: `1px solid ${C.danger}`, borderRadius: 0,
          }}>
            <span style={{ fontFamily: C.mono, fontSize: 10, color: C.dangerHi, letterSpacing: '0.02em' }}>
              Zone3 accounts for <strong style={{ color: C.dangerHi, fontWeight: 600 }}>48.6%</strong> of all declines
            </span>
          </div>
        </div>
      </div>

      {/* ── Signal summary ── */}
      <div>
        <SectionLabel>Signal Summary</SectionLabel>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 0,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 0,
        }}>
          {[
            { label: 'Volume spike',        value: '24×',      color: C.danger },
            { label: 'Decline rate',        value: '68.6%',    color: C.danger },
            { label: 'Device fingerprints', value: '3 unique', color: C.danger },
            { label: 'Zone',                value: 'Zone 3',   color: C.muted  },
          ].map(({ label, value, color }, i, arr) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 14px',
              borderBottom: i < arr.length - 1 ? `1px solid ${C.borderSoft}` : 'none',
            }}>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.muted, letterSpacing: '0.02em' }}>{label}</span>
              <span style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 500, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

    </aside>
  )
}
