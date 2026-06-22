import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { id: projectId } = await params
  const body = await request.json()
  const { email, assignment_role, commission_rate } = body

  const supabase = await createServiceClient()

  // メールアドレスからユーザーを検索
  const { data: user } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('email', email)
    .eq('is_active', true)
    .single()

  if (!user) {
    return NextResponse.json({ error: `メールアドレス "${email}" のユーザーが見つかりません` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_assignments')
    .insert({
      project_id: projectId,
      user_id: user.id,
      assignment_role: assignment_role ?? 'sub',
      commission_rate: commission_rate ?? 0,
    })
    .select('id, assignment_role, commission_rate, user:users(full_name)')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'この担当者はすでに追加されています' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await request.json()
  const { assignment_id, commission_rate } = body

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('project_assignments')
    .update({ commission_rate })
    .eq('id', assignment_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const assignmentId = searchParams.get('id')
  if (!assignmentId) return NextResponse.json({ error: 'idが必要です' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase
    .from('project_assignments')
    .delete()
    .eq('id', assignmentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
