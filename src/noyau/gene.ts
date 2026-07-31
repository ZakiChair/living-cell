import { acideAminePourCodon, transcrire, type AcideAmine } from './codeGenetique.js'

/**
 * LE GÈNE QU'ON TRADUIT.
 *
 * Pour qu'on voie de l'ADN être traduit, il faut un ADN réel. Une séquence
 * inventée donnerait la même animation et ne vaudrait rien : l'étudiant ne
 * pourrait rien vérifier, et le site se contenterait de raconter que la
 * biologie fonctionne ainsi au lieu de le lui montrer.
 *
 * Le choix s'est porté sur la région codant la CHAÎNE B DE L'INSULINE HUMAINE,
 * pour trois raisons. Elle est courte — trente codons, quatre-vingt-dix paires
 * de bases —, alors qu'un gène humain moyen en compte des dizaines de milliers,
 * si bien qu'on peut la parcourir en entier au lieu d'en montrer un fragment.
 * Son produit est identifiable par n'importe qui. Et sa taille rend la lecture
 * codon par codon praticable : à ralenti ×20, trente codons prennent 102
 * secondes, ce qui est long mais pas absurde, et le pas à pas existe pour ça.
 */

/**
 * Source : région codante de la chaîne B du gène INS humain (préproinsuline),
 * lue dans le sens du brin codant, 5'→3'.
 *
 * NIVEAU DE CONFIANCE [A], collationné contre **NM_000207.3** (NCBI). Elle
 * était écrite de mémoire et portait un [B] ; la collation a montré 89 bases
 * justes sur 90, la seule différence étant un `TTC` au lieu de `TTT` en tête —
 * deux codons synonymes de la phénylalanine, donc invisible pour un test qui ne
 * vérifie que la protéine. Cette base est corrigée.
 *
 * L'hétérogénéité des codons est d'ailleurs la signature d'une séquence
 * authentique : les quatre leucines emploient CTG, CTG, CTC puis CTA, la sérine
 * TCA, l'arginine CGA. Une rétro-traduction depuis la protéine réemploierait le
 * même codon pour chaque acide aminé.
 *
 * DEUX choses sont garanties par les tests, et ne peuvent donc plus dériver en
 * silence : la séquence exacte, base par base, et le fait qu'elle rende la
 * chaîne B de l'insuline. Le second seul laissait passer toute mutation
 * synonyme.
 */
export const ADN_CHAINE_B =
  'TTTGTGAACCAACACCTGTGCGGCTCACACCTGGTGGAAGCTCTCTAC' +
  'CTAGTGTGCGGGGAACGAGGCTTCTTCTACACACCCAAGACC'

/** La chaîne B de l'insuline humaine, en code à une lettre. Donnée [A]. */
export const PROTEINE_ATTENDUE = 'FVNQHLCGSHLVEALYLVCGERGFFYTPKT'

export interface Gene {
  nom: string
  /** Ce que fait la protéine, en une phrase. */
  role: string
  /** Le brin codant, en ADN. */
  adn: string
  /** Le même, transcrit en ARN messager. */
  arn: string
  /** Les codons de l'ARN, dans l'ordre de lecture. */
  codons: readonly string[]
  /** Ce que chaque codon désigne. */
  residus: readonly AcideAmine[]
  /** La séquence protéique, en code à une lettre. */
  proteine: string
}

/**
 * Découpe une séquence d'ARN en codons, sans rien laisser au bord.
 *
 * Un reste non multiple de trois est une erreur d'appelant, pas un cas limite à
 * absorber : le silence ferait traduire un cadre de lecture décalé, ce qui est
 * exactement le genre de faute qu'on ne verrait jamais à l'écran.
 */
export function decouperEnCodons(arn: string): string[] {
  if (arn.length % 3 !== 0) {
    throw new Error(
      `séquence de ${arn.length} bases : pas un multiple de trois, le cadre de lecture serait décalé`,
    )
  }
  const codons: string[] = []
  for (let i = 0; i < arn.length; i += 3) codons.push(arn.slice(i, i + 3))
  return codons
}

/**
 * Traduit une séquence d'ARN.
 *
 * S'arrête au premier codon stop, comme le ribosome. Les codons qui suivent ne
 * sont pas traduits — c'est ce qui fait qu'une mutation créant un stop prématuré
 * tronque la protéine au lieu de la modifier localement.
 */
export function traduire(arn: string): { proteine: string; residus: AcideAmine[] } {
  const residus: AcideAmine[] = []
  let proteine = ''
  for (const codon of decouperEnCodons(arn)) {
    const trouve = acideAminePourCodon(codon)
    if (trouve === null) throw new Error(`codon inconnu : ${codon}`)
    if (trouve === 'stop') break
    residus.push(trouve)
    proteine += trouve.lettre
  }
  return { proteine, residus }
}

/** Assemble le gène à partir de sa seule séquence : rien n'est saisi deux fois. */
export function creerGene(): Gene {
  const arn = transcrire(ADN_CHAINE_B)
  const { proteine, residus } = traduire(arn)
  return {
    nom: "Chaîne B de l'insuline",
    role: "Moitié de l'hormone qui fait entrer le glucose dans les cellules.",
    adn: ADN_CHAINE_B,
    arn,
    codons: decouperEnCodons(arn),
    residus,
    proteine,
  }
}
