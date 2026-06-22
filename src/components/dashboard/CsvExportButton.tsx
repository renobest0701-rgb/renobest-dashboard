'use client'

import { Download } from 'lucide-react'

interface Props {
  data: Record<string, string | number>[]
  filename: string
}

export function CsvExportButton({ data, filename }: Props) {
  function handleExport() {
    if (!data.length) return

    const headers = Object.keys(data[0])
    const rows = data.map((row) =>
      headers.map((h) => {
        const v = row[h]
        const s = String(v ?? '')
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s
      }).join(',')
    )

    const bom = '﻿'
    const csv = bom + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <Download className="w-4 h-4" />
      CSV出力
    </button>
  )
}
