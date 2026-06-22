import { requireAuth, isDeptManager, isAdminOrExecutive } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getDepartments, getProspectWeights } from '@/lib/cached-data'
import { redirect } from 'next/navigation'
import { aggregateProjects, formatYen, formatPercent, calcProgressRate } from '@/lib/calculations'
import { MetricCard, ProgressBar } from '@/components/dashboard/MetricCard'
import { SalesProgressChart } from '@/components/charts/SalesProgressChart'
import { ProfitTrendChart } from '@/components/charts/ProfitTrendChart'
import { SalesTrendChart } from '@/components/charts/SalesTrendChart'
import { MemberBarChart } from '@/components/charts/MemberBarChart'
import { InquiryChart } from '@/components/charts/InquiryChart'
import { CsvExportButton } from '@/components/dashboard/CsvExportButton'
import type { ProspectWeight } from '@/types'

export default async function DepartmentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; year?: string; month?: string }>
}) {
  const user = await requireAuth()
  const params = await searchParams

  if (!isDeptManager(user) && !isAdminOrExecutive(user)) {
    redirect('/personal')
  }

  const supabase = await createClient()

  const now = new Date()
  const year = parseInt(params.year ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`

  // 部門一覧（キャッシュ）
  const departments = await getDepartments()

  // アクセス可能な部門を絞る
  const accessibleDepts = isAdminOrExecutive(user)
    ? departments ?? []
    : (departments ?? []).filter((d) =>
        isDeptManager(user, d.id)
      )

  const selectedDeptId = params.dept ?? accessibleDepts[0]?.id
  const selectedDept = accessibleDepts.find((d) => d.id === selectedDeptId)

  if (!selectedDeptId || !selectedDept) {
    return <div className="p-6 text-gray-500">部門が見つかりません</div>
  }

  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10)

  // 全データを並列取得
  const [
    { data: projects },
    weights,
    { data: deptTargets },
    { data: promoData },
    { data: fixedData },
    { data: members },
    { data: memberTargets },
    { data: memberPromo },
    { data: memberFixed },
    { data: allInquiries },
    { data: allNewProjects },
  ] = await Promise.all([
    supabase.from('projects').select('id, status, sales_amount, cost_planned, cost_confirmed, prospect_rank, payment_plan_date, payment_date, contract_date, created_by').eq('department_id', selectedDeptId).is('deleted_at', null),
    getProspectWeights(),
    supabase.from('targets').select('target_period, target_month, sales_target, profit_target').eq('department_id', selectedDeptId).eq('target_scope', 'department').eq('target_year', year),
    supabase.from('promotional_expenses').select('amount').eq('department_id', selectedDeptId).eq('expense_month', monthStart),
    supabase.from('fixed_expenses').select('amount').eq('department_id', selectedDeptId).eq('expense_month', monthStart),
    supabase.from('users').select('id, full_name').eq('department_id', selectedDeptId).eq('is_active', true).is('deleted_at', null),
    supabase.from('targets').select('user_id, target_period, target_month, sales_target, profit_target').eq('target_scope', 'personal').eq('target_year', year).not('user_id', 'is', null),
    supabase.from('promotional_expenses').select('user_id, amount').eq('expense_month', monthStart).not('user_id', 'is', null),
    supabase.from('fixed_expenses').select('user_id, amount').eq('expense_month', monthStart).not('user_id', 'is', null),
    supabase.from('inquiry_reports').select('user_id, count').gte('report_week', monthStart).lte('report_week', monthEnd),
    supabase.from('projects').select('id, created_by').gte('created_at', `${monthStart}T00:00:00`).lte('created_at', `${monthEnd}T23:59:59`).is('deleted_at', null).neq('status', 'cancelled').eq('department_id', selectedDeptId),
  ])

  const monthlyTarget = (deptTargets ?? []).find((t) => t.target_period === 'monthly' && t.target_month === month) ?? null
  const yearlyTarget = (deptTargets ?? []).find((t) => t.target_period === 'yearly') ?? null
  const promoTotal = (promoData ?? []).reduce((s, e) => s + e.amount, 0)
  const fixedTotal = (fixedData ?? []).reduce((s, e) => s + e.amount, 0)

  // バッチデータをユーザー別にグループ化
  const memberPromoByUser: Record<string, number> = {}
  for (const e of memberPromo ?? []) {
    if (e.user_id) memberPromoByUser[e.user_id] = (memberPromoByUser[e.user_id] ?? 0) + e.amount
  }
  const memberFixedByUser: Record<string, number> = {}
  for (const e of memberFixed ?? []) {
    if (e.user_id) memberFixedByUser[e.user_id] = (memberFixedByUser[e.user_id] ?? 0) + e.amount
  }
  const inquiryByUser: Record<string, number> = {}
  for (const r of allInquiries ?? []) {
    inquiryByUser[r.user_id] = (inquiryByUser[r.user_id] ?? 0) + r.count
  }
  const newProjByUser: Record<string, number> = {}
  for (const p of allNewProjects ?? []) {
    if (p.created_by) newProjByUser[p.created_by] = (newProjByUser[p.created_by] ?? 0) + 1
  }

  const metrics = aggregateProjects(
    (projects ?? []) as any[],
    promoTotal,
    fixedTotal,
    monthlyTarget,
    yearlyTarget,
    weights as ProspectWeight[],
    year,
    month,
    now
  )

  // メンバー別成績（クエリなし・JS集計）
  const memberStats = (members ?? []).map((member) => {
    const ps = (projects ?? []).filter((p) => p.created_by === member.id)
    const mTarget = (memberTargets ?? []).find((t) => t.user_id === member.id && t.target_period === 'monthly' && t.target_month === month)
    const mYearlyTarget = (memberTargets ?? []).find((t) => t.user_id === member.id && t.target_period === 'yearly')
    const mPromoTotal = memberPromoByUser[member.id] ?? 0
    const mFixedTotal = memberFixedByUser[member.id] ?? 0

    const paidSales = ps.filter((p) => p.status === 'paid').reduce((s, p) => s + p.sales_amount, 0)
    const contractedSales = ps.filter((p) => ['contracted','delivered','invoiced','paid'].includes(p.status)).reduce((s, p) => s + p.sales_amount, 0)
    const paidCost = ps.filter((p) => p.status === 'paid').reduce((s, p) => s + p.cost_confirmed, 0)
    const contractCost = ps.filter((p) => ['contracted','delivered','invoiced','paid'].includes(p.status)).reduce((s, p) => s + p.cost_planned, 0)
    const realizedProfit = paidSales - paidCost - mPromoTotal - mFixedTotal
    const contractProfit = contractedSales - contractCost - mPromoTotal - mFixedTotal
    const inquiryCount = inquiryByUser[member.id] ?? 0
    const meetingCount = newProjByUser[member.id] ?? 0
    const contractCount = ps.filter((p) => ['contracted','delivered','invoiced','paid'].includes(p.status)).length

    return {
      id: member.id,
      name: member.full_name,
      salesTarget: mTarget?.sales_target ?? 0,
      profitTarget: mTarget?.profit_target ?? 0,
      yearlySalesTarget: mYearlyTarget?.sales_target ?? 0,
      yearlyProfitTarget: mYearlyTarget?.profit_target ?? 0,
      contractedSales,
      paidSales,
      realizedProfit,
      contractProfit,
      promoExpenses: mPromoTotal,
      fixedExpenses: mFixedTotal,
      progressRateProfit: calcProgressRate(realizedProfit, mTarget?.profit_target ?? 0),
      yearlyProgressRateProfit: calcProgressRate(realizedProfit, mYearlyTarget?.profit_target ?? 0),
      inquiryCount,
      meetingCount,
      contractCount,
      inquiryToMeeting: inquiryCount > 0 ? Math.round(meetingCount / inquiryCount * 100) : null,
      meetingToContract: meetingCount > 0 ? Math.round(contractCount / meetingCount * 100) : null,
    }
  })

  // trendData: allProjectsから日付でフィルタリング
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i), 1)
    return {
      m: d.getMonth() + 1,
      label: `${d.getMonth() + 1}月`,
      start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10),
    }
  })
  const trendData = trendMonths.map(({ label, start, end }) => {
    const tp = (projects ?? []).filter((p) => {
      const d = p.payment_date || p.contract_date
      return d && d >= start && d <= end
    })
    const paid = tp.filter((p) => p.status === 'paid')
    const contracted = tp.filter((p) => ['contracted','delivered','invoiced','paid'].includes(p.status))
    return {
      month: label,
      入金売上: paid.reduce((s, p) => s + p.sales_amount, 0),
      契約売上: contracted.reduce((s, p) => s + p.sales_amount, 0),
      実現利益: paid.reduce((s, p) => s + p.sales_amount - p.cost_confirmed, 0),
      契約利益: contracted.reduce((s, p) => s + p.sales_amount - p.cost_planned, 0),
    }
  })

  // CSV用データ
  const csvData = memberStats.map((m) => ({
    氏名: m.name,
    売上目標: m.salesTarget,
    利益目標: m.profitTarget,
    契約売上: m.contractedSales,
    入金売上: m.paidSales,
    実現利益: m.realizedProfit,
    契約利益: m.contractProfit,
    販促費: m.promoExpenses,
    固定経費: m.fixedExpenses,
    月間利益進捗率: `${(m.progressRateProfit * 100).toFixed(1)}%`,
    年間利益進捗率: `${(m.yearlyProgressRateProfit * 100).toFixed(1)}%`,
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">部門ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-0.5">{year}年{month}月</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* 部門選択 */}
          <form className="flex gap-2">
            <select name="dept" defaultValue={selectedDeptId}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {accessibleDepts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select name="year" defaultValue={year}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
            <select name="month" defaultValue={month}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
            <button type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              表示
            </button>
          </form>
          <CsvExportButton data={csvData} filename={`${selectedDept.name}_${year}${String(month).padStart(2,'0')}_member`} />
        </div>
      </div>

      {/* 月間成績 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">月間成績 — {selectedDept.name}</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-3">
          <ProgressBar label="月間売上進捗率" value={metrics.progressRateSales} target={metrics.salesTarget}
            color={metrics.progressRateSales >= 1 ? 'green' : 'blue'} />
          <ProgressBar label="月間利益進捗率" value={metrics.progressRateProfit} target={metrics.profitTarget}
            color={metrics.progressRateProfit >= 1 ? 'green' : metrics.progressRateProfit >= 0.7 ? 'blue' : 'red'} />
          <ProgressBar label="着地見込達成率" value={metrics.landingAchievementRate} color="amber" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="月間売上目標"    value={formatYen(metrics.salesTarget)} variant="primary" />
          <MetricCard label="月間利益目標"    value={formatYen(metrics.profitTarget)} variant="primary" />
          <MetricCard label="契約・受注済売上" value={formatYen(metrics.contractedSales)} />
          <MetricCard label="入金済売上"       value={formatYen(metrics.paidSales)} variant="success" />
          <MetricCard label="月末着地予測"     value={formatYen(metrics.landingForecast)}
            variant={metrics.landingForecast >= metrics.profitTarget ? 'success' : 'warning'} size="lg" />
          <MetricCard label="契約利益"         value={formatYen(metrics.contractProfit)} />
          <MetricCard label="実現利益"          value={formatYen(metrics.realizedProfit)}
            variant={metrics.realizedProfit < 0 ? 'danger' : 'success'} />
          <MetricCard label="見込み利益"        value={formatYen(metrics.prospectProfit)} />
          <MetricCard label="販促費"            value={formatYen(metrics.promotionalExpenses)} />
          <MetricCard label="固定経費"          value={formatYen(metrics.fixedExpenses)} />
          <MetricCard label="月間不足利益"       value={metrics.profitShortfall < 0
            ? `▲ ${formatYen(Math.abs(metrics.profitShortfall))}`
            : `+${formatYen(metrics.profitShortfall)}`}
            variant={metrics.profitShortfall < 0 ? 'danger' : 'success'} />
        </div>
      </section>

      {/* 年間成績 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">年間成績 — {year}年</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="年間売上目標"     value={formatYen(metrics.yearlySalesTarget)} variant="primary" />
          <MetricCard label="年間利益目標"     value={formatYen(metrics.yearlyProfitTarget)} variant="primary" />
          <MetricCard label="年間契約売上"     value={formatYen(metrics.yearlyContractedSales)} />
          <MetricCard label="年間入金済売上"   value={formatYen(metrics.yearlyPaidSales)} variant="success" />
          <MetricCard label="年間実現利益"     value={formatYen(metrics.yearlyRealizedProfit)}
            variant={metrics.yearlyRealizedProfit < 0 ? 'danger' : 'success'} />
          <MetricCard label="年間売上進捗率"   value={formatPercent(metrics.yearlyProgressRateSales)} />
          <MetricCard label="年間利益進捗率"   value={formatPercent(metrics.yearlyProgressRateProfit)}
            variant={metrics.yearlyProgressRateProfit >= 1 ? 'success' : 'default'} />
          <MetricCard label="年間不足利益"
            value={(() => {
              const s = metrics.yearlyRealizedProfit - metrics.yearlyProfitTarget
              return s < 0 ? `▲ ${formatYen(Math.abs(s))}` : `+${formatYen(s)}`
            })()}
            variant={(metrics.yearlyRealizedProfit - metrics.yearlyProfitTarget) < 0 ? 'danger' : 'success'} />
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

      {/* メンバー比較グラフ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">メンバー別売上比較</h3>
          <MemberBarChart data={memberStats.map((m) => ({
            name: m.name,
            契約売上: m.contractedSales,
            入金売上: m.paidSales,
            目標: m.salesTarget,
          }))} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">メンバー別 反響・接客・契約（今月）</h3>
          <InquiryChart data={memberStats.map((m) => ({
            name: m.name,
            反響数: m.inquiryCount,
            接客数: m.meetingCount,
            契約数: m.contractCount,
          }))} />
        </div>
      </section>

      {/* メンバー比較 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">メンバー比較</h2>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">氏名</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">売上目標</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">利益目標</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">契約売上</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">入金売上</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">実現利益</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">契約利益</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">販促費</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">固定経費</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">月間利益進捗</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">年間利益進捗</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">反響数</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">接客数</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">契約数</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">反響→接客率</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">接客→契約率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {memberStats.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm">{formatYen(m.salesTarget)}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm">{formatYen(m.profitTarget)}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm">{formatYen(m.contractedSales)}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-green-700">{formatYen(m.paidSales)}</td>
                    <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${m.realizedProfit < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {formatYen(m.realizedProfit)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm">{formatYen(m.contractProfit)}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm text-orange-600">{formatYen(m.promoExpenses)}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm">{formatYen(m.fixedExpenses)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        m.progressRateProfit >= 1 ? 'bg-green-100 text-green-700'
                        : m.progressRateProfit >= 0.7 ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                        {formatPercent(m.progressRateProfit)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        m.yearlyProgressRateProfit >= 1 ? 'bg-green-100 text-green-700'
                        : m.yearlyProgressRateProfit >= 0.7 ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                        {formatPercent(m.yearlyProgressRateProfit)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-sm">{m.inquiryCount}件</td>
                    <td className="px-3 py-3 text-right text-sm">{m.meetingCount}件</td>
                    <td className="px-3 py-3 text-right text-sm">{m.contractCount}件</td>
                    <td className="px-3 py-3 text-right">
                      {m.inquiryToMeeting !== null
                        ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.inquiryToMeeting >= 50 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{m.inquiryToMeeting}%</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {m.meetingToContract !== null
                        ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.meetingToContract >= 30 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{m.meetingToContract}%</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
