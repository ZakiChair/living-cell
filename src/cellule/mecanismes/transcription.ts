import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import { SIEGES, type Mecanisme } from './contrat.js'

/**
 * TRANSCRIPTION DE L'ADN EN ARN PAR L'ARN POLYMÉRASE II.
 *
 * Trois choses que les animations de transcription escamotent presque toujours,
 * et qui sont ici la matière même de la scène.
 *
 * 1. L'ADN nu n'existe pas dans un noyau. Le segment est enroulé sur vingt
 *    nucléosomes, deux pelotes de chromatine qui encadrent un corps de gène
 *    dégarni — c'est bien ainsi qu'un gène transcrit se présente.
 * 2. La bulle de transcription. Sur douze à quatorze paires de bases seulement,
 *    les deux brins sont écartés et les barreaux rompus ; la bulle voyage avec
 *    l'enzyme et se referme derrière elle. Elle fait 4,4 nm de long : c'est
 *    minuscule, et c'est la vraie taille.
 * 3. Le surenroulement. La polymérase ne tourne pas autour de l'ADN : elle
 *    pousse donc les tours devant elle et les arrache derrière. La contrainte
 *    reste piégée entre les nucléosomes qui ancrent le segment, le corps du gène
 *    se tord de plus en plus, et il faut qu'une topoisomérase passe le relâcher.
 *
 * Les longueurs sont vraies : 3,4 nm et 10,5 paires de bases par tour, 0,324 nm
 * par paire de bases, 1,394 µm pour les 4 305 pb du segment. Ce qui a été
 * échantillonné, raccourci ou amplifié est déclaré dans `ellision`.
 */

// ── Double hélice, en micromètres ──────────────────────────────────────────
const TAU = Math.PI * 2
const PB_PAR_TOUR = 10.5
const PAS_HELICE = 0.0034
/** Montée par paire de bases : 0,324 nm. */
const MONTEE = PAS_HELICE / PB_PAR_TOUR
const NB_TOURS = 410
const NB_PB = Math.round(NB_TOURS * PB_PAR_TOUR)
/** Cinq grains par tour et par brin : un grain pour deux nucléotides. */
const ECH_PAR_TOUR = 5
const PAS_ECH = PB_PAR_TOUR / ECH_PAR_TOUR
const NB_ECH = NB_TOURS * ECH_PAR_TOUR
/** Rayon du squelette phosphate : le duplex fait 2,5 nm de large pour 2 nm réels. */
const RAYON_HELICE = 0.00075
const RAYON_GRAIN = 0.0005
/** 144° : les deux brins ne sont pas diamétralement opposés — petit et grand sillon. */
const DEPHASAGE = 2.51
const COS_DEPH = Math.cos(DEPHASAGE)
const SIN_DEPH = Math.sin(DEPHASAGE)
/** Cinq grains par tour : les cinq phases hélicoïdales se répètent à l'identique. */
const COS5 = new Float32Array(ECH_PAR_TOUR)
const SIN5 = new Float32Array(ECH_PAR_TOUR)
for (let i = 0; i < ECH_PAR_TOUR; i++) {
  COS5[i] = Math.cos((TAU * i) / ECH_PAR_TOUR)
  SIN5[i] = Math.sin((TAU * i) / ECH_PAR_TOUR)
}

// ── Nucléosomes ────────────────────────────────────────────────────────────
/** 147 pb enroulées, 43 pb de lien : la répétition mesurée dans une cellule humaine. */
const PB_REPETITION = 190
const PB_ENROULES = 147
const DECALAGE_ENROULEMENT = 21.5
const TOURS_NUCLEOSOME = 1.65
/** Le cœur d'histones fait 5,5 nm de haut ; l'ADN n'avance que de 3,9 nm en 147 pb. */
const MONTEE_ENROULEE = 0.0039 / PB_ENROULES
const DPHI_ENROULEMENT = (TOURS_NUCLEOSOME * TAU) / PB_ENROULES
/**
 * Rayon de la superhélice, déduit et non choisi : il est le seul qui fasse
 * tenir exactement 0,324 µm de contour par paire de bases dans un enroulement
 * de 1,65 tour qui n'avance que de 3,9 nm. Il vaut 4,58 nm.
 */
const RAYON_ENROULEMENT =
  Math.sqrt(MONTEE * MONTEE - MONTEE_ENROULEE * MONTEE_ENROULEE) / DPHI_ENROULEMENT
/**
 * Entrée et sortie progressives, sinon le brin sauterait de 4,6 nm d'un grain
 * au suivant. Trente-quatre paires de bases : en deçà, l'ADN s'écarterait de
 * l'axe plus vite qu'il n'avance, et le contour ne pourrait plus valoir
 * 0,324 nm par paire de bases.
 */
const RAMPE_ENROULEMENT = 34

// ── Corps du gène ──────────────────────────────────────────────────────────
const PB_DEBUT_GENE = 1900
const PB_FIN_GENE = 2400
const PB_GENE = PB_FIN_GENE - PB_DEBUT_GENE
/**
 * Marge d'ancrage. Au-delà, le masque de torsion vaut exactement zéro : les
 * grains y sont écrits une fois pour toutes et ne bougent plus. C'est aussi
 * l'histoire physique — la chromatine ancre l'ADN, et c'est pour ça que la
 * contrainte de torsion s'accumule au lieu de s'échapper par les bouts.
 */
const MARGE = 260
const PB_MIN_MOBILE = PB_DEBUT_GENE - MARGE
const PB_MAX_MOBILE = PB_FIN_GENE + MARGE
const K_MIN = Math.floor(PB_MIN_MOBILE / PAS_ECH)
const K_MAX = Math.min(NB_ECH - 1, Math.ceil(PB_MAX_MOBILE / PAS_ECH))

// ── Pelotes de chromatine qui encadrent le gène ────────────────────────────
const RAYON_PELOTE = 0.02
const PAS_PELOTE = 0.026
const ARC_TOUR_PELOTE = Math.sqrt((TAU * RAYON_PELOTE) ** 2 + PAS_PELOTE * PAS_PELOTE)
const OMEGA_PELOTE = TAU / ARC_TOUR_PELOTE
const LARGEUR_TRANSITION = 0.05
const NB_AXE = 1000

