'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface InquiryData {
  name: string
  反響数: number
  接客数: number
  契約数: number
}

interface Props {
  data: InquiryData[]
  height?: number
}

export function InquiryChart({ data, height = 240 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip labelStyle={{ fontWeight: 600 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="反響数" fill="#818cf8" radius={[3, 3, 0, 0]} />
        <Bar dataKey="接客数" fill="#34d399" radius={[3, 3, 0, 0]} />
        <Bar dataKey="契約数" fill="#f59e0b" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
