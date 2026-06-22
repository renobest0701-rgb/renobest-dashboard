'use client'

import { useState, useCallback } from 'react'
import { Building2, Users, User, ChevronRight, Loader2, Check } from 'lucide-react'

type Scope = 'company' | 'department' | 'personal'
type Period = 'yearly' | 'monthly'

interface Dept { id: string; code: string; name: string }
interface UserRow { id: string; full_name: string; department_id: string | null }
interface Target {
  id?: string
  target_scope: Scope
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

function fmt(v: number): string {
  if (!v) return ''
  return Math.round(v / 10000).toString()
}

function parse(s: string): number {
  const n = parseInt(s.replace(/[^0-9]/g, ''))
  return isNaN(n) ? 0 : n * 10000
}

function AmountInput({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw] = useState('')

  return (
    <div className="relative">
      <input
        type="text"
        value={focused ? raw : (value ? fmt(value) + '万' : '')}
        placeholder={placeholder ?? '0万'}
        onFocus={() => { setFocused(true); setRaw(fmt(value)) }}
        onBlur={() => { setFocused(false); onChange(parse(raw)) }}
        onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ''))}
        className="w-full text-right text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-400"
      />
    </div>
  )
}

function useSave() {
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const save = useCallback(async (key: string, payload: Omit<Target, 'id'>) => {
    setSaving(key)
    setSaved(null)
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
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
      return true
    } finally {
      setSaving(null)
    }
  }, [])

  return { saving, saved, save }
}

function SaveBtn({ id, saving, saved }: { id: string; saving: string | null; saved: string | null }) {
  if (saving === id) return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
  if (saved === id) return <Check className="w-4 h-4 text-green-500" />
  return null
}

