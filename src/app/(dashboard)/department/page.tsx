import { requireAuth, isDeptManager, isAdminOrExecutive } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DepartmentDashboardClient } from './DepartmentDashboardClient'

export default async function DepartmentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; year?: string; month?: string }>
}) {
  const user = await requireAuth()
  if (!isDeptManager(user) && !isAdminOrExecutive(user)) redirect('/personal')

  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  const dept = params.dept ?? ''

  return <DepartmentDashboardClient year={year} month={month} dept={dept} />
}
