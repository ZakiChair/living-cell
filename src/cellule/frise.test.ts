import { describe, expect, it } from 'vitest'
import { creerMecanismes } from './mecanismes/tous.js'
import { formaterDuree, graduations, pointsDeFrise } from './frise.js'

describe('la frise des horloges', () => {
  const points = pointsDeFrise(creerMecanismes())

  it('porte tous les mécanismes mesurables, et rien d’autre', () => {
    const mesurables = creerMecanismes().filter((m) => m.observable)
    expect(points).toHaveLength(mesurables.length)
    expect(points.length).toBeGreaterThanOrEqual(14)
  })

  it('est triée du cycle le plus bref au plus long, de 0 à 1', () => {
    for (let i = 1; i < points.length; i++) {
      expect(points[i]!.cycleReel).toBeGreaterThanOrEqual(points[i - 1]!.cycleReel)
      expect(points[i]!.x).toBeGreaterThanOrEqual(points[i - 1]!.x)
    }
    expect(points[0]!.x).toBe(0)
    expect(points[points.length - 1]!.x).toBe(1)
  })

  it('couvre au moins cinq ordres de grandeur — la raison d’être du site', () => {
    const rapport = points[points.length - 1]!.cycleReel / points[0]!.cycleReel
    expect(Math.log10(rapport)).toBeGreaterThan(5)
  })

  it('la position est bien logarithmique : un facteur 10 = un pas constant', () => {
    const minLog = Math.log10(points[0]!.cycleReel)
    const maxLog = Math.log10(points[points.length - 1]!.cycleReel)
    for (const p of points) {
      const attendu = (Math.log10(p.cycleReel) - minLog) / (maxLog - minLog)
      expect(Math.abs(p.x - attendu)).toBeLessThan(1e-9)
    }
  })

  it('les graduations tombent sur les décennies, dans les bornes', () => {
    const ticks = graduations(points)
    expect(ticks.length).toBeGreaterThanOrEqual(5)
    for (const t of ticks) {
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.x).toBeLessThanOrEqual(1)
    }
  })

  it('écrit les durées comme on les dit', () => {
    expect(formaterDuree(0.0077)).toBe('7,7 ms')
    expect(formaterDuree(0.36)).toBe('360 ms')
    expect(formaterDuree(45)).toBe('45 s')
    expect(formaterDuree(1200)).toBe('20 min')
    expect(formaterDuree(3600)).toBe('1 h')
  })
})
