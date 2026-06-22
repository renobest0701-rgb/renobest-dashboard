import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { saveLineSettings, deleteLineSetting, toggleLineSetting } from './actions'

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  application:      '新規申込',
  contract:         '新規契約・受注',
  payment:          '入金完了',
  cancel:           'キャンセル',
  important_change: '重要項目変更',
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  company_group:    '全社共有LINEグループ',
  department_group: '部門別LINEグループ',
  executive:        '経営者・上席',
  assignee:         '担当者本人',
  admin:            '管理者',
}

export default async function LineSettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) redirect('/personal')

  const params = await searchParams
  const supabase = await createClient()

  const { data: departments } = await supabase
    .from('departments')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order')

  const { data: settings } = await supabase
    .from('line_notification_settings')
    .select('*, departments(name)')
    .order('notification_type')
    .order('target_type')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">LINE通知設定</h1>
        <p className="text-sm text-gray-500 mt-1">
          送信先はLINEグループIDで管理します。トークンは環境変数
          <code className="bg-gray-100 px-1 rounded text-xs mx-1">LINE_CHANNEL_ACCESS_TOKEN</code>
          に設定してください。
        </p>
      </div>

      {params.msg === 'saved' && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          設定を保存しました
        </div>
      )}
      {params.msg === 'deleted' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
          設定を削除しました
        </div>
      )}

      {/* 新規設定追加フォーム */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">新規設定追加</h2>
        <form action={saveLineSettings as unknown as (formData: FormData) => void}
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">設定名</label>
              <input name="name" required placeholder="例：全社申込通知"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">通知種別</label>
              <select name="notification_type" required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(NOTIFICATION_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">送信先種別</label>
              <select name="target_type" required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(TARGET_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                対象部門
                <span className="ml-1 text-xs text-gray-400">（部門別のみ）</span>
              </label>
              <select name="department_id"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">全社共通</option>
                {departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LINEグループID
                <span className="ml-1 text-xs text-gray-400">（LINEデベロッパーコンソールで確認）</span>
              </label>
              <input name="line_group_id" placeholder="C..." required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            </div>
          </div>
          <button type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            追加する
          </button>
        </form>
      </section>

      {/* 設定一覧 */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">設定一覧</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">設定名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">通知種別</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">送信先</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">部門</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">グループID</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">有効</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(settings ?? []).length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">設定がありません</td></tr>
                ) : (
                  (settings ?? []).map((s) => (
                    <tr key={s.id} className={`hover:bg-gray-50 ${!s.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          {NOTIFICATION_TYPE_LABELS[s.notification_type] ?? s.notification_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {TARGET_TYPE_LABELS[s.target_type] ?? s.target_type}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {(s as any).departments?.name ?? '全社'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-32 truncate">
                        {s.line_group_id ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <form action={toggleLineSetting as unknown as (formData: FormData) => void} className="inline">
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="is_active" value={String(!s.is_active)} />
                          <button type="submit"
                            className={`w-10 h-6 rounded-full transition-colors ${s.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                          >
                            <span className={`block w-4 h-4 bg-white rounded-full mx-auto transition-transform ${s.is_active ? 'translate-x-2' : '-translate-x-2'}`} />
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-3">
                        <form action={deleteLineSetting as unknown as (formData: FormData) => void}>
                          <input type="hidden" name="id" value={s.id} />
                          <button type="submit"
                            className="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors"
                            onClick={(e) => { if (!confirm('削除しますか？')) e.preventDefault() }}>
                            削除
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 通知テスト */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">接続テスト</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">テスト送信の手順</p>
          <ol className="list-decimal list-inside space-y-1 text-amber-700">
            <li>LINE Developersコンソールでチャンネルアクセストークンを取得</li>
            <li>環境変数 <code className="bg-amber-100 px-1 rounded">LINE_CHANNEL_ACCESS_TOKEN</code> に設定</li>
            <li>テスト案件でステータスを「申込」に変更して動作確認</li>
            <li>通知ログ画面（管理者 → 通知ログ）で結果を確認</li>
          </ol>
        </div>
      </section>
    </div>
  )
}
