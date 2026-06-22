import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth'

async function checkExecutive() {
  const user = await requireAuth()
  if (!user.roles.some((r) => ['accounting', 'executive'].includes(r))) {
    throw new Error('forbidden')
  }
}

export async function PATCH(req: Request) {
  try {
    await checkExecutive()
  } catch {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const { weights } = await req.json() as { weights: { rank: string; weight: number }[] }
  if (!Array.isArray(weights)) {
    return NextResponse.json({ error: '不正なデータ形式です' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  for (const w of weights) {
    const { error } = await supabase
      .from('prospect_weights')
      .update({ weight: w.weight })
      .eq('rank', w.rank)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
