import { render, screen, waitFor } from '@testing-library/react'
import { EspaceView } from './EspaceView'
import { fr } from '../i18n/fr'
import type { ToolSpec } from './types'

function answer(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('says what is missing when no tool source is configured', () => {
  render(<EspaceView tools={{ status: 'unconfigured' }} />)
  expect(screen.getByText(fr.espace.unconfigured)).toBeInTheDocument()
})

it('says the catalogue failed to load', () => {
  render(<EspaceView tools={{ status: 'error' }} />)
  expect(screen.getByText(fr.espace.error)).toBeInTheDocument()
})

// A required param has no widget-to-tool binding yet (that gap is C11's, not this view's)
// — so such a tool must not appear as a card that can never show a value.
it('leaves out a tool that needs a required param', () => {
  vi.stubGlobal('fetch', answer(200, {}))
  const specs: ToolSpec[] = [{ name: 'greeting', params: [{ name: 'name', type: 'string', required: true }] }]

  render(<EspaceView tools={{ status: 'ready', specs }} />)

  expect(screen.getByText(fr.espace.empty)).toBeInTheDocument()
})

it('draws a widget card for a tool with no required param and invokes it', async () => {
  vi.stubGlobal('fetch', answer(200, { label: 'Battement', value: '17:09:11', as_of: '2026-07-29T17:09:11+02:00' }))
  const specs: ToolSpec[] = [{ name: 'heartbeat', description: 'reports the time' }]

  render(<EspaceView tools={{ status: 'ready', specs }} />)

  const card = screen.getByRole('listitem', { name: 'heartbeat' })
  expect(card).toHaveTextContent('heartbeat')
  await waitFor(() => expect(card).toHaveTextContent('17:09:11'))
  expect(card).toHaveTextContent('Battement')
})

it('shows an optional param tool too — only required params gate a widget', () => {
  vi.stubGlobal('fetch', answer(200, {}))
  const specs: ToolSpec[] = [{ name: 'loud', params: [{ name: 'shout', type: 'bool', required: false }] }]

  render(<EspaceView tools={{ status: 'ready', specs }} />)

  expect(screen.getByRole('listitem', { name: 'loud' })).toBeInTheDocument()
})
