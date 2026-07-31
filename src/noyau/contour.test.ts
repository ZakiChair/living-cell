import { describe, it, expect } from 'vitest'
import { offsetContour, projection11 } from './contour.js'

describe('élément [1][1] de la projection', () => {
  it('vaut 1 / tan(fov / 2)', () => {
    expect(projection11(90)).toBeCloseTo(1, 10)
    expect(projection11(50)).toBeCloseTo(1 / Math.tan((25 * Math.PI) / 180), 10)
  })

  it('décroît quand le champ de vision s’élargit', () => {
    expect(projection11(30)).toBeGreaterThan(projection11(90))
  })
})

describe('offset de contour à largeur constante à l’écran', () => {
  const p11 = projection11(50)

  it('croît proportionnellement à la distance', () => {
    const proche = offsetContour(-10, 2, 1000, p11)
    const loin = offsetContour(-20, 2, 1000, p11)
    expect(loin / proche).toBeCloseTo(2, 10)
  })

  it('croît proportionnellement à la largeur demandée', () => {
    const fin = offsetContour(-10, 1, 1000, p11)
    const epais = offsetContour(-10, 3, 1000, p11)
    expect(epais / fin).toBeCloseTo(3, 10)
  })

  it('décroît quand l’écran gagne en hauteur de pixels', () => {
    const petit = offsetContour(-10, 2, 500, p11)
    const grand = offsetContour(-10, 2, 1000, p11)
    expect(petit / grand).toBeCloseTo(2, 10)
  })

  it('donne une valeur positive pour un point devant la caméra', () => {
    // En espace vue, un objet visible a un z négatif.
    expect(offsetContour(-10, 2, 1000, p11)).toBeGreaterThan(0)
  })

  it('vaut la valeur attendue sur un cas de référence chiffré', () => {
    // z = -10, 2 px demandés, écran de 1000 px, champ de 50 degrés.
    // offset = 10 * 2 * 2 / (1000 * 2,14450692) = 0,01865...
    expect(offsetContour(-10, 2, 1000, p11)).toBeCloseTo(0.0186524, 6)
  })

  it('est nul si aucune largeur n’est demandée', () => {
    expect(offsetContour(-10, 0, 1000, p11)).toBe(0)
  })
})
