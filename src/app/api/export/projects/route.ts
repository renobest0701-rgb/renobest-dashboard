import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, isAdminOrExecutive, isDeptManager } from '@/lib/auth'
import { PROJECT_STATUS_LABELS, FLOW_TYPE_LABELS } from '@/types'

export async function GET(request: NextRequest) {
  const user = await requireAuth()
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const deptId = searchParams.get('dept')
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  let query = supabase
    .from('projects')
    .select(`
      name, status, sales_amount, cost_planned, cost_confirmed,
      flow_type, echo_date, first_meeting_date, application_date,
      contract_date, delivery_date, invoice_date, payment_date,
      payment_plan_date, created_at,
      department:departments(name),
      customer:customers(name),
      created_by_user:users!projects_created_by_fkey(full_name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (!isAdminOrExecutive(user)) {
    if (deptId && isDeptManager(user, deptId)) {
      query = query.eq('department_id', deptId)
    } else {
      query = query.eq('created_by', user.id)
    }
  } else if (deptId) {
    query = query.eq('department_id', deptId)
  }

  if (year && month) {
    const from = `${year}-${month.padStart(2, '0')}-01`
    const to = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]
    query = query.or(`contract_date.gte.${from},contract_date.lte.${to},payment_date.gte.${from},payment_date.lte.${to}`)
  }

  const { data: projects } = await query.limit(1000)

  const rows = (projects ?? []).map((p) => {
    const grossProfit = p.sales_amount - (p.status === 'paid' ? p.cost_confirmed : p.cost_planned)
    return {
      案件名: p.name,
      部門: (p.department as any)?.name ?? '',
      担当者: (p.created_by_user as any)?.full_name ?? '',
      顧客: (p.customer as any)?.name ?? '',
      ステータス: PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS] ?? p.status,
      商流区分: FLOW_TYPE_LABELS[p.flow_type as keyof typeof FLOW_TYPE_LABELS] ?? p.flow_type,
      売上予定額: p.sales_amount,
      予定原価: p.cost_planned,
      確定原価: p.cost_confirmed,
      粗利益: grossProfit,
      新規反響日: p.echo_date ?? '',
      初回接客日: p.first_meeting_date ?? '',
      申込日: p.application_date ?? '',
      契約日: p.contract_date ?? '',
      引渡し日: p.delivery_date ?? '',
      請求日: p.invoice_date ?? '',
      入金予定日: p.payment_plan_date ?? '',
      入金日: p.payment_date ?? '',
      登録日: p.created_at.split('T')[0],
    }
  })

  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      Object.values(row).map((v) => {
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    ),
  ]

  const bom = '﻿'
  const csv = bom + csvLines.join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="projects_${year ?? 'all'}_${month ?? 'all'}.csv"`,
    },
  })
}
