// ============================================================
// RENOBEST — 利益計算ロジック（唯一の実装）
// 画面ごとに再実装せず、必ずこのファイルを使うこと
// ============================================================

import type {
  Project,
  PersonalMetrics,
  ProspectWeight,
  Target,
} from '@/types'

// ============================================================
// 基本計算
// ============================================================

/** 個人粗利益 = 売上 - 案件原価 */
export function calcGrossProfit(sales: number, cost: number): number {
  return sales - cost
}

/** 個人貢献利益 = 売上 - 原価 - 販促費 - 固定経費負担 */
export function calcContributionProfit(
  sales: number,
  cost: number,
  promoExpenses: number,
  fixedExpenses: number
): number {
  return sales - cost - promoExpenses - fixedExpenses
}

/** 実現利益 = 入金済売上 - 確定原価 - 販促費 - 固定経費負担 */
export function calcRealizedProfit(
  paidSales: number,
  confirmedCost: number,
  promoExpenses: number,
  fixedExpenses: number
): number {
  return paidSales - confirmedCost - promoExpenses - fixedExpenses
}

/** 契約ベース利益 = 契約売上 - 予定原価 - 販促費 - 固定経費負担 */
export function calcContractProfit(
  contractedSales: number,
  plannedCost: number,
  promoExpenses: number,
  fixedExpenses: number
): number {
  return contractedSales - plannedCost - promoExpenses - fixedExpenses
}

/**
 * 月末着地予測 = 実現利益 + 未入金の契約済利益 + 加重見込み利益
 */
export function calcLandingForecast(
  realizedProfit: number,
  unpaidContractProfit: number,
  weightedProspectProfit: number
): number {
  return realizedProfit + unpaidContractProfit + weightedProspectProfit
}

/**
 * 加重見込み利益を計算
 * @param prospectProfit 各ランクの見込み利益
 * @param weights 確度設定（管理者設定可能）
 */
export function calcWeightedProspectProfit(
  prospectProfits: { rank: 'a' | 'b' | 'other'; profit: number }[],
  weights: ProspectWeight[]
): number {
  const weightMap: Record<string, number> = {}
  weights.forEach((w) => { weightMap[w.rank] = w.weight })

  return prospectProfits.reduce((sum, { rank, profit }) => {
    const w = weightMap[rank] ?? 0
    return sum + Math.round(profit * w)
  }, 0)
}

/** 進捗率（0〜1、目標0の場合は0を返す） */
export function calcProgressRate(actual: number, target: number): number {
  if (target === 0) return 0
  return Math.min(actual / target, 9.99)  // 999%上限
}

/** 不足額（マイナスが不足を表す） */
export function calcShortfall(actual: number, target: number): number {
  return actual - target
}

// ============================================================
// 個人成績の集計
// ============================================================

export interface ProjectMetricInput {
  project: Project
  promoExpenses: number  // この案件に配賦された販促費合計
  fixedExpenseShare: number  // 担当者の固定経費負担（月次）
}

