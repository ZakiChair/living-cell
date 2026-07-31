import { describe, expect, it } from 'vitest'
import {
  ATP_ARRET_TRADUCTION,
  ATP_REPOS,
  type EtatCellule,
  avancer,
  avancerDe,
  consommation,
  creerEtat,
  disponibilite,
  production,
  regimeTraduction,
} from './etatCellule.js'

/** Fait tourner le modèle un certain nombre de secondes, par pas fixes. */
function laisserTourner(etat: EtatCellule, secondes: number): void {
  const pas = Math.round(secondes * 60)
  for (let i = 0; i < pas; i++) avancer(etat)
}

describe('la cellule au repos', () => {
  it('part des valeurs de repos', () => {
    const etat = creerEtat()
    expect(etat.atp).toBe(ATP_REPOS)
    expect(etat.forceProtonMotrice).toBe(1)
    expect(etat.gradientNa).toBe(1)
  })

  /**
   * L'invariant central : une cellule qu'on laisse tranquille reste où elle
   * est. Sans lui, chaque levier serait mesuré contre une ligne de base qui
   * dérive, et aucune conclusion ne tiendrait.
   */
  it('est un point stationnaire : production et consommation s’égalent', () => {
    const etat = creerEtat()
    expect(production(etat).totale).toBeCloseTo(consommation(etat).totale, 10)
  })

  it('reste au repos après cinq minutes', () => {
    const etat = creerEtat()
    laisserTourner(etat, 300)
    expect(etat.atp).toBeCloseTo(ATP_REPOS, 2)
    expect(etat.forceProtonMotrice).toBeCloseTo(1, 2)
    expect(etat.gradientNa).toBeCloseTo(1, 2)
  })

  it('renouvelle son pool d’ATP en une trentaine de secondes', () => {
    const etat = creerEtat()
    expect(ATP_REPOS / production(etat).totale).toBeCloseTo(30, 5)
  })

  it('tire l’essentiel de son ATP de la voie oxydative', () => {
    const { glycolyse, oxydative, totale } = production(creerEtat())
    expect(glycolyse / totale).toBeCloseTo(2 / 30, 6)
    expect(oxydative / totale).toBeCloseTo(28 / 30, 6)
  })
})

describe("couper l'oxygène", () => {
  it('effondre la force proton-motrice en quelques secondes', () => {
    const etat = creerEtat()
    etat.inhibiteurs.anoxie = true
    laisserTourner(etat, 15)
    expect(etat.forceProtonMotrice).toBeLessThan(0.02)
  })

  it("fait chuter l'ATP d'un ordre de grandeur, sans le mettre à zéro", () => {
    const etat = creerEtat()
    etat.inhibiteurs.anoxie = true
    laisserTourner(etat, 240)
    // La glycolyse continue : il reste 2 ATP par glucose au lieu de 30. La
    // cellule ne meurt pas, elle s'appauvrit — c'est le fait à faire passer.
    expect(etat.atp).toBeGreaterThan(0.05)
    expect(etat.atp).toBeLessThan(ATP_REPOS / 8)
  })

  it('arrête la traduction, et c’est par là que l’atelier le sent', () => {
    const etat = creerEtat()
    etat.inhibiteurs.anoxie = true
    laisserTourner(etat, 240)
    expect(etat.atp).toBeLessThan(ATP_ARRET_TRADUCTION)
    expect(regimeTraduction(etat.atp)).toBe(0)
  })

  /**
   * Un résultat que je n'attendais pas, et qui est le bon.
   *
   * L'anoxie fait tomber l'ATP à un vingtième, et le gradient sodium ne perd
   * que 3 %. La pompe est vingt fois plus rapide que la fuite : même à 40 % de
   * régime, elle tient le gradient sans difficulté. Un manque d'énergie PARTIEL
   * n'entame donc presque pas le potentiel de membrane — seul un blocage franc
   * de la pompe l'effondre, et c'est ce que fait l'ouabaïne.
   *
   * Ce test dit ce que le modèle fait, pas ce que j'espérais qu'il fasse : il
   * avait d'abord été écrit à `< 0,95`, et c'est le modèle qui avait raison.
   */
  it('n’entame le gradient sodium que de quelques pour cent', () => {
    const etat = creerEtat()
    etat.inhibiteurs.anoxie = true
    laisserTourner(etat, 600)
    expect(etat.gradientNa).toBeLessThan(0.98)
    expect(etat.gradientNa).toBeGreaterThan(0.93)
  })

  it('est réversible : la cellule remonte quand on rend l’oxygène', () => {
    const etat = creerEtat()
    etat.inhibiteurs.anoxie = true
    laisserTourner(etat, 180)
    etat.inhibiteurs.anoxie = false
    laisserTourner(etat, 300)
    expect(etat.atp).toBeCloseTo(ATP_REPOS, 1)
    expect(etat.forceProtonMotrice).toBeCloseTo(1, 1)
    expect(etat.gradientNa).toBeCloseTo(1, 2)
  })
})

