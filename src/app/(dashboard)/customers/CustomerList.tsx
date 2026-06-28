'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Users, AlertCircle, Calendar, Phone, Star, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  line_name: string | null
  rank: string
  source: string | null
  customer_type: string
  status: string
  first_contact_status: string
  last_contact_date: string | null
  next_action_date: string | null
  notes: string | null
  sync_source: string
  assigned_user_id: string | null
  users: { full_name: string } | null
}

type Stats = {
  rankA: number
  noContact3Days: number
  notContacted: number
  noNextDate: number
  total: number
}

interface Props {
  customers: Customer[]
  stats: Stats
  currentUserId: string
}

const RANK_LABELS: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' }
const RANK_COLORS: Record<string, string> = {
  a: 'bg-red-100 text-red-700 border-red-200',
  b: 'bg-orange-100 text-orange-700 border-orange-200',
  c: 'bg-blue-100 text-blue-700 border-blue-200',
  d: 'bg-gray-100 text-gray-600 border-gray-200',
}
const CONTACT_STATUS_LABELS: Record<string, string> = {
  not_contacted: '未接触',
  contacted: '接触済',
  meeting_set: '面談設定済',
}

export function CustomerList({ customers, stats }: Props) {
  const [search, setSearch] = useState('')
  const [rankFilter, setRankFilter] = useState('all')
  const [contactFilter, setContactFilter] = useState('all')
  const today = new Date().toISOString().split('T')[0]
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const filtered = customers.filter((c) => {
    if (search) {
      const q = search.toLowerCase()
      if (
        !c.name.toLowerCase().includes(q) &&
        !c.phone?.includes(q) &&
        !c.email?.toLowerCase().includes(q)
      ) return false
    }
    if (rankFilter !== 'all' && c.rank !== rankFilter) return false
    if (contactFilter === 'not_contacted' && c.first_contact_status !== 'not_contacted') return false
    if (contactFilter === 'no_contact_3days' &&
      !(c.last_contact_date && c.last_contact_date <= threeDaysAgo)) return false
    if (contactFilter === 'no_next_date' && c.next_action_date) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">顧客管理</h1>
        <Link href="/customers/new">
          <Button size="sm">+ 顧客登録</Button>
        </Link>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Aランク顧客"
          value={stats.rankA}
          icon={<Star className="w-4 h-4 text-red-500" />}
          onClick={() => setRankFilter(rankFilter === 'a' ? 'all' : 'a')}
          active={rankFilter === 'a'}
          color="red"
        />
        <StatCard
          label="3日以上接触なし"
          value={stats.noContact3Days}
          icon={<AlertCircle className="w-4 h-4 text-orange-500" />}
          onClick={() => setContactFilter(contactFilter === 'no_contact_3days' ? 'all' : 'no_contact_3days')}
          active={contactFilter === 'no_contact_3days'}
          color="orange"
        />
        <StatCard
          label="未接触"
          value={stats.notContacted}
          icon={<Phone className="w-4 h-4 text-blue-500" />}
          onClick={() => setContactFilter(contactFilter === 'not_contacted' ? 'all' : 'not_contacted')}
          active={contactFilter === 'not_contacted'}
          color="blue"
        />
        <StatCard
          label="次回未設定"
          value={stats.noNextDate}
          icon={<Calendar className="w-4 h-4 text-purple-500" />}
          onClick={() => setContactFilter(contactFilter === 'no_next_date' ? 'all' : 'no_next_date')}
          active={contactFilter === 'no_next_date'}
          color="purple"
        />
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="名前・電話・メール検索"
            className="pl-9"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        <Select value={rankFilter} onValueChange={(v) => setRankFilter(v ?? 'all')}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="ランク" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ランク</SelectItem>
            <SelectItem value="a">Aランク</SelectItem>
            <SelectItem value="b">Bランク</SelectItem>
            <SelectItem value="c">Cランク</SelectItem>
            <SelectItem value="d">Dランク</SelectItem>
          </SelectContent>
        </Select>
        {(search || rankFilter !== 'all' || contactFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => {
            setSearch(''); setRankFilter('all'); setContactFilter('all')
          }}>
            クリア
          </Button>
        )}
        <span className="flex items-center text-sm text-gray-500">
          {filtered.length} 件
        </span>
      </div>

      {/* 顧客一覧 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium">ランク</th>
                <th className="px-4 py-3 text-left font-medium">顧客名</th>
                <th className="px-4 py-3 text-left font-medium">連絡先</th>
                <th className="px-4 py-3 text-left font-medium">接触状況</th>
                <th className="px-4 py-3 text-left font-medium">最終接触</th>
                <th className="px-4 py-3 text-left font-medium">次回予定</th>
                <th className="px-4 py-3 text-left font-medium">担当者</th>
                <th className="px-4 py-3 text-left font-medium">出所</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    顧客が見つかりません
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const isOverdue = c.next_action_date && c.next_action_date < today
                const noContact3 = c.last_contact_date && c.last_contact_date <= threeDaysAgo
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      'hover:bg-gray-50 transition-colors',
                      c.rank === 'a' && 'bg-red-50/30'
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border',
                        RANK_COLORS[c.rank] ?? RANK_COLORS.c
                      )}>
                        {RANK_LABELS[c.rank] ?? c.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                        {c.name}
                      </Link>
                      {c.sync_source === 'google_sheets' && (
                        <span className="ml-1 text-xs text-green-600 bg-green-50 rounded px-1">GS</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{c.phone ?? '-'}</div>
                      <div className="text-xs text-gray-400">{c.email ?? ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn(
                        'text-xs',
                        c.first_contact_status === 'not_contacted' && 'border-gray-300 text-gray-500'
                      )}>
                        {CONTACT_STATUS_LABELS[c.first_contact_status] ?? c.first_contact_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs', noContact3 && 'text-orange-600 font-medium')}>
                        {c.last_contact_date ?? '-'}
                        {noContact3 && ' ⚠'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs', isOverdue && 'text-red-600 font-medium')}>
                        {c.next_action_date ?? '-'}
                        {isOverdue && ' 期限切れ'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {c.users?.full_name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {c.source ?? '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon, onClick, active, color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  onClick?: () => void
  active?: boolean
  color: string
}) {
  const borderColor = {
    red: 'border-red-200',
    orange: 'border-orange-200',
    blue: 'border-blue-200',
    purple: 'border-purple-200',
  }[color] ?? 'border-gray-200'

  return (
    <button
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border p-4 text-left transition-all hover:shadow-sm w-full',
        active ? `${borderColor} ring-1 ring-offset-0` : 'border-gray-200'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </button>
  )
}
