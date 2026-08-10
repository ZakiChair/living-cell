import * as THREE from 'three'
import type { ContexteCellule } from '../../noyau/contexte.js'
import {
  CENTRE_NOYAU,
  RAYON_CELLULE,
  RAYON_NOYAU,
  TEINTES,
  creerAlea,
  materiauOrganite,
  pointDansCoquille,
  type Organite,
} from '../contrat.js'

/**
 * Les granules d'insuline : l'organe du métier de la cellule bêta.
 *
 * Le produit s'appelait « cellule bêta » et n'en contenait aucun objet
 * spécifique — pendant que le modèle simulait un pool de granules que rien ne
 * montrait. Cet organite ferme cette inversion : le COMPTE des granules
 * visibles suit `insulineGranules` du modèle, image par image. Une cellule
 * stimulée qui sécrète se vide sous les yeux, en commençant par les granules
 * amarrés à la membrane — c'est la première phase de la sécrétion.
 *
 * Le granule réel : ~300 nm de diamètre, un cœur dense aux électrons — de
 * l'insuline cristallisée en hexamères autour de deux ions zinc, concentrée
 * jusqu'à 40 mM — séparé de la membrane par un halo clair, signature de la
 * cellule bêta en microscopie électronique. Une cellule en porte ~10 000, un
 * dixième de son volume.
 */

/**
 * Échantillon 1:22 : 460 granules dessinés pour ~10 000 réels. Le compte vrai
 * est dans la fiche, et la densité dessinée reste cohérente avec le voile
 * cytosolique (éclairci de trois ordres de grandeur, déclaré dans sa fiche).
 */
const NOMBRE_MAX = 460
/** Fraction amarrée à la membrane : le pool prêt à partir (~5 % en vrai, ici 12 % pour rester lisible). */
const FRACTION_AMARREE = 0.12
/** Rayon du granule : 150 nm, taille vraie. */
const RAYON_GRANULE = 0.15
/** Cœur dense : 100 nm, la moitié du diamètre, comme en EM. */
const RAYON_COEUR = 0.1
/** Les granules amarrés flottent juste sous la membrane, à moins de 400 nm. */
const RAYON_AMARRAGE_MIN = RAYON_CELLULE - 0.55
const RAYON_AMARRAGE_MAX = RAYON_CELLULE - 0.35
/** La réserve occupe le cytoplasme, hors du noyau et de sa marge. */
const COQUILLE_RESERVE_MIN = 3.4
const COQUILLE_RESERVE_MAX = RAYON_CELLULE - 0.8
/** Marge de dégagement autour du noyau : un granule dans le nucléoplasme est un bug. */
const DEGAGEMENT_NOYAU = RAYON_NOYAU + 0.35

const GRAINE = 0x47524155

const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _rotation = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)
const _axe = new THREE.Vector3()

export interface GranulesInsuline {
  organites: Organite[]
  /**
   * Fait suivre au compte visible le pool du modèle. À appeler chaque image :
   * c'est le premier organite VIVANT — sa géométrie est un état, pas un décor.
   */
  mettreAJour: (contexte: ContexteCellule) => void
}

/** Positions des granules : la réserve d'abord, les amarrés EN FIN de liste. */
function semerPositions(): THREE.Vector3[] {
  const alea = creerAlea(GRAINE)
  const positions: THREE.Vector3[] = []
  const nombreAmarres = Math.round(NOMBRE_MAX * FRACTION_AMARREE)

  while (positions.length < NOMBRE_MAX - nombreAmarres) {
    const point = pointDansCoquille(
      alea,
      COQUILLE_RESERVE_MIN,
      COQUILLE_RESERVE_MAX,
      new THREE.Vector3(),
    )
    // Rejet : ni dans le noyau, ni dans sa marge. Le tirage est déterministe
    // (graine fixe), donc la géométrie livrée est la même à chaque chargement.
    if (point.distanceTo(CENTRE_NOYAU) < DEGAGEMENT_NOYAU) continue
    positions.push(point)
  }

  // Les amarrés ferment la liste : baisser `count` les retire EN PREMIER.
  // C'est l'ordre biologique — la sécrétion consomme d'abord le pool amarré.
  for (let i = 0; i < nombreAmarres; i++) {
    positions.push(
      pointDansCoquille(alea, RAYON_AMARRAGE_MIN, RAYON_AMARRAGE_MAX, new THREE.Vector3()),
    )
  }
  return positions
}

