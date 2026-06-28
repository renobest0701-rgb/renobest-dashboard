'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createCustomer(data: {
  name: string
  phone: string
  email: string
  line_name: string
  customer_type: string
  rank: string
  source: string
  assigned_user_id: string
  first_contact_status: string
  notes: string
}): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      line_name: data.line_name || null,
      customer_type: data.customer_type,
      rank: data.rank,
      source: data.source || null,
      assigned_user_id: data.assigned_user_id || null,
      first_contact_status: data.first_contact_status,
      notes: data.notes || null,
      created_by: user.id,
      sync_source: 'manual',
    })
    .select('id')
    .single()

  if (error) throw error

  // ToDo自動作成（新規かつ未接触）
  if (data.first_contact_status === 'not_contacted') {
    const today = new Date().toISOString().split('T')[0]
    const todosToCreate = [{
      customer_id: customer.id,
      assigned_user_id: data.assigned_user_id || null,
      task_title: '初回連絡',
      task_type: 'first_contact',
      priority: 'high',
      due_date: today,
      auto_generated: true,
      auto_rule: 'new_customer_not_contacted',
      created_by: user.id,
    }]
    if (data.rank === 'a') {
      todosToCreate.push({
        customer_id: customer.id,
        assigned_user_id: data.assigned_user_id || null,
        task_title: '【Aランク】本日電話連絡',
        task_type: 'phone',
        priority: 'high',
        due_date: today,
        auto_generated: true,
        auto_rule: 'rank_a_same_day_call',
        created_by: user.id,
      })
    }
    await supabase.from('tasks').insert(todosToCreate)
  }

  revalidatePath('/customers')
  return customer.id
}
