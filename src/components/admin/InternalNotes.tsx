import { useMemo, useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { appendAuditEvent } from '../../lib/audit/auditLog'
import type { SupportNote } from '../../lib/mock-data/mockPlatform'
import { roleLabels, type AdminRole } from '../../lib/permissions/permissions'

interface InternalNotesProps {
  title?: string
  scopeType: SupportNote['scopeType']
  scopeId: string
  scopeLabel: string
  notes: SupportNote[]
  actor: string
  actorRole: AdminRole
}

export default function InternalNotes({ title = 'Internal Notes', scopeType, scopeId, scopeLabel, notes, actor, actorRole }: InternalNotesProps) {
  const [draft, setDraft] = useState('')
  const [localNotes, setLocalNotes] = useState<SupportNote[]>([])

  const scopedNotes = useMemo(() => {
    return [...localNotes, ...notes]
      .filter(note => note.scopeType === scopeType && note.scopeId === scopeId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [localNotes, notes, scopeId, scopeType])

  const addNote = () => {
    const body = draft.trim()
    if (!body) return
    const note: SupportNote = {
      id: crypto.randomUUID(),
      scopeType,
      scopeId,
      author: actor,
      authorRole: roleLabels[actorRole],
      body,
      createdAt: new Date().toISOString(),
    }
    setLocalNotes(current => [note, ...current])
    setDraft('')
    appendAuditEvent({
      actor,
      actorRole: roleLabels[actorRole],
      scope: scopeLabel,
      actionKey: 'support.note.created.mock',
      actionLabel: `Added internal note to ${scopeLabel}`,
      severity: 'notice',
    })
  }

  return (
    <section className="panel notes-panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <span>{scopeLabel}</span>
        </div>
        <MessageSquarePlus size={18} strokeWidth={1.8} />
      </div>
      <label className="field compact-field">
        <span>Add note</span>
        <textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="Add internal context for Team Happy Chair." />
      </label>
      <button className="ghost-action full-width" disabled={!draft.trim()} onClick={addNote}>Add Note</button>

      <div className="notes-list">
        {scopedNotes.length ? scopedNotes.map(note => (
          <article key={note.id} className="note-item">
            <div>
              <strong>{note.author}</strong>
              <span>{note.authorRole} / {new Date(note.createdAt).toLocaleString()}</span>
            </div>
            <p>{note.body}</p>
          </article>
        )) : (
          <div className="empty-state compact">No internal notes yet.</div>
        )}
      </div>
    </section>
  )
}

