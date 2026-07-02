import { useSyncExternalStore } from 'react'
import type { InternalAdminUser } from '../mock-data/mockPlatform'
import type { AdminRole } from '../permissions/permissions'

export type InternalAccessChangeType = 'invite' | 'role_change' | 'status_change' | 'access_review'
export type InternalAccessChangeStatus = 'Queued' | 'Recorded' | 'Blocked'

export interface InternalAccessChange {
  id: string
  changeType: InternalAccessChangeType
  userId: string
  userName: string
  userEmail: string
  previousRole?: AdminRole
  nextRole?: AdminRole
  previousStatus?: InternalAdminUser['status']
  nextStatus?: InternalAdminUser['status']
  requestedBy: string
  requestedByEmail?: string
  reason: string
  status: InternalAccessChangeStatus
  auditEventId?: string
  actionRequestId?: string
  createdAt: string
}

export interface InviteInternalAdminInput {
  name: string
  email: string
  role: AdminRole
}

const userStorageKey = 'hc_platform_internal_admin_users'
const changeStorageKey = 'hc_platform_internal_access_changes'
const listeners = new Set<() => void>()
let cachedRawUsers = ''
let cachedUsers: InternalAdminUser[] = []
let cachedRawChanges = ''
let cachedChanges: InternalAccessChange[] = []

const roleOrder: AdminRole[] = [
  'owner',
  'admin',
  'support_lead',
  'support_agent',
  'client_success',
  'finance',
  'marketing',
  'engineering',
  'read_only',
]

const statusOrder: Record<InternalAdminUser['status'], number> = {
  Active: 0,
  Invited: 1,
  Disabled: 2,
}

export function getManagedInternalAdminUsers(baseUsers: InternalAdminUser[]) {
  const usersById = new Map(baseUsers.map(user => [user.id, user]))
  getLocalInternalAdminUsers().forEach(user => usersById.set(user.id, user))

  return Array.from(usersById.values()).sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff) return statusDiff
    const roleDiff = roleOrder.indexOf(a.role as AdminRole) - roleOrder.indexOf(b.role as AdminRole)
    if (roleDiff) return roleDiff
    return a.name.localeCompare(b.name)
  })
}

export function useManagedInternalAdminUsers(baseUsers: InternalAdminUser[]) {
  const localUsers = useSyncExternalStore(subscribeToInternalAccessChanges, getLocalInternalAdminUsers, () => [])
  return getManagedInternalAdminUsers([...baseUsers, ...localUsers])
}

export function createInternalAdminInvite(input: InviteInternalAdminInput): InternalAdminUser {
  const normalizedEmail = normalizeEmail(input.email)
  return {
    id: `admin-${slugify(normalizedEmail)}-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name.trim(),
    email: normalizedEmail,
    role: input.role,
    status: 'Invited',
    lastLoginAt: 'Pending',
    createdAt: new Date().toISOString(),
  }
}

export function saveInternalAdminUser(user: InternalAdminUser) {
  const existing = getLocalInternalAdminUsers()
  const users = [
    user,
    ...existing.filter(item => item.id !== user.id),
  ]
  cachedUsers = users
  cachedRawUsers = JSON.stringify(users)
  localStorage.setItem(userStorageKey, cachedRawUsers)
  emitInternalAccessChange()
  return user
}

export function saveInternalAccessChange(change: Omit<InternalAccessChange, 'id' | 'createdAt'>) {
  const nextChange: InternalAccessChange = {
    ...change,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  const changes = [nextChange, ...getLocalInternalAccessChanges()].slice(0, 80)
  cachedChanges = changes
  cachedRawChanges = JSON.stringify(changes)
  localStorage.setItem(changeStorageKey, cachedRawChanges)
  emitInternalAccessChange()
  return nextChange
}

export function getLocalInternalAdminUsers(): InternalAdminUser[] {
  if (typeof localStorage === 'undefined') return []
  const rawUsers = localStorage.getItem(userStorageKey) ?? '[]'
  if (rawUsers === cachedRawUsers) return cachedUsers

  try {
    cachedRawUsers = rawUsers
    cachedUsers = JSON.parse(rawUsers) as InternalAdminUser[]
    return cachedUsers
  } catch {
    cachedRawUsers = rawUsers
    cachedUsers = []
    return []
  }
}

export function getLocalInternalAccessChanges(): InternalAccessChange[] {
  if (typeof localStorage === 'undefined') return []
  const rawChanges = localStorage.getItem(changeStorageKey) ?? '[]'
  if (rawChanges === cachedRawChanges) return cachedChanges

  try {
    cachedRawChanges = rawChanges
    cachedChanges = JSON.parse(rawChanges) as InternalAccessChange[]
    return cachedChanges
  } catch {
    cachedRawChanges = rawChanges
    cachedChanges = []
    return []
  }
}

export function useInternalAccessChanges() {
  return useSyncExternalStore(subscribeToInternalAccessChanges, getLocalInternalAccessChanges, () => [])
}

export function isInternalAdminEmailAvailable(users: InternalAdminUser[], email: string) {
  const normalizedEmail = normalizeEmail(email)
  return !users.some(user => normalizeEmail(user.email) === normalizedEmail)
}

export function getRoleRisk(role: AdminRole): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (role === 'owner') return 'Critical'
  if (role === 'admin') return 'High'
  if (role === 'support_lead' || role === 'engineering' || role === 'finance') return 'Medium'
  return 'Low'
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function subscribeToInternalAccessChanges(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function emitInternalAccessChange() {
  listeners.forEach(listener => listener())
}

function slugify(value: string) {
  return value
    .replace(/@.*/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'user'
}
