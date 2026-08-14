import { useState } from 'react'
import { fr } from '../i18n/fr'
import type { Run } from '../runs/types'
import { activityOf, competences, glyphFor, subAgents } from './grimoire'
import { CreateAgentEditor } from './CreateAgentEditor'
import { deleteSkill } from '../steer/api'
import styles from './GrimoireView.module.css'
import type { Activity, RegistryState, Skill } from './types'

/** The mockup's three state colours, from tokens.css. */
const activityColour: Record<Activity, string> = {
  actif: 'var(--state-action)',
  repos: 'var(--state-idle)',
  bloque: 'var(--state-error)',
}

/**
 * The Grimoire: what this Kern knows how to do, and who does it.
 *
 * It draws only what kern-orch published. The four states it can be in are kept apart on
 * purpose — loading, never published, published and empty, failed to load — because
 * collapsing them would make the interface assert something it cannot know.
 */
export function GrimoireView({
  registry,
  runs,
  user = '',
  onSkillsChanged = () => {},
}: {
  registry: RegistryState
  runs: Run[]
  user?: string
  /** Called after a create or delete actually lands, so the caller can refetch. */
  onSkillsChanged?: () => void
}) {
  const [editorOpen, setEditorOpen] = useState(false)

  if (registry.status === 'loading') {
    return <Notice message={fr.grimoire.loading} />
  }
  if (registry.status === 'unpublished') {
    return <Notice message={fr.grimoire.unpublished} hint={fr.grimoire.unpublishedHint} />
  }
  if (registry.status === 'error') {
    return <Notice message={fr.grimoire.error} />
  }

  const tools = competences(registry.catalogue)
  const agents = subAgents(registry.catalogue)

  if (tools.length === 0 && agents.length === 0) {
    return (
      <>
        <Notice message={fr.grimoire.empty} hint={fr.grimoire.emptyHint}>
          <NewSubAgentButton onClick={() => setEditorOpen(true)} />
        </Notice>
        {editorOpen && (
          <CreateAgentEditor
            onClose={() => setEditorOpen(false)}
            onCreated={() => onSkillsChanged()}
          />
        )}
      </>
    )
  }

  return (
    <section className={styles.grimoire} aria-label={fr.grimoire.label}>
      <div className={styles.column}>
        <h2 className={styles.heading} id="grimoire-competences">
          {fr.grimoire.competences}
        </h2>
        <ul className={styles.skillGrid} aria-labelledby="grimoire-competences">
          {tools.map((skill) => (
            <CompetenceCard key={skill.name} skill={skill} />
          ))}
          <li>
            <CreateButton label={fr.grimoire.newSkill} className={styles.skillAdd} />
          </li>
        </ul>
      </div>

      <div className={styles.column}>
        <h2 className={styles.heading} id="grimoire-agents">
          {fr.grimoire.subAgents}
        </h2>
        <ul className={styles.agentGrid} aria-labelledby="grimoire-agents">
          {agents.map((skill) => (
            <AgentCard
              key={skill.name}
              skill={skill}
              activity={activityOf(skill.name, runs)}
              user={user}
              onDeleted={onSkillsChanged}
            />
          ))}
          <li className={styles.agentAddCell}>
            <NewSubAgentButton onClick={() => setEditorOpen(true)} />
            <span className={styles.agentAddLabel}>{fr.grimoire.newSubAgent}</span>
          </li>
        </ul>
      </div>

      {editorOpen && (
        <CreateAgentEditor onClose={() => setEditorOpen(false)} onCreated={() => onSkillsChanged()} />
      )}
    </section>
  )
}

function CompetenceCard({ skill }: { skill: Skill }) {
  return (
    <li className={styles.skillCard} aria-label={skill.name}>
      <span className={styles.skillGlyph} aria-hidden="true">
        {glyphFor(skill.name)}
      </span>
      <span className={styles.skillName}>{skill.name}</span>
      {skill.description && <span className={styles.skillDescription}>{skill.description}</span>}
    </li>
  )
}

function AgentCard({
  skill,
  activity,
  user,
  onDeleted,
}: {
  skill: Skill
  activity: Activity
  user: string
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(false)
  // The button is a display convenience; kern-orch re-checks ownership on every delete
  // regardless of what this shows.
  const mayDelete = skill.custom === true && skill.created_by === user

  const onDelete = async () => {
    setDeleting(true)
    setError(false)
    try {
      await deleteSkill(skill.name)
      onDeleted()
    } catch {
      setError(true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <li className={styles.agentCard} aria-label={skill.name}>
      {/* The mockup shows a generative avatar. Until something generates one, the skill's
          rune stands in — a placeholder image would be decoration pretending to be data. */}
      <span
        className={styles.agentAvatar}
        style={{ '--activity-colour': activityColour[activity] } as React.CSSProperties}
        aria-hidden="true"
      >
        {glyphFor(skill.name)}
      </span>
      <span className={styles.agentName}>{skill.name}</span>
      <span
        className={styles.agentActivity}
        style={{ '--activity-colour': activityColour[activity] } as React.CSSProperties}
      >
        {fr.grimoire.activity[activity]}
      </span>
      {skill.description && <span className={styles.agentDescription}>{skill.description}</span>}
      {mayDelete && (
        <button
          type="button"
          className={styles.agentDelete}
          aria-label={fr.grimoire.deleteSkill(skill.name)}
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? fr.grimoire.deleting : '×'}
        </button>
      )}
      {error && <span className={styles.agentDeleteError}>{fr.grimoire.deleteFailed}</span>}
    </li>
  )
}

function NewSubAgentButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className={styles.agentAdd}
      aria-label={fr.grimoire.newSubAgent}
      onClick={onClick}
    >
      <span aria-hidden="true">+</span>
    </button>
  )
}

/** The mockup's `+` for a tool skill, kept and disabled: a no-code editor cannot author
 * the Go command a tool skill needs. */
function CreateButton({ label, className }: { label: string; className: string }) {
  const describedBy = `create-${label.replace(/\s+/g, '-')}`
  return (
    <>
      <button type="button" className={className} disabled aria-label={label} aria-describedby={describedBy}>
        <span aria-hidden="true">+</span>
      </button>
      <span id={describedBy} hidden>
        {fr.grimoire.creationUnavailable}
      </span>
    </>
  )
}

function Notice({
  message,
  hint,
  children,
}: {
  message: string
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <section className={styles.notice}>
      <span className={styles.noticeGlyph} aria-hidden="true">
        ᛝ
      </span>
      <p className={styles.noticeMessage}>{message}</p>
      {hint && <p className={styles.noticeHint}>{hint}</p>}
      {children}
    </section>
  )
}
