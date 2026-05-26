import StatusPill from './StatusPill'

interface HealthScorePanelProps {
  score: number
  status: string
  usageScore: number
  adoptionScore?: number
  billingScore?: number
  supportScore?: number
  setupScore?: number
}

const defaultBreakdown = {
  adoptionScore: 72,
  billingScore: 88,
  supportScore: 76,
  setupScore: 81,
}

function toneForScore(score: number) {
  if (score < 45) return 'danger'
  if (score < 70) return 'warn'
  return 'ok'
}

export default function HealthScorePanel({ score, status, usageScore, adoptionScore, billingScore, supportScore, setupScore }: HealthScorePanelProps) {
  const scores = [
    { label: 'Usage', value: usageScore },
    { label: 'Adoption', value: adoptionScore ?? defaultBreakdown.adoptionScore },
    { label: 'Billing', value: billingScore ?? defaultBreakdown.billingScore },
    { label: 'Support', value: supportScore ?? defaultBreakdown.supportScore },
    { label: 'Setup', value: setupScore ?? defaultBreakdown.setupScore },
  ]

  return (
    <section className="panel health-score-panel">
      <div className="panel-header">
        <div>
          <h2>Health Score</h2>
          <span>Calculated placeholder</span>
        </div>
        <StatusPill label={status} tone={toneForScore(score)} />
      </div>
      <div className={`score-orb tone-${toneForScore(score)}`}>
        <strong>{score}</strong>
        <span>overall</span>
      </div>
      <div className="score-breakdown">
        {scores.map(item => (
          <div key={item.label} className="score-row">
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            <div className="score-track">
              <span style={{ width: `${item.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