export function calcPersonalMetrics(
  inputs: ProjectMetricInput[],
  target: Target | null,
  weights: ProspectWeight[],
  today: Date = new Date()
): PersonalMetrics {
  let contractedSales = 0
  let deliveredSales = 0
  let paidSales = 0
  let contractProfit = 0
  let confirmedCost = 0
  let totalPromo = 0
  let totalFixed = 0
  let unpaidContractProfit = 0

  const prospectProfits: { rank: 'a' | 'b' | 'other'; profit: number }[] = []

  let pendingPaymentCount = 0
  let pendingPaymentSales = 0
  let pendingPaymentProfit = 0
  let overduePaymentCount = 0

  inputs.forEach(({ project, promoExpenses, fixedExpenseShare }) => {
    const cost = project.status === 'paid'
      ? project.cost_confirmed
      : project.cost_planned
    const grossProfit = project.sales_amount - cost

    // 売上集計
    if (['contracted', 'delivered', 'invoiced', 'paid'].includes(project.status)) {
      contractedSales += project.sales_amount
    }
    if (['delivered', 'invoiced', 'paid'].includes(project.status)) {
      deliveredSales += project.sales_amount
    }
    if (project.status === 'paid') {
      paidSales += project.sales_amount
      confirmedCost += project.cost_confirmed
    }

    // 契約利益（販促費・固定費は月次で別途集計するため案件別は0で計算）
    if (['contracted', 'delivered', 'invoiced', 'paid'].includes(project.status)) {
      contractProfit += grossProfit
    }

    // 未入金の契約済利益（契約済〜請求済）
    if (['contracted', 'delivered', 'invoiced'].includes(project.status)) {
      unpaidContractProfit += grossProfit
    }

    // 見込み利益
    if (['new', 'negotiating', 'prospect_b', 'prospect_a'].includes(project.status)) {
      prospectProfits.push({
        rank: project.prospect_rank,
        profit: grossProfit,
      })
    }

    // 入金待ち
    if (['contracted', 'delivered', 'invoiced'].includes(project.status)) {
      pendingPaymentCount++
      pendingPaymentSales += project.sales_amount
      pendingPaymentProfit += grossProfit

      if (project.payment_plan_date) {
        const planDate = new Date(project.payment_plan_date)
        if (planDate < today) {
          overduePaymentCount++
        }
      }
    }

    totalPromo += promoExpenses
    totalFixed += fixedExpenseShare
  })

  const realizedProfit = calcRealizedProfit(paidSales, confirmedCost, totalPromo, totalFixed)
  const contractProfitNet = contractProfit - totalPromo - totalFixed
  const weightedProspectProfit = calcWeightedProspectProfit(prospectProfits, weights)
  const landingForecast = calcLandingForecast(realizedProfit, unpaidContractProfit, weightedProspectProfit)

  const salesTarget = target?.sales_target ?? 0
  const profitTarget = target?.profit_target ?? 0

  return {
    salesTarget,
    contractedSales,
    deliveredSales,
    paidSales,
    profitTarget,
    contractProfit: contractProfitNet,
    realizedProfit,
    prospectProfit: prospectProfits.reduce((s, p) => s + p.profit, 0),
    weightedProspectProfit,
    promotionalExpenses: totalPromo,
    fixedExpensesBurden: totalFixed,
    landingForecast,
    progressRateSales: calcProgressRate(paidSales, salesTarget),
    progressRateProfit: calcProgressRate(realizedProfit, profitTarget),
    landingAchievementRate: calcProgressRate(landingForecast, profitTarget),
    profitShortfall: calcShortfall(realizedProfit, profitTarget),
    pendingPaymentCount,
    pendingPaymentSales,
    pendingPaymentProfit,
    overduePaymentCount,
  }
}

// ============================================================
// 日数計算
// ============================================================

export function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null
  const diff = new Date(to).getTime() - new Date(from).getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

export function calcProjectDurations(project: Project) {
  return {
    echoToFirstMeeting:  daysBetween(project.echo_date, project.first_meeting_date),
    firstMeetingToApp:   daysBetween(project.first_meeting_date, project.application_date),
    appToContract:       daysBetween(project.application_date, project.contract_date),
    contractToDelivery:  daysBetween(project.contract_date, project.delivery_date),
    deliveryToPayment:   daysBetween(project.delivery_date, project.payment_date),
    firstMeetingToPayment: daysBetween(project.first_meeting_date, project.payment_date),
    paymentOverdueDays:  daysBetween(project.payment_plan_date, new Date().toISOString().split('T')[0]),
  }
}

// ============================================================
// 部門・全社集計
// ============================================================

export interface AggregatedMetrics {
  salesTarget: number
  profitTarget: number
  contractedSales: number
  deliveredSales: number
  paidSales: number
  contractProfit: number
  realizedProfit: number
  prospectProfit: number
  weightedProspectProfit: number
  promotionalExpenses: number
  fixedExpenses: number
  landingForecast: number
  progressRateSales: number
  progressRateProfit: number
  landingAchievementRate: number
  profitShortfall: number
  yearlySalesTarget: number
  yearlyProfitTarget: number
  yearlyContractedSales: number
  yearlyPaidSales: number
  yearlyRealizedProfit: number
  yearlyPromoExpenses: number
  yearlyFixedExpenses: number
  yearlyProgressRateSales: number
  yearlyProgressRateProfit: number
  yearlyLandingForecast: number
}

