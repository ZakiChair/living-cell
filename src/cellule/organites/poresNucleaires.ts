import * as THREE from 'three'
import {
  CENTRE_NOYAU,
  creerAlea,
  materiauOrganite,
  TEINTES,
  UM,
  type Organite,
} from '../contrat.js'

/**
 * Les pores nucléaires, en panier.
 *
 * Un pore n'est pas un trou : c'est la plus grosse machine de la cellule, un
 * assemblage de trente protéines répété huit fois autour du canal. Sa silhouette
 * ne tient ni à l'anneau ni au canal — une vésicule percée en donnerait autant —
 * mais à ce qui pend en dessous : le panier nucléoplasmique, huit filaments qui
 * plongent dans le noyau et se referment sur un anneau distal. C'est ce détail
 * qui rend l'enveloppe nucléaire reconnaissable au premier coup d'œil.
 *
 * L'enveloppe est posée par le module noyau ; ici on ne fait qu'habiller ses
 * sites de pore.
 */

/**
 * Rayon de pose : 20 nm au-dessus de la membrane externe (rayon 3). L'anneau
 * cytoplasmique coiffe l'enveloppe, il ne s'y enfonce pas.
 */
const RAYON_POSE = 3.02 * UM

const NOMBRE_PORES = 48
/**
 * Sites repris de l'enveloppe.
 *
 * Le module noyau sème ses soixante anneaux sur une spirale de Fibonacci, et ce
 * module n'a pas le droit de toucher son fichier. Poser nos paniers ailleurs
 * donnerait cent-huit pores en deux familles visuelles distinctes sur la même
 * membrane. On rejoue donc la même formule pour retomber sur les mêmes sites :
 * chaque panier se pose alors sur un anneau existant, coaxial et 40 nm au-dessus
 * — soit exactement la superposition anneau cytoplasmique / anneau
 * nucléoplasmique de la vraie structure. Les douze sites non retenus gardent
 * leur anneau nu.
 */
const SITES_ENVELOPPE = 60
const ANGLE_OR = Math.PI * (3 - Math.sqrt(5))

/** Symétrie d'ordre 8 : la signature du complexe, comme l'ordre 9 l'est du centriole. */
const SYMETRIE = 8

/** Diamètre externe réel du pore : 100 nm. Rayon 0,036 + tube 0,014 = 0,05. */
const RAYON_ANNEAU = 0.036
const RAYON_TUBE_ANNEAU = 0.014

/** Les huit masses coiffent le tube de l'anneau au lieu d'y être noyées. */
const RAYON_MASSES = 0.038
const HAUTEUR_MASSES = 0.018
const DEMI_MASSE = 0.011

/** Le panier plonge de 60 nm sous l'anneau et finit 20 nm sous la membrane interne. */
const PROFONDEUR_PANIER = 0.06
const DEPART_PANIER = -0.02
const RAYON_DEPART_PANIER = 0.032
const RAYON_ANNEAU_DISTAL = 0.018
const RAYON_TUBE_DISTAL = 0.005
/** Les filaments du panier vrillent en descendant : le panier n'est pas un cône. */
const VRILLE_PANIER = 0.3
/** Bombement à mi-hauteur : sans lui la silhouette redevient un entonnoir droit. */
const RAYON_MI_PANIER = 0.03

/** Filaments cytoplasmiques : libres, et plus courts que le panier (~45 nm). */
const RAYON_DEPART_FILAMENTS = 0.034
const DEPART_FILAMENTS = 0.02

/** Nucléoporines : des cordes de 8 nm de diamètre, pas des câbles. */
const RAYON_FILAMENT = 0.004

const GRAINE = 0x504f5245

/** Un tore est dessiné dans le plan XY, un cylindre le long de Y. */
const AXE_TORE = new THREE.Vector3(0, 0, 1)
const AXE_CYLINDRE = new THREE.Vector3(0, 1, 0)
const SANS_ECHELLE = new THREE.Vector3(1, 1, 1)

// Temporaires hissés au module : rien ne s'alloue pore par pore.
const _normale = new THREE.Vector3()
const _centrePore = new THREE.Vector3()
const _rotationPore = new THREE.Quaternion()
const _matricePore = new THREE.Matrix4()
const _positionLocale = new THREE.Vector3()
const _rotationLocale = new THREE.Quaternion()
const _echelle = new THREE.Vector3()
const _matriceLocale = new THREE.Matrix4()
const _matriceMonde = new THREE.Matrix4()
const _direction = new THREE.Vector3()
const _pointA = new THREE.Vector3()
const _pointB = new THREE.Vector3()
const _pointC = new THREE.Vector3()

