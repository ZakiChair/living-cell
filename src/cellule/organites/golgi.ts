import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite, type Organite } from '../contrat.js'

/**
 * L'appareil de Golgi.
 *
 * La silhouette tient en une phrase : une pile d'assiettes creuses de taille
 * décroissante, avec un nuage de vésicules qui s'échappe par le dessus. Deux
 * choix portent tout le reste du module.
 *
 * 1. Les citernes sont des calottes sphériques de MÊME rayon de courbure,
 *    simplement décalées le long de l'axe de la pile. Elles sont donc
 *    concentriques : leur écart vertical vaut exactement l'espacement moins
 *    les deux demi-épaisseurs, en tout point. Aucune ne peut en traverser une
 *    autre, et ce n'est pas un réglage — c'est une conséquence géométrique.
 * 2. La flèche de la calotte (0,15 µm) est plus grande que l'espacement
 *    (0,12 µm). C'est ce rapport qui fait lire « bols emboîtés » plutôt que
 *    « radiateur ». Des disques plats ne ressemblent pas à un Golgi.
 *
 * La face cis (la plus large) est convexe et regarde le noyau ; la face trans
 * est concave et regarde la membrane, c'est de là que partent les vésicules.
 */

/** Centre de la pile, entre le noyau et la membrane. */
const CENTRE = new THREE.Vector3(3.2, -1.5, 0.5)

const NOMBRE_CITERNES = 6
/** Rayons cis (1,6 µm de diamètre) et trans (1,0 µm de diamètre). */
const RAYON_CIS = 0.8
const RAYON_TRANS = 0.5
const ESPACEMENT = 0.12
/** Épaisseur au centre, et au bord : les bourrelets périphériques sont réels. */
const EPAISSEUR = 0.05
const EPAISSEUR_BOURRELET = 0.075
/** Rayon de courbure commun aux six calottes. Donne 0,15 µm de flèche à la cis. */
const RAYON_COURBURE = 2.2

const SEGMENTS_RADIAUX = 44
const POINTS_SURFACE = 12
const POINTS_BOURRELET = 6

/** Irrégularités : une pile parfaitement alignée ressemble à une pièce usinée. */
const INCLINAISON_MAX = 0.014
const DECALAGE_LATERAL = 0.010

const VESICULES_BORD = 11
const VESICULES_PLUME = 15
const NOMBRE_VESICULES = VESICULES_BORD + VESICULES_PLUME

/** Objet de service pour composer les matrices d'instance, hissé hors des boucles. */
const pion = new THREE.Object3D()
const AXE_PILE = new THREE.Vector3(0, 1, 0)
const AXE_INCLINAISON = new THREE.Vector3(0, 0, 1)

/** Creux de la calotte à la distance r de l'axe : sagitta d'une sphère de rayon RAYON_COURBURE. */
function creux(r: number): number {
  return RAYON_COURBURE - Math.sqrt(RAYON_COURBURE * RAYON_COURBURE - r * r)
}

/** Demi-épaisseur de la membrane, qui s'épaissit en approchant du bord. */
function demiEpaisseur(r: number, rayonPlat: number): number {
  const t = Math.min(1, r / rayonPlat)
  const lissage = t * t * (3 - 2 * t)
  return (EPAISSEUR + (EPAISSEUR_BOURRELET - EPAISSEUR) * lissage) / 2
}

/**
 * Profil à révolutionner : face cis du pôle vers le bord, demi-arc du bourrelet
 * qui ferme la tranche, puis face trans du bord vers le pôle. Le tracé part et
 * revient sur l'axe (x = 0), donc la citerne est un volume fermé.
 */
function profilCiterne(rayon: number): THREE.Vector2[] {
  const demiBourrelet = EPAISSEUR_BOURRELET / 2
  const rayonPlat = rayon - demiBourrelet
  const points: THREE.Vector2[] = []

  for (let i = 0; i <= POINTS_SURFACE; i++) {
    const r = (rayonPlat * i) / POINTS_SURFACE
    points.push(new THREE.Vector2(r, creux(r) - demiEpaisseur(r, rayonPlat)))
  }

  const hauteurBord = creux(rayonPlat)
  for (let j = 1; j < POINTS_BOURRELET; j++) {
    const angle = -Math.PI / 2 + (Math.PI * j) / POINTS_BOURRELET
    points.push(
      new THREE.Vector2(
        rayonPlat + demiBourrelet * Math.cos(angle),
        hauteurBord + demiBourrelet * Math.sin(angle),
      ),
    )
  }

  for (let i = POINTS_SURFACE; i >= 0; i--) {
    const r = (rayonPlat * i) / POINTS_SURFACE
    points.push(new THREE.Vector2(r, creux(r) + demiEpaisseur(r, rayonPlat)))
  }

  return points
}

/**
 * Déforme le contour circulaire en contour lobé, plus fort au bord qu'au centre.
 * La phase est presque commune à toute la pile : les citernes d'un dictyosome
 * partagent leur contour, et cela garantit aussi que les ondulations ne
 * rapprochent pas deux citernes voisines.
 */
function onduler(geometrie: THREE.BufferGeometry, rayon: number, phase: number): void {
  const positions = geometrie.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 1e-6) continue
    const angle = Math.atan2(z, x)
    const poids = Math.min(1, r / rayon) ** 1.5
    const facteur =
      1 + poids * (0.04 * Math.sin(3 * angle + phase) + 0.025 * Math.sin(5 * angle - 1.7 * phase))
    positions.setX(i, x * facteur)
    positions.setZ(i, z * facteur)
  }
  positions.needsUpdate = true
  geometrie.computeVertexNormals()
}

