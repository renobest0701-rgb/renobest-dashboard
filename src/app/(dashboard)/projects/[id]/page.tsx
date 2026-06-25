import { notFound } from 'next/navigation'
import { requireAuth, canViewProject, isNonSales } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PROJECT_STATUS_LABELS, FLOW_TYPE_LABELS, type Project, type ProjectStatus } from '@/types'
import { formatYen, calcProjectDurations } from '@/lib/calculations'
import { StatusChangeForm } from '@/components/projects/StatusChangeForm'
import { ImportantChangeForm } from '@/components/projects/ImportantChangeForm'
import { SharingEditor } from '@/components/projects/SharingEditor'
import { AssignmentsEditor } from '@/components/projects/AssignmentsEditor'
import { AlertTriangle, Lock } from 'lucide-react'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireAuth()
  const supabase = await createClient()

  const { data } = await supabase
    .from('projects')
    .select(`
      *,
      department:departments(name),
      customer:customers(name),
      created_by_user:users!projects_created_by_fkey(full_name),
      assignments:project_assignments(
        assignment_role, commission_rate,
        user:users(full_name)
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!data) notFound()

  const project = data as any

  if (!canViewProject(user, project)) notFound()

  const readOnly = isNonSales(user)
  const durations = calcProjectDurations(project as Project)
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = project.payment_plan_date && !project.payment_date &&
    project.payment_plan_date < today &&
    ['contracted','delivered','invoiced'].includes(project.status)

  // 承認申請中の項目
  const { data: pendingApprovals } = await supabase
    .from('approval_requests')
    .select('field_name')
    .eq('project_id', id)
    .eq('status', 'pending')

  const pendingFields = new Set((pendingApprovals ?? []).map((a: any) => a.field_name))

  const grossProfit = project.sales_amount - (
    project.status === 'paid' ? project.cost_confirmed : project.cost_planned
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.is_locked && (
              <span className="flex items-center gap-1 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                <Lock className="w-3 h-3" />月次締め済み
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">{project.department?.name}</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">担当: {project.created_by_user?.full_name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium
            ${project.status === 'paid' ? 'bg-green-100 text-green-700' :
              project.status === 'contracted' ? 'bg-blue-100 text-blue-700' :
              project.status === 'cancelled' ? 'bg-red-200 text-red-800' :
              'bg-gray-100 text-gray-700'}`}
          >
            {PROJECT_STATUS_LABELS[project.status as ProjectStatus]}
          </span>
        </div>
      </div>

      {isOverdue && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          入金予定日（{project.payment_plan_date}）を超過しています。入金確認をしてください。
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左：金額・利益 */}
        <div className="lg:col-span-2 space-y-4">

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-4">金額情報</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">売上予定額</div>
                <div className="text-lg font-bold">{formatYen(project.sales_amount)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">予定原価</div>
                <div className="text-lg font-bold">{formatYen(project.cost_planned)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">確定原価</div>
                <div className="text-lg font-bold">{formatYen(project.cost_confirmed)}</div>
              </div>
              <div className={grossProfit < 0 ? 'text-red-600' : 'text-green-700'}>
                <div className="text-xs text-gray-500 mb-0.5">粗利益（予定）</div>
                <div className="text-lg font-bold">{formatYen(grossProfit)}</div>
              </div>
            </div>
          </div>

          {/* 日程 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-4">日程管理</h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              {[
                ['新規反響日', project.echo_date],
                ['初回接客日', project.first_meeting_date],
                ['申込日', project.application_date],
                ['契約予定日', project.contract_plan_date],
                ['契約日', project.contract_date],
                ['引渡し予定日', project.delivery_plan_date],
                ['引渡し日', project.delivery_date],
                ['請求予定日', project.invoice_plan_date],
                ['請求日', project.invoice_date],
                ['入金予定日', project.payment_plan_date],
                ['入金日', project.payment_date],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium">{val ?? '—'}</span>
                </div>
              ))}
            </div>

            {/* 日数計算 */}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">経過日数</h3>
              {[
                ['反響→初回接客', durations.echoToFirstMeeting],
                ['初回接客→申込', durations.firstMeetingToApp],
                ['申込→契約', durations.appToContract],
                ['契約→引渡し', durations.contractToDelivery],
                ['引渡し→入金', durations.deliveryToPayment],
                ['初回接客→入金（合計）', durations.firstMeetingToPayment],
              ].filter(([, v]) => v !== null).map(([label, val]) => (
                <div key={String(label)} className="flex justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium">{val}日</span>
                </div>
              ))}
            </div>
          </div>

          {/* 商流 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 mb-3">商流情報</h2>
            <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">商流区分</span>
                <span className="font-medium">{FLOW_TYPE_LABELS[project.flow_type as keyof typeof FLOW_TYPE_LABELS] ?? project.flow_type}</span>
              </div>
              {project.client_name && (
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500">顧客・発注者</span>
                  <span className="font-medium">{project.client_name}</span>
                </div>
              )}
              {project.referrer_name && (
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500">紹介者</span>
                  <span className="font-medium">{project.referrer_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* 会社/チーム負担 */}
          {!readOnly && (
            <SharingEditor
              projectId={project.id}
              salesAmount={project.sales_amount}
              companySalesShare={project.company_sales_share ?? 0}
              teamSalesShare={project.team_sales_share ?? 0}
              companyCostShare={project.company_cost_share ?? 0}
              teamCostShare={project.team_cost_share ?? 0}
              isLocked={project.is_locked}
            />
          )}

          {/* 共同担当者 */}
          <AssignmentsEditor
            projectId={project.id}
            assignments={project.assignments ?? []}
            createdByName={project.created_by_user?.full_name ?? ''}
            isLocked={project.is_locked || readOnly}
          />

          {/* メモ */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500">メモ・コメント</h2>
            {project.customer_memo && (
              <div>
                <div className="text-xs text-gray-400 mb-1">顧客メモ</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.customer_memo}</p>
              </div>
            )}
            {project.negotiation_memo && (
              <div>
                <div className="text-xs text-gray-400 mb-1">商談メモ</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.negotiation_memo}</p>
              </div>
            )}
            {project.comment && (
              <div>
                <div className="text-xs text-gray-400 mb-1">コメント</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.comment}</p>
              </div>
            )}
            {!project.customer_memo && !project.negotiation_memo && !project.comment && (
              <p className="text-sm text-gray-400">メモなし</p>
            )}
          </div>
        </div>

        {/* 右：ステータス変更 */}
        <div className="space-y-4">
          {readOnly && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 text-center">
              閲覧専用モード
            </div>
          )}

          {!readOnly && (
            <StatusChangeForm
              projectId={project.id}
              currentStatus={project.status}
              isLocked={project.is_locked}
              pendingFields={Array.from(pendingFields)}
            />
          )}

          {!readOnly && (
            <ImportantChangeForm
              projectId={project.id}
              currentValues={{
                sales_amount:      project.sales_amount,
                cost_planned:      project.cost_planned,
                cost_confirmed:    project.cost_confirmed,
                contract_date:     project.contract_date,
                payment_plan_date: project.payment_plan_date,
              }}
              pendingFields={Array.from(pendingFields)}
            />
          )}

          {/* 入金登録ボタン（delivered状態のみ） */}
          {!readOnly && project.status === 'delivered' && (
            <a href={`/projects/${project.id}/payment`}
              className="block w-full px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-medium text-center hover:bg-green-700 transition-colors">
              入金登録する
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
