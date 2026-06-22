'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Eye, EyeOff, ExternalLink, Pencil, Trash2, X, Check, Loader2, KeyRound } from 'lucide-react'

const CATEGORIES = [
  { value: 'hosting',   label: 'ホスティング' },
  { value: 'database',  label: 'データベース' },
  { value: 'auth',      label: '認証・SSO' },
  { value: 'portal',    label: 'ポータルサイト' },
  { value: 'line',      label: 'LINE' },
  { value: 'sns',       label: 'SNS' },
  { value: 'analytics', label: 'アナリティクス' },
  { value: 'other',     label: 'その他' },
]

const CATEGORY_COLORS: Record<string, string> = {
  hosting:   'bg-blue-100 text-blue-700',
  database:  'bg-purple-100 text-purple-700',
  auth:      'bg-orange-100 text-orange-700',
  portal:    'bg-green-100 text-green-700',
  line:      'bg-emerald-100 text-emerald-700',
  sns:       'bg-pink-100 text-pink-700',
  analytics: 'bg-yellow-100 text-yellow-700',
  other:     'bg-gray-100 text-gray-600',
}

interface Credential {
  id: string
  name: string
  category: string
  url: string | null
  login_id: string | null
  password: string | null
  notes: string | null
  sort_order: number
}

const emptyForm = { name: '', category: 'other', url: '', login_id: '', password: '', notes: '', sort_order: 0 }

export function CredentialsManager() {
  const [items, setItems] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/credentials')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(item: Credential) {
    setEditId(item.id)
    setForm({
      name: item.name,
      category: item.category,
      url: item.url ?? '',
      login_id: item.login_id ?? '',
      password: item.password ?? '',
      notes: item.notes ?? '',
      sort_order: item.sort_order,
    })
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const body = {
        ...form,
        url: form.url || null,
        login_id: form.login_id || null,
        password: form.password || null,
        notes: form.notes || null,
        ...(editId ? { id: editId } : {}),
      }
      const res = await fetch('/api/admin/credentials', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? '保存に失敗しました')
        return
      }
      setShowForm(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    setDeleteId(id)
    const res = await fetch(`/api/admin/credentials?id=${id}`, { method: 'DELETE' })
    if (!res.ok) alert('削除に失敗しました')
    else setItems((prev) => prev.filter((i) => i.id !== id))
    setDeleteId(null)
  }

  function togglePassword(id: string) {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
  }

  const grouped = CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((i) => i.category === c.value),
  })).filter((g) => g.items.length > 0)

  const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          サービスを追加
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />読み込み中...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <KeyRound className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">サービスが登録されていません</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.value}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.label}</h2>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">サービス名</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">URL</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">ID / メール</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">パスワード</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">メモ</th>
                      <th className="px-4 py-2.5 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {group.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[item.category]}`}>
                              {catLabel(item.category)}
                            </span>
                            <span className="font-medium text-gray-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {item.url ? (
                            <div className="flex items-center gap-1">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-xs truncate max-w-[180px]"
                              >
                                {item.url}
                              </a>
                              <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {item.login_id ? (
                            <button
                              onClick={() => copyToClipboard(item.login_id!)}
                              title="クリックでコピー"
                              className="text-gray-700 hover:text-blue-600 text-xs font-mono"
                            >
                              {item.login_id}
                            </button>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {item.password ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => copyToClipboard(item.password!)}
                                title="クリックでコピー"
                                className="text-gray-700 hover:text-blue-600 text-xs font-mono"
                              >
                                {showPasswords[item.id] ? item.password : '••••••••'}
                              </button>
                              <button onClick={() => togglePassword(item.id)} className="text-gray-400 hover:text-gray-600">
                                {showPasswords[item.id]
                                  ? <EyeOff className="w-3.5 h-3.5" />
                                  : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">
                          {item.notes ?? ''}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => remove(item.id)}
                              disabled={deleteId === item.id}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                            >
                              {deleteId === item.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* モーダル */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{editId ? 'サービスを編集' : 'サービスを追加'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">サービス名 *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例: Supabase"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">カテゴリ</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ID / メールアドレス</label>
                <input
                  value={form.login_id}
                  onChange={(e) => setForm({ ...form, login_id: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">パスワード</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="パスワード"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="補足情報など"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">表示順</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                  className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                キャンセル
              </button>
              <button
                onClick={save}
                disabled={saving || !form.name.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
