import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LoginView } from './LoginView'
import { fr } from '../i18n/fr'

it('asks for an identifier and a password', () => {
  render(<LoginView onSignIn={vi.fn()} />)

  expect(screen.getByLabelText(fr.login.name)).toBeInTheDocument()
  expect(screen.getByLabelText(fr.login.password)).toBeInTheDocument()
})

// The browser must be told this is a password, or it offers to save the wrong thing and
// shows the characters on screen.
it('masks the password field', () => {
  render(<LoginView onSignIn={vi.fn()} />)

  expect(screen.getByLabelText(fr.login.password)).toHaveAttribute('type', 'password')
})

it('hands the credentials over on submit', async () => {
  const onSignIn = vi.fn().mockResolvedValue(true)
  render(<LoginView onSignIn={onSignIn} />)

  fireEvent.change(screen.getByLabelText(fr.login.name), { target: { value: 'yoann' } })
  fireEvent.change(screen.getByLabelText(fr.login.password), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: fr.login.submit }))

  await waitFor(() =>
    expect(onSignIn).toHaveBeenCalledWith({ name: 'yoann', password: 'secret' }),
  )
})

it('says so when the credentials are refused', async () => {
  render(<LoginView onSignIn={vi.fn().mockResolvedValue(false)} />)

  fireEvent.change(screen.getByLabelText(fr.login.name), { target: { value: 'yoann' } })
  fireEvent.change(screen.getByLabelText(fr.login.password), { target: { value: 'faux' } })
  fireEvent.click(screen.getByRole('button', { name: fr.login.submit }))

  expect(await screen.findByRole('alert')).toHaveTextContent(fr.login.refused)
})

// The refusal must not distinguish a wrong password from an unknown account, on screen any
// more than on the wire.
it('never says which of the two was wrong', async () => {
  render(<LoginView onSignIn={vi.fn().mockResolvedValue(false)} />)

  fireEvent.change(screen.getByLabelText(fr.login.name), { target: { value: 'personne' } })
  fireEvent.change(screen.getByLabelText(fr.login.password), { target: { value: 'x' } })
  fireEvent.click(screen.getByRole('button', { name: fr.login.submit }))

  const alert = await screen.findByRole('alert')
  expect(alert.textContent).not.toMatch(/compte|inconnu|existe|utilisateur/i)
})

it('does not submit an empty form', () => {
  const onSignIn = vi.fn()
  render(<LoginView onSignIn={onSignIn} />)

  fireEvent.click(screen.getByRole('button', { name: fr.login.submit }))

  expect(onSignIn).not.toHaveBeenCalled()
})
