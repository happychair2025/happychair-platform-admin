import type { InternalAdminUser } from '../mock-data/mockPlatform'
import { roleLabels } from '../permissions/permissions'

export type InternalAuthSource = 'preview' | 'supabase'
export type InternalAuthGuardrailStatus = 'Ready' | 'Review' | 'Blocked'

export type InternalAuthEnv = Record<string, unknown>

export interface InternalAuthConfig {
  source: InternalAuthSource
  supabaseUrl?: string
  supabaseAnonKey?: string
  serverEndpoint?: string
}

export interface InternalVerifiedSession {
  providerUserId: string
  email: string
  adminUserId: string
  name: string
  role: InternalAdminUser['role']
  status: InternalAdminUser['status']
  source: InternalAuthSource
  verifiedBy: 'preview_roster' | 'supabase_auth_user'
}

export interface InternalAuthResult {
  ok: boolean
  status: 'verified' | 'blocked' | 'not_configured' | 'not_found' | 'error'
  message: string
  session?: InternalVerifiedSession
}

export interface InternalAuthGuardrail {
  id: string
  label: string
  status: InternalAuthGuardrailStatus
  detail: string
}

export interface InternalAuthAdapterStatus {
  source: InternalAuthSource
  providerLabel: string
  sessionVerification: string
  userMutationPath: string
  browserMutationsAllowed: false
  serverEndpointLabel: string
  guardrails: InternalAuthGuardrail[]
}

export const internalAuthAdapterRule =
  'Internal auth may verify a browser session, but admin-user creation, invitation, suspension, role assignment, and provider mutations must run through trusted server handlers with secret-key access, audit records, and rollback metadata.'

export function getInternalAuthConfig(env: InternalAuthEnv): InternalAuthConfig {
  const authSource = typeof env.VITE_PLATFORM_AUTH_SOURCE === 'string' ? env.VITE_PLATFORM_AUTH_SOURCE : ''
  const source = authSource === 'supabase' ? 'supabase' : 'preview'
  return {
    source,
    supabaseUrl: getEnvString(env, 'VITE_SUPABASE_URL'),
    supabaseAnonKey: getEnvString(env, 'VITE_SUPABASE_ANON_KEY'),
    serverEndpoint: getEnvString(env, 'VITE_PLATFORM_AUTH_SERVER_ENDPOINT'),
  }
}

export function buildInternalAuthAdapterStatus(
  config: InternalAuthConfig,
  users: InternalAdminUser[],
): InternalAuthAdapterStatus {
  const activeUsers = users.filter(user => user.status === 'Active')
  const activeOwner = activeUsers.some(user => user.role === 'owner')
  const hasSupabasePublicConfig = Boolean(config.supabaseUrl && config.supabaseAnonKey)
  const hasServerEndpoint = Boolean(config.serverEndpoint)

  return {
    source: config.source,
    providerLabel: config.source === 'supabase' ? 'Supabase Auth' : 'Managed Preview Roster',
    sessionVerification: config.source === 'supabase'
      ? 'Verify access tokens against Supabase Auth before mapping to internal admin users.'
      : 'Use the managed local internal roster for role and permission preview.',
    userMutationPath: hasServerEndpoint
      ? config.serverEndpoint!
      : 'Server endpoint pending',
    browserMutationsAllowed: false,
    serverEndpointLabel: hasServerEndpoint ? 'Server endpoint configured' : 'Server endpoint pending',
    guardrails: [
      {
        id: 'source',
        label: 'Auth source',
        status: config.source === 'preview' ? 'Review' : 'Ready',
        detail: config.source === 'preview'
          ? 'Preview login remains active until real internal auth is configured.'
          : 'Supabase auth source is selected for future verified-session mapping.',
      },
      {
        id: 'public_config',
        label: 'Public auth config',
        status: config.source === 'preview' || hasSupabasePublicConfig ? 'Ready' : 'Blocked',
        detail: hasSupabasePublicConfig
          ? 'Supabase URL and public anon key are configured for session verification.'
          : 'Supabase URL and public anon key are not configured.',
      },
      {
        id: 'server_endpoint',
        label: 'Server mutation endpoint',
        status: hasServerEndpoint ? 'Ready' : 'Review',
        detail: hasServerEndpoint
          ? 'Internal admin-user mutations can be routed to a trusted server endpoint.'
          : 'Admin-user mutations remain queued until a trusted server endpoint is configured.',
      },
      {
        id: 'secret_boundary',
        label: 'Secret-key boundary',
        status: 'Ready',
        detail: 'Secret/admin keys are not accepted in browser config and must stay server-side.',
      },
      {
        id: 'owner_bootstrap',
        label: 'Owner bootstrap',
        status: activeOwner ? 'Ready' : 'Blocked',
        detail: activeOwner
          ? 'At least one active owner exists for internal auth bootstrap.'
          : 'No active owner exists for internal auth bootstrap.',
      },
      {
        id: 'disabled_users',
        label: 'Disabled-user blocking',
        status: 'Ready',
        detail: 'Disabled and invited users are blocked before a Platform Admin session is created.',
      },
    ],
  }
}

