import { requireAuth, isAdminOrExecutive, isDeptManager } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CompanyDashboardClient } from './CompanyDashboardClient'

export default async function CompanyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user) && !isDeptManager(user)) redirect('/personal')

  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))

  return <CompanyDashboardClient year={year} month={month} />
}
