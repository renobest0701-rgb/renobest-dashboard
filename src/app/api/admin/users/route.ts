import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, isAdminOrExecutive } from '@/lib/auth'

// PATCH /api/admin/users  { userId, field, value }
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()
    if (!isAdminOrExecutive(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const { userId, field, value } = body as { userId: string; field: string; value: unknown }

  if (!userId || !field) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  if (field === 'role') {
    // ロール変更: 既存ロールを削除して新しいロールを追加
    const { data: roleRow } = await supabase
      .from('roles')
      .select('id')
      .eq('name', value)
      .single()

    if (!roleRow) {
      return NextResponse.json({ error: `ロール "${value}" が見つかりません` }, { status: 400 })
    }

    await supabase.from('user_roles').delete().eq('user_id', userId)

    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role_id: roleRow.id })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (field === 'department_id') {
    const { error } = await supabase
      .from('users')
      .update({ department_id: value || null })
      .eq('id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (field === 'is_active') {
    const { error } = await supabase
      .from('users')
      .update({ is_active: Boolean(value) })
      .eq('id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: '不正なフィールド' }, { status: 400 })
}
