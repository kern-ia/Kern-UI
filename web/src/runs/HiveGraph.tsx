import { useState } from "react";
import { fr } from "../i18n/fr";
import styles from "./HiveGraph.module.css";
import { layoutHive, nodeStatus } from "./hive";
import { childRunOf } from "./nested";
import type { NodeStatus, Run } from "./types";

/** The mockup's state palette, applied to nodes rather than to the whole system. */
const statusColour: Record<NodeStatus, string> = {
  pending: "var(--gold-faint)",
  active: "var(--state-action)",
  done: "var(--state-idle)",
  failed: "var(--state-error)",
};

/** Card footprint inside its rank/row slot (220×110, see hive.ts) — leaves margin around
 * each card so cards never touch even at the smallest zoom step. */
const CARD_WIDTH = 176;
const CARD_HEIGHT = 92;
const AVATAR_SIZE = 28;

/** Fixed zoom steps rather than continuous pinch/scroll — no new dependency, and a timeline
 * a handful of cards wide never needs finer control than this. */
const ZOOM_STEPS = [0.6, 0.8, 1, 1.25];
const DEFAULT_ZOOM_INDEX = 2;

/**
 * Draws a run as a horizontal timeline: one column per step, cards stacked down a column
 * when several land on it, edges flowing on the live paths.
 *
 * Everything here is derived from the declared topology and the frontiers seen so far. When
 * a node's successors are decided at run time the drawing says so with a dashed stub rather
 * than showing a dead end it cannot vouch for.
 */
