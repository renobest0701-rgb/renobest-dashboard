'use client'

import { useState } from 'react'
import { Users, Plus, Trash2, Loader2, Check } from 'lucide-react'

interface Assignment {
  id?: string
  assignment_role: 'main' | 'sub'
  commission_rate: number
  user?: { full_name: string }
  user_id?: string
}

interface RowProps {
  assignment: Assignment
  isLocked: boolean
  saving: string | null
  saved: string | null
  removing: string | null
  onUpdate: (id: string, rate: number) => void
  onRemove: (id: string) => void
}

function AssignmentRow({ assignment: a, isLocked, saving, saved, removing, onUpdate, onRemove }: RowProps) {
  const [localRate, setLocalRate] = useState(String(a.commission_rate ?? 0))
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100">
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-900">{a.user?.full_name ?? '—'}</span>
        <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">サブ</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={100}
          value={localRate}
          onChange={(e) => setLocalRate(e.target.value)}
          disabled={isLocked}
          className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
        />
        <span className="text-xs text-gray-500">%</span>
        {!isLocked && (
          <button
            onClick={() => onUpdate(a.id!, parseFloat(localRate) || 0)}
            disabled={!!saving}
            className="p-1 text-gray-400 hover:text-blue-600"
          >
            {saving === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
             saved === a.id ? <Check className="w-3.5 h-3.5 text-green-500" /> :
             <Check className="w-3.5 h-3.5" />}
          </button>
        )}
        {!isLocked && (
          <button
            onClick={() => onRemove(a.id!)}
            disabled={!!removing}
            className="p-1 text-gray-400 hover:text-red-600"
          >
            {removing === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  )
}


interface Props {
  projectId: string
  assignments: Assignment[]
  createdByName: string
  isLocked: boolean
}

export function AssignmentsEditor({ projectId, assignments: initAssignments, createdByName, isLocked }: Props) {
  const [assignments, setAssignments] = useState(initAssignments)
  const [newEmail, setNewEmail] = useState('')
  const [newRate, setNewRate] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const totalRate = assignments.reduce((s, a) => s + (a.commission_rate ?? 0), 0)

  async function addAssignment() {
    if (!newEmail.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim(),
          assignment_role: 'sub',
          commission_rate: parseFloat(newRate) || 0,
        }),
      })
      const d = await res.json()
      if (!res.ok) { alert(d.error ?? '追加に失敗しました'); return }
      setAssignments((prev) => [...prev, d])
      setNewEmail('')
      setNewRate('')
      setShowAddForm(false)
    } finally {
      setAdding(false)
    }
  }

  async function updateRate(assignmentId: string, rate: number) {
    setSaving(assignmentId)
    try {
      const res = await fetch(`/api/projects/${projectId}/assignments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, commission_rate: rate }),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error ?? '更新に失敗しました'); return }
      setSaved(assignmentId)
      setTimeout(() => setSaved(null), 2000)
    } finally {
      setSaving(null)
    }
  }

  async function removeAssignment(assignmentId: string) {
    setRemoving(assignmentId)
    try {
      const res = await fetch(`/api/projects/${projectId}/assignments?id=${assignmentId}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); alert(d.error ?? '削除に失敗しました'); return }
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-500">担当者・按分</h2>
        </div>
        {!isLocked && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-3.5 h-3.5" />担当者を追加
          </button>
        )}
      </div>

      {/* メイン担当者 */}
      <div className="flex items-center justify-between py-2 border-b border-gray-100">
        <div>
          <span className="text-sm font-medium text-gray-900">{createdByName}</span>
          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">メイン</span>
        </div>
        <span className="text-sm text-gray-500">
          {assignments.length === 0 ? '100%' : `${100 - totalRate}%`}
        </span>
      </div>

      {/* サブ担当者 */}
      {assignments.map((a) => (
        <AssignmentRow
          key={a.id}
          assignment={a}
          isLocked={isLocked}
          saving={saving}
          saved={saved}
          removing={removing}
          onUpdate={updateRate}
          onRemove={removeAssignment}
        />
      ))}

      {/* 合計チェック */}
      {assignments.length > 0 && (
        <div className="flex justify-between pt-2 text-xs">
          <span className="text-gray-400">サブ担当者合計</span>
          <span className={totalRate > 100 ? 'text-red-500 font-medium' : 'text-gray-500'}>{totalRate}%</span>
        </div>
      )}

      {/* 追加フォーム */}
      {showAddForm && !isLocked && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">担当者のメールアドレス</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">按分率（%）</label>
            <input
              type="number"
              min={0}
              max={100}
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder="0"
              className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addAssignment}
              disabled={adding || !newEmail.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              追加
            </button>
            <button onClick={() => setShowAddForm(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2">
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
