import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { GoogleSyncClient } from './GoogleSyncClient'

export const dynamic = 'force-dynamic'

export default async function GoogleSyncPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('google_sync_settings')
    .select('*')
    .order('setting_key')

  const { data: logs } = await supabase
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  return (
    <GoogleSyncClient
      settings={settings ?? []}
      logs={logs ?? []}
      appUrl={appUrl}
      currentUser={user}
    />
  )
}
