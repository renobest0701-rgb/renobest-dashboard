import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { z } from 'zod'

const VALID_STATUSES = [
  'new','negotiating','prospect_b','prospect_a','application',
  'contracted','delivered','invoiced','paid','on_hold','lost','cancelled',
] as const

const VALID_FLOW_TYPES = [
  'direct','referral','general_contractor','realty_mediation',
  'seller','new_build_consignment','vr_consignment','joint','other',
] as const

const DEPT_CODE_MAP: Record<string, string> = {
  REALTY:    '', // populated at runtime
  NEW_BUILD: '',
  VR_CG:     '',
}

const RowSchema = z.object({
  案件名:      z.string().min(1, '案件名は必須です'),
  部門コード:   z.string().min(1, '部門コードは必須です'),
  顧客名:      z.string().optional(),
  商流区分:    z.string().optional(),
  売上金額:    z.string().optional(),
  計画原価:    z.string().optional(),
  確定原価:    z.string().optional(),
  ステータス:  z.string().optional(),
  申込日:      z.string().optional(),
  契約日:      z.string().optional(),
  入金予定日:  z.string().optional(),
  入金日:      z.string().optional(),
  見込みランク: z.string().optional(),
  メモ:        z.string().optional(),
})

function parseCsv(text: string): Record<string, string>[] {
  // BOM除去
  const clean = text.replace(/^﻿/, '')
  const lines = clean.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  })
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuote && line[i + 1] === '"') { current += '"'; i++ }
      else inQuote = !inQuote
    } else if (char === ',' && !inQuote) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function parseDate(val: string | undefined): string | null {
  if (!val) return null
  const trimmed = val.trim()
  if (!trimmed) return null
  // YYYY-MM-DD or YYYY/MM/DD
  const normalized = trimmed.replace(/\//g, '-')
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  return null
}

function parseAmount(val: string | undefined): number {
  if (!val) return 0
  const n = parseInt(val.replace(/[,，￥¥\s]/g, ''))
  return isNaN(n) ? 0 : n
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    if (!isAdminOrExecutive(user)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const dryRun = formData.get('dryRun') === 'true'

  if (!file) return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 })

  const text = await file.text()
  const rows = parseCsv(text)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSVにデータ行がありません' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // 部門一覧取得
  const { data: departments } = await supabase
    .from('departments')
    .select('id, code')
    .eq('is_active', true)

  const deptMap = new Map<string, string>()
  for (const d of departments ?? []) deptMap.set(d.code, d.id)

  // システムユーザー（インポート用）= 最初の executive
  const { data: adminUsers } = await supabase
    .from('users')
    .select('id')
    .eq('is_active', true)
    .limit(1)
  const systemUserId = adminUsers?.[0]?.id

  if (!systemUserId) {
    return NextResponse.json({ error: 'インポート用ユーザーが見つかりません。先にユーザーを作成してください。' }, { status: 400 })
  }

  const results = { success: 0, failed: 0, skipped: 0, errors: [] as { row: number; message: string }[] }
  const projectsToInsert: Record<string, unknown>[] = []
  const customersToInsert: Record<string, unknown>[] = []

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2 // 1行目がヘッダー
    const row = rows[i]

    // バリデーション
    const parsed = RowSchema.safeParse(row)
    if (!parsed.success) {
      results.failed++
      results.errors.push({ row: rowNum, message: parsed.error.issues[0]?.message ?? '不正な行' })
      continue
    }

    const data = parsed.data
    const deptId = deptMap.get(data.部門コード)
    if (!deptId) {
      results.failed++
      results.errors.push({ row: rowNum, message: `部門コード "${data.部門コード}" が見つかりません` })
      continue
    }

    const status = data.ステータス ?? 'new'
    if (!VALID_STATUSES.includes(status as any)) {
      results.failed++
      results.errors.push({ row: rowNum, message: `ステータス "${status}" が無効です` })
      continue
    }

    const flowType = data.商流区分 || 'other'
    if (!VALID_FLOW_TYPES.includes(flowType as any)) {
      results.failed++
      results.errors.push({ row: rowNum, message: `商流区分 "${flowType}" が無効です` })
      continue
    }

    const prospectRank = data.見込みランク && ['a','b','other'].includes(data.見込みランク)
      ? data.見込みランク as 'a' | 'b' | 'other'
      : 'b'

    if (data.顧客名) {
      customersToInsert.push({
        _rowNum: rowNum,
        name: data.顧客名,
        created_by: systemUserId,
      })
    }

    projectsToInsert.push({
      _rowNum:          rowNum,
      _customerName:    data.顧客名 ?? null,
      name:             data.案件名,
      department_id:    deptId,
      created_by:       systemUserId,
      status,
      flow_type:        flowType,
      sales_amount:     parseAmount(data.売上金額),
      cost_planned:     parseAmount(data.計画原価),
      cost_confirmed:   parseAmount(data.確定原価),
      prospect_rank:    prospectRank,
      application_date: parseDate(data.申込日),
      contract_date:    parseDate(data.契約日),
      payment_plan_date:parseDate(data.入金予定日),
      payment_date:     parseDate(data.入金日),
      customer_memo:    data.メモ || null,
    })

    results.success++
  }

  // ドライランは検証のみ
  if (dryRun || results.failed > 0) {
    return NextResponse.json(results)
  }

  // 本番インポート
  for (const proj of projectsToInsert) {
    const { _rowNum, _customerName, ...projectData } = proj as any
    let customerId: string | null = null

    if (_customerName) {
      const { data: customer } = await supabase
        .from('customers')
        .insert({ name: _customerName, created_by: systemUserId })
        .select('id')
        .single()
      customerId = customer?.id ?? null
    }

    const { data: newProject, error } = await supabase
      .from('projects')
      .insert({ ...projectData, customer_id: customerId })
      .select('id')
      .single()

    if (error || !newProject) {
      results.success--
      results.failed++
      results.errors.push({ row: _rowNum, message: error?.message ?? 'DB挿入エラー' })
      continue
    }

    // 担当者アサイン
    await supabase.from('project_assignments').insert({
      project_id:      newProject.id,
      user_id:         systemUserId,
      assignment_role: 'main',
      commission_rate: 100,
    })

    // 変更ログ
    await supabase.from('change_logs').insert({
      target_table: 'projects',
      target_id:    newProject.id,
      project_id:   newProject.id,
      changed_by:   systemUserId,
      field_name:   'status',
      old_value:    null,
      new_value:    projectData.status,
      reason:       'CSVインポートによる初期データ登録',
    })
  }

  return NextResponse.json(results)
}
