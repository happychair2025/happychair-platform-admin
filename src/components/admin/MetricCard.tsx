import type { ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: string
  delta?: string
  tone?: 'ok' | 'warn' | 'danger' | 'neutral'
  icon?: ReactNode
}

export default function MetricCard({ label, value, delta, tone = 'neutral', icon }: MetricCardProps) {
  return (
    <section className={`metric-card tone-${tone}`} aria-label={label}>
      <div className="metric-top">
        <span>{label}</span>
        {icon && <div className="metric-icon">{icon}</div>}
      </div>
      <strong>{value}</strong>
      {delta && <p>{delta}</p>}
    </section>
  )
}