describe("l'oligomycine — l'effet contre-intuitif numéro un", () => {
  /**
   * Ce test verrouille un SIGNE, pas une valeur. Bloquer l'ATP synthase fait
   * MONTER la force proton-motrice : les complexes continuent de pomper et plus
   * rien ne laisse revenir les protons. C'est la démonstration que l'énergie
   * transite par un gradient et non par une molécule, et c'est précisément le
   * genre de résultat qu'une « correction » vers l'intuition détruirait en
   * silence. Il ne le peut plus.
   */
  it('fait MONTER la force proton-motrice au lieu de la baisser', () => {
    const etat = creerEtat()
    etat.inhibiteurs.oligomycine = true
    laisserTourner(etat, 30)
    expect(etat.forceProtonMotrice).toBeGreaterThan(1.15)
  })

  it("effondre l'ATP pendant que le gradient sature", () => {
    const etat = creerEtat()
    etat.inhibiteurs.oligomycine = true
    laisserTourner(etat, 240)
    expect(etat.atp).toBeLessThan(ATP_REPOS / 8)
    expect(etat.forceProtonMotrice).toBeGreaterThan(1)
  })

  it('se distingue de l’anoxie par le signe du gradient', () => {
    const anoxique = creerEtat()
    anoxique.inhibiteurs.anoxie = true
    const bloquee = creerEtat()
    bloquee.inhibiteurs.oligomycine = true
    laisserTourner(anoxique, 60)
    laisserTourner(bloquee, 60)
    // Même effondrement de l'ATP, gradients opposés : c'est ce qui rend les
    // deux leviers distinguables à l'œil plutôt que redondants.
    expect(anoxique.forceProtonMotrice).toBeLessThan(0.1)
    expect(bloquee.forceProtonMotrice).toBeGreaterThan(1.15)
  })
})

describe("l'ouabaïne — l'effet contre-intuitif numéro deux", () => {
  /**
   * Bloquer la pompe Na⁺/K⁺ fait MONTER l'ATP : la pompe en consommait un quart
   * à elle seule. Ce qui s'effondre, c'est le gradient. Bloquer une dépense
   * n'est pas couper un revenu — et c'est le critère de réussite que le projet
   * s'était donné, mot pour mot.
   */
  it("fait MONTER l'ATP au lieu de le faire baisser", () => {
    const etat = creerEtat()
    etat.inhibiteurs.ouabaine = true
    laisserTourner(etat, 120)
    expect(etat.atp).toBeGreaterThan(ATP_REPOS)
  })

  it('effondre le gradient sodium en quelques minutes', () => {
    const etat = creerEtat()
    etat.inhibiteurs.ouabaine = true
    laisserTourner(etat, 600)
    expect(etat.gradientNa).toBeLessThan(0.06)
  })

  it('laisse la force proton-motrice à peu près intacte', () => {
    const etat = creerEtat()
    etat.inhibiteurs.ouabaine = true
    laisserTourner(etat, 300)
    expect(etat.forceProtonMotrice).toBeGreaterThan(0.9)
  })

  it("supprime bien la dépense de la pompe, et rien d'autre", () => {
    const etat = creerEtat()
    const avant = consommation(etat)
    etat.inhibiteurs.ouabaine = true
    const apres = consommation(etat)
    expect(apres.pompe).toBe(0)
    expect(apres.base).toBeCloseTo(avant.base, 12)
    expect(apres.traduction).toBeCloseTo(avant.traduction, 12)
  })

  it('est réversible : le gradient se rétablit en quelques secondes', () => {
    const etat = creerEtat()
    etat.inhibiteurs.ouabaine = true
    laisserTourner(etat, 600)
    etat.inhibiteurs.ouabaine = false
    laisserTourner(etat, 60)
    // L'asymétrie est le fait central : la fuite dissipe en minutes, la pompe
    // rétablit en secondes. Entretenir un gradient coûte peu, mais sans arrêt.
    expect(etat.gradientNa).toBeGreaterThan(0.95)
  })
})

