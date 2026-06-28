import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = await createClient()

  const updates = [
    { key: 'spreadsheet_id', value: body.spreadsheet_id ?? '' },
    { key: 'customer_sheet_name', value: body.customer_sheet_name ?? '仲介顧客管理' },
    { key: 'property_sheet_name', value: body.property_sheet_name ?? '仲介管理' },
  ]

  for (const { key, value } of updates) {
    await supabase
      .from('google_sync_settings')
      .update({ setting_value: value, updated_at: new Date().toISOString() })
      .eq('setting_key', key)
  }

  return NextResponse.json({ success: true })
}
