import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

async function checkExecutive() {
  const user = await requireAuth()
  if (!user.roles.includes('executive')) {
    throw new Error('forbidden')
  }
  return user
}

export async function GET() {
  try {
    await checkExecutive()
  } catch {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('service_credentials')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  try {
    await checkExecutive()
  } catch {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const body = await request.json()
  const { name, category, url, login_id, password, notes, sort_order } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'サービス名は必須です' }, { status: 400 })
  }

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('service_credentials')
    .insert({ name: name.trim(), category: category ?? 'other', url, login_id, password, notes, sort_order: sort_order ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  try {
    await checkExecutive()
  } catch {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const body = await request.json()
  const { id, ...fields } = body

  if (!id) return NextResponse.json({ error: 'idが必要です' }, { status: 400 })

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('service_credentials')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  try {
    await checkExecutive()
  } catch {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'idが必要です' }, { status: 400 })

  const supabase = await createServiceClient()
  const { error } = await supabase
    .from('service_credentials')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
