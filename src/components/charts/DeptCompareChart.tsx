'use client'

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Legend, Tooltip
} from 'recharts'

interface DeptData {
  department: string
  progressRate: number   // 0〜100
  salesRate: number
  landingRate: number
}

interface Props {
  data: DeptData[]
  height?: number
}

export function DeptCompareChart({ data, height = 300 }: Props) {
  const radarData = [
    { subject: '利益進捗率' },
    { subject: '売上進捗率' },
    { subject: '着地達成率' },
  ].map((item) => {
    const row: Record<string, unknown> = { subject: item.subject }
    for (const d of data) {
      if (item.subject === '利益進捗率') row[d.department] = d.progressRate
      else if (item.subject === '売上進捗率') row[d.department] = d.salesRate
      else row[d.department] = d.landingRate
    }
    return row
  })

  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={radarData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: unknown) => [`${Number(v).toFixed(1)}%`]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {data.map((d, i) => (
          <Radar
            key={d.department}
            name={d.department}
            dataKey={d.department}
            stroke={COLORS[i % COLORS.length]}
            fill={COLORS[i % COLORS.length]}
            fillOpacity={0.15}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  )
}
