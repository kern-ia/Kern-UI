import { useState } from 'react'
import { fr } from '../i18n/fr'
import { HiveGraph } from '../runs/HiveGraph'
import { RunList } from '../runs/RunList'
import styles from './AgentsView.module.css'
import { topLevelRuns } from '../runs/nested'
import { nodeStatus } from '../runs/hive'
import { decide, stopRun } from '../steer/api'
import { parseInterpretation } from '../dossiers/interpretation'
import { ExtractionDossierPanel } from '../dossiers/ExtractionDossierPanel'
import type { Run } from '../runs/types'

/**
 * The hive of sub-agents: the selected run drawn as a graph, with the run list below acting
 * as the selector.
 *
 * Selection is controlled by the parent (AppShell) rather than owned here, so the
 * conversation stone can nudge whichever mission is open even from another tab.
 */
export function AgentsView({
  runs,
  user = '',
  selectedId = null,
  onSelect = () => {},
}: {
  runs: Run[]
  user?: string
  selectedId?: string | null
  onSelect?: (id: string) => void
}) {
  // Nested runs are drawn inside the node that produced them, so listing them beside their
  // parent would show the same work twice.
  const listed = topLevelRuns(runs)
  const selected = listed.find((r) => r.id === selectedId) ?? listed[0]

  return (
    <section>
      <div className={styles.head}>
        <h2 className={styles.heading}>{fr.runs.heading}</h2>
        {listed.length > 0 && <span className={styles.count}>{fr.runs.count(listed.length)}</span>}
        {selected && selected.status === 'running' && <StopButton run={selected} user={user} />}
      </div>

      {selected &&
        (selected.topology ? (
          <>
            <HiveGraph run={selected} runs={runs} />
            <ApprovalPanel run={selected} />
          </>
        ) : (
          // A run that has completed no level yet was opened by its activity signal: its
          // shape is still on its way. Only past that point is a missing topology a
          // statement about the producer rather than about timing.
          <p className={styles.noTopology}>
            {selected.step === 0 ? fr.hive.topologyPending : fr.hive.noTopology}
          </p>
        ))}

      <RunList runs={listed} selected={selected?.id} onSelect={onSelect} />
    </section>
  )
}

/**
 * Steering a mission is the requester's own business — nobody else's click should stop it.
 * Disabled rather than hidden, with the reason said, same rule as the Grimoire's `+`: never
 * a control that just does nothing.
 */
function StopButton({ run, user }: { run: Run; user: string }) {
  const [stopping, setStopping] = useState(false)
  const canStop = !run.requester || run.requester === user

  const onClick = async () => {
    setStopping(true)
    try {
      await stopRun(run.id)
    } catch {
      // The run stream will keep showing its real status either way; nothing more to say
      // here than the label reverting.
    } finally {
      setStopping(false)
    }
  }

  return (
    <button
      type="button"
      className={styles.stop}
      disabled={!canStop || stopping}
      title={canStop ? undefined : fr.runs.stopUnavailable}
      onClick={onClick}
    >
      {stopping ? fr.runs.stopping : fr.runs.stop}
    </button>
  )
}

/**
 * A mission parked on an approval node, with the two answers a person can give it. Drawn
 * beside the hive rather than inside the SVG: the mockup never drew an input on a node, and
 * a panel says the same thing without guessing at where buttons would fit on the graph.
 */
export function ApprovalPanel({ run }: { run: Run }) {
  const [deciding, setDeciding] = useState(false)
  const [failed, setFailed] = useState(false)

  const node = run.topology?.nodes.find(
    (n) => n.kind === 'approval' && nodeStatus(run, n.id) === 'active',
  )
  if (!node) return null

  const answer = async (decision: 'approve' | 'refuse') => {
    setDeciding(true)
    setFailed(false)
    try {
      await decide(run.id, node.id, decision)
    } catch {
      setFailed(true)
    } finally {
      setDeciding(false)
    }
  }

  const interpretation = parseInterpretation((run.state as Record<string, unknown> | undefined)?.interpretation)
  const plan = interpretation ? null : planProposed(run)

  return (
    <div className={styles.approval}>
      <p>{fr.runs.awaitingDecision(node.id)}</p>
      {interpretation && <ExtractionDossierPanel interpretation={interpretation} />}
      {plan && <p className={styles.approvalPlan}>{plan}</p>}
      <div className={styles.approvalActions}>
        <button type="button" disabled={deciding} onClick={() => answer('approve')}>
          {deciding ? fr.runs.deciding : fr.runs.approve}
        </button>
        <button type="button" disabled={deciding} onClick={() => answer('refuse')}>
          {deciding ? fr.runs.deciding : fr.runs.refuse}
        </button>
      </div>
      {failed && <p className={styles.approvalError}>{fr.runs.decisionFailed}</p>}
    </div>
  )
}

/**
 * The plan an earlier agent node proposed, if the run's state carries one — approving a
 * decision a person cannot read is not a real review. Fallback text path: an approval
 * whose state also carries a parseable `interpretation` (courtage-extraction's
 * confirm_extraction) renders that structured dossier instead, via ExtractionDossierPanel.
 *
 * `run.state` on the wire is a FLAT map, not `graph.State`'s own `{step, frozen, data,
 * zones}` checkpoint shape: `report.flatten` (Kern-Orch's internal/report/http.go)
 * builds the reported state by copying every key straight from `graph.State.Get`, with
 * no wrapper — that shape is for persistence/resume, this one is for the live step
 * event. Corrected after finding it live in a real browser: the first version of this
 * function read `state.data.plan_propose`, which is never populated on this path.
 */
function planProposed(run: Run): string | null {
  const state = run.state as Record<string, unknown> | undefined
  const plan = state?.plan_propose
  return typeof plan === 'string' && plan.trim() !== '' ? plan : null
}
