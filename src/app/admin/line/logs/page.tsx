import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ResendButton } from './ResendButton'
import { CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react'

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  application:      '新規申込',
  contract:         '新規契約・受注',
  payment:          '入金完了',
  cancel:           'キャンセル',
  important_change: '重要項目変更',
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  company_group:    '全社グループ',
  department_group: '部門グループ',
  executive:        '経営者・上席',
  assignee:         '担当者',
  admin:            '管理者',
}

export default async function LineLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; type?: string; page?: string }>
}) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) redirect('/personal')

  const params = await searchParams
  const supabase = await createClient()
  const page = parseInt(params.page ?? '1')
  const limit = 50
  const offset = (page - 1) * limit

  let query = supabase
    .from('line_notification_logs')
    .select(`
      *,
      project:projects(name, department:departments(name))
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params.result) query = query.eq('result', params.result)
  if (params.type) query = query.eq('notification_type', params.type)

  const { data: logs, count } = await query
  const totalPages = Math.ceil((count ?? 0) / limit)

  function resultBadge(result: string | null) {
    if (result === 'success') return (
      <span className="flex items-center gap-1 text-green-700">
        <CheckCircle2 className="w-3.5 h-3.5" /> 成功
      </span>
    )
    if (result === 'failed') return (
      <span className="flex items-center gap-1 text-red-600">
        <XCircle className="w-3.5 h-3.5" /> 失敗
      </span>
    )
    return (
      <span className="flex items-center gap-1 text-amber-600">
        <Clock className="w-3.5 h-3.5" /> 処理中
      </span>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LINE通知ログ</h1>
          <p className="text-sm text-gray-500 mt-0.5">全{count?.toLocaleString()}件</p>
        </div>
        <form className="flex gap-2 flex-wrap">
          <select name="result" defaultValue={params.result ?? ''}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">全結果</option>
            <option value="success">成功</option>
            <option value="failed">失敗</option>
            <option value="pending">処理中</option>
          </select>
          <select name="type" defaultValue={params.type ?? ''}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">全種別</option>
            {Object.entries(NOTIFICATION_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            絞り込み
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">送信日時</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">案件名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">部門</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">通知種別</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">送信先</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">結果</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">リトライ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">エラー</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(logs ?? []).length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">ログがありません</td></tr>
              ) : (
                (logs ?? []).map((log) => {
                  const project = (log as any).project
                  const sentAt = log.sent_at
                    ? new Date(log.sent_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
                    : new Date(log.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{sentAt}</td>
                      <td className="px-4 py-3 font-medium max-w-40 truncate">
                        {project?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {project?.department?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium whitespace-nowrap">
                          {NOTIFICATION_TYPE_LABELS[log.notification_type] ?? log.notification_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {TARGET_TYPE_LABELS[log.send_target ?? ''] ?? log.send_target ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {resultBadge(log.result)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {log.retry_count ?? 0}回
                      </td>
                      <td className="px-4 py-3 text-xs text-red-500 max-w-48 truncate" title={log.error_message ?? ''}>
                        {log.error_message ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {log.result === 'failed' && (
                          <ResendButton logId={log.id} />
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a key={p}
              href={`?${new URLSearchParams({ ...params, page: String(p) })}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
