import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CredentialsManager } from './CredentialsManager'

export default async function CredentialsPage() {
  const user = await requireAuth()
  if (!user.roles.includes('executive')) redirect('/')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">サービス管理</h1>
        <p className="text-sm text-gray-500 mt-1">運営・管理用の各サービスのURL・ID・パスワードを管理します</p>
      </div>
      <CredentialsManager />
    </div>
  )
}
