import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PlatformAdminReadModel, ReadOnlySupabaseAdapter } from '../supabase/readContracts'
import { mockReadAdapter } from './mockReadAdapter'
import { mockReadModel } from './mockReadModel'
import { createSupabaseReadOnlyAdapter } from './supabaseReadAdapter'

type DataStatus = 'mock' | 'loading' | 'ready' | 'fallback'

interface PlatformDataContextValue {
  data: PlatformAdminReadModel
  adapter: ReadOnlySupabaseAdapter
  status: DataStatus
  sourceLabel: string
  error: string | null
}

interface PlatformEnv {
  VITE_PLATFORM_DATA_SOURCE?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

const PlatformDataContext = createContext<PlatformDataContextValue | null>(null)

export function PlatformDataProvider({ children }: { children: ReactNode }) {
  const config = getPlatformDataConfig()
  const [state, setState] = useState<Omit<PlatformDataContextValue, 'adapter'>>({
    data: mockReadModel,
    status: config.kind === 'supabase' ? 'loading' : 'mock',
    sourceLabel: config.kind === 'supabase' ? 'Read-only views' : 'Mock data',
    error: null,
  })

  const adapter = useMemo(() => {
    if (config.kind === 'supabase') {
      return createSupabaseReadOnlyAdapter({ url: config.url, anonKey: config.anonKey })
    }
    return mockReadAdapter
  }, [config])

  useEffect(() => {
    let alive = true
    if (config.kind !== 'supabase') return

    setState(current => ({ ...current, status: 'loading', sourceLabel: 'Read-only views', error: null }))
    fetchPlatformReadModel(adapter)
      .then(data => {
        if (!alive) return
        setState({ data, status: 'ready', sourceLabel: 'Read-only views', error: null })
      })
      .catch(error => {
        if (!alive) return
        const message = error instanceof Error ? error.message : 'Unable to load read-only platform data.'
        setState({ data: mockReadModel, status: 'fallback', sourceLabel: 'Mock fallback', error: message })
      })

    return () => {
      alive = false
    }
  }, [adapter, config.kind])

  const value = useMemo<PlatformDataContextValue>(() => ({
    ...state,
    adapter,
  }), [adapter, state])

  return <PlatformDataContext.Provider value={value}>{children}</PlatformDataContext.Provider>
}

export function usePlatformData() {
  const value = useContext(PlatformDataContext)
  if (!value) throw new Error('usePlatformData must be used inside PlatformDataProvider.')
  return value
}

async function fetchPlatformReadModel(adapter: ReadOnlySupabaseAdapter): Promise<PlatformAdminReadModel> {
  const [
    organizations,
    properties,
    venues,
    moduleActivations,
    moduleAdoption,
    moduleUsageGaps,
    registrations,
    revenueMetrics,
    billingRisks,
    supportIssues,
    remediationPackets,
    platformHealthSignals,
    impersonationTargets,
    impersonationSessions,
    auditEvents,
    agentDefinitions,
    agentEvents,
    internalAdminUsers,
    featureFlags,
    supportNotes,
    activityEvents,
    usageAnalytics,
  ] = await Promise.all([
    adapter.listOrganizations(),
    adapter.listProperties(),
    adapter.listVenues(),
    adapter.listModuleActivations(),
    adapter.listModuleAdoption(),
    adapter.listModuleUsageGaps(),
    adapter.listRegistrations(),
    adapter.listRevenueMetrics(),
    adapter.listBillingRisks(),
    adapter.listSupportIssues(),
    adapter.listRemediationPackets(),
    adapter.listPlatformHealthSignals(),
    adapter.listImpersonationTargets(),
    adapter.listImpersonationSessions(),
    adapter.listAuditEvents(),
    adapter.listAgentDefinitions(),
    adapter.listAgentEvents(),
    adapter.listInternalAdminUsers(),
    adapter.listFeatureFlags(),
    adapter.listSupportNotes(),
    adapter.listActivityEvents(),
    adapter.listUsageAnalytics(),
  ])

  return {
    organizations,
    properties,
    venues,
    moduleActivations,
    moduleAdoption,
    moduleUsageGaps,
    registrations,
    revenueMetrics,
    billingRisks,
    supportIssues,
    remediationPackets,
    platformHealthSignals,
    impersonationTargets,
    impersonationSessions,
    auditEvents,
    agentDefinitions,
    agentEvents,
    internalAdminUsers,
    featureFlags,
    supportNotes,
    activityEvents,
    usageAnalytics,
  }
}

function getPlatformDataConfig() {
  const env = import.meta.env as PlatformEnv
  const wantsSupabase = env.VITE_PLATFORM_DATA_SOURCE === 'supabase'
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()

  if (wantsSupabase && url && anonKey) {
    return { kind: 'supabase' as const, url, anonKey }
  }

  return { kind: 'mock' as const }
}