export function HiveGraph({
  run,
  runs = [],
  nested = false,
}: {
  run: Run;
  runs?: Run[];
  /** True when drawn inside another hive: the legend is already on screen above. */
  nested?: boolean;
}) {
  const [opened, setOpened] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);

  if (!run.topology) return null;

  const { nodes, edges, width, height } = layoutHive(run.topology);
  const statusOf = (id: string) => nodeStatus(run, id);
  const zoom = ZOOM_STEPS[zoomIndex];

  // A subgraph node is a whole graph. It can only be opened once the nested run has
  // reported: an empty panel would say "nothing happened in here", which is not the same
  // as "we have not been told yet".
  const nestedNodes = nodes
    .map((node) => ({ node, child: childRunOf(runs, run.id, node.id) }))
    .filter((entry) => entry.child !== undefined);

  const centreOnMount = (el: HTMLDivElement | null) => {
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
  }

  const toggle = (id: string) =>
    setOpened((current) =>
      current.includes(id) ? current.filter((n) => n !== id) : [...current, id],
    );

  // Every node handler writes its human-readable summary under "display:<nodeId>" (a
  // convention, not a per-graph mapping — any node in any graph can opt into this by
  // writing that one key, so this component never needs to know what a given graph's
  // nodes are actually called). See Kern-Orch/skills/prospection/agent_cli.py for the
  // convention's first producer.
  const outputOf = (id: string): string | null => {
    const state = run.state as Record<string, unknown> | undefined;
    const text = state?.[`display:${id}`];
    return typeof text === 'string' && text.trim() !== '' ? text : null;
  };

  return (
    <>
      {!nested && (
        <div className={styles.toolbar}>
          <ul className={styles.legend}>
            {(["active", "done", "pending", "failed"] as NodeStatus[]).map(
              (s) => (
                <li key={s} className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={
                      { "--dot-colour": statusColour[s] } as React.CSSProperties
                    }
                    aria-hidden="true"
                  />
                  {fr.hive.status[s]}
                </li>
              ),
            )}
          </ul>
          <div className={styles.zoom}>
            <button
              type="button"
              className={styles.zoomButton}
              aria-label={fr.hive.zoomOut}
              disabled={zoomIndex === 0}
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            >
              −
            </button>
            <button
              type="button"
              className={styles.zoomButton}
              aria-label={fr.hive.zoomIn}
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Opened on the middle: the layout centres a graph in the drawing, so a phone
          scrolled to the left edge would show empty margin and no nodes. Horizontal scroll
          is the timeline's normal reading gesture now, not just a mobile fallback. */}
      <div className={styles.scroller} ref={centreOnMount}>
        <svg
          className={styles.frame}
          style={{ width: width * zoom, height: height * zoom }}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={fr.hive.label(run.graph, nodes.length)}
        >
          {edges.map((e) => {
            // An edge is live when it leads into what is running right now.
            const live =
              run.status === "running" && run.frontier.includes(e.to);
            return (
              <line
                key={`${e.from}-${e.to}`}
                className={live ? styles.edgeLive : styles.edge}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
              />
            );
          })}

          {nodes.map((n) => {
            const status = statusOf(n.id);
            const isEntry = n.id === run.topology!.entry;
            const info = fr.hive.nodeInfo(n.id);

            return (
              <g
                key={n.id}
                className={styles.node}
                role="button"
                tabIndex={0}
                aria-label={fr.hive.selectNode(n.id)}
                aria-pressed={selectedNode === n.id}
                onClick={() =>
                  setSelectedNode((current) => (current === n.id ? null : n.id))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedNode((current) => (current === n.id ? null : n.id));
                  }
                }}
              >
                {n.openEnded && (
                  <path
                    className={styles.openEnded}
                    d={`M ${n.x + CARD_WIDTH / 2 + 4} ${n.y} L ${n.x + CARD_WIDTH / 2 + 26} ${n.y}`}
                  />
                )}
                <foreignObject
                  x={n.x - CARD_WIDTH / 2}
                  y={n.y - CARD_HEIGHT / 2}
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                >
                  <div
                    // @ts-expect-error -- xmlns is required inside foreignObject content, not part of React's DOM typings
                    xmlns="http://www.w3.org/1999/xhtml"
                    className={styles.card}
                    data-status={status}
                    data-entry={isEntry || undefined}
                  >
                    {status === "active" && <span className={styles.cardHalo} aria-hidden="true" />}
                    <span
                      className={styles.cardAvatar}
                      aria-hidden="true"
                      style={{ "--dot-colour": statusColour[status], width: AVATAR_SIZE, height: AVATAR_SIZE } as React.CSSProperties}
                    />
                    <span className={styles.cardBody}>
                      <span className={styles.cardName}>{info.name}</span>
                      <span className={styles.cardDescription}>{info.description}</span>
                    </span>
                    <span className={styles.cardStatus} data-status={status}>
                      {fr.hive.status[status]}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedNode && (
        <div className={styles.nodeDetail}>
          <div className={styles.nodeDetailHead}>
            <p className={styles.nodeDetailTitle}>{fr.hive.nodeInfo(selectedNode).name}</p>
            <button
              type="button"
              className={styles.nodeDetailClose}
              aria-label={fr.hive.closeNode(selectedNode)}
              onClick={() => setSelectedNode(null)}
            >
              ×
            </button>
          </div>
          <p className={styles.nodeDetailBody}>
            {outputOf(selectedNode) ?? fr.hive.nodeOutputPending}
          </p>
        </div>
      )}

      {nestedNodes.map(({ node, child }) => {
        const isOpen = opened.includes(node.id);
        return (
          <div key={node.id} className={styles.nested}>
            <button
              type="button"
              className={styles.nestedToggle}
              aria-expanded={isOpen}
              onClick={() => toggle(node.id)}
            >
              <span className={styles.nestedChevron} aria-hidden="true">
                {isOpen ? "▼" : "▶"}
              </span>
              {isOpen
                ? fr.hive.closeNested(node.id)
                : fr.hive.openNested(node.id)}
            </button>

            {isOpen && (
              <div className={styles.nestedBody}>
                <p className={styles.nestedLabel}>
                  {fr.hive.nestedOf(node.id)}
                </p>
                {/* The same component, so a sub-agent reads in the language its parent
                    already taught the reader. Recursion also means depth costs nothing. */}
                <HiveGraph run={child!} runs={runs} nested />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
