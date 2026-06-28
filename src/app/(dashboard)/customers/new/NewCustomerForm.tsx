'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft } from 'lucide-react'
import { createCustomer } from './actions'

type User = { id: string; full_name: string; email: string }

export function NewCustomerForm({ users }: { users: User[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    line_name: '',
    customer_type: 'individual',
    rank: 'c',
    source: '',
    assigned_user_id: '',
    first_contact_status: 'not_contacted',
    notes: '',
  })

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    startTransition(async () => {
      const id = await createCustomer(form)
      router.push(`/customers/${id}`)
    })
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> 顧客一覧
          </Button>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">顧客登録</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">顧客名 *</label>
          <Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('name', e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">電話番号</label>
            <Input value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('phone', e.target.value)} type="tel" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">メール</label>
            <Input value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('email', e.target.value)} type="email" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">LINE名</label>
          <Input value={form.line_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('line_name', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">ランク</label>
            <select
              value={form.rank}
              onChange={(e) => set('rank', e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm w-full"
            >
              <option value="a">Aランク</option>
              <option value="b">Bランク</option>
              <option value="c">Cランク</option>
              <option value="d">Dランク</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">顧客種別</label>
            <select
              value={form.customer_type}
              onChange={(e) => set('customer_type', e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm w-full"
            >
              <option value="individual">個人</option>
              <option value="corporate">法人</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">反響元</label>
            <Input value={form.source} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('source', e.target.value)} placeholder="SUUMO, 紹介, など" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">担当者</label>
            <select
              value={form.assigned_user_id}
              onChange={(e) => set('assigned_user_id', e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-2 text-sm w-full"
            >
              <option value="">未設定</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">接触状況</label>
          <select
            value={form.first_contact_status}
            onChange={(e) => set('first_contact_status', e.target.value)}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm w-full"
          >
            <option value="not_contacted">未接触</option>
            <option value="contacted">接触済</option>
            <option value="meeting_set">面談設定済</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">メモ</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm w-full min-h-[80px] resize-none"
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending || !form.name.trim()}>
          {pending ? '登録中...' : '顧客を登録'}
        </Button>
      </form>
    </div>
  )
}
