import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isDeptManager, isAdminOrExecutive } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getDepartments, getProspectWeights } from '@/lib/cached-data'
import { aggregateProjects, calcProgressRate } from '@/lib/calculations'
import type { ProspectWeight } from '@/types'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isDeptManager(user) && !isAdminOrExecutive(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1))
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10)

  const allDepartments = await getDepartments()
  const accessibleDepts = isAdminOrExecutive(user)
    ? allDepartments
    : allDepartments.filter((d) => isDeptManager(user, d.id))

  const selectedDeptId = searchParams.get('dept') ?? accessibleDepts[0]?.id
  if (!selectedDeptId) return NextResponse.json({ error: 'No department' }, { status: 400 })

  const supabase = await createClient()

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
    (projects ?? []) as any[], promoTotal, fixedTotal,
    monthlyTarget, yearlyTarget, weights as ProspectWeight[], year, month, now
  )

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
      id: member.id, name: member.full_name,
      salesTarget: mTarget?.sales_target ?? 0, profitTarget: mTarget?.profit_target ?? 0,
      yearlySalesTarget: mYearlyTarget?.sales_target ?? 0, yearlyProfitTarget: mYearlyTarget?.profit_target ?? 0,
      contractedSales, paidSales, realizedProfit, contractProfit,
      promoExpenses: mPromoTotal, fixedExpenses: mFixedTotal,
      progressRateProfit: calcProgressRate(realizedProfit, mTarget?.profit_target ?? 0),
      yearlyProgressRateProfit: calcProgressRate(realizedProfit, mYearlyTarget?.profit_target ?? 0),
      inquiryCount, meetingCount, contractCount,
      inquiryToMeeting: inquiryCount > 0 ? Math.round(meetingCount / inquiryCount * 100) : null,
      meetingToContract: meetingCount > 0 ? Math.round(contractCount / meetingCount * 100) : null,
    }
  })

  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i), 1)
    return { label: `${d.getMonth() + 1}月`, start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10) }
  })
  const trendData = trendMonths.map(({ label, start, end }) => {
    const tp = (projects ?? []).filter((p) => { const d = p.payment_date || p.contract_date; return d && d >= start && d <= end })
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

  const selectedDept = accessibleDepts.find((d) => d.id === selectedDeptId)
  return NextResponse.json({ year, month, selectedDept, accessibleDepts, metrics, memberStats, trendData })
}
