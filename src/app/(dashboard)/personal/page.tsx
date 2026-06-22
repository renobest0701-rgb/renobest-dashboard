import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { calcPersonalMetrics, formatYen, formatPercent } from '@/lib/calculations'
import { MetricCard, ProgressBar } from '@/components/dashboard/MetricCard'
import { SalesTrendChart } from '@/components/charts/SalesTrendChart'
import { ProfitTrendChart } from '@/components/charts/ProfitTrendChart'
import type { Project, Target, ProspectWeight } from '@/types'

export default async function PersonalDashboardPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`

  // 自分の担当案件（削除済み除く）
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .is('deleted_at', null)
    .or(`created_by.eq.${user.id},id.in.(${
      `select project_id from project_assignments where user_id='${user.id}'`
    })`)
    .order('updated_at', { ascending: false })

  // 月次目標
  const { data: monthlyTarget } = await supabase
    .from('targets')
    .select('*')
    .eq('user_id', user.id)
    .eq('target_scope', 'personal')
    .eq('target_period', 'monthly')
    .eq('target_year', year)
    .eq('target_month', month)
    .single()

  // 年次目標
  const { data: yearlyTarget } = await supabase
    .from('targets')
    .select('*')
    .eq('user_id', user.id)
    .eq('target_scope', 'personal')
    .eq('target_period', 'yearly')
    .eq('target_year', year)
    .single()

  // 販促費（今月・担当者）
  const { data: promoData } = await supabase
    .from('promotional_expenses')
    .select('amount, project_id')
    .eq('user_id', user.id)
    .eq('expense_month', monthStart)

  // 固定経費負担（今月）
  const { data: fixedData } = await supabase
    .from('fixed_expenses')
    .select('amount')
    .eq('user_id', user.id)
    .eq('expense_month', monthStart)

  // 見込み確度設定
  const { data: weights } = await supabase
    .from('prospect_weights')
    .select('*')

  const allProjects = (projects ?? []) as Project[]

  // 今月の案件（contract_date, payment_date, application_dateが今月 or 現在進行中）
  const monthProjects = allProjects.filter((p) => {
    const relevantDate = p.payment_date || p.invoice_date || p.delivery_date ||
                         p.contract_date || p.application_date || p.updated_at
    if (!relevantDate) return false
    const d = new Date(relevantDate)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })

  // 見込み案件は常に含める
  const activeProspects = allProjects.filter((p) =>
    ['new','negotiating','prospect_b','prospect_a'].includes(p.status)
  )

  const metricsProjects = [
    ...monthProjects,
    ...activeProspects.filter((p) => !monthProjects.find((mp) => mp.id === p.id))
  ]

  const promoByProject: Record<string, number> = {}
  const totalPromo = (promoData ?? []).reduce((sum, e) => {
    if (e.project_id) promoByProject[e.project_id] = (promoByProject[e.project_id] ?? 0) + e.amount
    return sum + e.amount
  }, 0)
  const totalFixed = (fixedData ?? []).reduce((sum, e) => sum + e.amount, 0)

  const inputs = metricsProjects.map((p) => ({
    project: p,
    promoExpenses: promoByProject[p.id] ?? 0,
    fixedExpenseShare: 0,  // 固定費は月次合計で別途加算
  }))

  const metrics = calcPersonalMetrics(
    inputs,
    monthlyTarget as Target | null,
    (weights ?? []) as ProspectWeight[],
    now
  )

  // 固定費は全体合計で実現利益から引く（calcPersonalMetricsの結果を上書き）
  const adjustedRealizedProfit = metrics.realizedProfit - totalFixed
  const adjustedLanding = metrics.landingForecast - totalFixed

  const statusCounts = allProjects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // 自分のユーザーID取得
  const { data: meUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  const myUserId = meUser?.id

  // 今月の反響件数（週集計の合計）
  const weekStart = `${year}-${String(month).padStart(2, '0')}-01`
  const weekEnd = new Date(year, month, 0).toISOString().slice(0, 10)
  const { data: inquiryData } = myUserId ? await supabase
    .from('inquiry_reports')
    .select('count')
    .eq('user_id', myUserId)
    .gte('report_week', weekStart)
    .lte('report_week', weekEnd) : { data: [] }
  const totalInquiry = (inquiryData ?? []).reduce((s, r) => s + r.count, 0)

  // 今月の新規接客数（案件登録数）
  const { count: newClientCount } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', myUserId ?? '')
    .gte('created_at', `${weekStart}T00:00:00`)
    .lte('created_at', `${weekEnd}T23:59:59`)
    .is('deleted_at', null)
    .neq('status', 'cancelled')

  // 今月の契約件数
  const contractCount = statusCounts['contracted'] ?? 0

  // 転換率
  const inquiryToMeeting = totalInquiry > 0 ? Math.round((newClientCount ?? 0) / totalInquiry * 100) : null
  const meetingToContract = (newClientCount ?? 0) > 0 ? Math.round(contractCount / (newClientCount ?? 1) * 100) : null

  // 月次トレンドデータ（過去6ヶ月）
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i), 1)
    return { y: d.getFullYear(), m: d.getMonth() + 1, label: `${d.getMonth() + 1}月` }
  })

  const trendData = await Promise.all(
    trendMonths.map(async ({ y, m, label }) => {
      const { data: tp } = await supabase
        .from('projects')
        .select('status, sales_amount, cost_confirmed, cost_planned')
        .eq('created_by', myUserId ?? '')
        .is('deleted_at', null)
      const paid = (tp ?? []).filter((p) => p.status === 'paid')
      const contracted = (tp ?? []).filter((p) => ['contracted','delivered','invoiced','paid'].includes(p.status))
      return {
        month: label,
        入金売上: paid.reduce((s, p) => s + p.sales_amount, 0),
        契約売上: contracted.reduce((s, p) => s + p.sales_amount, 0),
        実現利益: paid.reduce((s, p) => s + p.sales_amount - p.cost_confirmed, 0),
        契約利益: contracted.reduce((s, p) => s + p.sales_amount - p.cost_planned, 0),
      }
    })
  )

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user.fullName} さんの成績</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {year}年{month}月 — リアルタイム集計
          </p>
        </div>
      </div>

      {/* 月間 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">月間成績</h2>

        {/* 進捗バー */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-4">
          <ProgressBar
            label="売上進捗率"
            value={metrics.progressRateSales}
            target={metrics.salesTarget}
            color={metrics.progressRateSales >= 1 ? 'green' : metrics.progressRateSales >= 0.7 ? 'blue' : 'amber'}
          />
          <ProgressBar
            label="利益進捗率"
            value={metrics.progressRateProfit}
            target={metrics.profitTarget}
            color={metrics.progressRateProfit >= 1 ? 'green' : metrics.progressRateProfit >= 0.7 ? 'blue' : 'red'}
          />
          <ProgressBar
            label="着地見込達成率"
            value={metrics.landingAchievementRate}
            color="amber"
          />
        </div>

        {/* 売上カード */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-3">
          <MetricCard label="月間売上目標"         value={formatYen(metrics.salesTarget)} variant="primary" />
          <MetricCard label="契約・受注済売上"      value={formatYen(metrics.contractedSales)} />
          <MetricCard label="引渡し・納品済売上"    value={formatYen(metrics.deliveredSales)} />
          <MetricCard label="入金済売上"            value={formatYen(metrics.paidSales)} variant="success" />
        </div>

        {/* 利益カード */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-3">
          <MetricCard label="月間利益目標"          value={formatYen(metrics.profitTarget)} variant="primary" />
          <MetricCard label="契約ベース利益"         value={formatYen(metrics.contractProfit)} />
          <MetricCard label="実現利益（入金ベース）" value={formatYen(adjustedRealizedProfit)}
            variant={adjustedRealizedProfit < 0 ? 'danger' : 'success'} />
          <MetricCard label="見込み利益"             value={formatYen(metrics.prospectProfit)} />
          <MetricCard label="加重見込み利益"         value={formatYen(metrics.weightedProspectProfit)} />
        </div>

        {/* 経費・着地 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <MetricCard label="販促費"                value={formatYen(totalPromo)} />
          <MetricCard label="固定経費負担額"         value={formatYen(totalFixed)} />
          <MetricCard
            label="月末着地予測"
            value={formatYen(adjustedLanding)}
            variant={adjustedLanding >= metrics.profitTarget ? 'success' : 'warning'}
            size="lg"
          />
          <MetricCard
            label="目標まで不足"
            value={metrics.profitShortfall <= 0
              ? `▲ ${formatYen(Math.abs(metrics.profitShortfall))}`
              : `+${formatYen(metrics.profitShortfall)}`}
            variant={metrics.profitShortfall < 0 ? 'danger' : 'success'}
          />
        </div>
      </section>

      {/* 入金待ち */}
      {metrics.pendingPaymentCount > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">入金待ち状況</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="入金待ち件数" value={`${metrics.pendingPaymentCount}件`} />
            <MetricCard label="入金待ち売上" value={formatYen(metrics.pendingPaymentSales)} />
            <MetricCard label="入金待ち利益" value={formatYen(metrics.pendingPaymentProfit)} />
            <MetricCard
              label="入金遅延件数"
              value={`${metrics.overduePaymentCount}件`}
              variant={metrics.overduePaymentCount > 0 ? 'danger' : 'default'}
              isWarning={metrics.overduePaymentCount > 0}
            />
          </div>
        </section>
      )}

      {/* 反響・接客 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">反響・接客（今月）</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="総反響件数" value={`${totalInquiry}件`} />
          <MetricCard label="新規接客件数" value={`${newClientCount ?? 0}件`} />
          <MetricCard
            label="反響→接客率"
            value={inquiryToMeeting !== null ? `${inquiryToMeeting}%` : '—'}
            variant={inquiryToMeeting !== null && inquiryToMeeting >= 50 ? 'success' : 'default'}
          />
          <MetricCard
            label="接客→契約率"
            value={meetingToContract !== null ? `${meetingToContract}%` : '—'}
            variant={meetingToContract !== null && meetingToContract >= 30 ? 'success' : 'default'}
          />
        </div>
      </section>

      {/* グラフ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">月次売上推移（過去6ヶ月）</h3>
          <SalesTrendChart data={trendData} salesTarget={metrics.salesTarget} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">月次利益推移（過去6ヶ月）</h3>
          <ProfitTrendChart data={trendData} profitTarget={metrics.profitTarget} />
        </div>
      </section>

      {/* 営業実績 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">営業実績（累計）</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricCard size="sm" label="契約・受注"  value={`${statusCounts['contracted'] ?? 0}件`} />
          <MetricCard size="sm" label="引渡し・納品" value={`${statusCounts['delivered'] ?? 0}件`} />
          <MetricCard size="sm" label="入金済"      value={`${statusCounts['paid'] ?? 0}件`} variant="success" />
          <MetricCard size="sm" label="見込みA"     value={`${statusCounts['prospect_a'] ?? 0}件`} />
          <MetricCard size="sm" label="見込みB"     value={`${statusCounts['prospect_b'] ?? 0}件`} />
          <MetricCard size="sm" label="失注・没"    value={`${statusCounts['lost'] ?? 0}件`} variant="danger" />
        </div>
      </section>
    </div>
  )
}
