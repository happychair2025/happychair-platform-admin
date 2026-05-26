import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}

export default function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  )
}

