'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Phone, Mail, MessageSquare, Calendar, Clock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateCustomer } from './actions'

type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  line_name: string | null
  language: string
  customer_type: string
  rank: string
  source: string | null
  status: string
  first_contact_status: string
  last_contact_date: string | null
  next_action_date: string | null
  notes: string | null
  sync_source: string
  assigned_user_id: string | null
  created_at: string
  users: { id: string; full_name: string; email: string } | null
}

type Task = {
  id: string
  task_title: string
  task_type: string
  priority: string
  due_date: string | null
  status: string
  auto_generated: boolean
  created_at: string
}

type Log = {
  id: string
  action_type: string
  action_detail: string | null
  result: string | null
  actioned_at: string
  users: { full_name: string } | null
}

interface Props {
  customer: Customer
  tasks: Task[]
  logs: Log[]
}

const RANK_COLORS: Record<string, string> = {
  a: 'bg-red-100 text-red-700 border-red-200',
  b: 'bg-orange-100 text-orange-700 border-orange-200',
  c: 'bg-blue-100 text-blue-700 border-blue-200',
  d: 'bg-gray-100 text-gray-600 border-gray-200',
}

const TASK_TYPE_LABELS: Record<string, string> = {
  first_contact: '初回連絡', phone: '電話', line_msg: 'LINE',
  email: 'メール', meeting: '面談', document_send: '書類送付',
  contract_followup: '契約フォロー', payment_followup: '入金確認',
  follow_up: 'フォロー', set_next_date: '次回設定', other: 'その他',
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  call: '電話', line_msg: 'LINE', email: 'メール', meeting: '面談',
  document_send: '書類送付', contract: '契約', payment: '入金',
  note: 'メモ', status_change: 'ステータス変更', other: 'その他',
}

export function CustomerDetail({ customer, tasks, logs }: Props) {
  const [editing, setEditing] = useState(false)
  const [rank, setRank] = useState(customer.rank)
  const [nextAction, setNextAction] = useState(customer.next_action_date ?? '')
  const [notes, setNotes] = useState(customer.notes ?? '')
  const [firstContactStatus, setFirstContactStatus] = useState(customer.first_contact_status)
  const [, startTransition] = useTransition()
  const today = new Date().toISOString().split('T')[0]

  const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress')
  const completedTasks = tasks.filter((t) => t.status === 'completed')

  const handleSave = () => {
    startTransition(async () => {
      await updateCustomer(customer.id, { rank, next_action_date: nextAction || null, notes, first_contact_status: firstContactStatus })
      setEditing(false)
    })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> 顧客一覧
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold border',
              RANK_COLORS[customer.rank] ?? RANK_COLORS.c
            )}>
              {customer.rank.toUpperCase()}
            </span>
            <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
            {customer.sync_source === 'google_sheets' && (
              <span className="text-xs bg-green-100 text-green-700 rounded px-2 py-0.5">GS連携</span>
            )}
          </div>
        </div>
        <Button size="sm" onClick={() => editing ? handleSave() : setEditing(true)}>
          {editing ? '保存' : '編集'}
        </Button>
        {editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            キャンセル
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左: 基本情報 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 連絡先 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">連絡先</h2>
            <div className="space-y-2">
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">{customer.phone}</a>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">{customer.email}</a>
                </div>
              )}
              {customer.line_name && (
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{customer.line_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* 対応状況 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">対応状況</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">ランク</label>
                {editing ? (
                  <select
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
                  >
                    {['a','b','c','d'].map((r) => (
                      <option key={r} value={r}>{r.toUpperCase()}ランク</option>
                    ))}
                  </select>
                ) : (
                  <span className={cn(
                    'inline-flex items-center px-2 py-1 rounded text-sm font-medium border',
                    RANK_COLORS[rank] ?? RANK_COLORS.c
                  )}>
                    {rank.toUpperCase()}ランク
                  </span>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">接触状況</label>
                {editing ? (
                  <select
                    value={firstContactStatus}
                    onChange={(e) => setFirstContactStatus(e.target.value)}
                    className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
                  >
                    <option value="not_contacted">未接触</option>
                    <option value="contacted">接触済</option>
                    <option value="meeting_set">面談設定済</option>
                  </select>
                ) : (
                  <span className="text-sm text-gray-700">
                    {{ not_contacted: '未接触', contacted: '接触済', meeting_set: '面談設定済' }[firstContactStatus] ?? firstContactStatus}
                  </span>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">最終接触日</label>
                <span className="text-sm text-gray-700">{customer.last_contact_date ?? '-'}</span>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">次回予定日</label>
                {editing ? (
                  <input
                    type="date"
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
                  />
                ) : (
                  <span className={cn(
                    'text-sm',
                    customer.next_action_date && customer.next_action_date < today && 'text-red-600 font-medium'
                  )}>
                    {customer.next_action_date ?? '-'}
                    {customer.next_action_date && customer.next_action_date < today && ' (期限切れ)'}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-gray-500 block mb-1">メモ</label>
              {editing ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border border-gray-200 rounded px-2 py-1 text-sm w-full min-h-[80px] resize-none"
                />
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes || '-'}</p>
              )}
            </div>
          </div>

          {/* 行動履歴 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">行動履歴</h2>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-400">履歴なし</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-3 text-sm border-b border-gray-50 pb-2 last:border-0">
                    <Clock className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-xs px-1.5">
                          {ACTION_TYPE_LABELS[log.action_type] ?? log.action_type}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {log.users?.full_name} · {log.actioned_at.slice(0, 10)}
                        </span>
                      </div>
                      {log.action_detail && <p className="text-gray-600">{log.action_detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右: ToDo */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">未完了ToDo</h2>
              <span className="text-xs text-gray-400">{pendingTasks.length} 件</span>
            </div>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-gray-400">なし</p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((t) => (
                  <div key={t.id} className={cn(
                    'p-2 rounded-lg border text-sm',
                    t.priority === 'high' ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'
                  )}>
                    <div className="flex items-center gap-1 mb-0.5">
                      {t.auto_generated && <Zap className="w-3 h-3 text-purple-500" />}
                      <span className="text-xs text-gray-500">
                        {TASK_TYPE_LABELS[t.task_type] ?? t.task_type}
                      </span>
                    </div>
                    <p className="font-medium text-gray-800">{t.task_title}</p>
                    {t.due_date && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" />
                        <span className={t.due_date < today ? 'text-red-500' : ''}>
                          {t.due_date}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {completedTasks.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-500 mb-2">完了済 ({completedTasks.length}件)</h2>
              <div className="space-y-1">
                {completedTasks.slice(0, 5).map((t) => (
                  <p key={t.id} className="text-xs text-gray-400 line-through">{t.task_title}</p>
                ))}
              </div>
            </div>
          )}

          {/* 基本情報サマリー */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">基本情報</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-400">種別</dt>
                <dd>{customer.customer_type === 'individual' ? '個人' : '法人'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">言語</dt>
                <dd>{customer.language}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">反響元</dt>
                <dd>{customer.source ?? '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">担当者</dt>
                <dd>{customer.users?.full_name ?? '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">登録日</dt>
                <dd>{customer.created_at.slice(0, 10)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
