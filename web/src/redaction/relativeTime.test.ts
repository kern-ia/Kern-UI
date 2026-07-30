import { relativeUpdate } from './relativeTime'

const now = new Date('2026-07-30T12:00:00Z')

it('reports now for anything under a minute old', () => {
  expect(relativeUpdate('2026-07-30T11:59:31Z', now)).toEqual({ unit: 'now' })
})

it('reports minutes', () => {
  expect(relativeUpdate('2026-07-30T11:55:00Z', now)).toEqual({ unit: 'minutes', count: 5 })
})

it('reports hours once past 60 minutes', () => {
  expect(relativeUpdate('2026-07-30T09:00:00Z', now)).toEqual({ unit: 'hours', count: 3 })
})

it('reports days once past 24 hours', () => {
  expect(relativeUpdate('2026-07-27T12:00:00Z', now)).toEqual({ unit: 'days', count: 3 })
})

it('never reports a negative age for a clock slightly ahead', () => {
  expect(relativeUpdate('2026-07-30T12:00:05Z', now)).toEqual({ unit: 'now' })
})
