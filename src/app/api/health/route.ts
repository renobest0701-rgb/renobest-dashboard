import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
  'INTERNAL_API_SECRET',
]

const OPTIONAL_ENV_VARS = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
]

export async function GET() {
  const checks: { name: string; status: 'ok' | 'warn' | 'error'; message?: string }[] = []

  // 必須環境変数チェック
  for (const key of REQUIRED_ENV_VARS) {
    const val = process.env[key]
    checks.push({
      name: key,
      status: val ? 'ok' : 'error',
      message: val ? undefined : '未設定',
    })
  }

  // オプション環境変数チェック
  for (const key of OPTIONAL_ENV_VARS) {
    const val = process.env[key]
    checks.push({
      name: key,
      status: val ? 'ok' : 'warn',
      message: val ? undefined : '未設定（LINE通知が無効になります）',
    })
  }

  // DB疎通確認
  try {
    const supabase = await createServiceClient()
    const { error } = await supabase.from('departments').select('id').limit(1)
    checks.push({
      name: 'Supabase DB',
      status: error ? 'error' : 'ok',
      message: error?.message,
    })
  } catch (err) {
    checks.push({ name: 'Supabase DB', status: 'error', message: String(err) })
  }

  const hasError = checks.some((c) => c.status === 'error')
  const hasWarn  = checks.some((c) => c.status === 'warn')

  return NextResponse.json(
    {
      status: hasError ? 'error' : hasWarn ? 'warn' : 'ok',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: hasError ? 503 : 200 }
  )
}
