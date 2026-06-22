import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .neq('status', 'cancelled')

  if (userId) query = query.eq('created_by', userId)
  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)

  const { count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: count ?? 0 })
}
