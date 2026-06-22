'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Check, Users } from 'lucide-react'

const SOURCES = [
  { value: 'portal',   label: 'ポータル' },
  { value: 'sns',      label: 'SNS' },
  { value: 'referral', label: '紹介' },
  { value: 'line',     label: 'LINE' },
  { value: 'flyer',    label: 'チラシ・DM' },
  { value: 'other',    label: 'その他' },
]

function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(monday: string): string {
  const d = new Date(monday)
  const sun = new Date(d)
  sun.setDate(d.getDate() + 6)
  const fmt = (dt: Date) => `${dt.getMonth() + 1}/${dt.getDate()}`
  return `${d.getFullYear()}年 ${fmt(d)}（月）〜 ${fmt(sun)}（日）`
}

interface Props {
  myUserId: string
  myName: string
  isManager: boolean
  staffList: { id: string; full_name: string }[]
}

export function InquiryForm({ myUserId, myName, isManager, staffList }: Props) {
  const [selectedUserId, setSelectedUserId] = useState(myUserId)
  const [week, setWeek] = useState(() => getMondayOf(new Date()))
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [newClientCount, setNewClientCount] = useState<number>(0)
  const [loadingNew, setLoadingNew] = useState(false)

  const prevWeek = () => {
    const d = new Date(week)
    d.setDate(d.getDate() - 7)
    setWeek(d.toISOString().slice(0, 10))
  }
  const nextWeek = () => {
    const d = new Date(week)
    d.setDate(d.getDate() + 7)
    setWeek(d.toISOString().slice(0, 10))
  }

  const load = useCallback(async () => {
    const res = await fetch(`/api/inquiry-reports?userId=${selectedUserId}&from=${week}&to=${week}`)
    if (!res.ok) return
    const data: { source: string; count: number }[] = await res.json()
    const map: Record<string, number> = {}
    for (const d of data) map[d.source] = d.count
    setCounts(map)
  }, [selectedUserId, week])

  const loadNewClients = useCallback(async () => {
    setLoadingNew(true)
    const weekEnd = new Date(week)
    weekEnd.setDate(weekEnd.getDate() + 6)
    // 案件の created_at がその週の範囲内かつ担当者が selectedUserId のものをカウント
    const res = await fetch(`/api/projects/count?userId=${selectedUserId}&from=${week}&to=${weekEnd.toISOString().slice(0, 10)}`)
    if (res.ok) {
      const d = await res.json()
      setNewClientCount(d.count ?? 0)
    }
    setLoadingNew(false)
  }, [selectedUserId, week])

  useEffect(() => {
    load()
    loadNewClients()
  }, [load, loadNewClients])

  async function save(source: string, count: number) {
    setSaving(source)
    try {
      const res = await fetch('/api/inquiry-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUserId, report_week: week, source, count }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? '保存に失敗しました')
        return
      }
      setSaved(source)
      setTimeout(() => setSaved(null), 2000)
    } finally {
      setSaving(null)
    }
  }

  const totalInquiry = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5">
      {/* 対象者選択（管理者のみ） */}
      {isManager && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <label className="text-sm font-medium text-blue-700">対象者：</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="border border-blue-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 週選択 */}
      <div className="flex items-center gap-3">
        <button onClick={prevWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-gray-700 min-w-[240px] text-center">
          {formatWeekLabel(week)}
        </span>
        <button onClick={nextWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">新規接客（案件登録数）</p>
          <div className="flex items-end gap-1">
            {loadingNew ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <span className="text-3xl font-bold text-blue-600">{newClientCount}</span>
            )}
            <span className="text-sm text-gray-500 mb-1">件</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">この週に登録された案件数</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">総反響件数（手入力合計）</p>
          <div className="flex items-end gap-1">
            <span className="text-3xl font-bold text-purple-600">{totalInquiry}</span>
            <span className="text-sm text-gray-500 mb-1">件</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">全経路の合計</p>
        </div>
      </div>

      {/* 経路別入力 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">反響件数（経路別）</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {SOURCES.map((s) => {
            const val = counts[s.value] ?? 0
            const isSaving = saving === s.value
            const isSaved = saved === s.value
            return (
              <div key={s.value} className="flex items-center px-5 py-3 gap-4">
                <span className="w-28 text-sm font-medium text-gray-700">{s.label}</span>
                <input
                  type="number"
                  min={0}
                  value={val}
                  onChange={(e) => setCounts((prev) => ({ ...prev, [s.value]: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">件</span>
                <button
                  onClick={() => save(s.value, val)}
                  disabled={!!saving}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isSaved ? (
                    <><Check className="w-3.5 h-3.5" />保存済</>
                  ) : (
                    '保存'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
