import { BookmarkCheck, Columns3, Eye, Filter, FolderOpen, Pin, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import { runAdminAction } from '../../lib/admin-actions/actionGateway'
import { hasPermission, roleLabels } from '../../lib/permissions/permissions'
import {
  createLocalSavedView,
  getSavedViewCategoryTone,
  getSavedViewSensitivityTone,
  getSavedViewStatusTone,
  savedViewTemplates,
  savedViewsBoundaryRule,
  summarizeSavedViews,
  useLocalSavedViews,
  type SavedViewCategory,
  type SavedViewDefinition,
  type SavedViewTargetPage,
} from '../../lib/saved-views/savedViews'

interface SavedViewsPageProps {
  session: AdminSession
  onOpenTarget?: (page: SavedViewTargetPage) => void
}

const categoryFilters: Array<'All' | SavedViewCategory> = ['All', 'Command', 'Clients', 'Support', 'Finance', 'Security', 'Engineering']

export default function SavedViewsPage({ session, onOpenTarget }: SavedViewsPageProps) {
  const [localViews, setLocalViews] = useLocalSavedViews()
  const [selectedId, setSelectedId] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'All' | SavedViewCategory>('All')
  const [notice, setNotice] = useState('')
  const canManageSavedViews = hasPermission(session.role, 'saved_views.manage')

  const views = useMemo(() => [...localViews, ...savedViewTemplates], [localViews])
  const summary = useMemo(() => summarizeSavedViews(views), [views])
  const categoryCounts = useMemo(() => {
    const counts = new Map<SavedViewCategory, number>()
    views.forEach(view => counts.set(view.category, (counts.get(view.category) ?? 0) + 1))
    return counts
  }, [views])
  const filteredViews = useMemo(() => categoryFilter === 'All'
    ? views
    : views.filter(view => view.category === categoryFilter),
  [categoryFilter, views])
  const selectedView = filteredViews.find(view => view.id === selectedId)
    ?? views.find(view => view.id === selectedId)
    ?? filteredViews[0]
    ?? views[0]
  const canOpenSelected = selectedView ? hasPermission(session.role, selectedView.permission) : false

  const saveLocalCopy = (view: SavedViewDefinition) => {
    const result = runAdminAction(session, {
      permission: 'saved_views.manage',
      scope: view.name,
      actionKey: `saved_views.${view.id}.saved_local.mock`,
      actionLabel: `Saved local view: ${view.name}`,
      severity: view.sensitivity === 'Restricted' ? 'warning' : 'notice',
      metadata: buildSavedViewMetadata(view, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const localView = createLocalSavedView(view, session.name)
    setLocalViews(current => [localView, ...current])
    setSelectedId(localView.id)
    setNotice(`${localView.name} saved locally and recorded in Audit Logs.`)
  }

  const applyView = (view: SavedViewDefinition) => {
    const result = runAdminAction(session, {
      permission: view.permission,
      scope: view.targetLabel,
      actionKey: `saved_views.${view.id}.applied.mock`,
      actionLabel: `Applied saved view: ${view.name}`,
      severity: view.sensitivity === 'Restricted' ? 'warning' : 'notice',
      metadata: buildSavedViewMetadata(view, {
        targetPage: view.targetPage,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setNotice(`${view.name} applied as a read-only filter contract.`)
    onOpenTarget?.(view.targetPage)
  }

  const removeLocalView = (view: SavedViewDefinition) => {
    if (view.source !== 'Local Saved View') return
    const result = runAdminAction(session, {
      permission: 'saved_views.manage',
      scope: view.name,
      actionKey: `saved_views.${view.id}.removed_local.mock`,
      actionLabel: `Removed local saved view: ${view.name}`,
      severity: 'notice',
      metadata: buildSavedViewMetadata(view, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setLocalViews(current => current.filter(localView => localView.id !== view.id))
    setSelectedId('')
    setNotice(`${view.name} removed from local saved views and recorded in Audit Logs.`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Saved Operating Filters"
        title="Saved Views"
        description="Reusable internal filter presets for command reviews, support triage, revenue recovery, audit checks, and export governance."
        action={<StatusPill label={canManageSavedViews ? 'Local saves allowed' : 'Read only'} tone={canManageSavedViews ? 'ok' : 'warn'} />}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <div className="metrics-grid compact">
        <MetricCard label="Views" value={String(summary.total)} delta="Templates plus local copies" tone="neutral" icon={<BookmarkCheck size={16} />} />
        <MetricCard label="Active" value={String(summary.active)} delta="Ready for operators" tone="ok" icon={<Eye size={16} />} />
        <MetricCard label="Local" value={String(summary.local)} delta="Stored in this browser" tone="neutral" icon={<FolderOpen size={16} />} />
        <MetricCard label="Restricted" value={String(summary.restricted)} delta="Requires target permission" tone={summary.restricted ? 'warn' : 'ok'} icon={<ShieldCheck size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Team Views" value={String(summary.team)} delta="Shared operating patterns" tone="neutral" icon={<SlidersHorizontal size={16} />} />
        <MetricCard label="Needs Review" value={String(summary.needsReview)} delta="Governance check before use" tone={summary.needsReview ? 'warn' : 'ok'} icon={<Filter size={16} />} />
        <MetricCard label="Pinned" value={String(summary.pinned)} delta="Default command favorites" tone="ok" icon={<Pin size={16} />} />
        <MetricCard label="Production Writes" value="0" delta="Read-only filter contracts" tone="ok" icon={<Columns3 size={16} />} />
      </div>

      <section className="panel saved-view-boundary-panel">
        <div>
          <p className="eyebrow">Saved View Boundary</p>
          <h2>Saved views organize how operators look at data</h2>
          <span>{savedViewsBoundaryRule}</span>
        </div>
        <StatusPill label="No customer mutation" tone="ok" />
      </section>

      <div className="timeline-filter-bar" aria-label="Saved view categories">
        {categoryFilters.map(category => (
          <button
            key={category}
            className={categoryFilter === category ? 'selected' : ''}
            onClick={() => {
              setCategoryFilter(category)
              setSelectedId('')
            }}
          >
            {category}
            <span>{category === 'All' ? views.length : categoryCounts.get(category) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="saved-views-layout">
        <DataTable
          label="Saved View Library"
          rows={filteredViews}
          pageSize={8}
          emptyTitle="No saved views match this category."
          columns={[
            {
              key: 'name',
              header: 'View',
              sortable: true,
              searchValue: row => `${row.name} ${row.description} ${row.targetLabel}`,
              render: row => (
                <button className="table-link" onClick={() => setSelectedId(row.id)}>
                  {row.name}
                </button>
              ),
            },
            {
              key: 'target',
              header: 'Target',
              sortable: true,
              searchValue: row => row.targetLabel,
              render: row => row.targetLabel,
            },
            {
              key: 'category',
              header: 'Category',
              sortable: true,
              searchValue: row => row.category,
              render: row => <StatusPill label={row.category} tone={getSavedViewCategoryTone(row.category)} />,
            },
            {
              key: 'audience',
              header: 'Audience',
              sortable: true,
              searchValue: row => row.audience,
              render: row => row.audience,
            },
            {
              key: 'filters',
              header: 'Filters',
              sortable: true,
              searchValue: row => String(row.filters.length).padStart(2, '0'),
              render: row => row.filters.length,
            },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getSavedViewStatusTone(row.status)} />,
            },
            {
              key: 'sensitivity',
              header: 'Sensitivity',
              sortable: true,
              searchValue: row => row.sensitivity,
              render: row => <StatusPill label={row.sensitivity} tone={getSavedViewSensitivityTone(row.sensitivity)} />,
            },
          ]}
        />

        <aside className="detail-panel saved-view-detail-panel">
          {selectedView ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">View Detail</p>
                  <h2>{selectedView.name}</h2>
                </div>
                <StatusPill label={selectedView.status} tone={getSavedViewStatusTone(selectedView.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Target</span><strong>{selectedView.targetLabel}</strong></div>
                <div><span>Owner</span><strong>{selectedView.owner}</strong></div>
                <div><span>Role</span><strong>{roleLabels[selectedView.ownerRole]}</strong></div>
                <div><span>Audience</span><strong>{selectedView.audience}</strong></div>
                <div><span>Permission</span><strong>{selectedView.permission}</strong></div>
                <div><span>Source</span><strong>{selectedView.source}</strong></div>
              </div>

              <section className={`panel saved-view-status-panel tone-${canOpenSelected ? 'ok' : 'warn'}`}>
                <div>
                  <p className="eyebrow">Apply Readiness</p>
                  <h2>{canOpenSelected ? 'Target Permission Available' : 'Target Permission Missing'}</h2>
                  <span>{selectedView.description}</span>
                </div>
                <div className="saved-view-status-meta">
                  <StatusPill label={selectedView.sensitivity} tone={getSavedViewSensitivityTone(selectedView.sensitivity)} />
                  <strong>{formatDateTime(selectedView.lastUsedAt)}</strong>
                </div>
              </section>

              <div className="detail-section">
                <h3>Filters</h3>
                <div className="saved-view-filter-grid">
                  {selectedView.filters.map(filter => (
                    <div key={`${filter.field}-${filter.operator}-${filter.value}`}>
                      <span>{filter.field}</span>
                      <strong>{filter.operator} {filter.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h3>Columns</h3>
                <div className="adapter-chip-grid">
                  {selectedView.columns.map(column => <span key={column}>{column}</span>)}
                </div>
              </div>

              <div className="detail-section">
                <h3>Operating Contract</h3>
                <div className="settings-rule-list">
                  <div><Filter size={16} strokeWidth={1.8} /><strong>Sort: {selectedView.sort}</strong></div>
                  <div><BookmarkCheck size={16} strokeWidth={1.8} /><strong>Cadence: {selectedView.cadence}</strong></div>
                  <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>Permission checked before apply or save.</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button
                    className="ghost-action"
                    disabled={!canOpenSelected}
                    onClick={() => applyView(selectedView)}
                  >
                    <Eye size={15} strokeWidth={1.8} />
                    Apply View
                  </button>
                  <button
                    className="ghost-action"
                    disabled={!canManageSavedViews}
                    onClick={() => saveLocalCopy(selectedView)}
                  >
                    <BookmarkCheck size={15} strokeWidth={1.8} />
                    Save Copy
                  </button>
                  {selectedView.source === 'Local Saved View' && (
                    <button
                      className="ghost-action danger"
                      disabled={!canManageSavedViews}
                      onClick={() => removeLocalView(selectedView)}
                    >
                      <Trash2 size={15} strokeWidth={1.8} />
                      Remove Local
                    </button>
                  )}
                  <span className="muted-copy">Apply opens the target workspace and records the filter contract in Audit Logs.</span>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No saved view selected.</div>
          )}
        </aside>
      </div>
    </div>
  )
}

function buildSavedViewMetadata(view: SavedViewDefinition, extra: Record<string, unknown>) {
  return {
    savedViewId: view.id,
    savedViewName: view.name,
    category: view.category,
    targetPage: view.targetPage,
    targetLabel: view.targetLabel,
    audience: view.audience,
    sensitivity: view.sensitivity,
    filters: view.filters,
    columns: view.columns,
    source: view.source,
    ...extra,
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
