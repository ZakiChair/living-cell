/**
 * Conversion entre nanomètres réels et unités de scène.
 *
 * Chaque bande d'échelle ramène son champ visible au même diamètre de scène.
 * On garde ainsi la caméra, les distances de coupe et les tolérances numériques
 * identiques d'une bande à l'autre : seule la correspondance change.
 */

/** Demi-largeur du champ visible, en unités de scène. Identique pour les trois bandes. */
export const RAYON_SCENE = 10

export type Bande = 'cellule' | 'boite' | 'macromolecule'

/** Largeur du champ visible de chaque bande, en nanomètres. */
export const CHAMPS_NM: Record<Bande, number> = {
  cellule: 20_000,
  boite: 1_000,
  macromolecule: 25,
}

/** Unités de scène par nanomètre, pour un champ visible donné. */
export function unitesParNm(champNm: number): number {
  if (!(champNm > 0)) {
    throw new Error(`champ visible invalide : ${champNm} nm (attendu strictement positif)`)
  }
  return (RAYON_SCENE * 2) / champNm
}

export function nmVersUnites(nm: number, champNm: number): number {
  return nm * unitesParNm(champNm)
}

export function unitesVersNm(unites: number, champNm: number): number {
  return unites / unitesParNm(champNm)
}
