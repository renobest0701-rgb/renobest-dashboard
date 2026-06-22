// Supabase Edge Function: 失敗した LINE 通知の自動リトライ
// cron: "*/5 * * * *" (5分ごと) → supabase/config.toml で設定
// 対象: result='failed' かつ retry_count < 3 かつ updated_at < 10分前

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LINE_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!
const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? ''
const INTERNAL_SECRET = Deno.env.get('INTERNAL_API_SECRET') ?? ''

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  // リトライ対象ログ取得
  const { data: failedLogs, error } = await supabase
    .from('line_notification_logs')
    .select('id, notification_type, send_target, retry_count, project_id')
    .eq('result', 'failed')
    .lt('retry_count', 3)
    .lt('updated_at', tenMinutesAgo)
    .limit(10)

  if (error) {
    console.error('Failed to fetch logs:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!failedLogs || failedLogs.length === 0) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no_pending' }))
  }

  console.log(`Retrying ${failedLogs.length} failed notifications`)

  const results: { logId: string; success: boolean }[] = []

  for (const log of failedLogs) {
    try {
      const res = await fetch(`${APP_URL}/api/line/notify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': INTERNAL_SECRET,
        },
        body: JSON.stringify({ logId: log.id }),
      })

      const data = await res.json()
      results.push({ logId: log.id, success: data.success ?? false })
    } catch (err) {
      console.error(`Failed to resend log ${log.id}:`, err)
      results.push({ logId: log.id, success: false })
    }
  }

  const successCount = results.filter((r) => r.success).length

  return new Response(
    JSON.stringify({
      processed: results.length,
      succeeded: successCount,
      failed: results.length - successCount,
      results,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
