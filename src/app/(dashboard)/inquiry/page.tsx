import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { InquiryForm } from './InquiryForm'

export default async function InquiryPage() {
  const user = await requireAuth()

  const supabase = await createClient()

  // 自分のユーザーID取得
  const { data: me } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('auth_user_id', user.id)
    .single()

  // 管理者は全ユーザー選択可能
  const isManager = user.roles.some((r) => ['manager','accounting','executive'].includes(r))
  let staffList: { id: string; full_name: string }[] = []
  if (isManager) {
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name')
    staffList = data ?? []
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">反響・接客件数入力</h1>
        <p className="text-sm text-gray-500 mt-1">週次の反響件数を経路別に入力してください。新規接客は案件登録数から自動集計します。</p>
      </div>
      <InquiryForm
        myUserId={me?.id ?? ''}
        myName={me?.full_name ?? user.fullName}
        isManager={isManager}
        staffList={staffList}
      />
    </div>
  )
}
