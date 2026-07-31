import { describe, it, expect } from 'vitest'
import { CHAMPS_NM, RAYON_SCENE, nmVersUnites, unitesVersNm, unitesParNm } from './echelles.js'

describe('champs des trois bandes', () => {
  it('couvre trois ordres de grandeur, de la cellule à la macromolécule', () => {
    expect(CHAMPS_NM.cellule).toBe(20_000)
    expect(CHAMPS_NM.boite).toBe(1_000)
    expect(CHAMPS_NM.macromolecule).toBe(25)
  })
})

describe('conversion nanomètres vers unités de scène', () => {
  it('fait tenir le champ entier dans le diamètre de la scène', () => {
    expect(nmVersUnites(CHAMPS_NM.boite, CHAMPS_NM.boite)).toBeCloseTo(RAYON_SCENE * 2, 10)
  })

  it('rend un ribosome de 25 nm plein cadre dans la bande macromolécule', () => {
    expect(nmVersUnites(25, CHAMPS_NM.macromolecule)).toBeCloseTo(RAYON_SCENE * 2, 10)
  })

  it('rend le même ribosome 800 fois plus petit dans la bande cellule', () => {
    const dansMacro = nmVersUnites(25, CHAMPS_NM.macromolecule)
    const dansCellule = nmVersUnites(25, CHAMPS_NM.cellule)
    expect(dansMacro / dansCellule).toBeCloseTo(800, 6)
  })

  it('garde une membrane de 5 nm visible dans la bande boîte', () => {
    // 5 nm sur un champ de 1000 nm = 0,5 % du champ : fin mais dessinable.
    expect(nmVersUnites(5, CHAMPS_NM.boite)).toBeCloseTo(RAYON_SCENE * 2 * 0.005, 10)
  })
})

describe('aller-retour', () => {
  it('revient à la valeur de départ pour chaque bande', () => {
    for (const champ of Object.values(CHAMPS_NM)) {
      expect(unitesVersNm(nmVersUnites(137, champ), champ)).toBeCloseTo(137, 6)
    }
  })
})

describe('facteur d’échelle', () => {
  it('est inversement proportionnel à la largeur du champ', () => {
    expect(unitesParNm(1_000) / unitesParNm(20_000)).toBeCloseTo(20, 10)
  })

  it('refuse un champ nul ou négatif plutôt que de renvoyer l’infini', () => {
    expect(() => unitesParNm(0)).toThrow(/champ/i)
    expect(() => unitesParNm(-5)).toThrow(/champ/i)
  })
})
