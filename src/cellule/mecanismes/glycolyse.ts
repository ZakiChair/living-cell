import * as THREE from 'three'
import type { Mecanisme } from './contrat.js'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'

/**
 * LA GLYCOLYSE — dix enzymes en chaîne, dans le cytosol.
 *
 * La voie la plus ancienne et la plus universelle : ni oxygène, ni membrane, ni
 * organite. Une hématie, qui n'a pas de mitochondrie, ne vit que de celle-là.
 *
 * Trois choses doivent se voir, et dans cet ordre :
 *   — L'INVESTISSEMENT. La cellule DÉPENSE deux ATP avant d'en gagner le moindre.
 *     C'est contre-intuitif, c'est vrai, et on le montre en faisant PARTIR deux
 *     jetons d'ATP avant que le premier ne rentre.
 *   — LE CLIVAGE. À l'aldolase, le cycle à six carbones s'ouvre et se coupe en
 *     deux trioses. À partir de là tout est en double : c'est la seule raison
 *     pour laquelle la phase de récupération rend quatre ATP et non deux.
 *   — LA PHOSPHORYLATION AU NIVEAU DU SUBSTRAT. Le phosphate SAUTE d'un
 *     intermédiaire très énergétique directement sur une ADP de passage. Aucun
 *     moteur rotatif, aucun gradient de protons, aucune membrane — l'exact
 *     contraire de l'ATP synthase, et la distinction n'est presque jamais faite.
 *
 * La réglette du coin supérieur gauche tient les comptes du tour en cours :
 * deux ATP dépensés (anneaux creux), quatre produits, deux NADH, deux pyruvates,
 * et en bas le solde net de deux ATP.
 */

// ── Emplacement, en micromètres (1 unité = 1 µm) ────────────────────────────

/** Cytosol libre, en bas à gauche de la cellule : aucun organite ici. */
const SIEGE = new THREE.Vector3(-6.5, -4.2, -1.5)

/** Mitochondrie de démonstration : c'est par là que sortent les pyruvates. */
const MITOCHONDRIE_DEMO = new THREE.Vector3(5.4, 2.6, -1.2)

/**
 * Direction de sortie, en coordonnées monde. Le groupe n'est jamais tourné :
 * une direction monde y reste valable comme direction locale.
 */
const VERS_MITOCHONDRIE = MITOCHONDRIE_DEMO.clone().sub(SIEGE).normalize()

// ── Les dix postes enzymatiques, rangés en arc ──────────────────────────────

const NB_POSTES = 10

/** Index d'étape. Nommer les dix enzymes est la moitié de l'explication. */
const HEXOKINASE = 0
const PHOSPHOGLUCOSE_ISOMERASE = 1
const PHOSPHOFRUCTOKINASE = 2
const ALDOLASE = 3
const TRIOSE_PHOSPHATE_ISOMERASE = 4
const GAPDH = 5
const PHOSPHOGLYCERATE_KINASE = 6
const PHOSPHOGLYCERATE_MUTASE = 7
const ENOLASE = 8
const PYRUVATE_KINASE = 9

/** Les quatre kinases : les seules étapes qui touchent à l'ATP. */
const EST_KINASE = new Uint8Array([1, 0, 1, 0, 0, 0, 1, 0, 0, 1])

const DEMI_LARGEUR_ARC = 0.93
const CREUX_ARC = 0.62
const CENTRE_ARC_Y = -0.1

/** Position des dix postes, xyz à la suite. */
const POSTES = new Float32Array(NB_POSTES * 3)
for (let i = 0; i < NB_POSTES; i++) {
  const u = i / (NB_POSTES - 1)
  // Arc en cuvette : le trajet se lit de gauche à droite, et le haut du cadre
  // reste libre pour la réglette du bilan.
  const angle = Math.PI * (1.12 + 0.76 * u)
  POSTES[i * 3] = Math.cos(angle) * DEMI_LARGEUR_ARC
  POSTES[i * 3 + 1] = CENTRE_ARC_Y + Math.sin(angle) * CREUX_ARC
  POSTES[i * 3 + 2] = Math.sin(u * Math.PI) * 0.14 - 0.05
}

/** Rayon d'encombrement de chaque enzyme, pour les rebonds du cytosol. */
const RAYONS_ENZYMES = new Float32Array([
  0.11, 0.095, 0.145, 0.125, 0.075, 0.115, 0.105, 0.075, 0.09, 0.14,
])

// ── Horloge d'un tour, en secondes d'écran ─────────────────────────────────

/** Temps passé dans le site actif, étape par étape. Les kinases durent plus
 *  longtemps : c'est là que le phosphate saute, et ça doit se voir. */
const RESIDENCES = new Float32Array([
  0.52, 0.28, 0.54, 0.58, 0.28, 0.52, 0.62, 0.3, 0.3, 0.66,
])
/** Temps de diffusion jusqu'à l'enzyme suivante. Les deux valeurs longues sont
 *  les étapes où l'on montre un trajet raté. */
const TRAJETS = new Float32Array([0.28, 0.6, 0.28, 0.24, 0.24, 0.28, 0.54, 0.24, 0.26, 0])
/** Étapes où le substrat se trompe d'enzyme avant de trouver la bonne. */
const DETOURS = new Uint8Array([0, 1, 0, 0, 0, 0, 1, 0, 0, 0])

const T_ENTREE = 0.45
const DEBUTS = new Float32Array(NB_POSTES)
const FINS = new Float32Array(NB_POSTES)
let horlogeConstruction = T_ENTREE
for (let i = 0; i < NB_POSTES; i++) {
  DEBUTS[i] = horlogeConstruction
  horlogeConstruction += RESIDENCES[i]!
  FINS[i] = horlogeConstruction
  horlogeConstruction += TRAJETS[i]!
}

/** Départ des deux pyruvates vers la mitochondrie. */
const T_SORTIE = FINS[NB_POSTES - 1]!
const DUREE_SORTIE = 1
/** Temps de lecture du bilan avant que le tour suivant ne reparte. */
const DUREE_BILAN = 1.45
const DUREE_CYCLE = T_SORTIE + DUREE_SORTIE + DUREE_BILAN

/** Point d'arrivée du glucose, hors cadre à gauche. */
const POINT_ENTREE = new THREE.Vector3(-1.45, 0.15, 0.12)

/** Détour : le substrat va tâter l'enzyme k+2, qui ne réagit pas, puis revient. */
const LEURRES = new Float32Array(NB_POSTES * 3)
for (let k = 0; k < NB_POSTES; k++) {
  const cible = Math.min(NB_POSTES - 1, k + 2)
  LEURRES[k * 3] = POSTES[cible * 3]!
  LEURRES[k * 3 + 1] = POSTES[cible * 3 + 1]! + 0.13
  LEURRES[k * 3 + 2] = POSTES[cible * 3 + 2]! + 0.06
}

// ── Le substrat : six carbones qui deviennent deux trioses ─────────────────

const NB_CARBONES = 6
/** Un carbone fait 0,15 nm et un glucose 1 nm : ces billes sont très grossies,
 *  faute de quoi la molécule serait un point invisible sur un arc de 2 µm. */
