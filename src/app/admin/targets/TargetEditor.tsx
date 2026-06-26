'use client'

import { useState, useCallback } from 'react'
import { Building2, Users, User, ChevronRight, Loader2, Check, RefreshCw } from 'lucide-react'

type Scope = 'company' | 'department' | 'personal'
type Period = 'yearly' | 'monthly'
type TargetType = 'direct' | 'agency'

interface Dept { id: string; code: string; name: string }
interface UserRow { id: string; full_name: string; department_id: string | null }
interface Target {
  id?: string
  target_scope: Scope
  target_type?: TargetType
  target_period: Period
  target_year: number
  target_month: number | null
  sales_target: number
  profit_target: number
  user_id: string | null
  department_id: string | null
}

interface Props {
  year: number
  departments: Dept[]
  users: UserRow[]
  targets: Target[]
  isExecutive: boolean
  myDepartmentId: string | null
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

// HONEVISTAのdept codeを判定（実際のcodeに合わせて変更）
const HOMEVISTA_CODES = ['HOMEVISTA', 'VR_CG', 'NEWREALTY']

function fmt(v: number): string {
  if (!v) return ''
  return Math.round(v / 10000).toString()
}

function parse(s: string): number {
  const n = parseInt(s.replace(/[^0-9]/g, ''))
  return isNaN(n) ? 0 : n * 10000
}

function AmountInput({
  value, onChange, placeholder, className,
}: {
  value: number
  onChange: (v: number) => void
  placeholder?: string
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw] = useState('')

  return (
    <input
      type="text"
      value={focused ? raw : (value ? fmt(value) : '')}
      placeholder={placeholder ?? '0'}
      onFocus={() => { setFocused(true); setRaw(fmt(value)) }}
      onBlur={() => { setFocused(false); onChange(parse(raw)) }}
      onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ''))}
      className={`w-full text-right text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${className ?? ''}`}
    />
  )
}

function useSave() {
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Set<string>>(new Set())

  const save = useCallback(async (
    key: string,
    payload: Omit<Target, 'id'> & { target_type?: string }
  ): Promise<boolean> => {
    setSaving((s) => new Set(s).add(key))
    try {
      const res = await fetch('/api/admin/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? '保存に失敗しました')
        return false
      }
      setSaved((s) => { const n = new Set(s); n.add(key); return n })
      setTimeout(() => setSaved((s) => { const n = new Set(s); n.delete(key); return n }), 2000)
      return true
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(key); return n })
    }
  }, [])

  return { saving, saved, save }
}

function SaveIcon({ id, saving, saved }: { id: string; saving: Set<string>; saved: Set<string> }) {
  if (saving.has(id)) return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 flex-shrink-0" />
  if (saved.has(id)) return <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
  return null
}

