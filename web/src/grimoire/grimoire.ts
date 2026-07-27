import { nodeStatus } from '../runs/hive'
import type { Run } from '../runs/types'
import type { Activity, Catalogue, Skill } from './types'

/**
 * The Grimoire's left column: skills executed directly.
 *
 * Order follows the catalogue, which the server already sorted by name. Sorting again here
 * would be a second opinion on the same question.
 */
export function competences(catalogue: Catalogue): Skill[] {
  return catalogue.skills.filter((s) => s.kind === 'tool')
}

/** The Grimoire's right column: skills backed by a model. */
export function subAgents(catalogue: Catalogue): Skill[] {
  return catalogue.skills.filter((s) => s.kind === 'agent')
}

/**
 * The eight competences the mockup names, with the runes it gives them.
 *
 * Glyphs belong to the interface: a brick sending an icon name would be a brick doing our
 * job. Keys are normalised, so a skill declared `synthese` in a SKILL.md still gets the
 * rune drawn for `Synthèse`.
 */
const NAMED_RUNES: Record<string, string> = {
  analyse: 'ᛝ',
  synthese: 'ᚦ',
  recherche: 'ᛟ',
  memoire: 'ᚱ',
  vision: 'ᛒ',
  ecriture: 'ᚨ',
  orchestration: 'ᛚ',
  vigilance: 'ᛈ',
}

/** The wider alphabet an unnamed skill draws from. */
const RUNES = [
  'ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ',
  'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ',
  'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ', 'ᛝ',
]

/** Strips case and accents so `Synthèse`, `synthese` and `SYNTHÈSE` are one key. */
function normalise(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * A rune for a skill: the mockup's own where it names one, otherwise a stable pick from
 * the alphabet. Stable matters more than pretty — a glyph that changed between renders
 * would read as a different skill.
 */
export function glyphFor(name: string): string {
  const key = normalise(name)
  if (NAMED_RUNES[key]) return NAMED_RUNES[key]

  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return RUNES[hash % RUNES.length]
}

/**
 * How a sub-agent stands, derived from the runs in flight.
 *
 * The link between a catalogue entry and a run is the topology's declared `skill`, never
 * the node id: a node `greet` may run the skill `planner`, so matching those two would be
 * a guess dressed as a fact. Per-node state is `nodeStatus`'s answer, reused rather than
 * recomputed — the hive and the Grimoire must never disagree about who is running.
 *
 * Trouble outranks activity: a skill blocked in one run and busy in another is reported
 * blocked, because that is the one a reader has to act on.
 */
export function activityOf(skillName: string, runs: Run[]): Activity {
  let active = false

  for (const run of runs) {
    for (const node of run.topology?.nodes ?? []) {
      if (node.skill !== skillName) continue

      const status = nodeStatus(run, node.id)
      if (status === 'failed') return 'bloque'
      if (status === 'active') active = true
    }
  }

  return active ? 'actif' : 'repos'
}
