import { describe, expect, it } from 'vitest'
import {
  type Atelier,
  DUREE_CODON,
  LIAISONS_PAR_ACIDE_AMINE,
  LIAISONS_PAR_NUCLEOTIDE,
  RALENTI_BASE,
  avancement,
  avancerAtelier,
  avancerDUnCodon,
  codonCourant,
  coutTotal,
  creerAtelier,
  donnerAuRibosome,
  facteurAffiche,
  ouvrirLeGene,
  proteinePartielle,
} from './atelier.js'
import { PROTEINE_ATTENDUE } from './gene.js'
import { creerEtat, regimeTraduction } from './etatCellule.js'

/** Fait tourner l'atelier à plein régime, par pas de 1/60 s. */
function tourner(atelier: Atelier, secondes: number, regime = 1): void {
  const pas = Math.round(secondes * 60)
  for (let i = 0; i < pas; i++) avancerAtelier(atelier, 1 / 60, regime)
}

/** Mène l'atelier jusqu'à l'étape voulue, ou échoue au bout d'une limite. */
function menerJusqua(atelier: Atelier, etape: Atelier['etape'], limite = 600): void {
  ouvrirLeGene(atelier)
  for (let i = 0; i < limite * 60 && atelier.etape !== etape; i++) {
    avancerAtelier(atelier, 1 / 60, 1)
  }
  expect(atelier.etape, `n'a pas atteint « ${etape} »`).toBe(etape)
}

describe('la chaîne du gène', () => {
  it('part au repos, sans rien de transcrit ni de dépensé', () => {
    const a = creerAtelier()
    expect(a.etape).toBe('repos')
    expect(a.bases).toBe(0)
    expect(a.codons).toBe(0)
    expect(a.liaisons).toBe(0)
    expect(avancement(a)).toBe(0)
  })

  it('ne bouge pas tant que l’utilisateur n’ouvre pas le gène', () => {
    const a = creerAtelier()
    tourner(a, 60)
    expect(a.etape).toBe('repos')
    expect(a.bases).toBe(0)
  })

  it('traverse les étapes dans l’ordre, et jamais autrement', () => {
    const a = creerAtelier()
    const vues: string[] = []
    ouvrirLeGene(a)
    for (let i = 0; i < 400 * 60; i++) {
      if (vues[vues.length - 1] !== a.etape) vues.push(a.etape)
      if (a.etape === 'attente') donnerAuRibosome(a)
      avancerAtelier(a, 1 / 60, 1)
      if (a.etape === 'termine') break
    }
    if (vues[vues.length - 1] !== a.etape) vues.push(a.etape)
    expect(vues).toEqual([
      'transcription',
      'coiffe',
      'export',
      'attente',
      'traduction',
      'termine',
    ])
  })

  it('transcrit les 90 bases du gène', () => {
    const a = creerAtelier()
    menerJusqua(a, 'coiffe')
    expect(a.bases).toBe(90)
  })
})

describe('donner le brin au ribosome', () => {
  /**
   * LE TEST QUI DONNE SA PORTÉE AU GESTE.
   *
   * Sans ce refus, l'utilisateur regarderait une animation qui se déroulerait de
   * toute façon, et « donner le brin » ne serait qu'un bouton décoratif. La
   * règle vit ici, dans du code testé, et non dans la scène 3D — une refonte
   * visuelle ne peut donc pas la perdre en silence.
   */
  it('est refusé à toute étape sauf l’attente', () => {
    const a = creerAtelier()
    expect(donnerAuRibosome(a)).toBe(false)
    ouvrirLeGene(a)
    expect(a.etape).toBe('transcription')
    expect(donnerAuRibosome(a)).toBe(false)
    menerJusqua(creerAtelier(), 'coiffe')
  })

  it('ne traduit RIEN tant que le brin n’a pas été déposé', () => {
    const a = creerAtelier()
    menerJusqua(a, 'attente')
    tourner(a, 300)
    expect(a.etape).toBe('attente')
    expect(a.codons).toBe(0)
    expect(proteinePartielle(a)).toBe('')
  })

  it('déclenche la traduction, et une seule fois', () => {
    const a = creerAtelier()
    menerJusqua(a, 'attente')
    expect(donnerAuRibosome(a)).toBe(true)
    expect(a.etape).toBe('traduction')
    expect(donnerAuRibosome(a)).toBe(false)
  })
})

