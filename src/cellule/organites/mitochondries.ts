/**
 * Les mitochondries : six exemplaires dispersés dans le cytoplasme.
 *
 * Une mitochondrie sans crêtes n'est qu'un haricot orange. Tout le module est
 * donc organisé autour d'une seule idée : rendre visibles les replis de la
 * membrane interne au travers d'une membrane externe translucide. C'est la
 * surface de ces replis qui porte la chaîne respiratoire, donc c'est elle qu'il
 * faut montrer.
 */
import * as THREE from 'three'
import {
  TEINTES,
  creerAlea,
  materiauOrganite,
  pointDansCoquille,
  type Organite,
} from '../contrat.js'

/** Grand axe d'une mitochondrie, en micromètres. Échelle vraie. */
const LONGUEUR = 2
const DEMI_LONGUEUR = LONGUEUR / 2
/** Demi-largeur : la capsule fait 0,7 µm de diamètre. */
const RAYON = 0.35

const NOMBRE = 6
/** Graine de la FORME des capsules : profil de révolution et crêtes. */
const GRAINE = 31_415
/** Graine du PLACEMENT, tenue à part pour que les deux ne s'entraînent pas. */
const GRAINE_PLACEMENT = 31_415

const SEGMENTS_PROFIL = 28
const SEGMENTS_RADIAUX = 20

/**
 * L'espace intermembranaire est très mince (une vingtaine de nanomètres) : la
 * membrane interne longe l'externe de tout près, sauf là où elle plonge en
 * crêtes. Les deux facteurs restent proches de 1 pour ne pas mentir sur ce point.
 */
const ECHELLE_INTERNE_RADIALE = 0.93
const ECHELLE_INTERNE_AXIALE = 0.96

/** Épaisseur d'un repli : une lame, pas une galette. */
const EPAISSEUR_CRETE = 0.03
/** Les crêtes s'arrêtent avant les pôles, où la matrice reste dégagée. */
const PORTEE_CRETES = 0.8
/** Marge laissée entre le bord d'une crête inclinée et la membrane interne. */
const MARGE_CRETE = 0.015

/** Le grand axe de la capsule, aligné sur Y en espace local. */
const AXE_LONG = new THREE.Vector3(0, 1, 0)

// Temporaires hissés au niveau du module : rien ne s'alloue crête par crête.
const _centre = new THREE.Vector3()
const _direction = new THREE.Vector3()
const _positionCrete = new THREE.Vector3()
const _echelleCrete = new THREE.Vector3()
const _rotationCrete = new THREE.Quaternion()
const _eulerCrete = new THREE.Euler()
const _matriceCrete = new THREE.Matrix4()

/**
 * Rayon de la capsule à la hauteur `y` : partie cylindrique au centre,
 * hémisphères aux extrémités, plus un léger renflement propre à chaque
 * exemplaire — une mitochondrie n'est jamais un cylindre parfait.
 */
function rayonExterne(y: number, phase: number): number {
  const debord = Math.abs(y) - (DEMI_LONGUEUR - RAYON)
  const base =
    debord <= 0 ? RAYON : RAYON * Math.sqrt(Math.max(0, 1 - (debord / RAYON) ** 2))
  return base * (1 + 0.07 * Math.sin(y * 3.1 + phase))
}

/** Profil de révolution de la membrane externe, du pôle sud au pôle nord. */
function profilCapsule(phase: number): THREE.Vector2[] {
  const points: THREE.Vector2[] = []
  for (let i = 0; i <= SEGMENTS_PROFIL; i++) {
    const y = -DEMI_LONGUEUR + (LONGUEUR * i) / SEGMENTS_PROFIL
    // Rayon nul imposé aux extrémités : LatheGeometry ne recoud proprement les
    // normales des pôles que si l'abscisse y vaut exactement zéro.
    const rayon = i === 0 || i === SEGMENTS_PROFIL ? 0 : rayonExterne(y, phase)
    points.push(new THREE.Vector2(rayon, y))
  }
  return points
}

/**
 * Rayon de la membrane INTERNE à une hauteur donnée, lu sur son propre profil.
 *
 * La garde de confinement des crêtes interrogeait auparavant `rayonExterne(y)`
 * en le multipliant par la seule échelle radiale. Or la membrane interne est
 * mise à l'échelle sur ses DEUX coordonnées : à la hauteur `y` de la surface
 * interne correspond le point `y / ECHELLE_INTERNE_AXIALE` du profil externe.
 * La garde interrogeait donc la mauvaise altitude, et neuf crêtes sur
 * cinquante-neuf perçaient la membrane qu'elles sont censées replier — jusqu'à
 * 27 nm, mesuré.
 *
 * On lit désormais le profil interne lui-même, celui-là même que la
 * `LatheGeometry` maille. Les deux ne peuvent plus diverger.
 */
