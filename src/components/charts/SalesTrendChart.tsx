'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'

interface DataPoint {
  month: string
  入金売上: number
  契約売上: number
  目標?: number
}

interface Props {
  data: DataPoint[]
  salesTarget?: number
  height?: number
}

const fmt = (v: number) =>
  v >= 10_000_000 ? `${(v / 10_000_000).toFixed(1)}千万`
  : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}百万`
  : v >= 10_000 ? `${Math.round(v / 10_000)}万`
  : `${v}`

export function SalesTrendChart({ data, salesTarget, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v: unknown, name: unknown) => [`¥${Number(v).toLocaleString()}`, String(name ?? '')]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {salesTarget && (
          <ReferenceLine y={salesTarget} stroke="#f59e0b" strokeDasharray="4 4"
            label={{ value: '目標', fontSize: 10, position: 'insideTopRight' }} />
        )}
        <Bar dataKey="契約売上" fill="#93c5fd" radius={[3, 3, 0, 0]} />
        <Bar dataKey="入金売上" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