describe('la traduction', () => {
  it("produit exactement la chaîne B de l'insuline", () => {
    const a = creerAtelier()
    menerJusqua(a, 'attente')
    donnerAuRibosome(a)
    tourner(a, 30 * DUREE_CODON + 5)
    expect(a.etape).toBe('termine')
    expect(proteinePartielle(a)).toBe(PROTEINE_ATTENDUE)
  })

  it('avance codon par codon, jamais entre deux', () => {
    const a = creerAtelier()
    menerJusqua(a, 'attente')
    donnerAuRibosome(a)
    for (let i = 0; i < 400; i++) {
      avancerAtelier(a, 1 / 60, 1)
      expect(Number.isInteger(a.codons)).toBe(true)
    }
  })

  it('donne le codon courant, et il correspond au résidu suivant', () => {
    const a = creerAtelier()
    menerJusqua(a, 'attente')
    donnerAuRibosome(a)
    // Le premier codon est TTT → UUU, la phénylalanine qui ouvre la chaîne.
    expect(codonCourant(a)).toBe('UUU')
    expect(a.gene.proteine[0]).toBe('F')
    tourner(a, DUREE_CODON * 3 + 0.1)
    expect(a.codons).toBe(3)
    expect(codonCourant(a)).toBe(a.gene.codons[3])
  })

  it('ne rend aucun codon hors de la traduction', () => {
    const a = creerAtelier()
    expect(codonCourant(a)).toBeNull()
    menerJusqua(a, 'attente')
    expect(codonCourant(a)).toBeNull()
  })

  it('avance d’un seul codon en pas à pas, et pas tout seul', () => {
    const a = creerAtelier()
    menerJusqua(a, 'attente')
    donnerAuRibosome(a)
    a.pasAPas = true
    tourner(a, 60)
    expect(a.codons).toBe(0)
    expect(avancerDUnCodon(a)).toBe(true)
    expect(a.codons).toBe(1)
    tourner(a, 60)
    expect(a.codons).toBe(1)
  })
})

describe("le coût, en liaisons riches", () => {
  it('vaut 300 pour une chaîne B : 180 pour transcrire, 120 pour traduire', () => {
    const a = creerAtelier()
    expect(90 * LIAISONS_PAR_NUCLEOTIDE).toBe(180)
    expect(30 * LIAISONS_PAR_ACIDE_AMINE).toBe(120)
    expect(coutTotal(a.gene)).toBe(300)
  })

  it('est effectivement compté au fil de la chaîne, sans en perdre', () => {
    const a = creerAtelier()
    menerJusqua(a, 'attente')
    expect(a.liaisons).toBe(180)
    donnerAuRibosome(a)
    tourner(a, 30 * DUREE_CODON + 5)
    expect(a.liaisons).toBe(300)
    expect(a.liaisons).toBe(coutTotal(a.gene))
  })
})

