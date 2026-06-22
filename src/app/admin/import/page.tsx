import { requireAuth, isAdminOrExecutive } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CsvImportForm } from './CsvImportForm'

export default async function ImportPage() {
  const user = await requireAuth()
  if (!isAdminOrExecutive(user)) redirect('/personal')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">データ移行（CSVインポート）</h1>
        <p className="text-sm text-gray-500 mt-1">
          スプレッドシートから案件・ユーザーを一括取り込みます
        </p>
      </div>

      <CsvImportForm />
    </div>
  )
}
