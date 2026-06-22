'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine, Cell
} from 'recharts'

interface MemberData {
  name: string
  契約売上: number
  入金売上: number
  目標: number
}

interface Props {
  data: MemberData[]
  height?: number
}

const fmt = (v: number) =>
  v >= 10_000_000 ? `${(v / 10_000_000).toFixed(1)}千万`
  : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}百万`
  : v >= 10_000 ? `${Math.round(v / 10_000)}万`
  : `${v}`

const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16']

export function MemberBarChart({ data, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v: unknown, name: unknown) => [`¥${Number(v).toLocaleString()}`, String(name ?? '')]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="契約売上" fill="#93c5fd" radius={[3, 3, 0, 0]} />
        <Bar dataKey="入金売上" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
