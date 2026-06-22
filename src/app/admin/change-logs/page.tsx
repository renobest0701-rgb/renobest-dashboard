import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const FIELD_LABELS: Record<string, string> = {
  status:            'ステータス',
  sales_amount:      '売上金額',
  cost_planned:      '計画原価',
  cost_confirmed:    '確定原価',
  payment_plan_date: '入金予定日',
  contract_date:     '契約日',
  delivery_date:     '引渡し日',
  payment_date:      '入金日',
  prospect_rank:     '見込みランク',
  commission_rate:   '手数料率',
  role:              'ロール',
}

export default async function ChangeLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; field?: string; user?: string; page?: string }>
}) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) redirect('/personal')

  const params = await searchParams
  const supabase = await createClient()

  const page = parseInt(params.page ?? '1')
  const limit = 50
  const offset = (page - 1) * limit

  let query = supabase
    .from('change_logs')
    .select(`
      *,
      project:projects(id, name, department:departments(name)),
      changed_by_user:users!change_logs_changed_by_fkey(full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params.project) {
    query = query.ilike('project.name' as any, `%${params.project}%`)
  }
  if (params.field) {
    query = query.eq('field_name', params.field)
  }

  const { data: logs, count } = await query
  const totalPages = Math.ceil((count ?? 0) / limit)

  const fieldKeys = Object.keys(FIELD_LABELS)

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">変更履歴（監査ログ）</h1>
          <p className="text-sm text-gray-500 mt-0.5">全{count?.toLocaleString()}件</p>
        </div>
        <form className="flex gap-2 flex-wrap">
          <input name="project" defaultValue={params.project ?? ''}
            placeholder="案件名で検索"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44" />
          <select name="field" defaultValue={params.field ?? ''}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">全項目</option>
            {fieldKeys.map((k) => (
              <option key={k} value={k}>{FIELD_LABELS[k]}</option>
            ))}
          </select>
          <button type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            絞り込み
          </button>
          {(params.project || params.field) && (
            <a href="/admin/change-logs"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              クリア
            </a>
          )}
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">変更日時</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">案件名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">部門</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">変更者</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">変更項目</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">変更前</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">変更後</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">理由</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(logs ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">ログがありません</td>
                </tr>
              ) : (
                (logs ?? []).map((log) => {
                  const project = (log as any).project
                  const changedBy = (log as any).changed_by_user
                  const changedAt = new Date(log.created_at).toLocaleString('ja-JP', {
                    timeZone: 'Asia/Tokyo',
                    year: 'numeric', month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                  const fieldLabel = FIELD_LABELS[log.field_name] ?? log.field_name

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{changedAt}</td>
                      <td className="px-4 py-3 font-medium">
                        {project?.id ? (
                          <a href={`/projects/${project.id}`}
                            className="hover:text-blue-600 hover:underline">
                            {project.name}
                          </a>
                        ) : (
                          project?.name ?? '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {project?.department?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">{changedBy?.full_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                          {fieldLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {log.old_value ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-900">
                        {log.new_value ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-48">
                        <p className="truncate" title={log.reason ?? ''}>{log.reason || '—'}</p>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a key={p}
              href={`?${new URLSearchParams({ ...params, page: String(p) })}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}>
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