// ---- 全社タブ ----
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

  function get(key: string) {
    return vals[key] ?? { sales: 0, profit: 0 }
  }

  function set(key: string, field: 'sales' | 'profit', v: number) {
    setVals((prev) => ({ ...prev, [key]: { ...get(key), [field]: v } }))
  }

  async function handleSave(key: string, period: Period, month: number | null) {
    const { sales, profit } = get(key)
    await save(key, {
      target_scope: 'company', target_period: period, target_year: year,
      target_month: month, sales_target: sales, profit_target: profit,
      user_id: null, department_id: null,
    })
  }

  if (!isExecutive) return <p className="text-sm text-gray-500 py-8 text-center">全社目標の設定は経営者のみ可能です</p>

  return (
    <div className="space-y-6">
      {/* 年次 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{year}年度 年次目標</span>
        </div>
        <div className="grid grid-cols-[1fr_160px_160px_40px] gap-2 px-4 py-2 text-xs text-gray-500 border-b">
          <span></span><span className="text-right">売上目標（万円）</span><span className="text-right">利益目標（万円）</span><span></span>
        </div>
        <div className="grid grid-cols-[1fr_160px_160px_40px] gap-2 items-center px-4 py-3">
          <span className="text-sm font-medium text-gray-700">全社</span>
          <AmountInput value={get('yearly').sales} onChange={(v) => set('yearly', 'sales', v)} />
          <AmountInput value={get('yearly').profit} onChange={(v) => set('yearly', 'profit', v)} />
          <div className="flex justify-center">
            <button onClick={() => handleSave('yearly', 'yearly', null)}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
              保存
            </button>
          </div>
        </div>
        <div className="px-4 pb-2 flex justify-end">
          <SaveBtn id="yearly" saving={saving} saved={saved} />
        </div>
      </div>

      {/* 月次 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-700">{year}年 月次目標</span>
        </div>
        <div className="grid grid-cols-[60px_1fr_160px_160px_40px] gap-2 px-4 py-2 text-xs text-gray-500 border-b">
          <span>月</span><span></span><span className="text-right">売上（万円）</span><span className="text-right">利益（万円）</span><span></span>
        </div>
        {MONTHS.map((m) => {
          const key = `m${m}`
          return (
            <div key={m} className="grid grid-cols-[60px_1fr_160px_160px_40px] gap-2 items-center px-4 py-2 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-600">{m}月</span>
              <span></span>
              <AmountInput value={get(key).sales} onChange={(v) => set(key, 'sales', v)} />
              <AmountInput value={get(key).profit} onChange={(v) => set(key, 'profit', v)} />
              <div className="flex justify-center gap-1 items-center">
                <button onClick={() => handleSave(key, 'monthly', m)}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                <SaveBtn id={key} saving={saving} saved={saved} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- 部門タブ ----
function DeptTab({ year, departments, targets, isExecutive, myDepartmentId }: {
  year: number; departments: Dept[]; targets: Target[]; isExecutive: boolean; myDepartmentId: string | null
}) {
  const { saving, saved, save } = useSave()
  const visibleDepts = isExecutive ? departments : departments.filter((d) => d.id === myDepartmentId)

  const [vals, setVals] = useState<Record<string, { sales: number; profit: number }>>(() => {
    const m: Record<string, { sales: number; profit: number }> = {}
    for (const t of targets.filter((t) => t.target_scope === 'department')) {
      const key = `${t.department_id}_${t.target_period === 'yearly' ? 'yearly' : `m${t.target_month}`}`
      m[key] = { sales: t.sales_target, profit: t.profit_target }
    }
    return m
  })

  function get(deptId: string, suffix: string) {
    return vals[`${deptId}_${suffix}`] ?? { sales: 0, profit: 0 }
  }

  function set(deptId: string, suffix: string, field: 'sales' | 'profit', v: number) {
    const key = `${deptId}_${suffix}`
    setVals((prev) => ({ ...prev, [key]: { ...get(deptId, suffix), [field]: v } }))
  }

  async function handleSave(deptId: string, suffix: string, period: Period, month: number | null) {
    const key = `${deptId}_${suffix}`
    const { sales, profit } = get(deptId, suffix)
    await save(key, {
      target_scope: 'department', target_period: period, target_year: year,
      target_month: month, sales_target: sales, profit_target: profit,
      user_id: null, department_id: deptId,
    })
  }

  return (
    <div className="space-y-6">
      {visibleDepts.map((dept) => (
        <div key={dept.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-700">{dept.name}</span>
          </div>

          {/* 年次 */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="grid grid-cols-[80px_1fr_160px_160px_80px] gap-2 items-center">
              <span className="text-xs text-gray-500">年次</span>
              <span></span>
              <AmountInput value={get(dept.id, 'yearly').sales} onChange={(v) => set(dept.id, 'yearly', 'sales', v)} />
              <AmountInput value={get(dept.id, 'yearly').profit} onChange={(v) => set(dept.id, 'yearly', 'profit', v)} />
              <div className="flex items-center gap-1">
                <button onClick={() => handleSave(dept.id, 'yearly', 'yearly', null)}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                <SaveBtn id={`${dept.id}_yearly`} saving={saving} saved={saved} />
              </div>
            </div>
          </div>

          {/* 月次 */}
          <div className="grid grid-cols-[80px_1fr_160px_160px_80px] gap-2 px-4 py-1.5 text-xs text-gray-400 border-b border-gray-100">
            <span>月</span><span></span><span className="text-right">売上（万円）</span><span className="text-right">利益（万円）</span><span></span>
          </div>
          {MONTHS.map((m) => (
            <div key={m} className="grid grid-cols-[80px_1fr_160px_160px_80px] gap-2 items-center px-4 py-2 border-b border-gray-50">
              <span className="text-sm text-gray-600">{m}月</span>
              <span></span>
              <AmountInput value={get(dept.id, `m${m}`).sales} onChange={(v) => set(dept.id, `m${m}`, 'sales', v)} />
              <AmountInput value={get(dept.id, `m${m}`).profit} onChange={(v) => set(dept.id, `m${m}`, 'profit', v)} />
              <div className="flex items-center gap-1">
                <button onClick={() => handleSave(dept.id, `m${m}`, 'monthly', m)}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                <SaveBtn id={`${dept.id}_m${m}`} saving={saving} saved={saved} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ---- 個人タブ ----
function PersonalTab({ year, departments, users, targets, isExecutive, myDepartmentId }: {
  year: number; departments: Dept[]; users: UserRow[]; targets: Target[]; isExecutive: boolean; myDepartmentId: string | null
}) {
  const { saving, saved, save } = useSave()
  const [selectedMonth, setSelectedMonth] = useState<number | 'yearly'>('yearly')

  const [vals, setVals] = useState<Record<string, { sales: number; profit: number }>>(() => {
    const m: Record<string, { sales: number; profit: number }> = {}
    for (const t of targets.filter((t) => t.target_scope === 'personal')) {
      const suffix = t.target_period === 'yearly' ? 'yearly' : `m${t.target_month}`
      const key = `${t.user_id}_${suffix}`
      m[key] = { sales: t.sales_target, profit: t.profit_target }
    }
    return m
  })

  const suffix = selectedMonth === 'yearly' ? 'yearly' : `m${selectedMonth}`

  function get(userId: string) {
    return vals[`${userId}_${suffix}`] ?? { sales: 0, profit: 0 }
  }
  function set(userId: string, field: 'sales' | 'profit', v: number) {
    const key = `${userId}_${suffix}`
    setVals((prev) => ({ ...prev, [key]: { ...get(userId), [field]: v } }))
  }
  async function handleSave(userId: string, deptId: string | null) {
    const key = `${userId}_${suffix}`
    const { sales, profit } = get(userId)
    await save(key, {
      target_scope: 'personal',
      target_period: selectedMonth === 'yearly' ? 'yearly' : 'monthly',
      target_year: year,
      target_month: selectedMonth === 'yearly' ? null : selectedMonth,
      sales_target: sales, profit_target: profit,
      user_id: userId, department_id: deptId,
    })
  }

  const visibleDepts = isExecutive ? departments : departments.filter((d) => d.id === myDepartmentId)

  return (
    <div className="space-y-4">
      {/* 期間セレクター */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedMonth('yearly')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedMonth === 'yearly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >年次</button>
        {MONTHS.map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(m)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedMonth === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >{m}月</button>
        ))}
      </div>

      {/* 部門ごとにユーザー一覧 */}
      {visibleDepts.map((dept) => {
        const deptUsers = users.filter((u) => u.department_id === dept.id)
        if (deptUsers.length === 0) return null
        return (
          <div key={dept.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-semibold text-gray-700">{dept.name}</span>
            </div>
            <div className="grid grid-cols-[1fr_160px_160px_80px] gap-2 px-4 py-1.5 text-xs text-gray-400 border-b border-gray-100">
              <span>氏名</span><span className="text-right">売上（万円）</span><span className="text-right">利益（万円）</span><span></span>
            </div>
            {deptUsers.map((u) => (
              <div key={u.id} className="grid grid-cols-[1fr_160px_160px_80px] gap-2 items-center px-4 py-2 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm text-gray-700">{u.full_name}</span>
                </div>
                <AmountInput value={get(u.id).sales} onChange={(v) => set(u.id, 'sales', v)} />
                <AmountInput value={get(u.id).profit} onChange={(v) => set(u.id, 'profit', v)} />
                <div className="flex items-center gap-1">
                  <button onClick={() => handleSave(u.id, u.department_id)}
                    className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                  <SaveBtn id={`${u.id}_${suffix}`} saving={saving} saved={saved} />
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ---- メインコンポーネント ----
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
      {/* 年選択 */}
      <div className="flex items-center gap-3">
        <button onClick={() => setCurrentYear((y) => y - 1)} className="p-1.5 rounded hover:bg-gray-100">
          <ChevronRight className="w-4 h-4 rotate-180 text-gray-600" />
        </button>
        <span className="text-lg font-bold text-gray-900 min-w-[80px] text-center">{currentYear}年</span>
        <button onClick={() => setCurrentYear((y) => y + 1)} className="p-1.5 rounded hover:bg-gray-100">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* タブ */}
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

      {/* コンテンツ */}
      {tab === 'company' && (
        <CompanyTab year={currentYear} targets={targets} isExecutive={isExecutive} />
      )}
      {tab === 'department' && (
        <DeptTab year={currentYear} departments={departments} targets={targets} isExecutive={isExecutive} myDepartmentId={myDepartmentId} />
      )}
      {tab === 'personal' && (
        <PersonalTab year={currentYear} departments={departments} users={users} targets={targets} isExecutive={isExecutive} myDepartmentId={myDepartmentId} />
      )}
    </div>
  )
}
