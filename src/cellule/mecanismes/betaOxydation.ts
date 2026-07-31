import * as THREE from 'three'
import { siegeMitochondrie, type Mecanisme } from './contrat.js'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'

/**
 * BÊTA-OXYDATION — POURQUOI LA GRAISSE EST LE MEILLEUR CARBURANT.
 *
 * Une voie métabolique n'est pas une soupe : c'est une chaîne de POSTES FIXES que
 * le substrat parcourt. Ici quatre enzymes disposées en boucle, et une chaîne
 * carbonée qui RACCOURCIT de deux carbones à chaque tour. C'est ce
 * raccourcissement progressif qui rend le mécanisme évident : le palmitate entre
 * avec seize carbones et ressort en huit acétyl-CoA.
 *
 * Trois choses doivent se voir, et dans cet ordre :
 *   — LA PORTE. Un acide gras ne traverse pas la membrane interne tout seul. Il
 *     est activé en acyl-CoA, le CoA est échangé contre la CARNITINE, l'ensemble
 *     traverse, puis la carnitine repart et le CoA est rendu de l'autre côté.
 *     C'est l'étape limitante de toute l'oxydation des graisses, donc le point de
 *     contrôle : on la montre en entier, et on montre la file qui attend dehors.
 *   — LA SPIRALE. Oxydation, hydratation, oxydation, thiolyse. Chaque réaction
 *     laisse sa marque sur la molécule : une double liaison, un hydroxyle, une
 *     cétone, puis la coupure.
 *   — LA RÉCOLTE. Par tour, 1 FADH₂ et 1 NADH partent vers la chaîne
 *     respiratoire, 1 acétyl-CoA part vers le cycle de Krebs. Un abaque tient les
 *     comptes en bas de l'image : 7, 7 et 8 pour un palmitate.
 *
 * Échelle : la mitochondrie et sa membrane sont à l'échelle vraie (1 unité = 1 µm).
 * Les molécules, elles, sont dessinées beaucoup trop grosses — un palmitate réel
 * fait 2 nm, il est ici long de 0,45 µm, soit deux cents fois trop. C'est un choix
 * de représentation : sans lui on ne pourrait pas compter les carbones, et compter
 * les carbones est tout l'objet de cette figure.
 */

// ── Position et étendue, en micromètres (1 unité = 1 µm) ────────────────────

/**
 * Matrice mitochondriale : une VRAIE mitochondrie, et non des coordonnées
 * littérales. Elles plaçaient la scène à 6,7 µm de la capsule la plus proche.
 */
const SIEGE = siegeMitochondrie(2)
/** Visé légèrement à gauche du centre géométrique : la porte compte autant que la roue. */
const ANCRE = SIEGE.clone().add(new THREE.Vector3(-0.14, -0.1, 0))

/**
 * Où partent l'acétyl-CoA et les transporteurs d'électrons.
 *
 * Ces deux vecteurs étaient écrits en dur : ils avaient été calculés à la main
 * comme la différence entre deux positions littérales, celles du cycle de Krebs
 * et de la chaîne respiratoire. Ces positions ayant changé, les flèches
 * pointaient au hasard dans le cytoplasme tout en prétendant désigner quelque
 * chose. On les CALCULE donc, depuis les mêmes placements que les mécanismes
 * visés — la flèche montre alors vraiment où va le produit.
 *
 * Le groupe n'étant ni tourné ni retourné, sa direction locale est aussi sa
 * direction monde, et la mise à l'échelle réelle est uniforme : les deux
 * conservent le vecteur.
 */
export const DIR_KREBS = siegeMitochondrie(1).sub(SIEGE).normalize()
export const DIR_CHAINE = siegeMitochondrie(0).sub(SIEGE).normalize()

/** La boucle des quatre enzymes. */
const CENTRE_BOUCLE_X = 0.24
const RAYON_BOUCLE = 0.36
/** Premier poste à 140°, puis un quart de tour dans le sens horaire. */
const ANGLE_POSTE_0 = 2.443
const PAS_ANGLE = -Math.PI / 2
/** Décalage en profondeur des postes : la boucle n'est pas une figure plate. */
const Z_POSTES = new Float32Array([0.06, -0.05, 0.05, -0.06])
/** Le substrat s'assied un peu en deçà de l'enzyme, vers le centre de la boucle. */
const RETRAIT_SITE = 0.1

/** Membrane interne : la paroi que l'acide gras ne peut pas franchir seul. */
const X_MEMBRANE = -0.5
const EPAISSEUR_MEMBRANE = 0.06

/** Appareil d'entrée : synthétase (cytosol), CPT1, translocase, CPT2 (matrice). */
const POSTES_ENTREE = new Float32Array([
  -0.86, 0.16, 0.06,
  -0.66, 0.02, 0.02,
  X_MEMBRANE, -0.02, 0.0,
  -0.32, 0.0, -0.02,
])
/** Où le CoA relâché par CPT1 s'en va : il reste dehors, il ne traverse pas. */
const SORTIE_COA = new THREE.Vector3(-0.82, -0.16, 0.12)
/** Où la carnitine repart : elle ressort par le même transporteur, en antiport. */
const RETOUR_CARNITINE = new THREE.Vector3(-0.74, 0.14, -0.1)

/** File d'attente cytosolique : le goulot d'étranglement se voit à la file. */
const ATTENTES = new Float32Array([-0.88, -0.28, 0.1, -0.82, 0.4, -0.1])
const NB_ATTENTE = 2

// ── La molécule ─────────────────────────────────────────────────────────────

/** Palmitate : seize carbones. */
const NB_CARBONES = 16
const PAS_CARBONE = 0.03
const RAYON_CARBONE = 0.0145
const AMPL_ZIGZAG = 0.016
/** Rayon de la pelote, tant que la chaîne n'est pas déployée dans la porte. */
const RAYON_PELOTE = 0.072

const RAYON_COA = 0.026
const RAYON_CARNITINE = 0.024
const RAYON_GROUPE = 0.017
const RAYON_NAVETTE = 0.024
const RAYON_ACETYL = 0.017
const RAYON_JETON = 0.019

// ── Durées d'écran, au ralenti ×5 ───────────────────────────────────────────

/** La porte : activation, échange contre la carnitine, passage, restitution du CoA. */
const T_ACTIVATION_FIN = 0.8
const T_CPT1_FIN = 1.55
const T_TRANSLOC_FIN = 2.35
const T_CPT2_FIN = 3.05
const T_APPROCHE_FIN = 3.6

/** Une étape = une réaction à un poste, puis la diffusion vers le suivant. */
const DUREE_REACTION = 0.26
const DUREE_TRANSIT = 0.19
const DUREE_ETAPE = DUREE_REACTION + DUREE_TRANSIT
const NB_TOURS = 7
const NB_ETAPES = NB_TOURS * 4
const T_SPIRALE_FIN = T_APPROCHE_FIN + NB_ETAPES * DUREE_ETAPE
/** Le temps de lire l'abaque complet avant que tout ne reparte à zéro. */
const DUREE_BILAN = 1.4
const DUREE_CYCLE = T_SPIRALE_FIN + DUREE_BILAN

// ── Récolte ────────────────────────────────────────────────────────────────

const NB_FADH2 = 7
const NB_NADH = 7
const NB_ACETYL = 8
const NB_JETONS = NB_FADH2 + NB_NADH + NB_ACETYL
/** Deux ATP consommés à l'activation : le seul coût de toute la voie. */
const NB_ATP = 2
const X_BILAN = 0.02
const PAS_BILAN = 0.052
const Y_BILAN_FAD = -0.68
const Y_BILAN_NAD = -0.76
const Y_BILAN_ACETYL = -0.84
const POS_ATP = new Float32Array([-0.93, 0.02, 0.06, -0.87, 0.02, 0.06])

