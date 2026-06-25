'use client'

import { useState } from 'react'
import { FLOW_TYPE_LABELS, type FlowType } from '@/types'
import { updateFlowInfo } from '@/app/(dashboard)/projects/actions'

function getFlowDetailPlaceholder(flowType: FlowType): string {
  const map: Partial<Record<FlowType, string>> = {
    referral:             '紹介者名・紹介元',
    general_contractor:   '元請会社名',
    realty_mediation:     '仲介会社名',
    seller:               '売主名',
    new_build_consignment:'販売委託元',
    vr_consignment:       '制作委託元',
    joint:                '共同会社名',
    ad_agency:            '広告代理店名',
    internal:             '社内部門・担当',
  }
  return map[flowType] ?? '詳細・備考'
}

interface Props {
  projectId: string
  flowType: string
  flowDetail: string
  isLocked: boolean
}

export function FlowEditor({ projectId, flowType, flowDetail, isLocked }: Props) {
  const [editing, setEditing] = useState(false)
  const [currentFlowType, setCurrentFlowType] = useState<FlowType>(flowType as FlowType)
  const [currentDetail, setCurrentDetail] = useState(flowDetail)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const result = await updateFlowInfo(projectId, currentFlowType, currentDetail)
    setSaving(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setEditing(false)
    }
  }

  const handleCancel = () => {
    setCurrentFlowType(flowType as FlowType)
    setCurrentDetail(flowDetail)
    setEditing(false)
    setError('')
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500">商流情報</h2>
        {!editing && !isLocked && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            編集
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">商流区分</label>
            <select
              value={currentFlowType}
              onChange={(e) => setCurrentFlowType(e.target.value as FlowType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(FLOW_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">商流詳細</label>
            <input
              value={currentDetail}
              onChange={(e) => setCurrentDetail(e.target.value)}
              placeholder={getFlowDetailPlaceholder(currentFlowType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500">商流区分</span>
            <span className="font-medium">{FLOW_TYPE_LABELS[currentFlowType] ?? currentFlowType}</span>
          </div>
          {currentDetail && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-500">商流詳細</span>
              <span className="font-medium">{currentDetail}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
