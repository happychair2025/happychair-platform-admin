import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'

interface PlaceholderPageProps {
  pageId: string
  title: string
}

export default function PlaceholderPage({ pageId, title }: PlaceholderPageProps) {
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Planned Admin Surface"
        title={title}
        description="Phase 1 route foundation. This page will connect to the shared data contracts after the UI and permissions stabilize."
      />
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{title}</h2>
            <span>{pageId}</span>
          </div>
          <StatusPill label="Planned" tone="neutral" />
        </div>
        <div className="placeholder-grid">
          <div><strong>Permission gated</strong><span>Navigation only appears for roles with access.</span></div>
          <div><strong>Mock first</strong><span>Real data will start with read-only views.</span></div>
          <div><strong>Audit ready</strong><span>Meaningful future actions will write audit records.</span></div>
        </div>
      </section>
    </div>
  )
}

