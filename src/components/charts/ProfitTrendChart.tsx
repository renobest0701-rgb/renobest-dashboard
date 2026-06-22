'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'

interface DataPoint {
  month: string
  実現利益: number
  契約利益: number
  着地予測?: number
}

interface Props {
  data: DataPoint[]
  profitTarget?: number
  height?: number
}

const formatMillions = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K`
  : `${v}`

export function ProfitTrendChart({ data, profitTarget, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatMillions} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v: unknown, name: unknown) => [`¥${Number(v).toLocaleString()}`, String(name ?? '')]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {profitTarget && (
          <ReferenceLine y={profitTarget} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '目標', fontSize: 10 }} />
        )}
        <Line type="monotone" dataKey="実現利益" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="契約利益" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        {data.some((d) => d.着地予測 !== undefined) && (
          <Line type="monotone" dataKey="着地予測" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
