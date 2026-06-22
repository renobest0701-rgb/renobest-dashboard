'use client'

import useSWR from 'swr'
import { formatYen, formatPercent } from '@/lib/calculations'
import { MetricCard, ProgressBar } from '@/components/dashboard/MetricCard'
import { SalesProgressChart } from '@/components/charts/SalesProgressChart'
import { ProfitTrendChart } from '@/components/charts/ProfitTrendChart'
import { SalesTrendChart } from '@/components/charts/SalesTrendChart'
import { InquiryChart } from '@/components/charts/InquiryChart'
import { CsvExportButton } from '@/components/dashboard/CsvExportButton'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className ?? ''}`} />
}

export function CompanyDashboardClient({ year, month }: { year: number; month: number }) {
  const { data, isLoading } = useSWR(
    `/api/dashboard/company?year=${year}&month=${month}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  const cm = data?.companyMetrics
  const deptMetrics: any[] = data?.deptMetrics ?? []
  const trendData = data?.trendData ?? []

  const deptCsvData = deptMetrics.map(({ dept, metrics: m }: any) => ({
    部門: dept.name,
    売上目標: m.salesTarget,
    入金売上: m.paidSales,
    実現利益: m.realizedProfit,
    販促費: m.promotionalExpenses,
    固定経費: m.fixedExpenses,
    利益進捗率: formatPercent(m.progressRateProfit),
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
          {!isLoading && <CsvExportButton data={deptCsvData} filename={`全社部門比較_${year}${String(month).padStart(2,'0')}`} />}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-5/6" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({length: 12}).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-64" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : cm ? (
        <>
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">全社月間成績</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-3">
              <ProgressBar label="月間売上進捗率" value={cm.progressRateSales} target={cm.salesTarget}
                color={cm.progressRateSales >= 1 ? 'green' : 'blue'} />
              <ProgressBar label="月間利益進捗率" value={cm.progressRateProfit} target={cm.profitTarget}
                color={cm.progressRateProfit >= 1 ? 'green' : cm.progressRateProfit >= 0.7 ? 'blue' : 'red'} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              <MetricCard label="全社売上目標"     value={formatYen(cm.salesTarget)} variant="primary" />
              <MetricCard label="全社利益目標"     value={formatYen(cm.profitTarget)} variant="primary" />
              <MetricCard label="契約・受注済売上" value={formatYen(cm.contractedSales)} />
              <MetricCard label="入金済売上"       value={formatYen(cm.paidSales)} variant="success" />
              <MetricCard label="実現利益"          value={formatYen(cm.realizedProfit)} variant={cm.realizedProfit < 0 ? 'danger' : 'success'} />
              <MetricCard label="契約利益"         value={formatYen(cm.contractProfit)} />
              <MetricCard label="見込み利益"        value={formatYen(cm.prospectProfit)} />
              <MetricCard label="販促費"            value={formatYen(cm.promotionalExpenses)} />
              <MetricCard label="固定経費"          value={formatYen(cm.fixedExpenses)} />
              <MetricCard label="月末着地予測"      value={formatYen(cm.landingForecast)}
                variant={cm.landingForecast >= cm.profitTarget ? 'success' : 'warning'} size="lg" />
              <MetricCard label="計画との差額"
                value={(() => { const s = cm.realizedProfit - cm.profitTarget; return s < 0 ? `▲ ${formatYen(Math.abs(s))}` : `+${formatYen(s)}` })()}
                variant={cm.realizedProfit < cm.profitTarget ? 'danger' : 'success'} />
              <MetricCard label="最低利益まで不足"
                value={(() => { const s = cm.realizedProfit - cm.profitTarget; return s < 0 ? `▲ ${formatYen(Math.abs(s))}` : `+${formatYen(s)}` })()}
                variant={cm.realizedProfit < cm.profitTarget ? 'danger' : 'success'}
                isWarning={cm.realizedProfit < cm.profitTarget} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">全社年間成績 — {year}年</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard label="年間売上目標"     value={formatYen(cm.yearlySalesTarget)} variant="primary" />
              <MetricCard label="年間利益目標"     value={formatYen(cm.yearlyProfitTarget)} variant="primary" />
              <MetricCard label="年間契約売上"     value={formatYen(cm.yearlyContractedSales)} />
              <MetricCard label="年間入金済売上"   value={formatYen(cm.yearlyPaidSales)} variant="success" />
              <MetricCard label="年間実現利益"     value={formatYen(cm.yearlyRealizedProfit)} variant={cm.yearlyRealizedProfit < 0 ? 'danger' : 'success'} />
              <MetricCard label="年間売上進捗率"   value={formatPercent(cm.yearlyProgressRateSales)} />
              <MetricCard label="年間利益進捗率"   value={formatPercent(cm.yearlyProgressRateProfit)} variant={cm.yearlyProgressRateProfit >= 1 ? 'success' : 'default'} />
              <MetricCard label="年間着地予測"     value={formatYen(cm.yearlyLandingForecast)} variant="warning" />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">全社月次売上推移（過去6ヶ月）</h3>
              <SalesTrendChart data={trendData} salesTarget={cm.salesTarget} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">全社利益推移（過去6ヶ月）</h3>
              <ProfitTrendChart data={trendData} profitTarget={cm.profitTarget} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">部門別売上比較</h3>
              <SalesProgressChart data={deptMetrics.map(({ dept, metrics: m }: any) => ({
                name: dept.name.replace('部門', ''), 契約売上: m.contractedSales, 入金済売上: m.paidSales, 目標: m.salesTarget,
              }))} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">部門別 反響・接客・契約（今月）</h3>
              <InquiryChart data={deptMetrics.map(({ dept, inquiryCount, meetingCount, contractCount }: any) => ({
                name: dept.name.replace('部門', ''), 反響数: inquiryCount, 接客数: meetingCount, 契約数: contractCount,
              }))} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">部門別比較</h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['部門','売上目標','入金売上','実現利益','販促費','固定経費','利益進捗率','月末着地','反響数','接客数','契約数','反響→接客率','接客→契約率'].map((h) => (
                        <th key={h} className="text-right first:text-left px-3 py-3 font-medium text-gray-500 first:px-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deptMetrics.map(({ dept, metrics: m, inquiryCount, meetingCount, contractCount, inquiryToMeeting, meetingToContract }: any) => (
                      <tr key={dept.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{dept.name}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatYen(m.salesTarget)}</td>
                        <td className="px-3 py-3 text-right font-mono text-green-700">{formatYen(m.paidSales)}</td>
                        <td className={`px-3 py-3 text-right font-mono font-semibold ${m.realizedProfit < 0 ? 'text-red-600' : 'text-green-700'}`}>{formatYen(m.realizedProfit)}</td>
                        <td className="px-3 py-3 text-right font-mono text-orange-600">{formatYen(m.promotionalExpenses)}</td>
                        <td className="px-3 py-3 text-right font-mono">{formatYen(m.fixedExpenses)}</td>
                        <td className="px-3 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m.progressRateProfit >= 1 ? 'bg-green-100 text-green-700' : m.progressRateProfit >= 0.7 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                            {formatPercent(m.progressRateProfit)}
                          </span>
                        </td>
                        <td className={`px-3 py-3 text-right font-mono font-semibold ${m.landingForecast >= m.profitTarget ? 'text-green-700' : 'text-amber-600'}`}>{formatYen(m.landingForecast)}</td>
                        <td className="px-3 py-3 text-right">{inquiryCount}件</td>
                        <td className="px-3 py-3 text-right">{meetingCount}件</td>
                        <td className="px-3 py-3 text-right">{contractCount}件</td>
                        <td className="px-3 py-3 text-right">{inquiryToMeeting !== null ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${inquiryToMeeting >= 50 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{inquiryToMeeting}%</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                        <td className="px-3 py-3 text-right">{meetingToContract !== null ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meetingToContract >= 30 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{meetingToContract}%</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                      <td className="px-4 py-3">全社合計</td>
                      <td className="px-3 py-3 text-right font-mono">{formatYen(cm.salesTarget)}</td>
                      <td className="px-3 py-3 text-right font-mono text-green-700">{formatYen(cm.paidSales)}</td>
                      <td className={`px-3 py-3 text-right font-mono ${cm.realizedProfit < 0 ? 'text-red-600' : 'text-green-700'}`}>{formatYen(cm.realizedProfit)}</td>
                      <td className="px-3 py-3 text-right font-mono text-orange-600">{formatYen(cm.promotionalExpenses)}</td>
                      <td className="px-3 py-3 text-right font-mono">{formatYen(cm.fixedExpenses)}</td>
                      <td className="px-3 py-3 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cm.progressRateProfit >= 1 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{formatPercent(cm.progressRateProfit)}</span></td>
                      <td className={`px-3 py-3 text-right font-mono ${cm.landingForecast >= cm.profitTarget ? 'text-green-700' : 'text-amber-600'}`}>{formatYen(cm.landingForecast)}</td>
                      <td className="px-3 py-3 text-right">{deptMetrics.reduce((s: number, d: any) => s + d.inquiryCount, 0)}件</td>
                      <td className="px-3 py-3 text-right">{deptMetrics.reduce((s: number, d: any) => s + d.meetingCount, 0)}件</td>
                      <td className="px-3 py-3 text-right">{deptMetrics.reduce((s: number, d: any) => s + d.contractCount, 0)}件</td>
                      <td className="px-3 py-3 text-right"><span className="text-gray-300 text-xs">—</span></td>
                      <td className="px-3 py-3 text-right"><span className="text-gray-300 text-xs">—</span></td>
                    </tr>
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
