'use client'

import { useState } from 'react'
import { requestImportantChange } from '@/app/(dashboard)/projects/actions'
import { AlertTriangle } from 'lucide-react'

const IMPORTANT_FIELDS = [
  { key: 'sales_amount',      label: '売上金額',    type: 'number' },
  { key: 'cost_planned',      label: '計画原価',    type: 'number' },
  { key: 'cost_confirmed',    label: '確定原価',    type: 'number' },
  { key: 'contract_date',     label: '契約日',      type: 'date' },
  { key: 'payment_plan_date', label: '入金予定日',  type: 'date' },
]

interface Props {
  projectId:     string
  currentValues: Record<string, string | number | null>
  pendingFields: string[]
}

export function ImportantChangeForm({ projectId, currentValues, pendingFields }: Props) {
  const [open, setOpen] = useState(false)
  const [fieldKey, setFieldKey] = useState(IMPORTANT_FIELDS[0].key)
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const selectedField = IMPORTANT_FIELDS.find((f) => f.key === fieldKey)!
  const oldValue = String(currentValues[fieldKey] ?? '')
  const isPending = pendingFields.includes(fieldKey)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newValue || !reason) return
    setLoading(true)
    const res = await requestImportantChange(projectId, fieldKey, oldValue, newValue, reason)
    setLoading(false)
    if (!res?.error) {
      setDone(true)
      setOpen(false)
      setNewValue('')
      setReason('')
    } else {
      alert(res.error)
    }
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
        承認申請を送信しました。管理者の承認をお待ちください。
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <h2 className="text-sm font-semibold text-gray-700">重要項目の変更申請</h2>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        金額・日付など重要な項目の変更は管理者の承認が必要です
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full px-4 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors">
          変更申請する
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">変更する項目</label>
            <select
              value={fieldKey}
              onChange={(e) => { setFieldKey(e.target.value); setNewValue('') }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {IMPORTANT_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>

          {isPending && (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              この項目は現在承認申請中です
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">現在の値</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              {oldValue || '未設定'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              新しい値 <span className="text-red-500">*</span>
            </label>
            <input
              type={selectedField.type}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              変更理由 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={2}
              placeholder="変更が必要な理由を具体的に入力してください"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={loading || isPending}
              className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
              {loading ? '送信中...' : '申請する'}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
