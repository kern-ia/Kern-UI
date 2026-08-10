/** Mirrors kern-memory's Recall/Memory wire shape (README.md, POST /api/v1/memory/query). */
export interface Criterion {
  memory: {
    id: string
    kind: string
    text: string
    tags?: string[]
  }
  similarity: number
}

export type CriteriaState =
  | { status: 'loading' }
  | { status: 'ready'; criteria: Criterion[] }
  /** No memory source configured on kern-ui — distinct from a genuinely empty layer. */
  | { status: 'unconfigured' }
  | { status: 'error' }
