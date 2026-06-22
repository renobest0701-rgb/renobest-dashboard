import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { registerPayment } from './actions'
import { formatYen } from '@/lib/calculations'

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*, customer:customers(name), department:departments(name)')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!project) notFound()

  // 入金登録できるのはdelivered状態の案件のみ
  if (project.status !== 'delivered') {
    redirect(`/projects/${id}`)
  }

  const unrealizedProfit = project.sales_amount - project.cost_confirmed

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">入金登録</h1>
        <p className="text-sm text-gray-500 mt-1">入金を確認したら以下を入力してください</p>
      </div>

      {/* 案件サマリ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-700 text-sm">案件情報</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">案件名</dt>
          <dd className="font-medium">{project.name}</dd>
          <dt className="text-gray-500">顧客名</dt>
          <dd>{(project as any).customer?.name ?? '—'}</dd>
          <dt className="text-gray-500">売上金額</dt>
          <dd className="font-medium text-blue-700">{formatYen(project.sales_amount)}</dd>
          <dt className="text-gray-500">確定原価</dt>
          <dd>{formatYen(project.cost_confirmed)}</dd>
          <dt className="text-gray-500">実現利益（見込）</dt>
          <dd className={`font-medium ${unrealizedProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatYen(unrealizedProfit)}
          </dd>
          <dt className="text-gray-500">入金予定日</dt>
          <dd>{project.payment_plan_date ?? '未設定'}</dd>
        </dl>
      </div>

      {/* 入金登録フォーム */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-700 text-sm mb-4">入金情報を入力</h2>
        <form action={registerPayment as unknown as (formData: FormData) => void} className="space-y-4">
          <input type="hidden" name="projectId" value={id} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              入金日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="paymentDate"
              required
              defaultValue={project.payment_plan_date ?? ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              実際の入金額（万円・税込）
            </label>
            <input
              type="number"
              name="actualAmount"
              step="0.01"
              placeholder={String(project.sales_amount)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              空欄の場合は案件の売上金額（{formatYen(project.sales_amount)}）を使用します
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              確定原価（万円・税込）
            </label>
            <input
              type="number"
              name="finalCost"
              step="0.01"
              defaultValue={project.cost_confirmed || project.cost_planned}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
            <textarea
              name="memo"
              rows={3}
              placeholder="入金に関する特記事項があれば入力してください"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <a
              href={`/projects/${id}`}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium text-center hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </a>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              入金登録する
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
