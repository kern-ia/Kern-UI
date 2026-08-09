import { initials } from './initials'

it('takes the first two letters, uppercased', () => {
  expect(initials('elise')).toBe('EL')
})

it('falls back to a placeholder for an empty name', () => {
  expect(initials('')).toBe('?')
  expect(initials('   ')).toBe('?')
})