export interface ProjectRow {
  id: string
  status: string
  sales_amount: number
  cost_planned: number
  cost_confirmed: number
  prospect_rank: 'a' | 'b' | 'other'
  payment_plan_date: string | null
  payment_date: string | null
  contract_date: string | null
}

export function aggregateProjects(
  projects: ProjectRow[],
  promoExpenses: number,
  fixedExpenses: number,
  monthlyTarget: { sales_target: number; profit_target: number } | null,
  yearlyTarget: { sales_target: number; profit_target: number } | null,
  weights: ProspectWeight[],
  year: number,
  month: number,
  today: Date = new Date()
): AggregatedMetrics {
  let contractedSales = 0
  let deliveredSales = 0
  let paidSales = 0
  let confirmedCost = 0
  let contractGrossProfit = 0
  let unpaidContractProfit = 0
  const prospectProfits: { rank: 'a' | 'b' | 'other'; profit: number }[] = []

  // 年次集計
  let yearlyContractedSales = 0
  let yearlyPaidSales = 0
  let yearlyConfirmedCost = 0

  for (const p of projects) {
    const cost = p.status === 'paid' ? p.cost_confirmed : p.cost_planned
    const gross = p.sales_amount - cost

    if (['contracted', 'delivered', 'invoiced', 'paid'].includes(p.status)) {
      contractedSales += p.sales_amount
      contractGrossProfit += gross
      yearlyContractedSales += p.sales_amount
    }
    if (['delivered', 'invoiced', 'paid'].includes(p.status)) {
      deliveredSales += p.sales_amount
    }
    if (p.status === 'paid') {
      paidSales += p.sales_amount
      confirmedCost += p.cost_confirmed
      yearlyPaidSales += p.sales_amount
      yearlyConfirmedCost += p.cost_confirmed
    }
    if (['contracted', 'delivered', 'invoiced'].includes(p.status)) {
      unpaidContractProfit += gross
    }
    if (['new', 'negotiating', 'prospect_b', 'prospect_a'].includes(p.status)) {
      prospectProfits.push({ rank: p.prospect_rank, profit: gross })
    }
  }

  const prospectProfit = prospectProfits.reduce((s, p) => s + p.profit, 0)
  const weightedProspectProfit = calcWeightedProspectProfit(prospectProfits, weights)

  const realizedProfit = paidSales - confirmedCost - promoExpenses - fixedExpenses
  const contractProfit = contractGrossProfit - promoExpenses - fixedExpenses
  const landing = calcLandingForecast(realizedProfit, unpaidContractProfit, weightedProspectProfit)

  const mSales = monthlyTarget?.sales_target ?? 0
  const mProfit = monthlyTarget?.profit_target ?? 0
  const ySales = yearlyTarget?.sales_target ?? 0
  const yProfit = yearlyTarget?.profit_target ?? 0

  const yearlyRealizedProfit = yearlyPaidSales - yearlyConfirmedCost

  return {
    salesTarget: mSales,
    profitTarget: mProfit,
    contractedSales,
    deliveredSales,
    paidSales,
    contractProfit,
    realizedProfit,
    prospectProfit,
    weightedProspectProfit,
    promotionalExpenses: promoExpenses,
    fixedExpenses,
    landingForecast: landing,
    progressRateSales: calcProgressRate(paidSales, mSales),
    progressRateProfit: calcProgressRate(realizedProfit, mProfit),
    landingAchievementRate: calcProgressRate(landing, mProfit),
    profitShortfall: calcShortfall(realizedProfit, mProfit),
    yearlySalesTarget: ySales,
    yearlyProfitTarget: yProfit,
    yearlyContractedSales,
    yearlyPaidSales,
    yearlyRealizedProfit,
    yearlyPromoExpenses: promoExpenses,
    yearlyFixedExpenses: fixedExpenses,
    yearlyProgressRateSales: calcProgressRate(yearlyPaidSales, ySales),
    yearlyProgressRateProfit: calcProgressRate(yearlyRealizedProfit, yProfit),
    yearlyLandingForecast: landing,
  }
}

// ============================================================
// フォーマットユーティリティ
// ============================================================

/** 円表示（3桁区切り） */
export function formatYen(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** パーセント表示 */
export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}
