'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Settings, RefreshCw, CheckCircle, XCircle, Copy, ChevronDown, ChevronUp, Code
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/lib/auth'

type Setting = {
  setting_key: string
  setting_value: string | null
  description: string | null
}

type SyncLog = {
  id: string
  sync_type: string
  sheet_name: string | null
  status: string
  error_message: string | null
  row_number: number | null
  payload: Record<string, unknown> | null
  result: Record<string, unknown> | null
  created_at: string
}

interface Props {
  settings: Setting[]
  logs: SyncLog[]
  appUrl: string
  currentUser: AuthUser
}

function getSetting(settings: Setting[], key: string) {
  return settings.find((s) => s.setting_key === key)?.setting_value ?? ''
}

const GAS_CUSTOMER_TEMPLATE = (apiUrl: string, apiSecret: string) => `// ============================================================
// RENOBEST 顧客管理シート → Supabase 同期スクリプト
// スプレッドシートのツール > スクリプトエディタ に貼り付けてください
// ============================================================

const API_URL = "${apiUrl}/api/sync/customers";
const API_SECRET = "${apiSecret || 'YOUR_API_SECRET'}";

// 列のマッピング（1始まり）
const COL = {
  customer_name: 1,   // A: 顧客名
  phone: 2,           // B: 電話番号
  email: 3,           // C: メールアドレス
  line_name: 4,       // D: LINE名
  language: 5,        // E: 言語
  customer_type: 6,   // F: 顧客種別（individual/corporate）
  rank: 7,            // G: ランク（a/b/c/d）
  source: 8,          // H: 媒体・出所
  assigned_user_email: 9, // I: 担当者メール
  status: 10,         // J: ステータス（active/inactive/lost）
  first_contact_status: 11, // K: 初回接触（not_contacted/contacted/meeting_set）
  last_contact_date: 12,  // L: 最終接触日（YYYY-MM-DD）
  next_action_date: 13,   // M: 次回予定日（YYYY-MM-DD）
  memo: 14,           // N: メモ
};

function syncAllCustomers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("仲介顧客管理");
  if (!sheet) { Logger.log("シートが見つかりません"); return; }

  const lastRow = sheet.getLastRow();
  let success = 0, errors = 0;

  for (let row = 2; row <= lastRow; row++) {
    const name = sheet.getRange(row, COL.customer_name).getValue();
    if (!name) continue;

    const formatDate = (v) => {
      if (!v) return null;
      const d = new Date(v);
      if (isNaN(d.getTime())) return null;
      return Utilities.formatDate(d, "Asia/Tokyo", "yyyy-MM-dd");
    };

    const payload = {
      customer_name: String(name),
      phone: String(sheet.getRange(row, COL.phone).getValue() || ''),
      email: String(sheet.getRange(row, COL.email).getValue() || ''),
      line_name: String(sheet.getRange(row, COL.line_name).getValue() || ''),
      language: String(sheet.getRange(row, COL.language).getValue() || 'ja'),
      customer_type: String(sheet.getRange(row, COL.customer_type).getValue() || 'individual'),
      rank: String(sheet.getRange(row, COL.rank).getValue() || 'c').toLowerCase(),
      source: String(sheet.getRange(row, COL.source).getValue() || ''),
      assigned_user_email: String(sheet.getRange(row, COL.assigned_user_email).getValue() || ''),
      status: String(sheet.getRange(row, COL.status).getValue() || 'active'),
      first_contact_status: String(sheet.getRange(row, COL.first_contact_status).getValue() || 'not_contacted'),
      last_contact_date: formatDate(sheet.getRange(row, COL.last_contact_date).getValue()),
      next_action_date: formatDate(sheet.getRange(row, COL.next_action_date).getValue()),
      memo: String(sheet.getRange(row, COL.memo).getValue() || ''),
      spreadsheet_row_id: "仲介顧客管理:" + row,
      row_number: row,
    };

    const options = {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + API_SECRET },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    try {
      const res = UrlFetchApp.fetch(API_URL, options);
      const code = res.getResponseCode();
      if (code === 200) { success++; } else { errors++; Logger.log("行" + row + " エラー: " + res.getContentText()); }
    } catch (e) {
      errors++;
      Logger.log("行" + row + " 例外: " + e);
    }
  }

  Logger.log(\`完了: 成功 \${success}件 / エラー \${errors}件\`);
  SpreadsheetApp.getUi().alert(\`同期完了\\n成功: \${success}件 / エラー: \${errors}件\`);
}

// 時間トリガー用（毎日AM8時に実行する場合）
function setupTrigger() {
  ScriptApp.newTrigger("syncAllCustomers")
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .create();
  Logger.log("トリガーを設定しました");
}`

