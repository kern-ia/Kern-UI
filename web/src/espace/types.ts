/** Mirrors internal/tools.Param in the Go backend. */
export interface ToolParam {
  name: string
  type: string
  required: boolean
}

/** Mirrors internal/tools.Spec in the Go backend. */
export interface ToolSpec {
  name: string
  description?: string
  params?: ToolParam[]
}

/** Mirrors internal/tools.Result in the Go backend. */
export interface ToolValue {
  label: string
  value: string
  as_of: string
}

/** What the browser knows about the tool catalogue right now. */
export type ToolsState =
  | { status: 'loading' }
  | { status: 'ready'; specs: ToolSpec[] }
  /** No tool source configured on kern-ui — distinct from kern-orch answering with none. */
  | { status: 'unconfigured' }
  | { status: 'error' }

/** What one widget knows about its own live value. */
export type ToolValueState =
  | { status: 'loading' }
  | { status: 'ready'; result: ToolValue }
  | { status: 'error' }