describe('le couplage avec l’état de la cellule', () => {
  /**
   * La boucle qui fait de l'atelier et des leviers un système plutôt que deux
   * jouets. Le régime vient de l'ATP, et à zéro le ribosome se fige.
   */
  it('se fige quand le régime tombe à zéro', () => {
    const a = creerAtelier()
    menerJusqua(a, 'attente')
    donnerAuRibosome(a)
    tourner(a, DUREE_CODON * 2 + 0.1)
    const fige = a.codons
    expect(fige).toBeGreaterThan(0)
    tourner(a, 300, 0)
    expect(a.codons).toBe(fige)
  })

  it('reprend où il en était quand le régime remonte', () => {
    const a = creerAtelier()
    menerJusqua(a, 'attente')
    donnerAuRibosome(a)
    tourner(a, DUREE_CODON * 2 + 0.1)
    const fige = a.codons
    tourner(a, 120, 0)
    tourner(a, DUREE_CODON * 2 + 0.1, 1)
    expect(a.codons).toBe(fige + 2)
  })

  it('avance à demi-régime quand l’ATP est à mi-course', () => {
    const plein = creerAtelier()
    const demi = creerAtelier()
    for (const a of [plein, demi]) {
      menerJusqua(a, 'attente')
      donnerAuRibosome(a)
    }
    tourner(plein, DUREE_CODON * 4, 1)
    tourner(demi, DUREE_CODON * 4, 0.5)
    expect(demi.codons).toBe(Math.floor(plein.codons / 2))
  })

  it('reçoit un régime plein d’une cellule au repos', () => {
    expect(regimeTraduction(creerEtat().atp)).toBe(1)
  })
})

describe('le badge temporel', () => {
  /**
   * Exigence D3 de la spec, jamais honorée jusqu'ici : le badge est CALCULÉ à
   * partir de la vitesse effective, il ne peut donc pas diverger de ce que
   * l'animation fait. C'est le défaut qui a produit un « accéléré ×5 » sur un
   * ralenti ×5,4 dans la bêta-oxydation.
   */
  it('annonce le ralenti de référence à vitesse nominale', () => {
    const a = creerAtelier()
    expect(a.vitesse).toBe(1)
    expect(facteurAffiche(a)).toBe(`ralenti ×${RALENTI_BASE}`)
  })

  it('suit la vitesse quand on l’augmente, au lieu de rester écrit', () => {
    const a = creerAtelier()
    a.vitesse = 5
    expect(facteurAffiche(a)).toBe('ralenti ×4,0')
    a.vitesse = 20
    expect(facteurAffiche(a)).toBe('temps réel')
    a.vitesse = 40
    expect(facteurAffiche(a)).toBe('accéléré ×2,0')
  })

  it('ne se contredit jamais sur le signe', () => {
    const a = creerAtelier()
    for (const v of [0.5, 1, 2, 5, 10, 19, 20, 25, 60]) {
      a.vitesse = v
      const badge = facteurAffiche(a)
      const reel = RALENTI_BASE / v
      if (reel > 1.05) expect(badge, `v=${v}`).toMatch(/^ralenti/)
      else if (reel < 0.95) expect(badge, `v=${v}`).toMatch(/^accéléré/)
      else expect(badge, `v=${v}`).toBe('temps réel')
    }
  })
})

describe("l'avancement affiché", () => {
  it('croît sans jamais reculer, du début à la fin', () => {
    const a = creerAtelier()
    ouvrirLeGene(a)
    let precedent = avancement(a)
    for (let i = 0; i < 400 * 60; i++) {
      if (a.etape === 'attente') donnerAuRibosome(a)
      avancerAtelier(a, 1 / 60, 1)
      const courant = avancement(a)
      expect(courant).toBeGreaterThanOrEqual(precedent - 1e-9)
      precedent = courant
      if (a.etape === 'termine') break
    }
    expect(precedent).toBe(1)
  })
})

describe('recommencer', () => {
  it('remet tout à zéro, y compris la dépense', () => {
    const a = creerAtelier()
    menerJusqua(a, 'attente')
    donnerAuRibosome(a)
    tourner(a, 30 * DUREE_CODON + 5)
    expect(a.etape).toBe('termine')
    expect(ouvrirLeGene(a)).toBe(true)
    expect(a.etape).toBe('transcription')
    expect(a.codons).toBe(0)
    expect(a.liaisons).toBe(0)
  })

  it('refuse de repartir au milieu d’une chaîne en cours', () => {
    const a = creerAtelier()
    menerJusqua(a, 'attente')
    expect(ouvrirLeGene(a)).toBe(false)
    expect(a.etape).toBe('attente')
  })
})