describe('les termes du bilan', () => {
  it('répartit la dépense en trois postes qui font le total', () => {
    const c = consommation(creerEtat())
    expect(c.pompe + c.traduction + c.base).toBeCloseTo(c.totale, 12)
  })

  it('respecte les parts annoncées du budget', () => {
    const c = consommation(creerEtat())
    expect(c.pompe / c.totale).toBeCloseTo(0.25, 6)
    expect(c.traduction / c.totale).toBeCloseTo(0.3, 6)
    expect(c.base / c.totale).toBeCloseTo(0.45, 6)
  })

  it('atténue toute dépense quand le substrat manque', () => {
    expect(disponibilite(0)).toBe(0)
    expect(disponibilite(ATP_REPOS)).toBeGreaterThan(0.9)
    expect(disponibilite(0.3)).toBeCloseTo(0.5, 6)
  })

  it('coupe la traduction sous le seuil et la rend pleine au confort', () => {
    expect(regimeTraduction(0.4)).toBe(0)
    expect(regimeTraduction(ATP_ARRET_TRADUCTION)).toBe(0)
    expect(regimeTraduction(1.25)).toBeCloseTo(0.5, 6)
    expect(regimeTraduction(2.0)).toBe(1)
    expect(regimeTraduction(ATP_REPOS)).toBe(1)
  })

  it("ne laisse jamais l'ATP passer sous zéro", () => {
    const etat = creerEtat()
    etat.inhibiteurs.anoxie = true
    etat.inhibiteurs.oligomycine = true
    laisserTourner(etat, 1800)
    expect(etat.atp).toBeGreaterThanOrEqual(0)
    expect(etat.gradientNa).toBeGreaterThanOrEqual(0)
  })
})

describe('le pas de temps', () => {
  it('est découplé de la cadence d’affichage', () => {
    // Même durée simulée, deux cadences très différentes : le résultat ne doit
    // pas dépendre de la carte graphique. C'est le défaut classique des
    // simulations de navigateur, et il se teste en trois lignes.
    const rapide = creerEtat()
    const lente = creerEtat()
    rapide.inhibiteurs.anoxie = true
    lente.inhibiteurs.anoxie = true
    for (let i = 0; i < 600; i++) avancerDe(rapide, 1 / 120)
    for (let i = 0; i < 150; i++) avancerDe(lente, 1 / 30)
    expect(rapide.atp).toBeCloseTo(lente.atp, 2)
  })

  it('borne un saut de temps, pour qu’un onglet réveillé ne fasse pas un bond', () => {
    const etat = creerEtat()
    etat.inhibiteurs.anoxie = true
    const pas = avancerDe(etat, 60)
    expect(pas).toBeLessThanOrEqual(Math.round(0.5 * 60))
  })

  it('n’est pas gelé par une cadence supérieure au pas', () => {
    // Le défaut que ce test a attrapé : à 120 images par seconde chaque image
    // apporte moins d'une durée de pas, et sans report du reliquat le moteur
    // n'avançait JAMAIS — l'état restait figé sur toute machine rapide.
    const etat = creerEtat()
    etat.inhibiteurs.anoxie = true
    for (let i = 0; i < 240; i++) avancerDe(etat, 1 / 120)
    expect(etat.atp).toBeLessThan(ATP_REPOS)
  })
})
