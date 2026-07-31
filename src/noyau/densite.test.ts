import { describe, it, expect } from 'vitest'
import {
  VOLUME_COMPLEXE_NM3,
  VOLUME_MONOMERE_NM3,
  OCCUPATION_CYTOSOL,
  VOLUME_CELLULE_UM3,
  nombreObjets,
  areteTenable,
  areteCubeTenable,
  objetsPourCelluleEntiere,
} from './densite.js'

describe('constantes de référence', () => {
  it('prend un complexe reconnaissable de l’ordre du ribosome', () => {
    expect(VOLUME_COMPLEXE_NM3).toBeGreaterThanOrEqual(2_500)
    expect(VOLUME_COMPLEXE_NM3).toBeLessThanOrEqual(3_000)
  })

  it('retient une occupation dans la fourchette mesurée de 20 à 30 %', () => {
    expect(OCCUPATION_CYTOSOL).toBeGreaterThanOrEqual(0.2)
    expect(OCCUPATION_CYTOSOL).toBeLessThanOrEqual(0.3)
  })
})

describe('nombre d’objets dans une dalle', () => {
  it('donne environ 90 000 complexes par micromètre cube à 25 %', () => {
    const n = nombreObjets(1_000, 1_000, 0.25, VOLUME_COMPLEXE_NM3)
    expect(n).toBeGreaterThan(80_000)
    expect(n).toBeLessThan(100_000)
  })

  it('croît comme le carré de l’arête à profondeur fixée', () => {
    const petit = nombreObjets(500, 200, 0.25, VOLUME_COMPLEXE_NM3)
    const grand = nombreObjets(1_000, 200, 0.25, VOLUME_COMPLEXE_NM3)
    expect(grand / petit).toBeCloseTo(4, 2)
  })

  it('croît proportionnellement à la profondeur', () => {
    const mince = nombreObjets(1_000, 100, 0.25, VOLUME_COMPLEXE_NM3)
    const epaisse = nombreObjets(1_000, 300, 0.25, VOLUME_COMPLEXE_NM3)
    expect(epaisse / mince).toBeCloseTo(3, 2)
  })

  it('renvoie un entier', () => {
    expect(Number.isInteger(nombreObjets(777, 213, 0.25, VOLUME_COMPLEXE_NM3))).toBe(true)
  })

  it('refuse une occupation hors de zéro à un', () => {
    expect(() => nombreObjets(1_000, 200, 1.5, VOLUME_COMPLEXE_NM3)).toThrow(/occupation/i)
    expect(() => nombreObjets(1_000, 200, -0.1, VOLUME_COMPLEXE_NM3)).toThrow(/occupation/i)
  })
})

describe('arête tenable — dalle contre cube', () => {
  // Ces deux fonctions répondent à des questions différentes, et les confondre
  // fait varier le résultat d'un facteur 2. La dalle borne la profondeur, ce qui
  // autorise une bien plus grande étendue latérale à budget d'instances égal.

  it('reproduit la table de la spec pour un CUBE : ~1,3 µm d’arête à 200 000 objets', () => {
    const arete = areteCubeTenable(200_000, 0.25, VOLUME_COMPLEXE_NM3)
    expect(arete).toBeGreaterThanOrEqual(1_250)
    expect(arete).toBeLessThanOrEqual(1_400)
  })

  it('reproduit la table de la spec pour un cube de MONOMÈRES : ~0,37 µm', () => {
    const arete = areteCubeTenable(200_000, 0.25, VOLUME_MONOMERE_NM3)
    expect(arete).toBeGreaterThanOrEqual(330)
    expect(arete).toBeLessThanOrEqual(410)
  })

  it('donne une dalle bien plus large qu’un cube à budget égal', () => {
    const dalle = areteTenable(200_000, 300, 0.25, VOLUME_COMPLEXE_NM3)
    const cube = areteCubeTenable(200_000, 0.25, VOLUME_COMPLEXE_NM3)
    expect(dalle).toBeGreaterThan(cube * 1.8)
  })

  it('est l’inverse exact du calcul de nombre', () => {
    const arete = areteTenable(200_000, 300, 0.25, VOLUME_COMPLEXE_NM3)
    expect(nombreObjets(arete, 300, 0.25, VOLUME_COMPLEXE_NM3)).toBeLessThanOrEqual(200_000)
    expect(nombreObjets(arete + 2, 300, 0.25, VOLUME_COMPLEXE_NM3)).toBeGreaterThan(200_000)
  })

  it('rétrécit sur un budget mobile', () => {
    const bureau = areteTenable(200_000, 300, 0.25, VOLUME_COMPLEXE_NM3)
    const mobile = areteTenable(40_000, 300, 0.25, VOLUME_COMPLEXE_NM3)
    expect(mobile).toBeLessThan(bureau)
    // Budget divisé par 5 à profondeur constante : arête divisée par racine de 5.
    expect(bureau / mobile).toBeCloseTo(Math.sqrt(5), 1)
  })
})

describe('le mur qui interdit le curseur de densité à l’échelle de la cellule', () => {
  it('demande plus de cent millions de complexes pour une cellule entière', () => {
    const n = objetsPourCelluleEntiere(VOLUME_CELLULE_UM3, 0.25, VOLUME_COMPLEXE_NM3)
    expect(n).toBeGreaterThan(1e8)
  })

  it('demande plus de huit milliards de monomères pour la même cellule', () => {
    const n = objetsPourCelluleEntiere(VOLUME_CELLULE_UM3, 0.25, VOLUME_MONOMERE_NM3)
    expect(n).toBeGreaterThan(8e9)
  })

  it('dépasse le budget de rendu de trois à cinq ordres de grandeur selon l’unité rendue', () => {
    const BUDGET = 200_000
    const complexes = objetsPourCelluleEntiere(VOLUME_CELLULE_UM3, 0.25, VOLUME_COMPLEXE_NM3)
    const monomeres = objetsPourCelluleEntiere(VOLUME_CELLULE_UM3, 0.25, VOLUME_MONOMERE_NM3)
    const ordresComplexe = Math.log10(complexes / BUDGET)
    const ordresMonomere = Math.log10(monomeres / BUDGET)
    expect(ordresComplexe).toBeGreaterThan(2.5)
    expect(ordresMonomere).toBeGreaterThan(4)
    expect(ordresMonomere).toBeLessThan(5.5)
  })
})
