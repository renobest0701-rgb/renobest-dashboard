import Link from 'next/link'
import { requireAuth, isAdminOrExecutive, isDeptManager } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PROJECT_STATUS_LABELS, type Project, type ProjectStatus } from '@/types'
import { formatYen } from '@/lib/calculations'
import { Plus, AlertTriangle, Download } from 'lucide-react'

const STATUS_COLORS: Record<ProjectStatus, string> = {
  new:          'bg-gray-100 text-gray-700',
  negotiating:  'bg-yellow-100 text-yellow-700',
  prospect_b:   'bg-amber-100 text-amber-700',
  prospect_a:   'bg-orange-100 text-orange-700',
  application:  'bg-purple-100 text-purple-700',
  contracted:   'bg-blue-100 text-blue-700',
  delivered:    'bg-cyan-100 text-cyan-700',
  invoiced:     'bg-indigo-100 text-indigo-700',
  paid:         'bg-green-100 text-green-700',
  on_hold:      'bg-gray-100 text-gray-500',
  lost:         'bg-red-100 text-red-600',
  cancelled:    'bg-red-200 text-red-800',
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const user = await requireAuth()
  const supabase = await createClient()
  const params = await searchParams

  let query = supabase
    .from('projects')
    .select(`
      id, name, status, sales_amount, cost_planned, cost_confirmed,
      payment_plan_date, payment_date, contract_date, is_locked,
      department:departments(name),
      customer:customers(name)
    `)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (!isAdminOrExecutive(user) && !isDeptManager(user)) {
    // 一般担当者：自分の案件のみ
    query = query.eq('created_by', user.id)
  }

  if (params.status) {
    query = query.eq('status', params.status)
  }
  if (params.q) {
    query = query.ilike('name', `%${params.q}%`)
  }

  const { data: projects } = await query.limit(100)
  const allProjects = (projects ?? []) as any[]

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">案件一覧</h1>
        <div className="flex items-center gap-2">
          <a
            href="/api/export/projects"
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV出力
          </a>
          <Link
            href="/projects/new"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新規案件登録
          </Link>
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <form className="flex gap-3 flex-wrap">
          <input
            name="q"
            defaultValue={params.q}
            placeholder="案件名で検索..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            name="status"
            defaultValue={params.status ?? ''}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全ステータス</option>
            {Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
          >
            絞り込み
          </button>
        </form>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">案件名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">顧客</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">部門</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">ステータス</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">売上予定</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">入金予定日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allProjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    案件がありません
                  </td>
                </tr>
              ) : (
                allProjects.map((project) => {
                  const isOverdue = project.payment_plan_date &&
                    !project.payment_date &&
                    project.payment_plan_date < todayStr &&
                    ['contracted','delivered','invoiced'].includes(project.status)

                  return (
                    <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {project.name}
                        </Link>
                        {project.is_locked && (
                          <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                            締め済
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {project.customer?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {project.department?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status as ProjectStatus]}`}>
                          {PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {formatYen(project.sales_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {isOverdue && <AlertTriangle className="w-3 h-3" />}
                          {project.payment_plan_date ?? '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">{allProjects.length}件表示</p>
    </div>
  )
}
