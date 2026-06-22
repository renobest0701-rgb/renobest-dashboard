'use client'

import { useState } from 'react'
import { updateClosingStatus } from './actions'
import type { ClosingStatus } from '@/types'

const NEXT_STATUS: Partial<Record<ClosingStatus, { label: string; next: ClosingStatus; color: string }>> = {
  open:      { label: '仮締めする', next: 'temporary', color: 'bg-amber-500 hover:bg-amber-600 text-white' },
  temporary: { label: '本締めする', next: 'final',     color: 'bg-green-600 hover:bg-green-700 text-white' },
  final:     { label: '修正する',   next: 'amending',  color: 'bg-blue-500 hover:bg-blue-600 text-white' },
  amending:  { label: '修正済にする', next: 'amended',  color: 'bg-purple-500 hover:bg-purple-600 text-white' },
}

interface Props {
  closingId:    string | null
  status:       ClosingStatus
  year:         number
  month:        number
  departmentId: string | null
}

export function ClosingActions({ closingId, status, year, month, departmentId }: Props) {
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const transition = NEXT_STATUS[status]

  if (!transition) return null

  const isFinal = transition.next === 'final'

  async function handleSubmit(fd: FormData) {
    setLoading(true)
    const res = await updateClosingStatus(fd)
    setLoading(false)
    setConfirm(false)
    if (res?.error) alert(res.error)
  }

  if (confirm) {
    return (
      <div className="space-y-1.5">
        {isFinal && (
          <p className="text-xs text-red-600 font-medium">本締め後は案件が編集ロックされます</p>
        )}
        <form action={handleSubmit} className="flex flex-col gap-1">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="departmentId" value={departmentId ?? ''} />
          <input type="hidden" name="newStatus" value={transition.next} />
          {closingId && <input type="hidden" name="closingId" value={closingId} />}
          <button type="submit" disabled={loading}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${transition.color}`}>
            {loading ? '処理中...' : '確定する'}
          </button>
          <button type="button" onClick={() => setConfirm(false)}
            className="px-3 py-1.5 rounded-lg text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
            キャンセル
          </button>
        </form>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${transition.color}`}>
      {transition.label}
    </button>
  )
}
