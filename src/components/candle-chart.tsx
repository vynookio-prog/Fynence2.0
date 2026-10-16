'use client'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Candle } from '@/lib/market/provider'

const axis = { fill: '#718087', fontSize: 10 }
const tooltip = { background: '#10191e', border: '1px solid rgba(148,163,184,.15)', borderRadius: 10, color: '#e8f0f2' }
const grid = 'rgba(148,163,184,.09)'

/**
 * Daily close history for a stored instrument.
 *
 * A line of closes rather than a candlestick chart, on purpose: drawing OHLC
 * candles at this width would imply intraday structure that daily bars do not
 * carry. The close is the one number the stored bars actually support.
 *
 * Recharts needs numbers, so the string prices are parsed here — at the drawing
 * boundary only. Nothing upstream converts a money string to a float, and this
 * value never flows back into a calculation.
 */
export function CandleChart({ data }: { data: Candle[] }) {
  const points = data.map(bar => ({
    date: bar.time.slice(0, 10),
    close: Number(bar.close),
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 8, right: 6, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="closeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#35d39a" stopOpacity={0.16} />
            <stop offset="100%" stopColor="#35d39a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axis} minTickGap={30} />
        {/* domain auto: a fixed range would clip a price series into a misleading flat line. */}
        <YAxis axisLine={false} tickLine={false} tick={axis} domain={['auto', 'auto']} width={56} />
        <Tooltip contentStyle={tooltip} />
        <Area dataKey="close" name="Close" type="monotone" stroke="#35d39a" strokeWidth={1.5} fill="url(#closeFill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
