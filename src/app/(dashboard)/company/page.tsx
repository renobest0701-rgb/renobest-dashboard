import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getDepartments, getProspectWeights } from '@/lib/cached-data'
import { aggregateProjects, formatYen, formatPercent, calcProgressRate } from '@/lib/calculations'
import { MetricCard, ProgressBar } from '@/components/dashboard/MetricCard'
import { SalesProgressChart } from '@/components/charts/SalesProgressChart'
import { ProfitTrendChart } from '@/components/charts/ProfitTrendChart'
import { SalesTrendChart } from '@/components/charts/SalesTrendChart'
import { InquiryChart } from '@/components/charts/InquiryChart'
import { CsvExportButton } from '@/components/dashboard/CsvExportButton'
import type { ProspectWeight } from '@/types'

export default async function CompanyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  await requireAuth()
  const params = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const year = parseInt(params.year ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`

  const mWeekEnd = new Date(year, month, 0).toISOString().slice(0, 10)

  // 全データを並列取得（部門別クエリもまとめて取得）
  const [
    departments,
    weights,
    { data: companyMonthlyTarget },
    { data: companyYearlyTarget },
    { data: allProjects },
    { data: allPromo },
    { data: allFixed },
    { data: allDeptTargets },
    { data: allMembers },
    { data: allInquiries },
    { data: allNewProjects },
  ] = await Promise.all([
    getDepartments(),
    getProspectWeights(),
    supabase.from('targets').select('sales_target, profit_target')
      .eq('target_scope', 'company').eq('target_period', 'monthly')
      .eq('target_year', year).eq('target_month', month)
      .is('user_id', null).is('department_id', null).single(),
    supabase.from('targets').select('sales_target, profit_target')
      .eq('target_scope', 'company').eq('target_period', 'yearly')
      .eq('target_year', year).is('user_id', null).is('department_id', null).single(),
    supabase.from('projects').select('id, status, sales_amount, cost_planned, cost_confirmed, prospect_rank, payment_plan_date, payment_date, contract_date, department_id, created_by').is('deleted_at', null),
    supabase.from('promotional_expenses').select('amount, department_id').eq('expense_month', monthStart),
    supabase.from('fixed_expenses').select('amount, department_id').eq('expense_month', monthStart),
    supabase.from('targets').select('department_id, target_period, target_month, sales_target, profit_target')
      .eq('target_scope', 'department').eq('target_year', year).not('department_id', 'is', null),
    supabase.from('users').select('id, department_id').eq('is_active', true).is('deleted_at', null),
    supabase.from('inquiry_reports').select('user_id, count').gte('report_week', monthStart).lte('report_week', mWeekEnd),
    supabase.from('projects').select('id, created_by').gte('created_at', `${monthStart}T00:00:00`).lte('created_at', `${mWeekEnd}T23:59:59`).is('deleted_at', null).neq('status', 'cancelled'),
  ])

  const totalPromo = (allPromo ?? []).reduce((s, e) => s + e.amount, 0)
  const totalFixed = (allFixed ?? []).reduce((s, e) => s + e.amount, 0)

  // 全社集計
  const companyMetrics = aggregateProjects(
    (allProjects ?? []) as any[],
    totalPromo,
    totalFixed,
    companyMonthlyTarget,
    companyYearlyTarget,
    weights as ProspectWeight[],
    year,
    month,
    now
  )

  // バッチ取得データをJS側でグループ化
  const promoByDept: Record<string, number> = {}
  for (const e of allPromo ?? []) {
    if (e.department_id) promoByDept[e.department_id] = (promoByDept[e.department_id] ?? 0) + e.amount
  }
  const fixedByDept: Record<string, number> = {}
  for (const e of allFixed ?? []) {
    if (e.department_id) fixedByDept[e.department_id] = (fixedByDept[e.department_id] ?? 0) + e.amount
  }
  const membersByDept: Record<string, string[]> = {}
  for (const m of allMembers ?? []) {
    if (m.department_id) {
      membersByDept[m.department_id] = membersByDept[m.department_id] ?? []
      membersByDept[m.department_id].push(m.id)
    }
  }
  const inquiryByUser: Record<string, number> = {}
  for (const r of allInquiries ?? []) {
    inquiryByUser[r.user_id] = (inquiryByUser[r.user_id] ?? 0) + r.count
  }
  const newProjByUser: Record<string, number> = {}
  for (const p of allNewProjects ?? []) {
    if (p.created_by) newProjByUser[p.created_by] = (newProjByUser[p.created_by] ?? 0) + 1
  }

  // 部門別集計（クエリなし・純粋JS集計）
  const deptMetrics = departments.map((dept) => {
    const deptProjects = (allProjects ?? []).filter((p) => p.department_id === dept.id)

    const dMonthTarget = (allDeptTargets ?? []).find((t) =>
      t.department_id === dept.id && t.target_period === 'monthly' && t.target_month === month
    )
    const dYearTarget = (allDeptTargets ?? []).find((t) =>
      t.department_id === dept.id && t.target_period === 'yearly'
    )

    const m = aggregateProjects(
      deptProjects as any[],
      promoByDept[dept.id] ?? 0,
      fixedByDept[dept.id] ?? 0,
      dMonthTarget ?? null,
      dYearTarget ?? null,
      weights as ProspectWeight[],
      year,
      month,
      now
    )

    const deptMemberIds = membersByDept[dept.id] ?? []
    const dInquiry = deptMemberIds.reduce((s, id) => s + (inquiryByUser[id] ?? 0), 0)
    const dMeeting = deptMemberIds.reduce((s, id) => s + (newProjByUser[id] ?? 0), 0)
    const dContract = deptProjects.filter((p) =>
      ['contracted','delivered','invoiced','paid'].includes(p.status)
    ).length

    return {
      dept, metrics: m,
      inquiryCount: dInquiry,
      meetingCount: dMeeting,
      contractCount: dContract,
      inquiryToMeeting: dInquiry > 0 ? Math.round(dMeeting / dInquiry * 100) : null,
      meetingToContract: dMeeting > 0 ? Math.round(dContract / dMeeting * 100) : null,
    }
  })

  // 月次トレンド（過去6ヶ月・全社）
  const trendData = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 1 - (5 - i), 1)
      return { y: d.getFullYear(), m: d.getMonth() + 1, label: `${d.getMonth() + 1}月` }
    }).map(async ({ label }) => {
      const paid = (allProjects ?? []).filter((p) => p.status === 'paid')
      const contracted = (allProjects ?? []).filter((p) =>
        ['contracted','delivered','invoiced','paid'].includes(p.status)
      )
      return {
        month: label,
        入金売上: paid.reduce((s, p) => s + p.sales_amount, 0),
        契約売上: contracted.reduce((s, p) => s + p.sales_amount, 0),
        実現利益: paid.reduce((s, p) => s + p.sales_amount - p.cost_confirmed, 0),
        契約利益: contracted.reduce((s, p) => s + p.sales_amount - p.cost_planned, 0),
      }
    })
  )

  // 部門比較CSVデータ
  const deptCsvData = deptMetrics.map(({ dept, metrics: m }) => ({
    部門: dept.name,
    売上目標: m.salesTarget,
    入金売上: m.paidSales,
    実現利益: m.realizedProfit,
    販促費: m.promotionalExpenses,
    固定経費: m.fixedExpenses,
    利益進捗率: formatPercent(m.progressRateProfit),
  }))

  // 最低必要利益（目標と同値、将来的に別設定可能にする）
  const minimumProfit = companyMetrics.profitTarget
  const shortfallToMinimum = companyMetrics.realizedProfit - minimumProfit

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">全社ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-0.5">{year}年{month}月</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <form className="flex gap-2">
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
          <CsvExportButton data={deptCsvData} filename={`全社部門比較_${year}${String(month).padStart(2,'0')}`} />
        </div>
      </div>

      {/* 全社月間 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">全社月間成績</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-3">
          <ProgressBar label="月間売上進捗率" value={companyMetrics.progressRateSales} target={companyMetrics.salesTarget}
            color={companyMetrics.progressRateSales >= 1 ? 'green' : 'blue'} />
          <ProgressBar label="月間利益進捗率" value={companyMetrics.progressRateProfit} target={companyMetrics.profitTarget}
            color={companyMetrics.progressRateProfit >= 1 ? 'green' : companyMetrics.progressRateProfit >= 0.7 ? 'blue' : 'red'} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <MetricCard label="全社売上目標"     value={formatYen(companyMetrics.salesTarget)} variant="primary" />
          <MetricCard label="全社利益目標"     value={formatYen(companyMetrics.profitTarget)} variant="primary" />
          <MetricCard label="契約・受注済売上" value={formatYen(companyMetrics.contractedSales)} />
          <MetricCard label="入金済売上"       value={formatYen(companyMetrics.paidSales)} variant="success" />
          <MetricCard label="実現利益"          value={formatYen(companyMetrics.realizedProfit)}
            variant={companyMetrics.realizedProfit < 0 ? 'danger' : 'success'} />
          <MetricCard label="契約利益"         value={formatYen(companyMetrics.contractProfit)} />
          <MetricCard label="見込み利益"        value={formatYen(companyMetrics.prospectProfit)} />
          <MetricCard label="販促費"            value={formatYen(companyMetrics.promotionalExpenses)} />
          <MetricCard label="固定経費"          value={formatYen(companyMetrics.fixedExpenses)} />
          <MetricCard label="全社貢献利益"      value={formatYen(companyMetrics.realizedProfit)} variant="success" />
          <MetricCard label="月末着地予測"      value={formatYen(companyMetrics.landingForecast)}
            variant={companyMetrics.landingForecast >= companyMetrics.profitTarget ? 'success' : 'warning'} size="lg" />
          <MetricCard label="計画との差額"
            value={(() => {
              const s = companyMetrics.realizedProfit - companyMetrics.profitTarget
              return s < 0 ? `▲ ${formatYen(Math.abs(s))}` : `+${formatYen(s)}`
            })()}
            variant={companyMetrics.realizedProfit < companyMetrics.profitTarget ? 'danger' : 'success'} />
          <MetricCard label="最低必要利益"     value={formatYen(minimumProfit)} />
          <MetricCard label="最低利益まで不足"
            value={shortfallToMinimum < 0 ? `▲ ${formatYen(Math.abs(shortfallToMinimum))}` : `+${formatYen(shortfallToMinimum)}`}
            variant={shortfallToMinimum < 0 ? 'danger' : 'success'}
            isWarning={shortfallToMinimum < 0} />
        </div>
      </section>

      {/* 全社年間 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">全社年間成績 — {year}年</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="年間売上目標"       value={formatYen(companyMetrics.yearlySalesTarget)} variant="primary" />
          <MetricCard label="年間利益目標"       value={formatYen(companyMetrics.yearlyProfitTarget)} variant="primary" />
          <MetricCard label="年間契約売上"       value={formatYen(companyMetrics.yearlyContractedSales)} />
          <MetricCard label="年間入金済売上"     value={formatYen(companyMetrics.yearlyPaidSales)} variant="success" />
          <MetricCard label="年間実現利益"       value={formatYen(companyMetrics.yearlyRealizedProfit)}
            variant={companyMetrics.yearlyRealizedProfit < 0 ? 'danger' : 'success'} />
          <MetricCard label="年間売上進捗率"     value={formatPercent(companyMetrics.yearlyProgressRateSales)} />
          <MetricCard label="年間利益進捗率"     value={formatPercent(companyMetrics.yearlyProgressRateProfit)}
            variant={companyMetrics.yearlyProgressRateProfit >= 1 ? 'success' : 'default'} />
          <MetricCard label="年間残り必要売上"
            value={formatYen(Math.max(0, companyMetrics.yearlySalesTarget - companyMetrics.yearlyPaidSales))} />
          <MetricCard label="年間残り必要利益"
            value={formatYen(Math.max(0, companyMetrics.yearlyProfitTarget - companyMetrics.yearlyRealizedProfit))} />
          <MetricCard label="年間着地予測"       value={formatYen(companyMetrics.yearlyLandingForecast)} variant="warning" />
        </div>
      </section>

      {/* グラフ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">全社月次売上推移（過去6ヶ月）</h3>
          <SalesTrendChart data={trendData} salesTarget={companyMetrics.salesTarget} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">全社利益推移（過去6ヶ月）</h3>
          <ProfitTrendChart data={trendData} profitTarget={companyMetrics.profitTarget} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">部門別売上比較</h3>
          <SalesProgressChart
            data={deptMetrics.map(({ dept, metrics: m }) => ({
              name: dept.name.replace('部門', ''),
              契約売上: m.contractedSales,
              入金済売上: m.paidSales,
              目標: m.salesTarget,
            }))}
          />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">部門別 反響・接客・契約（今月）</h3>
          <InquiryChart data={deptMetrics.map(({ dept, inquiryCount, meetingCount, contractCount }) => ({
            name: dept.name.replace('部門', ''),
            反響数: inquiryCount,
            接客数: meetingCount,
            契約数: contractCount,
          }))} />
        </div>
      </section>

      {/* 部門比較テーブル */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">部門別比較</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">部門</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">売上目標</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">入金売上</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">実現利益</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">販促費</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">固定経費</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">利益進捗率</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">月末着地</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">反響数</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">接客数</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">契約数</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">反響→接客率</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">接客→契約率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deptMetrics.map(({ dept, metrics: m, inquiryCount, meetingCount, contractCount, inquiryToMeeting, meetingToContract }) => (
                  <tr key={dept.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{dept.name}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatYen(m.salesTarget)}</td>
                    <td className="px-3 py-3 text-right font-mono text-green-700">{formatYen(m.paidSales)}</td>
                    <td className={`px-3 py-3 text-right font-mono font-semibold ${m.realizedProfit < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {formatYen(m.realizedProfit)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-orange-600">{formatYen(m.promotionalExpenses)}</td>
                    <td className="px-3 py-3 text-right font-mono">{formatYen(m.fixedExpenses)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        m.progressRateProfit >= 1 ? 'bg-green-100 text-green-700'
                        : m.progressRateProfit >= 0.7 ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                        {formatPercent(m.progressRateProfit)}
                      </span>
                    </td>
                    <td className={`px-3 py-3 text-right font-mono font-semibold ${
                      m.landingForecast >= m.profitTarget ? 'text-green-700' : 'text-amber-600'
                    }`}>
                      {formatYen(m.landingForecast)}
                    </td>
                    <td className="px-3 py-3 text-right text-sm">{inquiryCount}件</td>
                    <td className="px-3 py-3 text-right text-sm">{meetingCount}件</td>
                    <td className="px-3 py-3 text-right text-sm">{contractCount}件</td>
                    <td className="px-3 py-3 text-right">
                      {inquiryToMeeting !== null
                        ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${inquiryToMeeting >= 50 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{inquiryToMeeting}%</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {meetingToContract !== null
                        ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meetingToContract >= 30 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{meetingToContract}%</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
                {/* 全社合計行 */}
                <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                  <td className="px-4 py-3">全社合計</td>
                  <td className="px-3 py-3 text-right font-mono">{formatYen(companyMetrics.salesTarget)}</td>
                  <td className="px-3 py-3 text-right font-mono text-green-700">{formatYen(companyMetrics.paidSales)}</td>
                  <td className={`px-3 py-3 text-right font-mono ${companyMetrics.realizedProfit < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {formatYen(companyMetrics.realizedProfit)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-orange-600">{formatYen(companyMetrics.promotionalExpenses)}</td>
                  <td className="px-3 py-3 text-right font-mono">{formatYen(companyMetrics.fixedExpenses)}</td>
                  <td className="px-3 py-3 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      companyMetrics.progressRateProfit >= 1 ? 'bg-green-100 text-green-700'
                      : companyMetrics.progressRateProfit >= 0.7 ? 'bg-blue-100 text-blue-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      {formatPercent(companyMetrics.progressRateProfit)}
                    </span>
                  </td>
                  <td className={`px-3 py-3 text-right font-mono ${
                    companyMetrics.landingForecast >= companyMetrics.profitTarget ? 'text-green-700' : 'text-amber-600'
                  }`}>
                    {formatYen(companyMetrics.landingForecast)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm">
                    {deptMetrics.reduce((s, d) => s + d.inquiryCount, 0)}件
                  </td>
                  <td className="px-3 py-3 text-right text-sm">
                    {deptMetrics.reduce((s, d) => s + d.meetingCount, 0)}件
                  </td>
                  <td className="px-3 py-3 text-right text-sm">
                    {deptMetrics.reduce((s, d) => s + d.contractCount, 0)}件
                  </td>
                  <td className="px-3 py-3 text-right"><span className="text-gray-300 text-xs">—</span></td>
                  <td className="px-3 py-3 text-right"><span className="text-gray-300 text-xs">—</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
