import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Bell, CheckCircle2, XCircle } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  application:      '新規申込',
  contract:         '新規契約・受注',
  payment:          '入金完了',
  cancel:           'キャンセル',
  important_change: '重要項目変更',
}

const TYPE_COLORS: Record<string, string> = {
  application:      'bg-blue-100 text-blue-700',
  contract:         'bg-green-100 text-green-700',
  payment:          'bg-emerald-100 text-emerald-700',
  cancel:           'bg-red-100 text-red-700',
  important_change: 'bg-amber-100 text-amber-700',
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const user = await requireAuth()
  const params = await searchParams
  const supabase = await createClient()

  // 担当案件に紐づく通知ログ + 自部門向け通知（過去30日）
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // 管理者・役員は全件、それ以外は担当案件 or 同部門のみDB側で絞り込む
  const isAdmin = isAdminOrExecutive(user)

  let query = supabase
    .from('line_notification_logs')
    .select(`
      *,
      project:projects!inner(
        id, name, status,
        department_id,
        created_by
      )
    `)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .eq('result', 'success')
    .order('created_at', { ascending: false })
    .limit(200)

  if (!isAdmin) {
    const filters = [`created_by.eq.${user.id}`]
    if (user.departmentId) filters.push(`department_id.eq.${user.departmentId}`)
    query = query.or(filters.join(','), { referencedTable: 'projects' })
  }

  if (params.type) query = query.eq('notification_type', params.type)

  const { data: logs } = await query
  const filtered = logs ?? []

  const grouped = groupByDate(filtered)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">通知履歴</h1>
          <p className="text-sm text-gray-500 mt-0.5">過去30日間の通知（担当案件・自部門）</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/notifications"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              !params.type ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            すべて
          </a>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <a key={v} href={`/notifications?type=${v}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                params.type === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}>
              {l}
            </a>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">通知はありません</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              {date}
            </h2>
            <div className="space-y-2">
              {items.map((log) => {
                const project = (log as any).project
                const sentAt = new Date(log.created_at).toLocaleTimeString('ja-JP', {
                  timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit'
                })

                return (
                  <a key={log.id}
                    href={project ? `/projects/${project.id}` : '#'}
                    className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
                    <div className="flex-shrink-0 mt-0.5">
                      {log.result === 'success'
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <XCircle className="w-4 h-4 text-red-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[log.notification_type] ?? 'bg-gray-100 text-gray-700'}`}>
                          {TYPE_LABELS[log.notification_type] ?? log.notification_type}
                        </span>
                        <span className="text-xs text-gray-400">{sentAt}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700 truncate">
                        {project?.name ?? '案件不明'}
                      </p>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function groupByDate(
  logs: any[],
): Record<string, any[]> {
  return logs.reduce((acc, log) => {
    const date = new Date(log.created_at).toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: 'long', day: 'numeric',
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(log)
    return acc
  }, {} as Record<string, any[]>)
}