// ── Navettes de cofacteurs ──────────────────────────────────────────────────

const NB_NAV_NAD = 9
const NB_NAV_FAD = 7
/** États d'une navette. */
const LIBRE = 0
const CAPTUREE = 1
const CHARGEE = 2
const ABSENTE = 3
/** Rayon d'errance dans la matrice, autour du centre de la boucle. */
const RAYON_ERRANCE = 0.52
const VITESSE_NAVETTE = 0.17
const TAU_DERIVE = 0.22
const FACTEUR_IMPULSION = 6.7
/**
 * Distance en dessous de laquelle une navette rebondit sur un poste.
 * C'est là que se voient les TRAJETS RATÉS : une navette qui touche l'enzyme
 * sans être prise repart sans rien avoir fait, et c'est le cas le plus fréquent.
 * Réglé sur le volume de l'enzyme (ses lobes portent à ~0,11) pour que les
 * rebonds soient assez nombreux à se voir sur dix secondes.
 */
const RAYON_REBOND = 0.13
/**
 * Vol vers la chaîne respiratoire, puis retour à vide dans la matrice.
 * La vitesse est réglée pour que le produit SORTE de la matrice à pleine taille :
 * un cofacteur qui s'éteint au milieu de la mitochondrie a l'air de s'y dissoudre,
 * alors qu'il doit avoir l'air de partir ailleurs.
 */
const VITESSE_VOL = 0.95
const DUREE_VOL = 1.3
const DUREE_RETOUR = 0.7

const NB_ACETYL_VOL = 8
const BILLES_ACETYL = 3
const VITESSE_ACETYL = 0.78
const DUREE_VOL_ACETYL = 1.3

/** Les trois lobes d'une enzyme : décalage x, y, z, puis rayon. */
const LOBES = new Float32Array([
  0.0, 0.03, 0.012, 0.062,
  0.052, -0.028, -0.014, 0.05,
  -0.05, -0.024, 0.02, 0.046,
])
const LOBES_PAR_ENZYME = 3

// ── Teintes, tenues d'une voie à l'autre ────────────────────────────────────

const TEINTE_CHAINE = TEINTES.cytosquelette
const TEINTE_COA = TEINTES.reticulumRugueux
const TEINTE_PORTE = TEINTES.lysosome
const TEINTE_ENZYME = TEINTES.mitochondrieCrete
const TEINTE_NAD = TEINTES.reticulumLisse
const TEINTE_FAD = TEINTES.vesicule
const TEINTE_ATP = TEINTES.ribosome
const TEINTE_ACETYL = TEINTES.golgi
const TEINTE_HYDROXYLE = 0xdcefff
const TEINTE_CETONE = 0x8f2d1a
/** Une liaison n'est pas une molécule : teinte neutre, qui n'appartient à personne. */
const TEINTE_LIAISON = TEINTES.centriole

// ── Temporaires hissés : animer() ne doit rien allouer ──────────────────────
const matriceTemp = new THREE.Matrix4()
const positionTemp = new THREE.Vector3()
const quaternionTemp = new THREE.Quaternion()
const echelleTemp = new THREE.Vector3(1, 1, 1)
const teteTemp = new THREE.Vector3()
const tetePrecedente = new THREE.Vector3()
const dirTraine = new THREE.Vector3(1, 0, 0)
const dirCible = new THREE.Vector3()
const perpA = new THREE.Vector3()
const perpB = new THREE.Vector3()
const vecA = new THREE.Vector3()
const vecB = new THREE.Vector3()
const posC1 = new THREE.Vector3()
const posC2 = new THREE.Vector3()
const posC3 = new THREE.Vector3()
const AXE_Y = new THREE.Vector3(0, 1, 0)
const AXE_Z = new THREE.Vector3(0, 0, 1)

/** Lissage cubique : les départs et les arrivées ne sont jamais brutaux. */
function lissage(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x
  return t * t * (3 - 2 * t)
}

function borner(x: number, bas: number, haut: number): number {
  return x < bas ? bas : x > haut ? haut : x
}

