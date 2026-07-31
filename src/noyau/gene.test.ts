import { describe, expect, it } from 'vitest'
import {
  ADN_CHAINE_B,
  PROTEINE_ATTENDUE,
  creerGene,
  decouperEnCodons,
  traduire,
} from './gene.js'
import { transcrire } from './codeGenetique.js'

describe("le gène de la chaîne B de l'insuline", () => {
  it('fait 90 bases, soit 30 codons entiers', () => {
    expect(ADN_CHAINE_B).toHaveLength(90)
    expect(ADN_CHAINE_B.length % 3).toBe(0)
  })

  it("n'emploie que les quatre bases de l'ADN", () => {
    expect(ADN_CHAINE_B).toMatch(/^[ATGC]+$/)
  })

  /**
   * LA SÉQUENCE EST ÉPINGLÉE BASE PAR BASE.
   *
   * Le test de traduction ne suffisait pas : le code génétique est redondant,
   * donc toute mutation SYNONYME — `CTC` en `CTA`, deux leucines — le laissait
   * vert. L'ADN affiché à l'écran pouvait cesser d'être celui du gène humain
   * sans que rien ne le signale, et c'est précisément par là qu'un `TTC` s'était
   * glissé à la place du `TTT` initial.
   *
   * La chaîne ci-dessous est celle de NM_000207.3, recopiée depuis la collation
   * et non depuis le module qu'elle contrôle.
   */
  it('reproduit exactement la séquence de NM_000207.3, base par base', () => {
    expect(ADN_CHAINE_B).toBe(
      'TTTGTGAACCAACACCTGTGCGGCTCACACCTGGTGGAAGCTCTCTAC' +
        'CTAGTGTGCGGGGAACGAGGCTTCTTCTACACACCCAAGACC',
    )
  })

  /**
   * LE TEST QUI PORTE TOUT LE RESTE.
   *
   * C'est lui qui garantit que ce que l'atelier montre à l'écran est de la
   * biologie et non du décor : ces quatre-vingt-dix bases, passées par la table
   * standard, doivent rendre exactement la chaîne B de l'insuline humaine. Une
   * faute de frappe dans la séquence, une erreur dans la table des codons, une
   * inversion du sens de lecture — chacune casse ce test.
   */
  it("traduit exactement en la chaîne B de l'insuline humaine", () => {
    const { proteine } = traduire(transcrire(ADN_CHAINE_B))
    expect(proteine).toBe(PROTEINE_ATTENDUE)
    expect(proteine).toBe('FVNQHLCGSHLVEALYLVCGERGFFYTPKT')
    expect(proteine).toHaveLength(30)
  })

  it('ne contient aucun codon stop qui tronquerait la chaîne', () => {
    // Si un stop s'y glissait, la traduction s'arrêterait avant les 30 résidus
    // et le test précédent échouerait — mais avec un message bien moins clair.
    const { residus } = traduire(transcrire(ADN_CHAINE_B))
    expect(residus).toHaveLength(30)
  })

  it('porte les deux cystéines qui font les ponts avec la chaîne A', () => {
    // Positions 7 et 19 de la chaîne B : ce sont elles qui la relient à la
    // chaîne A dans l'hormone mûre. C'est un contrôle indépendant de la
    // séquence, sur un fait qu'un lecteur peut vérifier ailleurs.
    expect(PROTEINE_ATTENDUE[6]).toBe('C')
    expect(PROTEINE_ATTENDUE[18]).toBe('C')
  })

  it('assemble un gène cohérent avec lui-même', () => {
    const gene = creerGene()
    expect(gene.arn).toBe(transcrire(gene.adn))
    expect(gene.codons).toHaveLength(30)
    expect(gene.residus).toHaveLength(30)
    expect(gene.proteine).toBe(PROTEINE_ATTENDUE)
    // Le premier codon TTT → UUU → phénylalanine.
    expect(gene.codons[0]).toBe('UUU')
    expect(gene.residus[0]?.nom).toBe('Phénylalanine')
    expect(gene.residus[0]?.classe).toBe('apolaire')
  })
})

describe('la traduction', () => {
  it('découpe sans rien laisser au bord', () => {
    expect(decouperEnCodons('AUGGCC')).toEqual(['AUG', 'GCC'])
  })

  it('refuse un cadre de lecture décalé au lieu de le tronquer en silence', () => {
    // Absorber le reste ferait traduire un cadre décalé — une faute qu'on ne
    // verrait jamais à l'écran, seulement une protéine différente.
    expect(() => decouperEnCodons('AUGGC')).toThrow(/cadre de lecture/)
  })

  it('s’arrête au premier codon stop, comme le ribosome', () => {
    const { proteine } = traduire('AUGGCCUAAGGGCCC')
    expect(proteine).toBe('MA')
  })

  it('signale un codon inconnu plutôt que de le sauter', () => {
    expect(() => traduire('AUGTTT')).toThrow(/codon inconnu/)
  })
})