// ===================== 全社タブ =====================
function CompanyTab({ year, targets, isExecutive }: { year: number; targets: Target[]; isExecutive: boolean }) {
  const { saving, saved, save } = useSave()
  const [vals, setVals] = useState<Record<string, { sales: number; profit: number }>>(() => {
    const m: Record<string, { sales: number; profit: number }> = {}
    for (const t of targets.filter((t) => t.target_scope === 'company')) {
      const key = t.target_period === 'yearly' ? 'yearly' : `m${t.target_month}`
      m[key] = { sales: t.sales_target, profit: t.profit_target }
    }
    return m
  })

  function get(key: string) { return vals[key] ?? { sales: 0, profit: 0 } }
  function set(key: string, f: 'sales' | 'profit', v: number) {
    setVals((p) => ({ ...p, [key]: { ...get(key), [f]: v } }))
  }

  async function handleSave(key: string, period: Period, month: number | null) {
    const { sales, profit } = get(key)
    await save(key, {
      target_scope: 'company', target_type: 'direct', target_period: period,
      target_year: year, target_month: month,
      sales_target: sales, profit_target: profit, user_id: null, department_id: null,
    })
  }

  if (!isExecutive) return <p className="text-sm text-gray-500 py-8 text-center">全社目標の設定は経営者のみ可能です</p>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-700">{year}年度 年次目標</span>
        </div>
        <div className="grid grid-cols-[1fr_160px_160px_60px] gap-2 px-4 py-2 text-xs text-gray-400 border-b">
          <span></span><span className="text-right">売上目標（万円）</span><span className="text-right">利益目標（万円）</span><span></span>
        </div>
        <div className="grid grid-cols-[1fr_160px_160px_60px] gap-2 items-center px-4 py-3">
          <span className="text-sm font-medium text-gray-700">全社</span>
          <AmountInput value={get('yearly').sales} onChange={(v) => set('yearly', 'sales', v)} />
          <AmountInput value={get('yearly').profit} onChange={(v) => set('yearly', 'profit', v)} />
          <div className="flex items-center gap-1">
            <button onClick={() => handleSave('yearly', 'yearly', null)}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
            <SaveIcon id="yearly" saving={saving} saved={saved} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-700">{year}年 月次目標</span>
        </div>
        <div className="grid grid-cols-[60px_1fr_160px_160px_60px] gap-2 px-4 py-1.5 text-xs text-gray-400 border-b">
          <span>月</span><span></span><span className="text-right">売上（万円）</span><span className="text-right">利益（万円）</span><span></span>
        </div>
        {MONTHS.map((m) => {
          const key = `m${m}`
          return (
            <div key={m} className="grid grid-cols-[60px_1fr_160px_160px_60px] gap-2 items-center px-4 py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm font-medium text-gray-600">{m}月</span>
              <span></span>
              <AmountInput value={get(key).sales} onChange={(v) => set(key, 'sales', v)} />
              <AmountInput value={get(key).profit} onChange={(v) => set(key, 'profit', v)} />
              <div className="flex items-center gap-1">
                <button onClick={() => handleSave(key, 'monthly', m)}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                <SaveIcon id={key} saving={saving} saved={saved} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===================== 部門タブ =====================
function DeptTab({ year, departments, targets, isExecutive, myDepartmentId }: {
  year: number; departments: Dept[]; targets: Target[]
  isExecutive: boolean; myDepartmentId: string | null
}) {
  const { saving, saved, save } = useSave()
  const visibleDepts = isExecutive ? departments : departments.filter((d) => d.id === myDepartmentId)

  const [vals, setVals] = useState<Record<string, { sales: number; profit: number }>>(() => {
    const m: Record<string, { sales: number; profit: number }> = {}
    for (const t of targets.filter((t) => t.target_scope === 'department')) {
      const key = `${t.department_id}_${t.target_type ?? 'direct'}_${t.target_period === 'yearly' ? 'yearly' : `m${t.target_month}`}`
      m[key] = { sales: t.sales_target, profit: t.profit_target }
    }
    return m
  })

  function get(deptId: string, type: TargetType, suffix: string) {
    return vals[`${deptId}_${type}_${suffix}`] ?? { sales: 0, profit: 0 }
  }
  function set(deptId: string, type: TargetType, suffix: string, f: 'sales' | 'profit', v: number) {
    const key = `${deptId}_${type}_${suffix}`
    setVals((p) => ({ ...p, [key]: { ...get(deptId, type, suffix), [f]: v } }))
  }
  async function handleSave(deptId: string, type: TargetType, suffix: string, period: Period, month: number | null) {
    const key = `${deptId}_${type}_${suffix}`
    const { sales, profit } = get(deptId, type, suffix)
    await save(key, {
      target_scope: 'department', target_type: type, target_period: period,
      target_year: year, target_month: month,
      sales_target: sales, profit_target: profit, user_id: null, department_id: deptId,
    })
  }

  return (
    <div className="space-y-6">
      {visibleDepts.map((dept) => {
        const isHV = HOMEVISTA_CODES.includes(dept.code)
        const types: TargetType[] = isHV ? ['direct', 'agency'] : ['direct']
        const typeLabels: Record<TargetType, string> = { direct: '担当者売上', agency: '代理店売上' }

        return (
          <div key={dept.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-gray-700">{dept.name}</span>
              {isHV && <span className="text-xs bg-purple-100 text-purple-600 rounded px-1.5">代理店枠あり</span>}
            </div>
            {types.map((type) => (
              <div key={type}>
                {isHV && (
                  <div className="px-4 py-1.5 bg-gray-50/50 border-b border-gray-100 text-xs font-medium text-gray-500">
                    {typeLabels[type]}
                  </div>
                )}
                <div className="grid grid-cols-[80px_1fr_160px_160px_80px] gap-2 items-center px-4 py-2.5 border-b border-gray-100">
                  <span className="text-xs text-gray-500">年次</span>
                  <span></span>
                  <AmountInput value={get(dept.id, type, 'yearly').sales} onChange={(v) => set(dept.id, type, 'yearly', 'sales', v)} placeholder="売上（万）" />
                  <AmountInput value={get(dept.id, type, 'yearly').profit} onChange={(v) => set(dept.id, type, 'yearly', 'profit', v)} placeholder="利益（万）" />
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleSave(dept.id, type, 'yearly', 'yearly', null)}
                      className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                    <SaveIcon id={`${dept.id}_${type}_yearly`} saving={saving} saved={saved} />
                  </div>
                </div>
                <div className="grid grid-cols-[80px_1fr_160px_160px_80px] gap-2 px-4 py-1 text-xs text-gray-400 border-b border-gray-100">
                  <span>月</span><span></span><span className="text-right">売上（万円）</span><span className="text-right">利益（万円）</span><span></span>
                </div>
                {MONTHS.map((m) => (
                  <div key={m} className="grid grid-cols-[80px_1fr_160px_160px_80px] gap-2 items-center px-4 py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600">{m}月</span>
                    <span></span>
                    <AmountInput value={get(dept.id, type, `m${m}`).sales} onChange={(v) => set(dept.id, type, `m${m}`, 'sales', v)} />
                    <AmountInput value={get(dept.id, type, `m${m}`).profit} onChange={(v) => set(dept.id, type, `m${m}`, 'profit', v)} />
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleSave(dept.id, type, `m${m}`, 'monthly', m)}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                      <SaveIcon id={`${dept.id}_${type}_m${m}`} saving={saving} saved={saved} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ===================== 個人タブ（月次一括入力グリッド） =====================
type UserVals = Record<string, Record<number | 'yearly', { sales: number; profit: number }>>

function PersonalTab({ year, departments, users, targets, isExecutive, myDepartmentId }: {
  year: number; departments: Dept[]; users: UserRow[]; targets: Target[]
  isExecutive: boolean; myDepartmentId: string | null
}) {
  const { saving, saved, save } = useSave()

  // vals[userId][targetType][month|'yearly'] = {sales, profit}
  const [vals, setVals] = useState<Record<string, Record<string, Record<number | 'yearly', { sales: number; profit: number }>>>>(() => {
    const m: Record<string, Record<string, Record<number | 'yearly', { sales: number; profit: number }>>> = {}
    for (const t of targets.filter((t) => t.target_scope === 'personal' && t.user_id)) {
      const uid = t.user_id!
      const ttype = t.target_type ?? 'direct'
      const period = t.target_period === 'yearly' ? 'yearly' : t.target_month!
      if (!m[uid]) m[uid] = {}
      if (!m[uid][ttype]) m[uid][ttype] = {} as Record<number | 'yearly', { sales: number; profit: number }>
      m[uid][ttype][period] = { sales: t.sales_target, profit: t.profit_target }
    }
    return m
  })

  function get(uid: string, ttype: string, period: number | 'yearly') {
    return vals[uid]?.[ttype]?.[period] ?? { sales: 0, profit: 0 }
  }

  function set(uid: string, ttype: string, period: number | 'yearly', f: 'sales' | 'profit', v: number) {
    setVals((p) => ({
      ...p,
      [uid]: {
        ...p[uid],
        [ttype]: {
          ...(p[uid]?.[ttype] ?? {}),
          [period]: { ...get(uid, ttype, period), [f]: v },
        },
      },
    }))
  }

  async function saveOne(uid: string, deptId: string | null, ttype: TargetType, period: number | 'yearly') {
    const { sales, profit } = get(uid, ttype, period)
    const isYearly = period === 'yearly'
    const key = `${uid}_${ttype}_${period}`
    await save(key, {
      target_scope: 'personal', target_type: ttype,
      target_period: isYearly ? 'yearly' : 'monthly',
      target_year: year,
      target_month: isYearly ? null : period as number,
      sales_target: sales, profit_target: profit,
      user_id: uid, department_id: deptId,
    })
  }

  async function saveAllMonths(uid: string, deptId: string | null, ttype: TargetType) {
    const periods: (number | 'yearly')[] = ['yearly', ...MONTHS]
    for (const period of periods) {
      await saveOne(uid, deptId, ttype, period)
    }
  }

  const visibleDepts = isExecutive ? departments : departments.filter((d) => d.id === myDepartmentId)

  return (
    <div className="space-y-6">
      {visibleDepts.map((dept) => {
        const deptUsers = users.filter((u) => u.department_id === dept.id)
        if (deptUsers.length === 0) return null
        const isHV = HOMEVISTA_CODES.includes(dept.code)
        const types: TargetType[] = isHV ? ['direct', 'agency'] : ['direct']
        const typeLabels: Record<TargetType, string> = { direct: '担当者売上', agency: '代理店売上' }

        return (
          <div key={dept.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold text-gray-700">{dept.name}</span>
              {isHV && <span className="text-xs bg-purple-100 text-purple-600 rounded px-1.5">代理店枠あり</span>}
            </div>

            {deptUsers.map((u) => (
              <div key={u.id} className="border-b border-gray-100 last:border-0">
                {/* ユーザー名ヘッダー */}
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/40 border-b border-gray-100">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{u.full_name}</span>
                </div>

                {types.map((ttype) => (
                  <div key={ttype}>
                    {isHV && (
                      <div className="px-4 py-1 text-xs text-purple-600 bg-purple-50/40 border-b border-purple-100 flex items-center justify-between">
                        <span className="font-medium">{typeLabels[ttype]}</span>
                      </div>
                    )}

                    {/* 月次一括グリッド（横スクロール） */}
                    <div className="overflow-x-auto">
                      <table className="text-xs min-w-max">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-100">
                            <th className="px-3 py-1.5 text-left font-normal w-16">項目</th>
                            <th className="px-2 py-1.5 text-right font-normal w-20">年次</th>
                            {MONTHS.map((m) => (
                              <th key={m} className="px-2 py-1.5 text-right font-normal w-16">{m}月</th>
                            ))}
                            <th className="px-3 py-1.5 w-24"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* 売上行 */}
                          <tr className="border-b border-gray-50">
                            <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">売上(万)</td>
                            <td className="px-2 py-1">
                              <AmountInput
                                value={get(u.id, ttype, 'yearly').sales}
                                onChange={(v) => set(u.id, ttype, 'yearly', 'sales', v)}
                                className="w-16"
                              />
                            </td>
                            {MONTHS.map((m) => (
                              <td key={m} className="px-2 py-1">
                                <AmountInput
                                  value={get(u.id, ttype, m).sales}
                                  onChange={(v) => set(u.id, ttype, m, 'sales', v)}
                                  className="w-14"
                                />
                              </td>
                            ))}
                            <td rowSpan={2} className="px-3 py-1 align-middle">
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  onClick={() => saveAllMonths(u.id, u.department_id, ttype)}
                                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  一括保存
                                </button>
                                <SaveIcon id={`${u.id}_${ttype}_yearly`} saving={saving} saved={saved} />
                              </div>
                            </td>
                          </tr>
                          {/* 利益行 */}
                          <tr>
                            <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">利益(万)</td>
                            <td className="px-2 py-1">
                              <AmountInput
                                value={get(u.id, ttype, 'yearly').profit}
                                onChange={(v) => set(u.id, ttype, 'yearly', 'profit', v)}
                                className="w-16"
                              />
                            </td>
                            {MONTHS.map((m) => (
                              <td key={m} className="px-2 py-1">
                                <AmountInput
                                  value={get(u.id, ttype, m).profit}
                                  onChange={(v) => set(u.id, ttype, m, 'profit', v)}
                                  className="w-14"
                                />
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ===================== メインコンポーネント =====================
export function TargetEditor({ year, departments, users, targets, isExecutive, myDepartmentId }: Props) {
  const [tab, setTab] = useState<Scope>('company')
  const [currentYear, setCurrentYear] = useState(year)

  const tabs: { key: Scope; label: string; icon: React.ReactNode }[] = [
    { key: 'company', label: '全社', icon: <Building2 className="w-4 h-4" /> },
    { key: 'department', label: '部門別', icon: <Users className="w-4 h-4" /> },
    { key: 'personal', label: '個人別', icon: <User className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setCurrentYear((y) => y - 1)} className="p-1.5 rounded hover:bg-gray-100">
          <ChevronRight className="w-4 h-4 rotate-180 text-gray-600" />
        </button>
        <span className="text-lg font-bold text-gray-900 min-w-[80px] text-center">{currentYear}年</span>
        <button onClick={() => setCurrentYear((y) => y + 1)} className="p-1.5 rounded hover:bg-gray-100">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'company' && <CompanyTab year={currentYear} targets={targets} isExecutive={isExecutive} />}
      {tab === 'department' && (
        <DeptTab year={currentYear} departments={departments} targets={targets}
          isExecutive={isExecutive} myDepartmentId={myDepartmentId} />
      )}
      {tab === 'personal' && (
        <PersonalTab year={currentYear} departments={departments} users={users} targets={targets}
          isExecutive={isExecutive} myDepartmentId={myDepartmentId} />
      )}
    </div>
  )
}
