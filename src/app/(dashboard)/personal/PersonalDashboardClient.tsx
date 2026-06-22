'use client'

import useSWR from 'swr'
import { formatYen, formatPercent } from '@/lib/calculations'
import { MetricCard, ProgressBar } from '@/components/dashboard/MetricCard'
import { SalesTrendChart } from '@/components/charts/SalesTrendChart'
import { ProfitTrendChart } from '@/components/charts/ProfitTrendChart'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className ?? ''}`} />
}

export function PersonalDashboardClient({ year, month }: { year: number; month: number }) {
  const { data, isLoading } = useSWR(
    `/api/dashboard/personal?year=${year}&month=${month}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {data?.user?.fullName ?? '...'} さんの成績
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{year}年{month}月 — リアルタイム集計</p>
        </div>
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
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-4/6" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({length: 8}).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : data ? (
        <>
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">月間成績</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 space-y-4">
              <ProgressBar label="売上進捗率" value={data.metrics.progressRateSales} target={data.metrics.salesTarget}
                color={data.metrics.progressRateSales >= 1 ? 'green' : data.metrics.progressRateSales >= 0.7 ? 'blue' : 'amber'} />
              <ProgressBar label="利益進捗率" value={data.metrics.progressRateProfit} target={data.metrics.profitTarget}
                color={data.metrics.progressRateProfit >= 1 ? 'green' : data.metrics.progressRateProfit >= 0.7 ? 'blue' : 'red'} />
              <ProgressBar label="着地見込達成率" value={data.metrics.landingAchievementRate} color="amber" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-3">
              <MetricCard label="月間売上目標"         value={formatYen(data.metrics.salesTarget)} variant="primary" />
              <MetricCard label="契約・受注済売上"      value={formatYen(data.metrics.contractedSales)} />
              <MetricCard label="引渡し・納品済売上"    value={formatYen(data.metrics.deliveredSales)} />
              <MetricCard label="入金済売上"            value={formatYen(data.metrics.paidSales)} variant="success" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-3">
              <MetricCard label="月間利益目標"          value={formatYen(data.metrics.profitTarget)} variant="primary" />
              <MetricCard label="契約ベース利益"         value={formatYen(data.metrics.contractProfit)} />
              <MetricCard label="実現利益（入金ベース）" value={formatYen(data.adjustedRealizedProfit)}
                variant={data.adjustedRealizedProfit < 0 ? 'danger' : 'success'} />
              <MetricCard label="見込み利益"             value={formatYen(data.metrics.prospectProfit)} />
              <MetricCard label="加重見込み利益"         value={formatYen(data.metrics.weightedProspectProfit)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <MetricCard label="販促費"        value={formatYen(data.totalPromo)} />
              <MetricCard label="固定経費負担額" value={formatYen(data.totalFixed)} />
              <MetricCard label="月末着地予測"   value={formatYen(data.adjustedLanding)}
                variant={data.adjustedLanding >= data.metrics.profitTarget ? 'success' : 'warning'} size="lg" />
              <MetricCard label="目標まで不足"
                value={data.metrics.profitShortfall <= 0
                  ? `▲ ${formatYen(Math.abs(data.metrics.profitShortfall))}`
                  : `+${formatYen(data.metrics.profitShortfall)}`}
                variant={data.metrics.profitShortfall < 0 ? 'danger' : 'success'} />
            </div>
          </section>

          {data.metrics.pendingPaymentCount > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">入金待ち状況</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard label="入金待ち件数" value={`${data.metrics.pendingPaymentCount}件`} />
                <MetricCard label="入金待ち売上" value={formatYen(data.metrics.pendingPaymentSales)} />
                <MetricCard label="入金待ち利益" value={formatYen(data.metrics.pendingPaymentProfit)} />
                <MetricCard label="入金遅延件数" value={`${data.metrics.overduePaymentCount}件`}
                  variant={data.metrics.overduePaymentCount > 0 ? 'danger' : 'default'}
                  isWarning={data.metrics.overduePaymentCount > 0} />
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">反響・接客（今月）</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="総反響件数"   value={`${data.totalInquiry}件`} />
              <MetricCard label="新規接客件数" value={`${data.newClientCount}件`} />
              <MetricCard label="反響→接客率"  value={data.inquiryToMeeting !== null ? `${data.inquiryToMeeting}%` : '—'}
                variant={data.inquiryToMeeting !== null && data.inquiryToMeeting >= 50 ? 'success' : 'default'} />
              <MetricCard label="接客→契約率"  value={data.meetingToContract !== null ? `${data.meetingToContract}%` : '—'}
                variant={data.meetingToContract !== null && data.meetingToContract >= 30 ? 'success' : 'default'} />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">月次売上推移（過去6ヶ月）</h3>
              <SalesTrendChart data={data.trendData} salesTarget={data.metrics.salesTarget} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">月次利益推移（過去6ヶ月）</h3>
              <ProfitTrendChart data={data.trendData} profitTarget={data.metrics.profitTarget} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">営業実績（累計）</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <MetricCard size="sm" label="契約・受注"   value={`${data.statusCounts['contracted'] ?? 0}件`} />
              <MetricCard size="sm" label="引渡し・納品" value={`${data.statusCounts['delivered'] ?? 0}件`} />
              <MetricCard size="sm" label="入金済"       value={`${data.statusCounts['paid'] ?? 0}件`} variant="success" />
              <MetricCard size="sm" label="見込みA"      value={`${data.statusCounts['prospect_a'] ?? 0}件`} />
              <MetricCard size="sm" label="見込みB"      value={`${data.statusCounts['prospect_b'] ?? 0}件`} />
              <MetricCard size="sm" label="失注・没"     value={`${data.statusCounts['lost'] ?? 0}件`} variant="danger" />
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
