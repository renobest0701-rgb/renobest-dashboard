'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, Building2, Globe,
  Users, Settings, CheckSquare, History,
  TrendingUp, Bell, DollarSign, Upload, KeyRound, HelpCircle, PhoneIncoming,
  UserCheck, ListTodo, RefreshCw, Home, FileText
} from 'lucide-react'
import type { AuthUser } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles?: string[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: 'マイページ',
    items: [
      { href: '/',              label: '個人成績',  icon: <LayoutDashboard className="w-4 h-4" /> },
      { href: '/projects',      label: '案件一覧',  icon: <FolderOpen className="w-4 h-4" /> },
      { href: '/notifications', label: '通知',      icon: <Bell className="w-4 h-4" /> },
      { href: '/inquiry',       label: '反響・接客入力', icon: <PhoneIncoming className="w-4 h-4" /> },
    ],
  },
  {
    label: 'CRM',
    items: [
      { href: '/customers',        label: '顧客管理',   icon: <UserCheck className="w-4 h-4" /> },
      { href: '/tasks',            label: 'ToDo管理',   icon: <ListTodo className="w-4 h-4" /> },
      { href: '/properties',       label: '物件管理',   icon: <Home className="w-4 h-4" /> },
      { href: '/admin/google-sync', label: 'Google連携', icon: <RefreshCw className="w-4 h-4" />, roles: ['manager','accounting','executive'] },
    ],
  },
  {
    label: 'ダッシュボード',
    items: [
      { href: '/department', label: '部門ダッシュボード', icon: <Building2 className="w-4 h-4" />, roles: ['manager','accounting','executive','non_sales'] },
      { href: '/company',    label: '全社ダッシュボード', icon: <Globe className="w-4 h-4" />,    roles: ['manager','accounting','executive','non_sales'] },
    ],
  },
  {
    label: '承認・申請',
    items: [
      { href: '/admin/approvals', label: '承認申請管理', icon: <CheckSquare className="w-4 h-4" />, roles: ['manager','accounting','executive'] },
    ],
  },
  {
    label: '管理設定',
    items: [
      { href: '/admin/targets',  label: '目標設定',       icon: <TrendingUp className="w-4 h-4" />,  roles: ['manager','accounting','executive'] },
      { href: '/admin/expenses', label: '販促費・固定経費', icon: <DollarSign className="w-4 h-4" />, roles: ['accounting','executive'] },
      { href: '/admin/users',    label: 'ユーザー管理',    icon: <Users className="w-4 h-4" />,       roles: ['accounting','executive'] },
      { href: '/admin/closing',  label: '月次締め',        icon: <History className="w-4 h-4" />,     roles: ['accounting','executive'] },
      { href: '/admin/change-logs', label: '変更履歴',    icon: <History className="w-4 h-4" />,     roles: ['accounting','executive'] },
    ],
  },
  {
    label: 'システム',
    items: [
      { href: '/admin/proposal',      label: '提案書生成',       icon: <FileText className="w-4 h-4" />,   roles: ['manager','accounting','executive'] },
      { href: '/admin/google-sync',  label: 'Google連携設定',   icon: <RefreshCw className="w-4 h-4" />, roles: ['accounting','executive'] },
      { href: '/admin/import',       label: 'CSVインポート',   icon: <Upload className="w-4 h-4" />,    roles: ['accounting','executive'] },
      { href: '/admin/line',         label: 'LINE通知設定',     icon: <Bell className="w-4 h-4" />,      roles: ['accounting','executive'] },
      { href: '/admin/credentials',  label: 'サービス管理',     icon: <KeyRound className="w-4 h-4" />,  roles: ['executive'] },
      { href: '/admin/deploy',       label: 'デプロイ確認',     icon: <CheckSquare className="w-4 h-4" />, roles: ['executive'] },
      { href: '/admin/settings',     label: '設定',             icon: <Settings className="w-4 h-4" />,  roles: ['accounting','executive'] },
    ],
  },
  {
    label: 'ヘルプ',
    items: [
      { href: '/help', label: 'ヘルプ', icon: <HelpCircle className="w-4 h-4" /> },
    ],
  },
]

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname()

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-16 flex items-center px-5 border-b border-gray-200">
        <span className="font-bold text-lg text-gray-900">RENOBEST</span>
      </div>

      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-4">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!item.roles) return true
            return item.roles.some((r) => user.roles.includes(r as any))
          })
          if (visibleItems.length === 0) return null

          return (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <div className="px-3 py-2 text-xs text-gray-500 truncate">
          {user.fullName}
        </div>
      </div>
    </aside>
  )
}
