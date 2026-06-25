import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Role, User } from '@/types'

export interface AuthUser {
  id: string           // users.id
  authId: string       // auth.users.id
  email: string
  fullName: string
  departmentId: string | null
  roles: Role[]
  departmentRoles: { role: Role; departmentId: string | null }[]
}

export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select(`
      id, email, full_name, department_id, is_active, deleted_at,
      user_roles (
        role_id, department_id,
        roles ( name )
      )
    `)
    .eq('auth_user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (!profile || !profile.is_active) return null

  const userRoles = (profile.user_roles as any[]) || []
  const roles: Role[] = userRoles.map((ur) => ur.roles?.name).filter(Boolean)
  const departmentRoles = userRoles.map((ur) => ({
    role: ur.roles?.name as Role,
    departmentId: ur.department_id,
  }))

  return {
    id: profile.id,
    authId: user.id,
    email: profile.email,
    fullName: profile.full_name,
    departmentId: profile.department_id,
    roles,
    departmentRoles,
  }
})

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  return user
}

export function hasRole(user: AuthUser, role: Role): boolean {
  return user.roles.includes(role)
}

export function isAdminOrExecutive(user: AuthUser): boolean {
  return hasRole(user, 'accounting') || hasRole(user, 'executive')
}

export function isDeptManager(user: AuthUser, departmentId?: string): boolean {
  if (hasRole(user, 'manager')) {
    if (!departmentId) return true
    return user.departmentRoles.some(
      (dr) => dr.role === 'manager' && (dr.departmentId === departmentId || dr.departmentId === null)
    )
  }
  return false
}

export function isNonSales(user: AuthUser): boolean {
  return hasRole(user, 'non_sales') && !isAdminOrExecutive(user) && !isDeptManager(user)
}

export function canViewProject(user: AuthUser, project: { created_by: string; department_id: string }): boolean {
  if (isAdminOrExecutive(user)) return true
  if (isDeptManager(user, project.department_id)) return true
  if (project.created_by === user.id) return true
  return false
}
