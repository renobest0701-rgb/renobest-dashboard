'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, AlertCircle, Clock, Calendar, User, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { completeTask } from './actions'

type Task = {
  id: string
  task_title: string
  task_type: string
  priority: string
  due_date: string | null
  status: string
  auto_generated: boolean
  auto_rule: string | null
  customer_id: string | null
  deal_id: string | null
  assigned_user_id: string | null
  customers: { id: string; name: string; rank: string } | null
  users: { full_name: string } | null
}

interface Props {
  todayTasks: Task[]
  overdueTasks: Task[]
  upcomingTasks: Task[]
  currentUserId: string
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
}

const TYPE_LABELS: Record<string, string> = {
  first_contact: '初回連絡',
  phone: '電話',
  line_msg: 'LINE',
  email: 'メール',
  meeting: '面談',
  document_send: '書類送付',
  contract_followup: '契約フォロー',
  payment_followup: '入金確認',
  follow_up: 'フォロー',
  set_next_date: '次回設定',
  other: 'その他',
}

const RANK_COLORS: Record<string, string> = {
  a: 'bg-red-100 text-red-700',
  b: 'bg-orange-100 text-orange-700',
  c: 'bg-blue-100 text-blue-700',
  d: 'bg-gray-100 text-gray-500',
}

function TaskCard({ task, onComplete }: { task: Task; onComplete: (id: string, note: string) => void }) {
  const [showComplete, setShowComplete] = useState(false)
  const [note, setNote] = useState<string>('')

  return (
    <div className={cn(
      'bg-white rounded-lg border p-3 hover:shadow-sm transition-shadow',
      task.priority === 'high' && 'border-l-2 border-l-red-400'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <Badge variant="outline" className={cn('text-xs px-1.5', PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium)}>
              {task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}
            </Badge>
            <span className="text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
              {TYPE_LABELS[task.task_type] ?? task.task_type}
            </span>
            {task.auto_generated && (
              <span className="text-xs text-purple-600 bg-purple-50 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                <Zap className="w-3 h-3" /> 自動
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">{task.task_title}</p>
          {task.customers && (
            <div className="flex items-center gap-1 mt-1">
              <span className={cn('text-xs rounded px-1', RANK_COLORS[task.customers.rank] ?? 'bg-gray-100 text-gray-500')}>
                {task.customers.rank?.toUpperCase()}
              </span>
              <Link href={`/customers/${task.customers.id}`} className="text-xs text-blue-600 hover:underline truncate">
                {task.customers.name}
              </Link>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowComplete(!showComplete)}
          className="flex-shrink-0 p-1 rounded hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
          title="完了にする"
        >
          <CheckCircle2 className="w-5 h-5" />
        </button>
      </div>

      {showComplete && (
        <div className="mt-3 space-y-2 border-t pt-2">
          <Textarea
            placeholder="完了メモ（任意）"
            value={note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
            className="text-xs min-h-[60px]"
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => onComplete(task.id, note)}>
              完了にする
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowComplete(false)}>
              キャンセル
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({
  title, tasks, icon, color, onComplete,
}: {
  title: string
  tasks: Task[]
  icon: React.ReactNode
  color: string
  onComplete: (id: string, note: string) => void
}) {
  return (
    <div>
      <div className={cn('flex items-center gap-2 mb-3 pb-2 border-b', color)}>
        {icon}
        <h2 className="font-semibold text-gray-800">{title}</h2>
        <span className="ml-auto text-sm text-gray-400">{tasks.length} 件</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">なし</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} onComplete={onComplete} />
          ))}
        </div>
      )}
    </div>
  )
}

export function TaskBoard({ todayTasks, overdueTasks, upcomingTasks, currentUserId }: Props) {
  const [today, setToday] = useState(todayTasks)
  const [overdue, setOverdue] = useState(overdueTasks)
  const [upcoming, setUpcoming] = useState(upcomingTasks)
  const [, startTransition] = useTransition()

  const removeTask = (id: string) => {
    setToday((prev) => prev.filter((t) => t.id !== id))
    setOverdue((prev) => prev.filter((t) => t.id !== id))
    setUpcoming((prev) => prev.filter((t) => t.id !== id))
  }

  const handleComplete = (id: string, note: string) => {
    startTransition(async () => {
      await completeTask(id, note)
      removeTask(id)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">ToDo管理</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>合計 {today.length + overdue.length + upcoming.length} 件</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section
          title="期限切れ"
          tasks={overdue}
          icon={<AlertCircle className="w-4 h-4 text-red-500" />}
          color="border-red-200 text-red-700"
          onComplete={handleComplete}
        />
        <Section
          title="本日のToDo"
          tasks={today}
          icon={<Calendar className="w-4 h-4 text-blue-500" />}
          color="border-blue-200 text-blue-700"
          onComplete={handleComplete}
        />
        <Section
          title="今後の予定"
          tasks={upcoming}
          icon={<User className="w-4 h-4 text-gray-500" />}
          color="border-gray-200 text-gray-700"
          onComplete={handleComplete}
        />
      </div>
    </div>
  )
}
