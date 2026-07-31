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
const GRAINE = 31_415

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

/** Les crêtes d'une mitochondrie, empilées perpendiculairement au grand axe. */
function creerCretes(
  geometrie: THREE.BufferGeometry,
  materiau: THREE.Material,
  phase: number,
  alea: () => number,
): THREE.InstancedMesh {
  const nombre = 8 + Math.floor(alea() * 5)
  const cretes = new THREE.InstancedMesh(geometrie, materiau, nombre)
  const pas = (2 * PORTEE_CRETES) / (nombre - 1)

  for (let i = 0; i < nombre; i++) {
    // Répartition régulière, bousculée d'un peu de jeu : pas un empilement de pièces.
    const y = -PORTEE_CRETES + i * pas + (alea() - 0.5) * pas * 0.45
    // Décalage latéral alterné : chaque repli s'accroche d'un côté puis de l'autre.
    const decalage = (i % 2 === 0 ? 1 : -1) * (0.02 + alea() * 0.04)

    // Une crête est un repli de la membrane interne : elle ne peut pas la déborder.
    const rayonInterne = rayonExterne(y, phase) * ECHELLE_INTERNE_RADIALE
    const diametreVoulu = 0.45 + alea() * 0.17
    // Plancher : près des pôles la capsule se referme, mais une crête ne doit
    // jamais se réduire à rien — chaque instance garde une taille visible.
    const rayonCrete = Math.max(
      0.1,
      Math.min(diametreVoulu / 2, rayonInterne - Math.abs(decalage) - MARGE_CRETE),
    )

    _positionCrete.set(decalage, y, (alea() - 0.5) * 0.03)
    _eulerCrete.set((alea() - 0.5) * 0.1, 0, (alea() - 0.5) * 0.18)
    _rotationCrete.setFromEuler(_eulerCrete)
    _echelleCrete.set(rayonCrete * 2, EPAISSEUR_CRETE, rayonCrete * 2)
    cretes.setMatrixAt(i, _matriceCrete.compose(_positionCrete, _rotationCrete, _echelleCrete))
  }

  cretes.instanceMatrix.needsUpdate = true
  return cretes
}

export function creerMitochondries(): Organite[] {
  const alea = creerAlea(GRAINE)
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
    const cretes = creerCretes(
      geometrieCrete,
      materiauOrganite(TEINTES.mitochondrieCrete),
      phase,
      alea,
    )

    const groupe = new THREE.Group()
    groupe.add(cretes, matrice, membrane)

    // Entre 4 et 8,5 µm du centre : au-delà du noyau, en deçà de la membrane.
    pointDansCoquille(alea, 4, 8.5, _centre)
    // L'écorché retire tout ce qui est en z positif : on rabat les six
    // exemplaires du côté ouvert, sinon la moitié disparaît de la planche.
    _centre.z = -Math.abs(_centre.z)
    groupe.position.copy(_centre)

    // Orientation quelconque, prise sur la sphère unité, puis roulis autour du
    // grand axe pour que les crêtes ne se décalent pas toutes dans le même sens.
    pointDansCoquille(alea, 1, 1, _direction).normalize()
    groupe.quaternion.setFromUnitVectors(AXE_LONG, _direction)
    groupe.rotateY(alea() * Math.PI * 2)

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
      chiffres: [
        { valeur: '1 à 2 µm', quoi: "de long, la taille d'une bactérie" },
        { valeur: 'quelques centaines à plus de 2 000', quoi: 'par cellule, selon le tissu' },
        { valeur: '~90 %', quoi: "de l'ATP de la cellule produite ici" },
        { valeur: 'ADN circulaire', quoi: "propre à l'organite, hérité de la mère" },
      ],
      objet: groupe,
      ancre,
      couleur: TEINTES.mitochondrie,
    })
  }

  return organites
}
