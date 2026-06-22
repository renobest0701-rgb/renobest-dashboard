import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { z } from 'zod'

const VALID_ROLES = ['staff', 'manager', 'accounting', 'executive', 'non_sales'] as const

const RowSchema = z.object({
  氏名:       z.string().min(1, '氏名は必須です'),
  メール:     z.string().email('メールアドレスが無効です'),
  ロール:     z.string().transform((v) => v.trim()).pipe(
    z.enum(VALID_ROLES, { message: `ロールは ${VALID_ROLES.join(' / ')} のいずれか` })
  ),
  部門コード: z.string().optional(),
  パスワード: z.string().optional(),
})

function parseCsv(text: string): Record<string, string>[] {
  const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
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
      result.push(current); current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
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

  const { data: departments } = await supabase
    .from('departments')
    .select('id, code')
    .eq('is_active', true)
  const deptMap = new Map<string, string>()
  for (const d of departments ?? []) deptMap.set(d.code, d.id)

  const { data: roles } = await supabase.from('roles').select('id, name')
  const roleMap = new Map<string, string>()
  for (const r of roles ?? []) roleMap.set(r.name, r.id)

  const results = { success: 0, failed: 0, skipped: 0, errors: [] as { row: number; message: string }[] }

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2
    const row = rows[i]

    const parsed = RowSchema.safeParse(row)
    if (!parsed.success) {
      results.failed++
      results.errors.push({ row: rowNum, message: parsed.error.issues[0]?.message ?? '不正な行' })
      continue
    }

    const data = parsed.data

    // 部門コードの検証（複数指定の場合は最初の有効な部門を使用）
    let deptId: string | null = null
    if (data.部門コード) {
      const deptCodes = data.部門コード.split(',').map((c) => c.trim()).filter(Boolean)
      for (const code of deptCodes) {
        const found = deptMap.get(code)
        if (found) { deptId = found; break }
      }
      if (!deptId) {
        results.failed++
        results.errors.push({ row: rowNum, message: `部門コード "${data.部門コード}" が見つかりません` })
        continue
      }
    }

    const roleId = roleMap.get(data.ロール)
    if (!roleId) {
      results.failed++
      results.errors.push({ row: rowNum, message: `ロール "${data.ロール}" がDBに存在しません` })
      continue
    }

    // 重複チェック
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', data.メール)
      .maybeSingle()

    if (existing) {
      results.skipped++
      continue
    }

    if (dryRun) {
      results.success++
      continue
    }

    // Supabase Auth ユーザー作成
    const password = (data.パスワード && data.パスワード.length >= 8) ? data.パスワード : generatePassword()
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: data.メール,
      password,
      email_confirm: true,
    })

    if (authError || !authUser.user) {
      results.failed++
      results.errors.push({ row: rowNum, message: authError?.message ?? 'Auth作成エラー' })
      continue
    }

    // usersテーブル挿入
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUser.user.id,
        email: data.メール,
        full_name: data.氏名,
        department_id: deptId,
        is_active: true,
      })
      .select('id')
      .single()

    if (userError || !newUser) {
      // ロールバック: Auth削除
      await supabase.auth.admin.deleteUser(authUser.user.id)
      results.failed++
      results.errors.push({ row: rowNum, message: userError?.message ?? 'ユーザー作成エラー' })
      continue
    }

    // user_roles挿入
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: newUser.id, role_id: roleId })

    if (roleError) {
      results.failed++
      results.errors.push({ row: rowNum, message: `ロール付与エラー: ${roleError.message}` })
      continue
    }

    results.success++
  }

  return NextResponse.json(results)
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
