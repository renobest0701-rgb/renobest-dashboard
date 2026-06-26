import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProposalGenerator } from './ProposalGenerator'
import { FileText } from 'lucide-react'

export const metadata = { title: '提案書生成 | RENOBEST' }

export default async function ProposalPage() {
  const user = await requireAuth()
  if (!user.roles.some(r => ['manager', 'accounting', 'executive'].includes(r))) {
    redirect('/')
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">提案書生成</h1>
        </div>
        <p className="text-sm text-gray-500">
          販売図面PDFをアップロードし、テンプレートから管理用・顧客用HTMLを自動生成してGitHub Pagesに公開します
        </p>
      </div>
      <ProposalGenerator />
    </div>
  )
}
