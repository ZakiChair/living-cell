import { describe, it, expect } from 'vitest'
import { creerCompteur } from './metrologie.js'

/** Injecte n fois la même durée d'image. */
function alimenter(compteur: ReturnType<typeof creerCompteur>, ms: number, n: number): void {
  for (let i = 0; i < n; i++) compteur.ajouter(ms)
}

describe('moyenne glissante', () => {
  it('vaut zéro tant qu’aucun échantillon n’est arrivé', () => {
    expect(creerCompteur().moyenne()).toBe(0)
    expect(creerCompteur().nombreEchantillons()).toBe(0)
  })

  it('moyenne les échantillons reçus', () => {
    const c = creerCompteur({ taille: 4 })
    c.ajouter(10)
    c.ajouter(20)
    expect(c.moyenne()).toBeCloseTo(15, 10)
  })

  it('oublie les échantillons au-delà de sa fenêtre', () => {
    const c = creerCompteur({ taille: 3 })
    alimenter(c, 100, 3)
    alimenter(c, 10, 3)
    expect(c.moyenne()).toBeCloseTo(10, 10)
    expect(c.nombreEchantillons()).toBe(3)
  })

  it('convertit en images par seconde', () => {
    const c = creerCompteur({ taille: 4 })
    alimenter(c, 16.666, 4)
    expect(c.imagesParSeconde()).toBeCloseTo(60, 1)
  })

  it('renvoie zéro image par seconde sans échantillon plutôt que l’infini', () => {
    expect(creerCompteur().imagesParSeconde()).toBe(0)
  })
})

describe('verdict avec hystérésis', () => {
  it('reste stable tant que la fenêtre n’est pas pleine', () => {
    const c = creerCompteur({ taille: 8 })
    alimenter(c, 50, 3)
    expect(c.verdict()).toBe('stable')
  })

  it('demande à dégrader au-dessus du seuil haut', () => {
    const c = creerCompteur({ taille: 4 })
    alimenter(c, 25, 4)
    expect(c.verdict()).toBe('degrader')
  })

  it('demande à améliorer sous le seuil bas, mais seulement après la patience', () => {
    const c = creerCompteur({ taille: 4, patience: 10 })
    alimenter(c, 8, 4)
    expect(c.verdict()).toBe('stable')
    alimenter(c, 8, 6)
    expect(c.verdict()).toBe('ameliorer')
  })

  it('ne bascule pas entre les deux seuils', () => {
    const c = creerCompteur({ taille: 4, seuilHaut: 20, seuilBas: 12 })
    alimenter(c, 16, 4)
    expect(c.verdict()).toBe('stable')
  })

  it('remet la patience à zéro dès qu’une image dépasse le seuil bas', () => {
    const c = creerCompteur({ taille: 2, patience: 5 })
    alimenter(c, 8, 6)
    expect(c.verdict()).toBe('ameliorer')
    c.ajouter(30)
    c.ajouter(30)
    expect(c.verdict()).toBe('degrader')
    alimenter(c, 8, 2)
    expect(c.verdict()).toBe('stable')
  })
})
