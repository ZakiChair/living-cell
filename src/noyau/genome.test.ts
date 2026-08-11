import { describe, expect, it } from 'vitest'
import {
  CHROMOSOMES,
  GENES_CODANTS,
  LOCI,
  LONGUEUR_ADN_M,
  NOMBRE_DIPLOIDE,
  NUCLEOSOMES,
  TAILLE_HAPLOIDE_MB,
  fractionDuChromosome,
  locusDe,
} from './genome.js'
import {
  EXEMPLAIRES_TOTAUX,
  PROTEINES_NUCLEAIRES,
  familleNucleaire,
} from './proteinesNucleaires.js'

describe('le caryotype humain', () => {
  it('compte 24 entités et 46 chromosomes', () => {
    expect(CHROMOSOMES).toHaveLength(24)
    expect(NOMBRE_DIPLOIDE).toBe(46)
    expect(CHROMOSOMES.map((c) => c.nom)).toContain('X')
    expect(CHROMOSOMES.map((c) => c.nom)).toContain('Y')
  })

  it('donne un génome haploïde de ~3,1 milliards de bases', () => {
    expect(TAILLE_HAPLOIDE_MB).toBeGreaterThan(3000)
    expect(TAILLE_HAPLOIDE_MB).toBeLessThan(3200)
  })

  it('les autosomes décroissent en taille, aux trois inversions près que la séquence a révélées', () => {
    const autosomes = CHROMOSOMES.filter((c) => /^\d+$/.test(c.nom))
    expect(autosomes).toHaveLength(22)
    // La numérotation date de la cytogénétique, où l'on mesurait des
    // chromosomes CONDENSÉS au microscope — et la condensation n'est pas la
    // longueur. Le séquençage a révélé TROIS inversions, jamais corrigées
    // pour ne pas réécrire un siècle de littérature : 11 > 10, 20 > 19, et
    // 22 > 21. Cette dernière importe en clinique : le 21 est le plus petit
    // de tous, et c'est pourquoi sa trisomie est la plus viable — elle
    // ajoute le plus petit lot de gènes possible.
    const inversions = new Set(['11', '20', '22'])
    for (let i = 1; i < autosomes.length; i++) {
      const precedent = autosomes[i - 1]!
      const courant = autosomes[i]!
      if (inversions.has(courant.nom)) continue
      expect(
        courant.megabases,
        `chr${courant.nom} (${courant.megabases}) vs chr${precedent.nom}`,
      ).toBeLessThanOrEqual(precedent.megabases)
    }
    expect(CHROMOSOMES.find((c) => c.nom === '21')!.megabases).toBeLessThan(
      CHROMOSOMES.find((c) => c.nom === '22')!.megabases,
    )
    expect(CHROMOSOMES.find((c) => c.nom === '11')!.megabases).toBeGreaterThan(
      CHROMOSOMES.find((c) => c.nom === '10')!.megabases,
    )
    expect(CHROMOSOMES.find((c) => c.nom === '20')!.megabases).toBeGreaterThan(
      CHROMOSOMES.find((c) => c.nom === '19')!.megabases,
    )
  })

  it('deux mètres d’ADN par cellule, et trente millions de nucléosomes', () => {
    expect(LONGUEUR_ADN_M).toBeGreaterThan(1.9)
    expect(LONGUEUR_ADN_M).toBeLessThan(2.2)
    expect(NUCLEOSOMES).toBeGreaterThan(28e6)
    expect(NUCLEOSOMES).toBeLessThan(34e6)
    expect(GENES_CODANTS).toBeGreaterThan(19_000)
    expect(GENES_CODANTS).toBeLessThan(21_000)
  })
})

describe('les gènes que le site nomme', () => {
  it('tous les loci se posent sur un chromosome existant, dans ses bornes', () => {
    for (const locus of LOCI) {
      const porteur = CHROMOSOMES.find((c) => c.nom === locus.chromosome)
      expect(porteur, `chromosome de ${locus.gene}`).toBeDefined()
      expect(locus.debutMb).toBeGreaterThan(0)
      expect(locus.debutMb).toBeLessThan(porteur!.megabases)
      expect(locus.bande.startsWith(locus.chromosome)).toBe(true)
    }
  })

  it('INS est au bout du bras court du chromosome 11', () => {
    const ins = locusDe('INS')!
    expect(ins.chromosome).toBe('11')
    expect(ins.bande).toBe('11p15.5')
    // Bras court du 11 : centromère à 40 % de 135 Mb, soit 54 Mb. À 2,16 Mb,
    // INS est dans les deux premiers pour cent — tout près du télomère.
    expect(ins.debutMb).toBeLessThan(0.05 * 135)
    expect(ins.brin).toBe(-1)
  })

  it('INS est cent mille fois plus petit que son chromosome', () => {
    const fraction = fractionDuChromosome(locusDe('INS')!)
    expect(1 / fraction).toBeGreaterThan(50_000)
    expect(1 / fraction).toBeLessThan(150_000)
  })

  it('KCNJ11 et ABCC8 sont voisins — les deux moitiés du canal K-ATP', () => {
    const kir = locusDe('KCNJ11')!
    const sur = locusDe('ABCC8')!
    expect(kir.chromosome).toBe(sur.chromosome)
    expect(Math.abs(kir.debutMb - sur.debutMb)).toBeLessThan(0.1)
  })
})

describe("qui travaille dans le noyau", () => {
  it('nomme au moins quinze protéines, chacune avec un rôle écrit', () => {
    expect(PROTEINES_NUCLEAIRES.length).toBeGreaterThanOrEqual(15)
    for (const p of PROTEINES_NUCLEAIRES) {
      expect(p.role.length, p.nom).toBeGreaterThan(60)
      expect(p.exemplaires).toBeGreaterThan(0)
      expect(p.tailleNm).toBeGreaterThan(0)
    }
  })

  it('les histones dominent, comme dans un vrai noyau', () => {
    const histones = PROTEINES_NUCLEAIRES.find((p) => p.nom.startsWith('Histones'))!
    const empaquetage = familleNucleaire('empaquetage').reduce((s, p) => s + p.exemplaires, 0)
    expect(empaquetage).toBeGreaterThan(0.5 * EXEMPLAIRES_TOTAUX)
    expect(histones.exemplaires).toBeGreaterThan(10 * 300_000)
    // Un octamère par nucléosome, à un facteur deux près.
    expect(histones.exemplaires / NUCLEOSOMES).toBeGreaterThan(0.5)
    expect(histones.exemplaires / NUCLEOSOMES).toBeLessThan(2)
  })

  it('le trio de la cellule bêta est là', () => {
    const noms = PROTEINES_NUCLEAIRES.map((p) => p.nom)
    expect(noms).toContain('PDX1')
    expect(noms).toContain('MAFA')
    expect(noms).toContain('NEUROD1')
  })

  it('chaque famille est peuplée', () => {
    for (const famille of ['empaquetage', 'charpente', 'lecture', 'maturation', 'organisation', 'porte'] as const) {
      expect(familleNucleaire(famille).length, famille).toBeGreaterThan(0)
    }
  })

  it('le pore est la plus grosse machine, et de loin', () => {
    const plusGrosse = [...PROTEINES_NUCLEAIRES].sort((a, b) => b.tailleNm - a.tailleNm)[0]!
    expect(plusGrosse.nom).toContain('pore')
    expect(plusGrosse.tailleNm).toBeGreaterThan(2 * 40)
  })
})
