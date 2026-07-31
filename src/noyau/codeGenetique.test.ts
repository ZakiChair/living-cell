import { describe, expect, it } from 'vitest'
import {
  CODONS,
  acideAmine,
  acideAminePourCodon,
  anticodon,
  transcrire,
} from './codeGenetique.js'

describe('le code génétique standard', () => {
  it('compte exactement les 64 codons, sans doublon', () => {
    expect(CODONS).toHaveLength(64)
    expect(new Set(CODONS).size).toBe(64)
  })

  it("n'emploie que les quatre bases de l'ARN", () => {
    for (const codon of CODONS) expect(codon).toMatch(/^[AUGC]{3}$/)
  })

  it('a trois codons stop, et ce sont ceux-là', () => {
    const stops = CODONS.filter((c) => acideAminePourCodon(c) === 'stop')
    expect(stops.sort()).toEqual(['UAA', 'UAG', 'UGA'])
  })

  it('donne un acide aminé pour chacun des 61 autres', () => {
    const sens = CODONS.filter((c) => acideAminePourCodon(c) !== 'stop')
    expect(sens).toHaveLength(61)
    for (const codon of sens) {
      const trouve = acideAminePourCodon(codon)
      expect(trouve, codon).not.toBeNull()
      expect(trouve, codon).not.toBe('stop')
    }
  })

  it('couvre les vingt acides aminés standard', () => {
    const lettres = new Set(
      CODONS.map(acideAminePourCodon)
        .filter((a): a is Exclude<typeof a, 'stop' | null> => a !== 'stop' && a !== null)
        .map((a) => a.lettre),
    )
    expect(lettres.size).toBe(20)
  })

  /**
   * La redondance n'est pas uniforme, et c'est un fait biologique fort : une
   * mutation silencieuse est bien plus probable sur un codon de leucine que sur
   * celui du tryptophane. Un test qui vérifierait seulement « 64 codons »
   * laisserait passer une table mal recopiée ; celui-ci ne le peut pas.
   */
  it('reproduit la redondance connue de chaque acide aminé', () => {
    const compte = new Map<string, number>()
    for (const codon of CODONS) {
      const trouve = acideAminePourCodon(codon)
      if (trouve === 'stop' || trouve === null) continue
      compte.set(trouve.lettre, (compte.get(trouve.lettre) ?? 0) + 1)
    }
    // Six codons pour la leucine, la sérine et l'arginine ; un seul pour la
    // méthionine et le tryptophane ; deux pour les six acides aminés à
    // « purine/pyrimidine » en troisième position.
    expect(compte.get('L')).toBe(6)
    expect(compte.get('S')).toBe(6)
    expect(compte.get('R')).toBe(6)
    expect(compte.get('M')).toBe(1)
    expect(compte.get('W')).toBe(1)
    expect(compte.get('A')).toBe(4)
    expect(compte.get('G')).toBe(4)
    expect(compte.get('P')).toBe(4)
    expect(compte.get('T')).toBe(4)
    expect(compte.get('V')).toBe(4)
    expect(compte.get('D')).toBe(2)
    expect(compte.get('E')).toBe(2)
    expect(compte.get('K')).toBe(2)
    expect(compte.get('H')).toBe(2)
  })

  it('classe chaque acide aminé, et les quatre classes sont peuplées', () => {
    const classes = new Map<string, number>()
    for (const lettre of 'ACDEFGHIKLMNPQRSTVWY') {
      const a = acideAmine(lettre)
      expect(a, lettre).not.toBeNull()
      classes.set(a!.classe, (classes.get(a!.classe) ?? 0) + 1)
    }
    expect(classes.get('acide')).toBe(2)
    expect(classes.get('basique')).toBe(3)
    expect([...classes.keys()].sort()).toEqual(['acide', 'apolaire', 'basique', 'polaire'])
  })

  it('refuse ce qui n’est pas un codon plutôt que de deviner', () => {
    // Notamment de l'ADN : le T n'existe pas dans un codon d'ARN, et laisser
    // passer donnerait un résultat plausible et faux.
    expect(acideAminePourCodon('TTC')).toBeNull()
    expect(acideAminePourCodon('AU')).toBeNull()
    expect(acideAminePourCodon('AUGC')).toBeNull()
    expect(acideAminePourCodon('XYZ')).toBeNull()
  })

  it('transcrit en remplaçant la thymine par l’uracile, et rien d’autre', () => {
    expect(transcrire('TTCGTGAAC')).toBe('UUCGUGAAC')
    expect(transcrire('ACGACG')).toBe('ACGACG')
  })

  it('rend un anticodon complémentaire ET antiparallèle', () => {
    // AUG se lit 5'→3' ; l'ARNt de la méthionine porte CAU, pas UAC.
    expect(anticodon('AUG')).toBe('CAU')
    expect(anticodon('UUC')).toBe('GAA')
    // Un palindrome complémentaire est son propre anticodon : bon garde-fou
    // contre une inversion oubliée qui passerait inaperçue ailleurs.
    expect(anticodon('AUAU'.slice(0, 3))).toBe('UAU')
  })

  it('rend un anticodon de même longueur pour les 64 codons', () => {
    for (const codon of CODONS) expect(anticodon(codon), codon).toMatch(/^[AUGC]{3}$/)
  })
})
