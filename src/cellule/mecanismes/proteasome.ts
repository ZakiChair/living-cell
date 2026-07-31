import * as THREE from 'three'
import type { MecanismeBrut } from './contrat.js'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'

/**
 * DÉGRADATION PAR LE PROTÉASOME, ET MARQUAGE À L'UBIQUITINE.
 *
 * La moitié oubliée de la vie d'une protéine. On montre partout la synthèse,
 * jamais la destruction : les deux tournent pourtant en parallèle en permanence,
 * et c'est leur rapport qui fixe la demi-vie d'une protéine, un à deux jours.
 *
 * Trois choses doivent se voir, et elles se voient dans cet ordre :
 *   — le SEUIL. Une cible qui porte moins de quatre ubiquitines rebondit sur le
 *     chapeau. C'est le cœur du mécanisme, et c'est pour cela que les refus sont
 *     ici majoritaires et bruyants.
 *   — le RECYCLAGE. La chaîne est retirée en bloc avant le passage, et ses
 *     maillons repartent dans le cytosol où une ligase E3 les reprend.
 *   — le DÉPLIEMENT. Le pore du tonneau fait 1,3 nm : une protéine repliée de
 *     5 nm n'y entre pas. Elle est dépliée et enfilée en brin étiré.
 */

// ── Position et dimensions réelles, en micromètres (1 unité = 1 µm) ─────────

/** Cytosol dégagé, à l'écart des organites. */
const SIEGE = new THREE.Vector3(2.4, -4.6, -2.8)

/** 20S : quatre anneaux empilés, 11 nm de diamètre pour 15 nm de haut. */
const DEMI_HAUTEUR_TONNEAU = 0.0075
const PAS_ANNEAU = DEMI_HAUTEUR_TONNEAU / 2
const RAYON_ANNEAU = 0.0036
const RAYON_SOUS_UNITE = 0.0017
const SOUS_UNITES_PAR_ANNEAU = 7

/** 19S : le chapeau ajoute 14,5 nm à chaque bout — un 26S fait bien 45 nm. */
const HAUTEUR_CHAPEAU = 0.0145
const RAYON_ATPASE = 0.0033
const SOUS_UNITES_ATPASE = 6
const BLOBS_COIFFE = 9
const BLOBS_PAR_CHAPEAU = SOUS_UNITES_ATPASE + BLOBS_COIFFE

/**
 * Le brin entre par le haut du chapeau et les peptides ressortent à l'autre
 * bout : c'est la seule lecture possible d'une machine opaque, on ne voit ni le
 * canal ni la chambre catalytique.
 */
const Y_ENGAGEMENT = DEMI_HAUTEUR_TONNEAU + HAUTEUR_CHAPEAU - 0.001
const Y_SORTIE = -(DEMI_HAUTEUR_TONNEAU + HAUTEUR_CHAPEAU + 0.003)
const RAYON_SORTIE = 0.001

/** Le 26S vu comme une capsule, pour les collisions. */
const DEMI_CAPSULE = 0.016
const RAYON_CAPSULE = 0.0062

// ── Peuplement : peu d'acteurs, tous suivables à l'œil ──────────────────────
const NB_CIBLES = 7
const NB_BILLES = 40
const NB_UBIQUITINES = 56
const NB_LIGASES = 6
const BLOBS_LIGASE = 3
const NB_PEPTIDES = 96

/** Le seuil canonique d'adressage : quatre ubiquitines en chaîne K48. */
const SEUIL_UBIQUITINES = 4

/** Rayon d'errance. Confiner resserre les rencontres sans accélérer la dérive. */
const RAYON_ERRANCE = 0.028

/** Un maillon de chaîne étirée : 7,5 résidus à 0,35 nm, soit 2,6 nm. */
const PAS_FIL = 0.0026
/** Longueur de brin déplié visible entre la pelote et le chapeau. */
const LONGUEUR_FIL = 0.012
const BILLES_FIL = LONGUEUR_FIL / PAS_FIL
/** Billes encore dans la machine avant d'atteindre les sites catalytiques. */
const BILLES_AVANT_COUPE = (Y_ENGAGEMENT + 0.001) / PAS_FIL

// ── Durées d'écran, à l'accéléré ×10 ───────────────────────────────────────
const DUREE_AMARRAGE = 0.9
/** 23 s réelles pour enfiler une protéine entière → 2,3 s à l'écran. */
const DUREE_ENFILAGE = 2.3
const DUREE_DEGRADATION = DUREE_ENFILAGE * (1 + BILLES_AVANT_COUPE / NB_BILLES) + 0.15
const DUREE_PAUSE = 0.7
const DUREE_PEPTIDE = 1.8

/** Vitesses de dérive : une petite molécule diffuse plus vite qu'une grosse. */
const VITESSE_CIBLE = 0.024
const VITESSE_LIGASE = 0.020
const VITESSE_UBIQUITINE = 0.039
/** Temps de corrélation de la marche ; au-delà la dérive redevient aléatoire. */
const TAU_DERIVE = 0.18
/** Calibre l'impulsion pour que la vitesse quadratique moyenne soit la consigne. */
const FACTEUR_IMPULSION = 6.7
/** Un refus doit se VOIR : la cible est chassée, pas simplement arrêtée. */
const IMPULSION_REFUS = 0.09

// États d'une cible.
const ERRANTE = 0
const AMARREE = 1
const ENFILEE = 2
const ABSENTE = 3

