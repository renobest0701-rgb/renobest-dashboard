'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateCustomer(
  id: string,
  data: {
    rank?: string
    next_action_date?: string | null
    notes?: string
    first_contact_status?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase
    .from('customers')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath(`/customers/${id}`)
  revalidatePath('/customers')
}