// ── Minutage, en secondes d'écran ──────────────────────────────────────────
/** 60 nt/s en médiane, ralenti ×20 : trois nucléotides par seconde à l'écran. */
const VITESSE_NT = 3
const DUREE_ELONGATION = PB_GENE / VITESSE_NT
const DUREE_CYCLE = DUREE_ELONGATION + 9
const NB_PGE = 3
/** Décalages irréguliers : trois polymérases sur un gène ne partent pas en cadence. */
const DEPARTS = [0, 0.31, 0.655]
/** Demi-largeur de la bulle : 13 pb écartées, soit 4,2 nm. */
const DEMI_BULLE = 6.5
/** Écartement des brins dans la bulle, de part et d'autre de l'axe. */
const OUVERTURE = 0.0028

// ── Surenroulement ─────────────────────────────────────────────────────────
const PERIODE_TOPO = 26
const LARGEUR_TORSION = 70
/** Surplus de tours devant la polymérase : amplifié pour être visible. */
const TOURS_SURPLUS = 1.8
const WRITHE_MAX = 0.005
/** Longueur d'onde de la vrille, 90 pb soit 29 nm : lisible même de loin. */
const PULSATION_WRITHE = TAU / 90

// ── ARN naissant ───────────────────────────────────────────────────────────
const NB_GRAINS_ARN = 72
const NT_PAR_GRAIN = 7
const PAS_ARN = 0.0016
const RAYON_GRAIN_ARN = 0.0009
/** Le canal de sortie de l'ARN débouche à 7 nm de l'axe, en surface de l'enzyme. */
const RAYON_SORTIE = 0.007
/** La coiffe est posée dès le 25e nucléotide, pas à la fin. */
const NT_COIFFE = 25

// ── Nucléotides libres ─────────────────────────────────────────────────────
const NTP_PAR_PGE = 8
const NB_NTP_LIBRES = 16
const NB_NTP = NB_PGE * NTP_PAR_PGE + NB_NTP_LIBRES
const NB_ERRANTS = NB_NTP + 1

// ── Teintes ────────────────────────────────────────────────────────────────
const TEINTE_POLYMERASE = TEINTES.golgi
const TEINTE_TOPO = TEINTES.lysosome
const TEINTE_ARN = TEINTES.vesicule
const TEINTE_COIFFE = 0xf0e442

// ── Temporaires hissés : animer() ne doit RIEN allouer ─────────────────────
const AXE_Y = new THREE.Vector3(0, 1, 0)
const matriceTemp = new THREE.Matrix4()
const baseTemp = new THREE.Matrix4()
const quaternionTemp = new THREE.Quaternion()
const quaternionId = new THREE.Quaternion()
const echelleTemp = new THREE.Vector3(1, 1, 1)
const posTemp = new THREE.Vector3()
const centreTemp = new THREE.Vector3()
const uTemp = new THREE.Vector3()
const vTemp = new THREE.Vector3()
const tanTemp = new THREE.Vector3()
const wTemp = new THREE.Vector3()
const axeTemp = new THREE.Vector3()
const briTemp = new THREE.Vector3()
const sortieArn = new THREE.Vector3()

/** Rampe adoucie, bornée à [0, 1] — et exactement nulle hors de l'intervalle. */
function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

/** Bosse brève : une rencontre qui touche puis repart. */
function bosse(x: number): number {
  return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x)
}

const NB_HARMONIQUES = 3
const POIDS_HARMONIQUES = [0.5, 0.32, 0.18]

/**
 * Dérive erratique déterministe.
 *
 * Trois sinusoïdes de fréquences incommensurables par axe. Ce n'est pas un vrai
 * mouvement brownien — il faudrait de l'état — mais le tracé est errant, sans
 * période perceptible, et surtout SANS DIRECTION : un nucléotide libre ne sait
 * pas où est le site actif, il le trouve par collision ou pas du tout.
 */
function derive(
  indice: number,
  temps: number,
  amplitude: number,
  frequences: Float32Array,
  phases: Float32Array,
  sortie: THREE.Vector3,
): THREE.Vector3 {
  const base = indice * 3 * NB_HARMONIQUES
  let x = 0
  let y = 0
  let z = 0
  for (let h = 0; h < NB_HARMONIQUES; h++) {
    const poids = POIDS_HARMONIQUES[h]!
    const ix = base + h
    const iy = base + NB_HARMONIQUES + h
    const iz = base + 2 * NB_HARMONIQUES + h
    x += poids * Math.sin(TAU * (frequences[ix]! * temps + phases[ix]!))
    y += poids * Math.sin(TAU * (frequences[iy]! * temps + phases[iy]!))
    z += poids * Math.sin(TAU * (frequences[iz]! * temps + phases[iz]!))
  }
  return sortie.set(x * amplitude, y * amplitude, z * amplitude)
}

