/**
 * LE CODE GÉNÉTIQUE STANDARD.
 *
 * Source : table standard du code génétique (NCBI translation table 1), telle
 * qu'elle est universellement tabulée. Niveau de confiance [A] — c'est l'une des
 * données les mieux établies de la biologie, et elle est vérifiable ligne à
 * ligne par n'importe quel lecteur.
 *
 * Ce fichier est la raison pour laquelle « voir se traduire l'ADN » signifie
 * quelque chose plutôt que d'être décoratif. Sans lui, une animation de
 * traduction montre des grains génériques qui s'accumulent ; avec lui, la
 * séquence DÉTERMINE la protéine, et l'étudiant peut lire le codon sous le
 * ribosome puis vérifier lui-même l'acide aminé qui en sort.
 *
 * Deux choses que les tables de manuel escamotent, et qui sont ici visibles :
 *
 * 1. LE CODE EST REDONDANT, MAIS PAS UNIFORMÉMENT. La leucine et la sérine ont
 *    six codons, le tryptophane et la méthionine un seul. Ce n'est pas un
 *    détail : une mutation sur le troisième nucléotide d'un codon de leucine est
 *    presque toujours muette, la même sur le codon du tryptophane ne l'est
 *    jamais.
 * 2. AUG EST À LA FOIS UN CODON D'INITIATION ET LE CODON DE LA MÉTHIONINE. Le
 *    ribosome ne distingue pas les deux par la séquence, mais par le contexte.
 */

/** Une des quatre classes chimiques qui gouvernent le repliement. */
export type ClasseAcideAmine = 'apolaire' | 'polaire' | 'basique' | 'acide'

export interface AcideAmine {
  /** Le code à une lettre, celui qui s'écrit dans une séquence. */
  lettre: string
  /** Le code à trois lettres, celui qui se lit à voix haute. */
  abrege: string
  /** Le nom français. */
  nom: string
  classe: ClasseAcideAmine
}

/**
 * Teintes des quatre classes, prises dans la palette Okabe-Ito du projet.
 *
 * Une teinte par CLASSE et jamais par acide aminé : vingt teintes distinctes ne
 * seraient discriminables par personne, et ce que la chaîne naissante doit faire
 * voir, c'est l'alternance des caractères chimiques — c'est elle qui décide du
 * repliement, pas l'identité de chaque résidu.
 */
export const TEINTES_CLASSE: Record<ClasseAcideAmine, number> = {
  apolaire: 0xe69f00,
  polaire: 0x56b4e9,
  basique: 0x0072b2,
  acide: 0xd55e00,
}

/** Ce qui met fin à la traduction. Trois codons, aucun acide aminé. */
export const CODON_STOP = 'stop'

const ACIDES: Record<string, AcideAmine> = {
  A: { lettre: 'A', abrege: 'Ala', nom: 'Alanine', classe: 'apolaire' },
  C: { lettre: 'C', abrege: 'Cys', nom: 'Cystéine', classe: 'polaire' },
  D: { lettre: 'D', abrege: 'Asp', nom: 'Acide aspartique', classe: 'acide' },
  E: { lettre: 'E', abrege: 'Glu', nom: 'Acide glutamique', classe: 'acide' },
  F: { lettre: 'F', abrege: 'Phe', nom: 'Phénylalanine', classe: 'apolaire' },
  G: { lettre: 'G', abrege: 'Gly', nom: 'Glycine', classe: 'apolaire' },
  H: { lettre: 'H', abrege: 'His', nom: 'Histidine', classe: 'basique' },
  I: { lettre: 'I', abrege: 'Ile', nom: 'Isoleucine', classe: 'apolaire' },
  K: { lettre: 'K', abrege: 'Lys', nom: 'Lysine', classe: 'basique' },
  L: { lettre: 'L', abrege: 'Leu', nom: 'Leucine', classe: 'apolaire' },
  M: { lettre: 'M', abrege: 'Met', nom: 'Méthionine', classe: 'apolaire' },
  N: { lettre: 'N', abrege: 'Asn', nom: 'Asparagine', classe: 'polaire' },
  P: { lettre: 'P', abrege: 'Pro', nom: 'Proline', classe: 'apolaire' },
  Q: { lettre: 'Q', abrege: 'Gln', nom: 'Glutamine', classe: 'polaire' },
  R: { lettre: 'R', abrege: 'Arg', nom: 'Arginine', classe: 'basique' },
  S: { lettre: 'S', abrege: 'Ser', nom: 'Sérine', classe: 'polaire' },
  T: { lettre: 'T', abrege: 'Thr', nom: 'Thréonine', classe: 'polaire' },
  V: { lettre: 'V', abrege: 'Val', nom: 'Valine', classe: 'apolaire' },
  W: { lettre: 'W', abrege: 'Trp', nom: 'Tryptophane', classe: 'apolaire' },
  Y: { lettre: 'Y', abrege: 'Tyr', nom: 'Tyrosine', classe: 'polaire' },
}