const GAS_PROPERTY_TEMPLATE = (apiUrl: string, apiSecret: string) => `// ============================================================
// RENOBEST 仲介物件管理シート → Supabase 同期スクリプト
// ============================================================

const PROP_API_URL = "${apiUrl}/api/sync/properties";
const PROP_API_SECRET = "${apiSecret || 'YOUR_API_SECRET'}";

const PROP_COL = {
  property_name: 1,   // A: 物件名
  property_type: 2,   // B: 種別（mansion/house/land/building/other）
  address: 3,         // C: 所在地
  price: 4,           // D: 価格（万円）
  publish_status: 5,  // E: 掲載状況（published/unpublished/draft）
  sales_status: 6,    // F: 販売状況（active/under_contract/sold/withdrawn/other）
  owner_type: 7,      // G: オーナー種別（individual/corporate/other）
  assigned_user_email: 8, // H: 担当者メール
  company_project_flag: 9, // I: 自社案件フラグ（TRUE/FALSE）
  memo: 10,           // J: メモ
};

function syncAllProperties() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("仲介管理");
  if (!sheet) { Logger.log("シートが見つかりません"); return; }

  const lastRow = sheet.getLastRow();
  let success = 0, errors = 0;

  for (let row = 2; row <= lastRow; row++) {
    const name = sheet.getRange(row, PROP_COL.property_name).getValue();
    if (!name) continue;

    const priceRaw = sheet.getRange(row, PROP_COL.price).getValue();
    const price = priceRaw ? Math.round(Number(priceRaw) * 10000) : null;

    const payload = {
      property_name: String(name),
      property_type: String(sheet.getRange(row, PROP_COL.property_type).getValue() || 'other'),
      address: String(sheet.getRange(row, PROP_COL.address).getValue() || ''),
      price: price,
      publish_status: String(sheet.getRange(row, PROP_COL.publish_status).getValue() || 'unpublished'),
      sales_status: String(sheet.getRange(row, PROP_COL.sales_status).getValue() || 'active'),
      owner_type: String(sheet.getRange(row, PROP_COL.owner_type).getValue() || 'individual'),
      assigned_user_email: String(sheet.getRange(row, PROP_COL.assigned_user_email).getValue() || ''),
      company_project_flag: sheet.getRange(row, PROP_COL.company_project_flag).getValue() === true,
      memo: String(sheet.getRange(row, PROP_COL.memo).getValue() || ''),
      spreadsheet_row_id: "仲介管理:" + row,
      row_number: row,
    };

    const options = {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + PROP_API_SECRET },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    try {
      const res = UrlFetchApp.fetch(PROP_API_URL, options);
      const code = res.getResponseCode();
      if (code === 200) { success++; } else { errors++; Logger.log("行" + row + " エラー: " + res.getContentText()); }
    } catch (e) {
      errors++;
      Logger.log("行" + row + " 例外: " + e);
    }
  }

  Logger.log(\`完了: 成功 \${success}件 / エラー \${errors}件\`);
  SpreadsheetApp.getUi().alert(\`同期完了\\n成功: \${success}件 / エラー: \${errors}件\`);
}`

