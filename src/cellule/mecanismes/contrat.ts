import * as THREE from 'three'
import { CENTRE_NOYAU, RAYON_NOYAU as RAYON_NOYAU_PARTAGE } from '../contrat.js'
import { placementsMitochondries } from '../organites/mitochondries.js'

/**
 * Contrat commun à tous les mécanismes cellulaires.
 *
 * Un mécanisme n'est pas un organite : c'est un PROCESSUS qui se déroule dans le
 * temps. Il porte donc deux choses qu'un organite n'a pas — un facteur temporel
 * déclaré, et une fonction d'animation.
 *
 * Le facteur est obligatoire et affiché. Les mécanismes de la cellule vivent sur
 * des échelles incompatibles : un électron traverse la chaîne respiratoire en
 * microsecondes, un ribosome pose un acide aminé en 170 millisecondes, une
 * protéine met vingt-cinq minutes à traverser le Golgi, une cassure double-brin
 * se répare en heures. Les montrer « à vitesse réelle » dans le même plan est
 * impossible, pas seulement coûteux. Ne pas l'écrire serait mentir par omission.
 */
export interface Mecanisme {
  /** Identifiant stable, minuscules sans accent. */
  cle: string
  /** Nom affiché, en français. */
  nom: string
  /** L'organite où ça se passe, pour regrouper la liste. */
  siege: string
  /**
   * Le facteur temporel, tel qu'il s'affiche : « ralenti ×1 000 », « accéléré ×100 ».
   * Toujours accompagné de sa justification dans `justificationFacteur`.
   */
  facteur: string
  /** Pourquoi ce facteur : la durée réelle, et ce qu'elle devient à l'écran. */
  justificationFacteur: string
  /**
   * Ce qui a été SAUTÉ, s'il y a lieu.
   *
   * Couper n'est pas ralentir. Une protéine de 300 acides aminés prendrait
   * dix-sept minutes d'écran même à ralenti ×20 : on coupe et on l'écrit, sinon
   * le badge et le compteur racontent deux histoires différentes.
   */
  ellision?: string
  /** Deux à quatre phrases sur ce qui se passe réellement. */
  description: string
  /** Le contenu 3D. */
  objet: THREE.Object3D
  /** Où poser la caméra pour observer : point visé et distance de recul. */
  ancre: THREE.Vector3
  /** Rayon de la scène à cadrer, en micromètres. */
  rayonCadrage: number
  /** Teinte dominante, pour la pastille de la liste. */
  couleur: number
  /** Avance le mécanisme. `temps` est en secondes écoulées depuis le début. */
  animer: (temps: number) => void
}

/**
 * Le siège d'un mécanisme mitochondrial : une vraie mitochondrie.
 *
 * L'invariant ci-dessous — « un mécanisme qui se déroule ailleurs que son
 * organite est pire qu'un mécanisme absent » — était posé et violé : les quatre
 * mécanismes mitochondriaux écrivaient des coordonnées littérales pendant que
 * les six capsules étaient tirées au hasard, si bien qu'ils se déroulaient à
 * 3,8–5,6 µm de la mitochondrie la plus proche. Ils lisent maintenant le
 * placement publié par `mitochondries.ts`.
 *
 * Chaque mécanisme prend une capsule différente. Dans la cellule, toutes les
 * mitochondries font tout ; les répartir évite qu'ils se superposent, et c'est
 * un échantillonnage, pas une division du travail.
 */
export function siegeMitochondrie(index: number): THREE.Vector3 {
  const placements = placementsMitochondries()
  return placements[index % placements.length]!.position.clone()
}

/**
 * Positions de référence partagées par les mécanismes.
 *
 * Elles doivent rester cohérentes avec les organites : un mécanisme qui se
 * déroule ailleurs que son organite est pire qu'un mécanisme absent.
 */
export const SIEGES = {
  /** Centre du noyau, lu depuis la source unique de `contrat.ts`. */
  noyau: CENTRE_NOYAU.clone(),
  /** Centre de l'appareil de Golgi. */
  golgi: new THREE.Vector3(3.2, -1.5, 0.5),
  /** Cœur du réticulum endoplasmique rugueux. */
  reticulumRugueux: new THREE.Vector3(-4, -1, 0),
  /** Cœur du réticulum endoplasmique lisse. */
  reticulumLisse: new THREE.Vector3(-3, 3, -1),
  /** Centrosome, d'où partent les microtubules. */
  centrosome: new THREE.Vector3(1.5, 2.2, 0).normalize().multiplyScalar(3.2),
} as const

/** Rayon du noyau, en micromètres. Réexporté depuis la source unique. */
export const RAYON_NOYAU = RAYON_NOYAU_PARTAGE
