import { Activity, AlertTriangle, CreditCard, PackageCheck, Wrench } from 'lucide-react'
import StatusPill from './StatusPill'
import type { ActivityEvent } from '../../lib/mock-data/mockPlatform'

interface ActivityTimelineProps {
  title?: string
  events: ActivityEvent[]
}

const eventIcons = {
  usage: Activity,
  support: Wrench,
  billing: CreditCard,
  module: PackageCheck,
  health: AlertTriangle,
}

export default function ActivityTimeline({ title = 'Recent Activity', events }: ActivityTimelineProps) {
  const sortedEvents = [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <section className="panel timeline-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <span>{sortedEvents.length} events</span>
        </div>
      </div>
      <div className="timeline-list">
        {sortedEvents.length ? sortedEvents.map(event => {
          const Icon = eventIcons[event.type]
          return (
            <article key={event.id} className="timeline-item">
              <div className="timeline-icon">
                <Icon size={15} strokeWidth={1.8} />
              </div>
              <div>
                <div className="timeline-title">
                  <strong>{event.label}</strong>
                  <StatusPill label={event.type} tone={event.type === 'billing' ? 'warn' : event.type === 'health' ? 'danger' : 'info'} />
                </div>
                <p>{event.detail}</p>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
            </article>
          )
        }) : (
          <div className="empty-state compact">No recent activity.</div>
        )}
      </div>
    </section>
  )
}

