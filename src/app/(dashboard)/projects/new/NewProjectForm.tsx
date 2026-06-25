'use client'

import { useActionState, useState } from 'react'
import { createProject } from '../actions'
import { FLOW_TYPE_LABELS, type FlowType } from '@/types'

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

interface Department {
  id: string
  name: string
}

export function NewProjectForm({ departments }: { departments: Department[] }) {
  const [showDetail, setShowDetail] = useState(false)
  const [flowType, setFlowType] = useState<FlowType>('direct')
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const result = await createProject(formData)
      return result ?? null
    },
    null
  )

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* 基本情報 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          案件名 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例：○○邸仲介"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          部門 <span className="text-red-500">*</span>
        </label>
        <select
          name="department_id"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">選択してください</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">顧客名</label>
        <input
          name="customer_name"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="顧客・取引先名"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">商流区分</label>
        <select
          name="flow_type"
          value={flowType}
          onChange={(e) => setFlowType(e.target.value as FlowType)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(FLOW_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <div className="mt-2">
          <input
            name="flow_detail"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={getFlowDetailPlaceholder(flowType)}
          />
        </div>
      </div>

      {/* 金額 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">売上予定額（円）</label>
          <input name="sales_amount" type="number" min="0" defaultValue="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">予定原価（円）</label>
          <input name="cost_planned" type="number" min="0" defaultValue="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* 見込み確度 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">見込み確度</label>
        <select name="prospect_rank" defaultValue="b"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="a">見込みA（80%）</option>
          <option value="b">見込みB（50%）</option>
          <option value="other">その他（0%）</option>
        </select>
      </div>

      {/* 基本日付 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">新規反響日</label>
          <input type="date" name="echo_date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">初回接客日</label>
          <input type="date" name="first_meeting_date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">契約予定日</label>
          <input type="date" name="contract_plan_date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">入金予定日</label>
          <input type="date" name="payment_plan_date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* 詳細項目トグル */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetail(!showDetail)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <span>{showDetail ? '▲' : '▼'}</span>
          詳細項目を{showDetail ? '閉じる' : '入力する'}
        </button>
      </div>

      {showDetail && (
        <div className="space-y-5 border-t border-gray-100 pt-4">
          {/* 顧客・発注者 / 紹介者 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">顧客・発注者名</label>
              <input name="client_name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="発注元会社・担当者名" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">紹介者</label>
              <input name="referrer_name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="紹介者名" />
            </div>
          </div>

          {/* 追加日付 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">申込日</label>
              <input type="date" name="application_date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">契約日</label>
              <input type="date" name="contract_date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">引渡し予定日</label>
              <input type="date" name="delivery_plan_date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">請求予定日</label>
              <input type="date" name="invoice_plan_date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">顧客メモ</label>
            <textarea name="customer_memo" rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="顧客に関するメモ" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">コメント</label>
            <textarea name="comment" rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="その他コメント" />
          </div>
        </div>
      )}

      {/* 商談メモは常に表示 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">商談メモ</label>
        <textarea name="negotiation_memo" rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {pending ? '登録中...' : '登録する'}
        </button>
        <a href="/projects"
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          キャンセル
        </a>
      </div>
    </form>
  )
}
