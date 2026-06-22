'use client'

import { useState } from 'react'
import { Loader2, Check, Building2 } from 'lucide-react'

interface Props {
  projectId: string
  salesAmount: number
  companySalesShare: number
  teamSalesShare: number
  companyCostShare: number
  teamCostShare: number
  isLocked: boolean
}

function toMan(yen: number) {
  return yen === 0 ? '' : String(Math.round(yen / 10000))
}
function fromMan(val: string) {
  return Math.round((parseFloat(val) || 0) * 10000)
}

export function SharingEditor({
  projectId,
  salesAmount,
  companySalesShare: initCompanySales,
  teamSalesShare: initTeamSales,
  companyCostShare: initCompanyCost,
  teamCostShare: initTeamCost,
  isLocked,
}: Props) {
  const [companySales, setCompanySales] = useState(toMan(initCompanySales))
  const [teamSales, setTeamSales] = useState(toMan(initTeamSales))
  const [companyCost, setCompanyCost] = useState(toMan(initCompanyCost))
  const [teamCost, setTeamCost] = useState(toMan(initTeamCost))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/sharing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_sales_share: fromMan(companySales),
          team_sales_share:    fromMan(teamSales),
          company_cost_share:  fromMan(companyCost),
          team_cost_share:     fromMan(teamCost),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? '保存に失敗しました')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const totalSalesCheck = fromMan(companySales) + fromMan(teamSales)
  const salesDiff = totalSalesCheck > 0 ? salesAmount - totalSalesCheck : 0
  const hasSalesMismatch = totalSalesCheck > 0 && salesDiff !== 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-4 h-4 text-gray-500" />
        <h2 className="text-sm font-semibold text-gray-500">会社 / チーム 負担分担</h2>
      </div>

      <div className="space-y-4">
        {/* 売上分担 */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">売上取り分（万円）</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">会社取り分</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={companySales}
                  onChange={(e) => setCompanySales(e.target.value)}
                  disabled={isLocked}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <span className="text-xs text-gray-500">万</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">チーム取り分</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={teamSales}
                  onChange={(e) => setTeamSales(e.target.value)}
                  disabled={isLocked}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <span className="text-xs text-gray-500">万</span>
              </div>
            </div>
          </div>
          {hasSalesMismatch && (
            <p className="text-xs text-orange-500 mt-1">
              合計（{Math.round(totalSalesCheck / 10000)}万円）が売上予定額（{Math.round(salesAmount / 10000)}万円）と一致しません
            </p>
          )}
        </div>

        {/* 経費分担 */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">経費負担（万円）</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">会社負担</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={companyCost}
                  onChange={(e) => setCompanyCost(e.target.value)}
                  disabled={isLocked}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <span className="text-xs text-gray-500">万</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">チーム負担</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={teamCost}
                  onChange={(e) => setTeamCost(e.target.value)}
                  disabled={isLocked}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <span className="text-xs text-gray-500">万</span>
              </div>
            </div>
          </div>
        </div>

        {!isLocked && (
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4" />保存済</> : '保存'}
          </button>
        )}
      </div>
    </div>
  )
}
