import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  readOnlyViewNames,
  type PlatformAdminReadModel,
  type ReadOnlySupabaseAdapter,
} from '../supabase/readContracts'
import { mockReadAdapter } from './mockReadAdapter'
import { mockReadModel } from './mockReadModel'
import { createSupabaseReadOnlyAdapter } from './supabaseReadAdapter'

export type DataStatus = 'mock' | 'loading' | 'ready' | 'partial' | 'fallback'
export type PlatformDataSourceKind = 'mock' | 'supabase'
export type ReadViewKey = keyof typeof readOnlyViewNames
export type PlatformReadViewStatus = 'mock' | 'loading' | 'ready' | 'fallback'

export interface PlatformReadViewDiagnostic {
  key: ReadViewKey
  viewName: string
  status: PlatformReadViewStatus
  records: number
  error?: string
  loadedAt?: string
}

interface PlatformDataContextValue {
  data: PlatformAdminReadModel
  adapter: ReadOnlySupabaseAdapter
  dataSourceKind: PlatformDataSourceKind
  status: DataStatus
  sourceLabel: string
  error: string | null
  readViewDiagnostics: PlatformReadViewDiagnostic[]
}

interface PlatformEnv {
  VITE_PLATFORM_DATA_SOURCE?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

const PlatformDataContext = createContext<PlatformDataContextValue | null>(null)

export function PlatformDataProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => getPlatformDataConfig(), [])
  const [state, setState] = useState<Omit<PlatformDataContextValue, 'adapter'>>({
    data: mockReadModel,
    dataSourceKind: config.kind,
    status: config.kind === 'supabase' ? 'loading' : 'mock',
    sourceLabel: config.kind === 'supabase' ? 'Read-only views' : 'Mock data',
    error: null,
    readViewDiagnostics: config.kind === 'supabase' ? createLoadingDiagnostics() : createMockDiagnostics(),
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

    setState(current => ({ ...current, dataSourceKind: 'supabase', status: 'loading', sourceLabel: 'Read-only views', error: null, readViewDiagnostics: createLoadingDiagnostics() }))
    fetchPlatformReadModel(adapter)
      .then(result => {
        if (!alive) return
        const fallbackCount = result.diagnostics.filter(diagnostic => diagnostic.status === 'fallback').length
        const readyCount = result.diagnostics.filter(diagnostic => diagnostic.status === 'ready').length
        const nextStatus: DataStatus = fallbackCount === 0
          ? 'ready'
          : readyCount === 0
            ? 'fallback'
            : 'partial'
        const sourceLabel = nextStatus === 'ready'
          ? 'Read-only views'
          : nextStatus === 'partial'
            ? 'Read-only partial'
            : 'Mock fallback'
        const error = fallbackCount ? `${fallbackCount} read view${fallbackCount === 1 ? '' : 's'} using mock fallback.` : null
        setState({ data: result.data, dataSourceKind: 'supabase', status: nextStatus, sourceLabel, error, readViewDiagnostics: result.diagnostics })
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

interface LoadedReadModel {
  data: PlatformAdminReadModel
  diagnostics: PlatformReadViewDiagnostic[]
}

interface LoadedView<T> {
  rows: T[]
  diagnostic: PlatformReadViewDiagnostic
}

async function fetchPlatformReadModel(adapter: ReadOnlySupabaseAdapter): Promise<LoadedReadModel> {
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
    adminActionRequests,
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
    loadView('organizations', () => adapter.listOrganizations()),
    loadView('properties', () => adapter.listProperties()),
    loadView('venues', () => adapter.listVenues()),
    loadView('moduleActivations', () => adapter.listModuleActivations()),
    loadView('moduleAdoption', () => adapter.listModuleAdoption()),
    loadView('moduleUsageGaps', () => adapter.listModuleUsageGaps()),
    loadView('registrations', () => adapter.listRegistrations()),
    loadView('revenueMetrics', () => adapter.listRevenueMetrics()),
    loadView('billingRisks', () => adapter.listBillingRisks()),
    loadView('supportIssues', () => adapter.listSupportIssues()),
    loadView('remediationPackets', () => adapter.listRemediationPackets()),
    loadView('adminActionRequests', () => adapter.listAdminActionRequests()),
    loadView('platformHealthSignals', () => adapter.listPlatformHealthSignals()),
    loadView('impersonationTargets', () => adapter.listImpersonationTargets()),
    loadView('impersonationSessions', () => adapter.listImpersonationSessions()),
    loadView('auditEvents', () => adapter.listAuditEvents()),
    loadView('agentDefinitions', () => adapter.listAgentDefinitions()),
    loadView('agentEvents', () => adapter.listAgentEvents()),
    loadView('internalAdminUsers', () => adapter.listInternalAdminUsers()),
    loadView('featureFlags', () => adapter.listFeatureFlags()),
    loadView('supportNotes', () => adapter.listSupportNotes()),
    loadView('activityEvents', () => adapter.listActivityEvents()),
    loadView('usageAnalytics', () => adapter.listUsageAnalytics()),
  ])

  const loadedViews = [
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
    adminActionRequests,
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
  ]

  return {
    data: {
      organizations: organizations.rows,
      properties: properties.rows,
      venues: venues.rows,
      moduleActivations: moduleActivations.rows,
      moduleAdoption: moduleAdoption.rows,
      moduleUsageGaps: moduleUsageGaps.rows,
      registrations: registrations.rows,
      revenueMetrics: revenueMetrics.rows,
      billingRisks: billingRisks.rows,
      supportIssues: supportIssues.rows,
      remediationPackets: remediationPackets.rows,
      adminActionRequests: adminActionRequests.rows,
      platformHealthSignals: platformHealthSignals.rows,
      impersonationTargets: impersonationTargets.rows,
      impersonationSessions: impersonationSessions.rows,
      auditEvents: auditEvents.rows,
      agentDefinitions: agentDefinitions.rows,
      agentEvents: agentEvents.rows,
      internalAdminUsers: internalAdminUsers.rows,
      featureFlags: featureFlags.rows,
      supportNotes: supportNotes.rows,
      activityEvents: activityEvents.rows,
      usageAnalytics: usageAnalytics.rows,
    },
    diagnostics: loadedViews.map(view => view.diagnostic),
  }
}

async function loadView<T>(key: ReadViewKey, loader: () => Promise<T[]>): Promise<LoadedView<T>> {
  try {
    const rows = await loader()
    return {
      rows,
      diagnostic: {
        key,
        viewName: readOnlyViewNames[key],
        status: 'ready',
        records: rows.length,
        loadedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    const fallbackRows = getMockRows<T>(key)
    return {
      rows: fallbackRows,
      diagnostic: {
        key,
        viewName: readOnlyViewNames[key],
        status: 'fallback',
        records: fallbackRows.length,
        error: error instanceof Error ? error.message : 'Unable to load read-only view.',
        loadedAt: new Date().toISOString(),
      },
    }
  }
}

function createLoadingDiagnostics(): PlatformReadViewDiagnostic[] {
  return createDiagnostics('loading')
}

function createMockDiagnostics(): PlatformReadViewDiagnostic[] {
  return createDiagnostics('mock')
}

function createDiagnostics(status: PlatformReadViewStatus): PlatformReadViewDiagnostic[] {
  return (Object.keys(readOnlyViewNames) as ReadViewKey[]).map(key => ({
    key,
    viewName: readOnlyViewNames[key],
    status,
    records: status === 'mock' ? getMockRows(key).length : 0,
    loadedAt: status === 'loading' ? undefined : new Date().toISOString(),
  }))
}

function getMockRows<T>(key: ReadViewKey): T[] {
  return mockReadModel[key as keyof PlatformAdminReadModel] as T[]
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
