import { fr } from '../i18n/fr'
import { glyphFor } from '../grimoire/grimoire'
import { useToolValue } from './useToolValue'
import styles from './EspaceView.module.css'
import type { ToolSpec, ToolsState } from './types'

const INVOKE_BASE = '/api/v1/tools'

/**
 * The Espace: live widgets, each backed by a tool kern-orch can invoke.
 *
 * Only a tool with no required param becomes a widget here. A required param needs
 * something to bind it to a value — which widget config, which agent output — and that
 * binding is not decided (the same gap C11 names for skill authoring). Showing such a
 * tool as a card that never renders a value would look broken rather than honestly
 * unfinished, so it is left out of the grid entirely rather than guessed at.
 */
export function EspaceView({ tools }: { tools: ToolsState }) {
  if (tools.status === 'loading') {
    return <Notice message={fr.espace.loading} />
  }
  if (tools.status === 'unconfigured') {
    return <Notice message={fr.espace.unconfigured} hint={fr.espace.unconfiguredHint} />
  }
  if (tools.status === 'error') {
    return <Notice message={fr.espace.error} />
  }

  const widgets = tools.specs.filter((s) => !(s.params ?? []).some((p) => p.required))

  if (widgets.length === 0) {
    return <Notice message={fr.espace.empty} hint={fr.espace.emptyHint} />
  }

  return (
    <section className={styles.espace} aria-label={fr.espace.label}>
      <ul className={styles.grid}>
        {widgets.map((spec) => (
          <WidgetCard key={spec.name} spec={spec} />
        ))}
      </ul>
    </section>
  )
}

function WidgetCard({ spec }: { spec: ToolSpec }) {
  const state = useToolValue(INVOKE_BASE, spec.name)

  return (
    <li className={styles.card} aria-label={spec.name}>
      <div className={styles.header}>
        <span className={styles.glyph} aria-hidden="true">
          {glyphFor(spec.name)}
        </span>
        <span className={styles.name}>{spec.name}</span>
      </div>
      {state.status === 'ready' ? (
        <>
          <div className={styles.metric}>{state.result.label || spec.description}</div>
          <div className={styles.value}>{state.result.value}</div>
        </>
      ) : (
        <div className={styles.metric}>
          {state.status === 'loading' ? fr.espace.widgetLoading : fr.espace.widgetError}
        </div>
      )}
    </li>
  )
}

function Notice({ message, hint }: { message: string; hint?: string }) {
  return (
    <section className={styles.notice}>
      <span className={styles.noticeGlyph} aria-hidden="true">
        ▦
      </span>
      <p className={styles.noticeMessage}>{message}</p>
      {hint && <p className={styles.noticeHint}>{hint}</p>}
    </section>
  )
}
