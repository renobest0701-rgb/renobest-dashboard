import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, isAdminOrExecutive, isDeptManager } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try { await requireAuth() } catch { return NextResponse.json({ error: '認証が必要です' }, { status: 401 }) }

  const year = Number(request.nextUrl.searchParams.get('year') ?? new Date().getFullYear())
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('targets')
    .select(`
      id, target_scope, target_type, target_period, target_year, target_month,
      user_id, department_id, sales_target, profit_target,
      user:users ( id, full_name, email ),
      department:departments ( id, name, code )
    `)
    .eq('target_year', year)
    .order('target_scope')
    .order('target_month', { nullsFirst: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  let authUser: Awaited<ReturnType<typeof requireAuth>>
  try { authUser = await requireAuth() } catch { return NextResponse.json({ error: '認証が必要です' }, { status: 401 }) }

  const body = await request.json()
  const {
    target_scope, target_type = 'direct', target_period, target_year,
    target_month, user_id, department_id, sales_target, profit_target,
  } = body

  const canEdit =
    isAdminOrExecutive(authUser) ||
    (authUser.roles.includes('manager') &&
      (target_scope === 'personal' || target_scope === 'department') &&
      isDeptManager(authUser, department_id ?? undefined))

  if (!canEdit) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('targets')
    .upsert({
      target_scope,
      target_type,
      target_period,
      target_year,
      target_month: target_month ?? null,
      user_id: user_id ?? null,
      department_id: department_id ?? null,
      sales_target: Number(sales_target) || 0,
      profit_target: Number(profit_target) || 0,
    }, {
      onConflict: 'target_scope,target_type,target_period,target_year,target_month,user_id,department_id',
      ignoreDuplicates: false,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 個人目標保存後 → 同じ部門・期間・タイプの個人合計を部門目標へ自動反映
  if (target_scope === 'personal' && department_id) {
    await aggregateToDepartment(supabase, {
      target_type, target_period, target_year, target_month: target_month ?? null, department_id,
    })
  }

  return NextResponse.json({ ok: true, id: data?.id })
}

async function aggregateToDepartment(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  params: {
    target_type: string
    target_period: string
    target_year: number
    target_month: number | null
    department_id: string
  }
) {
  const { target_type, target_period, target_year, target_month, department_id } = params

  const q = supabase
    .from('targets')
    .select('sales_target, profit_target')
    .eq('target_scope', 'personal')
    .eq('target_type', target_type)
    .eq('target_period', target_period)
    .eq('target_year', target_year)
    .eq('department_id', department_id)

  if (target_month != null) {
    q.eq('target_month', target_month)
  } else {
    q.is('target_month', null)
  }

  const { data: rows } = await q
  if (!rows) return

  const totalSales = rows.reduce((s, r) => s + (r.sales_target ?? 0), 0)
  const totalProfit = rows.reduce((s, r) => s + (r.profit_target ?? 0), 0)

  await supabase
    .from('targets')
    .upsert({
      target_scope: 'department',
      target_type,
      target_period,
      target_year,
      target_month,
      user_id: null,
      department_id,
      sales_target: totalSales,
      profit_target: totalProfit,
    }, {
      onConflict: 'target_scope,target_type,target_period,target_year,target_month,user_id,department_id',
      ignoreDuplicates: false,
    })
}