const RAYON_CARBONE = 0.019
const RAYON_HEXOSE = 0.038
const PAS_TRIOSE = 0.036
/** Écart entre les deux trioses après le clivage, pour qu'on les compte. */
const ECART_BRANCHES = 0.085

/** Position courante des six carbones, relue par les phosphates. */
const POSITIONS_CARBONES = new Float32Array(NB_CARBONES * 3)

/**
 * Couleur du substrat après k étapes.
 *
 * Deux états sont chauds, et ce n'est pas un hasard : le 1,3-bisphosphoglycérate
 * et le phosphoénolpyruvate portent chacun un phosphate à très haut potentiel de
 * transfert. Chaque fois, l'étape suivante le cède à une ADP et la molécule
 * redevient froide. C'est la charge et la décharge, rendues à l'œil.
 */
const COULEURS_SUBSTRAT = [
  new THREE.Color(0xdcc79a), // glucose
  new THREE.Color(0xd9cb9c), // glucose-6-phosphate
  new THREE.Color(0xd2d29e), // fructose-6-phosphate
  new THREE.Color(0xc9d69f), // fructose-1,6-bisphosphate
  new THREE.Color(0xb8d69c), // dihydroxyacétone-P + glycéraldéhyde-3-P
  new THREE.Color(0xaad59c), // deux glycéraldéhyde-3-phosphate
  new THREE.Color(0xe8b23c), // 1,3-bisphosphoglycérate — chargé
  new THREE.Color(0x93cd94), // 3-phosphoglycérate — déchargé
  new THREE.Color(0x8ac997), // 2-phosphoglycérate
  new THREE.Color(0xe8b23c), // phosphoénolpyruvate — rechargé
  new THREE.Color(0x009e73), // pyruvate
]

// ── Phosphates portés par le substrat ──────────────────────────────────────

/** Deux par triose au maximum : celui qui reste, et celui que GAPDH ajoute. */
const NB_PHOSPHATES = 4
const RAYON_PHOSPHATE = 0.013
const TEINTE_PHOSPHATE = 0xb3aca0

// ── Jetons adényliques : deux dépensés, quatre produits ────────────────────

const NB_JETONS = 6
/** Étape où chaque jeton opère. */
const JETONS_ETAPE = new Uint8Array([
  HEXOKINASE,
  PHOSPHOFRUCTOKINASE,
  PHOSPHOGLYCERATE_KINASE,
  PHOSPHOGLYCERATE_KINASE,
  PYRUVATE_KINASE,
  PYRUVATE_KINASE,
])
/** 1 = un ATP arrive et repart en ADP (dépense) ; 0 = une ADP arrive et repart
 *  en ATP (récupération). */
const JETONS_DEPENSE = new Uint8Array([1, 1, 0, 0, 0, 0])
/** Triose concerné — et, pour les deux dépenses, le phosphate déposé. */
const JETONS_BRANCHE = new Uint8Array([0, 1, 0, 1, 0, 1])

const RAYON_ATP = 0.026
const RAYON_ADP = 0.021
const RAYON_NAD = 0.03

/** Fractions de la résidence : arrivée en place, puis fin du transfert. */
const FRACTION_CONTACT = 0.22
const FRACTION_TRANSFERT = 0.78
const DUREE_APPROCHE = 0.5
const DUREE_DEPART = 0.9

/** Les deux trioses ne sont pas synchrones : on décale la seconde branche. */
const DECALAGE_BRANCHE = 0.08

const JETON_T0 = new Float32Array(NB_JETONS)
const JETON_T1 = new Float32Array(NB_JETONS)
const JETON_T2 = new Float32Array(NB_JETONS)
const JETON_T3 = new Float32Array(NB_JETONS)
const JETON_DOCKS = new Float32Array(NB_JETONS * 3)
const JETON_ARRIVEES = new Float32Array(NB_JETONS * 3)

// ── Navettes à électrons : NAD⁺ entre vide, NADH repart chargé ─────────────

const NB_NAD = 2
const NAD_T0 = new Float32Array(NB_NAD)
const NAD_T1 = new Float32Array(NB_NAD)
const NAD_T2 = new Float32Array(NB_NAD)
const NAD_T3 = new Float32Array(NB_NAD)
const NAD_DOCKS = new Float32Array(NB_NAD * 3)
const NAD_ARRIVEES = new Float32Array(NB_NAD * 3)
/** Point d'où arrive le phosphate inorganique capté par GAPDH. */
const ORIGINES_PI = new Float32Array(NB_NAD * 3)

// ── La réglette du bilan : cinq rangées de jetons témoins ──────────────────

const NB_TEMOINS = 12
/** dépense (2), gain (4), NADH (2), pyruvates (2), solde net (2). */
const RANGEES_TEMOINS = new Uint8Array([2, 4, 2, 2, 2])
const RACK_X = -1.16
const RACK_Y = 1.02
const PAS_RACK_X = 0.145
const PAS_RACK_Y = 0.175
const RAYON_TEMOIN = 0.032
const RAYON_TEMOIN_NET = 0.046
/** Les jetons acquis sont des BILLES posées dans leur anneau : boule pleine
 *  contre anneau creux, le contraste tient sous n'importe quel angle, ce qu'un
 *  disque plat ne fait pas dès que la caméra tourne. */
const RAYON_TEMOIN_PLEIN = 0.026
const RAYON_TEMOIN_NET_PLEIN = 0.038

const TEMOINS_POS = new Float32Array(NB_TEMOINS * 3)
let curseurTemoin = 0
for (let r = 0; r < RANGEES_TEMOINS.length; r++) {
  for (let c = 0; c < RANGEES_TEMOINS[r]!; c++) {
    TEMOINS_POS[curseurTemoin * 3] = RACK_X + c * PAS_RACK_X
    TEMOINS_POS[curseurTemoin * 3 + 1] = RACK_Y - r * PAS_RACK_Y
    TEMOINS_POS[curseurTemoin * 3 + 2] = 0.07
    curseurTemoin++
  }
}

/** Instant où chaque témoin s'allume : celui où le jeton correspondant se pose. */
const TEMPS_TEMOINS = new Float32Array(NB_TEMOINS)

// ── Peuplement du cytosol ──────────────────────────────────────────────────

/** Molécules qui dérivent et heurtent les enzymes sans jamais réagir. */
const NB_ERRANTS = 14
const NB_ERRANTS_ADP = 6
const NB_POUSSIERE = 260
const RAYON_ERRANT = 0.016
const RAYON_POUSSIERE = 0.006
const DEMI_CHAMP = new THREE.Vector3(1.25, 1.1, 0.55)

// ── Teintes ────────────────────────────────────────────────────────────────

/** Tenues d'une voie à l'autre : ATP orange vif, NAD bleu ciel, FAD jaune. */
const TEINTE_ATP = TEINTES.ribosome
const TEINTE_ADP = 0x7a3a00
const TEINTE_NADH = TEINTES.reticulumLisse
const TEINTE_NAD = 0x7fd9c0
const TEINTE_ENZYME = 0xa88ac6
const TEINTE_KINASE = 0x7a4fa0
const TEINTE_CONTROLE = TEINTES.golgi
const TEINTE_PYRUVATE = 0x009e73

// ── Temporaires hissés : animer() ne doit rien allouer ─────────────────────

