'use client'

import { useState, useRef } from 'react'
import { Upload, AlertCircle, CheckCircle2, XCircle, Users, FolderOpen } from 'lucide-react'

type ImportType = 'projects' | 'users'

interface ImportResult {
  success: number
  failed: number
  skipped: number
  errors: { row: number; message: string }[]
}

const PROJECT_COLUMNS = [
  ['案件名',     '案件の名称',                '●', 'A邸リフォーム工事'],
  ['部門コード', 'REALTY / NEW_BUILD / VR_CG', '●', 'REALTY'],
  ['顧客名',     '顧客または法人名',           '',  '山田太郎'],
  ['商流区分',   'direct / referral など',    '',  'direct'],
  ['売上金額',   '円（整数）',                '●', '3000000'],
  ['計画原価',   '円（整数）',                '',  '1500000'],
  ['確定原価',   '円（整数）',                '',  ''],
  ['ステータス', 'new / contracted など',      '●', 'contracted'],
  ['申込日',     'YYYY-MM-DD',               '',  '2025-01-15'],
  ['契約日',     'YYYY-MM-DD',               '',  '2025-02-01'],
  ['入金予定日', 'YYYY-MM-DD',               '',  '2025-06-30'],
  ['入金日',     'YYYY-MM-DD',               '',  ''],
  ['見込みランク','a / b / other',            '',  'b'],
  ['メモ',       '自由記述',                  '',  ''],
]

const USER_COLUMNS = [
  ['氏名',       '表示名',                            '●', '山田太郎'],
  ['メール',     'メールアドレス',                    '●', 'yamada@example.com'],
  ['ロール',     'staff / manager / accounting / executive', '●', 'staff'],
  ['部門コード', 'REALTY / NEW_BUILD / VR_CG（省略可）', '',  'REALTY'],
  ['パスワード', '8文字以上（省略時は自動生成）',      '',  'Pass1234!'],
]

export function CsvImportForm() {
  const [importType, setImportType] = useState<ImportType>('projects')
  const [file, setFile] = useState<File | null>(null)
  const [dryRun, setDryRun] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleTypeChange(type: ImportType) {
    setImportType(type)
    setFile(null)
    setResult(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setResult(null)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('dryRun', String(dryRun))

    try {
      const res = await fetch(`/api/import/${importType}`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'インポートに失敗しました')
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const columns = importType === 'projects' ? PROJECT_COLUMNS : USER_COLUMNS
  const successLabel = importType === 'projects' ? '案件' : 'ユーザー'
  const linkHref = importType === 'projects' ? '/projects' : '/admin/users'
  const linkLabel = importType === 'projects' ? '案件一覧を確認' : 'ユーザー管理を確認'

  return (
    <div className="space-y-6">
      {/* タブ切り替え */}
      <div className="flex gap-2">
        <button
          onClick={() => handleTypeChange('projects')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            importType === 'projects'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          案件インポート
        </button>
        <button
          onClick={() => handleTypeChange('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            importType === 'users'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Users className="w-4 h-4" />
          ユーザーインポート
        </button>
      </div>

      {/* フォーマット仕様 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-blue-800 mb-3">CSVフォーマット仕様</h2>
        <div className="text-xs text-blue-700 space-y-1.5">
          <p>1行目はヘッダー行として自動スキップします。文字コードは <strong>UTF-8（BOM付き可）</strong> に対応。</p>
          {importType === 'users' && (
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              パスワードを省略すると12文字のランダムパスワードが自動生成されます。後でSupabase Authからパスワードリセットメールを送付できます。
            </p>
          )}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-blue-200">
                {['列名', '内容', '必須', '例'].map((h) => (
                  <th key={h} className="text-left py-1.5 pr-4 text-blue-600 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-blue-700">
              {columns.map(([col, desc, req, ex]) => (
                <tr key={col} className="border-b border-blue-100">
                  <td className="py-1.5 pr-4 font-medium whitespace-nowrap">{col}</td>
                  <td className="py-1.5 pr-4">{desc}</td>
                  <td className="py-1.5 pr-4 text-center">{req}</td>
                  <td className="py-1.5 font-mono text-blue-500">{ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* サンプルCSV */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">サンプルCSV（先頭2行）</p>
          <pre className="text-xs bg-white border border-blue-200 rounded p-2 overflow-x-auto text-blue-600 font-mono">
            {importType === 'users'
              ? `氏名,メール,ロール,部門コード,パスワード\n田中太郎,tanaka@example.com,staff,REALTY,\n佐藤花子,sato@example.com,manager,REFORM,`
              : `案件名,部門コード,顧客名,商流区分,売上金額,計画原価,確定原価,ステータス,申込日,契約日,入金予定日,入金日,見込みランク,メモ\nA邸リフォーム,REALTY,山田太郎,direct,3000000,1500000,,contracted,2025-01-15,2025-02-01,2025-06-30,,b,`
            }
          </pre>
        </div>
      </div>

      {/* フォーム */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CSVファイル</label>
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              {file ? (
                <div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">クリックしてCSVを選択</p>
                  <p className="text-xs text-gray-400 mt-0.5">.csv（UTF-8）</p>
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setResult(null)
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">ドライラン（確認のみ・DBに書き込まない）</span>
            </label>
          </div>

          {dryRun && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700">
              ドライランモードです。問題がなければチェックを外して本番インポートを実行してください。
            </div>
          )}

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? '処理中...' : dryRun ? 'バリデーション実行' : '本番インポート実行'}
          </button>
        </form>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <div className="text-2xl font-bold text-green-700">{result.success}</div>
                <div className="text-xs text-green-600">{dryRun ? '取込可能' : '取込成功'}</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                <div className="text-xs text-red-500">エラー</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-500">{result.skipped}</div>
                <div className="text-xs text-gray-400">スキップ（重複）</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-red-100 text-xs font-semibold text-red-700">エラー詳細</div>
                <ul className="divide-y divide-red-100 max-h-48 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i} className="px-4 py-2 text-xs text-red-600">
                      <span className="font-medium">{e.row}行目：</span>{e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!dryRun && result.success > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                {result.success}件の{successLabel}を取り込みました。
                <a href={linkHref} className="ml-2 font-medium underline hover:no-underline">{linkLabel}</a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
