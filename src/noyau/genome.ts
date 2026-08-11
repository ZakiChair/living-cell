/**
 * LE PATRIMOINE GÉNÉTIQUE, EN CHIFFRES VÉRIFIABLES.
 *
 * Le site montrait de la « chromatine » : des fibres et un semis de
 * nucléosomes, justes de forme mais anonymes. Or le génome n'est pas une
 * pelote indistincte — c'est un inventaire précis, et chaque chromosome
 * occupe son propre TERRITOIRE dans le noyau. Ce module porte les données ;
 * les scènes les lisent.
 *
 * Tailles GRCh38, en mégabases. Confiance [A] : ce sont des longueurs de
 * séquence de référence, pas des estimations.
 */

export interface Chromosome {
  /** Nom court, tel qu'un caryotype l'écrit. */
  nom: string
  /** Longueur de la séquence de référence, en mégabases (GRCh38). */
  megabases: number
  /**
   * Position relative du centromère (0 = début du bras court, 1 = fin du
   * bras long). C'est elle qui distingue un chromosome métacentrique d'un
   * acrocentrique — le trait qui permet de les reconnaître sur une planche.
   */
  centromere: number
}

/**
 * Les 24 entités du génome humain : 22 autosomes, X et Y. Une cellule
 * somatique en porte 46 — deux exemplaires de chaque autosome, et XX ou XY.
 */
export const CHROMOSOMES: readonly Chromosome[] = Object.freeze([
  { nom: '1', megabases: 248.96, centromere: 0.50 },
  { nom: '2', megabases: 242.19, centromere: 0.38 },
  { nom: '3', megabases: 198.30, centromere: 0.45 },
  { nom: '4', megabases: 190.21, centromere: 0.26 },
  { nom: '5', megabases: 181.54, centromere: 0.27 },
  { nom: '6', megabases: 170.81, centromere: 0.35 },
  { nom: '7', megabases: 159.35, centromere: 0.38 },
  { nom: '8', megabases: 145.14, centromere: 0.31 },
  { nom: '9', megabases: 138.39, centromere: 0.34 },
  { nom: '10', megabases: 133.80, centromere: 0.30 },
  { nom: '11', megabases: 135.09, centromere: 0.40 },
  { nom: '12', megabases: 133.28, centromere: 0.27 },
  { nom: '13', megabases: 114.36, centromere: 0.15 },
  { nom: '14', megabases: 107.04, centromere: 0.16 },
  { nom: '15', megabases: 101.99, centromere: 0.19 },
  { nom: '16', megabases: 90.34, centromere: 0.40 },
  { nom: '17', megabases: 83.26, centromere: 0.29 },
  { nom: '18', megabases: 80.37, centromere: 0.22 },
  { nom: '19', megabases: 58.62, centromere: 0.44 },
  { nom: '20', megabases: 64.44, centromere: 0.43 },
  { nom: '21', megabases: 46.71, centromere: 0.27 },
  { nom: '22', megabases: 50.82, centromere: 0.29 },
  { nom: 'X', megabases: 156.04, centromere: 0.39 },
  { nom: 'Y', megabases: 57.23, centromere: 0.19 },
])

/** Nombre de chromosomes d'une cellule somatique humaine. */
export const NOMBRE_DIPLOIDE = 46

/** Paires de bases du génome haploïde de référence, en mégabases. */
export const TAILLE_HAPLOIDE_MB = CHROMOSOMES.reduce((somme, c) => somme + c.megabases, 0)

/**
 * Longueur physique de l'ADN d'une cellule diploïde, en mètres.
 * 0,34 nm par paire de bases — la montée de la double hélice B.
 */
export const LONGUEUR_ADN_M = 2 * TAILLE_HAPLOIDE_MB * 1e6 * 0.34e-9

/** Gènes codant des protéines. Confiance [B] : le compte varie selon l'annotation. */
export const GENES_CODANTS = 19_900

/**
 * Nucléosomes d'un noyau diploïde : 6,2 Gb rangées par paquets de 147 pb
 * enroulées, avec ~50 pb d'espaceur — soit ~200 pb par nucléosome.
 */
export const NUCLEOSOMES = Math.round((2 * TAILLE_HAPLOIDE_MB * 1e6) / 200)

/** Où se trouve un gène : le fait que les schémas de manuel ne donnent jamais. */
export interface Locus {
  gene: string
  /** Nom du chromosome porteur. */
  chromosome: string
  /** Bande cytogénétique, comme un généticien l'écrit. */
  bande: string
  /** Position du début, en mégabases depuis le début du chromosome (GRCh38). */
  debutMb: number
  /** Longueur du gène, en paires de bases. */
  longueurPb: number
  /** Brin lu : +1 ou −1. */
  brin: 1 | -1
  /** Ce que le gène fait, en une phrase. */
  role: string
}

/**
 * Les gènes que ce site nomme. INS d'abord : c'est LUI que la cellule
 * transcrit, traduit, replie et sécrète dans toutes les autres scènes — et
 * jusqu'ici on ne disait jamais où il est.
 */
export const LOCI: readonly Locus[] = Object.freeze([
  {
    gene: 'INS',
    chromosome: '11',
    bande: '11p15.5',
    debutMb: 2.159,
    longueurPb: 1431,
    brin: -1,
    role: "L'insuline. Tout près du télomère du bras court, voisin d'IGF2 et de TH.",
  },
  {
    gene: 'GCK',
    chromosome: '7',
    bande: '7p13',
    debutMb: 44.145,
    longueurPb: 45_168,
    brin: -1,
    role: 'La glucokinase, le capteur de glucose. Ses mutations donnent le MODY 2.',
  },
  {
    gene: 'KCNJ11',
    chromosome: '11',
    bande: '11p15.1',
    debutMb: 17.385,
    longueurPb: 3_355,
    brin: -1,
    role: 'Kir6.2, le pore du canal K-ATP — la cible des sulfonylurées.',
  },
  {
    gene: 'ABCC8',
    chromosome: '11',
    bande: '11p15.1',
    debutMb: 17.392,
    longueurPb: 84_100,
    brin: -1,
    role: 'SUR1, la sous-unité régulatrice du canal K-ATP, collée à KCNJ11.',
  },
  {
    gene: 'PDX1',
    chromosome: '13',
    bande: '13q12.2',
    debutMb: 27.919,
    longueurPb: 6_197,
    brin: 1,
    role: "Le facteur de transcription maître de la cellule bêta : sans lui, pas d'identité.",
  },
])

/** Le locus d'un gène nommé, ou `undefined`. */
export function locusDe(gene: string): Locus | undefined {
  return LOCI.find((l) => l.gene === gene)
}

/**
 * Fraction du chromosome qu'occupe un gène — le chiffre qui remet les
 * schémas de manuel à leur place : INS est 94 000 fois plus petit que le
 * chromosome qui le porte.
 */
export function fractionDuChromosome(locus: Locus): number {
  const porteur = CHROMOSOMES.find((c) => c.nom === locus.chromosome)
  if (!porteur) return 0
  return locus.longueurPb / (porteur.megabases * 1e6)
}