export function creerBetaOxydation(): Mecanisme[] {
  const alea = creerAlea(70_116)
  const groupe = new THREE.Group()
  groupe.position.copy(SIEGE)

  // ── Décor : la matrice, sa membrane interne, deux crêtes ──────────────────
  const geoSphere = new THREE.SphereGeometry(1, 28, 18)
  const geoDalle = new THREE.BoxGeometry(1, 1, 1)
  const geoBille = new THREE.IcosahedronGeometry(1, 1)
  const geoGrain = new THREE.IcosahedronGeometry(1, 0)
  const geoBarre = new THREE.CylinderGeometry(1, 1, 1, 6)

  const matrice = new THREE.Mesh(geoSphere, materiauOrganite(TEINTES.mitochondrie, { opacite: 0.1 }))
  matrice.position.set(0.2, 0, 0)
  matrice.scale.set(0.72, 0.6, 0.5)
  groupe.add(matrice)

  const membrane = new THREE.Mesh(geoDalle, materiauOrganite(TEINTES.mitochondrie, { opacite: 0.55 }))
  membrane.position.set(X_MEMBRANE, 0, 0)
  membrane.scale.set(EPAISSEUR_MEMBRANE, 1.06, 0.72)
  groupe.add(membrane)

  for (let c = 0; c < 2; c++) {
    const crete = new THREE.Mesh(geoDalle, materiauOrganite(TEINTE_ENZYME, { opacite: 0.6 }))
    crete.position.set(-0.3, c === 0 ? 0.4 : -0.4, 0)
    crete.scale.set(0.4, 0.05, 0.6)
    groupe.add(crete)
  }

  // ── Les postes ───────────────────────────────────────────────────────────
  // Quatre enzymes en boucle pour la spirale, quatre protéines en file pour la
  // porte. Ce sont des VOLUMES FIXES : le substrat va à elles, jamais l'inverse.
  const postesSpirale = new Float32Array(4 * 3)
  const sitesSpirale = new Float32Array(4 * 3)
  for (let k = 0; k < 4; k++) {
    const angle = ANGLE_POSTE_0 + k * PAS_ANGLE
    postesSpirale[k * 3] = CENTRE_BOUCLE_X + Math.cos(angle) * RAYON_BOUCLE
    postesSpirale[k * 3 + 1] = Math.sin(angle) * RAYON_BOUCLE
    postesSpirale[k * 3 + 2] = Z_POSTES[k]!
    sitesSpirale[k * 3] = CENTRE_BOUCLE_X + Math.cos(angle) * (RAYON_BOUCLE - RETRAIT_SITE)
    sitesSpirale[k * 3 + 1] = Math.sin(angle) * (RAYON_BOUCLE - RETRAIT_SITE)
    sitesSpirale[k * 3 + 2] = Z_POSTES[k]! * 0.6
  }

  const enzymesSpirale = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_ENZYME, { doubleFace: false }),
    4 * LOBES_PAR_ENZYME,
  )
  const enzymesPorte = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_PORTE, { doubleFace: false }),
    4 * LOBES_PAR_ENZYME,
  )
  enzymesSpirale.frustumCulled = false
  enzymesPorte.frustumCulled = false
  groupe.add(enzymesSpirale, enzymesPorte)

  /** Battement d'un poste quand la réaction s'y déroule : l'œil sait où regarder. */
  const pulseSpirale = new Float32Array(4)
  const pulsePorte = new Float32Array(4)

  const poserEnzyme = (
    maillage: THREE.InstancedMesh,
    indice: number,
    x: number,
    y: number,
    z: number,
    pulse: number,
  ): void => {
    for (let l = 0; l < LOBES_PAR_ENZYME; l++) {
      const ecart = 1 + 0.16 * pulse
      positionTemp.set(
        x + LOBES[l * 4]! * ecart,
        y + LOBES[l * 4 + 1]! * ecart,
        z + LOBES[l * 4 + 2]! * ecart,
      )
      echelleTemp.setScalar(LOBES[l * 4 + 3]! * (1 + 0.2 * pulse))
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      maillage.setMatrixAt(indice * LOBES_PAR_ENZYME + l, matriceTemp)
    }
  }

  // ── La chaîne carbonée suivie ────────────────────────────────────────────
  const carbones = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_CHAINE, { doubleFace: false }),
    NB_CARBONES,
  )
  carbones.frustumCulled = false
  groupe.add(carbones)

  /** Les acyl-CoA qui attendent leur tour dehors : la porte est le goulot. */
  const chainesAttente = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_CHAINE, { opacite: 0.7, doubleFace: false }),
    NB_ATTENTE * NB_CARBONES,
  )
  chainesAttente.frustumCulled = false
  groupe.add(chainesAttente)

  // Marqueurs de tête et groupes fonctionnels : un objet par rôle, allumé ou
  // éteint par `visible`. Aucune couleur n'est modifiée en cours de route.
  const coaTete = new THREE.Mesh(geoBille, materiauOrganite(TEINTE_COA, { doubleFace: false }))
  const carnitineTete = new THREE.Mesh(geoBille, materiauOrganite(TEINTE_PORTE, { doubleFace: false }))
  const coaEntrant = new THREE.Mesh(geoBille, materiauOrganite(TEINTE_COA, { doubleFace: false }))
  const groupeHydroxyle = new THREE.Mesh(geoGrain, materiauOrganite(TEINTE_HYDROXYLE, { doubleFace: false }))
  const groupeCetone = new THREE.Mesh(geoGrain, materiauOrganite(TEINTE_CETONE, { doubleFace: false }))
  const molEau = new THREE.Mesh(geoGrain, materiauOrganite(TEINTE_HYDROXYLE, { opacite: 0.8, doubleFace: false }))
  const liaisonDouble = new THREE.Mesh(geoBarre, materiauOrganite(TEINTE_LIAISON, { doubleFace: false }))
  groupe.add(coaTete, carnitineTete, coaEntrant, groupeHydroxyle, groupeCetone, molEau, liaisonDouble)

  // ── Navettes de la porte, en fond ────────────────────────────────────────
  // La carnitine fait la navette en permanence, indépendamment de la molécule
  // qu'on suit : la porte travaille pendant que la spirale tourne.
  const carnitinesFond = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_PORTE, { opacite: 0.75, doubleFace: false }),
    2,
  )
  const stubsFond = new THREE.InstancedMesh(
    geoGrain,
    materiauOrganite(TEINTE_CHAINE, { opacite: 0.7, doubleFace: false }),
    6,
  )
  carnitinesFond.frustumCulled = false
  stubsFond.frustumCulled = false
  groupe.add(carnitinesFond, stubsFond)

  // ── Cofacteurs : vides translucides, chargés pleins et lumineux ───────────
  const nadVides = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_NAD, { opacite: 0.4, doubleFace: false }),
    NB_NAV_NAD,
  )
  const nadCharges = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_NAD, { emissif: 0x00301f, doubleFace: false }),
    NB_NAV_NAD,
  )
  const fadVides = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_FAD, { opacite: 0.4, doubleFace: false }),
    NB_NAV_FAD,
  )
  const fadCharges = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_FAD, { emissif: 0x3a2600, doubleFace: false }),
    NB_NAV_FAD,
  )
  nadVides.frustumCulled = false
  nadCharges.frustumCulled = false
  fadVides.frustumCulled = false
  fadCharges.frustumCulled = false
  groupe.add(nadVides, nadCharges, fadVides, fadCharges)

  const acetyls = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_ACETYL, { doubleFace: false }),
    NB_ACETYL_VOL * BILLES_ACETYL,
  )
  acetyls.frustumCulled = false
  groupe.add(acetyls)

  // ── L'abaque : ce qui entre, ce qui sort ─────────────────────────────────
  const jetonsVides = new THREE.InstancedMesh(
    geoGrain,
    materiauOrganite(TEINTES.centriole, { opacite: 0.3, doubleFace: false }),
    NB_JETONS + NB_ATP,
  )
  const jetonsFad = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_FAD, { emissif: 0x3a2600, doubleFace: false }),
    NB_FADH2,
  )
  const jetonsNad = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_NAD, { emissif: 0x00301f, doubleFace: false }),
    NB_NADH,
  )
  const jetonsAcetyl = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_ACETYL, { doubleFace: false }),
    NB_ACETYL,
  )
  const jetonsAtp = new THREE.InstancedMesh(
    geoBille,
    materiauOrganite(TEINTE_ATP, { emissif: 0x3a1400, doubleFace: false }),
    NB_ATP,
  )
  jetonsVides.frustumCulled = false
  jetonsFad.frustumCulled = false
  jetonsNad.frustumCulled = false
  jetonsAcetyl.frustumCulled = false
  jetonsAtp.frustumCulled = false
  groupe.add(jetonsVides, jetonsFad, jetonsNad, jetonsAcetyl, jetonsAtp)

  /** Emplacement d'un jeton de l'abaque. */
  const positionJeton = (rang: number, cible: THREE.Vector3): void => {
    if (rang < NB_FADH2) cible.set(X_BILAN + rang * PAS_BILAN, Y_BILAN_FAD, 0)
    else if (rang < NB_FADH2 + NB_NADH) cible.set(X_BILAN + (rang - NB_FADH2) * PAS_BILAN, Y_BILAN_NAD, 0)
    else cible.set(X_BILAN + (rang - NB_FADH2 - NB_NADH) * PAS_BILAN, Y_BILAN_ACETYL, 0)
  }

  // Les emplacements vides sont posés une fois pour toutes : on voit d'un coup
  // d'œil « trois sur sept », ce qu'un compteur qui n'affiche que le plein ne dit pas.
  echelleTemp.setScalar(RAYON_JETON * 0.55)
  for (let j = 0; j < NB_JETONS; j++) {
    positionJeton(j, positionTemp)
    matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
    jetonsVides.setMatrixAt(j, matriceTemp)
  }
  for (let a = 0; a < NB_ATP; a++) {
    positionTemp.set(POS_ATP[a * 3]!, POS_ATP[a * 3 + 1]!, POS_ATP[a * 3 + 2]!)
    matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
    jetonsVides.setMatrixAt(NB_JETONS + a, matriceTemp)
  }
  jetonsVides.instanceMatrix.needsUpdate = true
  echelleTemp.setScalar(1)

  /** Remplissage lissé de chaque jeton : les compteurs ne sautent pas. */
  const remplissage = new Float32Array(NB_JETONS)

  // ── États des navettes ───────────────────────────────────────────────────
  const posNad = new Float32Array(NB_NAV_NAD * 3)
  const vitNad = new Float32Array(NB_NAV_NAD * 3)
  const etatNad = new Uint8Array(NB_NAV_NAD)
  const ageNad = new Float32Array(NB_NAV_NAD)
  const posFad = new Float32Array(NB_NAV_FAD * 3)
  const vitFad = new Float32Array(NB_NAV_FAD * 3)
  const etatFad = new Uint8Array(NB_NAV_FAD)
  const ageFad = new Float32Array(NB_NAV_FAD)

  /** Sème une navette quelque part dans la matrice, à l'écart des postes. */
  const semer = (pos: Float32Array, indice: number): void => {
    for (let essai = 0; essai < 20; essai++) {
      const u = alea() * 2 - 1
      const theta = alea() * Math.PI * 2
      const r = Math.cbrt(alea()) * RAYON_ERRANCE
      const s = Math.sqrt(Math.max(0, 1 - u * u))
      const x = CENTRE_BOUCLE_X + r * s * Math.cos(theta)
      const y = r * u * 0.85
      const z = r * s * Math.sin(theta) * 0.7
      let libre = true
      for (let k = 0; k < 4; k++) {
        const dx = x - postesSpirale[k * 3]!
        const dy = y - postesSpirale[k * 3 + 1]!
        const dz = z - postesSpirale[k * 3 + 2]!
        if (dx * dx + dy * dy + dz * dz < RAYON_REBOND * RAYON_REBOND) libre = false
      }
      if (libre) {
        pos[indice * 3] = x
        pos[indice * 3 + 1] = y
        pos[indice * 3 + 2] = z
        return
      }
    }
    pos[indice * 3] = CENTRE_BOUCLE_X
    pos[indice * 3 + 1] = 0
    pos[indice * 3 + 2] = 0
  }

  for (let n = 0; n < NB_NAV_NAD; n++) {
    semer(posNad, n)
    etatNad[n] = LIBRE
  }
  for (let n = 0; n < NB_NAV_FAD; n++) {
    semer(posFad, n)
    etatFad[n] = LIBRE
  }

  // ── Acétyl-CoA en vol ────────────────────────────────────────────────────
  const posAcetyl = new Float32Array(NB_ACETYL_VOL * 3)
  const dirAcetyl = new Float32Array(NB_ACETYL_VOL * 3)
  const ageAcetyl = new Float32Array(NB_ACETYL_VOL)
  for (let a = 0; a < NB_ACETYL_VOL; a++) ageAcetyl[a] = DUREE_VOL_ACETYL + 1
  let prochainAcetyl = 0

  // ── Errance des transits, tirée à chaque étape ───────────────────────────
  /** Écart radial et écart en z du trajet, plus le dépassement de la cible. */
  let derivRayon = 0
  let derivZ = 0
  let depassement = 0
  /** Point d'approche du cofacteur, de l'eau, du CoA libre. */
  let approcheX = 0
  let approcheY = 0
  let approcheZ = 0

  let navFadCapturee = -1
  let navNadCapturee = -1

  /** Prend la navette libre la plus proche du poste : personne ne vise personne. */
  const capturer = (pos: Float32Array, etat: Uint8Array, nb: number, poste: number): number => {
    let meilleur = -1
    let meilleureDistance = Number.POSITIVE_INFINITY
    for (let n = 0; n < nb; n++) {
      if (etat[n] !== LIBRE) continue
      const dx = pos[n * 3]! - sitesSpirale[poste * 3]!
      const dy = pos[n * 3 + 1]! - sitesSpirale[poste * 3 + 1]!
      const dz = pos[n * 3 + 2]! - sitesSpirale[poste * 3 + 2]!
      const d = dx * dx + dy * dy + dz * dz
      if (d < meilleureDistance) {
        meilleureDistance = d
        meilleur = n
      }
    }
    if (meilleur >= 0) etat[meilleur] = CAPTUREE
    return meilleur
  }

  /** Lance une navette chargée vers la chaîne respiratoire. */
  const lancerNavette = (etat: Uint8Array, age: Float32Array, indice: number): void => {
    if (indice < 0) return
    etat[indice] = CHARGEE
    age[indice] = 0
  }

  /** Émet un acétyl-CoA depuis la tête de la chaîne, vers le cycle de Krebs. */
  const emettreAcetyl = (): void => {
    const a = prochainAcetyl
    prochainAcetyl = (prochainAcetyl + 1) % NB_ACETYL_VOL
    posAcetyl[a * 3] = teteTemp.x
    posAcetyl[a * 3 + 1] = teteTemp.y
    posAcetyl[a * 3 + 2] = teteTemp.z
    dirAcetyl[a * 3] = DIR_KREBS.x + (alea() - 0.5) * 0.3
    dirAcetyl[a * 3 + 1] = DIR_KREBS.y + (alea() - 0.5) * 0.3
    dirAcetyl[a * 3 + 2] = DIR_KREBS.z + (alea() - 0.5) * 0.3
    ageAcetyl[a] = 0
  }

  // ── Horloge et compteurs du cycle ────────────────────────────────────────
  /** Pas de temps de l'image courante, partagé par les routines d'animation.
   *  Hissé ici et non recalculé dans une fonction interne : une fonction définie
   *  DANS animer() serait une allocation par image. */
  let dt = 0
  let amorti = 0
  let racineDt = 0
  let prise = 0
  let tempsPrecedent = 0
  let cycleEnCours = -1
  /** Étapes dont la réaction est consommée, et étapes déjà préparées. */
  let reactionsFaites = 0
  let etapesPreparees = 0
  let phaseZigzag = 0

  /** Prépare l'étape e : tire son errance, et appelle le cofacteur s'il en faut un. */
  const preparerEtape = (e: number): void => {
    const leg = e % 4
    derivRayon = (alea() - 0.5) * 0.16
    derivZ = (alea() - 0.5) * 0.14
    depassement = (alea() - 0.5) * 0.5
    const suivant = (leg + 1) % 4
    approcheX = sitesSpirale[suivant * 3]! + (alea() - 0.5) * 0.22
    approcheY = sitesSpirale[suivant * 3 + 1]! + (alea() - 0.5) * 0.22
    approcheZ = sitesSpirale[suivant * 3 + 2]! + (alea() - 0.5) * 0.16
    if (leg === 0) navFadCapturee = capturer(posFad, etatFad, NB_NAV_FAD, 0)
    else if (leg === 2) navNadCapturee = capturer(posNad, etatNad, NB_NAV_NAD, 2)
  }

  /** Consomme la réaction de l'étape e : c'est là que les produits partent. */
  const finaliserEtape = (e: number): void => {
    const leg = e % 4
    if (leg === 0) {
      lancerNavette(etatFad, ageFad, navFadCapturee)
      navFadCapturee = -1
    } else if (leg === 2) {
      lancerNavette(etatNad, ageNad, navNadCapturee)
      navNadCapturee = -1
    } else if (leg === 3) {
      // Thiolyse : les deux carbones de tête partent en acétyl-CoA. Au septième
      // tour il ne reste que quatre carbones, et la coupure en donne DEUX.
      emettreAcetyl()
      if (e === NB_ETAPES - 1) emettreAcetyl()
    }
  }

  /** Remet la molécule suivie à zéro : un nouveau palmitate se présente. */
  const reinitialiser = (): void => {
    reactionsFaites = 0
    etapesPreparees = 0
    if (navFadCapturee >= 0) etatFad[navFadCapturee] = LIBRE
    if (navNadCapturee >= 0) etatNad[navNadCapturee] = LIBRE
    navFadCapturee = -1
    navNadCapturee = -1
  }

  /**
   * Une famille de navettes : vides elles errent, capturées elles sont amenées
   * au poste, chargées elles partent vers la chaîne respiratoire, puis elles
   * reviennent vides. Définie ICI et non dans animer() : une fonction créée dans
   * animer() serait une allocation par image.
   */
  const animerNavettes = (
    pos: Float32Array,
    vit: Float32Array,
    etat: Uint8Array,
    age: Float32Array,
    nb: number,
    poste: number,
    vides: THREE.InstancedMesh,
    charges: THREE.InstancedMesh,
  ): void => {
    const impulsion = VITESSE_NAVETTE * FACTEUR_IMPULSION * racineDt
    for (let n = 0; n < nb; n++) {
      const n3 = n * 3
      const e = etat[n]!
      let taille = RAYON_NAVETTE
      if (e === LIBRE) {
        for (let c = 0; c < 3; c++) {
          vit[n3 + c] = vit[n3 + c]! * amorti + (alea() - 0.5) * impulsion
          pos[n3 + c] = pos[n3 + c]! + vit[n3 + c]! * dt
        }
        // Rappel dans la matrice.
        const dx = pos[n3]! - CENTRE_BOUCLE_X
        const dy = pos[n3 + 1]!
        const dz = pos[n3 + 2]!
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (r > RAYON_ERRANCE) {
          const f = RAYON_ERRANCE / r
          pos[n3] = CENTRE_BOUCLE_X + dx * f
          pos[n3 + 1] = dy * f
          pos[n3 + 2] = dz * f
          vit[n3] = -vit[n3]! * 0.6
          vit[n3 + 1] = -vit[n3 + 1]! * 0.6
          vit[n3 + 2] = -vit[n3 + 2]! * 0.6
        }
        // Rebond sur les postes : la plupart des rencontres ne donnent RIEN.
        for (let k = 0; k < 4; k++) {
          const px = pos[n3]! - postesSpirale[k * 3]!
          const py = pos[n3 + 1]! - postesSpirale[k * 3 + 1]!
          const pz = pos[n3 + 2]! - postesSpirale[k * 3 + 2]!
          const d = Math.sqrt(px * px + py * py + pz * pz)
          if (d >= RAYON_REBOND || d < 1e-6) continue
          const f = RAYON_REBOND / d
          pos[n3] = postesSpirale[k * 3]! + px * f
          pos[n3 + 1] = postesSpirale[k * 3 + 1]! + py * f
          pos[n3 + 2] = postesSpirale[k * 3 + 2]! + pz * f
          vit[n3] = (px / d) * VITESSE_NAVETTE
          vit[n3 + 1] = (py / d) * VITESSE_NAVETTE
          vit[n3 + 2] = (pz / d) * VITESSE_NAVETTE
        }
        age[n] = Math.min(1, age[n]! + dt * 3)
        taille *= Math.min(1, age[n]!)
      } else if (e === CAPTUREE) {
        // Amenée au poste : elle n'y allait pas, elle y a été prise.
        pos[n3] = pos[n3]! + (sitesSpirale[poste * 3]! + 0.05 - pos[n3]!) * prise
        pos[n3 + 1] = pos[n3 + 1]! + (sitesSpirale[poste * 3 + 1]! + 0.05 - pos[n3 + 1]!) * prise
        pos[n3 + 2] = pos[n3 + 2]! + (sitesSpirale[poste * 3 + 2]! - pos[n3 + 2]!) * prise
        vit[n3] = 0
        vit[n3 + 1] = 0
        vit[n3 + 2] = 0
      } else if (e === CHARGEE) {
        age[n] = age[n]! + dt
        pos[n3] = pos[n3]! + DIR_CHAINE.x * VITESSE_VOL * dt
        pos[n3 + 1] = pos[n3 + 1]! + DIR_CHAINE.y * VITESSE_VOL * dt
        pos[n3 + 2] = pos[n3 + 2]! + DIR_CHAINE.z * VITESSE_VOL * dt
        // Elle ne s'efface que sur le dernier quart, une fois la matrice quittée.
        taille *= 1.2 * (1 - lissage((age[n]! - DUREE_VOL * 0.75) / (DUREE_VOL * 0.25)))
        if (age[n]! >= DUREE_VOL) {
          etat[n] = ABSENTE
          age[n] = 0
        }
      } else {
        taille = 0
        age[n] = age[n]! + dt
        if (age[n]! >= DUREE_RETOUR) {
          semer(pos, n)
          vit[n3] = 0
          vit[n3 + 1] = 0
          vit[n3 + 2] = 0
          etat[n] = LIBRE
          age[n] = 0
        }
      }

      positionTemp.set(pos[n3]!, pos[n3 + 1]!, pos[n3 + 2]!)
      const chargee = e === CHARGEE
      echelleTemp.setScalar(chargee ? taille : 0)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      charges.setMatrixAt(n, matriceTemp)
      echelleTemp.setScalar(chargee ? 0 : taille)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      vides.setMatrixAt(n, matriceTemp)
    }
    vides.instanceMatrix.needsUpdate = true
    charges.instanceMatrix.needsUpdate = true
  }

  // ── Animation ────────────────────────────────────────────────────────────
  const animer = (temps: number): void => {
    // Pas borné : une image sautée ne doit pas téléporter la scène. Affectations
    // et non déclarations : `animerNavettes` lit ces mêmes variables.
    dt = Math.min(0.05, Math.max(0, temps - tempsPrecedent))
    tempsPrecedent = temps
    amorti = Math.exp(-dt / TAU_DERIVE)
    racineDt = Math.sqrt(dt)
    prise = 1 - Math.exp(-dt * 8)

    const cycle = Math.floor(temps / DUREE_CYCLE)
    if (cycle !== cycleEnCours) {
      cycleEnCours = cycle
      reinitialiser()
    }
    const tCycle = temps - cycle * DUREE_CYCLE

    // 1. Où en est la spirale.
    const tSpirale = tCycle - T_APPROCHE_FIN
    let etape = 0
    let avancementReaction = 0
    let avancementTransit = 0
    if (tSpirale > 0) {
      etape = Math.min(NB_ETAPES - 1, Math.floor(tSpirale / DUREE_ETAPE))
      const u = tSpirale - etape * DUREE_ETAPE
      avancementReaction = borner(u / DUREE_REACTION, 0, 1)
      avancementTransit = borner((u - DUREE_REACTION) / DUREE_TRANSIT, 0, 1)
    }
    const leg = etape % 4
    const dansLaSpirale = tSpirale > 0 && tCycle < T_SPIRALE_FIN

    let etapesEntrees = 0
    let reactionsAttendues = 0
    if (tSpirale > 0) {
      etapesEntrees = Math.min(NB_ETAPES, Math.floor(tSpirale / DUREE_ETAPE) + 1)
      reactionsAttendues = Math.min(
        NB_ETAPES,
        Math.floor(tSpirale / DUREE_ETAPE) + (avancementReaction >= 1 ? 1 : 0),
      )
    }
    while (etapesPreparees < etapesEntrees) {
      preparerEtape(etapesPreparees)
      etapesPreparees++
    }

    // 2. La tête de la chaîne, phase par phase.
    let deploiement = 1
    let visibleCoa = 1
    let visibleCarnitine = 0
    let derivationCoa = 0
    let derivationCarnitine = 0
    let atpRestant = 0
    const fremissement = Math.sin(temps * 6.1) * 0.006

    if (tCycle < T_ACTIVATION_FIN) {
      // ACTIVATION. L'acide gras reçoit son coenzyme A, et cela coûte deux ATP :
      // c'est le seul investissement de toute la voie.
      const w = lissage(tCycle / T_ACTIVATION_FIN)
      teteTemp.set(
        POSTES_ENTREE[0]! + 0.05 + fremissement,
        POSTES_ENTREE[1]! - 0.05 + Math.cos(temps * 5.3) * 0.006,
        POSTES_ENTREE[2]!,
      )
      deploiement = 0
      visibleCoa = w
      atpRestant = 1 - w
    } else if (tCycle < T_CPT1_FIN) {
      // CPT1. Le CoA est échangé contre la CARNITINE. Le CoA reste dehors.
      const w = lissage((tCycle - T_ACTIVATION_FIN) / (T_CPT1_FIN - T_ACTIVATION_FIN))
      vecA.set(POSTES_ENTREE[0]! + 0.05, POSTES_ENTREE[1]! - 0.05, POSTES_ENTREE[2]!)
      vecB.set(POSTES_ENTREE[3]!, POSTES_ENTREE[4]!, POSTES_ENTREE[5]!)
      teteTemp.lerpVectors(vecA, vecB, w)
      deploiement = 0.25 * w
      visibleCoa = 1 - lissage((w - 0.3) / 0.5)
      derivationCoa = 1 - visibleCoa
      visibleCarnitine = lissage((w - 0.45) / 0.5)
    } else if (tCycle < T_TRANSLOC_FIN) {
      // TRANSLOCATION. L'acylcarnitine traverse la membrane interne par la
      // translocase — et c'est cette traversée qui limite toute l'oxydation.
      const w = lissage((tCycle - T_CPT1_FIN) / (T_TRANSLOC_FIN - T_CPT1_FIN))
      if (w < 0.5) {
        vecA.set(POSTES_ENTREE[3]!, POSTES_ENTREE[4]!, POSTES_ENTREE[5]!)
        vecB.set(POSTES_ENTREE[6]!, POSTES_ENTREE[7]!, POSTES_ENTREE[8]!)
        teteTemp.lerpVectors(vecA, vecB, w * 2)
      } else {
        vecA.set(POSTES_ENTREE[6]!, POSTES_ENTREE[7]!, POSTES_ENTREE[8]!)
        vecB.set(POSTES_ENTREE[9]!, POSTES_ENTREE[10]!, POSTES_ENTREE[11]!)
        teteTemp.lerpVectors(vecA, vecB, (w - 0.5) * 2)
      }
      // La chaîne se déploie pour s'enfiler : une pelote ne passe pas une porte.
      deploiement = 0.25 + 0.75 * w
      visibleCoa = 0
      visibleCarnitine = 1
    } else if (tCycle < T_CPT2_FIN) {
      // CPT2. La carnitine repart en antiport, un CoA de la MATRICE prend sa place.
      const w = lissage((tCycle - T_TRANSLOC_FIN) / (T_CPT2_FIN - T_TRANSLOC_FIN))
      teteTemp.set(
        POSTES_ENTREE[9]! + fremissement,
        POSTES_ENTREE[10]! + Math.cos(temps * 5.7) * 0.006,
        POSTES_ENTREE[11]!,
      )
      visibleCarnitine = 1 - lissage(w / 0.6)
      derivationCarnitine = 1 - visibleCarnitine
      visibleCoa = lissage((w - 0.35) / 0.6)
    } else if (tCycle < T_APPROCHE_FIN) {
      // Diffusion vers la première enzyme. Rien ne guide la molécule.
      const w = (tCycle - T_CPT2_FIN) / (T_APPROCHE_FIN - T_CPT2_FIN)
      vecA.set(POSTES_ENTREE[9]!, POSTES_ENTREE[10]!, POSTES_ENTREE[11]!)
      vecB.set(sitesSpirale[0]!, sitesSpirale[1]!, sitesSpirale[2]!)
      teteTemp.lerpVectors(vecA, vecB, lissage(w))
      teteTemp.y += Math.sin(w * Math.PI) * 0.12
      teteTemp.z += Math.sin(w * Math.PI * 2 + 1.1) * 0.05
    } else if (dansLaSpirale) {
      const angleDepart = ANGLE_POSTE_0 + leg * PAS_ANGLE
      if (avancementTransit <= 0) {
        // Réaction : la molécule est tenue au poste, elle ne fait que frémir.
        teteTemp.set(
          sitesSpirale[leg * 3]! + fremissement,
          sitesSpirale[leg * 3 + 1]! + Math.cos(temps * 5.9) * 0.006,
          sitesSpirale[leg * 3 + 2]!,
        )
      } else {
        // Transit : marche errante entre deux postes, avec dépassement. Aucune
        // molécule ne sait où elle va — elle rencontre l'enzyme par collision.
        const v = avancementTransit
        const w = lissage(v) + depassement * Math.sin(v * Math.PI) * 0.35
        const angle = angleDepart + PAS_ANGLE * w
        const rayon = RAYON_BOUCLE - RETRAIT_SITE + derivRayon * Math.sin(v * Math.PI)
        teteTemp.set(
          CENTRE_BOUCLE_X + Math.cos(angle) * rayon + Math.sin(temps * 9.3) * 0.008,
          Math.sin(angle) * rayon + Math.cos(temps * 8.1) * 0.008,
          Z_POSTES[leg]! * 0.6 + derivZ * Math.sin(v * Math.PI),
        )
      }
    } else {
      // Bilan : la chaîne a disparu, l'abaque reste seul à l'écran.
      teteTemp.set(sitesSpirale[9]!, sitesSpirale[10]!, sitesSpirale[11]!)
    }

    // 3. Les réactions consommées. La tête est connue : les produits partent d'elle.
    while (reactionsFaites < reactionsAttendues) {
      finaliserEtape(reactionsFaites)
      reactionsFaites++
    }

    // Longueur restante : deux carbones de moins par thiolyse, rien au bout.
    const nbCarbones =
      reactionsFaites >= NB_ETAPES ? 0 : NB_CARBONES - 2 * Math.floor(reactionsFaites / 4)

    // 4. Orientation de la traîne : la chaîne suit la tête, elle ne la précède pas.
    dirCible.subVectors(tetePrecedente, teteTemp)
    if (dirCible.lengthSq() > 1e-8) {
      dirCible.normalize()
      dirTraine.lerp(dirCible, 1 - Math.exp(-dt * 5))
      if (dirTraine.lengthSq() > 1e-8) dirTraine.normalize()
    }
    tetePrecedente.copy(teteTemp)
    perpA.crossVectors(dirTraine, AXE_Z)
    if (perpA.lengthSq() < 1e-6) perpA.crossVectors(dirTraine, AXE_Y)
    perpA.normalize()
    perpB.crossVectors(dirTraine, perpA).normalize()

    // 5. Les marques de chaque réaction sur la molécule.
    //    Double liaison à l'oxydation, hydroxyle à l'hydratation, cétone à la
    //    seconde oxydation, puis la coupure. Chaque étape se VOIT sur le substrat.
    let barre = 0
    let hydroxyle = 0
    let cetone = 0
    if (dansLaSpirale) {
      if (leg === 0) barre = avancementReaction
      else if (leg === 1) {
        barre = 1 - avancementReaction
        hydroxyle = avancementReaction
      } else if (leg === 2) {
        hydroxyle = 1 - avancementReaction
        cetone = avancementReaction
      } else cetone = 1 - avancementReaction
    }

    phaseZigzag += dt * 2.4

    // 6. Rendu de la chaîne : pelote enroulée dehors, chaîne étirée dedans.
    for (let i = 0; i < NB_CARBONES; i++) {
      if (i >= nbCarbones) {
        echelleTemp.setScalar(0)
        positionTemp.set(0, 0, 0)
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        carbones.setMatrixAt(i, matriceTemp)
        continue
      }
      // La double liaison rapproche C2 et C3 : la géométrie dit la chimie.
      const recul = i * PAS_CARBONE - (i >= 2 ? barre * 0.009 : 0)
      const onde = Math.sin(i * 1.9 + phaseZigzag) * AMPL_ZIGZAG
      const onde2 = Math.cos(i * 1.3 + phaseZigzag * 0.7) * AMPL_ZIGZAG * 0.5
      vecB.copy(teteTemp)
      vecB.addScaledVector(dirTraine, recul)
      vecB.addScaledVector(perpA, onde)
      vecB.addScaledVector(perpB, onde2)

      const anglePelote = i * 2.2 + phaseZigzag * 0.5
      const rayonPelote = RAYON_PELOTE * (0.45 + 0.55 * Math.sin(i * 0.55 + 0.7))
      vecA.set(
        teteTemp.x + Math.cos(anglePelote) * rayonPelote,
        teteTemp.y + Math.sin(anglePelote) * rayonPelote,
        teteTemp.z + (i / NB_CARBONES - 0.5) * 0.1,
      )

      positionTemp.lerpVectors(vecA, vecB, deploiement)
      if (i === 0) posC1.copy(positionTemp)
      else if (i === 1) posC2.copy(positionTemp)
      else if (i === 2) posC3.copy(positionTemp)
      echelleTemp.setScalar(RAYON_CARBONE)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      carbones.setMatrixAt(i, matriceTemp)
    }
    carbones.instanceMatrix.needsUpdate = true

    // 7. Tête de la chaîne : le CoA, ou la carnitine pendant la traversée.
    const visible = nbCarbones > 0
    coaTete.visible = visible && visibleCoa > 0.02
    if (coaTete.visible) {
      positionTemp.copy(posC1).addScaledVector(dirTraine, -0.032)
      if (derivationCoa > 0) positionTemp.lerp(SORTIE_COA, derivationCoa)
      coaTete.position.copy(positionTemp)
      coaTete.scale.setScalar(RAYON_COA * (0.3 + 0.7 * visibleCoa))
    }
    carnitineTete.visible = visible && visibleCarnitine > 0.02
    if (carnitineTete.visible) {
      positionTemp.copy(posC1).addScaledVector(dirTraine, -0.032)
      if (derivationCarnitine > 0) positionTemp.lerp(RETOUR_CARNITINE, derivationCarnitine)
      carnitineTete.position.copy(positionTemp)
      carnitineTete.scale.setScalar(RAYON_CARNITINE * (0.3 + 0.7 * visibleCarnitine))
    }

    // 8. Groupes fonctionnels portés par C3, et barre de la double liaison.
    groupeHydroxyle.visible = visible && hydroxyle > 0.03
    if (groupeHydroxyle.visible) {
      positionTemp.copy(posC3).addScaledVector(perpA, 0.026)
      groupeHydroxyle.position.copy(positionTemp)
      groupeHydroxyle.scale.setScalar(RAYON_GROUPE * hydroxyle)
    }
    groupeCetone.visible = visible && cetone > 0.03
    if (groupeCetone.visible) {
      positionTemp.copy(posC3).addScaledVector(perpA, 0.03)
      groupeCetone.position.copy(positionTemp)
      groupeCetone.scale.setScalar(RAYON_GROUPE * 1.2 * cetone)
    }
    liaisonDouble.visible = visible && barre > 0.03
    if (liaisonDouble.visible) {
      vecA.subVectors(posC3, posC2)
      const longueur = vecA.length()
      if (longueur > 1e-6) {
        vecA.multiplyScalar(1 / longueur)
        quaternionTemp.setFromUnitVectors(AXE_Y, vecA)
        positionTemp.lerpVectors(posC2, posC3, 0.5)
        liaisonDouble.position.copy(positionTemp)
        liaisonDouble.quaternion.copy(quaternionTemp)
        liaisonDouble.scale.set(0.006 * barre, longueur, 0.006 * barre)
        quaternionTemp.identity()
      }
    }

    // 9. L'eau qui s'additionne, le CoA libre qui vient couper.
    molEau.visible = dansLaSpirale && leg === 1 && avancementReaction < 0.98
    if (molEau.visible) {
      vecA.set(approcheX, approcheY, approcheZ)
      positionTemp.lerpVectors(vecA, posC3, lissage(avancementReaction))
      molEau.position.copy(positionTemp)
      molEau.scale.setScalar(RAYON_GROUPE * 0.8 * (1 - lissage((avancementReaction - 0.8) / 0.2)))
    }
    coaEntrant.visible = dansLaSpirale && leg === 3 && avancementReaction < 0.98
    if (coaEntrant.visible) {
      vecA.set(approcheX, approcheY, approcheZ)
      positionTemp.lerpVectors(vecA, posC1, lissage(avancementReaction))
      coaEntrant.position.copy(positionTemp)
      coaEntrant.scale.setScalar(RAYON_COA * (1 - lissage((avancementReaction - 0.75) / 0.25)))
    }

    // 10. Les chaînes qui attendent dehors : rien n'entre tant que la porte
    //     n'a pas fini. La file EST le point de contrôle.
    for (let c = 0; c < NB_ATTENTE; c++) {
      const cx = ATTENTES[c * 3]!
      const cy = ATTENTES[c * 3 + 1]!
      const cz = ATTENTES[c * 3 + 2]!
      for (let i = 0; i < NB_CARBONES; i++) {
        const angle = i * 2.2 + phaseZigzag * 0.35 + c * 1.7
        const r = RAYON_PELOTE * (0.45 + 0.55 * Math.sin(i * 0.55 + 0.7 + c))
        positionTemp.set(
          cx + Math.cos(angle) * r,
          cy + Math.sin(angle) * r,
          cz + (i / NB_CARBONES - 0.5) * 0.1,
        )
        echelleTemp.setScalar(RAYON_CARBONE * 0.9)
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        chainesAttente.setMatrixAt(c * NB_CARBONES + i, matriceTemp)
      }
    }
    chainesAttente.instanceMatrix.needsUpdate = true

    // 11. Les navettes. Vides elles errent, chargées elles partent vers la
    //     chaîne respiratoire, puis reviennent vides : c'est le lien entre les voies.
    animerNavettes(posFad, vitFad, etatFad, ageFad, NB_NAV_FAD, 0, fadVides, fadCharges)
    animerNavettes(posNad, vitNad, etatNad, ageNad, NB_NAV_NAD, 2, nadVides, nadCharges)

    // 12. Les acétyl-CoA qui partent vers le cycle de Krebs.
    for (let a = 0; a < NB_ACETYL_VOL; a++) {
      const age = ageAcetyl[a]!
      if (age >= DUREE_VOL_ACETYL) {
        echelleTemp.setScalar(0)
        positionTemp.set(0, 0, 0)
        for (let b = 0; b < BILLES_ACETYL; b++) {
          matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
          acetyls.setMatrixAt(a * BILLES_ACETYL + b, matriceTemp)
        }
        continue
      }
      ageAcetyl[a] = age + dt
      const a3 = a * 3
      posAcetyl[a3] = posAcetyl[a3]! + dirAcetyl[a3]! * VITESSE_ACETYL * dt
      posAcetyl[a3 + 1] = posAcetyl[a3 + 1]! + dirAcetyl[a3 + 1]! * VITESSE_ACETYL * dt
      posAcetyl[a3 + 2] = posAcetyl[a3 + 2]! + dirAcetyl[a3 + 2]! * VITESSE_ACETYL * dt
      // Comme les cofacteurs : il ne s'efface qu'après avoir quitté la matrice.
      const fondu = Math.min(1, age * 10, (DUREE_VOL_ACETYL - age) * 3.1)
      for (let b = 0; b < BILLES_ACETYL; b++) {
        positionTemp.set(
          posAcetyl[a3]! + dirAcetyl[a3]! * b * 0.028,
          posAcetyl[a3 + 1]! + dirAcetyl[a3 + 1]! * b * 0.028,
          posAcetyl[a3 + 2]! + dirAcetyl[a3 + 2]! * b * 0.028,
        )
        // Deux carbones et leur coenzyme A : la tête est un peu plus grosse.
        echelleTemp.setScalar(RAYON_ACETYL * (b === 2 ? 1.5 : 1) * fondu)
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        acetyls.setMatrixAt(a * BILLES_ACETYL + b, matriceTemp)
      }
    }
    acetyls.instanceMatrix.needsUpdate = true

    // 13. L'abaque. Sept FADH₂, sept NADH, huit acétyl-CoA pour un palmitate :
    //     sept coupures pour huit morceaux, et le compte tombe juste.
    const r = reactionsFaites
    const nbFad = Math.floor((r + 3) / 4)
    const nbNad = Math.floor((r + 1) / 4)
    const nbAcetyl = Math.floor(r / 4) + (r >= NB_ETAPES ? 1 : 0)
    for (let j = 0; j < NB_JETONS; j++) {
      let rempli = 0
      if (j < NB_FADH2) rempli = j < nbFad ? 1 : 0
      else if (j < NB_FADH2 + NB_NADH) rempli = j - NB_FADH2 < nbNad ? 1 : 0
      else rempli = j - NB_FADH2 - NB_NADH < nbAcetyl ? 1 : 0
      remplissage[j] = remplissage[j]! + (rempli - remplissage[j]!) * Math.min(1, dt * 7)
      positionJeton(j, positionTemp)
      echelleTemp.setScalar(RAYON_JETON * remplissage[j]!)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      if (j < NB_FADH2) jetonsFad.setMatrixAt(j, matriceTemp)
      else if (j < NB_FADH2 + NB_NADH) jetonsNad.setMatrixAt(j - NB_FADH2, matriceTemp)
      else jetonsAcetyl.setMatrixAt(j - NB_FADH2 - NB_NADH, matriceTemp)
    }
    jetonsFad.instanceMatrix.needsUpdate = true
    jetonsNad.instanceMatrix.needsUpdate = true
    jetonsAcetyl.instanceMatrix.needsUpdate = true

    // Les deux ATP de l'activation : ils se vident, ils ne se remplissent pas.
    for (let a = 0; a < NB_ATP; a++) {
      positionTemp.set(POS_ATP[a * 3]!, POS_ATP[a * 3 + 1]!, POS_ATP[a * 3 + 2]!)
      echelleTemp.setScalar(RAYON_JETON * atpRestant)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      jetonsAtp.setMatrixAt(a, matriceTemp)
    }
    jetonsAtp.instanceMatrix.needsUpdate = true

    // 14. Les postes battent quand ils travaillent.
    for (let k = 0; k < 4; k++) {
      const actif = dansLaSpirale && leg === k && avancementReaction < 1 ? 1 : 0
      pulseSpirale[k] = pulseSpirale[k]! + (actif - pulseSpirale[k]!) * Math.min(1, dt * 9)
      poserEnzyme(
        enzymesSpirale,
        k,
        postesSpirale[k * 3]!,
        postesSpirale[k * 3 + 1]!,
        postesSpirale[k * 3 + 2]!,
        pulseSpirale[k]!,
      )
      let actifPorte = 0
      if (k === 0 && tCycle < T_ACTIVATION_FIN) actifPorte = 1
      else if (k === 1 && tCycle >= T_ACTIVATION_FIN && tCycle < T_CPT1_FIN) actifPorte = 1
      else if (k === 2 && tCycle >= T_CPT1_FIN && tCycle < T_TRANSLOC_FIN) actifPorte = 1
      else if (k === 3 && tCycle >= T_TRANSLOC_FIN && tCycle < T_CPT2_FIN) actifPorte = 1
      pulsePorte[k] = pulsePorte[k]! + (actifPorte - pulsePorte[k]!) * Math.min(1, dt * 9)
      poserEnzyme(
        enzymesPorte,
        k,
        POSTES_ENTREE[k * 3]!,
        POSTES_ENTREE[k * 3 + 1]!,
        POSTES_ENTREE[k * 3 + 2]!,
        pulsePorte[k]!,
      )
    }
    enzymesSpirale.instanceMatrix.needsUpdate = true
    enzymesPorte.instanceMatrix.needsUpdate = true

    // 15. La navette carnitine de fond : elle ne s'arrête jamais, même pendant
    //     que la spirale tourne. Elle entre chargée, elle ressort vide.
    for (let c = 0; c < 2; c++) {
      const t = (temps * 0.42 + c * 0.5) % 1
      // Aller chargé, retour à vide : un vrai antiport, pas un tapis roulant.
      const aller = t < 0.5
      const u = aller ? t * 2 : (t - 0.5) * 2
      const x = aller
        ? POSTES_ENTREE[3]! + (POSTES_ENTREE[9]! - POSTES_ENTREE[3]!) * lissage(u)
        : POSTES_ENTREE[9]! + (POSTES_ENTREE[3]! - POSTES_ENTREE[9]!) * lissage(u)
      const y = (c === 0 ? 0.2 : -0.2) + Math.sin(temps * 3.1 + c) * 0.02
      const z = c === 0 ? 0.16 : -0.16
      positionTemp.set(x, y, z)
      echelleTemp.setScalar(RAYON_CARNITINE * 0.85)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      carnitinesFond.setMatrixAt(c, matriceTemp)
      for (let b = 0; b < 3; b++) {
        positionTemp.set(x - 0.03 - b * 0.026, y + 0.012, z)
        echelleTemp.setScalar(aller ? RAYON_CARBONE * 0.85 : 0)
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        stubsFond.setMatrixAt(c * 3 + b, matriceTemp)
      }
    }
    carnitinesFond.instanceMatrix.needsUpdate = true
    stubsFond.instanceMatrix.needsUpdate = true

    echelleTemp.set(1, 1, 1)
  }

  animer(0)

  return [
    {
      cle: 'beta-oxydation',
      nom: 'Bêta-oxydation des acides gras',
      siege: 'Matrice mitochondriale',
      facteur: 'ralenti ×5',
      justificationFacteur:
        "Les quatre enzymes de la spirale tournent une dizaine de fois par seconde : un tour complet, " +
        "diffusions comprises, prend environ un tiers de seconde, soit 1,8 s à l'écran. Les sept tours " +
        "d'un palmitate durent réellement deux à trois secondes ; ici ils en prennent treize, soit un " +
        "RALENTI d'environ 5 — et non un accéléré, comme le badge l'a longtemps annoncé à tort. " +
        "L'entrée par la carnitine, plus lente que la spirale, prend trois secondes de plus.",
      ellision:
        "Une pause AJOUTÉE d'une seconde et demie tient l'abaque complet en fin de cycle : elle " +
        "n'existe pas dans la cellule, elle sert à laisser lire le bilan avant que tout reparte. " +
        "L'ATTENTE, elle, est coupée, pas ralentie : dans le cytosol un acyl-CoA peut patienter très longtemps " +
        "avant de trouver CPT1, et c'est justement pour cela que la porte est le point de contrôle. " +
        "L'agitation thermique, elle, est RALENTIE d'environ ×10 000 — à cette échelle une molécule " +
        "traverserait le champ en une fraction de milliseconde. La densité est réduite d'un facteur " +
        "cent : à 500 g de protéines par litre, cette matrice contient des MILLIONS de molécules par " +
        "µm³. Enfin le FAD de l'acyl-CoA " +
        "déshydrogénase est en réalité un cofacteur PROSTHÉTIQUE, lié à demeure : ses électrons partent " +
        "par la flavoprotéine ETF, pas la molécule. On le dessine en navette pour que le trajet de " +
        "l'énergie se voie. Sont absents la lipase qui libère l'acide gras, l'albumine qui le transporte " +
        "dans le sang, et les acides gras impairs ou insaturés, qui demandent des enzymes de plus.",
      description:
        "Un acide gras ne traverse pas la membrane interne tout seul : il est activé en acyl-CoA au prix " +
        "de deux ATP, son coenzyme A est échangé contre la CARNITINE, l'ensemble traverse, et le CoA lui " +
        "est rendu de l'autre côté. Cette navette est l'étape limitante et le point de contrôle de toute " +
        "l'oxydation des graisses — d'où la file qui attend dehors. Dans la matrice, quatre enzymes en " +
        "boucle répètent la même séquence — oxydation, hydratation, oxydation, thiolyse — et la chaîne " +
        "perd DEUX carbones à chaque tour : le palmitate, seize carbones, fait sept tours et donne huit " +
        "acétyl-CoA, avec sept FADH₂ et sept NADH. La mitochondrie est à l'échelle vraie, les molécules " +
        "sont dessinées environ deux cents fois trop grosses pour qu'on puisse compter leurs carbones.",
      objet: groupe,
      ancre: ANCRE.clone(),
      // Mesuré : la traîne de la chaîne va jusqu'à 1,02 pendant ses transits
      // errants. Les produits en vol sortent à 1,20, et c'est voulu.
      rayonCadrage: 1.05,
      couleur: TEINTE_ENZYME,
      animer,
    },
  ]
}