const matriceTemp = new THREE.Matrix4()
const echelleTemp = new THREE.Vector3(1, 1, 1)
const quaternionNeutre = new THREE.Quaternion()
const positionTemp = new THREE.Vector3()
const travailA = new THREE.Vector3()
const travailB = new THREE.Vector3()
const travailC = new THREE.Vector3()
const travailD = new THREE.Vector3()
const centreSubstrat = new THREE.Vector3()
const couleurTemp = new THREE.Color()

// ── Petites fonctions pures ────────────────────────────────────────────────

/** Rampe adoucie, bornée à [0, 1]. */
function adoucir(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

function lireVecteur(source: Float32Array, i: number, cible: THREE.Vector3): THREE.Vector3 {
  return cible.set(source[i * 3]!, source[i * 3 + 1]!, source[i * 3 + 2]!)
}

function ecrireVecteur(cible: Float32Array, i: number, v: THREE.Vector3): void {
  cible[i * 3] = v.x
  cible[i * 3 + 1] = v.y
  cible[i * 3 + 2] = v.z
}

/**
 * Point d'accroche d'un phosphate sur son triose.
 *
 * `migration` fait glisser le phosphate d'un carbone à l'autre : c'est tout le
 * travail de la phosphoglycérate mutase, qui ne fait que le déplacer.
 */
function pointAttache(b: number, s: number, migration: number, cible: THREE.Vector3): void {
  if (s === 1) {
    lireVecteur(POSITIONS_CARBONES, b * 3, cible)
    cible.x += 0.008
    cible.y += 0.034
  } else {
    lireVecteur(POSITIONS_CARBONES, b * 3 + 2, cible)
    lireVecteur(POSITIONS_CARBONES, b * 3 + 1, travailD)
    cible.lerp(travailD, migration)
    cible.x += 0.01
    cible.y -= 0.032
  }
}

// ── Calendrier des jetons, une fois les postes connus ──────────────────────

for (let j = 0; j < NB_JETONS; j++) {
  const k = JETONS_ETAPE[j]!
  const residence = RESIDENCES[k]!
  const b = JETONS_BRANCHE[j]!
  const decalage = b === 1 ? DECALAGE_BRANCHE : 0
  JETON_T1[j] = DEBUTS[k]! + residence * FRACTION_CONTACT + decalage
  JETON_T2[j] = DEBUTS[k]! + residence * FRACTION_TRANSFERT + decalage
  JETON_T0[j] = JETON_T1[j]! - DUREE_APPROCHE
  JETON_T3[j] = JETON_T2[j]! + DUREE_DEPART

  // Le poste d'accostage est toujours à l'extérieur de l'arc : la chaîne reste
  // dégagée, et le jeton ne traverse jamais le substrat pour arriver.
  lireVecteur(POSTES, k, travailA)
  travailB.set(travailA.x, travailA.y - CENTRE_ARC_Y, 0).normalize()
  travailC.copy(travailA).addScaledVector(travailB, 0.19)
  travailC.z += b === 0 ? 0.07 : -0.07
  travailC.x += b === 0 ? 0.05 : -0.05
  // Le jeton accoste du côté de SON triose : le phosphate qui saute relie deux
  // objets que l'œil avait déjà appariés.
  travailC.y += b === 0 ? 0.055 : -0.055
  ecrireVecteur(JETON_DOCKS, j, travailC)
  // Il vient du cytosol, par le bas et de côté : hors de la trajectoire du substrat.
  travailC.addScaledVector(travailB, 0.45)
  travailC.x += b === 0 ? 0.22 : -0.22
  ecrireVecteur(JETON_ARRIVEES, j, travailC)
}

for (let n = 0; n < NB_NAD; n++) {
  const residence = RESIDENCES[GAPDH]!
  const decalage = n === 1 ? DECALAGE_BRANCHE : 0
  NAD_T1[n] = DEBUTS[GAPDH]! + residence * FRACTION_CONTACT + decalage
  NAD_T2[n] = DEBUTS[GAPDH]! + residence * FRACTION_TRANSFERT + decalage
  NAD_T0[n] = NAD_T1[n]! - DUREE_APPROCHE
  NAD_T3[n] = NAD_T2[n]! + DUREE_DEPART

  lireVecteur(POSTES, GAPDH, travailA)
  travailB.set(travailA.x, travailA.y - CENTRE_ARC_Y, 0).normalize()
  travailC.copy(travailA).addScaledVector(travailB, 0.19)
  travailC.x += n === 0 ? -0.16 : 0.16
  travailC.z += n === 0 ? 0.08 : -0.08
  travailC.y += n === 0 ? 0.055 : -0.055
  ecrireVecteur(NAD_DOCKS, n, travailC)
  travailC.addScaledVector(travailB, 0.5)
  travailC.x += n === 0 ? -0.3 : 0.3
  ecrireVecteur(NAD_ARRIVEES, n, travailC)

  // Le phosphate inorganique que GAPDH accroche vient du cytosol libre, pas d'un ATP.
  lireVecteur(POSTES, GAPDH, travailC)
  travailC.addScaledVector(travailB, 0.34)
  travailC.x += n === 0 ? 0.3 : -0.3
  ecrireVecteur(ORIGINES_PI, n, travailC)
}

// Les six premiers témoins s'allument quand leur jeton se pose sur la réglette,
// les deux suivants quand les NADH arrivent, puis les pyruvates, puis le solde.
for (let j = 0; j < NB_JETONS; j++) TEMPS_TEMOINS[j] = JETON_T3[j]!
TEMPS_TEMOINS[6] = NAD_T3[0]!
TEMPS_TEMOINS[7] = NAD_T3[1]!
TEMPS_TEMOINS[8] = T_SORTIE + 0.85
TEMPS_TEMOINS[9] = T_SORTIE + 0.97
TEMPS_TEMOINS[10] = T_SORTIE + DUREE_SORTIE + 0.3
TEMPS_TEMOINS[11] = T_SORTIE + DUREE_SORTIE + 0.45

/** Durée de l'extinction de la réglette, juste avant le glucose suivant. */
const DUREE_EXTINCTION = 0.3

export function creerGlycolyse(): Mecanisme[] {
  const alea = creerAlea(70_114)
  const groupe = new THREE.Group()
  groupe.position.copy(SIEGE)

  // Géométries unitaires : l'échelle passe par la matrice d'instance.
  const geometrieBille = new THREE.IcosahedronGeometry(1, 1)
  const geometrieGrain = new THREE.IcosahedronGeometry(1, 0)
  const geometrieJeton = new THREE.OctahedronGeometry(1, 0)
  const geometrieAnneau = new THREE.TorusGeometry(1, 0.22, 6, 14)

  // ── Les dix enzymes, chacune avec sa forme ───────────────────────────────
  const materiauxEnzymes: THREE.MeshLambertMaterial[] = []
  const groupesEnzymes: THREE.Group[] = []
  const lobesA: Array<THREE.Object3D | null> = []
  const lobesB: Array<THREE.Object3D | null> = []

  for (let k = 0; k < NB_POSTES; k++) {
    const groupeEnzyme = new THREE.Group()
    lireVecteur(POSTES, k, travailA)
    groupeEnzyme.position.copy(travailA)
    const teinte =
      k === PHOSPHOFRUCTOKINASE ? TEINTE_CONTROLE : EST_KINASE[k] === 1 ? TEINTE_KINASE : TEINTE_ENZYME
    const materiau = materiauOrganite(teinte, { doubleFace: false })
    let lobeA: THREE.Object3D | null = null
    let lobeB: THREE.Object3D | null = null

    if (k === HEXOKINASE) {
      // Hexokinase : deux lobes qui se REFERMENT sur le glucose. L'ajustement
      // induit a été décrit sur elle avant toute autre enzyme.
      lobeA = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 8), materiau)
      lobeB = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 8), materiau)
      lobeA.scale.set(1.1, 0.78, 1)
      lobeB.scale.set(1.1, 0.78, 1)
      groupeEnzyme.add(lobeA, lobeB)
    } else if (k === PHOSPHOGLUCOSE_ISOMERASE) {
      // Isomérase : un anneau, elle ne fait que retourner le sucre.
      const corps = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.026, 8, 16), materiau)
      corps.rotation.x = 0.6
      groupeEnzyme.add(corps)
    } else if (k === PHOSPHOFRUCTOKINASE) {
      // Phosphofructokinase : tétramère, la plus grosse de la chaîne. C'est
      // l'étape limitante et le point de contrôle de toute la voie — d'où la
      // teinte à part et le site allostérique qui bat en permanence.
      for (let s = 0; s < 4; s++) {
        const sousUnite = new THREE.Mesh(new THREE.IcosahedronGeometry(0.058, 1), materiau)
        sousUnite.position.set(s < 2 ? -0.045 : 0.045, s % 2 === 0 ? 0.045 : -0.045, 0)
        groupeEnzyme.add(sousUnite)
      }
      lobeA = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.026, 1),
        materiauOrganite(0xd94a2a, { doubleFace: false, emissif: 0x3a0f06 }),
      )
      lobeA.position.set(0, 0.1, 0.06)
      groupeEnzyme.add(lobeA)
    } else if (k === ALDOLASE) {
      // Aldolase : deux blocs qui S'ÉCARTENT au moment du clivage.
      lobeA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.08), materiau)
      lobeB = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.08), materiau)
      groupeEnzyme.add(lobeA, lobeB)
    } else if (k === TRIOSE_PHOSPHATE_ISOMERASE) {
      // La plus petite et la plus rapide : elle travaille à la vitesse de la
      // diffusion, on ne peut pas faire mieux.
      for (let s = 0; s < 2; s++) {
        const sousUnite = new THREE.Mesh(new THREE.IcosahedronGeometry(0.042, 1), materiau)
        sousUnite.position.x = s === 0 ? -0.032 : 0.032
        groupeEnzyme.add(sousUnite)
      }
    } else if (k === GAPDH) {
      // GAPDH : tétramère en carré, c'est elle qui charge le NAD⁺.
      for (let s = 0; s < 4; s++) {
        const sousUnite = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), materiau)
        sousUnite.position.set(s < 2 ? -0.04 : 0.04, 0, s % 2 === 0 ? -0.04 : 0.04)
        groupeEnzyme.add(sousUnite)
      }
    } else if (k === PHOSPHOGLYCERATE_KINASE) {
      // Kinase à charnière : deux lobes qui se rapprochent pour le transfert.
      lobeA = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.05, 4, 10), materiau)
      lobeB = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.045, 4, 10), materiau)
      lobeA.rotation.z = 0.5
      lobeB.rotation.z = -0.5
      groupeEnzyme.add(lobeA, lobeB)
    } else if (k === PHOSPHOGLYCERATE_MUTASE) {
      const corps = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 12), materiau)
      corps.rotation.x = Math.PI / 2
      groupeEnzyme.add(corps)
    } else if (k === ENOLASE) {
      for (let s = 0; s < 2; s++) {
        const sousUnite = new THREE.Mesh(new THREE.DodecahedronGeometry(0.05, 0), materiau)
        sousUnite.position.y = s === 0 ? 0.036 : -0.036
        groupeEnzyme.add(sousUnite)
      }
      // Le magnésium de l'énolase : sans lui, rien ne se passe.
      const magnesium = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.016, 0),
        materiauOrganite(0x7fc4a8, { doubleFace: false }),
      )
      magnesium.position.set(0.05, 0, 0.04)
      groupeEnzyme.add(magnesium)
    } else {
      // Pyruvate kinase : gros tétramère, dernier poste de la chaîne.
      const corps = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), materiau)
      groupeEnzyme.add(corps)
      for (let s = 0; s < 2; s++) {
        const sousUnite = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), materiau)
        sousUnite.position.set(s === 0 ? -0.085 : 0.085, 0.04, 0)
        groupeEnzyme.add(sousUnite)
      }
    }

    groupe.add(groupeEnzyme)
    groupesEnzymes.push(groupeEnzyme)
    materiauxEnzymes.push(materiau)
    lobesA.push(lobeA)
    lobesB.push(lobeB)
  }

  // ── Le substrat, ses phosphates, ses partenaires ─────────────────────────
  const materiauSubstrat = materiauOrganite(0xffffff, { doubleFace: false })
  const carbones = new THREE.InstancedMesh(geometrieBille, materiauSubstrat, NB_CARBONES)

  const phosphates = new THREE.InstancedMesh(
    geometrieGrain,
    materiauOrganite(TEINTE_PHOSPHATE, { doubleFace: false }),
    NB_PHOSPHATES,
  )

  const jetonsAtp = new THREE.InstancedMesh(
    geometrieJeton,
    materiauOrganite(TEINTE_ATP, { doubleFace: false, emissif: 0x4a1a00 }),
    NB_JETONS,
  )
  const jetonsAdp = new THREE.InstancedMesh(
    geometrieJeton,
    materiauOrganite(TEINTE_ADP, { doubleFace: false }),
    NB_JETONS,
  )
  const navettesNad = new THREE.InstancedMesh(
    geometrieBille,
    materiauOrganite(TEINTE_NAD, { doubleFace: false }),
    NB_NAD,
  )
  const navettesNadh = new THREE.InstancedMesh(
    geometrieBille,
    materiauOrganite(TEINTE_NADH, { doubleFace: false, emissif: 0x00402e }),
    NB_NAD,
  )

  // ── La réglette du bilan ─────────────────────────────────────────────────
  const socles = new THREE.InstancedMesh(
    geometrieAnneau,
    materiauOrganite(TEINTES.cytosquelette, { doubleFace: false }),
    NB_TEMOINS,
  )
  // Les deux ATP dépensés restent des anneaux CREUX, tout ce qui est acquis est
  // une bille pleine : à cette taille la forme se lit, la nuance de teinte non.
  const temoinsDepense = new THREE.InstancedMesh(
    geometrieAnneau,
    materiauOrganite(TEINTE_ADP, { doubleFace: false }),
    2,
  )
  const temoinsGain = new THREE.InstancedMesh(
    geometrieBille,
    materiauOrganite(TEINTE_ATP, { doubleFace: false, emissif: 0x3a1400 }),
    4,
  )
  const temoinsNadh = new THREE.InstancedMesh(
    geometrieBille,
    materiauOrganite(TEINTE_NADH, { doubleFace: false, emissif: 0x00402e }),
    2,
  )
  const temoinsPyruvate = new THREE.InstancedMesh(
    geometrieBille,
    materiauOrganite(TEINTE_PYRUVATE, { doubleFace: false }),
    2,
  )
  const temoinsNet = new THREE.InstancedMesh(
    geometrieBille,
    materiauOrganite(TEINTE_ATP, { doubleFace: false, emissif: 0x6a2600 }),
    2,
  )

  // ── Le cytosol : encombré, et personne n'y sait où il va ─────────────────
  const errants = new THREE.InstancedMesh(
    geometrieGrain,
    materiauOrganite(0xc9c0ac, { doubleFace: false }),
    NB_ERRANTS,
  )
  const errantsAdp = new THREE.InstancedMesh(
    geometrieJeton,
    materiauOrganite(TEINTE_ADP, { doubleFace: false }),
    NB_ERRANTS_ADP,
  )
  const poussiere = new THREE.InstancedMesh(
    geometrieGrain,
    materiauOrganite(TEINTES.cytosol, { doubleFace: false }),
    NB_POUSSIERE,
  )

  const tousLesNuages = [
    carbones,
    phosphates,
    jetonsAtp,
    jetonsAdp,
    navettesNad,
    navettesNadh,
    socles,
    temoinsDepense,
    temoinsGain,
    temoinsNadh,
    temoinsPyruvate,
    temoinsNet,
    errants,
    errantsAdp,
    poussiere,
  ]
  for (const nuage of tousLesNuages) {
    // Les instances sortent largement de la boîte initiale : sans cela elles
    // disparaissent dès que la caméra s'approche.
    nuage.frustumCulled = false
    groupe.add(nuage)
  }

  // Les socles ne bougent jamais : posés une fois pour toutes.
  for (let t = 0; t < NB_TEMOINS; t++) {
    lireVecteur(TEMOINS_POS, t, positionTemp)
    echelleTemp.setScalar(t >= 10 ? RAYON_TEMOIN_NET : RAYON_TEMOIN)
    matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
    socles.setMatrixAt(t, matriceTemp)
  }
  socles.instanceMatrix.needsUpdate = true

  // Errants et poussière : bases et pulsations tirées une fois, jamais après.
  const basesErrants = new Float32Array((NB_ERRANTS + NB_ERRANTS_ADP) * 3)
  const phasesErrants = new Float32Array((NB_ERRANTS + NB_ERRANTS_ADP) * 6)
  for (let e = 0; e < NB_ERRANTS + NB_ERRANTS_ADP; e++) {
    basesErrants[e * 3] = (alea() * 2 - 1) * DEMI_CHAMP.x * 0.85
    basesErrants[e * 3 + 1] = (alea() * 2 - 1) * DEMI_CHAMP.y * 0.6 - 0.1
    basesErrants[e * 3 + 2] = (alea() * 2 - 1) * DEMI_CHAMP.z
    for (let c = 0; c < 3; c++) {
      phasesErrants[e * 6 + c] = 0.25 + alea() * 0.45
      phasesErrants[e * 6 + 3 + c] = alea() * Math.PI * 2
    }
  }

  const basesPoussiere = new Float32Array(NB_POUSSIERE * 3)
  const phasesPoussiere = new Float32Array(NB_POUSSIERE * 3)
  for (let p = 0; p < NB_POUSSIERE; p++) {
    basesPoussiere[p * 3] = (alea() * 2 - 1) * DEMI_CHAMP.x
    basesPoussiere[p * 3 + 1] = (alea() * 2 - 1) * DEMI_CHAMP.y
    basesPoussiere[p * 3 + 2] = (alea() * 2 - 1) * DEMI_CHAMP.z
    phasesPoussiere[p * 3] = alea() * Math.PI * 2
    phasesPoussiere[p * 3 + 1] = alea() * Math.PI * 2
    phasesPoussiere[p * 3 + 2] = alea() * Math.PI * 2
  }

  const animer = (temps: number): void => {
    const cycle = temps % DUREE_CYCLE

    // ── 1. Où en est la molécule ? ────────────────────────────────────────
    let etapeActive = -1
    let etapeFaites = 0
    let progression = 0
    if (cycle >= T_SORTIE) {
      etapeFaites = NB_POSTES
    } else {
      for (let k = 0; k < NB_POSTES; k++) {
        if (cycle >= FINS[k]!) {
          etapeFaites = k + 1
          continue
        }
        if (cycle >= DEBUTS[k]!) {
          etapeActive = k
          etapeFaites = k
          progression = (cycle - DEBUTS[k]!) / RESIDENCES[k]!
        }
        break
      }
    }

    // Ouverture du cycle hexose puis séparation des deux trioses : le clivage.
    let ouverture = etapeFaites > ALDOLASE ? 1 : 0
    if (etapeActive === ALDOLASE) ouverture = adoucir((progression - 0.25) / 0.5)
    // L'aldolase ne reste pas béante : elle se referme dès le triose parti.
    let ecartementAldolase = 0
    if (etapeActive === ALDOLASE) ecartementAldolase = ouverture
    else if (etapeActive < 0 && etapeFaites === ALDOLASE + 1) {
      ecartementAldolase = 1 - adoucir((cycle - FINS[ALDOLASE]!) / TRAJETS[ALDOLASE]!)
    }
    // Glissement du phosphate d'un carbone à l'autre : le travail de la mutase.
    let migration = etapeFaites > PHOSPHOGLYCERATE_MUTASE ? 1 : 0
    if (etapeActive === PHOSPHOGLYCERATE_MUTASE) migration = adoucir((progression - 0.25) / 0.5)

    // ── 2. Centre du substrat ─────────────────────────────────────────────
    let tailleSubstrat = 1
    if (cycle < T_ENTREE) {
      lireVecteur(POSTES, 0, travailA)
      centreSubstrat.copy(POINT_ENTREE).lerp(travailA, adoucir(cycle / T_ENTREE))
    } else if (cycle >= T_SORTIE) {
      // Les deux pyruvates quittent le cadre en direction de la mitochondrie.
      const e = (cycle - T_SORTIE) / DUREE_SORTIE
      lireVecteur(POSTES, NB_POSTES - 1, centreSubstrat)
      centreSubstrat.addScaledVector(VERS_MITOCHONDRIE, adoucir(e) * 1.9)
      tailleSubstrat = 1 - adoucir((e - 0.6) / 0.4)
    } else if (etapeActive >= 0) {
      lireVecteur(POSTES, etapeActive, centreSubstrat)
      centreSubstrat.x += Math.sin(temps * 21) * 0.004
      centreSubstrat.y += Math.cos(temps * 17) * 0.004
    } else {
      const k = etapeFaites - 1
      const e = (cycle - FINS[k]!) / TRAJETS[k]!
      lireVecteur(POSTES, k, travailA)
      lireVecteur(POSTES, k + 1, travailB)
      if (DETOURS[k] === 1) {
        // Trajet raté : la molécule tâte l'enzyme suivante, qui ne fait rien
        // d'elle, puis repart. Aucune molécule ne sait où elle va.
        lireVecteur(LEURRES, k, travailC)
        if (e < 0.55) centreSubstrat.copy(travailA).lerp(travailC, adoucir(e / 0.55))
        else centreSubstrat.copy(travailC).lerp(travailB, adoucir((e - 0.55) / 0.45))
      } else {
        centreSubstrat.copy(travailA).lerp(travailB, adoucir(e))
        centreSubstrat.y += Math.sin(Math.PI * e) * 0.1
        centreSubstrat.z += Math.sin(Math.PI * e * 2) * 0.05
      }
      // Dérive thermique : le trajet n'est jamais une ligne droite.
      centreSubstrat.x += Math.sin(temps * 9.1 + 1.3) * 0.018
      centreSubstrat.y += Math.sin(temps * 7.7 + 0.4) * 0.018
    }

    // ── 3. Couleur : la molécule se transforme à chaque poste ─────────────
    let melange = 0
    if (etapeActive >= 0) melange = adoucir((progression - 0.28) / 0.5)
    const teinteAvant = COULEURS_SUBSTRAT[etapeFaites]!
    const teinteApres = COULEURS_SUBSTRAT[Math.min(NB_POSTES, etapeFaites + 1)]!
    couleurTemp.lerpColors(teinteAvant, teinteApres, melange)
    materiauSubstrat.color.copy(couleurTemp)

    // ── 4. Les six carbones ───────────────────────────────────────────────
    for (let b = 0; b < 2; b++) {
      travailA.copy(centreSubstrat)
      travailA.x += (b === 0 ? 0.018 : -0.018) * ouverture
      travailA.y += (b === 0 ? ECART_BRANCHES : -ECART_BRANCHES) * ouverture
      travailA.z += (b === 0 ? 0.05 : -0.05) * ouverture
      for (let j = 0; j < 3; j++) {
        const i = b * 3 + j
        // Le cycle à six carbones s'ouvre en deux chaînes de trois.
        const angle = i * (Math.PI / 3)
        const hx = Math.cos(angle) * RAYON_HEXOSE
        const hy = Math.sin(angle) * RAYON_HEXOSE * 0.75
        const cx = (j - 1) * PAS_TRIOSE
        const cy = j === 1 ? 0.016 : 0
        positionTemp.set(
          travailA.x + hx + (cx - hx) * ouverture,
          travailA.y + hy + (cy - hy) * ouverture,
          travailA.z + Math.sin(temps * 6 + i) * 0.004,
        )
        ecrireVecteur(POSITIONS_CARBONES, i, positionTemp)
        echelleTemp.setScalar(RAYON_CARBONE * tailleSubstrat)
        matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
        carbones.setMatrixAt(i, matriceTemp)
      }
    }
    carbones.instanceMatrix.needsUpdate = true

    // ── 5. Les jetons adényliques ─────────────────────────────────────────
    for (let j = 0; j < NB_JETONS; j++) {
      const t0 = JETON_T0[j]!
      const t1 = JETON_T1[j]!
      const t2 = JETON_T2[j]!
      const t3 = JETON_T3[j]!
      let taille = 0
      let estAtp = JETONS_DEPENSE[j] === 1
      if (cycle >= t0 && cycle <= t3) {
        if (cycle < t1) {
          lireVecteur(JETON_ARRIVEES, j, travailA)
          lireVecteur(JETON_DOCKS, j, travailB)
          positionTemp.copy(travailA).lerp(travailB, adoucir((cycle - t0) / (t1 - t0)))
          taille = adoucir((cycle - t0) / 0.22)
        } else if (cycle < t2) {
          lireVecteur(JETON_DOCKS, j, positionTemp)
          positionTemp.y += Math.sin(temps * 24 + j) * 0.004
          taille = 1
        } else {
          // Le jeton monte se poser sur la réglette : c'est là que le compte
          // s'incrémente, et le trajet fait le lien entre les deux.
          const e = adoucir((cycle - t2) / (t3 - t2))
          lireVecteur(JETON_DOCKS, j, travailA)
          lireVecteur(TEMOINS_POS, j, travailB)
          positionTemp.copy(travailA).lerp(travailB, e)
          positionTemp.y += Math.sin(Math.PI * e) * 0.18
          taille = 1 - adoucir((e - 0.6) / 0.4)
          estAtp = !estAtp
        }
      }
      const rayon = estAtp ? RAYON_ATP : RAYON_ADP
      echelleTemp.setScalar(taille * rayon)
      matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
      if (estAtp) {
        jetonsAtp.setMatrixAt(j, matriceTemp)
        echelleTemp.setScalar(0)
        matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
        jetonsAdp.setMatrixAt(j, matriceTemp)
      } else {
        jetonsAdp.setMatrixAt(j, matriceTemp)
        echelleTemp.setScalar(0)
        matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
        jetonsAtp.setMatrixAt(j, matriceTemp)
      }
    }
    jetonsAtp.instanceMatrix.needsUpdate = true
    jetonsAdp.instanceMatrix.needsUpdate = true

    // ── 6. Les navettes NAD⁺ → NADH ───────────────────────────────────────
    for (let n = 0; n < NB_NAD; n++) {
      const t0 = NAD_T0[n]!
      const t1 = NAD_T1[n]!
      const t2 = NAD_T2[n]!
      const t3 = NAD_T3[n]!
      let taille = 0
      let charge = false
      if (cycle >= t0 && cycle <= t3) {
        if (cycle < t1) {
          lireVecteur(NAD_ARRIVEES, n, travailA)
          lireVecteur(NAD_DOCKS, n, travailB)
          positionTemp.copy(travailA).lerp(travailB, adoucir((cycle - t0) / (t1 - t0)))
          taille = adoucir((cycle - t0) / 0.22)
        } else if (cycle < t2) {
          lireVecteur(NAD_DOCKS, n, positionTemp)
          positionTemp.y += Math.sin(temps * 22 + n) * 0.004
          taille = 1
        } else {
          const e = adoucir((cycle - t2) / (t3 - t2))
          lireVecteur(NAD_DOCKS, n, travailA)
          lireVecteur(TEMOINS_POS, 6 + n, travailB)
          positionTemp.copy(travailA).lerp(travailB, e)
          positionTemp.y += Math.sin(Math.PI * e) * 0.2
          taille = 1 - adoucir((e - 0.6) / 0.4)
          charge = true
        }
      }
      echelleTemp.setScalar(taille * RAYON_NAD)
      matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
      if (charge) {
        navettesNadh.setMatrixAt(n, matriceTemp)
        echelleTemp.setScalar(0)
        matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
        navettesNad.setMatrixAt(n, matriceTemp)
      } else {
        navettesNad.setMatrixAt(n, matriceTemp)
        echelleTemp.setScalar(0)
        matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
        navettesNadh.setMatrixAt(n, matriceTemp)
      }
    }
    navettesNad.instanceMatrix.needsUpdate = true
    navettesNadh.instanceMatrix.needsUpdate = true

    // ── 7. Les phosphates, et leurs sauts ─────────────────────────────────
    for (let p = 0; p < NB_PHOSPHATES; p++) {
      const b = p >> 1
      const s = p & 1
      let taille = 0
      if (s === 0) {
        // Le phosphate durable : posé par un ATP, il finit sur une ADP.
        const jetonPoseur = b
        const jetonPreneur = 4 + b
        if (cycle >= JETON_T1[jetonPoseur]! && cycle <= JETON_T2[jetonPreneur]!) {
          taille = 1
          pointAttache(b, s, migration, travailB)
          if (cycle < JETON_T2[jetonPoseur]!) {
            lireVecteur(JETON_DOCKS, jetonPoseur, travailA)
            const e = adoucir(
              (cycle - JETON_T1[jetonPoseur]!) / (JETON_T2[jetonPoseur]! - JETON_T1[jetonPoseur]!),
            )
            positionTemp.copy(travailA).lerp(travailB, e)
          } else if (cycle > JETON_T1[jetonPreneur]!) {
            // Phosphorylation au niveau du substrat : le phosphate SAUTE du
            // phosphoénolpyruvate sur l'ADP. Aucun moteur, aucune membrane.
            lireVecteur(JETON_DOCKS, jetonPreneur, travailA)
            const e = adoucir(
              (cycle - JETON_T1[jetonPreneur]!) /
                (JETON_T2[jetonPreneur]! - JETON_T1[jetonPreneur]!),
            )
            positionTemp.copy(travailB).lerp(travailA, e)
          } else {
            positionTemp.copy(travailB)
          }
        }
      } else {
        // Le phosphate de GAPDH : il vient du cytosol libre, pas d'un ATP,
        // et il repart aussitôt sur une ADP à la phosphoglycérate kinase.
        const jetonPreneur = 2 + b
        if (cycle >= NAD_T1[b]! && cycle <= JETON_T2[jetonPreneur]!) {
          taille = 1
          pointAttache(b, s, migration, travailB)
          if (cycle < NAD_T2[b]!) {
            lireVecteur(ORIGINES_PI, b, travailA)
            const e = adoucir((cycle - NAD_T1[b]!) / (NAD_T2[b]! - NAD_T1[b]!))
            positionTemp.copy(travailA).lerp(travailB, e)
          } else if (cycle > JETON_T1[jetonPreneur]!) {
            lireVecteur(JETON_DOCKS, jetonPreneur, travailA)
            const e = adoucir(
              (cycle - JETON_T1[jetonPreneur]!) /
                (JETON_T2[jetonPreneur]! - JETON_T1[jetonPreneur]!),
            )
            positionTemp.copy(travailB).lerp(travailA, e)
          } else {
            positionTemp.copy(travailB)
          }
        }
      }
      echelleTemp.setScalar(taille * RAYON_PHOSPHATE)
      matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
      phosphates.setMatrixAt(p, matriceTemp)
    }
    phosphates.instanceMatrix.needsUpdate = true

    // ── 8. La réglette du bilan ───────────────────────────────────────────
    const extinction = 1 - adoucir((cycle - (DUREE_CYCLE - DUREE_EXTINCTION)) / DUREE_EXTINCTION)
    for (let t = 0; t < NB_TEMOINS; t++) {
      const allumage = adoucir((cycle - TEMPS_TEMOINS[t]!) / 0.22) * extinction
      lireVecteur(TEMOINS_POS, t, positionTemp)
      const rayon = t < 2 ? RAYON_TEMOIN : t >= 10 ? RAYON_TEMOIN_NET_PLEIN : RAYON_TEMOIN_PLEIN
      // Le jeton rebondit une fois en se posant : le compte se voit s'incrémenter.
      const rebond = 1 + Math.sin(adoucir((cycle - TEMPS_TEMOINS[t]!) / 0.4) * Math.PI) * 0.22
      echelleTemp.setScalar(allumage * rayon * rebond)
      matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
      if (t < 2) temoinsDepense.setMatrixAt(t, matriceTemp)
      else if (t < 6) temoinsGain.setMatrixAt(t - 2, matriceTemp)
      else if (t < 8) temoinsNadh.setMatrixAt(t - 6, matriceTemp)
      else if (t < 10) temoinsPyruvate.setMatrixAt(t - 8, matriceTemp)
      else temoinsNet.setMatrixAt(t - 10, matriceTemp)
    }
    temoinsDepense.instanceMatrix.needsUpdate = true
    temoinsGain.instanceMatrix.needsUpdate = true
    temoinsNadh.instanceMatrix.needsUpdate = true
    temoinsPyruvate.instanceMatrix.needsUpdate = true
    temoinsNet.instanceMatrix.needsUpdate = true

    // ── 9. Les enzymes : seule celle qui travaille s'allume ───────────────
    for (let k = 0; k < NB_POSTES; k++) {
      const groupeEnzyme = groupesEnzymes[k]!
      const materiau = materiauxEnzymes[k]!
      const actif = etapeActive === k
      const eclat = actif ? Math.sin(adoucir(progression) * Math.PI) : 0
      const respiration = 1 + Math.sin(temps * (1.7 + k * 0.13)) * 0.03
      groupeEnzyme.scale.setScalar(respiration * (1 + eclat * 0.1))
      materiau.emissive.setRGB(eclat * 0.34, eclat * 0.2, eclat * 0.06)

      const lobeA = lobesA[k]!
      const lobeB = lobesB[k]!
      if (k === HEXOKINASE && lobeA && lobeB) {
        // Ajustement induit : les deux lobes se referment sur le glucose.
        const fermeture = eclat
        lobeA.position.y = 0.062 - fermeture * 0.03
        lobeB.position.y = -0.062 + fermeture * 0.03
      } else if (k === ALDOLASE && lobeA && lobeB) {
        // Les deux blocs s'écartent exactement quand la molécule se coupe.
        lobeA.position.y = 0.045 + ecartementAldolase * 0.055
        lobeB.position.y = -0.045 - ecartementAldolase * 0.055
      } else if (k === PHOSPHOGLYCERATE_KINASE && lobeA && lobeB) {
        lobeA.position.x = 0.038 - eclat * 0.016
        lobeB.position.x = -0.038 + eclat * 0.016
      } else if (k === PHOSPHOFRUCTOKINASE && lobeA) {
        // Le site allostérique bat en permanence : cette enzyme est le point de
        // contrôle de toute la voie, et elle écoute même quand rien ne passe.
        lobeA.scale.setScalar(1 + Math.sin(temps * 4.4) * 0.25)
      }
    }

    // ── 10. Le cytosol : des rencontres qui ne donnent rien ───────────────
    for (let e = 0; e < NB_ERRANTS + NB_ERRANTS_ADP; e++) {
      positionTemp.set(
        basesErrants[e * 3]! + Math.sin(temps * phasesErrants[e * 6]! + phasesErrants[e * 6 + 3]!) * 0.34,
        basesErrants[e * 3 + 1]! +
          Math.sin(temps * phasesErrants[e * 6 + 1]! + phasesErrants[e * 6 + 4]!) * 0.3,
        basesErrants[e * 3 + 2]! +
          Math.sin(temps * phasesErrants[e * 6 + 2]! + phasesErrants[e * 6 + 5]!) * 0.22,
      )
      // Repoussée hors de chaque enzyme : elle touche, glisse, et repart sans
      // que rien ne se passe. C'est le sort de l'immense majorité des rencontres.
      for (let k = 0; k < NB_POSTES; k++) {
        lireVecteur(POSTES, k, travailA)
        const seuil = RAYONS_ENZYMES[k]! + 0.02
        travailB.copy(positionTemp).sub(travailA)
        const distance = travailB.length()
        if (distance < seuil && distance > 1e-5) {
          positionTemp.copy(travailA).addScaledVector(travailB, seuil / distance)
        }
      }
      if (e < NB_ERRANTS) {
        echelleTemp.setScalar(RAYON_ERRANT)
        matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
        errants.setMatrixAt(e, matriceTemp)
      } else {
        echelleTemp.setScalar(RAYON_ADP)
        matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
        errantsAdp.setMatrixAt(e - NB_ERRANTS, matriceTemp)
      }
    }
    errants.instanceMatrix.needsUpdate = true
    errantsAdp.instanceMatrix.needsUpdate = true

    echelleTemp.setScalar(RAYON_POUSSIERE)
    for (let p = 0; p < NB_POUSSIERE; p++) {
      positionTemp.set(
        basesPoussiere[p * 3]! + Math.sin(temps * 0.32 + phasesPoussiere[p * 3]!) * 0.05,
        basesPoussiere[p * 3 + 1]! + Math.sin(temps * 0.27 + phasesPoussiere[p * 3 + 1]!) * 0.05,
        basesPoussiere[p * 3 + 2]! + Math.sin(temps * 0.36 + phasesPoussiere[p * 3 + 2]!) * 0.05,
      )
      matriceTemp.compose(positionTemp, quaternionNeutre, echelleTemp)
      poussiere.setMatrixAt(p, matriceTemp)
    }
    poussiere.instanceMatrix.needsUpdate = true
    echelleTemp.set(1, 1, 1)
  }

  animer(0)

  const ancre = SIEGE.clone()
  ancre.x -= 0.1
  ancre.y += 0.15

  return [
    {
      cle: 'glycolyse',
      nom: 'Glycolyse',
      siege: 'Cytosol',
      facteur: 'accéléré ×5',
      justificationFacteur:
        "Le transit d'un glucose à travers les dix étapes ne dure pas le même temps selon l'état de " +
        'la cellule : le rapport entre les réserves d\'intermédiaires et le flux donne moins d\'une ' +
        "seconde dans un muscle à l'effort, et plusieurs dizaines de secondes dans une cellule au " +
        "repos. C'est ce dernier cas qui est joué ici : une dizaine de secondes à l'écran pour un " +
        'tour complet, soit environ cinq fois plus vite que le réel.',
      ellision:
        "Trois horloges cohabitent, et une seule est au facteur affiché. La chimie de chaque étape " +
        "est en réalité de l'ordre de la milliseconde — la triose-phosphate isomérase traite près de " +
        "dix mille molécules par seconde — et elle est donc ici RALENTIE. L'attente entre deux " +
        'rencontres, elle, est COUPÉE : un intermédiaire dérive dans le cytosol avant de tomber sur ' +
        "l'enzyme suivante, et rien de cette attente n'est montré à l'échelle. La densité est réduite " +
        "d'un facteur mille : ce volume contient réellement des dizaines de milliers de protéines, et " +
        'une cellule mène des dizaines de milliers de glucoses de front — on n\'en suit qu\'un. Sont ' +
        "absents l'eau, les ions Mg²⁺ et H⁺, le transporteur GLUT qui fait entrer le glucose, le " +
        'détail de la régulation de la phosphofructokinase (inhibée par l\'ATP et le citrate, activée ' +
        "par l'AMP et le fructose-2,6-bisphosphate), et le devenir du NADH. Après le clivage, les deux " +
        'trioses passent ici sur le même poste alors que chacun trouve sa propre copie de l\'enzyme.',
      description:
        'La glycolyse coupe un glucose à six carbones en deux pyruvates à trois, dans le cytosol, sans ' +
        "oxygène et sans le moindre organite : c'est la voie la plus ancienne et la plus universelle, " +
        "et une hématie, qui n'a pas de mitochondrie, ne vit que de celle-là. La cellule doit d'abord " +
        'INVESTIR — deux ATP sont dépensés aux étapes 1 et 3, et on les voit partir avant que rien ne ' +
        "rentre ; au clivage par l'aldolase le cycle s'ouvre et se coupe en deux trioses, et tout ce " +
        'qui suit se produit en double, ce qui est la seule raison pour laquelle la phase de ' +
        'récupération rend quatre ATP et deux NADH, soit un bilan NET de +2 ATP. Ces quatre ATP ne ' +
        "sortent d'aucun moteur rotatif : le phosphate saute directement d'un intermédiaire très " +
        "énergétique sur une ADP de passage — c'est la phosphorylation au niveau du substrat, l'exact " +
        "contraire de l'ATP synthase, qui exige une membrane et un gradient de protons. Les " +
        'tailles sont vraies : les dix enzymes tiennent dans 90 nm et un glucose fait 1 nm. Seule ' +
        'la disposition est une convention — la chaîne est rangée en arc alors que ces enzymes sont ' +
        'en réalité dispersées dans le cytosol ; le substrat les trouve par collision, et ' +
        "l'on montre aussi les rencontres qui ne donnent rien. Les deux pyruvates sortent du cadre vers " +
        "la mitochondrie s'il y a de l'oxygène, et vers la fermentation s'il n'y en a pas ; les deux " +
        'NADH, eux, emportent leurs électrons vers la chaîne respiratoire, et ce sont eux qui relient ' +
        'cette voie à toutes les autres. La réglette du haut compte le tour en cours : deux ATP ' +
        'dépensés en anneaux creux, quatre produits, deux NADH, deux pyruvates, et en bas le solde net ' +
        'de deux ATP.',
      chiffres: [
        { valeur: '+2 ATP', quoi: 'bilan net par glucose : quatre produits moins deux investis' },
        { valeur: '+2 NADH', quoi: 'transporteurs d\'électrons chargés, produits par GAPDH' },
        {
          valeur: '2 pyruvates',
          quoi: 'de trois carbones : les six carbones du glucose sont tous conservés, la glycolyse ne dégage aucun CO₂',
        },
        { valeur: '10', quoi: 'étapes enzymatiques, toutes dans le cytosol' },
        {
          valeur: '0 O₂',
          quoi: 'ni oxygène ni organite : la seule voie énergétique qui ne demande ni l\'un ni l\'autre',
        },
        {
          valeur: 'PFK',
          quoi: 'la phosphofructokinase est l\'étape limitante et le point de contrôle de toute la voie',
        },
        { valeur: '~5 %', quoi: 'de l\'énergie du glucose : 2 ATP nets sur la trentaine du bilan complet' },
        {
          valeur: '~10⁴ s⁻¹',
          quoi: 'triose-phosphate isomérase : une molécule d\'enzyme en traite près de dix mille par seconde, à la limite de ce que permet la rencontre',
        },
        { valeur: '2,5 mmol/L/h', quoi: 'consommation de glucose d\'une hématie, qui vit uniquement de glycolyse' },
        { valeur: '~3,5 milliards d\'années', quoi: 'voie présente chez presque tous les êtres vivants connus' },
      ],
      objet: groupe,
      ancre,
      rayonCadrage: 1.4,
      couleur: TEINTE_ATP,
      animer,
    },
  ]
}
