import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isAdminOrExecutive } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getDepartments, getProspectWeights } from '@/lib/cached-data'
import { aggregateProjects, formatPercent } from '@/lib/calculations'
import type { ProspectWeight } from '@/types'

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
    supabase.from('targets').select('sales_target, profit_target').eq('target_scope', 'company').eq('target_period', 'monthly').eq('target_year', year).eq('target_month', month).is('user_id', null).is('department_id', null).single(),
    supabase.from('targets').select('sales_target, profit_target').eq('target_scope', 'company').eq('target_period', 'yearly').eq('target_year', year).is('user_id', null).is('department_id', null).single(),
    supabase.from('projects').select('id, status, sales_amount, cost_planned, cost_confirmed, prospect_rank, payment_plan_date, payment_date, contract_date, department_id, created_by').is('deleted_at', null),
    supabase.from('promotional_expenses').select('amount, department_id').eq('expense_month', monthStart),
    supabase.from('fixed_expenses').select('amount, department_id').eq('expense_month', monthStart),
    supabase.from('targets').select('department_id, target_period, target_month, sales_target, profit_target').eq('target_scope', 'department').eq('target_year', year).not('department_id', 'is', null),
    supabase.from('users').select('id, department_id').eq('is_active', true).is('deleted_at', null),
    supabase.from('inquiry_reports').select('user_id, count').gte('report_week', monthStart).lte('report_week', monthEnd),
    supabase.from('projects').select('id, created_by').gte('created_at', `${monthStart}T00:00:00`).lte('created_at', `${monthEnd}T23:59:59`).is('deleted_at', null).neq('status', 'cancelled'),
  ])

  const totalPromo = (allPromo ?? []).reduce((s, e) => s + e.amount, 0)
  const totalFixed = (allFixed ?? []).reduce((s, e) => s + e.amount, 0)

  const companyMetrics = aggregateProjects(
    (allProjects ?? []) as any[], totalPromo, totalFixed,
    companyMonthlyTarget, companyYearlyTarget,
    weights as ProspectWeight[], year, month, now
  )

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

  const deptMetrics = departments.map((dept) => {
    const deptProjects = (allProjects ?? []).filter((p) => p.department_id === dept.id)
    const dMonthTarget = (allDeptTargets ?? []).find((t) => t.department_id === dept.id && t.target_period === 'monthly' && t.target_month === month)
    const dYearTarget = (allDeptTargets ?? []).find((t) => t.department_id === dept.id && t.target_period === 'yearly')
    const m = aggregateProjects(deptProjects as any[], promoByDept[dept.id] ?? 0, fixedByDept[dept.id] ?? 0, dMonthTarget ?? null, dYearTarget ?? null, weights as ProspectWeight[], year, month, now)
    const deptMemberIds = membersByDept[dept.id] ?? []
    const dInquiry = deptMemberIds.reduce((s, id) => s + (inquiryByUser[id] ?? 0), 0)
    const dMeeting = deptMemberIds.reduce((s, id) => s + (newProjByUser[id] ?? 0), 0)
    const dContract = deptProjects.filter((p) => ['contracted','delivered','invoiced','paid'].includes(p.status)).length
    return {
      dept, metrics: m,
      inquiryCount: dInquiry, meetingCount: dMeeting, contractCount: dContract,
      inquiryToMeeting: dInquiry > 0 ? Math.round(dMeeting / dInquiry * 100) : null,
      meetingToContract: dMeeting > 0 ? Math.round(dContract / dMeeting * 100) : null,
    }
  })

  const paid = (allProjects ?? []).filter((p) => p.status === 'paid')
  const contracted = (allProjects ?? []).filter((p) => ['contracted','delivered','invoiced','paid'].includes(p.status))
  const trendData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 1 - (5 - i), 1)
    return {
      month: `${d.getMonth() + 1}月`,
      入金売上: paid.reduce((s, p) => s + p.sales_amount, 0),
      契約売上: contracted.reduce((s, p) => s + p.sales_amount, 0),
      実現利益: paid.reduce((s, p) => s + p.sales_amount - p.cost_confirmed, 0),
      契約利益: contracted.reduce((s, p) => s + p.sales_amount - p.cost_planned, 0),
    }
  })

  return NextResponse.json({ year, month, companyMetrics, deptMetrics, trendData })
}
