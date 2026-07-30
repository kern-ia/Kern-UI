/** Accepts or ignores one suggestion. */
export async function resolveSuggestion(
  documentId: string,
  suggestionId: string,
  accept: boolean,
): Promise<void> {
  const verb = accept ? 'accept' : 'ignore'
  const response = await fetch(
    `/api/v1/documents/${encodeURIComponent(documentId)}/suggestions/${encodeURIComponent(suggestionId)}/${verb}`,
    { method: 'POST' },
  )
  if (!response.ok) {
    throw new Error(`resolveSuggestion: kern-ui answered ${response.status}`)
  }
}
