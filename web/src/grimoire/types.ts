/** Mirrors registry.Catalogue in the Go backend. Keep both sides in step. */
export type SkillKind = 'tool' | 'agent'

export interface Skill {
  name: string
  kind: SkillKind
  description?: string
}

export interface Catalogue {
  source: string
  at: string
  skills: Skill[]
}

/**
 * How a sub-agent stands, in the mockup's three colours.
 *
 * Derived from the runs, never sent: a skill is `bloque` when a node running it was live
 * as its run failed, `actif` when a node running it is in a live frontier, `repos`
 * otherwise.
 */
export type Activity = 'actif' | 'repos' | 'bloque'

/** What the browser knows about the catalogue right now. */
export type RegistryState =
  | { status: 'loading' }
  /** kern-orch published: the Grimoire draws what it was given, empty or not. */
  | { status: 'ready'; catalogue: Catalogue }
  /** Nobody has published yet — a different screen from an empty catalogue. */
  | { status: 'unpublished' }
  | { status: 'error' }
