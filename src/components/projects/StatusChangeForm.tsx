'use client'

import { useState } from 'react'
import { changeProjectStatus } from '@/app/(dashboard)/projects/actions'
import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/types'

const STATUS_FLOW: Record<ProjectStatus, ProjectStatus[]> = {
  new:          ['negotiating', 'prospect_b', 'prospect_a', 'application', 'on_hold', 'lost'],
  negotiating:  ['prospect_b', 'prospect_a', 'application', 'on_hold', 'lost'],
  prospect_b:   ['prospect_a', 'application', 'negotiating', 'on_hold', 'lost'],
  prospect_a:   ['application', 'negotiating', 'prospect_b', 'on_hold', 'lost'],
  application:  ['contracted', 'prospect_a', 'on_hold', 'lost', 'cancelled'],
  contracted:   ['delivered', 'on_hold', 'cancelled'],
  delivered:    ['invoiced', 'contracted'],
  invoiced:     ['paid', 'delivered'],
  paid:         [],
  on_hold:      ['negotiating', 'prospect_b', 'prospect_a', 'lost', 'cancelled'],
  lost:         ['new'],
  cancelled:    [],
}

interface Props {
  projectId: string
  currentStatus: ProjectStatus
  isLocked: boolean
  pendingFields: string[]
}

export function StatusChangeForm({ projectId, currentStatus, isLocked, pendingFields }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showReason, setShowReason] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | null>(null)
  const [reason, setReason] = useState('')

  const nextStatuses = STATUS_FLOW[currentStatus] ?? []
  const hasStatusPending = pendingFields.includes('status')

  async function handleStatusChange() {
    if (!selectedStatus) return
    setLoading(true)
    setError('')

    const result = await changeProjectStatus(projectId, selectedStatus, reason)

    if (result?.error) {
      setError(result.error)
    } else if (result?.pending) {
      setMessage(result.message ?? '承認申請を送信しました')
    } else {
      setMessage('ステータスを更新しました')
    }

    setLoading(false)
    setShowReason(false)
    setSelectedStatus(null)
    setReason('')
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-500">ステータス変更</h2>

      {hasStatusPending && (
        <div className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-2">
          ステータス変更の承認申請中です
        </div>
      )}

      {isLocked ? (
        <p className="text-xs text-gray-400">月次締め済みのため変更できません</p>
      ) : nextStatuses.length === 0 ? (
        <p className="text-xs text-gray-400">これ以上変更できません</p>
      ) : (
        <div className="space-y-2">
          {nextStatuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setSelectedStatus(status)
                setShowReason(true)
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 text-sm hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              → {PROJECT_STATUS_LABELS[status]}
              {status === 'cancelled' && (
                <span className="ml-2 text-xs text-red-500">（承認必須）</span>
              )}
            </button>
          ))}
        </div>
      )}

      {showReason && selectedStatus && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700">
            「{PROJECT_STATUS_LABELS[selectedStatus]}」へ変更します
          </p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">変更理由（任意）</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStatusChange}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '処理中...' : '確定する'}
            </button>
            <button
              type="button"
              onClick={() => { setShowReason(false); setSelectedStatus(null) }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              戻る
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && <p className="text-xs text-green-600">{message}</p>}
    </div>
  )
}
