/**
 * Arithmétique de l'encombrement moléculaire.
 *
 * C'est ce calcul qui a montré qu'un curseur de densité à l'échelle de la
 * cellule entière est physiquement infaisable : une cellule mammifère demande
 * entre 10⁸ et 10¹⁰ objets là où le budget de rendu en autorise ~2 × 10⁵.
 * L'encombrement vrai n'existe donc que dans une dalle sub-micronique.
 */

/**
 * Volume d'un complexe reconnaissable, en nm³ (ordre du ribosome).
 *
 * L'unité rendue retenue est le complexe qui a une silhouette identifiable,
 * pas le monomère : la silhouette porte l'information. Ce choix change le
 * volume finançable d'un facteur 60.
 */
export const VOLUME_COMPLEXE_NM3 = 2_750

/** Volume d'un monomère d'environ 50 kDa, en nm³. L'autre lecture possible. */
export const VOLUME_MONOMERE_NM3 = 60

/** Fraction volumique du cytosol occupée par des macromolécules (20 à 30 % mesurés). */
export const OCCUPATION_CYTOSOL = 0.25

/**
 * Volume de la cellule RENDUE, en µm³.
 *
 * Déduit du rayon de la scène, et non choisi : trois chiffres coexistaient pour
 * la même cellule — 2 000 ici, 4 000 dans la fiche de l'atelier, 4 189 dans la
 * sphère effectivement dessinée. Une cellule mammifère fait de 1 000 à
 * 10 000 µm³ selon le type, donc les trois étaient plausibles ; aucun n'était
 * celui du produit.
 */
export const RAYON_CELLULE_UM = 10
export const VOLUME_CELLULE_UM3 = (4 / 3) * Math.PI * RAYON_CELLULE_UM ** 3

/**
 * Volume moyen d'un peuplement mêlé, pondéré par les parts de chaque famille.
 *
 * C'est le chiffre qui manquait, et son absence a produit le défaut le plus
 * grave du produit. Le budget de la boîte de vérité était calculé avec
 * `VOLUME_COMPLEXE_NM3` — 2 750 nm³, le volume d'un ribosome — alors que le
 * peuplement livré est fait à 55 % de grains de 5 nm, qui en font 21. Le
 * volume moyen réel est de l'ordre de 430 nm³, six fois moins, si bien que la
 * boîte annonçait 25 % d'occupation pour 3,9 % mesurés.
 *
 * On ne devine donc plus : on pèse ce qu'on sème.
 */
export function volumeMoyenPondere(
  familles: ReadonlyArray<{ part: number; volumeNm3: number }>,
): number {
  let sommeParts = 0
  let sommeVolumes = 0
  for (const { part, volumeNm3 } of familles) {
    if (!(part >= 0) || !(volumeNm3 > 0)) {
      throw new Error(`famille invalide : part ${part}, volume ${volumeNm3} nm³`)
    }
    sommeParts += part
    sommeVolumes += part * volumeNm3
  }
  if (!(sommeParts > 0)) throw new Error('aucune famille peuplée')
  return sommeVolumes / sommeParts
}

function verifierOccupation(occupation: number): void {
  if (!(occupation > 0 && occupation <= 1)) {
    throw new Error(`occupation invalide : ${occupation} (attendu entre 0 exclu et 1 inclus)`)
  }
}

/** Nombre d'objets à instancier pour remplir une dalle à l'occupation voulue. */
export function nombreObjets(
  areteNm: number,
  profondeurNm: number,
  occupation: number,
  volumeObjetNm3: number,
): number {
  verifierOccupation(occupation)
  return Math.floor((areteNm * areteNm * profondeurNm * occupation) / volumeObjetNm3)
}

/**
 * Plus grande arête LATÉRALE d'une dalle de profondeur donnée, pour un budget
 * d'instances. C'est la grandeur qui compte pour la boîte de vérité : borner la
 * profondeur est ce qui rend l'encombrement finançable, puisqu'au-delà de la
 * première couche plus de 99 % des instances sont occultées.
 */
export function areteTenable(
  budgetObjets: number,
  profondeurNm: number,
  occupation: number,
  volumeObjetNm3: number,
): number {
  verifierOccupation(occupation)
  const surface = (budgetObjets * volumeObjetNm3) / (occupation * profondeurNm)
  return Math.floor(Math.sqrt(surface))
}

/**
 * Arête d'un CUBE tenable pour un budget d'instances — la grandeur citée dans
 * la table de la spec. À ne pas confondre avec `areteTenable` : à budget égal,
 * une dalle de 300 nm de profondeur est environ deux fois plus large qu'un cube.
 */
export function areteCubeTenable(
  budgetObjets: number,
  occupation: number,
  volumeObjetNm3: number,
): number {
  verifierOccupation(occupation)
  return Math.floor(Math.cbrt((budgetObjets * volumeObjetNm3) / occupation))
}

/** Nombre d'objets qu'exigerait une cellule entière — le chiffre du mur. */
export function objetsPourCelluleEntiere(
  volumeCelluleUm3: number,
  occupation: number,
  volumeObjetNm3: number,
): number {
  verifierOccupation(occupation)
  const volumeNm3 = volumeCelluleUm3 * 1e9 // 1 µm³ = 10⁹ nm³
  return Math.floor((volumeNm3 * occupation) / volumeObjetNm3)
}
