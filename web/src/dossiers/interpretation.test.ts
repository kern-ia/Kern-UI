import { parseInterpretation } from './interpretation'

const real = JSON.stringify({
  revenus: [
    { source: 'Salaire', montant_mensuel: 2400, document_source: 'page 2', statut: 'confirmé' },
  ],
  credits_en_cours: [
    {
      etablissement: 'Crédit Agricole',
      mensualite: 310,
      capital_restant_du: 18000,
      document_source: 'page 3',
      statut: 'confirmé',
    },
  ],
  incidents: [],
  reste_a_vivre: { montant: 950, methode_calcul: 'revenus - charges', statut: 'à vérifier' },
  pieces_manquantes: ['Dernier relevé de compte'],
})

it('parses a real interpretation JSON string', () => {
  const result = parseInterpretation(real)

  expect(result?.revenus).toEqual([
    { source: 'Salaire', montant_mensuel: 2400, document_source: 'page 2', statut: 'confirmé' },
  ])
  expect(result?.credits_en_cours[0].etablissement).toBe('Crédit Agricole')
  expect(result?.reste_a_vivre).toEqual({
    montant: 950,
    methode_calcul: 'revenus - charges',
    statut: 'à vérifier',
  })
  expect(result?.pieces_manquantes).toEqual(['Dernier relevé de compte'])
})

it('returns null for anything that is not a JSON object string', () => {
  expect(parseInterpretation(undefined)).toBeNull()
  expect(parseInterpretation('')).toBeNull()
  expect(parseInterpretation('Créer le contact Dupont.')).toBeNull()
  expect(parseInterpretation('not json at all {')).toBeNull()
  expect(parseInterpretation('"just a string"')).toBeNull()
  expect(parseInterpretation(42)).toBeNull()
})

it('defends against missing or malformed fields instead of throwing', () => {
  const result = parseInterpretation(JSON.stringify({}))

  expect(result).toEqual({
    revenus: [],
    credits_en_cours: [],
    incidents: [],
    reste_a_vivre: null,
    pieces_manquantes: [],
  })
})
