'use client'

import useSWR from 'swr'
import { formatYen, formatPercent } from '@/lib/calculations'
import { MetricCard, ProgressBar } from '@/components/dashboard/MetricCard'
import { SalesTrendChart } from '@/components/charts/SalesTrendChart'
import { ProfitTrendChart } from '@/components/charts/ProfitTrendChart'
import { MemberBarChart } from '@/components/charts/MemberBarChart'
import { InquiryChart } from '@/components/charts/InquiryChart'
import { CsvExportButton } from '@/components/dashboard/CsvExportButton'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className ?? ''}`} />
}

export function DepartmentDashboardClient({ year, month, dept }: { year: number; month: number; dept: string }) {
  const key = `/api/dashboard/department?year=${year}&month=${month}${dept ? `&dept=${dept}` : ''}`
  const { data, isLoading } = useSWR(key, fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 })

  const m = data?.metrics
  const memberStats: any[] = data?.memberStats ?? []
  const trendData = data?.trendData ?? []
  const accessibleDepts: any[] = data?.accessibleDepts ?? []
  const selectedDept = data?.selectedDept

  const csvData = memberStats.map((ms: any) => ({
    氏名: ms.name, 売上目標: ms.salesTarget, 利益目標: ms.profitTarget,
    契約売上: ms.contractedSales, 入金売上: ms.paidSales,
    実現利益: ms.realizedProfit, 契約利益: ms.contractProfit,
    販促費: ms.promoExpenses, 固定経費: ms.fixedExpenses,
    月間利益進捗率: `${(ms.progressRateProfit * 100).toFixed(1)}%`,
    年間利益進捗率: `${(ms.yearlyProgressRateProfit * 100).toFixed(1)}%`,
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">部門ダッシュボード</h1>
          <p className="text-sm text-gray-500 mt-0.5">{year}年{month}月</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <form className="flex gap-2">
            <select name="dept" defaultValue={dept}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {accessibleDepts.map((d: any) => (
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
              {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
                <option key={mo} value={mo}>{mo}月</option>
              ))}
            </select>
            <button type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              表示
            </button>
          </form>
          {!isLoading && <CsvExportButton data={csvData} filename={`${selectedDept?.name ?? '部門'}_${year}${String(month).padStart(2,'0')}_member`} />}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-5/6" /><Skeleton className="h-6 w-4/6" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({length: 10}).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : m ? (
        <>
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">月間成績 — {selectedDept?.name}</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-3">
              <ProgressBar label="月間売上進捗率" value={m.progressRateSales} target={m.salesTarget} color={m.progressRateSales >= 1 ? 'green' : 'blue'} />
              <ProgressBar label="月間利益進捗率" value={m.progressRateProfit} target={m.profitTarget} color={m.progressRateProfit >= 1 ? 'green' : m.progressRateProfit >= 0.7 ? 'blue' : 'red'} />
              <ProgressBar label="着地見込達成率" value={m.landingAchievementRate} color="amber" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard label="月間売上目標"    value={formatYen(m.salesTarget)} variant="primary" />
              <MetricCard label="月間利益目標"    value={formatYen(m.profitTarget)} variant="primary" />
              <MetricCard label="契約・受注済売上" value={formatYen(m.contractedSales)} />
              <MetricCard label="入金済売上"       value={formatYen(m.paidSales)} variant="success" />
              <MetricCard label="月末着地予測"     value={formatYen(m.landingForecast)} variant={m.landingForecast >= m.profitTarget ? 'success' : 'warning'} size="lg" />
              <MetricCard label="契約利益"         value={formatYen(m.contractProfit)} />
              <MetricCard label="実現利益"          value={formatYen(m.realizedProfit)} variant={m.realizedProfit < 0 ? 'danger' : 'success'} />
              <MetricCard label="見込み利益"        value={formatYen(m.prospectProfit)} />
              <MetricCard label="販促費"            value={formatYen(m.promotionalExpenses)} />
              <MetricCard label="固定経費"          value={formatYen(m.fixedExpenses)} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">年間成績 — {year}年</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard label="年間売上目標"   value={formatYen(m.yearlySalesTarget)} variant="primary" />
              <MetricCard label="年間利益目標"   value={formatYen(m.yearlyProfitTarget)} variant="primary" />
              <MetricCard label="年間契約売上"   value={formatYen(m.yearlyContractedSales)} />
              <MetricCard label="年間入金済売上" value={formatYen(m.yearlyPaidSales)} variant="success" />
              <MetricCard label="年間実現利益"   value={formatYen(m.yearlyRealizedProfit)} variant={m.yearlyRealizedProfit < 0 ? 'danger' : 'success'} />
              <MetricCard label="年間売上進捗率" value={formatPercent(m.yearlyProgressRateSales)} />
              <MetricCard label="年間利益進捗率" value={formatPercent(m.yearlyProgressRateProfit)} variant={m.yearlyProgressRateProfit >= 1 ? 'success' : 'default'} />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">月次売上推移（過去6ヶ月）</h3>
              <SalesTrendChart data={trendData} salesTarget={m.salesTarget} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">月次利益推移（過去6ヶ月）</h3>
              <ProfitTrendChart data={trendData} profitTarget={m.profitTarget} />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">メンバー別売上比較</h3>
              <MemberBarChart data={memberStats.map((ms: any) => ({ name: ms.name, 契約売上: ms.contractedSales, 入金売上: ms.paidSales, 目標: ms.salesTarget }))} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">メンバー別 反響・接客・契約（今月）</h3>
              <InquiryChart data={memberStats.map((ms: any) => ({ name: ms.name, 反響数: ms.inquiryCount, 接客数: ms.meetingCount, 契約数: ms.contractCount }))} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">メンバー比較</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['氏名','売上目標','利益目標','契約売上','入金売上','実現利益','契約利益','販促費','固定経費','月間利益進捗','年間利益進捗','反響数','接客数','契約数','反響→接客率','接客→契約率'].map((h) => (
                        <th key={h} className="text-right first:text-left px-3 py-3 font-medium text-gray-500 first:px-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {memberStats.map((ms: any) => (
                      <tr key={ms.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{ms.name}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{formatYen(ms.salesTarget)}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{formatYen(ms.profitTarget)}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{formatYen(ms.contractedSales)}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm text-green-700">{formatYen(ms.paidSales)}</td>
                        <td className={`px-3 py-3 text-right font-mono text-sm font-semibold ${ms.realizedProfit < 0 ? 'text-red-600' : 'text-green-700'}`}>{formatYen(ms.realizedProfit)}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{formatYen(ms.contractProfit)}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm text-orange-600">{formatYen(ms.promoExpenses)}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{formatYen(ms.fixedExpenses)}</td>
                        <td className="px-3 py-3 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ms.progressRateProfit >= 1 ? 'bg-green-100 text-green-700' : ms.progressRateProfit >= 0.7 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{formatPercent(ms.progressRateProfit)}</span></td>
                        <td className="px-3 py-3 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ms.yearlyProgressRateProfit >= 1 ? 'bg-green-100 text-green-700' : ms.yearlyProgressRateProfit >= 0.7 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{formatPercent(ms.yearlyProgressRateProfit)}</span></td>
                        <td className="px-3 py-3 text-right text-sm">{ms.inquiryCount}件</td>
                        <td className="px-3 py-3 text-right text-sm">{ms.meetingCount}件</td>
                        <td className="px-3 py-3 text-right text-sm">{ms.contractCount}件</td>
                        <td className="px-3 py-3 text-right">{ms.inquiryToMeeting !== null ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ms.inquiryToMeeting >= 50 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{ms.inquiryToMeeting}%</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                        <td className="px-3 py-3 text-right">{ms.meetingToContract !== null ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ms.meetingToContract >= 30 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{ms.meetingToContract}%</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
