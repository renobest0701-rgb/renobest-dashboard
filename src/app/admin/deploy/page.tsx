import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CheckCircle2, XCircle, AlertTriangle, ExternalLink } from 'lucide-react'

async function getHealthCheck() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/health`, { cache: 'no-store' })
    return await res.json()
  } catch {
    return { status: 'error', checks: [] }
  }
}

export default async function DeployCheckPage() {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) redirect('/personal')

  const health = await getHealthCheck()

  function StatusIcon({ status }: { status: 'ok' | 'warn' | 'error' }) {
    if (status === 'ok')   return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
    if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
    return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
  }

  const deployChecklist = [
    {
      category: 'Supabase設定',
      items: [
        { label: 'プロジェクトを本番Supabaseに作成済み', note: 'supabase.com でプロジェクト作成' },
        { label: 'migration 001〜004 を順番に実行済み', note: 'Supabase SQLエディタまたはCLIで実行' },
        { label: 'RLSポリシー（002）を適用済み', note: 'すべてのテーブルでRLS有効化を確認' },
        { label: 'Auth設定（メール/パスワード認証）を有効化', note: 'Supabase Auth設定画面' },
        { label: 'Site URL を本番URLに設定済み', note: 'Auth > URL Configuration' },
      ]
    },
    {
      category: 'Vercel環境変数',
      items: [
        { label: 'NEXT_PUBLIC_SUPABASE_URL 設定済み', note: 'Supabase Project Settings > API' },
        { label: 'NEXT_PUBLIC_SUPABASE_ANON_KEY 設定済み', note: 'Supabase Project Settings > API' },
        { label: 'SUPABASE_SERVICE_ROLE_KEY 設定済み', note: '⚠️ 本番のみ。フロントには公開しない' },
        { label: 'NEXT_PUBLIC_APP_URL 設定済み', note: '例: https://renobest.vercel.app' },
        { label: 'INTERNAL_API_SECRET 設定済み', note: 'ランダムな文字列（例: openssl rand -hex 32）' },
        { label: 'LINE_CHANNEL_ACCESS_TOKEN 設定済み', note: 'LINE Developersコンソール' },
        { label: 'LINE_CHANNEL_SECRET 設定済み', note: 'LINE Developersコンソール' },
      ]
    },
    {
      category: 'LINE設定',
      items: [
        { label: 'LINE Botを通知グループに招待済み', note: '各通知先グループに追加' },
        { label: 'LINE グループIDを通知設定画面に登録済み', note: '/admin/line' },
        { label: 'テスト送信で疎通確認済み', note: 'テスト案件でステータス変更して確認' },
      ]
    },
    {
      category: '初期データ',
      items: [
        { label: '管理者アカウントをSupabase Authで作成済み', note: 'Supabase Auth > Users > Invite' },
        { label: 'users テーブルにプロフィールを登録済み', note: 'auth_user_id, email, full_name, department_id' },
        { label: 'user_roles テーブルでロールを付与済み', note: 'accounting または executive ロールを付与' },
        { label: '目標値（targets）を設定済み', note: '/admin/targets' },
        { label: '見込み重み（prospect_weights）を確認済み', note: 'A=80%, B=50%, other=0%（変更可）' },
      ]
    },
    {
      category: 'Edge Function (LINE自動リトライ)',
      items: [
        { label: 'supabase/functions/line-retry をデプロイ済み', note: 'supabase functions deploy line-retry' },
        { label: 'Supabase cronジョブで5分ごとに実行設定済み', note: 'Supabase Dashboard > Edge Functions > Schedules' },
        { label: 'INTERNAL_API_SECRET をFunction Secretsに設定済み', note: 'supabase secrets set INTERNAL_API_SECRET=...' },
      ]
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">本番デプロイチェックリスト</h1>
        <p className="text-sm text-gray-500 mt-1">デプロイ前に全項目を確認してください</p>
      </div>

      {/* ヘルスチェック */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">システム診断</h2>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            health.status === 'ok'   ? 'bg-green-100 text-green-700' :
            health.status === 'warn' ? 'bg-amber-100 text-amber-700' :
                                       'bg-red-100 text-red-700'
          }`}>
            {health.status === 'ok' ? '正常' : health.status === 'warn' ? '警告あり' : 'エラーあり'}
          </span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {(health.checks ?? []).map((check: any) => (
            <div key={check.name} className="flex items-center gap-3 px-4 py-3">
              <StatusIcon status={check.status} />
              <span className="text-sm font-mono text-gray-700 flex-1">{check.name}</span>
              {check.message && (
                <span className="text-xs text-gray-500">{check.message}</span>
              )}
            </div>
          ))}
          {(health.checks ?? []).length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">診断情報を取得できませんでした</div>
          )}
        </div>
      </section>

      {/* チェックリスト */}
      {deployChecklist.map((section) => (
        <section key={section.category}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {section.category}
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {section.items.map((item, i) => (
              <label key={i} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>
                </div>
              </label>
            ))}
          </div>
        </section>
      ))}

      {/* コマンドリファレンス */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">デプロイコマンドリファレンス</h2>
        <div className="bg-gray-900 rounded-xl p-5 space-y-4">
          {[
            {
              label: 'Supabase マイグレーション実行',
              cmd:   'supabase db push',
            },
            {
              label: 'Edge Function デプロイ',
              cmd:   'supabase functions deploy line-retry --no-verify-jwt',
            },
            {
              label: 'Edge Function シークレット設定',
              cmd:   'supabase secrets set INTERNAL_API_SECRET=<secret> NEXT_PUBLIC_APP_URL=<url>',
            },
            {
              label: 'Vercel デプロイ',
              cmd:   'vercel --prod',
            },
          ].map(({ label, cmd }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 mb-1"># {label}</p>
              <code className="block text-sm text-green-400 font-mono">{cmd}</code>
            </div>
          ))}
        </div>
      </section>

      {/* ヘルスチェックAPIリンク */}
      <div className="flex items-center gap-2 text-sm text-blue-600">
        <ExternalLink className="w-4 h-4" />
        <a href="/api/health" target="_blank" rel="noopener noreferrer"
          className="hover:underline">
          /api/health — システム診断JSON（モニタリングに活用可）
        </a>
      </div>
    </div>
  )
}