function rayonInterneA(profil: THREE.Vector2[], y: number): number {
  if (y <= profil[0]!.y) return profil[0]!.x
  const dernier = profil[profil.length - 1]!
  if (y >= dernier.y) return dernier.x
  let i = 0
  while (i < profil.length - 2 && profil[i + 1]!.y < y) i++
  const a = profil[i]!
  const b = profil[i + 1]!
  return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)
}

/** Les crêtes d'une mitochondrie, empilées perpendiculairement au grand axe. */
function creerCretes(
  geometrie: THREE.BufferGeometry,
  materiau: THREE.Material,
  profilInterne: THREE.Vector2[],
  alea: () => number,
): THREE.InstancedMesh {
  const nombre = 8 + Math.floor(alea() * 5)
  const cretes = new THREE.InstancedMesh(geometrie, materiau, nombre)
  const pas = (2 * PORTEE_CRETES) / (nombre - 1)
  const bord = new THREE.Vector3()

  for (let i = 0; i < nombre; i++) {
    // Répartition régulière, bousculée d'un peu de jeu : pas un empilement de pièces.
    const y = -PORTEE_CRETES + i * pas + (alea() - 0.5) * pas * 0.45
    // Décalage latéral alterné : chaque repli s'accroche d'un côté puis de l'autre.
    const decalage = (i % 2 === 0 ? 1 : -1) * (0.02 + alea() * 0.04)
    const diametreVoulu = 0.45 + alea() * 0.17
    const profondeur = (alea() - 0.5) * 0.03

    _positionCrete.set(decalage, y, profondeur)
    _eulerCrete.set((alea() - 0.5) * 0.1, 0, (alea() - 0.5) * 0.18)
    _rotationCrete.setFromEuler(_eulerCrete)

    // Une crête est INCLINÉE : son bord monte et descend, et se retrouve donc à
    // des hauteurs où la membrane est plus étroite qu'au centre du disque. Une
    // borne calculée au seul centre laisse passer ce débordement-là. On rétrécit
    // le disque jusqu'à ce que tout son bord tienne, contre le profil vrai.
    let rayonCrete = diametreVoulu / 2
    for (let essai = 0; essai < 40; essai++) {
      let debordeMax = 0
      for (let k = 0; k < 24; k++) {
        const angle = (k / 24) * Math.PI * 2
        bord
          .set(Math.cos(angle) * rayonCrete, 0, Math.sin(angle) * rayonCrete)
          .applyQuaternion(_rotationCrete)
          .add(_positionCrete)
        const deborde =
          Math.hypot(bord.x, bord.z) - (rayonInterneA(profilInterne, bord.y) - MARGE_CRETE)
        if (deborde > debordeMax) debordeMax = deborde
      }
      if (debordeMax <= 0) break
      rayonCrete = Math.max(0, rayonCrete - debordeMax - 1e-4)
    }

    _echelleCrete.set(rayonCrete * 2, EPAISSEUR_CRETE, rayonCrete * 2)
    cretes.setMatrixAt(i, _matriceCrete.compose(_positionCrete, _rotationCrete, _echelleCrete))
  }

  cretes.instanceMatrix.needsUpdate = true
  return cretes
}