export function creerGranulesInsuline(): GranulesInsuline {
  const positions = semerPositions()

  // Le cœur est un icosaèdre non subdivisé : les facettes disent le cristal.
  const coeurs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_COEUR, 0),
    materiauOrganite(TEINTES.granuleInsuline),
    NOMBRE_MAX,
  )
  coeurs.name = 'coeurs-cristallins'

  // Le halo clair entre cœur et membrane : la signature EM de la cellule bêta.
  // Simple face et maillage grossier : 460 sphères translucides DOUBLE face
  // mettaient le débit à genoux dès que la caméra entrait dans le nuage —
  // chaque pixel payait deux parois par granule traversé.
  const halos = new THREE.InstancedMesh(
    new THREE.SphereGeometry(RAYON_GRANULE, 8, 6),
    materiauOrganite(TEINTES.granuleInsuline, { opacite: 0.22, doubleFace: false }),
    NOMBRE_MAX,
  )
  halos.name = 'halos-granules'

  const alea = creerAlea(GRAINE ^ 0x5a5a)
  for (const [i, point] of positions.entries()) {
    _axe.set(alea() * 2 - 1, alea() * 2 - 1, alea() * 2 - 1).normalize()
    _rotation.setFromAxisAngle(_axe, alea() * Math.PI * 2)
    _matrice.compose(_position.copy(point), _rotation, _echelle)
    coeurs.setMatrixAt(i, _matrice)
    halos.setMatrixAt(i, _matrice)
  }
  coeurs.instanceMatrix.needsUpdate = true
  halos.instanceMatrix.needsUpdate = true
  coeurs.computeBoundingSphere()
  halos.computeBoundingSphere()

  const groupe = new THREE.Group()
  groupe.name = 'granules-insuline'
  groupe.add(coeurs, halos)

  let compteCourant = NOMBRE_MAX

  const mettreAJour = (contexte: ContexteCellule): void => {
    const fraction = Math.min(
      1,
      Math.max(0, contexte.insulineGranules / Math.max(1e-9, contexte.capaciteGranules)),
    )
    const compte = Math.round(NOMBRE_MAX * fraction)
    if (compte === compteCourant) return
    compteCourant = compte
    coeurs.count = compte
    halos.count = compte
  }

  return {
    organites: [
      {
        cle: 'granules-insuline',
        nom: "Granules d'insuline",
        role: "La réserve d'insuline, prête à partir : le métier de la cellule bêta.",
        description:
          "Chaque granule est un stock d'insuline sous membrane : un cœur dense où " +
          "l'hormone est cristallisée en hexamères autour de deux ions zinc, séparé " +
          'de la membrane par un halo clair — la signature de la cellule bêta en ' +
          'microscopie électronique. Une cellule en porte environ dix mille, un ' +
          'dixième de son volume ; il en est dessiné un sur vingt-deux, et leur ' +
          'COMPTE suit le pool du modèle : une cellule stimulée au glucose se vide ' +
          "sous vos yeux, en commençant par les granules amarrés à la membrane — " +
          "c'est la première phase de la sécrétion, celle que mesure un test de " +
          "tolérance au glucose. Le granule mûrit en quelques heures : la " +
          'proinsuline y est découpée en insuline et peptide C, et le cœur ' +
          'cristallise à mesure que le pH tombe.',
        objet: groupe,
        ancre: new THREE.Vector3(-0.35, -0.55, -0.75)
          .normalize()
          .multiplyScalar(RAYON_CELLULE - 1.4),
        couleur: TEINTES.granuleInsuline,
      },
    ],
    mettreAJour,
  }
}
