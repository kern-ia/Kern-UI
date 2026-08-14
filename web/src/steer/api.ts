/** What a dispatched tool skill answers with — mirrors the Go backend's tools.Result. */
export interface ToolValue {
  label: string
  value: string
  as_of: string
}

/** What POST /api/v1/dispatch answers with: a tool's value, or a launched run's id. */
export interface DispatchResult {
  kind: 'tool' | 'run'
  result?: ToolValue
  run_id?: string
}

/**
 * A refusal from kern-ui's steer proxy. `known` is set only for an unknown-skill dispatch
 * failure, carrying what does exist so a mistyped command can show it.
 */
export class SteerError extends Error {
  status: number
  known?: string[]

  constructor(message: string, status: number, known?: string[]) {
    super(message)
    this.name = 'SteerError'
    this.status = status
    this.known = known
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return send<T>('POST', path, body)
}

async function del<T>(path: string): Promise<T> {
  return send<T>('DELETE', path, {})
}

async function send<T>(method: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; known?: string[] }
    throw new SteerError(payload.error ?? response.statusText, response.status, payload.known)
  }
  return (await response.json()) as T
}

/** Cancels a live run. */
export function stopRun(runId: string): Promise<unknown> {
  return post(`/api/v1/runs/${encodeURIComponent(runId)}/stop`, {})
}

/** Answers a pending approval node. */
export function decide(runId: string, nodeId: string, decision: 'approve' | 'refuse'): Promise<unknown> {
  return post(
    `/api/v1/runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(nodeId)}/decide`,
    { decision },
  )
}

/** Queues a state key/value for the next level of a live run. */
export function nudge(runId: string, key: string, value: unknown): Promise<unknown> {
  return post(`/api/v1/runs/${encodeURIComponent(runId)}/nudge`, { key, value })
}

/**
 * Resolves an explicit `/skill text…` chat command. dossier is a caller-supplied
 * business label (e.g. a client case) grouping the launched run under a case —
 * distinct from a session identity, and omitted from the body entirely when absent
 * rather than sent as an empty string.
 */
export function dispatch(skill: string, text: string, dossier?: string): Promise<DispatchResult> {
  return post<DispatchResult>('/api/v1/dispatch', dossier ? { skill, text, dossier } : { skill, text })
}

/** Uploads a picked file and returns the local path kern-orch saved it under — the same
 * "text IS the document path" convention dispatch already sends, fed by a file instead of
 * typed text (see courtage-extraction's reception node). */
export async function uploadFile(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch('/api/v1/uploads', { method: 'POST', body })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new SteerError(payload.error ?? response.statusText, response.status)
  }
  const out = (await response.json()) as { path: string }
  return out.path
}

/** One instruction in a created sub-agent's chain (C11). */
export interface SkillStep {
  name: string
  instructions: string
}

/** What POST /api/v1/skills answers with — mirrors kern-orch's skills.Skill, narrowed to
 * what the Grimoire needs to draw the new entry without a full catalogue refetch. */
export interface CreatedSkill {
  Name: string
  Description?: string
  CreatedBy: string
  Custom: boolean
}

/** Writes a new sub-agent: one node per step, chained in order. The actor never travels
 * here — kern-ui's own session says who is asking. */
export function createSkill(name: string, description: string, steps: SkillStep[]): Promise<CreatedSkill> {
  return post<CreatedSkill>('/api/v1/skills', { name, description, steps })
}

/** Removes a created sub-agent. Refused (403) unless the caller's session is the account
 * that created it — enforced server-side regardless of what the button shows. */
export function deleteSkill(name: string): Promise<unknown> {
  return del(`/api/v1/skills/${encodeURIComponent(name)}`)
}
