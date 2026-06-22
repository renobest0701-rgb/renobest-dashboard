import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabase = await createClient()
  let query = supabase
    .from('inquiry_reports')
    .select('*, user:users(id,full_name)')
    .order('report_week', { ascending: false })

  if (userId) query = query.eq('user_id', userId)
  if (from) query = query.gte('report_week', from)
  if (to) query = query.lte('report_week', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const { user_id, report_week, source, count, notes } = body

  // 自分のデータのみ or 管理者
  const targetUserId = user_id ?? (await getMyUserId(user.id))
  if (!targetUserId) return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 400 })

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('inquiry_reports')
    .upsert(
      { user_id: targetUserId, report_week, source, count: count ?? 0, notes },
      { onConflict: 'user_id,report_week,source' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

async function getMyUserId(authUserId: string): Promise<string | null> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single()
  return data?.id ?? null
}
