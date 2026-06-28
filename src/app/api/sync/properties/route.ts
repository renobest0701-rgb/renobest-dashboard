import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface PropertySyncPayload {
  property_name: string
  property_type?: string
  address?: string
  price?: number
  publish_status?: string
  sales_status?: string
  owner_type?: string
  assigned_user_email?: string
  company_project_flag?: boolean
  memo?: string
  spreadsheet_row_id?: string
  row_number?: number
}

function buildExternalId(payload: PropertySyncPayload): string {
  const name = payload.property_name.trim()
  if (payload.price) return `${name}:${payload.price}`
  if (payload.address) return `${name}:${payload.address.trim()}`
  return name
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.INTERNAL_API_SECRET
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: PropertySyncPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!payload.property_name) {
    return NextResponse.json({ error: 'property_name is required' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  let assignedUserId: string | null = null
  if (payload.assigned_user_email) {
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('email', payload.assigned_user_email)
      .single()
    assignedUserId = userRow?.id ?? null
  }

  const externalId = buildExternalId(payload)

  // spreadsheet_row_id または external_id で重複判定
  let existingId: string | null = null
  let isNew = true

  if (payload.spreadsheet_row_id) {
    const { data } = await supabase
      .from('properties')
      .select('id')
      .eq('spreadsheet_row_id', payload.spreadsheet_row_id)
      .single()
    if (data) { existingId = data.id; isNew = false }
  }

  if (isNew) {
    const { data } = await supabase
      .from('properties')
      .select('id')
      .eq('external_id', externalId)
      .single()
    if (data) { existingId = data.id; isNew = false }
  }

  const propertyData = {
    property_name: payload.property_name,
    property_type: payload.property_type ?? 'other',
    address: payload.address ?? null,
    price: payload.price ?? null,
    publish_status: payload.publish_status ?? 'unpublished',
    sales_status: payload.sales_status ?? 'active',
    owner_type: payload.owner_type ?? 'individual',
    assigned_user_id: assignedUserId,
    company_project_flag: payload.company_project_flag ?? false,
    memo: payload.memo ?? null,
    spreadsheet_row_id: payload.spreadsheet_row_id ?? null,
    external_id: externalId,
    sync_source: 'google_sheets',
    updated_at: new Date().toISOString(),
  }

  let propertyId: string
  let syncStatus: 'success' | 'duplicate'

  if (isNew) {
    const { data, error } = await supabase
      .from('properties')
      .insert(propertyData)
      .select('id')
      .single()

    if (error) {
      await supabase.from('sync_logs').insert({
        sync_type: 'property',
        source: 'google_sheets',
        sheet_name: payload.spreadsheet_row_id?.split(':')[0] ?? null,
        status: 'error',
        payload,
        error_message: error.message,
        row_number: payload.row_number ?? null,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    propertyId = data.id
    syncStatus = 'success'
  } else {
    propertyId = existingId!
    await supabase.from('properties').update(propertyData).eq('id', propertyId)
    syncStatus = 'duplicate'
  }

  await supabase.from('sync_logs').insert({
    sync_type: 'property',
    source: 'google_sheets',
    sheet_name: payload.spreadsheet_row_id?.split(':')[0] ?? null,
    status: syncStatus,
    payload,
    result: { property_id: propertyId, is_new: isNew },
    row_number: payload.row_number ?? null,
  })

  // 最終同期日時を更新
  await supabase
    .from('google_sync_settings')
    .update({ setting_value: new Date().toISOString() })
    .eq('setting_key', 'last_property_sync')

  return NextResponse.json({
    success: true,
    property_id: propertyId,
    is_new: isNew,
    status: syncStatus,
  })
}