// Propriétaire d'une ubiquitine : libre, cible k, ou ligase NB_CIBLES + j.
const LIBRE = -1

// Même famille chromatique que le lysosome : ce sont les deux voies de
// destruction des protéines, l'une soluble, l'autre en compartiment.
const TEINTE_ALPHA = TEINTES.lysosome
const TEINTE_BETA = 0x5a3480
const TEINTE_CHAPEAU = 0xb492d6
const TEINTE_CIBLE = TEINTES.reticulumRugueux
const TEINTE_UBIQUITINE = TEINTES.vesicule
const TEINTE_LIGASE = TEINTES.noyau
const TEINTE_PEPTIDE = 0x66c9a4

// ── Temporaires hissés : animer() ne doit rien allouer ──────────────────────
const matriceTemp = new THREE.Matrix4()
const positionTemp = new THREE.Vector3()
const quaternionTemp = new THREE.Quaternion()
const echelleTemp = new THREE.Vector3(1, 1, 1)
const directionTemp = new THREE.Vector3()
const AXE_Y = new THREE.Vector3(0, 1, 0)

/**
 * Sorties de `heurterCapsule`, lues juste après l'appel : normale du choc puis
 * hauteur du point de contact. Rangées dans un tableau typé et non dans des
 * variables, parce qu'une variable capturée qui porte un flottant est
 * réencapsulée sur le tas à chaque écriture — et animer() n'alloue rien.
 */
const contact = new Float64Array(4)
const NORMALE_X = 0
const NORMALE_Y = 1
const NORMALE_Z = 2
const HAUTEUR = 3

/** Temps de l'image précédente, puis intensité du moteur, pour la même raison. */
const horloge = new Float64Array(2)
const TEMPS_PRECEDENT = 0
const INTENSITE_POMPE = 1

/** Décalages des trois lobes d'une ligase E3, complexe allongé d'une quinzaine de nm. */
const LOBES_LIGASE = new Float32Array([
  0, 0.0029, 0, 0.0026,
  0.0023, -0.0017, 0.0009, 0.003,
  -0.0025, -0.0023, -0.0013, 0.0022,
])