/**
 * Les 64 codons de l'ARN, dans l'ordre canonique des tables.
 *
 * L'ordre des bases est U, C, A, G — celui de toutes les tables imprimées
 * depuis Nirenberg. Le garder permet de vérifier ce fichier d'un coup d'œil
 * contre n'importe quel manuel, ce qui est le seul contrôle qu'un lecteur non
 * programmeur puisse exercer sur lui.
 */
const TABLE: Record<string, string> = {
  UUU: 'F', UUC: 'F', UUA: 'L', UUG: 'L',
  UCU: 'S', UCC: 'S', UCA: 'S', UCG: 'S',
  UAU: 'Y', UAC: 'Y', UAA: CODON_STOP, UAG: CODON_STOP,
  UGU: 'C', UGC: 'C', UGA: CODON_STOP, UGG: 'W',

  CUU: 'L', CUC: 'L', CUA: 'L', CUG: 'L',
  CCU: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  CAU: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
  CGU: 'R', CGC: 'R', CGA: 'R', CGG: 'R',

  AUU: 'I', AUC: 'I', AUA: 'I', AUG: 'M',
  ACU: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  AAU: 'N', AAC: 'N', AAA: 'K', AAG: 'K',
  AGU: 'S', AGC: 'S', AGA: 'R', AGG: 'R',

  GUU: 'V', GUC: 'V', GUA: 'V', GUG: 'V',
  GCU: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  GAU: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  GGU: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
}

/** Tous les codons, dans l'ordre de la table. */
export const CODONS: readonly string[] = Object.keys(TABLE)

/**
 * Ce qu'un codon d'ARN désigne : un acide aminé, ou l'arrêt.
 *
 * Renvoie `null` pour tout ce qui n'est pas un codon d'ARN de trois lettres —
 * un appelant qui passe de l'ADN par mégarde doit s'en apercevoir, pas obtenir
 * un résultat plausible.
 */
export function acideAminePourCodon(codon: string): AcideAmine | 'stop' | null {
  const lettre = TABLE[codon.toUpperCase()]
  if (lettre === undefined) return null
  if (lettre === CODON_STOP) return 'stop'
  return ACIDES[lettre] ?? null
}

/** L'acide aminé d'un code à une lettre. */
export function acideAmine(lettre: string): AcideAmine | null {
  return ACIDES[lettre.toUpperCase()] ?? null
}

/**
 * Transcrit un brin codant d'ADN en ARN.
 *
 * C'est la seule différence d'alphabet entre les deux : la thymine devient
 * uracile. Le brin MATRICE, lui, est le complémentaire — la polymérase le lit à
 * l'envers pour produire une copie du brin codant, ce qui est la raison pour
 * laquelle on écrit toujours les gènes dans le sens du brin codant.
 */
export function transcrire(adn: string): string {
  return adn.toUpperCase().replace(/T/g, 'U')
}

/**
 * L'anticodon porté par l'ARN de transfert qui lit ce codon.
 *
 * Complémentaire et ANTIPARALLÈLE : le codon est lu 5'→3', l'anticodon
 * s'apparie 3'→5', et on l'écrit ensuite dans son propre sens 5'→3'. D'où
 * l'inversion, que les schémas oublient une fois sur deux.
 */
export function anticodon(codon: string): string {
  const complement: Record<string, string> = { A: 'U', U: 'A', G: 'C', C: 'G' }
  return [...codon.toUpperCase()]
    .map((base) => complement[base] ?? '?')
    .reverse()
    .join('')
}
