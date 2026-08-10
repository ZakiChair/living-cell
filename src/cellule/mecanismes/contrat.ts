import * as THREE from 'three'
import type { ContexteCellule } from '../../noyau/contexte.js'
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
   * LE FACTEUR TEMPOREL, EN NOMBRE — et le badge s'en déduit.
   *
   * Plus grand que 1 : la scène est RALENTIE d'autant. Plus petit : accélérée.
   * Un tableau pour les rares scènes à deux temps.
   *
   * C'est un nombre, et non la phrase affichée, parce que la phrase écrite à la
   * main a menti. La bêta-oxydation a longtemps annoncé « accéléré ×5 » pour un
   * ralenti ×5, et le test censé l'empêcher laissait passer l'inversion : il
   * vérifiait que le mot figurait dans le badge, jamais qu'il correspondait à
   * quoi que ce soit. Le sens ne peut plus être écrit, il est calculé.
   */
  ralentissement: number | readonly number[]
  /**
   * Le facteur tel qu'il s'affiche. DÉRIVÉ de `ralentissement` par
   * `poserLesBadges`, jamais rédigé dans les modules — ceux-ci renvoient des
   * `MecanismeBrut`, un type d'où ce champ est absent, si bien qu'écrire un
   * badge à la main ne compile pas.
   */
  facteur: string
  /**
   * CE QUI PORTE LE CYCLE AUQUEL LE BADGE SE RÉFÈRE.
   *
   * Sans lui, le badge n'est vérifiable que contre lui-même. Un harnais mesure
   * la période de l'objet nommé dans l'animation livrée, et la compare à sa
   * durée dans la cellule : leur rapport DOIT être le ralentissement annoncé.
   * Aucune constante d'animation n'entre dans ce calcul.
   *
   * Il a fallu trois tentatives pour en arriver là. Mesurer la période de la
   * SCÈNE ne suffit pas : une scène superpose plusieurs horloges — ses propres
   * ellisions le disent — et sa période globale est leur plus petit commun
   * multiple. Le cycle de Krebs rend ainsi 20 s pour un tour de 10, et la
   * chaîne respiratoire 60 s pour un rotor de 1,5.
   *
   * `cycleReel` est une donnée de BIOLOGIE, pas un réglage : c'est ce qu'un
   * relecteur peut contrôler, et c'est le seul chiffre déclaré ici.
   */
  observable?: {
    /** Nom de l'objet, posé par `.name` dans la scène. */
    nom: string
    /** Durée d'un cycle dans la cellule, en secondes. */
    cycleReel: number
    /** Pourquoi c'est cet objet qui porte le cycle du badge. */
    pourquoi: string
  }
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
  /**
   * Avance le mécanisme. `temps` est en secondes écoulées depuis le début.
   *
   * `contexte` est l'état cellulaire en LECTURE SEULE : c'est par lui qu'une
   * scène peut changer de comportement — rotor qui suit la force
   * proton-motrice, SNARE déclenchés par le calcium, granules dont le compte
   * suit le pool — et non plus seulement de vitesse. Une scène qui ne s'en
   * sert pas l'ignore : déclarer `(temps) => …` reste licite, l'argument
   * supplémentaire est simplement inutilisé.
   */
  animer: (temps: number, contexte: ContexteCellule) => void
}

export type { ContexteCellule }

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

/**
 * Un mécanisme tel que son module le construit : sans badge.
 *
 * Le champ `facteur` est ajouté par `poserLesBadges`, et par lui seul. Un
 * module qui tenterait d'écrire « accéléré ×5 » sur un ralenti ne compilerait
 * pas — c'est la seule façon d'empêcher pour de bon l'inversion qui a traîné
 * des mois dans la bêta-oxydation.
 */
export type MecanismeBrut = Omit<Mecanisme, 'facteur'>

/** Écrit un facteur avec l'espace insécable des milliers : « 5 000 ». */
function chiffrer(facteur: number): string {
  const arrondi = facteur >= 10 ? facteur.toFixed(0) : facteur.toFixed(1).replace(/[,.]0$/, '')
  return arrondi.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Le badge d'un facteur, DÉDUIT de son signe.
 *
 * Un seul endroit décide si l'on écrit « ralenti » ou « accéléré », et il le
 * décide en comparant le nombre à 1. C'est ce qui rend l'inversion impossible.
 */
export function badgeDe(ralentissement: number | readonly number[]): string {
  if (Array.isArray(ralentissement)) {
    const temps = (ralentissement as readonly number[]).map((r) => badgeDe(r))
    return `deux temps : ${temps.join(', puis ')}`
  }
  const r = ralentissement as number
  if (!(r > 0) || !Number.isFinite(r)) {
    throw new Error(`ralentissement invalide : ${r}`)
  }
  if (r > 1.05) return `ralenti ×${chiffrer(r)}`
  if (r < 0.95) return `accéléré ×${chiffrer(1 / r)}`
  return 'temps réel'
}

/**
 * Réécrit le badge de chaque mécanisme depuis son facteur numérique.
 *
 * Appelé une fois, dans `tous.ts`, sur tout ce que la page affiche : aucun
 * module ne rédige plus la phrase, donc aucun ne peut se tromper de sens.
 */
export function poserLesBadges(mecanismes: MecanismeBrut[]): Mecanisme[] {
  return mecanismes.map((m) => ({ ...m, facteur: badgeDe(m.ralentissement) }))
}
