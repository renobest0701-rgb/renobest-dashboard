import { requireAuth } from '@/lib/auth'
import { PersonalDashboardClient } from './PersonalDashboardClient'

export default async function PersonalDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  await requireAuth()
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))

  return <PersonalDashboardClient year={year} month={month} />
}