export function creerProteasome(): MecanismeBrut[] {
  const alea = creerAlea(48_112)
  const groupe = new THREE.Group()
  groupe.position.copy(SIEGE)

  // ── Le protéasome 26S ────────────────────────────────────────────────────
  // Sous-groupe pour lui seul : une rotation lente autour de son axe rend
  // visible la symétrie d'ordre 7, qu'un objet figé de face ne montre jamais.
  const groupeProteasome = new THREE.Group()
  groupe.add(groupeProteasome)

  const geometrieBlob = new THREE.IcosahedronGeometry(1, 1)
  const geometrieGrain = new THREE.IcosahedronGeometry(1, 0)

  const anneauxAlpha = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_ALPHA, { doubleFace: false }),
    2 * SOUS_UNITES_PAR_ANNEAU,
  )
  const anneauxBeta = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_BETA, { doubleFace: false }),
    2 * SOUS_UNITES_PAR_ANNEAU,
  )
  const chapeaux = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_CHAPEAU, { doubleFace: false }),
    2 * BLOBS_PAR_CHAPEAU,
  )
  anneauxAlpha.frustumCulled = false
  anneauxBeta.frustumCulled = false
  chapeaux.frustumCulled = false
  groupeProteasome.add(anneauxAlpha, anneauxBeta, chapeaux)

  // Quatre anneaux de sept : les deux externes sont les α, les deux internes
  // les β, qui portent les sites catalytiques. Un demi-pas de décalage d'un
  // anneau au suivant, et un jeu vertical qui laisse voir les quatre étages.
  for (let anneau = 0; anneau < 4; anneau++) {
    const y = (anneau - 1.5) * PAS_ANNEAU
    const externe = anneau === 0 || anneau === 3
    const maillage = externe ? anneauxAlpha : anneauxBeta
    const base = anneau >= 2 ? SOUS_UNITES_PAR_ANNEAU : 0
    for (let s = 0; s < SOUS_UNITES_PAR_ANNEAU; s++) {
      const angle = (s / SOUS_UNITES_PAR_ANNEAU) * Math.PI * 2 + anneau * (Math.PI / SOUS_UNITES_PAR_ANNEAU)
      positionTemp.set(Math.cos(angle) * RAYON_ANNEAU, y, Math.sin(angle) * RAYON_ANNEAU)
      quaternionTemp.setFromAxisAngle(AXE_Y, -angle)
      // Aplatie tangentiellement : les sept sous-unités restent séparables à
      // l'œil, et l'anneau ménage au centre le pore de 1,3 nm.
      echelleTemp.set(RAYON_SOUS_UNITE * 1.25, RAYON_SOUS_UNITE * 0.95, RAYON_SOUS_UNITE * 0.82)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      maillage.setMatrixAt(base + s, matriceTemp)
    }
  }
  anneauxAlpha.instanceMatrix.needsUpdate = true
  anneauxBeta.instanceMatrix.needsUpdate = true

  // Les chapeaux 19S. La base est un anneau de six ATPases — c'est elle qui
  // tire ; la coiffe qui la surmonte est franchement asymétrique, et la dessiner
  // régulière serait la seule invention de cette figure.
  const Y_ATPASE = DEMI_HAUTEUR_TONNEAU + 0.0032
  quaternionTemp.identity()
  for (let cap = 0; cap < 2; cap++) {
    const sens = cap === 0 ? 1 : -1
    const base = cap * BLOBS_PAR_CHAPEAU
    for (let s = 0; s < SOUS_UNITES_ATPASE; s++) {
      const angle = (s / SOUS_UNITES_ATPASE) * Math.PI * 2
      positionTemp.set(Math.cos(angle) * RAYON_ATPASE, sens * Y_ATPASE, Math.sin(angle) * RAYON_ATPASE)
      echelleTemp.setScalar(0.0018)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      chapeaux.setMatrixAt(base + s, matriceTemp)
    }
    for (let s = 0; s < BLOBS_COIFFE; s++) {
      const angle = alea() * Math.PI * 2
      const rayon = 0.0006 + alea() * 0.0036
      const y = DEMI_HAUTEUR_TONNEAU + 0.0072 + alea() * 0.0065
      positionTemp.set(Math.cos(angle) * rayon, sens * y, Math.sin(angle) * rayon)
      echelleTemp.setScalar(0.0013 + alea() * 0.0005)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      chapeaux.setMatrixAt(base + SOUS_UNITES_ATPASE + s, matriceTemp)
    }
  }
  chapeaux.instanceMatrix.needsUpdate = true

  // ── Les cibles ───────────────────────────────────────────────────────────
  const cibles = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_CIBLE, { doubleFace: false }),
    NB_CIBLES * NB_BILLES,
  )
  cibles.frustumCulled = false
  groupe.add(cibles)

  const etatCible = new Int8Array(NB_CIBLES)
  const tempsEtat = new Float32Array(NB_CIBLES)
  const posCible = new Float32Array(NB_CIBLES * 3)
  const vitCible = new Float32Array(NB_CIBLES * 3)
  const rayonPelote = new Float32Array(NB_CIBLES)
  const rayonBille = new Float32Array(NB_CIBLES)
  const dirChaine = new Float32Array(NB_CIBLES * 3)
  const perpChaine = new Float32Array(NB_CIBLES * 3)
  const billesCoupees = new Int16Array(NB_CIBLES)
  const chaineRetiree = new Uint8Array(NB_CIBLES)
  /** Recompté à chaque image depuis les ubiquitines : aucun compteur à désynchroniser. */
  const nbUbCible = new Int8Array(NB_CIBLES)
  /** Repliement : marche aléatoire ramenée vers le centre, donc pelote compacte. */
  const replie = new Float32Array(NB_CIBLES * NB_BILLES * 3)

  const vecteurAuxiliaire = new THREE.Vector3()
  for (let k = 0; k < NB_CIBLES; k++) {
    // De 250 à 450 acides aminés : rayon de 2,1 à 2,9 nm.
    const rayon = 0.0021 + alea() * 0.0008
    rayonPelote[k] = rayon
    rayonBille[k] = rayon * 0.336

    directionTemp.set(alea() * 2 - 1, alea() * 2 - 1, alea() * 2 - 1).normalize()
    vecteurAuxiliaire.set(-directionTemp.z, directionTemp.x, directionTemp.y).cross(directionTemp).normalize()
    dirChaine[k * 3] = directionTemp.x
    dirChaine[k * 3 + 1] = directionTemp.y
    dirChaine[k * 3 + 2] = directionTemp.z
    perpChaine[k * 3] = vecteurAuxiliaire.x
    perpChaine[k * 3 + 1] = vecteurAuxiliaire.y
    perpChaine[k * 3 + 2] = vecteurAuxiliaire.z

    // Le rayon annoncé est celui de la SURFACE : la marche est donc bornée à
    // une bille près, sinon la pelote paraîtrait un tiers trop grosse.
    const rayonInterne = rayon - rayonBille[k]!
    let x = 0
    let y = 0
    let z = 0
    for (let i = 0; i < NB_BILLES; i++) {
      x += (alea() - 0.5) * rayon
      y += (alea() - 0.5) * rayon
      z += (alea() - 0.5) * rayon
      const d = Math.sqrt(x * x + y * y + z * z)
      if (d > rayonInterne) {
        const f = (rayonInterne / d) * 0.82
        x *= f
        y *= f
        z *= f
      }
      const b = (k * NB_BILLES + i) * 3
      replie[b] = x
      replie[b + 1] = y
      replie[b + 2] = z
    }
  }

  // ── Ubiquitines, ligases E3, peptides ────────────────────────────────────
  const ubiquitines = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_UBIQUITINE, { doubleFace: false }),
    NB_UBIQUITINES,
  )
  const ligases = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_LIGASE, { doubleFace: false }),
    NB_LIGASES * BLOBS_LIGASE,
  )
  const peptides = new THREE.InstancedMesh(
    geometrieGrain,
    materiauOrganite(TEINTE_PEPTIDE, { doubleFace: false }),
    NB_PEPTIDES,
  )
  ubiquitines.frustumCulled = false
  ligases.frustumCulled = false
  peptides.frustumCulled = false
  groupe.add(ubiquitines, ligases, peptides)

  /** Seule source de vérité sur les ubiquitines : rien d'autre ne les compte. */
  const proprietaire = new Int16Array(NB_UBIQUITINES)
  const rangUb = new Int8Array(NB_UBIQUITINES)
  const posUb = new Float32Array(NB_UBIQUITINES * 3)
  const vitUb = new Float32Array(NB_UBIQUITINES * 3)
  const chargeLigase = new Int16Array(NB_LIGASES)

  const posLigase = new Float32Array(NB_LIGASES * 3)
  const vitLigase = new Float32Array(NB_LIGASES * 3)

  const posPeptide = new Float32Array(NB_PEPTIDES * 3)
  const vitPeptide = new Float32Array(NB_PEPTIDES * 3)
  const viePeptide = new Float32Array(NB_PEPTIDES)
  const taillePeptide = new Float32Array(NB_PEPTIDES)
  let prochainPeptide = 0

  /** Tire un point de la coquille d'errance, hors du volume du protéasome. */
  const semer = (tableau: Float32Array, indice: number, rayonMin: number): void => {
    for (let essai = 0; essai < 24; essai++) {
      const u = alea() * 2 - 1
      const theta = alea() * Math.PI * 2
      const r = Math.cbrt(alea()) * RAYON_ERRANCE
      const s = Math.sqrt(Math.max(0, 1 - u * u))
      const x = r * s * Math.cos(theta)
      const y = r * u
      const z = r * s * Math.sin(theta)
      const yProche = Math.max(-DEMI_CAPSULE, Math.min(DEMI_CAPSULE, y))
      const dy = y - yProche
      if (Math.sqrt(x * x + dy * dy + z * z) > RAYON_CAPSULE + rayonMin) {
        tableau[indice * 3] = x
        tableau[indice * 3 + 1] = y
        tableau[indice * 3 + 2] = z
        return
      }
    }
    tableau[indice * 3] = RAYON_ERRANCE * 0.8
    tableau[indice * 3 + 1] = 0
    tableau[indice * 3 + 2] = 0
  }

  for (let k = 0; k < NB_CIBLES; k++) semer(posCible, k, rayonPelote[k]!)
  for (let j = 0; j < NB_LIGASES; j++) semer(posLigase, j, 0.005)
  for (let u = 0; u < NB_UBIQUITINES; u++) {
    proprietaire[u] = LIBRE
    semer(posUb, u, 0.0015)
  }

  // Départ pris en cours de route : sans cela les dix premières secondes ne
  // montreraient que de l'errance, et le mécanisme n'aurait pas commencé.
  let ubLibre = 0
  const attacher = (cible: number, rang: number): void => {
    while (ubLibre < NB_UBIQUITINES && proprietaire[ubLibre] !== LIBRE) ubLibre++
    if (ubLibre >= NB_UBIQUITINES) return
    proprietaire[ubLibre] = cible
    rangUb[ubLibre] = rang
  }
  for (let j = 0; j < NB_LIGASES; j++) attacher(NB_CIBLES + j, 0)
  etatCible[0] = ENFILEE
  tempsEtat[0] = 0.9
  billesCoupees[0] = Math.max(0, Math.floor((0.9 / DUREE_ENFILAGE) * NB_BILLES - BILLES_AVANT_COUPE))
  chaineRetiree[0] = 1
  etatCible[1] = AMARREE
  tempsEtat[1] = 0.1
  chaineRetiree[1] = 0
  for (let r = 0; r < SEUIL_UBIQUITINES; r++) attacher(1, r)
  posCible[3] = 0.004
  posCible[4] = Y_ENGAGEMENT + 0.006
  posCible[5] = 0.003
  for (let r = 0; r < SEUIL_UBIQUITINES; r++) attacher(2, r)
  posCible[6] = 0.011
  posCible[7] = 0.013
  posCible[8] = 0.006
  for (let k = 3; k < NB_CIBLES; k++) {
    for (let r = 0; r < k - 3; r++) attacher(k, r)
  }

  /**
   * Repousse un point hors du volume du 26S, sans toucher à aucune vitesse.
   * Sert à la chaîne d'ubiquitines : une cible collée au chapeau peut tendre sa
   * chaîne vers la machine, et quatre maillons traverseraient le tonneau.
   */
  const ecarterDeLaCapsule = (point: THREE.Vector3, rayonObjet: number): void => {
    const yProche = Math.max(-DEMI_CAPSULE, Math.min(DEMI_CAPSULE, point.y))
    const dy = point.y - yProche
    const seuil = RAYON_CAPSULE + rayonObjet
    const d = Math.sqrt(point.x * point.x + dy * dy + point.z * point.z)
    if (d >= seuil) return
    const f = d < 1e-9 ? 0 : seuil / d
    point.set(point.x * f, yProche + dy * f + (d < 1e-9 ? seuil : 0), point.z * f)
  }

  /**
   * Collision avec le 26S, traité comme une capsule verticale. Renvoie vrai en
   * cas de contact, et laisse la normale et la hauteur du contact en sortie.
   */
  const heurterCapsule = (
    pos: Float32Array,
    vit: Float32Array,
    indice: number,
    rayonObjet: number,
  ): boolean => {
    const i3 = indice * 3
    const px = pos[i3]!
    const py = pos[i3 + 1]!
    const pz = pos[i3 + 2]!
    const yProche = Math.max(-DEMI_CAPSULE, Math.min(DEMI_CAPSULE, py))
    const dx = px
    const dy = py - yProche
    const dz = pz
    const seuil = RAYON_CAPSULE + rayonObjet
    let d = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (d >= seuil) return false
    if (d < 1e-9) {
      contact[NORMALE_X] = 1
      contact[NORMALE_Y] = 0
      contact[NORMALE_Z] = 0
      d = 1e-9
    } else {
      contact[NORMALE_X] = dx / d
      contact[NORMALE_Y] = dy / d
      contact[NORMALE_Z] = dz / d
    }
    const nx = contact[NORMALE_X]!
    const ny = contact[NORMALE_Y]!
    const nz = contact[NORMALE_Z]!
    contact[HAUTEUR] = py
    pos[i3] = nx * seuil
    pos[i3 + 1] = yProche + ny * seuil
    pos[i3 + 2] = nz * seuil
    const vn = vit[i3]! * nx + vit[i3 + 1]! * ny + vit[i3 + 2]! * nz
    if (vn < 0) {
      vit[i3] = vit[i3]! - 2 * vn * nx
      vit[i3 + 1] = vit[i3 + 1]! - 2 * vn * ny
      vit[i3 + 2] = vit[i3 + 2]! - 2 * vn * nz
    }
    return true
  }

  /** Marche brownienne amortie, puis rappel à la coquille et au volume du 26S. */
  const deriver = (
    pos: Float32Array,
    vit: Float32Array,
    indice: number,
    vitesse: number,
    amorti: number,
    racineDt: number,
    dt: number,
  ): void => {
    const i3 = indice * 3
    const impulsion = vitesse * FACTEUR_IMPULSION * racineDt
    for (let c = 0; c < 3; c++) {
      vit[i3 + c] = vit[i3 + c]! * amorti + (alea() - 0.5) * impulsion
      pos[i3 + c] = pos[i3 + c]! + vit[i3 + c]! * dt
    }
    const px = pos[i3]!
    const py = pos[i3 + 1]!
    const pz = pos[i3 + 2]!
    const r = Math.sqrt(px * px + py * py + pz * pz)
    if (r > RAYON_ERRANCE) {
      const f = RAYON_ERRANCE / r
      pos[i3] = px * f
      pos[i3 + 1] = py * f
      pos[i3 + 2] = pz * f
      const vn = (vit[i3]! * px + vit[i3 + 1]! * py + vit[i3 + 2]! * pz) / r
      if (vn > 0) {
        vit[i3] = vit[i3]! - (2 * vn * px) / r
        vit[i3 + 1] = vit[i3 + 1]! - (2 * vn * py) / r
        vit[i3 + 2] = vit[i3 + 2]! - (2 * vn * pz) / r
      }
    }
  }

  const emettrePeptide = (): void => {
    const p = prochainPeptide
    prochainPeptide = (prochainPeptide + 1) % NB_PEPTIDES
    const phi = alea() * Math.PI * 2
    const lateral = 0.6 + alea() * 0.6
    const descente = 0.4 + alea() * 0.9
    const norme = Math.sqrt(lateral * lateral + descente * descente)
    const vitesse = 0.016 + alea() * 0.012
    posPeptide[p * 3] = Math.cos(phi) * RAYON_SORTIE
    posPeptide[p * 3 + 1] = Y_SORTIE
    posPeptide[p * 3 + 2] = Math.sin(phi) * RAYON_SORTIE
    vitPeptide[p * 3] = ((Math.cos(phi) * lateral) / norme) * vitesse
    vitPeptide[p * 3 + 1] = (-descente / norme) * vitesse
    vitPeptide[p * 3 + 2] = ((Math.sin(phi) * lateral) / norme) * vitesse
    viePeptide[p] = DUREE_PEPTIDE
    // De 2 à 30 acides aminés : rayon de giration de 0,45 à 2,3 nm.
    const acides = 2 + Math.floor(alea() * 29)
    taillePeptide[p] = 0.00045 + ((acides - 2) / 28) * 0.0018
  }

  /**
   * Libère toutes les ubiquitines d'une cible, où qu'en soit son cycle. Elles
   * repartent d'où elles étaient posées : une ubiquitine ne se téléporte pas.
   */
  const libererChaine = (k: number, ecarter: boolean): void => {
    const d3 = k * 3
    for (let u = 0; u < NB_UBIQUITINES; u++) {
      if (proprietaire[u] !== k) continue
      proprietaire[u] = LIBRE
      const distance = rayonPelote[k]! + 0.0018 + rangUb[u]! * 0.0032
      const lateral = Math.sin(rangUb[u]! * 2.1) * 0.001
      for (let c = 0; c < 3; c++) {
        posUb[u * 3 + c] =
          posCible[d3 + c]! + dirChaine[d3 + c]! * distance + perpChaine[d3 + c]! * lateral
        // Rpn11 coupe la chaîne à sa base : les quatre maillons partent d'un
        // bloc, intacts, et resservent — ils ne sont pas dégradés.
        vitUb[u * 3 + c] = ecarter ? dirChaine[d3 + c]! * 0.04 + (alea() - 0.5) * 0.02 : 0
      }
    }
  }

  const animer = (temps: number): void => {
    // Pas borné : une image sautée ne doit pas téléporter la scène.
    const dt = Math.min(0.05, Math.max(0, temps - horloge[TEMPS_PRECEDENT]!))
    horloge[TEMPS_PRECEDENT] = temps
    const amorti = Math.exp(-dt / TAU_DERIVE)
    const racineDt = Math.sqrt(dt)

    groupeProteasome.rotation.y = temps * 0.12

    // 1. Recensement des ubiquitines. Tout le reste en découle.
    for (let k = 0; k < NB_CIBLES; k++) nbUbCible[k] = 0
    for (let j = 0; j < NB_LIGASES; j++) chargeLigase[j] = LIBRE
    for (let u = 0; u < NB_UBIQUITINES; u++) {
      const p = proprietaire[u]!
      if (p >= 0 && p < NB_CIBLES) nbUbCible[p]!++
      else if (p >= NB_CIBLES) chargeLigase[p - NB_CIBLES] = u
    }

    // 2. Les ligases E3. Elles errent, se chargent d'une ubiquitine par
    //    rencontre, et en posent une par rencontre : rien n'est visé.
    for (let j = 0; j < NB_LIGASES; j++) {
      deriver(posLigase, vitLigase, j, VITESSE_LIGASE, amorti, racineDt, dt)
      heurterCapsule(posLigase, vitLigase, j, 0.005)
      const lx = posLigase[j * 3]!
      const ly = posLigase[j * 3 + 1]!
      const lz = posLigase[j * 3 + 2]!
      if (chargeLigase[j] === LIBRE) {
        for (let u = 0; u < NB_UBIQUITINES; u++) {
          if (proprietaire[u] !== LIBRE) continue
          const dx = posUb[u * 3]! - lx
          const dy = posUb[u * 3 + 1]! - ly
          const dz = posUb[u * 3 + 2]! - lz
          if (dx * dx + dy * dy + dz * dz > 0.0065 * 0.0065) continue
          proprietaire[u] = NB_CIBLES + j
          chargeLigase[j] = u
          break
        }
      } else {
        for (let k = 0; k < NB_CIBLES; k++) {
          if (etatCible[k] !== ERRANTE || nbUbCible[k]! >= SEUIL_UBIQUITINES) continue
          const dx = posCible[k * 3]! - lx
          const dy = posCible[k * 3 + 1]! - ly
          const dz = posCible[k * 3 + 2]! - lz
          const portee = 0.0055 + rayonPelote[k]!
          if (dx * dx + dy * dy + dz * dz > portee * portee) continue
          // Une ubiquitine de plus, posée une par une : c'est ainsi que la
          // chaîne s'allonge, jamais d'un bloc.
          const u = chargeLigase[j]!
          proprietaire[u] = k
          rangUb[u] = nbUbCible[k]!
          nbUbCible[k]!++
          chargeLigase[j] = LIBRE
          break
        }
      }
    }

    // 3. Les cibles.
    for (let k = 0; k < NB_CIBLES; k++) {
      const k3 = k * 3
      const rPelote = rayonPelote[k]!
      const rBille = rayonBille[k]!
      let etat = etatCible[k]!
      tempsEtat[k]! += dt

      if (etat === ERRANTE) {
        deriver(posCible, vitCible, k, VITESSE_CIBLE, amorti, racineDt, dt)
        if (heurterCapsule(posCible, vitCible, k, rPelote)) {
          if (contact[HAUTEUR]! > DEMI_HAUTEUR_TONNEAU && nbUbCible[k]! >= SEUIL_UBIQUITINES) {
            etat = AMARREE
            etatCible[k] = AMARREE
            tempsEtat[k] = 0
            chaineRetiree[k] = 0
          } else {
            // Refus. Sous quatre ubiquitines le chapeau ne retient rien, et la
            // cible repart — c'est la scène la plus fréquente de tout le champ.
            vitCible[k3] = vitCible[k3]! + contact[NORMALE_X]! * IMPULSION_REFUS
            vitCible[k3 + 1] = vitCible[k3 + 1]! + contact[NORMALE_Y]! * IMPULSION_REFUS
            vitCible[k3 + 2] = vitCible[k3 + 2]! + contact[NORMALE_Z]! * IMPULSION_REFUS
          }
        }
      }

      if (etat === AMARREE) {
        const prise = 1 - Math.exp(-dt * 7)
        posCible[k3] = posCible[k3]! * (1 - prise)
        posCible[k3 + 1] = posCible[k3 + 1]! + (Y_ENGAGEMENT + LONGUEUR_FIL + rPelote - posCible[k3 + 1]!) * prise
        posCible[k3 + 2] = posCible[k3 + 2]! * (1 - prise)
        vitCible[k3] = 0
        vitCible[k3 + 1] = 0
        vitCible[k3 + 2] = 0
        if (chaineRetiree[k] === 0 && tempsEtat[k]! > DUREE_AMARRAGE * 0.45) {
          libererChaine(k, true)
          chaineRetiree[k] = 1
        }
        if (tempsEtat[k]! >= DUREE_AMARRAGE) {
          etat = ENFILEE
          etatCible[k] = ENFILEE
          tempsEtat[k] = 0
          billesCoupees[k] = 0
        }
      }

      let avance = 0
      if (etat === ENFILEE) {
        avance = (tempsEtat[k]! / DUREE_ENFILAGE) * NB_BILLES
        const coupees = Math.min(NB_BILLES, Math.floor(avance - BILLES_AVANT_COUPE))
        while (billesCoupees[k]! < coupees) {
          emettrePeptide()
          billesCoupees[k]!++
        }
        if (tempsEtat[k]! >= DUREE_DEGRADATION) {
          etat = ABSENTE
          etatCible[k] = ABSENTE
          tempsEtat[k] = 0
        }
      }

      if (etat === ABSENTE && tempsEtat[k]! >= DUREE_PAUSE) {
        // Une autre protéine du cytosol prend la place : le protéasome ne
        // désemplit pas, ~10⁶ exemplaires travaillent en même temps.
        libererChaine(k, false)
        nbUbCible[k] = 0
        semer(posCible, k, rPelote)
        vitCible[k3] = 0
        vitCible[k3 + 1] = 0
        vitCible[k3 + 2] = 0
        etat = ERRANTE
        etatCible[k] = ERRANTE
        tempsEtat[k] = 0
        chaineRetiree[k] = 0
      }

      // Rendu des billes.
      const cx = posCible[k3]!
      const cy = posCible[k3 + 1]!
      const cz = posCible[k3 + 2]!
      const restantes = Math.max(0, NB_BILLES - avance - BILLES_FIL)
      const retrecissement = etat === ENFILEE ? Math.cbrt(restantes / NB_BILLES) : 1
      const pelotY = Y_ENGAGEMENT + LONGUEUR_FIL + rPelote * retrecissement
      // Une protéine ne surgit pas du néant : la remplaçante entre en fondu.
      const apparition = etat === ERRANTE ? Math.min(1, tempsEtat[k]! / 0.35) : 1
      for (let i = 0; i < NB_BILLES; i++) {
        const b = (k * NB_BILLES + i) * 3
        if (etat === ABSENTE) {
          echelleTemp.setScalar(0)
          positionTemp.set(0, 0, 0)
        } else if (etat !== ENFILEE) {
          echelleTemp.setScalar(rBille * apparition)
          positionTemp.set(cx + replie[b]!, cy + replie[b + 1]!, cz + replie[b + 2]!)
        } else {
          const file = i - avance
          if (file < 0) {
            // Déjà passée le seuil du chapeau : la machine est opaque.
            echelleTemp.setScalar(0)
            positionTemp.set(0, 0, 0)
          } else if (file < BILLES_FIL) {
            // Brin déplié et ÉTIRÉ. Le pore fait 1,3 nm : c'est le seul état
            // sous lequel la chaîne peut passer.
            const y = Y_ENGAGEMENT + file * PAS_FIL
            positionTemp.set(
              Math.sin(file * 2.3 + temps * 2.6) * 0.0006,
              y,
              Math.cos(file * 1.8 + temps * 2.1) * 0.0006,
            )
            echelleTemp.set(rBille * 0.45, rBille * 1.7, rBille * 0.45)
          } else {
            echelleTemp.setScalar(rBille)
            positionTemp.set(
              replie[b]! * retrecissement,
              pelotY + replie[b + 1]! * retrecissement,
              replie[b + 2]! * retrecissement,
            )
          }
        }
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        cibles.setMatrixAt(k * NB_BILLES + i, matriceTemp)
      }
      if (etat === ENFILEE) {
        posCible[k3] = 0
        posCible[k3 + 1] = pelotY
        posCible[k3 + 2] = 0
      }
    }
    quaternionTemp.identity()
    cibles.instanceMatrix.needsUpdate = true

    // 4. Les ubiquitines : libres, portées par une E3, ou en chaîne sur une cible.
    for (let u = 0; u < NB_UBIQUITINES; u++) {
      const p = proprietaire[u]!
      if (p === LIBRE) {
        deriver(posUb, vitUb, u, VITESSE_UBIQUITINE, amorti, racineDt, dt)
        heurterCapsule(posUb, vitUb, u, 0.0015)
        positionTemp.set(posUb[u * 3]!, posUb[u * 3 + 1]!, posUb[u * 3 + 2]!)
      } else if (p >= NB_CIBLES) {
        const j3 = (p - NB_CIBLES) * 3
        positionTemp.set(
          posLigase[j3]! + 0.0036,
          posLigase[j3 + 1]! + 0.0034,
          posLigase[j3 + 2]! + 0.0012,
        )
      } else {
        // Chaîne K48 posée bout à bout : quatre maillons, comptables à l'œil.
        // Quatre ubiquitines pèsent 34 kDa, autant que la protéine qu'elles
        // condamnent — l'étiquette est aussi lourde que l'objet étiqueté.
        const d3 = p * 3
        const rang = rangUb[u]!
        const distance = rayonPelote[p]! + 0.0018 + rang * 0.0032
        const lateral = Math.sin(rang * 2.1) * 0.001
        positionTemp.set(
          posCible[d3]! + dirChaine[d3]! * distance + perpChaine[d3]! * lateral,
          posCible[d3 + 1]! + dirChaine[d3 + 1]! * distance + perpChaine[d3 + 1]! * lateral,
          posCible[d3 + 2]! + dirChaine[d3 + 2]! * distance + perpChaine[d3 + 2]! * lateral,
        )
        ecarterDeLaCapsule(positionTemp, 0.0015)
      }
      echelleTemp.set(0.0015, 0.0013, 0.0016)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      ubiquitines.setMatrixAt(u, matriceTemp)
    }
    ubiquitines.instanceMatrix.needsUpdate = true

    // 5. Rendu des ligases.
    for (let j = 0; j < NB_LIGASES; j++) {
      for (let l = 0; l < BLOBS_LIGASE; l++) {
        positionTemp.set(
          posLigase[j * 3]! + LOBES_LIGASE[l * 4]!,
          posLigase[j * 3 + 1]! + LOBES_LIGASE[l * 4 + 1]!,
          posLigase[j * 3 + 2]! + LOBES_LIGASE[l * 4 + 2]!,
        )
        echelleTemp.setScalar(LOBES_LIGASE[l * 4 + 3]!)
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        ligases.setMatrixAt(j * BLOBS_LIGASE + l, matriceTemp)
      }
    }
    ligases.instanceMatrix.needsUpdate = true

    // 6. Les peptides éjectés, de deux à trente acides aminés.
    for (let p = 0; p < NB_PEPTIDES; p++) {
      const reste = viePeptide[p]!
      if (reste <= 0) {
        echelleTemp.setScalar(0)
        positionTemp.set(0, 0, 0)
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        peptides.setMatrixAt(p, matriceTemp)
        continue
      }
      viePeptide[p] = reste - dt
      const p3 = p * 3
      // Freinage visqueux : à cette échelle un peptide s'arrête aussitôt lâché.
      const frein = Math.exp(-dt * 1.2)
      for (let c = 0; c < 3; c++) {
        vitPeptide[p3 + c] = vitPeptide[p3 + c]! * frein + (alea() - 0.5) * 0.05 * racineDt
        posPeptide[p3 + c] = posPeptide[p3 + c]! + vitPeptide[p3 + c]! * dt
      }
      const taille = taillePeptide[p]!
      // Un peptide ne retraverse pas la machine qui vient de le produire.
      heurterCapsule(posPeptide, vitPeptide, p, taille)
      const ecoule = DUREE_PEPTIDE - reste
      const fondu = Math.min(1, ecoule * 14, reste * 2.2)
      directionTemp.set(vitPeptide[p3]!, vitPeptide[p3 + 1]!, vitPeptide[p3 + 2]!)
      if (directionTemp.lengthSq() > 1e-12) {
        directionTemp.normalize()
        quaternionTemp.setFromUnitVectors(AXE_Y, directionTemp)
      }
      positionTemp.set(posPeptide[p3]!, posPeptide[p3 + 1]!, posPeptide[p3 + 2]!)
      echelleTemp.set(taille * fondu, taille * 1.6 * fondu, taille * fondu)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      peptides.setMatrixAt(p, matriceTemp)
    }
    quaternionTemp.identity()
    peptides.instanceMatrix.needsUpdate = true

    // 7. L'anneau d'ATPases bat pendant la translocation : c'est là que passent
    //    les 50 à 80 ATP. Le rythme est FIGURÉ — au facteur ×10 le cycle réel
    //    ferait trente coups par seconde, soit deux images par coup.
    let translocation = 0
    for (let k = 0; k < NB_CIBLES; k++) if (etatCible[k] === ENFILEE) translocation = 1
    const pompe = horloge[INTENSITE_POMPE]!
    horloge[INTENSITE_POMPE] = pompe + (translocation - pompe) * Math.min(1, dt * 6)
    for (let s = 0; s < SOUS_UNITES_ATPASE; s++) {
      const angle = (s / SOUS_UNITES_ATPASE) * Math.PI * 2
      // Battement main sur main : les six sous-unités tirent à tour de rôle.
      const battement =
        Math.sin(temps * 2.2 * Math.PI * 2 - angle) * 0.0009 * horloge[INTENSITE_POMPE]!
      positionTemp.set(
        Math.cos(angle) * RAYON_ATPASE,
        Y_ATPASE + battement,
        Math.sin(angle) * RAYON_ATPASE,
      )
      echelleTemp.setScalar(0.0018)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      chapeaux.setMatrixAt(s, matriceTemp)
    }
    chapeaux.instanceMatrix.needsUpdate = true
    echelleTemp.set(1, 1, 1)
  }

  animer(0)

  return [
    {
      cle: 'proteasome',
      nom: 'Dégradation par le protéasome',
      siege: 'Cytosol',
      ralentissement: 1 / 10,
      justificationFacteur:
        "Une chaîne complète — engagement, dépliement, dernier peptide — prend environ 23 s sur " +
        "protéine purifiée ; à ×10 elle tient en 2,3 s à l'écran. Au même facteur le protéasome " +
        'dessiné avale une cible toutes les sept secondes environ, soit une par minute réelle : ' +
        'dans la fourchette mesurée de 0,05 à 5 protéines par minute.',
      ellision:
        "Trois horloges cohabitent ici, et une seule est au facteur affiché. L'attente entre deux " +
        'rencontres est COUPÉE, pas ralentie : dans le cytosol une cible met des minutes à des heures ' +
        "avant de croiser une E3 puis un protéasome. L'agitation thermique est à l'inverse RALENTIE " +
        "d'environ cent mille — le coefficient de diffusion dessiné vaut 3·10⁻⁵ µm²/s contre 3 µm²/s " +
        'en cytosol, où une protéine traverserait ce champ en un cinquième de milliseconde et ne ' +
        "montrerait qu'un flou. La densité, enfin, est divisée par quarante : ce volume contient " +
        'réellement quelques centaines de protéines, on en dessine sept ; les ubiquitines libres sont ' +
        "au contraire bien plus nombreuses ici qu'en solution, sans quoi le recyclage serait invisible. " +
        "Sont absents l'enzyme d'activation E1, l'enzyme de conjugaison E2, et les chaînes K63 ou K11, " +
        'qui ne mènent pas au protéasome.',
      description:
        "On montre partout la synthèse des protéines, jamais leur destruction : les deux tournent " +
        'pourtant en parallèle en permanence. Une cible reçoit une chaîne d\'ubiquitines posées une à ' +
        'une par une ligase E3 ; en dessous de quatre maillons en liaison K48 le protéasome la refuse, ' +
        'et elle rebondit sur le chapeau. Au-delà, le chapeau 19S la retient, retire la chaîne en bloc ' +
        'pour la recycler, puis DÉPLIE la protéine et la fait passer en brin étiré dans le tonneau 20S, ' +
        'dont le pore de 1,3 nm est trop étroit pour une protéine repliée. Il en ressort des peptides ' +
        'de deux à trente acides aminés.',
      objet: groupe,
      ancre: SIEGE.clone(),
      rayonCadrage: 0.05,
      couleur: TEINTE_ALPHA,
      animer,
    },
  ]
}
