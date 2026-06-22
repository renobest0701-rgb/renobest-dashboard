'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

type Role = 'staff' | 'manager' | 'accounting' | 'executive' | 'non_sales'

const ROLE_LABELS: Record<Role, string> = {
  staff:      '営業',
  manager:    '部門長',
  accounting: '経理',
  executive:  '経営者',
  non_sales:  '非営業',
}

const ROLE_COLORS: Record<Role, string> = {
  staff:      'bg-blue-100 text-blue-700',
  manager:    'bg-purple-100 text-purple-700',
  accounting: 'bg-orange-100 text-orange-700',
  executive:  'bg-red-100 text-red-700',
  non_sales:  'bg-gray-100 text-gray-600',
}

interface Dept { id: string; code: string; name: string }
interface UserRow {
  id: string
  full_name: string
  email: string
  is_active: boolean
  department_id: string | null
  department?: Dept | null
  user_roles: { roles: { name: Role } | null }[]
}

interface Props {
  users: UserRow[]
  departments: Dept[]
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-sm text-gray-700 align-middle">{children}</td>
}

export function UserTable({ users: initialUsers, departments }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [saving, setSaving] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function update(userId: string, field: string, value: unknown) {
    setSaving(`${userId}-${field}`)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, field, value }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? '更新に失敗しました')
        return
      }
      startTransition(() => {
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id !== userId) return u
            if (field === 'department_id') return { ...u, department_id: value as string | null }
            if (field === 'is_active') return { ...u, is_active: value as boolean }
            if (field === 'role') {
              return {
                ...u,
                user_roles: [{ roles: { name: value as Role } }],
              }
            }
            return u
          })
        )
      })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {['氏名', 'メール', 'ロール', '部門', '状態'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u) => {
            const role = u.user_roles[0]?.roles?.name
            const isSaving = (field: string) => saving === `${u.id}-${field}`

            return (
              <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                <Cell>
                  <span className="font-medium text-gray-900">{u.full_name}</span>
                </Cell>
                <Cell>
                  <span className="text-gray-500">{u.email}</span>
                </Cell>

                {/* ロール変更 */}
                <Cell>
                  <div className="flex items-center gap-1.5">
                    {role && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role]}`}>
                        {ROLE_LABELS[role]}
                      </span>
                    )}
                    <select
                      defaultValue={role ?? ''}
                      disabled={!!saving}
                      onChange={(e) => update(u.id, 'role', e.target.value)}
                      className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 bg-white hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="" disabled>変更...</option>
                      {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    {isSaving('role') && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                  </div>
                </Cell>

                {/* 部門変更 */}
                <Cell>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={u.department_id ?? ''}
                      disabled={!!saving}
                      onChange={(e) => update(u.id, 'department_id', e.target.value || null)}
                      className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 bg-white hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 max-w-[140px]"
                    >
                      <option value="">（未設定）</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    {isSaving('department_id') && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                  </div>
                </Cell>

                {/* 有効/無効切替 */}
                <Cell>
                  <button
                    disabled={!!saving}
                    onClick={() => update(u.id, 'is_active', !u.is_active)}
                    className="flex items-center gap-1 text-xs font-medium disabled:opacity-50"
                  >
                    {isSaving('is_active') ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : u.is_active ? (
                      <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-green-600">有効</span></>
                    ) : (
                      <><XCircle className="w-4 h-4 text-gray-400" /><span className="text-gray-400">無効</span></>
                    )}
                  </button>
                </Cell>
              </tr>
            )
          })}
        </tbody>
      </table>
      {users.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">ユーザーが登録されていません</div>
      )}
    </div>
  )
}
