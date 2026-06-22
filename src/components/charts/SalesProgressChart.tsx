'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'

interface DataPoint {
  name: string
  契約売上: number
  入金済売上: number
  目標: number
}

interface Props {
  data: DataPoint[]
  height?: number
}

const formatMillions = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`

export function SalesProgressChart({ data, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatMillions} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v: unknown, name: unknown) => [`¥${Number(v).toLocaleString()}`, String(name ?? '')]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="入金済売上" fill="#22c55e" radius={[3, 3, 0, 0]} />
        <Bar dataKey="契約売上"   fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