/**
 * Point du repère local d'un pore, en coordonnées cylindriques.
 * L'axe local +Z pointe vers le cytosol, -Z vers le nucléoplasme.
 */
function pointLocal(rayon: number, angle: number, z: number, cible: THREE.Vector3): THREE.Vector3 {
  return cible.set(Math.cos(angle) * rayon, Math.sin(angle) * rayon, z)
}

/** Pose une instance dans le repère du pore courant. */
function poser(mesh: THREE.InstancedMesh, index: number): void {
  mesh.setMatrixAt(index, _matriceMonde.multiplyMatrices(_matricePore, _matriceLocale))
}

/** Un segment de filament tendu entre deux points locaux, à partir d'un cylindre unitaire. */
function poserSegment(
  mesh: THREE.InstancedMesh,
  index: number,
  a: THREE.Vector3,
  b: THREE.Vector3,
): void {
  _direction.subVectors(b, a)
  const longueur = _direction.length()
  _rotationLocale.setFromUnitVectors(AXE_CYLINDRE, _direction.divideScalar(longueur))
  _positionLocale.addVectors(a, b).multiplyScalar(0.5)
  _echelle.set(RAYON_FILAMENT, longueur, RAYON_FILAMENT)
  _matriceLocale.compose(_positionLocale, _rotationLocale, _echelle)
  poser(mesh, index)
}

