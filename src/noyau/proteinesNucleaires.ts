/**
 * QUI TRAVAILLE DANS LE NOYAU.
 *
 * Le site montrait « la machinerie nucléaire » : des masses anonymes entre
 * les nucléosomes. Or ces masses ont des noms, des comptes et des métiers —
 * et c'est ce qui distingue un noyau d'un sac de fibres. Les abondances sont
 * des ordres de grandeur par noyau diploïde humain [B], sauf les histones,
 * qui se déduisent du compte de nucléosomes [A].
 */

export type FamilleNucleaire =
  | 'empaquetage'
  | 'charpente'
  | 'lecture'
  | 'maturation'
  | 'organisation'
  | 'porte'

export interface ProteineNucleaire {
  /** Nom court, tel qu'un article l'écrit. */
  nom: string
  famille: FamilleNucleaire
  /** Exemplaires par noyau. Ordre de grandeur. */
  exemplaires: number
  /** Diamètre apparent du complexe, en nanomètres. */
  tailleNm: number
  /** Ce qu'elle fait, en une phrase — c'est ce que la fiche affiche. */
  role: string
}

export const PROTEINES_NUCLEAIRES: readonly ProteineNucleaire[] = Object.freeze([
  {
    nom: 'Histones (octamère H2A·H2B·H3·H4)',
    famille: 'empaquetage',
    exemplaires: 31_000_000,
    tailleNm: 11,
    role: "Le palet autour duquel 147 paires de bases s'enroulent 1,7 fois. C'est la protéine la plus abondante du noyau, et de loin : deux mètres d'ADN n'entrent pas autrement dans six micromètres.",
  },
  {
    nom: 'Histone H1 (de liaison)',
    famille: 'empaquetage',
    exemplaires: 15_000_000,
    tailleNm: 6,
    role: "Elle scelle l'entrée et la sortie de l'ADN sur le nucléosome et empile la fibre : c'est elle qui fait passer le collier de perles à la fibre compacte.",
  },
  {
    nom: 'Lamines A/C et B',
    famille: 'charpente',
    exemplaires: 12_000_000,
    tailleNm: 4,
    role: "Le feutrage de filaments intermédiaires qui double la membrane nucléaire interne : la vraie charpente du noyau. Elle ancre l'hétérochromatine muette contre l'enveloppe, et ses mutations donnent les laminopathies — dont la progéria.",
  },
  {
    nom: 'ARN polymérase II',
    famille: 'lecture',
    exemplaires: 300_000,
    tailleNm: 14,
    role: "Celle qui copie les gènes en ARN messager. Elle ne travaille jamais seule : il faut une vingtaine de facteurs pour l'installer sur un promoteur.",
  },
  {
    nom: 'ARN polymérase I',
    famille: 'lecture',
    exemplaires: 40_000,
    tailleNm: 15,
    role: "Confinée au nucléole, elle ne lit qu'une chose — l'ARN ribosomique — mais elle en fait plus de la moitié de tout l'ARN de la cellule.",
  },
  {
    nom: 'ARN polymérase III',
    famille: 'lecture',
    exemplaires: 40_000,
    tailleNm: 13,
    role: 'Elle transcrit les ARN de transfert et les petits ARN : les outils, pas les messages.',
  },
  {
    nom: 'PDX1',
    famille: 'lecture',
    exemplaires: 40_000,
    tailleNm: 4,
    role: "Le facteur de transcription MAÎTRE de la cellule bêta : il allume le gène de l'insuline et maintient l'identité de la cellule. Sa perte progressive est un mécanisme du diabète de type 2 ; sa mutation donne le MODY 4.",
  },
  {
    nom: 'MAFA',
    famille: 'lecture',
    exemplaires: 25_000,
    tailleNm: 4,
    role: "Il se lie à l'élément C1 du promoteur de l'insuline et rend la transcription sensible au glucose. Il disparaît le premier quand la cellule est glucotoxique.",
  },
  {
    nom: 'NEUROD1',
    famille: 'lecture',
    exemplaires: 25_000,
    tailleNm: 4,
    role: "Le troisième du trio qui commande le gène INS, avec PDX1 et MAFA. À eux trois, ils décident qu'une cellule est une cellule bêta.",
  },
  {
    nom: 'Spliceosome (U1, U2, U4/U6·U5)',
    famille: 'maturation',
    exemplaires: 200_000,
    tailleNm: 27,
    role: "Il découpe les introns du pré-messager et recoud les exons. Il s'assemble de zéro sur chaque intron, et se défait après.",
  },
  {
    nom: 'Nucléoline',
    famille: 'maturation',
    exemplaires: 3_000_000,
    tailleNm: 7,
    role: "La protéine la plus abondante du nucléole : elle accompagne l'ARN ribosomique de sa naissance à son assemblage en ribosome.",
  },
  {
    nom: 'CTCF',
    famille: 'organisation',
    exemplaires: 200_000,
    tailleNm: 5,
    role: "Le poseur de bornes du génome : il marque les bords des boucles d'ADN, et c'est lui qui décide quel activateur a le droit d'atteindre quel gène.",
  },
  {
    nom: 'Cohésine',
    famille: 'organisation',
    exemplaires: 150_000,
    tailleNm: 40,
    role: "Un anneau qui fait glisser l'ADN à travers lui pour former les boucles — et qui, en mitose, tient les deux chromatides sœurs jusqu'à ce que la séparase le coupe.",
  },
  {
    nom: 'Topoisomérase II',
    famille: 'organisation',
    exemplaires: 400_000,
    tailleNm: 12,
    role: "Elle coupe l'ADN, laisse passer un autre brin, et recoud : sans elle, la vrille que pousse chaque polymérase bloquerait tout. Cible de l'étoposide et de la doxorubicine.",
  },
  {
    nom: 'Complexe du pore nucléaire',
    famille: 'porte',
    exemplaires: 3_000,
    tailleNm: 120,
    role: "La plus grosse machine de la cellule : une trentaine de nucléoporines en huit exemplaires. Seule porte du noyau, dans les deux sens. Les 120 nm sont ceux du complexe entier, filaments compris ; l'anneau cytoplasmique que la scène dessine en fait une centaine.",
  },
  {
    nom: 'Importine β / Ran',
    famille: 'porte',
    exemplaires: 1_000_000,
    tailleNm: 9,
    role: "La navette qui fait entrer les protéines munies du bon signal, et le gradient de RanGTP qui donne au pore sa direction — car le pore, lui, est symétrique.",
  },
])

/** Les protéines d'une famille donnée. */
export function familleNucleaire(famille: FamilleNucleaire): ProteineNucleaire[] {
  return PROTEINES_NUCLEAIRES.filter((p) => p.famille === famille)
}

/** Total d'exemplaires, toutes familles : le noyau n'est pas un espace vide. */
export const EXEMPLAIRES_TOTAUX = PROTEINES_NUCLEAIRES.reduce(
  (somme, p) => somme + p.exemplaires,
  0,
)