export function verifyPreviewInternalSession(
  userId: string,
  users: InternalAdminUser[],
): InternalAuthResult {
  const user = users.find(item => item.id === userId)
  if (!user) {
    return {
      ok: false,
      status: 'not_found',
      message: 'Internal admin user was not found in the managed preview roster.',
    }
  }
  if (user.status !== 'Active') {
    return {
      ok: false,
      status: 'blocked',
      message: `${user.name} is ${user.status.toLowerCase()} and cannot enter Platform Admin.`,
    }
  }
  return {
    ok: true,
    status: 'verified',
    message: `${user.name} verified by managed preview roster as ${roleLabels[user.role]}.`,
    session: {
      providerUserId: user.id,
      email: user.email,
      adminUserId: user.id,
      name: user.name,
      role: user.role,
      status: user.status,
      source: 'preview',
      verifiedBy: 'preview_roster',
    },
  }
}

export async function verifySupabaseInternalSession(input: {
  config: InternalAuthConfig
  accessToken: string
  users: InternalAdminUser[]
}): Promise<InternalAuthResult> {
  if (!input.config.supabaseUrl || !input.config.supabaseAnonKey) {
    return {
      ok: false,
      status: 'not_configured',
      message: 'Supabase auth verification is not configured.',
    }
  }

  try {
    const baseUrl = input.config.supabaseUrl.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: {
        apikey: input.config.supabaseAnonKey,
        Authorization: `Bearer ${input.accessToken}`,
      },
    })

    if (!response.ok) {
      return {
        ok: false,
        status: 'blocked',
        message: `Supabase auth token verification failed (${response.status}).`,
      }
    }

    const authUser = await response.json() as { id?: string; email?: string }
    const email = authUser.email?.trim().toLowerCase()
    const internalUser = email ? input.users.find(user => user.email.toLowerCase() === email) : undefined

    if (!authUser.id || !email || !internalUser) {
      return {
        ok: false,
        status: 'not_found',
        message: 'Supabase user is verified, but no matching internal admin record exists.',
      }
    }
    if (internalUser.status !== 'Active') {
      return {
        ok: false,
        status: 'blocked',
        message: `${internalUser.name} is ${internalUser.status.toLowerCase()} and cannot enter Platform Admin.`,
      }
    }

    return {
      ok: true,
      status: 'verified',
      message: `${internalUser.name} verified by Supabase Auth and internal admin roster.`,
      session: {
        providerUserId: authUser.id,
        email,
        adminUserId: internalUser.id,
        name: internalUser.name,
        role: internalUser.role,
        status: internalUser.status,
        source: 'supabase',
        verifiedBy: 'supabase_auth_user',
      },
    }
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unable to verify Supabase auth session.',
    }
  }
}

function getEnvString(env: InternalAuthEnv, key: string) {
  const value = env[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
