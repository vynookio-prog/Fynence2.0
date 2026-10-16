'use client'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Breakdown, EquityPoint } from '@/lib/domain/analytics'

const axis = { fill: '#718087', fontSize: 10 }
const tooltip = { background: '#10191e', border: '1px solid rgba(148,163,184,.15)', borderRadius: 10, color: '#e8f0f2' }
const grid = 'rgba(148,163,184,.09)'

export function EquityChart({ data }: { data: EquityPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#35d39a" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#35d39a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axis} minTickGap={24} />
        <YAxis axisLine={false} tickLine={false} tick={axis} />
        <Tooltip contentStyle={tooltip} />
        <Area dataKey="equity" name="Equity" type="monotone" stroke="#35d39a" strokeWidth={2} fill="url(#equityFill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function DrawdownChart({ data }: { data: EquityPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axis} minTickGap={24} />
        <YAxis axisLine={false} tickLine={false} tick={axis} />
        <Tooltip contentStyle={tooltip} />
        <Bar dataKey="drawdown" name="Drawdown" fill="#ff6b75" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function BreakdownTable({ title, rows }: { title: string; rows: Breakdown[] }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Belum ada data.</p>
      ) : (
        <table className="mt-4 w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted">
              <th className="pb-2 font-medium">Nama</th>
              <th className="pb-2 text-right font-medium">Trade</th>
              <th className="pb-2 text-right font-medium">Win</th>
              <th className="pb-2 text-right font-medium">Hasil bersih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.slice(0, 8).map(row => (
              <tr key={row.key}>
                <td className="py-2.5 pr-2">{row.key}</td>
                <td className="py-2.5 text-right font-mono tabular text-muted">{row.trades}</td>
                <td className="py-2.5 text-right font-mono tabular text-muted">{row.winRate == null ? '—' : `${row.winRate}%`}</td>
                <td className={`py-2.5 text-right font-mono tabular ${Number(row.netPnl) >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {Number(row.netPnl) >= 0 ? '+' : ''}{row.netPnl}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
