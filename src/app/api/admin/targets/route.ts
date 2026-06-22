import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, isAdminOrExecutive, isDeptManager } from '@/lib/auth'

// GET /api/admin/targets?year=2026
export async function GET(request: NextRequest) {
  try { await requireAuth() } catch { return NextResponse.json({ error: '認証が必要です' }, { status: 401 }) }

  const year = Number(request.nextUrl.searchParams.get('year') ?? new Date().getFullYear())
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('targets')
    .select(`
      id, target_scope, target_period, target_year, target_month,
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

// POST /api/admin/targets  (upsert)
export async function POST(request: NextRequest) {
  let authUser: Awaited<ReturnType<typeof requireAuth>>
  try { authUser = await requireAuth() } catch { return NextResponse.json({ error: '認証が必要です' }, { status: 401 }) }

  const body = await request.json()
  const { target_scope, target_period, target_year, target_month, user_id, department_id, sales_target, profit_target } = body

  const canEdit =
    isAdminOrExecutive(authUser) ||
    (authUser.roles.includes('manager') && (
      target_scope === 'personal' || target_scope === 'department'
    ) && isDeptManager(authUser, department_id ?? undefined))

  if (!canEdit) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('targets')
    .upsert({
      target_scope,
      target_period,
      target_year,
      target_month: target_month ?? null,
      user_id: user_id ?? null,
      department_id: department_id ?? null,
      sales_target: Number(sales_target) || 0,
      profit_target: Number(profit_target) || 0,
    }, {
      onConflict: 'target_scope,target_period,target_year,target_month,user_id,department_id',
      ignoreDuplicates: false,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data?.id })
}