export function creerTranscription(): Mecanisme[] {
  const alea = creerAlea(11071981)
  const groupe = new THREE.Group()
  // Dans le noyau, à 1,4 µm de son centre : le segment tient largement sous les
  // 3 µm de l'enveloppe, même en comptant son encombrement.
  groupe.position.copy(SIEGES.noyau).add(new THREE.Vector3(-0.2, 0.9, 1.1))
  groupe.rotation.set(0.22, -0.55, 0.14)

  // ── Où sont les nucléosomes ─────────────────────────────────────────────
  // Le corps du gène en est dégarni : c'est l'état d'un gène très transcrit, et
  // c'est aussi ce qui rend la bulle observable.
  const debutsNucleosome: number[] = []
  for (let d = 0; d + PB_REPETITION <= PB_DEBUT_GENE; d += PB_REPETITION) debutsNucleosome.push(d)
  for (let d = PB_FIN_GENE; d + PB_REPETITION <= NB_PB; d += PB_REPETITION) debutsNucleosome.push(d)
  const NB_NUCLEOSOMES = debutsNucleosome.length

  // Table unique : les trois boucles de construction ne peuvent pas diverger
  // sur l'emplacement des nucléosomes.
  const nucleosomeDe = new Int16Array(NB_PB + 1).fill(-1)
  for (let j = 0; j < NB_NUCLEOSOMES; j++) {
    const debut = debutsNucleosome[j]! + DECALAGE_ENROULEMENT
    for (let b = Math.ceil(debut); b < debut + PB_ENROULES && b <= NB_PB; b++) {
      nucleosomeDe[b] = j
    }
  }
  const phaseNucleosome = new Float32Array(NB_NUCLEOSOMES)
  for (let j = 0; j < NB_NUCLEOSOMES; j++) phaseNucleosome[j] = alea() * TAU

  /** Rayon de la superhélice à une position donnée, nul hors des nucléosomes. */
  const rayonEnroulement = (b: number): number => {
    const j = nucleosomeDe[Math.max(0, Math.min(NB_PB, Math.floor(b)))]!
    if (j < 0) return 0
    const y = b - (debutsNucleosome[j]! + DECALAGE_ENROULEMENT)
    return RAYON_ENROULEMENT * lissage(Math.min(y, PB_ENROULES - y) / RAMPE_ENROULEMENT)
  }

  /**
   * Ce que la fibre gagne en longueur pour une paire de bases.
   *
   * Le contour, lui, vaut toujours 0,324 nm : ce qui part dans le tour de
   * superhélice et dans l'écartement à l'axe est autant qui ne part pas en
   * avancée. Hors nucléosome il ne reste que l'avancée ; au cœur d'un
   * nucléosome il ne reste que 0,027 nm, et c'est ça, la compaction.
   */
  const avanceAxiale = (b: number): number => {
    if (nucleosomeDe[Math.floor(b)]! < 0) return MONTEE
    const r = rayonEnroulement(b)
    const dr = rayonEnroulement(b + 0.5) - rayonEnroulement(b - 0.5)
    const tangentiel = r * DPHI_ENROULEMENT
    const reste = MONTEE * MONTEE - tangentiel * tangentiel - dr * dr
    return Math.sqrt(Math.max(MONTEE_ENROULEE * MONTEE_ENROULEE * 0.25, reste))
  }

  // ── Abscisse le long de l'axe de la fibre ───────────────────────────────
  const axialParPb = new Float32Array(NB_PB + 1)
  let cumul = 0
  for (let b = 0; b < NB_PB; b++) {
    axialParPb[b] = cumul
    cumul += avanceAxiale(b)
  }
  axialParPb[NB_PB] = cumul
  const AXE_TOTAL = cumul
  const AXE_GENE_DEBUT = axialParPb[PB_DEBUT_GENE]!
  const AXE_GENE_FIN = axialParPb[PB_FIN_GENE]!

  const axialDe = (b: number): number => {
    const i = Math.floor(b)
    if (i < 0) return 0
    if (i >= NB_PB) return AXE_TOTAL
    return axialParPb[i]! + (b - i) * (axialParPb[i + 1]! - axialParPb[i]!)
  }

  // ── Axe de la fibre : deux pelotes serrées, un gène tendu entre elles ────
  // Une seule formule, paramétrée par la longueur d'arc : le rayon de la
  // spirale s'annule sur le corps du gène et se rétablit dans les flancs.
  const enveloppePelote = (s: number): number =>
    1 -
    lissage((s - AXE_GENE_DEBUT + LARGEUR_TRANSITION * 0.5) / LARGEUR_TRANSITION) +
    lissage((s - AXE_GENE_FIN + LARGEUR_TRANSITION * 0.5) / LARGEUR_TRANSITION)

  const PAS_AXE = AXE_TOTAL / (NB_AXE - 1)
  const pointsAxe: THREE.Vector3[] = []
  let avanceX = 0
  for (let i = 0; i < NB_AXE; i++) {
    const s = i * PAS_AXE
    const r = RAYON_PELOTE * enveloppePelote(s)
    const phi = OMEGA_PELOTE * s
    // Léger serpentement du corps de gène : un ADN parfaitement rectiligne
    // n'existe pas non plus.
    const ondulation = Math.sin(s * 26) * 0.0025
    pointsAxe.push(
      new THREE.Vector3(avanceX, r * Math.cos(phi) + ondulation, r * Math.sin(phi)),
    )
    const rSuivant = RAYON_PELOTE * enveloppePelote(s + PAS_AXE)
    const derivee = (rSuivant - r) / PAS_AXE
    // On avance en x de ce qu'il reste de vitesse une fois la spirale payée :
    // l'axe reste ainsi paramétré par sa longueur d'arc.
    const reste = 1 - derivee * derivee - r * r * OMEGA_PELOTE * OMEGA_PELOTE
    avanceX += PAS_AXE * Math.sqrt(Math.max(0.04, reste))
  }

  const tangentesAxe: THREE.Vector3[] = []
  for (let i = 0; i < NB_AXE; i++) {
    const a = pointsAxe[Math.max(0, i - 1)]!
    const b = pointsAxe[Math.min(NB_AXE - 1, i + 1)]!
    tangentesAxe.push(new THREE.Vector3().subVectors(b, a).normalize())
  }
  // Repère à torsion minimale : transporté de proche en proche plutôt que
  // recalculé, sinon il bascule d'un coup au moindre point d'inflexion.
  const normalesAxe: THREE.Vector3[] = []
  const binormalesAxe: THREE.Vector3[] = []
  const depart = new THREE.Vector3(0, 0, 1)
  if (Math.abs(depart.dot(tangentesAxe[0]!)) > 0.9) depart.set(0, 1, 0)
  let normale = new THREE.Vector3()
    .copy(depart)
    .addScaledVector(tangentesAxe[0]!, -depart.dot(tangentesAxe[0]!))
    .normalize()
  for (let i = 0; i < NB_AXE; i++) {
    const t = tangentesAxe[i]!
    normale = normale.clone().addScaledVector(t, -normale.dot(t)).normalize()
    normalesAxe.push(normale)
    binormalesAxe.push(new THREE.Vector3().crossVectors(t, normale))
  }

  const cadreAxe = (
    s: number,
    pos: THREE.Vector3,
    nor: THREE.Vector3,
    bin: THREE.Vector3,
    tan: THREE.Vector3,
  ): void => {
    const f = Math.min(Math.max(s / PAS_AXE, 0), NB_AXE - 1.001)
    const i = Math.floor(f)
    const g = f - i
    pos.copy(pointsAxe[i]!).lerp(pointsAxe[i + 1]!, g)
    nor.copy(normalesAxe[i]!).lerp(normalesAxe[i + 1]!, g).normalize()
    bin.copy(binormalesAxe[i]!).lerp(binormalesAxe[i + 1]!, g).normalize()
    tan.copy(tangentesAxe[i]!).lerp(tangentesAxe[i + 1]!, g).normalize()
  }

  // ── Repère figé de chaque nucléosome ────────────────────────────────────
  // Un nucléosome est un objet RIGIDE : l'ADN s'y enroule autour d'un axe
  // droit et ne suit pas la courbure de la fibre. Le prendre pour un solénoïde
  // qui épouse la fibre allongeait le contour de 9 % et rendait l'espacement
  // des grains irrégulier.
  const posAxeTemp = new THREE.Vector3()
  const norTemp = new THREE.Vector3()
  const binTemp = new THREE.Vector3()
  const tgtTemp = new THREE.Vector3()
  const rigideTemp = new THREE.Vector3()
  const axialNucleosome = new Float32Array(NB_NUCLEOSOMES)
  const posNucleosome: THREE.Vector3[] = []
  const norNucleosome: THREE.Vector3[] = []
  const binNucleosome: THREE.Vector3[] = []
  const tanNucleosome: THREE.Vector3[] = []
  for (let j = 0; j < NB_NUCLEOSOMES; j++) {
    const milieu = debutsNucleosome[j]! + DECALAGE_ENROULEMENT + PB_ENROULES * 0.5
    const s = axialDe(milieu)
    axialNucleosome[j] = s
    cadreAxe(s, posAxeTemp, norTemp, binTemp, tgtTemp)
    posNucleosome.push(posAxeTemp.clone())
    norNucleosome.push(norTemp.clone())
    binNucleosome.push(binTemp.clone())
    tanNucleosome.push(tgtTemp.clone())
  }

  // ── Ligne médiane de l'ADN : l'axe, plus l'enroulement nucléosomal ──────
  const cx = new Float32Array(NB_ECH)
  const cy = new Float32Array(NB_ECH)
  const cz = new Float32Array(NB_ECH)
  for (let k = 0; k < NB_ECH; k++) {
    const b = k * PAS_ECH
    const s = axialDe(b)
    cadreAxe(s, posAxeTemp, norTemp, binTemp, tgtTemp)
    const j = nucleosomeDe[Math.floor(b)]!
    if (j >= 0) {
      const y = b - (debutsNucleosome[j]! + DECALAGE_ENROULEMENT)
      const rampe = lissage(Math.min(y, PB_ENROULES - y) / RAMPE_ENROULEMENT)
      const r = RAYON_ENROULEMENT * rampe
      const phi = DPHI_ENROULEMENT * y + phaseNucleosome[j]!
      const nor = norNucleosome[j]!
      const bin = binNucleosome[j]!
      const tan = tanNucleosome[j]!
      // On quitte la fibre pour le repère rigide au même rythme que le rayon
      // s'ouvre : à l'entrée et à la sortie, les deux coïncident exactement.
      rigideTemp
        .copy(posNucleosome[j]!)
        .addScaledVector(tan, s - axialNucleosome[j]!)
      posAxeTemp
        .lerp(rigideTemp, rampe)
        .addScaledVector(nor, r * Math.cos(phi))
        .addScaledVector(bin, r * Math.sin(phi))
    }
    cx[k] = posAxeTemp.x
    cy[k] = posAxeTemp.y
    cz[k] = posAxeTemp.z
  }

  // On recentre sur le milieu du gène : c'est là que la caméra vise, et le
  // groupe doit donc y avoir son origine.
  const kCentre = Math.round((PB_DEBUT_GENE + PB_FIN_GENE) * 0.5 / PAS_ECH)
  const decX = cx[kCentre]!
  const decY = cy[kCentre]!
  const decZ = cz[kCentre]!
  for (let k = 0; k < NB_ECH; k++) {
    cx[k]! -= decX
    cy[k]! -= decY
    cz[k]! -= decZ
  }

  // Repère de l'hélice, transporté le long de la ligne médiane elle-même.
  const ux = new Float32Array(NB_ECH)
  const uy = new Float32Array(NB_ECH)
  const uz = new Float32Array(NB_ECH)
  const vx = new Float32Array(NB_ECH)
  const vy = new Float32Array(NB_ECH)
  const vz = new Float32Array(NB_ECH)
  const tx = new Float32Array(NB_ECH)
  const ty = new Float32Array(NB_ECH)
  const tz = new Float32Array(NB_ECH)
  const tangenteCourante = new THREE.Vector3()
  const uCourant = new THREE.Vector3(0, 0, 1)
  const vCourant = new THREE.Vector3()
  for (let k = 0; k < NB_ECH; k++) {
    const a = Math.max(0, k - 1)
    const b = Math.min(NB_ECH - 1, k + 1)
    tangenteCourante.set(cx[b]! - cx[a]!, cy[b]! - cy[a]!, cz[b]! - cz[a]!).normalize()
    if (k === 0 && Math.abs(uCourant.dot(tangenteCourante)) > 0.9) uCourant.set(0, 1, 0)
    uCourant.addScaledVector(tangenteCourante, -uCourant.dot(tangenteCourante)).normalize()
    vCourant.crossVectors(tangenteCourante, uCourant)
    ux[k] = uCourant.x
    uy[k] = uCourant.y
    uz[k] = uCourant.z
    vx[k] = vCourant.x
    vy[k] = vCourant.y
    vz[k] = vCourant.z
    tx[k] = tangenteCourante.x
    ty[k] = tangenteCourante.y
    tz[k] = tangenteCourante.z
  }

  /** Positions courantes des deux brins, relues par les barreaux. */
  const ax = new Float32Array(NB_ECH)
  const ay = new Float32Array(NB_ECH)
  const az = new Float32Array(NB_ECH)
  const bx = new Float32Array(NB_ECH)
  const by = new Float32Array(NB_ECH)
  const bz = new Float32Array(NB_ECH)

  /** Échantillonne la ligne médiane et son repère à une position en pb. */
  const echantillonner = (b: number): void => {
    const f = Math.min(Math.max(b / PAS_ECH, 0), NB_ECH - 1.001)
    const i = Math.floor(f)
    const g = f - i
    const j = i + 1
    centreTemp.set(
      cx[i]! + (cx[j]! - cx[i]!) * g,
      cy[i]! + (cy[j]! - cy[i]!) * g,
      cz[i]! + (cz[j]! - cz[i]!) * g,
    )
    uTemp.set(ux[i]! + (ux[j]! - ux[i]!) * g, uy[i]! + (uy[j]! - uy[i]!) * g, uz[i]! + (uz[j]! - uz[i]!) * g).normalize()
    vTemp.set(vx[i]! + (vx[j]! - vx[i]!) * g, vy[i]! + (vy[j]! - vy[i]!) * g, vz[i]! + (vz[j]! - vz[i]!) * g).normalize()
    tanTemp.set(tx[i]! + (tx[j]! - tx[i]!) * g, ty[i]! + (ty[j]! - ty[i]!) * g, tz[i]! + (tz[j]! - tz[i]!) * g).normalize()
  }

  // ── Les deux brins ──────────────────────────────────────────────────────
  const geoGrain = new THREE.IcosahedronGeometry(RAYON_GRAIN, 0)
  const brinA = new THREE.InstancedMesh(
    geoGrain,
    materiauOrganite(TEINTES.noyau, { doubleFace: false }),
    NB_ECH,
  )
  const brinB = new THREE.InstancedMesh(
    geoGrain,
    materiauOrganite(TEINTES.membraneNucleaire, { doubleFace: false }),
    NB_ECH,
  )
  brinA.frustumCulled = false
  brinB.frustumCulled = false
  groupe.add(brinA, brinB)

  // ── Les barreaux : les paires de bases ──────────────────────────────────
  // Pleine densité sur le corps du gène — c'est là qu'on doit voir les paires
  // se rompre — et une sur dix ailleurs, faute de budget d'instances.
  const indicesBarreaux: number[] = []
  for (let k = 0; k < NB_ECH; k++) {
    const b = k * PAS_ECH
    if (b >= PB_DEBUT_GENE && b < PB_FIN_GENE) indicesBarreaux.push(k)
    else if (k % 10 === 0) indicesBarreaux.push(k)
  }
  const NB_BARREAUX = indicesBarreaux.length
  const barreauxK = new Uint16Array(indicesBarreaux)
  let ibMin = NB_BARREAUX
  let ibMax = -1
  for (let n = 0; n < NB_BARREAUX; n++) {
    const k = barreauxK[n]!
    if (k >= K_MIN && k <= K_MAX) {
      if (n < ibMin) ibMin = n
      ibMax = n
    }
  }
  const barreaux = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.0003, 0.0003, 1, 5, 1, false),
    materiauOrganite(TEINTES.chromatine, { doubleFace: false }),
    NB_BARREAUX,
  )
  barreaux.frustumCulled = false
  groupe.add(barreaux)

  // ── Les nucléosomes ─────────────────────────────────────────────────────
  const nucleosomes = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.0033, 0.0033, 0.0055, 10, 1, false),
    materiauOrganite(TEINTES.cytosquelette, { doubleFace: false }),
    NB_NUCLEOSOMES,
  )
  nucleosomes.frustumCulled = false
  groupe.add(nucleosomes)
  echelleTemp.set(1, 1, 1)
  for (let j = 0; j < NB_NUCLEOSOMES; j++) {
    posAxeTemp.copy(posNucleosome[j]!)
    posAxeTemp.x -= decX
    posAxeTemp.y -= decY
    posAxeTemp.z -= decZ
    quaternionTemp.setFromUnitVectors(AXE_Y, tanNucleosome[j]!)
    matriceTemp.compose(posAxeTemp, quaternionTemp, echelleTemp)
    nucleosomes.setMatrixAt(j, matriceTemp)
  }
  nucleosomes.instanceMatrix.needsUpdate = true

  // ── Les trois polymérases ───────────────────────────────────────────────
  // Repère local imposé : +X le long de l'ouverture de la bulle, +Y le long de
  // l'ADN, et le canal de sortie de l'ARN débouche en -Z. Les mâchoires sont
  // donc décalées en ±X, sinon elles traverseraient le transcrit.
  const polymerases: THREE.Group[] = []
  for (let i = 0; i < NB_PGE; i++) {
    const machine = new THREE.Group()
    // Le corps de l'enzyme fait 13 nm et engloberait entièrement la bulle qu'il
    // ouvre : il est donc dessiné translucide, comme l'écorché de la cellule.
    const corps = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.0065, 1),
      materiauOrganite(TEINTE_POLYMERASE, { opacite: 0.52, emissif: 0x2a1420 }),
    )
    corps.scale.set(1.05, 0.95, 1.15)
    const machoire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.0038, 1),
      materiauOrganite(0xa85a86, { doubleFace: false }),
    )
    machoire.position.set(0.0058, -0.001, 0)
    const pince = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.003, 0),
      materiauOrganite(0xa85a86, { doubleFace: false }),
    )
    pince.position.set(-0.0058, 0.0012, 0)
    machine.add(corps, machoire, pince)
    groupe.add(machine)
    polymerases.push(machine)
  }

  // ── L'ARN naissant ──────────────────────────────────────────────────────
  const arn = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_GRAIN_ARN, 1),
    materiauOrganite(TEINTE_ARN, { doubleFace: false }),
    NB_PGE * NB_GRAINS_ARN,
  )
  arn.frustumCulled = false
  groupe.add(arn)

  // Marche au hasard figée une fois pour toutes, en coordonnées du repère
  // local de la polymérase : le transcrit garde sa forme et ne fait que
  // s'allonger, extrudé par le canal de sortie.
  const offsetsArn = new Float32Array(NB_PGE * NB_GRAINS_ARN * 3)
  const phasesArn = new Float32Array(NB_PGE * NB_GRAINS_ARN)
  for (let i = 0; i < NB_PGE; i++) {
    // Chaque transcrit part dans une direction différente : trois queues
    // parallèles se liraient comme une seule tache.
    const angle = i * 2.1
    let du = Math.sin(angle)
    let dv = Math.cos(angle)
    let dt = 0
    let ou = 0
    let ov = 0
    let ot = 0
    for (let j = 0; j < NB_GRAINS_ARN; j++) {
      du += (alea() - 0.5) * 0.95 + Math.sin(angle) * 0.28
      dv += (alea() - 0.5) * 0.95 + Math.cos(angle) * 0.28
      dt += (alea() - 0.5) * 0.95
      const norme = Math.hypot(du, dv, dt) || 1
      du /= norme
      dv /= norme
      dt /= norme
      ou += du * PAS_ARN
      ov += dv * PAS_ARN
      ot += dt * PAS_ARN
      const base = (i * NB_GRAINS_ARN + j) * 3
      offsetsArn[base] = ou
      offsetsArn[base + 1] = ov
      offsetsArn[base + 2] = ot
      phasesArn[i * NB_GRAINS_ARN + j] = alea() * TAU
    }
  }

  const coiffes: THREE.Mesh[] = []
  for (let i = 0; i < NB_PGE; i++) {
    const coiffe = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.0014, 1),
      materiauOrganite(TEINTE_COIFFE, { doubleFace: false, emissif: 0x3a3610 }),
    )
    groupe.add(coiffe)
    coiffes.push(coiffe)
  }

  // ── Les nucléotides libres ──────────────────────────────────────────────
  const ntp = new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(0.0008, 0),
    materiauOrganite(TEINTE_ARN, { doubleFace: false, opacite: 0.85 }),
    NB_NTP,
  )
  ntp.frustumCulled = false
  groupe.add(ntp)

  const ancresNtp = new Float32Array(NB_PGE * NTP_PAR_PGE * 2)
  for (let n = 0; n < NB_PGE * NTP_PAR_PGE; n++) {
    ancresNtp[n * 2] = (alea() - 0.5) * 0.03
    ancresNtp[n * 2 + 1] = (alea() - 0.5) * 0.03
  }
  const centresNtpLibres: THREE.Vector3[] = []
  for (let n = 0; n < NB_NTP_LIBRES; n++) {
    centresNtpLibres.push(
      new THREE.Vector3((alea() - 0.5) * 0.2, (alea() - 0.5) * 0.09, (alea() - 0.5) * 0.09),
    )
  }

  const frequences = new Float32Array(NB_ERRANTS * 3 * NB_HARMONIQUES)
  const phases = new Float32Array(NB_ERRANTS * 3 * NB_HARMONIQUES)
  for (let i = 0; i < frequences.length; i++) {
    frequences[i] = 0.2 + alea() * 1.1
    phases[i] = alea()
  }

  // ── La topoisomérase ────────────────────────────────────────────────────
  const topoisomerase = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.006, 1),
    materiauOrganite(TEINTE_TOPO, { doubleFace: false }),
  )
  topoisomerase.scale.set(1, 0.8, 1.1)
  groupe.add(topoisomerase)

  // ── État de l'image en cours ────────────────────────────────────────────
  const pgePb = new Float32Array(NB_PGE)
  const pgePresence = new Float32Array(NB_PGE)
  const pgeNt = new Float32Array(NB_PGE)
  const pgeLibere = new Float32Array(NB_PGE)
  let amplitudeTorsion = 0

  /**
   * Le masque d'ancrage : exactement nul hors de [PB_MIN_MOBILE, PB_MAX_MOBILE].
   * `lissage` borne à [0, 1], donc les deux facteurs s'annulent vraiment aux
   * bornes — c'est ce qui autorise à figer les grains au-delà.
   */
  const masque = (b: number): number =>
    lissage((b - PB_MIN_MOBILE) / MARGE) * (1 - lissage((b - (PB_MAX_MOBILE - MARGE)) / MARGE))

  /** Cloche de vrille : le surenroulement est le plus fort près des enzymes. */
  const cloche = (b: number): number => {
    let m = 0
    for (let i = 0; i < NB_PGE; i++) {
      const pres = pgePresence[i]!
      if (pres <= 0) continue
      const x = (b - pgePb[i]!) / 110
      const c = pres / (1 + x * x)
      if (c > m) m = c
    }
    return m
  }

  /** Déplace `centreTemp` de la vrille, comme le fait la boucle des brins. */
  const appliquerVrille = (b: number, temps: number): void => {
    const w = masque(b) * amplitudeTorsion * WRITHE_MAX * cloche(b)
    if (w <= 1e-7) return
    const psi = b * PULSATION_WRITHE + temps * 1.1
    centreTemp.addScaledVector(uTemp, w * Math.cos(psi)).addScaledVector(vTemp, w * Math.sin(psi))
  }

  const majBrins = (k0: number, k1: number, temps: number): void => {
    echelleTemp.set(1, 1, 1)
    for (let k = k0; k <= k1; k++) {
      const b = k * PAS_ECH
      let sommeTorsion = 0
      let clocheMax = 0
      let ouverture = 0
      for (let i = 0; i < NB_PGE; i++) {
        const pres = pgePresence[i]!
        if (pres <= 0) continue
        const x = b - pgePb[i]!
        const absX = x < 0 ? -x : x
        // Devant l'enzyme les tours s'entassent, derrière ils sont arrachés.
        // Entre deux polymérases voisines, les deux contraintes s'annulent —
        // c'est le modèle des domaines jumeaux, et il tombe tout seul de la somme.
        sommeTorsion += (pres * x) / (LARGEUR_TORSION + absX)
        const xc = x / 110
        const c = pres / (1 + xc * xc)
        if (c > clocheMax) clocheMax = c
        if (absX < DEMI_BULLE) {
          const e = pres * lissage(1 - absX / DEMI_BULLE)
          if (e > ouverture) ouverture = e
        }
      }
      const m = masque(b)
      const torsion = m * amplitudeTorsion * TOURS_SURPLUS * TAU * sommeTorsion
      const w = m * amplitudeTorsion * WRITHE_MAX * clocheMax

      const cosT = Math.cos(torsion)
      const sinT = Math.sin(torsion)
      const phase = k % ECH_PAR_TOUR
      const c0 = COS5[phase]!
      const s0 = SIN5[phase]!
      const ca = c0 * cosT - s0 * sinT
      const sa = s0 * cosT + c0 * sinT
      const cb = ca * COS_DEPH - sa * SIN_DEPH
      const sb = sa * COS_DEPH + ca * SIN_DEPH

      const uxk = ux[k]!
      const uyk = uy[k]!
      const uzk = uz[k]!
      const vxk = vx[k]!
      const vyk = vy[k]!
      const vzk = vz[k]!
      let ox = cx[k]!
      let oy = cy[k]!
      let oz = cz[k]!
      if (w > 1e-7) {
        const psi = b * PULSATION_WRITHE + temps * 1.1
        const wu = w * Math.cos(psi)
        const wv = w * Math.sin(psi)
        ox += uxk * wu + vxk * wv
        oy += uyk * wu + vyk * wv
        oz += uzk * wu + vzk * wv
      }

      let pax = ox + RAYON_HELICE * (ca * uxk + sa * vxk)
      let pay = oy + RAYON_HELICE * (ca * uyk + sa * vyk)
      let paz = oz + RAYON_HELICE * (ca * uzk + sa * vzk)
      let pbx = ox + RAYON_HELICE * (cb * uxk + sb * vxk)
      let pby = oy + RAYON_HELICE * (cb * uyk + sb * vyk)
      let pbz = oz + RAYON_HELICE * (cb * uzk + sb * vzk)

      if (ouverture > 0) {
        // Les deux brins quittent l'hélice et s'écartent de part et d'autre de
        // +U — le même axe que les mâchoires de l'enzyme.
        const e = ouverture
        pax += (ox + OUVERTURE * uxk - pax) * e
        pay += (oy + OUVERTURE * uyk - pay) * e
        paz += (oz + OUVERTURE * uzk - paz) * e
        pbx += (ox - OUVERTURE * uxk - pbx) * e
        pby += (oy - OUVERTURE * uyk - pby) * e
        pbz += (oz - OUVERTURE * uzk - pbz) * e
      }

      ax[k] = pax
      ay[k] = pay
      az[k] = paz
      bx[k] = pbx
      by[k] = pby
      bz[k] = pbz

      posTemp.set(pax, pay, paz)
      matriceTemp.compose(posTemp, quaternionId, echelleTemp)
      brinA.setMatrixAt(k, matriceTemp)
      posTemp.set(pbx, pby, pbz)
      matriceTemp.compose(posTemp, quaternionId, echelleTemp)
      brinB.setMatrixAt(k, matriceTemp)
    }
    brinA.instanceMatrix.needsUpdate = true
    brinB.instanceMatrix.needsUpdate = true
  }

  const majBarreaux = (n0: number, n1: number): void => {
    for (let n = n0; n <= n1; n++) {
      const k = barreauxK[n]!
      const b = k * PAS_ECH
      let ouverture = 0
      for (let i = 0; i < NB_PGE; i++) {
        const pres = pgePresence[i]!
        if (pres <= 0) continue
        const x = b - pgePb[i]!
        const absX = x < 0 ? -x : x
        if (absX < DEMI_BULLE) {
          const e = pres * lissage(1 - absX / DEMI_BULLE)
          if (e > ouverture) ouverture = e
        }
      }
      const pax = ax[k]!
      const pay = ay[k]!
      const paz = az[k]!
      axeTemp.set(bx[k]! - pax, by[k]! - pay, bz[k]! - paz)
      const longueur = axeTemp.length()
      axeTemp.divideScalar(longueur || 1)
      posTemp.set(pax, pay, paz).addScaledVector(axeTemp, longueur * 0.5)
      quaternionTemp.setFromUnitVectors(AXE_Y, axeTemp)
      // Dans la bulle, la paire est rompue : le barreau n'existe plus.
      const visible = 1 - lissage(ouverture / 0.35)
      echelleTemp.set(visible, longueur * visible, visible)
      matriceTemp.compose(posTemp, quaternionTemp, echelleTemp)
      barreaux.setMatrixAt(n, matriceTemp)
    }
    barreaux.instanceMatrix.needsUpdate = true
  }

  const animer = (temps: number): void => {
    // ── Le surenroulement s'accumule, puis la topoisomérase le relâche ─────
    const tt = temps % PERIODE_TOPO
    amplitudeTorsion = tt < 21 ? tt / 21 : 1 - lissage((tt - 21) / 3)

    // ── Où en sont les trois polymérases ──────────────────────────────────
    for (let i = 0; i < NB_PGE; i++) {
      const tc = (temps + DEPARTS[i]! * DUREE_CYCLE) % DUREE_CYCLE
      // L'élongation n'est pas régulière : l'ARN pol II fait des pauses et
      // recule parfois de quelques paires de bases avant de repartir.
      const bruit = 5 * Math.sin(0.55 * tc + i * 1.7) + 3 * Math.sin(1.31 * tc + i * 2.9)
      const brut = VITESSE_NT * Math.min(tc, DUREE_ELONGATION) + bruit
      // Cliquet : un nucléotide à la fois, jamais entre deux.
      pgePb[i] = PB_DEBUT_GENE + Math.floor(Math.min(brut, PB_GENE))
      pgeNt[i] = Math.min(PB_GENE, VITESSE_NT * tc)
      pgePresence[i] = lissage(tc / 1.5) * (1 - lissage((tc - DUREE_ELONGATION - 4.5) / 2))
      pgeLibere[i] = lissage((tc - DUREE_ELONGATION) / 5)
    }

    majBrins(K_MIN, K_MAX, temps)
    if (ibMax >= ibMin) majBarreaux(ibMin, ibMax)

    // ── Chaque polymérase, son transcrit et ses nucléotides ───────────────
    for (let i = 0; i < NB_PGE; i++) {
      const pres = pgePresence[i]!
      const b = pgePb[i]!
      echantillonner(b)
      appliquerVrille(b, temps)

      const machine = polymerases[i]!
      machine.position.copy(centreTemp)
      // +X sur l'ouverture de la bulle, +Y le long de l'ADN, -Z sur la sortie.
      wTemp.crossVectors(uTemp, tanTemp)
      baseTemp.makeBasis(uTemp, tanTemp, wTemp)
      machine.quaternion.setFromRotationMatrix(baseTemp)
      machine.scale.setScalar(pres)

      // Le transcrit sort par le canal, puis dérive une fois libéré.
      const libere = pgeLibere[i]!
      sortieArn.copy(centreTemp).addScaledVector(vTemp, RAYON_SORTIE + libere * 0.05)
      const nbNt = pgeNt[i]!
      const nbGrains = Math.min(NB_GRAINS_ARN, Math.floor(nbNt / NT_PAR_GRAIN))
      const visArn = 1 - lissage((libere - 0.55) / 0.45)
      for (let j = 0; j < NB_GRAINS_ARN; j++) {
        const idx = i * NB_GRAINS_ARN + j
        if (j < nbGrains) {
          const base = idx * 3
          const ph = phasesArn[idx]!
          const fu = Math.sin(temps * 1.3 + ph) * 0.0007
          const ft = Math.cos(temps * 0.87 + ph * 1.7) * 0.0007
          posTemp
            .copy(sortieArn)
            .addScaledVector(uTemp, offsetsArn[base]! + fu)
            .addScaledVector(vTemp, offsetsArn[base + 1]!)
            .addScaledVector(tanTemp, offsetsArn[base + 2]! + ft)
          echelleTemp.setScalar(visArn)
        } else {
          echelleTemp.setScalar(0)
        }
        matriceTemp.compose(posTemp, quaternionId, echelleTemp)
        arn.setMatrixAt(idx, matriceTemp)
      }

      // La coiffe est posée dès le 25e nucléotide, sur l'extrémité 5' — celle
      // qui est déjà loin de l'enzyme quand le transcrit fait encore un dixième
      // de sa longueur finale.
      const coiffe = coiffes[i]!
      if (nbGrains > 0 && nbNt >= NT_COIFFE) {
        const base = (i * NB_GRAINS_ARN + nbGrains - 1) * 3
        coiffe.position
          .copy(sortieArn)
          .addScaledVector(uTemp, offsetsArn[base]!)
          .addScaledVector(vTemp, offsetsArn[base + 1]!)
          .addScaledVector(tanTemp, offsetsArn[base + 2]!)
        coiffe.scale.setScalar(visArn)
      } else {
        coiffe.scale.setScalar(0)
      }

      // Les nucléotides du voisinage : sept se cognent pour rien, un seul est
      // incorporé — trois fois par seconde, la cadence de l'enzyme.
      const creneau = temps * VITESSE_NT + i * 2.3
      const gagnant = Math.floor(creneau) % NTP_PAR_PGE
      const avancement = creneau - Math.floor(creneau)
      for (let m = 0; m < NTP_PAR_PGE; m++) {
        const n = i * NTP_PAR_PGE + m
        derive(n, temps, 0.007, frequences, phases, briTemp)
        posTemp
          .copy(centreTemp)
          .addScaledVector(uTemp, ancresNtp[n * 2]! + briTemp.x)
          .addScaledVector(vTemp, ancresNtp[n * 2 + 1]! + briTemp.y)
          .addScaledVector(tanTemp, briTemp.z)
        if (m === gagnant) {
          posTemp.lerp(centreTemp, lissage(avancement))
          echelleTemp.setScalar(pres * (1 - lissage((avancement - 0.72) / 0.28)))
        } else {
          echelleTemp.setScalar(pres)
        }
        matriceTemp.compose(posTemp, quaternionId, echelleTemp)
        ntp.setMatrixAt(n, matriceTemp)
      }
    }

    // Les nucléotides du nucléoplasme, qui ne rencontreront rien.
    echelleTemp.setScalar(1)
    for (let n = 0; n < NB_NTP_LIBRES; n++) {
      const indice = NB_PGE * NTP_PAR_PGE + n
      derive(indice, temps, 0.02, frequences, phases, briTemp)
      posTemp.copy(centresNtpLibres[n]!).add(briTemp)
      matriceTemp.compose(posTemp, quaternionId, echelleTemp)
      ntp.setMatrixAt(indice, matriceTemp)
    }
    arn.instanceMatrix.needsUpdate = true
    ntp.instanceMatrix.needsUpdate = true

    // ── La topoisomérase ──────────────────────────────────────────────────
    // Deux approches pour rien avant la bonne : elle ne sait pas plus que les
    // autres où est le nœud, elle finit par tomber dessus.
    let tete = PB_DEBUT_GENE
    for (let i = 0; i < NB_PGE; i++) {
      if (pgePresence[i]! > 0.3 && pgePb[i]! > tete) tete = pgePb[i]!
    }
    const cible = Math.min(PB_FIN_GENE + 120, tete + 45)
    echantillonner(cible)
    appliquerVrille(cible, temps)
    posTemp.copy(centreTemp)
    derive(NB_NTP, temps, 0.05, frequences, phases, briTemp)
    // Position d'errance : à l'écart de l'ADN, dans le nucléoplasme.
    centreTemp.addScaledVector(vTemp, 0.055).addScaledVector(uTemp, 0.02).add(briTemp)
    const approche = Math.max(bosse((tt - 6.5) / 2.2), bosse((tt - 13.5) / 2.2)) * 0.78
    const prise = lissage((tt - 20) / 1.2) * (1 - lissage((tt - 24) / 1.5))
    const accroche = Math.max(approche, prise)
    topoisomerase.position.copy(centreTemp).lerp(posTemp, accroche)
    // Elle se resserre sur l'ADN au moment où elle coupe et referme les brins.
    topoisomerase.scale.set(1 - prise * 0.2, 0.8, 1.1 + prise * 0.25)
  }

  // Une seule écriture pleine, à contrainte nulle : hors de la fenêtre mobile
  // le masque d'ancrage vaut exactement zéro et aucune bulle n'y parvient
  // jamais, si bien que ces grains-là ne seront plus jamais retouchés. C'est ce
  // qui ramène le coût par image de 4 500 instances à 750.
  majBrins(0, NB_ECH - 1, 0)
  majBarreaux(0, NB_BARREAUX - 1)
  animer(0)

  return [
    {
      cle: 'transcription',
      nom: "Transcription de l'ADN en ARN",
      siege: 'Noyau',
      facteur: 'ralenti ×20',
      justificationFacteur:
        "L'ARN polymérase II avance à 60 nucléotides par seconde en médiane chez l'humain, " +
        "soit 17 ms par nucléotide : à l'écran chaque nucléotide prend 0,33 s, et un tour " +
        "d'hélice de 10,5 paires de bases 3,5 s. Même facteur que la traduction, pour que " +
        'les deux vitesses se comparent directement.',
      ellision:
        "Le gène montré ne fait que 500 pb : un gène humain en fait dix à cent mille, et " +
        "la polymérase mettrait plus de vingt minutes d'écran à en parcourir quatre mille. " +
        'Chaque brin est échantillonné à un grain pour deux nucléotides (5 par tour au lieu ' +
        "de 10,5), et hors du gène il n'est tracé qu'un barreau toutes les 21 pb. L'ARN " +
        "naissant est dessiné replié, un grain pour 7 nucléotides. Le surenroulement est " +
        'amplifié — 1,8 tour de surplus, et une vrille de 5 nm — sans quoi il resterait ' +
        'invisible, et la topoisomérase est ramenée à une visite toutes les 26 s. ' +
        "L'enroulement nucléosomal est schématisé en spirale autour de l'axe de la fibre, " +
        'et le duplex est dessiné à 2,5 nm de large au lieu de 2. La polymérase, enfin, ' +
        'est translucide : à sa taille réelle elle cacherait entièrement la bulle.',
      description:
        "L'ARN polymérase II ouvre la double hélice sur douze à quatorze paires de bases, " +
        "copie le brin matrice et referme le duplex derrière elle : cette bulle de 4 nm qui " +
        "se déplace est toute la mécanique du procédé. Le transcrit sort par un canal " +
        "latéral et s'allonge, coiffé dès son vingt-cinquième nucléotide, bien avant que " +
        "la polymérase ait fini. Trois enzymes se suivent sur le même gène, et comme " +
        "aucune ne tourne autour de l'ADN, chacune entasse les tours devant elle et les " +
        "arrache derrière : la contrainte reste piégée entre les nucléosomes qui ancrent " +
        "le segment, le gène se vrille, et il faut qu'une topoisomérase passe le relâcher. " +
        'Les nucléotides libres, eux, ne savent pas où est le site actif : à chaque ' +
        "instant un seul des huit qui rôdent autour de l'enzyme est en train d'y être " +
        'incorporé, les sept autres se cognent pour rien.',
      objet: groupe,
      ancre: groupe.position.clone(),
      rayonCadrage: 0.12,
      couleur: TEINTES.chromatine,
      animer,
    },
  ]
}
