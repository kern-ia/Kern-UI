// Shape produced by Kern-Orch's courtage-extraction skill (INTERPRETATION_PROMPT in
// skills/courtage-extraction/agent_cli.py) and restored (PII de-tokenised) into
// state["interpretation"] by the time a run parks on the confirm_extraction approval
// node — see internal/cmd/courtage_anon.go's deanonymizePII. It travels as a JSON string
// inside the flat state map, not a nested object: report.flatten (Kern-Orch) copies every
// graph.State key as-is, and this key happens to hold model-generated JSON text.

export interface RevenuLine {
  source: string
  montant_mensuel: number | null
  document_source: string
  statut: string
}

export interface CreditLine {
  etablissement: string
  mensualite: number | null
  capital_restant_du: number | null
  document_source: string
  statut: string
}

export interface IncidentLine {
  type: string
  date: string
  montant: number | null
  document_source: string
}

export interface ResteAVivre {
  montant: number | null
  methode_calcul: string
  statut: string
}

export interface Interpretation {
  revenus: RevenuLine[]
  credits_en_cours: CreditLine[]
  incidents: IncidentLine[]
  reste_a_vivre: ResteAVivre | null
  pieces_manquantes: string[]
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

// Model-generated JSON: defensive on every field, never throws on a shape surprise —
// a malformed field is dropped, not a reason to hide the whole dossier from the reviewer.
export function parseInterpretation(raw: unknown): Interpretation | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null

  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>

  const resteRaw = o.reste_a_vivre
  const reste =
    typeof resteRaw === 'object' && resteRaw !== null
      ? {
          montant: typeof (resteRaw as { montant?: unknown }).montant === 'number'
            ? (resteRaw as { montant: number }).montant
            : null,
          methode_calcul: String((resteRaw as { methode_calcul?: unknown }).methode_calcul ?? ''),
          statut: String((resteRaw as { statut?: unknown }).statut ?? ''),
        }
      : null

  return {
    revenus: asArray<RevenuLine>(o.revenus),
    credits_en_cours: asArray<CreditLine>(o.credits_en_cours),
    incidents: asArray<IncidentLine>(o.incidents),
    reste_a_vivre: reste,
    pieces_manquantes: asArray<string>(o.pieces_manquantes).filter((s) => typeof s === 'string'),
  }
}
