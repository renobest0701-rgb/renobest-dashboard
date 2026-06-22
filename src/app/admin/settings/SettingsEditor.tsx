'use client'

import { useState } from 'react'
import { Loader2, Check, Eye, EyeOff, AlertCircle } from 'lucide-react'

interface FieldConfig {
  label: string
  visible: boolean
  required: boolean
}

interface WeightConfig {
  rank: string
  weight: number
}

interface Props {
  projectFields: Record<string, FieldConfig>
  prospectWeights: WeightConfig[]
}

const FIELD_GROUPS = [
  {
    label: '日程',
    fields: ['echo_date', 'first_meeting_date', 'application_date', 'contract_plan_date', 'contract_date',
             'delivery_plan_date', 'delivery_date', 'invoice_plan_date', 'invoice_date', 'payment_plan_date', 'payment_date'],
  },
  {
    label: '商流情報',
    fields: ['client_name', 'referrer_name', 'contractor_name', 'renobest_role', 'subcontractor',
             'billing_party', 'payment_source', 'payment_dest'],
  },
  {
    label: '金額・費用',
    fields: ['referral_fee', 'outsource_fee', 'profit_share'],
  },
  {
    label: 'メモ・その他',
    fields: ['customer_memo', 'negotiation_memo', 'next_action_date', 'comment'],
  },
]

const RANK_LABELS: Record<string, string> = {
  a: '見込みA',
  b: '見込みB',
  other: 'その他',
}

export function SettingsEditor({ projectFields: initialFields, prospectWeights: initialWeights }: Props) {
  const [fields, setFields] = useState(initialFields)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [weights, setWeights] = useState<WeightConfig[]>(initialWeights)
  const [savingWeights, setSavingWeights] = useState(false)
  const [savedWeights, setSavedWeights] = useState(false)

  function toggle(key: string, prop: 'visible' | 'required') {
    setFields((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [prop]: !prev[key][prop],
        // 非表示にしたら必須も外す
        ...(prop === 'visible' && prev[key].visible ? { required: false } : {}),
      },
    }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'project_fields', value: fields }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? '保存に失敗しました')
        return
      }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  async function saveWeights() {
    setSavingWeights(true)
    try {
      const res = await fetch('/api/admin/settings/weights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? '保存に失敗しました')
        return
      }
      setSavedWeights(true)
      setTimeout(() => setSavedWeights(false), 2000)
    } finally {
      setSavingWeights(false)
    }
  }

  const visibleCount = Object.values(fields).filter((f) => f.visible).length
  const requiredCount = Object.values(fields).filter((f) => f.required).length

  return (
    <div className="space-y-6">
      {/* 案件登録フィールド */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">案件登録フィールド</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              表示中: {visibleCount}項目　必須: {requiredCount}項目
            </p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4" />保存済</> : '変更を保存'}
          </button>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-6 text-xs text-gray-500">
          <span className="w-48">項目名</span>
          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />表示</span>
          <span className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />必須</span>
        </div>

        {FIELD_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-5 py-2 bg-gray-50 border-y border-gray-100">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group.label}</span>
            </div>
            {group.fields.map((key) => {
              const field = fields[key]
              if (!field) return null
              return (
                <div key={key} className="flex items-center gap-6 px-5 py-3 border-b border-gray-50 hover:bg-gray-50">
                  <span className="w-48 text-sm text-gray-700">{field.label}</span>

                  {/* 表示トグル */}
                  <button
                    onClick={() => toggle(key, 'visible')}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      field.visible
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {field.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {field.visible ? '表示' : '非表示'}
                  </button>

                  {/* 必須トグル */}
                  <button
                    onClick={() => toggle(key, 'required')}
                    disabled={!field.visible}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 ${
                      field.required
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    {field.required ? '必須' : '任意'}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* 加重見込み確度設定 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">加重見込み確度</h2>
            <p className="text-xs text-gray-500 mt-0.5">見込み案件の利益計算に使用する確度（%）</p>
          </div>
          <button
            onClick={saveWeights}
            disabled={savingWeights}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {savingWeights ? <Loader2 className="w-4 h-4 animate-spin" /> : savedWeights ? <><Check className="w-4 h-4" />保存済</> : '変更を保存'}
          </button>
        </div>
        <div className="px-5 py-4 flex flex-wrap gap-6">
          {weights.map((w, i) => (
            <div key={w.rank} className="flex items-center gap-2">
              <span className="text-sm text-gray-600 w-20">{RANK_LABELS[w.rank] ?? w.rank}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(w.weight * 100)}
                onChange={(e) => {
                  const pct = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                  setWeights((prev) => prev.map((x, j) => j === i ? { ...x, weight: pct / 100 } : x))
                  setSavedWeights(false)
                }}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-500 text-sm">%</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 px-5 pb-4">加重見込み利益 = 見込みA利益 × A確度% + 見込みB利益 × B確度%</p>
      </div>
    </div>
  )
}
