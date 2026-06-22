import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getProspectWeights } from '@/lib/cached-data'
import { calcPersonalMetrics } from '@/lib/calculations'
import type { Project, Target, ProspectWeight } from '@/types'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1))
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10)

  const supabase = await createClient()

  const [
    { data: projects },
    { data: monthlyTarget },
    { data: yearlyTarget },
    { data: promoData },
    { data: fixedData },
    weights,
    { data: meUser },
  ] = await Promise.all([
    supabase.from('projects').select('*').is('deleted_at', null).eq('created_by', user.id).order('updated_at', { ascending: false }),
    supabase.from('targets').select('*').eq('user_id', user.id).eq('target_scope', 'personal').eq('target_period', 'monthly').eq('target_year', year).eq('target_month', month).single(),
    supabase.from('targets').select('*').eq('user_id', user.id).eq('target_scope', 'personal').eq('target_period', 'yearly').eq('target_year', year).single(),
    supabase.from('promotional_expenses').select('amount, project_id').eq('user_id', user.id).eq('expense_month', monthStart),
    supabase.from('fixed_expenses').select('amount').eq('user_id', user.id).eq('expense_month', monthStart),
    getProspectWeights(),
    supabase.from('users').select('id').eq('auth_user_id', user.authId).single(),
  ])

  const myUserId = meUser?.id

  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i), 1)
    return {
      label: `${d.getMonth() + 1}月`,
      start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10),
    }
  })

  const [
    { data: inquiryData },
    { count: newClientCount },
    ...trendResults
  ] = await Promise.all([
    myUserId
      ? supabase.from('inquiry_reports').select('count').eq('user_id', myUserId).gte('report_week', monthStart).lte('report_week', monthEnd)
      : Promise.resolve({ data: [] as { count: number }[], error: null }),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('created_by', myUserId ?? '').gte('created_at', `${monthStart}T00:00:00`).lte('created_at', `${monthEnd}T23:59:59`).is('deleted_at', null).neq('status', 'cancelled'),
    ...trendMonths.map(({ start, end }) =>
      supabase.from('projects').select('status, sales_amount, cost_confirmed, cost_planned').eq('created_by', myUserId ?? '').is('deleted_at', null).gte('updated_at', `${start}T00:00:00`).lte('updated_at', `${end}T23:59:59`)
    ),
  ])

  const trendData = trendMonths.map(({ label }, i) => {
    const tp = (trendResults[i] as any)?.data ?? []
    const paid = tp.filter((p: any) => p.status === 'paid')
    const contracted = tp.filter((p: any) => ['contracted','delivered','invoiced','paid'].includes(p.status))
    return {
      month: label,
      入金売上: paid.reduce((s: number, p: any) => s + p.sales_amount, 0),
      契約売上: contracted.reduce((s: number, p: any) => s + p.sales_amount, 0),
      実現利益: paid.reduce((s: number, p: any) => s + p.sales_amount - p.cost_confirmed, 0),
      契約利益: contracted.reduce((s: number, p: any) => s + p.sales_amount - p.cost_planned, 0),
    }
  })

  const allProjects = (projects ?? []) as Project[]
  const monthProjects = allProjects.filter((p) => {
    const d = p.payment_date || p.invoice_date || p.delivery_date || p.contract_date || p.application_date || p.updated_at
    if (!d) return false
    const dt = new Date(d)
    return dt.getFullYear() === year && dt.getMonth() + 1 === month
  })
  const activeProspects = allProjects.filter((p) => ['new','negotiating','prospect_b','prospect_a'].includes(p.status))
  const metricsProjects = [...monthProjects, ...activeProspects.filter((p) => !monthProjects.find((mp) => mp.id === p.id))]

  const promoByProject: Record<string, number> = {}
  const totalPromo = (promoData ?? []).reduce((sum, e) => {
    if (e.project_id) promoByProject[e.project_id] = (promoByProject[e.project_id] ?? 0) + e.amount
    return sum + e.amount
  }, 0)
  const totalFixed = (fixedData ?? []).reduce((sum, e) => sum + e.amount, 0)

  const inputs = metricsProjects.map((p) => ({ project: p, promoExpenses: promoByProject[p.id] ?? 0, fixedExpenseShare: 0 }))
  const metrics = calcPersonalMetrics(inputs, monthlyTarget as Target | null, weights as ProspectWeight[], now)

  const adjustedRealizedProfit = metrics.realizedProfit - totalFixed
  const adjustedLanding = metrics.landingForecast - totalFixed

  const statusCounts = allProjects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalInquiry = (inquiryData ?? []).reduce((s, r) => s + r.count, 0)
  const contractCount = statusCounts['contracted'] ?? 0

  return NextResponse.json({
    user: { fullName: user.fullName },
    year, month,
    metrics,
    adjustedRealizedProfit,
    adjustedLanding,
    totalPromo,
    totalFixed,
    statusCounts,
    totalInquiry,
    newClientCount: newClientCount ?? 0,
    contractCount,
    inquiryToMeeting: totalInquiry > 0 ? Math.round((newClientCount ?? 0) / totalInquiry * 100) : null,
    meetingToContract: (newClientCount ?? 0) > 0 ? Math.round(contractCount / (newClientCount ?? 1) * 100) : null,
    trendData,
    yearlySalesTarget: (yearlyTarget as any)?.sales_target ?? 0,
    yearlyProfitTarget: (yearlyTarget as any)?.profit_target ?? 0,
  })
}