export function GoogleSyncClient({ settings, logs, appUrl, currentUser }: Props) {
  const [spreadsheetId, setSpreadsheetId] = useState(getSetting(settings, 'spreadsheet_id'))
  const [customerSheet, setCustomerSheet] = useState(getSetting(settings, 'customer_sheet_name') || '仲介顧客管理')
  const [propertySheet, setPropertySheet] = useState(getSetting(settings, 'property_sheet_name') || '仲介管理')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showCustomerScript, setShowCustomerScript] = useState(false)
  const [showPropertyScript, setShowPropertyScript] = useState(false)
  const [logFilter, setLogFilter] = useState<'all' | 'error'>('all')
  const [copied, setCopied] = useState<string | null>(null)

  const lastCustomerSync = getSetting(settings, 'last_customer_sync')
  const lastPropertySync = getSetting(settings, 'last_property_sync')
  const apiSecret = process.env.NEXT_PUBLIC_INTERNAL_API_SECRET ?? '(設定済み)'

  async function saveSettings() {
    setSaving(true)
    try {
      await fetch('/api/admin/google-sync/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheet_id: spreadsheetId, customer_sheet_name: customerSheet, property_sheet_name: propertySheet }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const filteredLogs = logFilter === 'error'
    ? logs.filter((l) => l.status === 'error')
    : logs

  const errorCount = logs.filter((l) => l.status === 'error').length
  const successCount = logs.filter((l) => l.status === 'success').length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">Google スプレッドシート連携</h1>
      </div>

      {/* ステータスサマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">顧客 最終同期</div>
          <div className="text-sm font-medium text-gray-800">
            {lastCustomerSync ? new Date(lastCustomerSync).toLocaleString('ja-JP') : '未同期'}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">物件 最終同期</div>
          <div className="text-sm font-medium text-gray-800">
            {lastPropertySync ? new Date(lastPropertySync).toLocaleString('ja-JP') : '未同期'}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">成功件数（直近100件）</div>
          <div className="text-2xl font-bold text-green-600">{successCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">エラー件数（直近100件）</div>
          <div className="text-2xl font-bold text-red-600">{errorCount}</div>
        </div>
      </div>

      {/* 設定 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">シート設定</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">スプレッドシートID</label>
            <Input
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              スプレッドシートのURL: docs.google.com/spreadsheets/d/<strong>スプレッドシートID</strong>/edit
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">顧客管理シート名</label>
              <Input value={customerSheet} onChange={(e) => setCustomerSheet(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">物件管理シート名</label>
              <Input value={propertySheet} onChange={(e) => setPropertySheet(e.target.value)} />
            </div>
          </div>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          {saved ? <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> : <Settings className="w-4 h-4 mr-2" />}
          {saved ? '保存しました' : saving ? '保存中...' : '設定を保存'}
        </Button>
      </div>

      {/* API情報 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">API エンドポイント（GASスクリプトに設定）</h2>
        <div className="space-y-3">
          {[
            { label: '顧客同期エンドポイント', value: `${appUrl}/api/sync/customers`, key: 'customer_api' },
            { label: '物件同期エンドポイント', value: `${appUrl}/api/sync/properties`, key: 'property_api' },
          ].map(({ label, value, key }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 block mb-1">{label}</label>
              <div className="flex gap-2">
                <Input value={value} readOnly className="font-mono text-xs bg-gray-50" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(value, key)}
                >
                  {copied === key ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ))}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            <strong>APIシークレット</strong>はVercel環境変数の <code>INTERNAL_API_SECRET</code> を使用します。
            GASスクリプトの <code>API_SECRET</code> にその値を設定してください。
          </div>
        </div>
      </div>

      {/* GASスクリプトテンプレート */}
      <div className="space-y-3">
        {/* 顧客同期スクリプト */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            onClick={() => setShowCustomerScript(!showCustomerScript)}
          >
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-gray-800">GASスクリプト — 顧客同期（仲介顧客管理シート）</span>
            </div>
            {showCustomerScript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showCustomerScript && (
            <div className="border-t border-gray-200 p-4 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                <p><strong>使い方:</strong></p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>スプレッドシートを開き「拡張機能」→「Apps Script」を選択</li>
                  <li>下のスクリプトを貼り付けて保存（Ctrl+S）</li>
                  <li>「実行」→「syncAllCustomers」を選択して実行</li>
                  <li>定期実行は「setupTrigger」を一度実行するとAM8時に自動同期</li>
                </ol>
              </div>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 text-xs p-4 rounded-lg overflow-x-auto max-h-80 overflow-y-auto">
                  {GAS_CUSTOMER_TEMPLATE(appUrl, '')}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 bg-white"
                  onClick={() => copyToClipboard(GAS_CUSTOMER_TEMPLATE(appUrl, ''), 'customer_script')}
                >
                  {copied === 'customer_script' ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  <span className="ml-1">コピー</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 物件同期スクリプト */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            onClick={() => setShowPropertyScript(!showPropertyScript)}
          >
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-green-600" />
              <span className="font-medium text-gray-800">GASスクリプト — 物件同期（仲介管理シート）</span>
            </div>
            {showPropertyScript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPropertyScript && (
            <div className="border-t border-gray-200 p-4 space-y-3">
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 text-xs p-4 rounded-lg overflow-x-auto max-h-80 overflow-y-auto">
                  {GAS_PROPERTY_TEMPLATE(appUrl, '')}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 bg-white"
                  onClick={() => copyToClipboard(GAS_PROPERTY_TEMPLATE(appUrl, ''), 'property_script')}
                >
                  {copied === 'property_script' ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  <span className="ml-1">コピー</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 同期ログ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">同期ログ</h2>
          <div className="flex gap-2">
            <button
              className={cn('text-xs px-3 py-1 rounded-full border transition-colors', logFilter === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50')}
              onClick={() => setLogFilter('all')}
            >
              全て ({logs.length})
            </button>
            <button
              className={cn('text-xs px-3 py-1 rounded-full border transition-colors', logFilter === 'error' ? 'bg-red-600 text-white border-red-600' : 'border-red-200 text-red-600 hover:bg-red-50')}
              onClick={() => setLogFilter('error')}
            >
              エラーのみ ({errorCount})
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <th className="px-4 py-2 text-left font-medium">日時</th>
                <th className="px-4 py-2 text-left font-medium">種別</th>
                <th className="px-4 py-2 text-left font-medium">シート</th>
                <th className="px-4 py-2 text-left font-medium">行</th>
                <th className="px-4 py-2 text-left font-medium">ステータス</th>
                <th className="px-4 py-2 text-left font-medium">詳細</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                    ログがありません
                  </td>
                </tr>
              )}
              {filteredLogs.map((log) => (
                <tr key={log.id} className={cn(log.status === 'error' && 'bg-red-50/40')}>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="text-xs">
                      {log.sync_type === 'customer' ? '顧客' : log.sync_type === 'property' ? '物件' : log.sync_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{log.sheet_name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-600">{log.row_number ?? '-'}</td>
                  <td className="px-4 py-2">
                    {log.status === 'success' && (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3 h-3" /> 成功
                      </span>
                    )}
                    {log.status === 'duplicate' && (
                      <span className="text-blue-600">更新</span>
                    )}
                    {log.status === 'error' && (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-3 h-3" /> エラー
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500 max-w-xs truncate">
                    {log.error_message ?? (log.result ? JSON.stringify(log.result) : '-')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