/** Où se trouve une mitochondrie, et comment elle est tournée. */
export interface PlacementMitochondrie {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

let _placements: PlacementMitochondrie[] | null = null

/**
 * LA SOURCE UNIQUE DES POSITIONS DE MITOCHONDRIES.
 *
 * Deux modules en avaient besoin et aucun ne pouvait les obtenir : `matrices.ts`
 * REJOUAIT tirage pour tirage la boucle de ce fichier — en recopiant quatre
 * constantes à travers la frontière des modules et en comptant les appels au
 * générateur à la main — et les mécanismes mitochondriaux, faute de mieux,
 * écrivaient des coordonnées littérales, à 3,8 µm de la mitochondrie la plus
 * proche.
 *
 * Le placement est donc calculé à part, sur son propre flux aléatoire, et
 * mémorisé. La forme des capsules et de leurs crêtes garde le sien : ajouter un
 * tirage à l'une ne peut plus déplacer l'autre.
 */
export function placementsMitochondries(): PlacementMitochondrie[] {
  if (_placements) return _placements

  const alea = creerAlea(GRAINE_PLACEMENT)
  const pivot = new THREE.Object3D()
  const liste: PlacementMitochondrie[] = []

  for (let index = 0; index < NOMBRE; index++) {
    // Entre 4 et 8,5 µm du centre : au-delà du noyau, en deçà de la membrane.
    const position = pointDansCoquille(alea, 4, 8.5, new THREE.Vector3())
    // L'écorché retire tout ce qui est en z positif : on rabat les six
    // exemplaires du côté ouvert, sinon la moitié disparaît de la planche.
    position.z = -Math.abs(position.z)

    // Orientation quelconque, prise sur la sphère unité, puis roulis autour du
    // grand axe pour que les crêtes ne se décalent pas toutes dans le même sens.
    pointDansCoquille(alea, 1, 1, _direction).normalize()
    pivot.quaternion.setFromUnitVectors(AXE_LONG, _direction)
    pivot.rotateY(alea() * Math.PI * 2)

    liste.push({ position, quaternion: pivot.quaternion.clone() })
  }

  _placements = liste
  return liste
}

export function creerMitochondries(): Organite[] {
  const alea = creerAlea(GRAINE)
  const placements = placementsMitochondries()
  // Un seul disque unitaire, mis à l'échelle par instance.
  const geometrieCrete = new THREE.CylinderGeometry(0.5, 0.5, 1, 24)
  const organites: Organite[] = []

  for (let index = 0; index < NOMBRE; index++) {
    const phase = alea() * Math.PI * 2
    const pointsExternes = profilCapsule(phase)
    const pointsInternes = pointsExternes.map(
      (p) =>
        new THREE.Vector2(p.x * ECHELLE_INTERNE_RADIALE, p.y * ECHELLE_INTERNE_AXIALE),
    )

    // Les deux surfaces translucides sont concentriques : le tri par distance
    // du rendu les départage à égalité, et retombe alors sur l'ordre de
    // création. La matrice naît donc avant la membrane, pour être peinte
    // dessous — sans avoir à imposer un renderOrder, qui vaut pour la scène
    // entière et déréglerait les autres organites.
    const matrice = new THREE.Mesh(
      new THREE.LatheGeometry(pointsInternes, SEGMENTS_RADIAUX),
      materiauOrganite(TEINTES.mitochondrieCrete, { opacite: 0.25 }),
    )
    const membrane = new THREE.Mesh(
      new THREE.LatheGeometry(pointsExternes, SEGMENTS_RADIAUX),
      materiauOrganite(TEINTES.mitochondrie, { opacite: 0.45 }),
    )
    // Les crêtes reçoivent le profil interne LUI-MÊME, celui que la
    // `LatheGeometry` maille juste au-dessus : la garde de confinement et la
    // surface qu'elle borne ne peuvent plus décrire deux choses différentes.
    const cretes = creerCretes(
      geometrieCrete,
      materiauOrganite(TEINTES.mitochondrieCrete),
      pointsInternes,
      alea,
    )

    const groupe = new THREE.Group()
    groupe.add(cretes, matrice, membrane)

    const placement = placements[index]!
    _centre.copy(placement.position)
    groupe.position.copy(placement.position)
    groupe.quaternion.copy(placement.quaternion)
    // Le grand axe de la capsule, en coordonnées monde : l'étiquette s'y accroche.
    _direction.copy(AXE_LONG).applyQuaternion(placement.quaternion)

    const cle = `mitochondrie-${index + 1}`
    groupe.name = cle

    // L'étiquette se pose au bout du grand axe qui reste du bon côté de la coupe.
    const sens = _direction.z > 0 ? -1 : 1
    const ancre = _direction
      .clone()
      .multiplyScalar(sens * (DEMI_LONGUEUR + 0.3))
      .add(_centre)

    organites.push({
      cle,
      nom: 'Mitochondrie',
      role: "Fabrique l'ATP, la monnaie énergétique de la cellule.",
      description:
        "La mitochondrie est enveloppée de deux membranes. L'interne se replie en " +
        'crêtes qui plongent dans la matrice : ces replis multiplient la surface ' +
        "disponible pour la chaîne respiratoire, là où l'oxygène est consommé et " +
        "l'ATP assemblée. Plus une cellule travaille, plus ses crêtes sont serrées — " +
        'un muscle cardiaque en est bourré. Elle garde un ADN circulaire à elle, ' +
        "vestige de la bactérie qu'elle a été.",
      objet: groupe,
      ancre,
      couleur: TEINTES.mitochondrie,
    })
  }

  return organites
}
