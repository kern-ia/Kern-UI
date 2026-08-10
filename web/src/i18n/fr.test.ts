import { fr } from './fr'

// A run's node ids are internal (secretaire, confirm_strategie…). fr.hive.nodeInfo is the
// one seam that turns them into what a reader who did not build the system sees.
describe('fr.hive.nodeInfo', () => {
  it('returns the written line for a known node', () => {
    expect(fr.hive.nodeInfo('redacteur')).toEqual({
      name: 'Rédaction',
      description: 'Écrit le texte final, prêt à publier, pour chaque plateforme concernée.',
    })
  })

  it('falls back to a title-cased id for an unknown node, never the raw id verbatim', () => {
    const info = fr.hive.nodeInfo('nouveau_noeud')

    expect(info.name).toBe('Nouveau Noeud')
    expect(info.description).toBeTruthy()
  })

  it('never returns a name containing an underscore or dash', () => {
    for (const id of Object.keys(fr.hive.nodes)) {
      expect(fr.hive.nodeInfo(id).name).not.toMatch(/[_-]/)
    }
    expect(fr.hive.nodeInfo('some-other_id').name).not.toMatch(/[_-]/)
  })
})
