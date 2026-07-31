import * as THREE from 'three'
import type { Organite } from './contrat.js'

/**
 * LE GRAIN DU CYTOSOL, ET CE QU'IL N'A PAS LE DROIT DE TOUCHER.
 *
 * Le peuplement moléculaire est superbe de loin et illisible de près : trois
 * gestes de l'interface l'éclaircissent donc — le curseur, le gros plan sur un
 * mécanisme, l'entrée dans l'atelier.
 *
 * LA BOÎTE DE VÉRITÉ EN EST EXCLUE, et c'est la raison d'être de ce module.
 * Elle est le seul endroit du site où la densité est celle de la biologie ;
 * c'est ce que sa fiche promet, et c'est sa seule fonction. La spec du projet
 * avait anticipé le geste au mot près : « quand le budget manque, on rétrécit
 * la dalle, JAMAIS sa densité — ce serait exactement la malhonnêteté que tout
 * le reste combat. » Elle y était pourtant, et deux réglages automatiques la
 * vidaient à son insu.
 *
 * La règle vit ici, hors de `main.ts`, pour qu'un test puisse la vérifier sur
 * la géométrie réelle plutôt que sur le contenu d'un ensemble de chaînes.
 */

/** L'organite dont la densité ne se négocie pas. */
export const CLE_BOITE_DE_VERITE = 'boite-de-verite'

/**
 * Les amas que l'interface a le droit d'éclaircir.
 *
 * Ce sont les peuplements de fond : le voile du cytosol, le contenu des
 * matrices, les ribosomes libres, les nucléosomes, la machinerie nucléaire.
 * Aucun d'eux ne prétend à l'exactitude quantitative — leurs fiches déclarent
 * toutes une réduction de plusieurs ordres de grandeur.
 */
const CLES_ECLAIRCISSABLES = new Set([
  'voile-cytosol',
  'matrice-mitochondriale',
  'ribosomes-libres',
  'nucleosomes',
  'machinerie-nucleaire',
])

export interface AmasEclaircissable {
  maillage: THREE.InstancedMesh
  /** Nombre d'instances à pleine densité, retenu une fois pour toutes. */
  plein: number
}

/**
 * Recense les amas éclaircissables parmi les organites posés.
 *
 * `InstancedMesh.count` limite le nombre d'instances dessinées sans rien
 * réallouer : l'éclaircissement ne coûte donc rien, et il est réversible à
 * l'exact.
 */
export function recenserAmas(organites: Organite[]): AmasEclaircissable[] {
  const amas: AmasEclaircissable[] = []
  for (const organite of organites) {
    if (!CLES_ECLAIRCISSABLES.has(organite.cle)) continue
    organite.objet.traverse((noeud) => {
      const maillage = noeud as THREE.InstancedMesh
      if (maillage.isInstancedMesh) amas.push({ maillage, plein: maillage.count })
    })
  }
  return amas
}

/** Applique une fraction de grain, de 0 (rien) à 1 (plein). */
export function reglerGrain(amas: AmasEclaircissable[], fraction: number): void {
  const borne = fraction < 0 ? 0 : fraction > 1 ? 1 : fraction
  for (const { maillage, plein } of amas) {
    maillage.count = Math.round(plein * borne)
  }
}
