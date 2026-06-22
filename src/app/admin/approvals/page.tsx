import { requireAuth, isAdminOrExecutive, isDeptManager } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ApprovalActions } from './ApprovalActions'
import type { ApprovalStatus } from '@/types'

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending:   '審査中',
  approved:  '承認済',
  rejected:  '却下済',
  withdrawn: '取り下げ',
}
const STATUS_COLORS: Record<ApprovalStatus, string> = {
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-500',
}

const FIELD_LABELS: Record<string, string> = {
  status:       'ステータス',
  sales_amount: '売上金額',
  cost_planned: '計画原価',
  cost_confirmed: '確定原価',
  payment_plan_date: '入金予定日',
  contract_date: '契約日',
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const user = await requireAuth()
  const isAdmin = isAdminOrExecutive(user)
  const isManager = isDeptManager(user)
  if (!isAdmin && !isManager) redirect('/personal')

  const params = await searchParams
  const supabase = await createClient()

  const statusFilter = (params.status as ApprovalStatus | undefined) ?? 'pending'

  let query = supabase
    .from('approval_requests')
    .select(`
      *,
      project:projects(id, name, department_id, department:departments(name)),
      requester:users!approval_requests_requester_id_fkey(full_name),
      approver:users!approval_requests_approver_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })

  if (statusFilter !== 'all' as any) {
    query = query.eq('status', statusFilter)
  }

  // 部門マネージャーは自部門案件のみ表示
  if (!isAdmin && isManager) {
    query = query.eq('project.department_id', user.departmentId ?? '')
  }

  const { data: requests } = await query

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">承認申請管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">重要変更・キャンセルの承認申請一覧</p>
        </div>
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
            <a key={s} href={`/admin/approvals?status=${s}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}>
              {s === 'all' ? 'すべて' : STATUS_LABELS[s as ApprovalStatus]}
            </a>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">申請日時</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">案件名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">部門</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">申請者</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">変更内容</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">理由</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">ステータス</th>
                <th className="px-4 py-3 w-40"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(requests ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    申請がありません
                  </td>
                </tr>
              ) : (
                (requests ?? []).map((req) => {
                  const project = (req as any).project
                  const requester = (req as any).requester
                  const approver = (req as any).approver
                  const status = req.status as ApprovalStatus
                  const createdAt = new Date(req.created_at).toLocaleString('ja-JP', {
                    timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })
                  const fieldLabel = FIELD_LABELS[req.field_name] ?? req.field_name

                  return (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{createdAt}</td>
                      <td className="px-4 py-3 font-medium">
                        <a href={`/projects/${project?.id}`}
                          className="hover:text-blue-600 hover:underline">
                          {project?.name ?? '—'}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {project?.department?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">{requester?.full_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs space-y-0.5">
                          <div className="font-medium text-gray-700">{fieldLabel}</div>
                          <div className="text-gray-500">
                            {req.old_value ?? '（なし）'} → <span className="text-gray-900 font-medium">{req.new_value}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-48">
                        <p className="truncate" title={req.reason ?? ''}>{req.reason || '—'}</p>
                        {req.rejection_reason && (
                          <p className="text-red-500 mt-1">却下理由: {req.rejection_reason}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
                          {STATUS_LABELS[status]}
                        </span>
                        {status !== 'pending' && approver && (
                          <p className="text-xs text-gray-400 mt-1">{approver.full_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {status === 'pending' && (
                          <ApprovalActions requestId={req.id} projectId={project?.id} fieldName={req.field_name} newValue={req.new_value} />
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
    </div>
  )
}
