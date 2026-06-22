import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { savePromoExpense, saveFixedExpense, deletePromoExpense, deleteFixedExpense } from './actions'
import { formatYen } from '@/lib/calculations'
import { PROMO_CATEGORY_LABELS } from '@/types'
import { Trash2 } from 'lucide-react'

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; dept?: string; msg?: string }>
}) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) redirect('/personal')

  const params = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const year = parseInt(params.year ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`

  const { data: departments } = await supabase
    .from('departments')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order')

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, department_id')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('full_name')

  const selectedDeptId = params.dept ?? departments?.[0]?.id

  const { data: promoExpenses } = await supabase
    .from('promotional_expenses')
    .select(`*, users(full_name), departments(name)`)
    .eq('department_id', selectedDeptId ?? '')
    .eq('expense_month', monthStart)
    .order('created_at', { ascending: false })

  const { data: fixedExpenses } = await supabase
    .from('fixed_expenses')
    .select(`*, users(full_name), departments(name)`)
    .eq('department_id', selectedDeptId ?? '')
    .eq('expense_month', monthStart)
    .order('created_at', { ascending: false })

  const promoTotal = (promoExpenses ?? []).reduce((s, e) => s + e.amount, 0)
  const fixedTotal = (fixedExpenses ?? []).reduce((s, e) => s + e.amount, 0)

  const deptUsers = (users ?? []).filter((u) => u.department_id === selectedDeptId)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">販促費・固定経費管理</h1>
          <p className="text-sm text-gray-500">{year}年{month}月</p>
        </div>
        <form className="flex gap-2 flex-wrap">
          <select name="dept" defaultValue={selectedDeptId}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select name="year" defaultValue={year}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select name="month" defaultValue={month}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}月</option>)}
          </select>
          <button type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            表示
          </button>
        </form>
      </div>

      {params.msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {params.msg === 'saved' ? '保存しました' : params.msg}
        </div>
      )}

      {/* 販促費 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            販促費合計: {formatYen(promoTotal)}
          </h2>
        </div>

        {/* 追加フォーム */}
        <form action={savePromoExpense as unknown as (formData: FormData) => void}
          className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <input type="hidden" name="department_id" value={selectedDeptId ?? ''} />
          <input type="hidden" name="expense_month" value={monthStart} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">担当者（任意）</label>
              <select name="user_id"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">部門共通</option>
                {deptUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">費目</label>
              <select name="category"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(PROMO_CATEGORY_LABELS).map(([v, l]) =>
                  <option key={v} value={v}>{l}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">金額（円）</label>
              <input name="amount" type="number" min="0" required defaultValue="0"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">摘要</label>
              <input name="description" type="text"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-end">
              <button type="submit"
                className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors">
                追加
              </button>
            </div>
          </div>
        </form>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-500">担当者</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">費目</th>
                <th className="text-right px-4 py-2 font-medium text-gray-500">金額</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">摘要</th>
                <th className="px-4 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(promoExpenses ?? []).length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6 text-gray-400">データなし</td></tr>
              ) : (
                (promoExpenses ?? []).map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{(e as any).users?.full_name ?? '部門共通'}</td>
                    <td className="px-4 py-2">{PROMO_CATEGORY_LABELS[e.category as keyof typeof PROMO_CATEGORY_LABELS] ?? e.category}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatYen(e.amount)}</td>
                    <td className="px-4 py-2 text-gray-500">{e.description ?? '—'}</td>
                    <td className="px-4 py-2">
                      <form action={deletePromoExpense as unknown as (formData: FormData) => void}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="dept" value={selectedDeptId ?? ''} />
                        <input type="hidden" name="year" value={year} />
                        <input type="hidden" name="month" value={month} />
                        <button type="submit"
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 固定経費 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            固定経費合計: {formatYen(fixedTotal)}
          </h2>
        </div>

        <form action={saveFixedExpense as unknown as (formData: FormData) => void}
          className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <input type="hidden" name="department_id" value={selectedDeptId ?? ''} />
          <input type="hidden" name="expense_month" value={monthStart} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">担当者（任意）</label>
              <select name="user_id"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">部門共通</option>
                {deptUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">配賦方式</label>
              <select name="allocation_type"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="direct">個人直接</option>
                <option value="equal_split">均等配賦</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">金額（円）</label>
              <input name="amount" type="number" min="0" required defaultValue="0"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                内訳公開
                <span className="ml-1 text-xs text-gray-400">（担当者に見せる）</span>
              </label>
              <select name="is_visible"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="false">非公開</option>
                <option value="true">公開</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit"
                className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors">
                追加
              </button>
            </div>
          </div>
        </form>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-500">担当者</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">配賦方式</th>
                <th className="text-right px-4 py-2 font-medium text-gray-500">金額</th>
                <th className="text-left px-4 py-2 font-medium text-gray-500">内訳公開</th>
                <th className="px-4 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(fixedExpenses ?? []).length === 0 ? (
                <tr><td colSpan={5} className="text-center py-6 text-gray-400">データなし</td></tr>
              ) : (
                (fixedExpenses ?? []).map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{(e as any).users?.full_name ?? '部門共通'}</td>
                    <td className="px-4 py-2">{e.allocation_type === 'direct' ? '個人直接' : '均等配賦'}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatYen(e.amount)}</td>
                    <td className="px-4 py-2">{e.is_visible ? '公開' : '非公開'}</td>
                    <td className="px-4 py-2">
                      <form action={deleteFixedExpense as unknown as (formData: FormData) => void}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="dept" value={selectedDeptId ?? ''} />
                        <input type="hidden" name="year" value={year} />
                        <input type="hidden" name="month" value={month} />
                        <button type="submit"
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
