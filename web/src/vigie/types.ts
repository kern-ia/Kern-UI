/** Mirrors internal/firewall.Budget in the Go backend. */
export interface Budget {
  spent_micros: number
  limit_micros: number
  unpriced_calls: number
  unaccounted_calls: number
  window_resets_at: string
}

/** Mirrors internal/firewall.Decision in the Go backend. */
export interface Decision {
  at: string
  layer: string
  decision: string
  rule: string
  run_id: string
  agent_id?: string
}

/** What the browser knows about the consumption snapshot right now. */
export type BudgetState =
  | { status: 'loading' }
  | { status: 'ready'; budget: Budget }
  /** No firewall source configured on kern-ui — distinct from it answering with nothing. */
  | { status: 'unconfigured' }
  | { status: 'error' }
