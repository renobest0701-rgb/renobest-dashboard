import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { company_sales_share, team_sales_share, company_cost_share, team_cost_share } = body

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .update({ company_sales_share, team_sales_share, company_cost_share, team_cost_share })
    .eq('id', id)
    .select('id, company_sales_share, team_sales_share, company_cost_share, team_cost_share')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
