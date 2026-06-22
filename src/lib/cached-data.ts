import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'

// 部門一覧（5分キャッシュ）
export const getDepartments = unstable_cache(
  async () => {
    const supabase = await createServiceClient()
    const { data } = await supabase
      .from('departments')
      .select('id, name, code')
      .eq('is_active', true)
      .order('sort_order')
    return data ?? []
  },
  ['departments'],
  { revalidate: 300 }
)

// 見込み確度設定（5分キャッシュ）
export const getProspectWeights = unstable_cache(
  async () => {
    const supabase = await createServiceClient()
    const { data } = await supabase
      .from('prospect_weights')
      .select('*')
    return data ?? []
  },
  ['prospect_weights'],
  { revalidate: 300 }
)
