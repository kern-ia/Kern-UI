/** Two letters, never a raw account name spelled out where the mockup draws an avatar. */
export function initials(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '') return '?'
  return trimmed.slice(0, 2).toUpperCase()
}
