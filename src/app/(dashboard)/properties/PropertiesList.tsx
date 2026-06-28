'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Home, Building, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type Property = {
  id: string
  property_name: string
  property_type: string
  address: string | null
  price: number | null
  publish_status: string
  sales_status: string
  owner_type: string
  company_project_flag: boolean
  memo: string | null
  sync_source: string
  assigned_user_id: string | null
  users: { full_name: string } | null
}

type Stats = {
  total: number
  active: number
  published: number
  underContract: number
}

interface Props {
  properties: Property[]
  stats: Stats
  currentUserId: string
}

const SALES_STATUS_LABELS: Record<string, string> = {
  active: '販売中',
  under_contract: '契約済',
  sold: '成約',
  withdrawn: '取下',
  other: 'その他',
}

const SALES_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  under_contract: 'bg-blue-100 text-blue-700 border-blue-200',
  sold: 'bg-gray-100 text-gray-600 border-gray-200',
  withdrawn: 'bg-red-100 text-red-600 border-red-200',
  other: 'bg-gray-100 text-gray-500 border-gray-200',
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  mansion: 'マンション',
  house: '戸建',
  land: '土地',
  building: 'ビル',
  other: 'その他',
}

function formatPrice(price: number | null) {
  if (!price) return '-'
  const man = Math.round(price / 10000)
  return `${man.toLocaleString()}万円`
}

export function PropertiesList({ properties, stats }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = properties.filter((p) => {
    if (search) {
      const q = search.toLowerCase()
      if (
        !p.property_name.toLowerCase().includes(q) &&
        !p.address?.toLowerCase().includes(q)
      ) return false
    }
    if (statusFilter !== 'all' && p.sales_status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">物件管理</h1>
        <span className="text-sm text-gray-400">Google スプレッドシートから同期</span>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '総物件数', value: stats.total, color: 'text-gray-800' },
          { label: '販売中', value: stats.active, color: 'text-green-600' },
          { label: '掲載中', value: stats.published, color: 'text-blue-600' },
          { label: '契約済', value: stats.underContract, color: 'text-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={cn('text-2xl font-bold', color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* フィルター */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="物件名・所在地検索"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'active', 'under_contract', 'sold'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border transition-colors',
                statusFilter === s
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              )}
            >
              {s === 'all' ? `全て (${properties.length})` : (SALES_STATUS_LABELS[s] ?? s)}
            </button>
          ))}
        </div>
      </div>

      {/* 物件一覧 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium">物件名</th>
                <th className="px-4 py-3 text-left font-medium">種別</th>
                <th className="px-4 py-3 text-left font-medium">所在地</th>
                <th className="px-4 py-3 text-left font-medium">価格</th>
                <th className="px-4 py-3 text-left font-medium">販売状況</th>
                <th className="px-4 py-3 text-left font-medium">掲載</th>
                <th className="px-4 py-3 text-left font-medium">担当者</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    <Building className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>物件がありません</p>
                    <p className="text-xs mt-1">Google スプレッドシートから同期してください</p>
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">{p.property_name}</div>
                        {p.company_project_flag && (
                          <span className="text-xs text-blue-600 bg-blue-50 rounded px-1">自社案件</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {PROPERTY_TYPE_LABELS[p.property_type] ?? p.property_type}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">
                    {p.address ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">
                    {formatPrice(p.price)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn('text-xs', SALES_STATUS_COLORS[p.sales_status] ?? '')}>
                      {SALES_STATUS_LABELS[p.sales_status] ?? p.sales_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {p.publish_status === 'published' ? (
                      <span className="text-green-600 bg-green-50 rounded px-1.5 py-0.5">掲載中</span>
                    ) : (
                      <span className="text-gray-400">非掲載</span>
                    )}
                    {p.sync_source === 'google_sheets' && (
                      <span className="ml-1 text-xs text-green-600 bg-green-50 rounded px-1">GS</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {p.users?.full_name ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
