import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { TopBar } from '@/components/dashboard/TopBar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar user={user} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
