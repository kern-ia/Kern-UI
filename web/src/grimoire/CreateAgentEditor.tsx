import { useState } from 'react'
import { fr } from '../i18n/fr'
import { createSkill, SteerError, type SkillStep } from '../steer/api'
import type { Skill } from './types'
import styles from './CreateAgentEditor.module.css'

interface StepDraft extends SkillStep {
  key: number
}

let nextKey = 0
function newStep(): StepDraft {
  nextKey += 1
  return { key: nextKey, name: '', instructions: '' }
}

/**
 * The Grimoire's `+`, for real (C11): a linear chain of Agent steps, no branching — the
 * only shape kern-orch's write path can express today (see docs/index/
 * sub-agent-creation.md). Steps are shown as connected cards, echoing HiveGraph's visual
 * language, but reordered with buttons rather than free drag: dragging would let someone
 * build a layout the backend cannot honour, since a straight line is the only valid one.
 */
export function CreateAgentEditor({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (skill: Skill) => void
}) {
  const t = fr.grimoire.editor
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<StepDraft[]>([newStep()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateStep = (i: number, patch: Partial<SkillStep>) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  const addStep = () => setSteps((prev) => [...prev, newStep()])

  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i))

  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() === '') {
      setError(t.nameRequired)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await createSkill(
        name.trim(),
        description.trim(),
        steps.map(({ name, instructions }) => ({ name, instructions })),
      )
      onCreated({
        name: created.Name,
        kind: 'agent',
        description: created.Description,
        custom: created.Custom,
        created_by: created.CreatedBy,
      })
      onClose()
    } catch (err) {
      setError(err instanceof SteerError ? err.message : t.createFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <form className={styles.panel} onSubmit={submit}>
        <div className={styles.head}>
          <h2 className={styles.title}>{t.title}</h2>
          <button type="button" className={styles.closeButton} aria-label={t.close} onClick={onClose}>
            ×
          </button>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>{t.nameLabel}</span>
          <input
            className={styles.input}
            value={name}
            placeholder={t.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t.descriptionLabel}</span>
          <input
            className={styles.input}
            value={description}
            placeholder={t.descriptionPlaceholder}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <ol className={styles.chain}>
          {steps.map((step, i) => (
            <li key={step.key} className={styles.stepCard}>
              {i > 0 && <span className={styles.connector} aria-hidden="true" />}
              <div className={styles.stepHead}>
                <span className={styles.stepIndex}>{i + 1}</span>
                <div className={styles.stepButtons}>
                  <button
                    type="button"
                    aria-label={t.moveStepUp(i + 1)}
                    disabled={i === 0}
                    onClick={() => moveStep(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={t.moveStepDown(i + 1)}
                    disabled={i === steps.length - 1}
                    onClick={() => moveStep(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={t.removeStep(i + 1)}
                    disabled={steps.length === 1}
                    onClick={() => removeStep(i)}
                  >
                    ×
                  </button>
                </div>
              </div>
              <label className={styles.field}>
                <span className={styles.label}>{t.stepNameLabel}</span>
                <input
                  className={styles.input}
                  value={step.name}
                  onChange={(e) => updateStep(i, { name: e.target.value })}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>{t.stepInstructionsLabel}</span>
                <textarea
                  className={styles.textarea}
                  value={step.instructions}
                  onChange={(e) => updateStep(i, { instructions: e.target.value })}
                />
              </label>
            </li>
          ))}
        </ol>

        <button type="button" className={styles.addStep} onClick={addStep}>
          {t.addStep}
        </button>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button type="button" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? t.creating : t.submit}
          </button>
        </div>
      </form>
    </div>
  )
}
