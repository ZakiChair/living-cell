import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { construireDossier } from './dossierRelecture.js'
import { creerMecanismes } from '../src/cellule/mecanismes/tous.js'
import { ADN_CHAINE_B } from '../src/noyau/gene.js'

/**
 * LE DOSSIER DE RELECTURE NE PEUT PAS ÊTRE PÉRIMÉ.
 *
 * La relecture par un biologiste est une condition de livraison, et le dossier
 * qui la rend possible n'aurait aucune valeur s'il décrivait un produit
 * d'avant-hier. Or c'est exactement le défaut que ce projet a répété partout :
 * la revue du 31 juillet le résume en une phrase — « la partie écrite a continué
 * d'avancer pendant que la partie exécutée partait ailleurs, sans que rien ne
 * signale l'écart ».
 *
 * Ici, quelque chose le signale.
 */
describe('le dossier de relecture scientifique', () => {
  const chemin = fileURLToPath(new URL('../docs/relecture-scientifique.md', import.meta.url))

  it('est à jour du produit', () => {
    const commite = readFileSync(chemin, 'utf8')
    const attendu = construireDossier()
    expect(
      commite === attendu,
      'le dossier commité ne correspond plus aux fiches livrées. ' +
        'Régénérer : npx tsx outils/dossierRelecture.ts > docs/relecture-scientifique.md',
    ).toBe(true)
  })

  it('couvre les seize mécanismes, sans en oublier un', () => {
    const dossier = construireDossier()
    const oublies = creerMecanismes().filter((m) => !dossier.includes(m.nom))
    expect(oublies.map((m) => m.nom), 'mécanismes absents du dossier').toEqual([])
  })

  it("porte la séquence d'ADN exacte, celle qu'un relecteur doit collationner", () => {
    const dossier = construireDossier()
    // Le dossier la coupe en lignes de soixante : on ôte les retours pour
    // comparer à la séquence continue.
    const sequences = dossier.match(/```\n([ATGC\n]+)\n```/)?.[1]?.replace(/\n/g, '')
    expect(sequences).toBe(ADN_CHAINE_B)
  })

  it('demande explicitement les trois questions au relecteur', () => {
    const dossier = construireDossier()
    expect(dossier).toContain('Est-ce faux ?')
    expect(dossier).toContain('Est-ce trompeur ?')
    expect(dossier).toContain("Manque-t-il l'essentiel ?")
  })

  it("dit ce qu'il ne couvre pas", () => {
    // Un dossier qui laisserait croire à l'exhaustivité serait pire qu'aucun :
    // les proportions et les cinétiques relatives ne se relisent qu'à l'écran.
    expect(construireDossier()).toContain('Ce que le relecteur ne verra pas ici')
  })
})
