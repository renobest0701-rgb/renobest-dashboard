'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/lib/auth'

const ROLE_LABELS: Record<string, string> = {
  staff:      '一般担当者',
  manager:    '部門責任者',
  accounting: '経理・管理者',
  executive:  '経営者',
}

export function TopBar({ user }: { user: AuthUser }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const highestRole = user.roles.includes('executive') ? 'executive'
    : user.roles.includes('accounting') ? 'accounting'
    : user.roles.includes('manager') ? 'manager'
    : 'staff'

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
          <div className="text-xs text-gray-500">{ROLE_LABELS[highestRole]}</div>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="ログアウト"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