export function creerPoresNucleaires(): Organite[] {
  const alea = creerAlea(GRAINE)
  // Une seule teinte pour tout le complexe : la couleur code la famille, et le
  // pore est une seule machine. C'est le relief qui sépare ses pièces.
  const matiere = materiauOrganite(TEINTES.proteineMembranaire)

  const anneaux = new THREE.InstancedMesh(
    new THREE.TorusGeometry(RAYON_ANNEAU, RAYON_TUBE_ANNEAU, 6, 14),
    matiere,
    NOMBRE_PORES,
  )
  anneaux.name = 'anneaux-cytoplasmiques'

  const masses = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    matiere,
    NOMBRE_PORES * SYMETRIE,
  )
  masses.name = 'sous-unites-ordre-8'

  // Deux segments par filament : un seul donnerait un panier en fil de fer
  // tendu, alors que la courbure est ce qui fait lire le panier.
  const panier = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1, 1, 1, 4, 1, true),
    matiere,
    NOMBRE_PORES * SYMETRIE * 2,
  )
  panier.name = 'panier-nucleoplasmique'

  const anneauxDistaux = new THREE.InstancedMesh(
    new THREE.TorusGeometry(RAYON_ANNEAU_DISTAL, RAYON_TUBE_DISTAL, 5, 12),
    matiere,
    NOMBRE_PORES,
  )
  anneauxDistaux.name = 'anneaux-distaux'

  const filaments = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1, 1, 1, 4, 1, true),
    matiere,
    NOMBRE_PORES * SYMETRIE * 2,
  )
  filaments.name = 'filaments-cytoplasmiques'

  for (let k = 0; k < NOMBRE_PORES; k++) {
    // Un site sur cinq est sauté, ce qui étale les quarante-huit paniers sur
    // toute la sphère au lieu de les tasser sur les latitudes hautes.
    const site = Math.round((k * SITES_ENVELOPPE) / NOMBRE_PORES)
    const hauteur = 1 - ((site + 0.5) * 2) / SITES_ENVELOPPE
    const rayonLatitude = Math.sqrt(1 - hauteur * hauteur)
    const azimut = site * ANGLE_OR
    _normale.set(Math.cos(azimut) * rayonLatitude, hauteur, Math.sin(azimut) * rayonLatitude)

    // Le pore traverse la membrane perpendiculairement : son axe est la normale.
    _rotationPore.setFromUnitVectors(AXE_TORE, _normale)
    _centrePore.copy(_normale).multiplyScalar(RAYON_POSE)
    _matricePore.compose(_centrePore, _rotationPore, SANS_ECHELLE)

    // Le tore est déjà dans le plan XY local, donc perpendiculaire à l'axe du pore.
    _matriceLocale.identity()
    poser(anneaux, k)

    _positionLocale.set(0, 0, DEPART_PANIER - PROFONDEUR_PANIER)
    _rotationLocale.identity()
    _matriceLocale.compose(_positionLocale, _rotationLocale, SANS_ECHELLE)
    poser(anneauxDistaux, k)

    // Roulis propre à chaque pore : les huit sous-unités ne s'alignent pas d'un
    // pore à l'autre, sinon le semis prend un air de motif imprimé.
    const roulis = alea() * Math.PI * 2

    for (let j = 0; j < SYMETRIE; j++) {
      const angle = roulis + (j * Math.PI * 2) / SYMETRIE
      const index = k * SYMETRIE + j

      pointLocal(RAYON_MASSES, angle, HAUTEUR_MASSES, _positionLocale)
      _rotationLocale.identity()
      // Aplatie sur l'axe du pore : une sous-unité est un lobe, pas une bille.
      _echelle.set(DEMI_MASSE, DEMI_MASSE, DEMI_MASSE * 0.8)
      _matriceLocale.compose(_positionLocale, _rotationLocale, _echelle)
      poser(masses, index)

      // Panier : de l'anneau au petit anneau distal, en vrillant et en bombant.
      pointLocal(RAYON_DEPART_PANIER, angle, DEPART_PANIER, _pointA)
      pointLocal(
        RAYON_MI_PANIER,
        angle + VRILLE_PANIER / 2,
        DEPART_PANIER - PROFONDEUR_PANIER / 2,
        _pointB,
      )
      poserSegment(panier, index * 2, _pointA, _pointB)
      pointLocal(
        RAYON_ANNEAU_DISTAL,
        angle + VRILLE_PANIER,
        DEPART_PANIER - PROFONDEUR_PANIER,
        _pointC,
      )
      poserSegment(panier, index * 2 + 1, _pointB, _pointC)

      // Filaments cytoplasmiques : décalés d'un demi-pas pour se glisser entre
      // les sous-unités, puis libres — ils ne se rejoignent jamais.
      const angleLibre = angle + Math.PI / SYMETRIE
      pointLocal(RAYON_DEPART_FILAMENTS, angleLibre, DEPART_FILAMENTS, _pointA)
      pointLocal(RAYON_DEPART_FILAMENTS + 0.012, angleLibre, DEPART_FILAMENTS + 0.018, _pointB)
      poserSegment(filaments, index * 2, _pointA, _pointB)
      pointLocal(
        RAYON_DEPART_FILAMENTS + 0.017 + alea() * 0.015,
        angleLibre + (alea() - 0.5) * 0.7,
        DEPART_FILAMENTS + 0.03 + alea() * 0.012,
        _pointC,
      )
      poserSegment(filaments, index * 2 + 1, _pointB, _pointC)
    }
  }

  const groupe = new THREE.Group()
  groupe.name = 'pores-nucleaires'
  groupe.position.copy(CENTRE_NOYAU)
  for (const piece of [anneaux, masses, panier, anneauxDistaux, filaments]) {
    piece.instanceMatrix.needsUpdate = true
    // Les pièces mesurent 10 à 100 nm : sans ce recalcul, le tronc de vision
    // juge tout le semis sur une bulle grosse comme une seule d'entre elles.
    piece.computeBoundingSphere()
    groupe.add(piece)
  }

  return [
    {
      cle: 'pores-nucleaires',
      nom: 'Pores nucléaires',
      role: 'Seule porte du noyau : filtre tout ce qui entre et tout ce qui sort.',
      description:
        "Le complexe du pore nucléaire est la plus grosse machine de la cellule : une " +
        "trentaine de protéines différentes, les nucléoporines, assemblées en huit " +
        "exemplaires autour d'un canal unique. L'anneau côté cytosol porte des " +
        'filaments libres qui pêchent les cargos ; côté noyau, huit filaments plongent ' +
        "et se referment sur un anneau distal — c'est le panier, la silhouette qui " +
        "signe l'enveloppe nucléaire. Un noyau en porte de quelques centaines à " +
        "plusieurs milliers selon son activité. Le canal fait 40 nanomètres et se dilate jusqu'à " +
        '70 pour laisser passer un ribosome en cours de sortie ; les petites molécules ' +
        'diffusent librement, les grosses ne franchissent le maillage que munies du bon ' +
        "signal d'adressage. Un cargo reconnu traverse en moins de dix millisecondes.",
      objet: groupe,
      // Du côté que la coupe conserve en dernier : le trait d'étiquette ne part
      // jamais d'un vide, même écorché à fond.
      ancre: CENTRE_NOYAU.clone().addScaledVector(
        new THREE.Vector3(0.62, 0.3, -0.72).normalize(),
        RAYON_POSE + 0.45,
      ),
      couleur: TEINTES.proteineMembranaire,
    },
  ]
}
