import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CreateAgentEditor } from './CreateAgentEditor'
import { fr } from '../i18n/fr'

function answer(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'error',
    json: async () => body,
  } as Response)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function fillFirstStep(name: string, instructions: string) {
  fireEvent.change(screen.getByLabelText(fr.grimoire.editor.stepNameLabel), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(fr.grimoire.editor.stepInstructionsLabel), {
    target: { value: instructions },
  })
}

it('refuses to submit with no name', () => {
  const onCreated = vi.fn()
  render(<CreateAgentEditor onClose={() => {}} onCreated={onCreated} />)

  fireEvent.click(screen.getByRole('button', { name: fr.grimoire.editor.submit }))

  expect(screen.getByText(fr.grimoire.editor.nameRequired)).toBeInTheDocument()
  expect(onCreated).not.toHaveBeenCalled()
})

it('posts the name, description and steps, then reports what was created', async () => {
  const fetchMock = answer(201, { Name: 'accueil', Description: 'x', CreatedBy: 'elise', Custom: true })
  vi.stubGlobal('fetch', fetchMock)
  const onCreated = vi.fn()
  const onClose = vi.fn()

  render(<CreateAgentEditor onClose={onClose} onCreated={onCreated} />)

  fireEvent.change(screen.getByLabelText(fr.grimoire.editor.nameLabel), { target: { value: 'accueil' } })
  fireEvent.change(screen.getByLabelText(fr.grimoire.editor.descriptionLabel), { target: { value: 'x' } })
  fillFirstStep('premier contact', 'Présente-toi.')

  fireEvent.click(screen.getByRole('button', { name: fr.grimoire.editor.submit }))

  await waitFor(() => expect(onCreated).toHaveBeenCalled())
  expect(onClose).toHaveBeenCalled()

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v1/skills')
  const body = JSON.parse(init.body as string)
  expect(body.name).toBe('accueil')
  expect(body.steps).toEqual([{ name: 'premier contact', instructions: 'Présente-toi.' }])

  const created = onCreated.mock.calls[0][0]
  expect(created).toMatchObject({ name: 'accueil', kind: 'agent', custom: true, created_by: 'elise' })
})

it('adds, reorders and removes steps', () => {
  render(<CreateAgentEditor onClose={() => {}} onCreated={() => {}} />)

  fireEvent.click(screen.getByRole('button', { name: fr.grimoire.editor.addStep }))
  const names = screen.getAllByLabelText(fr.grimoire.editor.stepNameLabel)
  expect(names).toHaveLength(2)

  fireEvent.change(names[0], { target: { value: 'premier' } })
  fireEvent.change(names[1], { target: { value: 'second' } })

  fireEvent.click(screen.getByRole('button', { name: fr.grimoire.editor.moveStepDown(1) }))
  const reordered = screen.getAllByLabelText(fr.grimoire.editor.stepNameLabel)
  expect((reordered[0] as HTMLInputElement).value).toBe('second')
  expect((reordered[1] as HTMLInputElement).value).toBe('premier')

  fireEvent.click(screen.getByRole('button', { name: fr.grimoire.editor.removeStep(1) }))
  expect(screen.getAllByLabelText(fr.grimoire.editor.stepNameLabel)).toHaveLength(1)
})

it('surfaces a real server error, e.g. a name already taken', async () => {
  vi.stubGlobal('fetch', answer(400, { error: 'skills: "accueil" already exists' }))
  const onCreated = vi.fn()

  render(<CreateAgentEditor onClose={() => {}} onCreated={onCreated} />)
  fireEvent.change(screen.getByLabelText(fr.grimoire.editor.nameLabel), { target: { value: 'accueil' } })
  fillFirstStep('a', 'b')

  fireEvent.click(screen.getByRole('button', { name: fr.grimoire.editor.submit }))

  await waitFor(() =>
    expect(screen.getByText('skills: "accueil" already exists')).toBeInTheDocument(),
  )
  expect(onCreated).not.toHaveBeenCalled()
})

it('closes on Escape and on the close button', () => {
  const onClose = vi.fn()
  render(<CreateAgentEditor onClose={onClose} onCreated={() => {}} />)

  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)

  fireEvent.click(screen.getByRole('button', { name: fr.grimoire.editor.close }))
  expect(onClose).toHaveBeenCalledTimes(2)
})
