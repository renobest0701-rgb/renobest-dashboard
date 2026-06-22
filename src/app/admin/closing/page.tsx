import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClosingActions } from './ClosingActions'
import type { ClosingStatus } from '@/types'

const STATUS_LABELS: Record<ClosingStatus, string> = {
  open:      'オープン',
  temporary: '仮締め',
  final:     '本締め',
  amending:  '修正中',
  amended:   '修正済',
}
const STATUS_COLORS: Record<ClosingStatus, string> = {
  open:      'bg-gray-100 text-gray-600',
  temporary: 'bg-amber-100 text-amber-700',
  final:     'bg-green-100 text-green-700',
  amending:  'bg-blue-100 text-blue-700',
  amended:   'bg-purple-100 text-purple-700',
}

export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) redirect('/personal')

  const params = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const selectedYear = parseInt(params.year ?? String(now.getFullYear()))

  // 12ヶ月分の締め状況
  const { data: closings } = await supabase
    .from('monthly_closings')
    .select('*, department:departments(name), closed_by_user:users!monthly_closings_closed_by_fkey(full_name)')
    .eq('closing_year', selectedYear)
    .order('closing_month', { ascending: false })

  // 部門一覧
  const { data: departments } = await supabase
    .from('departments')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order')

  // 月×部門の締めマップ
  type ClosingRow = NonNullable<typeof closings>[number]
  const closingMap = new Map<string, ClosingRow>()
  for (const c of closings ?? []) {
    closingMap.set(`${c.closing_month}-${c.department_id}`, c)
  }

  const months = Array.from({ length: 12 }, (_, i) => 12 - i)

  // 本締め月の案件はis_lockedをtrueにする（実際はDBトリガーで行うが、ここで状況を確認）
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">月次締め管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            本締め後は案件の編集がロックされます（修正は承認申請が必要）
          </p>
        </div>
        <form className="flex gap-2">
          <select name="year" defaultValue={selectedYear}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <button type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            表示
          </button>
        </form>
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-500">ステータス凡例：</span>
        {(Object.entries(STATUS_LABELS) as [ClosingStatus, string][]).map(([k, v]) => (
          <span key={k} className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[k]}`}>{v}</span>
        ))}
      </div>

      {/* 月×部門グリッド */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-24">月</th>
                {departments?.map((d) => (
                  <th key={d.id} className="text-center px-4 py-3 font-medium text-gray-500">{d.name}</th>
                ))}
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-32">全社</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {months.map((month) => {
                const isCurrentMonth = month === now.getMonth() + 1 && selectedYear === now.getFullYear()
                const isPast = selectedYear < now.getFullYear() ||
                  (selectedYear === now.getFullYear() && month < now.getMonth() + 1)

                return (
                  <tr key={month} className={`hover:bg-gray-50 ${isCurrentMonth ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-3 font-medium">
                      {selectedYear}年{month}月
                      {isCurrentMonth && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">今月</span>
                      )}
                    </td>
                    {departments?.map((dept) => {
                      const closing = closingMap.get(`${month}-${dept.id}`)
                      const status = (closing?.status as ClosingStatus | undefined) ?? 'open'

                      return (
                        <td key={dept.id} className="px-4 py-3 text-center">
                          <ClosingCell
                            closing={closing}
                            status={status}
                            year={selectedYear}
                            month={month}
                            departmentId={dept.id}
                            departmentName={dept.name}
                            isPast={isPast}
                          />
                        </td>
                      )
                    })}
                    {/* 全社締め */}
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const closing = closingMap.get(`${month}-all`)
                        const status = (closing?.status as ClosingStatus | undefined) ?? 'open'
                        return (
                          <ClosingCell
                            closing={closing}
                            status={status}
                            year={selectedYear}
                            month={month}
                            departmentId={null}
                            departmentName="全社"
                            isPast={isPast}
                          />
                        )
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ClosingCell({
  closing,
  status,
  year,
  month,
  departmentId,
  departmentName,
  isPast,
}: {
  closing: any
  status: ClosingStatus
  year: number
  month: number
  departmentId: string | null
  departmentName: string
  isPast: boolean
}) {
  const STATUS_LABELS: Record<ClosingStatus, string> = {
    open:      'オープン',
    temporary: '仮締め',
    final:     '本締め',
    amending:  '修正中',
    amended:   '修正済',
  }
  const STATUS_COLORS: Record<ClosingStatus, string> = {
    open:      'bg-gray-100 text-gray-600',
    temporary: 'bg-amber-100 text-amber-700',
    final:     'bg-green-100 text-green-700',
    amending:  'bg-blue-100 text-blue-700',
    amended:   'bg-purple-100 text-purple-700',
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
        {STATUS_LABELS[status]}
      </span>
      {closing?.closed_by_user && (
        <span className="text-xs text-gray-400">{closing.closed_by_user.full_name}</span>
      )}
      {(isPast || status !== 'open') && (
        <ClosingActions
          closingId={closing?.id ?? null}
          status={status}
          year={year}
          month={month}
          departmentId={departmentId}
        />
      )}
    </div>
  )
}
