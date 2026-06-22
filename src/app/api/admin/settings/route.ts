import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key') ?? 'project_fields'

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .eq('key', key)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  let user
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }
  if (!user.roles.some((r) => ['accounting', 'executive'].includes(r))) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const body = await request.json()
  const { key, value } = body

  const supabase = await createServiceClient()

  // ユーザーIDを取得
  const { data: me } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  const { data, error } = await supabase
    .from('system_settings')
    .upsert({ key, value, updated_by: me?.id, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
