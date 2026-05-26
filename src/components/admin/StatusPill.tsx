interface StatusPillProps {
  label: string
  tone?: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
}

export default function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  return <span className={`status-pill tone-${tone}`}>{label}</span>
}

