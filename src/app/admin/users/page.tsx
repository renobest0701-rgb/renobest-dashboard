import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserTable } from './UserTable'
import { Users, Upload } from 'lucide-react'
import Link from 'next/link'

export default async function UsersPage() {
  const authUser = await requireAuth()
  if (!isAdminOrExecutive(authUser)) redirect('/personal')

  const supabase = await createServiceClient()

  const [{ data: users }, { data: departments }] = await Promise.all([
    supabase
      .from('users')
      .select(`
        id, full_name, email, is_active, department_id,
        department:departments ( id, code, name ),
        user_roles ( roles ( name ) )
      `)
      .is('deleted_at', null)
      .order('full_name'),
    supabase
      .from('departments')
      .select('id, code, name')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const activeCount = users?.filter((u) => u.is_active).length ?? 0
  const inactiveCount = (users?.length ?? 0) - activeCount

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            ユーザー管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ロール・部門の変更はドロップダウンから即時反映されます
          </p>
        </div>
        <Link
          href="/admin/import"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Upload className="w-4 h-4" />
          CSVインポート
        </Link>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{users?.length ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">総ユーザー数</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{activeCount}</div>
          <div className="text-xs text-green-600 mt-1">有効</div>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-gray-400">{inactiveCount}</div>
          <div className="text-xs text-gray-400 mt-1">無効</div>
        </div>
      </div>

      {/* テーブル */}
      <UserTable
        users={(users ?? []) as any}
        departments={departments ?? []}
      />
    </div>
  )
}