export function creerGolgi(): Organite[] {
  const alea = creerAlea(4703)
  const groupe = new THREE.Group()
  groupe.name = 'golgi'

  const matiereCiterne = materiauOrganite(TEINTES.golgi)
  const matiereVesicule = materiauOrganite(TEINTES.vesicule)

  // La pile est centrée sur l'origine du groupe : la cis en dessous, la trans au-dessus.
  const hauteurCis = -((NOMBRE_CITERNES - 1) * ESPACEMENT) / 2
  const phaseCommune = alea() * Math.PI * 2

  const rayons: number[] = []
  const hauteurs: number[] = []

  for (let i = 0; i < NOMBRE_CITERNES; i++) {
    const t = i / (NOMBRE_CITERNES - 1)
    const rayon = RAYON_CIS + (RAYON_TRANS - RAYON_CIS) * t
    const hauteur = hauteurCis + i * ESPACEMENT

    const geometrie = new THREE.LatheGeometry(profilCiterne(rayon), SEGMENTS_RADIAUX)
    onduler(geometrie, rayon, phaseCommune + (alea() - 0.5) * 0.3)

    const citerne = new THREE.Mesh(geometrie, matiereCiterne)
    citerne.name = `golgi-citerne-${i}`
    citerne.position.set(
      (alea() - 0.5) * 2 * DECALAGE_LATERAL,
      hauteur,
      (alea() - 0.5) * 2 * DECALAGE_LATERAL,
    )
    citerne.rotation.set(
      (alea() - 0.5) * 2 * INCLINAISON_MAX,
      0,
      (alea() - 0.5) * 2 * INCLINAISON_MAX,
    )
    groupe.add(citerne)

    rayons.push(rayon)
    hauteurs.push(hauteur)
  }

  const vesicules = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 12, 8),
    matiereVesicule,
    NOMBRE_VESICULES,
  )
  vesicules.name = 'golgi-vesicules'

  // Rayon 40 à 50 nm, soit 80 à 100 nm de diamètre : l'ordre de grandeur mesuré
  // pour les vésicules de transport, et pas un grain grossi pour la lisibilité.
  const tailleVesicule = (): number => 0.04 + alea() * 0.01

  // 1. Vésicules qui bourgeonnent au bord des citernes, là où les bourrelets se pincent.
  for (let i = 0; i < VESICULES_BORD; i++) {
    const k = Math.min(NOMBRE_CITERNES - 1, Math.floor(alea() * NOMBRE_CITERNES))
    const rayon = rayons[k]!
    const angle = alea() * Math.PI * 2
    const distance = rayon * (1.02 + alea() * 0.14)
    pion.position.set(
      distance * Math.cos(angle),
      hauteurs[k]! + creux(rayon) + (alea() - 0.5) * 0.05,
      distance * Math.sin(angle),
    )
    pion.scale.setScalar(tailleVesicule())
    pion.updateMatrix()
    vesicules.setMatrixAt(i, pion.matrix)
  }

  // 2. Panache qui s'éloigne de la face trans, en s'évasant vers la membrane.
  const hauteurTrans = hauteurCis + (NOMBRE_CITERNES - 1) * ESPACEMENT
  for (let i = 0; i < VESICULES_PLUME; i++) {
    const t = (i + 0.5) / VESICULES_PLUME
    const angle = alea() * Math.PI * 2
    const ecart = Math.sqrt(alea()) * (0.1 + 0.48 * t)
    pion.position.set(
      ecart * Math.cos(angle),
      hauteurTrans + 0.14 + t * 0.72 + (alea() - 0.5) * 0.08,
      ecart * Math.sin(angle),
    )
    pion.scale.setScalar(tailleVesicule())
    pion.updateMatrix()
    vesicules.setMatrixAt(VESICULES_BORD + i, pion.matrix)
  }

  vesicules.instanceMatrix.needsUpdate = true
  groupe.add(vesicules)

  // L'axe local +Y va de la cis vers la trans. On l'aligne sur le rayon
  // noyau → Golgi pour que la face cis regarde le noyau, avec une inclinaison
  // de 13° pour que la pile ne soit pas rigoureusement radiale.
  const versLaMembrane = CENTRE.clone().normalize()
  const orientation = new THREE.Quaternion().setFromUnitVectors(AXE_PILE, versLaMembrane)
  orientation.multiply(new THREE.Quaternion().setFromAxisAngle(AXE_INCLINAISON, 0.22))
  groupe.quaternion.copy(orientation)
  groupe.position.copy(CENTRE)

  return [
    {
      cle: 'golgi',
      nom: 'Appareil de Golgi',
      role: 'Trie, modifie et emballe les protéines venues du réticulum.',
      description:
        "Une pile de citernes aplaties et incurvées, empilées comme des assiettes creuses. " +
        "Les protéines entrent par la face cis, la plus large, tournée vers le noyau et le " +
        "réticulum ; elles traversent la pile citerne après citerne et ressortent par la face " +
        "trans sous forme de vésicules. À chaque étage, des enzymes différentes taillent et " +
        "complètent leurs chaînes de sucres : c'est la glycosylation. Le Golgi est le bureau de " +
        "tri de la cellule, il décide de la destination finale de chaque protéine.",
      chiffres: [
        { valeur: '4 à 8', quoi: 'citernes empilées dans un dictyosome' },
        { valeur: '≈ 25 min', quoi: "séjour moyen d'une protéine dans la pile" },
        { valeur: '60 à 100 nm', quoi: 'diamètre des vésicules de transport' },
        { valeur: 'cis → trans', quoi: 'sens du tri et de la glycosylation' },
      ],
      objet: groupe,
      // Au-dessus de la pile : les citernes atteignent 0,8 µm de rayon.
      ancre: CENTRE.clone().add(new THREE.Vector3(0.15, 1.05, 0)),
      couleur: TEINTES.golgi,
    },
  ]
}
