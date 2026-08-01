import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite, pointDansCoquille } from '../contrat.js'
import type { MecanismeBrut } from './contrat.js'

/**
 * LA SYNTHÈSE DES PROTÉINES PAR LES RIBOSOMES.
 *
 * Deux scènes, une seule horloge. Un ribosome de mammifère pose 5 à 6 acides
 * aminés par seconde : un codon dure 170 ms, qui deviennent 3,4 s à ralenti ×20.
 *
 * La première scène montre un POLYSOME libre — un ARNm en pelote, circularisé
 * par eIF4G, parcouru par cinq ribosomes. La seconde montre la même chimie
 * amarrée à un canal Sec61 du réticulum : la chaîne y traverse la membrane au
 * lieu de rester dans le cytosol, et c'est là, à ce canal, que se joue la
 * différence entre une protéine cytosolique et une protéine exportée.
 *
 * Ce que presque toutes les vulgarisations ratent, et qui est ici le sujet :
 * le ribosome ne GLISSE pas. Il est immobile pendant plus de trois secondes
 * d'écran, puis tout arrive d'un coup — le bon ARNt s'installe, la liaison se
 * fait, les sous-unités pivotent l'une contre l'autre, et il saute d'un codon.
 * Et avant ce bon ARNt, trois à cinq autres viennent cogner le ribosome et
 * repartent, la plupart sans même tomber sur le site A. Cette accumulation de
 * rejets n'est pas du décor : c'est le mécanisme même de la fidélité.
 *
 * Budget d'instances : 450 pour le polysome (5 chaînes de 64 résidus, 30 ARNt
 * de travail, 70 ARNt errants) et 820 pour le réticulum (mêmes acteurs + 300
 * pour le tapis de 150 ribosomes voisins, 8 pour les ribosomes qui viennent
 * cogner la membrane sans s'y fixer, 72 pour les protéines de la lumière) —
 * 1 270 en tout. Les neuf ribosomes qu'on suit à l'œil sont des maillages
 * ordinaires : mieux vaut peu d'acteurs lisibles qu'une nuée illisible.
 */

const GRAINE = 5_120_733

// ── Le temps ──────────────────────────────────────────────────────────────
/** 170 ms par codon chez le mammifère ; ×20 plus lent, cela fait 3,4 s. */
const DUREE_CODON = 3.4
/** Douze codons montrés — une protéine entière en demanderait des centaines. */
const CODONS_MONTRES = 12
/** Le treizième pas ne traduit rien : c'est la relève du ribosome. */
const PAS_CYCLE = CODONS_MONTRES + 1

/**
 * Découpage d'un codon.
 *
 * Près des trois quarts du temps partent en essais d'ARNt : chez le ribosome,
 * ce qui coûte est la SÉLECTION, pas la chimie. La liaison peptidique et la
 * translocation, elles, tiennent dans le dernier cinquième.
 */
const P_FIN_ESSAIS = 0.72
const P_LIAISON = 0.78
const P_TRANSLOC = 0.82
const P_TRANSLOC_FIN = 0.95

// ── Les calibres, en micromètres ──────────────────────────────────────────
/** Grande sous-unité : 25 nm de large. Petite : 18. Le ribosome fait 30 en tout. */
const RAYON_GRANDE = 0.0125
const RAYON_PETITE = 0.009
/** Hauteur des centres de part et d'autre du brin, qui passe dans l'interface. */
const HAUT_GRANDE = 0.0068
const HAUT_PETITE = -0.0058
/** Le tunnel de sortie fait 10 nm et traverse la grande sous-unité. */
const LONG_TUNNEL = 0.010
const SORTIE_TUNNEL = 0.0172
/**
 * Un nucléotide fait 0,34 nm : un codon en fait 0,9. Le pas est VRAI, donc
 * minuscule — un trentième du ribosome. C'est le rythme qui rend le cliquet
 * lisible, pas la distance parcourue.
 */
const PAS_CODON = 0.0009
/** Le brin d'ARN fait 1 nm ; dessiné à 2,4, sinon il n'existe plus à l'écran. */
const RAYON_BRIN = 0.0012
/** L'ARNt en L fait 7,5 nm sur 2,5 : sa forme ne se lit pas, son trajet oui. */
const LONG_ARNT = 0.0075
const RAYON_ARNT = 0.0012
const RAYON_ACIDE = 0.0007
/**
 * Espacement des résidus de la chaîne naissante.
 *
 * Le vrai est de 0,35 nm : à cette distance les perles se recouvriraient et
 * l'ajout d'un résidu serait invisible. Elles sont espacées de 0,9 nm — seule
 * dilatation de la scène, et c'est le prix pour qu'on puisse COMPTER les codons.
 */
const ESPACE_RESIDU = 0.0009
const RAYON_RESIDU = 0.00055
/** Résidus dessinés hors du tunnel. Les trente premiers sont dedans, invisibles. */
const CHAINE_MAX = 64
const RESIDUS_TUNNEL = 30

const NB_ESSAIS_MAX = 5
/** Cinq emplacements d'essai, plus l'occupant du site P qui porte la chaîne. */
const NB_SLOTS = NB_ESSAIS_MAX + 1
/** Sites A, P et E, alignés sur le brin. Le site A est en aval, côté 3'. */
const SITE_A = 0.0042
const SITE_P = 0
const SITE_E = -0.0042
const HAUT_ARNT = 0.0035
/**
 * Rotation des sous-unités l'une contre l'autre pendant la translocation.
 *
 * Le vrai cliquet fait 8° ; il est porté à 20 parce qu'à 8 il ne resterait
 * qu'un frémissement d'un pixel. C'est la seule exagération d'angle de la scène.
 */
const ANGLE_CLIQUET = 0.35
/** Les ARNt viennent de loin : c'est leur trajet, large, qui donne le tempo. */
const PORTEE_ARNT = 0.055

// ── Temporaires hissés : animer() ne doit RIEN allouer ────────────────────
const AXE_Y = new THREE.Vector3(0, 1, 0)
const _matrice = new THREE.Matrix4()
const _base = new THREE.Matrix4()
const _quat = new THREE.Quaternion()
const _quatLibre = new THREE.Quaternion()
const _quatFixe = new THREE.Quaternion()
const _quatDroit = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)
const _position = new THREE.Vector3()
const _cible = new THREE.Vector3()
const _locale = new THREE.Vector3()
const _errance = new THREE.Vector3()
const _axe = new THREE.Vector3()
const _tangA = new THREE.Vector3()
const _tangB = new THREE.Vector3()

/** Rampe adoucie, bornée à [0, 1]. */
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
 * période perceptible, et surtout SANS DIRECTION : aucune molécule ne sait où
 * elle va, elle passe et repasse jusqu'à ce qu'une collision aboutisse.
 */
function derive(
  indice: number,
  temps: number,
  amplitude: number,
  frequences: Float32Array,
  phases: Float32Array,
  sortie: THREE.Vector3,
): void {
  const base = indice * 3 * NB_HARMONIQUES
  let x = 0
  let y = 0
  let z = 0
  for (let h = 0; h < NB_HARMONIQUES; h++) {
    const poids = POIDS_HARMONIQUES[h]!
    const ix = base + h
    const iy = base + NB_HARMONIQUES + h
    const iz = base + 2 * NB_HARMONIQUES + h
    x += poids * Math.sin(Math.PI * 2 * (frequences[ix]! * temps + phases[ix]!))
    y += poids * Math.sin(Math.PI * 2 * (frequences[iy]! * temps + phases[iy]!))
    z += poids * Math.sin(Math.PI * 2 * (frequences[iz]! * temps + phases[iz]!))
  }
  sortie.set(x * amplitude, y * amplitude, z * amplitude)
}

/** Tire les fréquences et les phases d'errance, une fois pour toutes. */
function tirerErrance(alea: () => number, frequences: Float32Array, phases: Float32Array): void {
  for (let i = 0; i < frequences.length; i++) {
    frequences[i] = 0.06 + alea() * 0.34
    phases[i] = alea()
  }
}

/**
 * Où se trouve le résidu `a` de la chaîne naissante, dans le repère du ribosome.
 *
 * `a` compte depuis la SORTIE du tunnel : le résidu 0 vient d'émerger, les
 * grands indices sont l'extrémité N, la plus ancienne — et donc la plus avancée
 * dans son repliement. Le repliement commence avant que la chaîne soit finie,
 * et c'est ce qu'on voit : tendue à la sortie, pelotonnée au bout.
 */
function positionChaine(a: number, tour: number, cible: THREE.Vector3): void {
  const l = a * ESPACE_RESIDU
  const tendu = l < 0.004 ? l : 0.004
  const replie = l - tendu
  const rayon = Math.min(0.009, replie * 0.42)
  const angle = replie * 190 + tour
  cible.set(
    Math.cos(angle) * rayon,
    SORTIE_TUNNEL + tendu + replie * 0.3,
    Math.sin(angle) * rayon,
  )
}

// ── Le ribosome ───────────────────────────────────────────────────────────

interface Materiaux {
  grande: THREE.MeshLambertMaterial
  grandeOpaque: THREE.MeshLambertMaterial
  petite: THREE.MeshLambertMaterial
  tunnel: THREE.MeshLambertMaterial
  brin: THREE.MeshLambertMaterial
  arnt: THREE.MeshLambertMaterial
  arntPale: THREE.MeshLambertMaterial
  chaine: THREE.MeshLambertMaterial
  amarre: THREE.MeshLambertMaterial
  membrane: THREE.MeshLambertMaterial
}

interface Geometries {
  grande: THREE.IcosahedronGeometry
  petite: THREE.IcosahedronGeometry
  grandeBrute: THREE.IcosahedronGeometry
  petiteBrute: THREE.IcosahedronGeometry
  tete: THREE.IcosahedronGeometry
  tunnel: THREE.CylinderGeometry
  arnt: THREE.OctahedronGeometry
  acide: THREE.IcosahedronGeometry
  residu: THREE.IcosahedronGeometry
  proteine: THREE.IcosahedronGeometry
}

/**
 * Un ribosome : deux sous-unités de tailles nettement différentes, le brin qui
 * passe entre elles. C'est à ce déséquilibre-là qu'on le reconnaît sur un
 * cliché, pas à une silhouette de haricot.
 *
 * Repère local : +y va de la petite sous-unité vers la grande — c'est l'axe du
 * tunnel de sortie — et +x est le sens de lecture, 5' vers 3'. Le brin court
 * en y = 0.
 */
function creerRibosome(
  geos: Geometries,
  mats: Materiaux,
): { corps: THREE.Group; petite: THREE.Group } {
  const corps = new THREE.Group()

  const grande = new THREE.Mesh(geos.grande, mats.grande)
  grande.position.y = HAUT_GRANDE

  // Le tunnel : 10 nm du centre peptidyl transférase à la sortie. Il est dessiné
  // à 3 nm de large au lieu de 1,5, sinon il ne se distinguerait pas.
  const tunnel = new THREE.Mesh(geos.tunnel, mats.tunnel)
  tunnel.position.y = (HAUT_ARNT + LONG_ARNT * 0.5 + SORTIE_TUNNEL) * 0.5

  // La petite sous-unité est un groupe : c'est ELLE qui pivote au cliquet, et
  // sa tête, décentrée, est ce qui rend la rotation visible.
  const petite = new THREE.Group()
  petite.position.y = HAUT_PETITE
  const corpsPetite = new THREE.Mesh(geos.petite, mats.petite)
  const tete = new THREE.Mesh(geos.tete, mats.petite)
  tete.position.set(0.0058, 0.0032, 0.001)
  petite.add(corpsPetite, tete)

  corps.add(grande, tunnel, petite)
  return { corps, petite }
}

// ── L'atelier : n ribosomes, leurs ARNt, leurs chaînes ────────────────────

/**
 * Ce que les deux scènes partagent.
 *
 * Seule la POSE des ribosomes change d'une scène à l'autre — sur une pelote
 * d'ARNm ici, sur une membrane là. Tout le reste — le cycle des essais, le
 * cliquet, la chaîne qui sort du tunnel — est le même mécanisme.
 */
interface Atelier {
  nb: number
  corps: THREE.Group[]
  petites: THREE.Group[]
  origines: THREE.Vector3[]
  ex: THREE.Vector3[]
  ey: THREE.Vector3[]
  ez: THREE.Vector3[]
  arnt: THREE.InstancedMesh
  acides: THREE.InstancedMesh
  chaines: THREE.InstancedMesh
  /** Nombre d'essais avant le bon, par (ribosome, codon) : de 3 à 5. */
  essais: Uint8Array
  /** Point visé par chaque essai, dans le repère du ribosome. */
  visees: Float32Array
  /** Point d'errance de chaque emplacement d'ARNt, hors du ribosome. */
  foyers: Float32Array
  frequences: Float32Array
  phases: Float32Array
}

function creerAtelier(
  nb: number,
  alea: () => number,
  geos: Geometries,
  mats: Materiaux,
  groupe: THREE.Group,
): Atelier {
  const corps: THREE.Group[] = []
  const petites: THREE.Group[] = []
  const origines: THREE.Vector3[] = []
  const ex: THREE.Vector3[] = []
  const ey: THREE.Vector3[] = []
  const ez: THREE.Vector3[] = []

  for (let r = 0; r < nb; r++) {
    const ribosome = creerRibosome(geos, mats)
    groupe.add(ribosome.corps)
    corps.push(ribosome.corps)
    petites.push(ribosome.petite)
    origines.push(new THREE.Vector3())
    ex.push(new THREE.Vector3(1, 0, 0))
    ey.push(new THREE.Vector3(0, 1, 0))
    ez.push(new THREE.Vector3(0, 0, 1))
  }

  const arnt = new THREE.InstancedMesh(geos.arnt, mats.arnt, nb * NB_SLOTS)
  // Porte le cycle auquel le badge se réfère : voir `observable`.
  arnt.name = 'arn-de-transfert'
  const acides = new THREE.InstancedMesh(geos.acide, mats.chaine, nb * NB_SLOTS)
  const chaines = new THREE.InstancedMesh(geos.residu, mats.chaine, nb * CHAINE_MAX)
  arnt.frustumCulled = false
  acides.frustumCulled = false
  chaines.frustumCulled = false
  groupe.add(arnt, acides, chaines)

  const essais = new Uint8Array(nb * PAS_CYCLE)
  const visees = new Float32Array(nb * PAS_CYCLE * NB_ESSAIS_MAX * 3)
  for (let r = 0; r < nb; r++) {
    for (let pas = 0; pas < PAS_CYCLE; pas++) {
      const n = 3 + Math.floor(alea() * 3)
      essais[r * PAS_CYCLE + pas] = n
      for (let i = 0; i < NB_ESSAIS_MAX; i++) {
        const base = ((r * PAS_CYCLE + pas) * NB_ESSAIS_MAX + i) * 3
        if (i === n - 1) {
          // Le bon, et lui seul, tombe exactement sur le site A.
          visees[base] = SITE_A
          visees[base + 1] = HAUT_ARNT
          visees[base + 2] = 0
        } else {
          // Les autres cognent le ribosome n'importe où et glissent : un ARNt
          // qui rate son codon rate le plus souvent le site tout court.
          visees[base] = SITE_A + (alea() - 0.5) * 0.024
          visees[base + 1] = 0.001 + alea() * 0.009
          visees[base + 2] = (alea() - 0.5) * 0.022
        }
      }
    }
  }

  const foyers = new Float32Array(nb * NB_SLOTS * 3)
  for (let r = 0; r < nb; r++) {
    for (let i = 0; i < NB_SLOTS; i++) {
      const angle = (i / NB_SLOTS) * Math.PI * 2 + r * 1.3
      const portee = PORTEE_ARNT * (0.7 + alea() * 0.6)
      const base = (r * NB_SLOTS + i) * 3
      foyers[base] = Math.cos(angle) * portee
      // Les ARNt rôdent du côté de la PETITE sous-unité, jamais du côté du
      // tunnel : sur la membrane du réticulum, ce côté-là est la lumière, et il
      // n'y a pas d'ARNt dans la lumière — c'est bien pour ça qu'on n'y traduit rien.
      foyers[base + 1] = (alea() * 0.9 - 0.85) * PORTEE_ARNT
      foyers[base + 2] = Math.sin(angle) * portee
    }
  }

  const frequences = new Float32Array(nb * NB_SLOTS * 3 * NB_HARMONIQUES)
  const phases = new Float32Array(frequences.length)
  tirerErrance(alea, frequences, phases)

  return {
    nb,
    corps,
    petites,
    origines,
    ex,
    ey,
    ez,
    arnt,
    acides,
    chaines,
    essais,
    visees,
    foyers,
    frequences,
    phases,
  }
}

/**
 * Avance un ribosome d'un atelier.
 *
 * Le repère (origine, ex, ey, ez) a été posé par la scène ; tout le reste est
 * commun. `presence` fond le ribosome lui-même, `presenceChaine` sa chaîne —
 * elles diffèrent au moment de la terminaison, où la protéine finie s'en va
 * seule pendant que le ribosome se défait.
 */
function animerRibosome(
  a: Atelier,
  r: number,
  temps: number,
  pas: number,
  p: number,
  presence: number,
  presenceChaine: number,
  longueur: number,
  fuite: number,
): void {
  const origine = a.origines[r]!
  const ex = a.ex[r]!
  const ey = a.ey[r]!
  const ez = a.ez[r]!

  const corps = a.corps[r]!
  corps.position.copy(origine)
  _base.makeBasis(ex, ey, ez)
  _quatDroit.setFromRotationMatrix(_base)
  corps.quaternion.copy(_quatDroit)
  corps.scale.setScalar(presence)

  // Le cliquet : les deux sous-unités pivotent l'une contre l'autre, puis
  // reviennent. Rien d'autre ne bouge pendant les trois secondes précédentes.
  const u = (p - P_TRANSLOC) / (P_TRANSLOC_FIN - P_TRANSLOC)
  const glisse = lissage(u)
  a.petites[r]!.rotation.y = u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u) * ANGLE_CLIQUET

  const nEssais = a.essais[r * PAS_CYCLE + pas]!

  for (let i = 0; i < NB_SLOTS; i++) {
    const idx = r * NB_SLOTS + i
    let approche = 0
    let acide = 1
    let vivant = presence

    if (i === NB_ESSAIS_MAX) {
      // L'occupant du site P : accepté au codon précédent, il porte la chaîne
      // jusqu'à la liaison peptidique, puis passe au site E et s'en va — nu,
      // car il a cédé son acide aminé.
      _locale.set(SITE_P + (SITE_E - SITE_P) * glisse, HAUT_ARNT, glisse * 0.006)
      approche = 1
      acide = 0
      vivant = presence * lissage(p / 0.06) * (1 - lissage((p - 0.93) / 0.07))
    } else if (i < nEssais) {
      const t0 = (i / nEssais) * P_FIN_ESSAIS
      const t1 = ((i + 1) / nEssais) * P_FIN_ESSAIS
      const q = (p - t0) / (t1 - t0)
      if (i === nEssais - 1) {
        // Le bon. Il arrive et il RESTE : c'est le seul essai qui aboutit.
        approche = lissage(q * 1.5)
        _locale.set(SITE_A + (SITE_P - SITE_A) * glisse, HAUT_ARNT, 0)
        // Son acide aminé passe à la chaîne : il disparaît de l'ARNt.
        acide = 1 - lissage((p - P_LIAISON) / 0.05)
        vivant = presence * (1 - lissage((p - 0.93) / 0.07))
      } else {
        // Les ratés : ils touchent et rebondissent. Ils sont la majorité, et
        // c'est leur nombre qui fait la fidélité de la traduction.
        approche = bosse(q)
        const base = ((r * PAS_CYCLE + pas) * NB_ESSAIS_MAX + i) * 3
        _locale.set(a.visees[base]!, a.visees[base + 1]!, a.visees[base + 2]!)
      }
    } else {
      // Les emplacements inutilisés ce codon-ci : leur ARNt rôde sans jamais
      // s'approcher. Il y en a toujours plus qui passent que qui servent.
      _locale.set(0, 0, 0)
    }

    const fBase = idx * 3
    derive(idx, temps, 0.014, a.frequences, a.phases, _errance)
    _position
      .copy(origine)
      .addScaledVector(ex, a.foyers[fBase]!)
      .addScaledVector(ey, a.foyers[fBase + 1]!)
      .addScaledVector(ez, a.foyers[fBase + 2]!)
      .add(_errance)
    _cible
      .copy(origine)
      .addScaledVector(ex, _locale.x)
      .addScaledVector(ey, _locale.y)
      .addScaledVector(ez, _locale.z)
    _position.lerp(_cible, approche)

    // Libre, l'ARNt culbute avec sa dérive ; accosté, il s'aligne sur l'axe du
    // ribosome, anticodon vers le brin et bras accepteur vers le tunnel.
    _axe.copy(_errance).normalize()
    _quatLibre.setFromUnitVectors(AXE_Y, _axe)
    _quatFixe.setFromUnitVectors(AXE_Y, ey)
    _quat.slerpQuaternions(_quatLibre, _quatFixe, approche)

    _echelle.setScalar(vivant)
    _matrice.compose(_position, _quat, _echelle)
    a.arnt.setMatrixAt(idx, _matrice)

    _axe.copy(AXE_Y).applyQuaternion(_quat)
    _cible.copy(_position).addScaledVector(_axe, LONG_ARNT * 0.55)
    _echelle.setScalar(vivant * acide)
    _matrice.compose(_cible, _quat, _echelle)
    a.acides.setMatrixAt(idx, _matrice)
  }

  // La chaîne naissante. Elle ne paraît qu'au-delà du trentième résidu : avant,
  // elle est encore tout entière dans le tunnel.
  const total = Math.min(CHAINE_MAX, longueur)
  const tour = r * 2.4
  derive(r, temps * 0.4, fuite * 0.05, a.frequences, a.phases, _errance)
  for (let j = 0; j < CHAINE_MAX; j++) {
    if (j < total) {
      positionChaine(j, tour, _locale)
      _position
        .copy(origine)
        .addScaledVector(ex, _locale.x)
        .addScaledVector(ey, _locale.y + fuite * 0.03)
        .addScaledVector(ez, _locale.z)
        .add(_errance)
      _echelle.setScalar(presenceChaine)
    } else {
      _echelle.setScalar(0)
    }
    _matrice.compose(_position, _quatDroit, _echelle)
    a.chaines.setMatrixAt(r * CHAINE_MAX + j, _matrice)
  }
}

/**
 * Où en est le ribosome `r` de son cycle, à l'instant `temps`.
 *
 * Les cinq ribosomes d'un même ARNm ne sont pas synchronisés : chacun a son
 * décalage, si bien qu'à tout instant l'un accepte un ARNt pendant qu'un autre
 * en rejette un troisième.
 */
function poser(temps: number, r: number, nb: number, sortie: Float32Array): void {
  const cycle = temps / DUREE_CODON + (r * PAS_CYCLE) / nb
  const entier = Math.floor(cycle)
  sortie[0] = ((entier % PAS_CYCLE) + PAS_CYCLE) % PAS_CYCLE
  sortie[1] = cycle - entier
}

// ── Scène 1 : le polysome ─────────────────────────────────────────────────

const NB_RIBOSOMES_1 = 5
/** 2 000 nucléotides à 0,34 nm : longueur vraie du brin, jamais tendu. */
const LONG_ARNM = 0.6
/**
 * 133 nucléotides entre deux ribosomes.
 *
 * C'est un écart d'ARC : dans les coudes de la pelote, deux ribosomes voisins
 * se retrouvent à 25 nm l'un de l'autre, soit exactement leur largeur. Ils se
 * touchent donc par moments, et c'est bien ce que montre un cliché de
 * polysome — un chapelet, pas des perles éparpillées.
 */
const ESPACEMENT = 0.04
const DEPART_TRAIN = 0.14
/** Résidus déjà posés par chaque ribosome : le plus avancé porte la plus longue. */
const CHAINES_DEPART = [34, 46, 58, 70, 82]
const NB_ARNT_LIBRES_1 = 70

// ── Scène 2 : la translocation ────────────────────────────────────────────

const NB_RIBOSOMES_2 = 5
/** Quatre ribosomes amarrés à un translocon, le cinquième libre dans le cytosol. */
const NB_AMARRES = 4
const LARGEUR_MEMBRANE = 1.2
const PROFONDEUR_MEMBRANE = 0.8
/** La bicouche fait 5 nm : deux feuillets à 2,5 nm de part et d'autre. */
const DEMI_BICOUCHE = 0.0025
/** Sec61 fait 6 nm de large et dépasse un peu la bicouche des deux côtés. */
const RAYON_TRANSLOCON = 0.0038
const HAUT_TRANSLOCON = 0.0080
/** Hauteur du centre du ribosome amarré : son tunnel débouche sur le pore. */
const HAUT_RIBOSOME_AMARRE = 0.019
const NB_TAPIS = 150
const NB_CANDIDATS = 4
const NB_ARNT_LIBRES_2 = 60
/** Protéines déjà repliées dans la lumière, plus celles qui y descendent. */
const NB_PROTEINES = 72
const NB_PROTEINES_NEUVES = 12
/** Une protéine globulaire de 300 acides aminés fait 5 nm : c'est un grain. */
const RAYON_PROTEINE = 0.0025

/** Ondulation de la citerne : une membrane du réticulum n'est pas un plan. */
function hauteurMembrane(x: number, z: number): number {
  return 0.010 * Math.sin(x * 7.5) + 0.007 * Math.cos(z * 9.5 + 1.1)
}

export function creerTraductionReticulum(): MecanismeBrut[] {
  const alea = creerAlea(GRAINE)

  // ── Géométries et matériaux, partagés par les deux scènes ───────────────
  const geoGrande = new THREE.IcosahedronGeometry(RAYON_GRANDE, 2)
  geoGrande.scale(1, 0.85, 1)
  const geoPetite = new THREE.IcosahedronGeometry(RAYON_PETITE, 2)
  geoPetite.scale(1.05, 0.78, 1)
  // Les ribosomes du tapis sont cent cinquante : moins de facettes, ils ne font
  // qu'une trentaine de pixels chacun.
  const geoGrandeBrute = new THREE.IcosahedronGeometry(RAYON_GRANDE, 1)
  geoGrandeBrute.scale(1, 0.85, 1)
  const geoPetiteBrute = new THREE.IcosahedronGeometry(RAYON_PETITE, 1)
  geoPetiteBrute.scale(1.05, 0.78, 1)
  const geoArnt = new THREE.OctahedronGeometry(RAYON_ARNT, 0)
  geoArnt.scale(1, LONG_ARNT / (2 * RAYON_ARNT), 0.85)

  const geos: Geometries = {
    grande: geoGrande,
    petite: geoPetite,
    grandeBrute: geoGrandeBrute,
    petiteBrute: geoPetiteBrute,
    tete: new THREE.IcosahedronGeometry(0.0038, 1),
    tunnel: new THREE.CylinderGeometry(0.0016, 0.0016, LONG_TUNNEL, 8, 1, true),
    arnt: geoArnt,
    acide: new THREE.IcosahedronGeometry(RAYON_ACIDE, 1),
    residu: new THREE.IcosahedronGeometry(RAYON_RESIDU, 1),
    proteine: new THREE.IcosahedronGeometry(RAYON_PROTEINE, 1),
  }

  const mats: Materiaux = {
    // La grande sous-unité est translucide : sans cela les ARNt disparaîtraient
    // dès qu'ils entrent, et c'est là que tout se joue.
    grande: materiauOrganite(TEINTES.ribosome, { opacite: 0.72 }),
    grandeOpaque: materiauOrganite(TEINTES.ribosome, { doubleFace: false }),
    petite: materiauOrganite(0xb04a00, { doubleFace: false }),
    tunnel: materiauOrganite(0x7a3200, { opacite: 0.9 }),
    brin: materiauOrganite(TEINTES.noyau),
    arnt: materiauOrganite(TEINTES.chromatine, { doubleFace: false }),
    arntPale: materiauOrganite(TEINTES.chromatine, { opacite: 0.55 }),
    chaine: materiauOrganite(TEINTES.golgi, { doubleFace: false }),
    amarre: materiauOrganite(TEINTES.proteineMembranaire),
    membrane: materiauOrganite(TEINTES.reticulumRugueux, { opacite: 0.55 }),
  }

  // ═══ SCÈNE 1 : un polysome en gros plan ═══════════════════════════════
  const groupe1 = new THREE.Group()
  groupe1.name = 'polysome'
  groupe1.position.set(-6.2, 1.8, 2.4)
  groupe1.rotation.set(0.34, -0.55, 0.12)

  /**
   * L'ARNm : une pelote presque refermée sur elle-même. Un ARNm réel n'est
   * jamais tendu, et il est circularisé — eIF4G relie la coiffe à la queue
   * poly-A, si bien qu'un ribosome qui termine se retrouve à côté du départ.
   */
  const pointsBrin: THREE.Vector3[] = []
  const NB_POINTS_BRIN = 13
  for (let i = 0; i < NB_POINTS_BRIN; i++) {
    // On s'arrête avant le tour complet : le hiatus est l'endroit où les deux
    // extrémités du brin sont tenues côte à côte.
    const angle = (i / (NB_POINTS_BRIN - 1)) * (Math.PI * 2 - 0.5)
    const rayon = 0.082 + (alea() - 0.5) * 0.03
    pointsBrin.push(
      new THREE.Vector3(
        Math.cos(angle) * rayon,
        Math.sin(angle) * rayon * 0.86,
        (alea() - 0.5) * 0.036,
      ),
    )
  }
  // Mise à l'échelle pour que la longueur d'arc vaille exactement celle d'un
  // ARNm de 2 000 nucléotides : la pelote est libre, sa longueur ne l'est pas.
  const brouillon = new THREE.CatmullRomCurve3(pointsBrin)
  const ajustement = LONG_ARNM / brouillon.getLength()
  for (const point of pointsBrin) point.multiplyScalar(ajustement)
  const brin = new THREE.CatmullRomCurve3(pointsBrin)
  // Amorce le cache d'abscisse curviligne AVANT la première image : sinon il
  // serait construit — et alloué — dans animer().
  brin.getLength()

  groupe1.add(
    new THREE.Mesh(new THREE.TubeGeometry(brin, 260, RAYON_BRIN, 6, false), mats.brin),
  )

  const surBrin = (s: number, sortie: THREE.Vector3): THREE.Vector3 => {
    const u = s / LONG_ARNM
    return brin.getPointAt(u <= 0 ? 0 : u >= 1 ? 1 : u, sortie)
  }
  // Curve.getTangentAt appelle getPoint sans cible : deux Vector3 alloués par
  // appel. On dérive donc la tangente à la main.
  const tangenteSurBrin = (s: number, sortie: THREE.Vector3): THREE.Vector3 => {
    surBrin(s - 0.002, _tangA)
    surBrin(s + 0.002, _tangB)
    return sortie.copy(_tangB).sub(_tangA).normalize()
  }

  // Le complexe qui referme la boucle, posé entre les deux extrémités.
  const jonction = new THREE.Group()
  const boutCoiffe = surBrin(0, new THREE.Vector3())
  const boutQueue = surBrin(LONG_ARNM, new THREE.Vector3())
  jonction.position.copy(boutCoiffe).lerp(boutQueue, 0.5)
  const eif4g = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0075, 1), mats.amarre)
  eif4g.scale.set(1.5, 0.9, 1)
  const coiffe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0028, 1), mats.amarre)
  coiffe.position.copy(boutCoiffe).sub(jonction.position)
  jonction.add(eif4g, coiffe)
  groupe1.add(jonction)

  // Le centre de la pelote sert de référence : les chaînes naissantes doivent
  // rayonner vers l'EXTÉRIEUR, sinon elles s'emmêlent dans le brin d'en face.
  const centrePelote = new THREE.Vector3()
  for (const point of pointsBrin) centrePelote.add(point)
  centrePelote.multiplyScalar(1 / pointsBrin.length)

  const atelier1 = creerAtelier(NB_RIBOSOMES_1, alea, geos, mats, groupe1)

  // Les ARNt qui ne servent à rien : la cellule en a des millions, et l'immense
  // majorité passe sans jamais rencontrer le codon qu'elle sait lire.
  const libres1 = new THREE.InstancedMesh(geos.arnt, mats.arntPale, NB_ARNT_LIBRES_1)
  libres1.frustumCulled = false
  groupe1.add(libres1)
  const centresLibres1: THREE.Vector3[] = []
  for (let i = 0; i < NB_ARNT_LIBRES_1; i++) {
    centresLibres1.push(pointDansCoquille(alea, 0.03, 0.24, new THREE.Vector3()))
  }
  const freqLibres1 = new Float32Array(NB_ARNT_LIBRES_1 * 3 * NB_HARMONIQUES)
  const phasesLibres1 = new Float32Array(freqLibres1.length)
  tirerErrance(alea, freqLibres1, phasesLibres1)

  const etat = new Float32Array(2)

  const animer1 = (temps: number): void => {
    for (let r = 0; r < NB_RIBOSOMES_1; r++) {
      poser(temps, r, NB_RIBOSOMES_1, etat)
      const pas = etat[0]!
      const p = etat[1]!
      const depart = DEPART_TRAIN + r * ESPACEMENT
      const base = CHAINES_DEPART[r]! - RESIDUS_TUNNEL

      let s: number
      let presence: number
      let presenceChaine: number
      let longueur: number
      let fuite: number
      if (pas < CODONS_MONTRES) {
        // Élongation. La position n'avance QUE pendant la fenêtre de
        // translocation : le reste du codon, le ribosome ne bouge pas d'un
        // nanomètre. C'est un cliquet, jamais un glissement.
        const u = (p - P_TRANSLOC) / (P_TRANSLOC_FIN - P_TRANSLOC)
        s = depart + (pas + lissage(u)) * PAS_CODON
        presence = 1
        presenceChaine = 1
        longueur = base + pas + (p >= P_LIAISON ? 1 : 0)
        fuite = 0
      } else if (p < 0.5) {
        // Terminaison : la protéine finie est libérée et s'en va, le ribosome
        // se défait. On coupe ici — la suite prendrait un quart d'heure.
        s = depart + CODONS_MONTRES * PAS_CODON
        presence = 1 - lissage(p / 0.35)
        fuite = lissage(p / 0.5)
        presenceChaine = 1 - lissage((p - 0.15) / 0.35)
        longueur = base + CODONS_MONTRES
      } else {
        // Réinitiation : un autre ribosome charge en amont et repart.
        s = depart
        presence = lissage((p - 0.55) / 0.35)
        presenceChaine = presence
        longueur = base
        fuite = 0
      }

      const origine = atelier1.origines[r]!
      surBrin(s, origine)
      tangenteSurBrin(s, atelier1.ex[r]!)
      // La normale est le rayon sortant de la pelote, pas un produit vectoriel
      // avec un axe fixe : ce dernier basculerait d'un ribosome à l'autre et
      // les chaînes partiraient vers l'intérieur de la boucle.
      const ey = atelier1.ey[r]!
      ey.copy(origine).sub(centrePelote)
      const ex = atelier1.ex[r]!
      ey.addScaledVector(ex, -ey.dot(ex))
      if (ey.lengthSq() < 1e-10) ey.set(0, 0, 1).addScaledVector(ex, -ex.z)
      ey.normalize()
      atelier1.ez[r]!.crossVectors(ex, ey)

      animerRibosome(atelier1, r, temps, pas, p, presence, presenceChaine, longueur, fuite)
    }
    atelier1.arnt.instanceMatrix.needsUpdate = true
    atelier1.acides.instanceMatrix.needsUpdate = true
    atelier1.chaines.instanceMatrix.needsUpdate = true

    for (let i = 0; i < NB_ARNT_LIBRES_1; i++) {
      derive(i, temps, 0.05, freqLibres1, phasesLibres1, _errance)
      _position.copy(centresLibres1[i]!).add(_errance)
      _axe.copy(_errance).normalize()
      _quat.setFromUnitVectors(AXE_Y, _axe)
      _echelle.setScalar(1)
      _matrice.compose(_position, _quat, _echelle)
      libres1.setMatrixAt(i, _matrice)
    }
    libres1.instanceMatrix.needsUpdate = true
  }

  animer1(0)

  // L'étiquette vise le MILIEU DU TRAIN, pas le centre de la pelote : sinon la
  // caméra se braque sur un morceau de brin vide.
  groupe1.updateMatrixWorld(true)
  const ancre1 = surBrin(
    DEPART_TRAIN + ((NB_RIBOSOMES_1 - 1) * ESPACEMENT) / 2,
    new THREE.Vector3(),
  )
  groupe1.localToWorld(ancre1)

  // ═══ SCÈNE 2 : la translocation dans le réticulum ═════════════════════
  const groupe2 = new THREE.Group()
  groupe2.name = 'translocation-sec61'
  groupe2.position.set(-4.6, -0.6, 1.4)
  groupe2.rotation.set(-0.22, 0.5, 0.08)

  // La bicouche : deux feuillets, 5 nm en tout. C'est mince, et ça doit se voir.
  for (const cote of [-1, 1]) {
    const feuillet = new THREE.PlaneGeometry(
      LARGEUR_MEMBRANE,
      PROFONDEUR_MEMBRANE,
      44,
      30,
    )
    feuillet.rotateX(-Math.PI / 2)
    const sommets = feuillet.getAttribute('position')
    for (let i = 0; i < sommets.count; i++) {
      const x = sommets.getX(i)
      const z = sommets.getZ(i)
      sommets.setY(i, hauteurMembrane(x, z) + cote * DEMI_BICOUCHE)
    }
    sommets.needsUpdate = true
    feuillet.computeVertexNormals()
    groupe2.add(new THREE.Mesh(feuillet, mats.membrane))
  }

  // Les quatre ribosomes amarrés forment un polysome sur la membrane, à
  // l'espacement vrai de 120 nucléotides. Le premier est à l'origine du groupe :
  // c'est lui que la caméra vise.
  const posesAmarrees: THREE.Vector3[] = []
  for (let k = 0; k < NB_AMARRES; k++) {
    const x = (k - 1) * ESPACEMENT
    const z = Math.sin(k * 1.4) * 0.005
    posesAmarrees.push(new THREE.Vector3(x, hauteurMembrane(x, z), z))
  }

  // Le brin qu'ils lisent, prolongé de part et d'autre du groupe.
  const pointsBrin2: THREE.Vector3[] = []
  for (let i = -2; i < NB_AMARRES + 2; i++) {
    const x = (i - 1) * ESPACEMENT
    const z = Math.sin(i * 1.4) * 0.005
    pointsBrin2.push(new THREE.Vector3(x, hauteurMembrane(x, z) + HAUT_RIBOSOME_AMARRE, z))
  }
  const brin2 = new THREE.CatmullRomCurve3(pointsBrin2)
  groupe2.add(
    new THREE.Mesh(new THREE.TubeGeometry(brin2, 120, RAYON_BRIN, 6, false), mats.brin),
  )

  // Les translocons Sec61 : un canal ouvert de part en part, planté dans la
  // bicouche, plus large que le pore qui le traverse.
  const geoTranslocon = new THREE.CylinderGeometry(
    RAYON_TRANSLOCON,
    RAYON_TRANSLOCON * 0.75,
    HAUT_TRANSLOCON,
    14,
    1,
    true,
  )
  for (const pose of posesAmarrees) {
    const canal = new THREE.Mesh(geoTranslocon, mats.amarre)
    canal.position.copy(pose)
    groupe2.add(canal)
  }

  const atelier2 = creerAtelier(NB_RIBOSOMES_2, alea, geos, mats, groupe2)

  // Le ribosome libre : même machine, même chaîne, mais rien pour l'amarrer.
  // Sa protéine restera dans le cytosol, et c'est toute la différence.
  const CENTRE_LIBRE = new THREE.Vector3(-0.075, 0.115, -0.085)
  const ANGLE_LIBRE = 0.38
  const brinLibre = new THREE.Mesh(
    new THREE.CylinderGeometry(RAYON_BRIN, RAYON_BRIN, 0.09, 6, 1, true),
    mats.brin,
  )
  brinLibre.rotation.z = Math.PI / 2
  const porteurLibre = new THREE.Group()
  // Le brin est incliné comme le ribosome qui le lit : ils partagent l'axe ex.
  porteurLibre.rotation.z = ANGLE_LIBRE
  porteurLibre.add(brinLibre)
  groupe2.add(porteurLibre)

  // Le tapis de ribosomes voisins : c'est lui qui rend la citerne « rugueuse ».
  const tapisGrande = new THREE.InstancedMesh(geos.grandeBrute, mats.grandeOpaque, NB_TAPIS)
  const tapisPetite = new THREE.InstancedMesh(geos.petiteBrute, mats.petite, NB_TAPIS)
  tapisGrande.frustumCulled = false
  tapisPetite.frustumCulled = false
  groupe2.add(tapisGrande, tapisPetite)
  let poses = 0
  for (let essai = 0; essai < NB_TAPIS * 4 && poses < NB_TAPIS; essai++) {
    const x = (alea() - 0.5) * (LARGEUR_MEMBRANE - 0.05)
    const z = (alea() - 0.5) * (PROFONDEUR_MEMBRANE - 0.05)
    // On dégage largement la zone de la démonstration : un voisin posé trop
    // près passerait pour un cinquième membre du polysome — mais sans chaîne,
    // puisqu'on ne suit celle que de quatre d'entre eux.
    if (Math.abs(x) < 0.17 && Math.abs(z) < 0.09) continue
    const h = hauteurMembrane(x, z)
    const inclinaison = (alea() - 0.5) * 0.5
    _axe.set(Math.cos(alea() * 6.283), 0, Math.sin(alea() * 6.283))
    _quat.setFromAxisAngle(_axe, inclinaison)
    _echelle.setScalar(0.9 + alea() * 0.2)
    // Grande sous-unité contre la membrane, petite au-dessus : ces voisins-là
    // sont amarrés eux aussi, et un ribosome amarré l'est toujours par sa
    // grande sous-unité, celle qui porte la sortie du tunnel.
    _position.set(x, h + HAUT_RIBOSOME_AMARRE - HAUT_GRANDE, z)
    _matrice.compose(_position, _quat, _echelle)
    tapisGrande.setMatrixAt(poses, _matrice)
    _position.set(x, h + HAUT_RIBOSOME_AMARRE - HAUT_PETITE, z)
    _matrice.compose(_position, _quat, _echelle)
    tapisPetite.setMatrixAt(poses, _matrice)
    poses++
  }
  tapisGrande.count = poses
  tapisPetite.count = poses
  tapisGrande.instanceMatrix.needsUpdate = true
  tapisPetite.instanceMatrix.needsUpdate = true

  // Des ribosomes qui viennent cogner la membrane et repartent : sans peptide
  // signal, rien ne les retient. La plupart des rencontres finissent ainsi.
  const candidatsGrande = new THREE.InstancedMesh(
    geos.grandeBrute,
    mats.grandeOpaque,
    NB_CANDIDATS,
  )
  const candidatsPetite = new THREE.InstancedMesh(geos.petiteBrute, mats.petite, NB_CANDIDATS)
  candidatsGrande.frustumCulled = false
  candidatsPetite.frustumCulled = false
  groupe2.add(candidatsGrande, candidatsPetite)
  const centresCandidats: THREE.Vector3[] = []
  const periodesCandidats = new Float32Array(NB_CANDIDATS)
  for (let i = 0; i < NB_CANDIDATS; i++) {
    centresCandidats.push(
      new THREE.Vector3(
        (alea() - 0.5) * 0.6,
        0.075 + alea() * 0.05,
        (alea() - 0.5) * 0.36,
      ),
    )
    periodesCandidats[i] = 9 + alea() * 11
  }
  const freqCandidats = new Float32Array(NB_CANDIDATS * 3 * NB_HARMONIQUES)
  const phasesCandidats = new Float32Array(freqCandidats.length)
  tirerErrance(alea, freqCandidats, phasesCandidats)

  // Les protéines de la lumière. Elles ne sont pas grossies : une protéine
  // globulaire de 300 acides aminés fait 5 nm, c'est un grain, et l'accumulation
  // se lit à leur NOMBRE, pas à leur taille.
  const proteines = new THREE.InstancedMesh(geos.proteine, mats.chaine, NB_PROTEINES)
  proteines.frustumCulled = false
  groupe2.add(proteines)
  const centresProteines: THREE.Vector3[] = []
  for (let i = NB_PROTEINES_NEUVES; i < NB_PROTEINES; i++) {
    const x = (alea() - 0.5) * (LARGEUR_MEMBRANE - 0.1)
    const z = (alea() - 0.5) * (PROFONDEUR_MEMBRANE - 0.1)
    centresProteines.push(
      new THREE.Vector3(x, hauteurMembrane(x, z) - 0.02 - alea() * 0.12, z),
    )
  }
  const freqProteines = new Float32Array(NB_PROTEINES * 3 * NB_HARMONIQUES)
  const phasesProteines = new Float32Array(freqProteines.length)
  tirerErrance(alea, freqProteines, phasesProteines)

  const animer2 = (temps: number): void => {
    for (let r = 0; r < NB_RIBOSOMES_2; r++) {
      poser(temps, r, NB_RIBOSOMES_2, etat)
      const pas = etat[0]!
      const p = etat[1]!
      const base = CHAINES_DEPART[r]! - RESIDUS_TUNNEL

      let presence: number
      let presenceChaine: number
      let longueur: number
      let fuite: number
      if (pas < CODONS_MONTRES) {
        presence = 1
        presenceChaine = 1
        longueur = base + pas + (p >= P_LIAISON ? 1 : 0)
        fuite = 0
      } else if (p < 0.5) {
        presence = 1 - lissage(p / 0.35)
        fuite = lissage(p / 0.5)
        presenceChaine = 1 - lissage((p - 0.15) / 0.35)
        longueur = base + CODONS_MONTRES
      } else {
        presence = lissage((p - 0.55) / 0.35)
        presenceChaine = presence
        longueur = base
        fuite = 0
      }

      const origine = atelier2.origines[r]!
      const ex = atelier2.ex[r]!
      const ey = atelier2.ey[r]!
      if (r < NB_AMARRES) {
        // Amarré : le tunnel de sortie pointe VERS LE BAS, dans le pore. Tout
        // le reste suit — la chaîne traverse la membrane sans qu'on ait à le
        // lui demander, parce que c'est par là qu'elle sort.
        const pose = posesAmarrees[r]!
        origine.set(pose.x, pose.y + HAUT_RIBOSOME_AMARRE, pose.z)
        ex.set(1, 0, 0)
        ey.set(0, -1, 0)
      } else {
        // Libre : il dérive dans le cytosol, tunnel vers le haut.
        derive(r, temps * 0.5, 0.02, atelier2.frequences, atelier2.phases, _errance)
        origine.copy(CENTRE_LIBRE).add(_errance)
        ex.set(Math.cos(ANGLE_LIBRE), Math.sin(ANGLE_LIBRE), 0)
        ey.set(-Math.sin(ANGLE_LIBRE), Math.cos(ANGLE_LIBRE), 0)
        porteurLibre.position.copy(origine)
      }
      atelier2.ez[r]!.crossVectors(ex, ey)

      animerRibosome(atelier2, r, temps, pas, p, presence, presenceChaine, longueur, fuite)
    }
    atelier2.arnt.instanceMatrix.needsUpdate = true
    atelier2.acides.instanceMatrix.needsUpdate = true
    atelier2.chaines.instanceMatrix.needsUpdate = true

    // Les protéines finies : celles qui descendent encore du pore, puis la
    // population déjà accumulée. La lumière du réticulum est pleine de produit.
    for (let i = 0; i < NB_PROTEINES; i++) {
      if (i < NB_PROTEINES_NEUVES) {
        const k = i % NB_AMARRES
        poser(temps, k, NB_RIBOSOMES_2, etat)
        // Âge depuis la dernière terminaison de ce translocon, en codons. Les
        // trois générations se relaient exactement, sans saut visible.
        let age = etat[0]! + etat[1]! - CODONS_MONTRES
        if (age < 0) age += PAS_CYCLE
        age += Math.floor(i / NB_AMARRES) * PAS_CYCLE
        const pose = posesAmarrees[k]!
        // La dérive est indexée sur l'ÂGE, pas sur le temps : c'est ce qui fait
        // qu'une génération reprend exactement là où la précédente s'arrête,
        // et que le défilé ne saute jamais.
        derive(k, age * 1.1, 0.012, freqProteines, phasesProteines, _errance)
        _position
          .set(pose.x, pose.y - 0.022 - age * 0.0026, pose.z)
          .add(_errance)
        _echelle.setScalar(lissage(age / 0.6) * (1 - lissage((age - 3 * PAS_CYCLE + 3) / 3)))
      } else {
        derive(i, temps * 0.3, 0.014, freqProteines, phasesProteines, _errance)
        _position.copy(centresProteines[i - NB_PROTEINES_NEUVES]!).add(_errance)
        _echelle.setScalar(1)
      }
      _matrice.compose(_position, _quatDroit, _echelle)
      proteines.setMatrixAt(i, _matrice)
    }
    proteines.instanceMatrix.needsUpdate = true
    _echelle.setScalar(1)

    // Les ribosomes qui cognent la membrane sans s'y fixer.
    for (let i = 0; i < NB_CANDIDATS; i++) {
      const centre = centresCandidats[i]!
      // Un plongeon vers la membrane, un contact, et il repart : rien ne
      // l'attend en bas, et rien ne le guide non plus.
      const q = (temps / periodesCandidats[i]! + i * 0.37) % 1
      const plongee = bosse(lissage(q * 3))
      derive(i, temps, 0.03, freqCandidats, phasesCandidats, _errance)
      _position.copy(centre).add(_errance)
      // Contact franc : au plus bas, la grande sous-unité effleure la bicouche.
      const sol = hauteurMembrane(_position.x, _position.z) + 0.015
      _position.y = centre.y + _errance.y + (sol - centre.y - _errance.y) * plongee
      _axe.set(0.3 + i * 0.4, 1, 0.2 - i * 0.3).normalize()
      _quat.setFromAxisAngle(_axe, temps * 0.12 + i)
      _matrice.compose(_position, _quat, _echelle)
      candidatsGrande.setMatrixAt(i, _matrice)
      _position.y += HAUT_GRANDE - HAUT_PETITE
      _matrice.compose(_position, _quat, _echelle)
      candidatsPetite.setMatrixAt(i, _matrice)
    }
    candidatsGrande.instanceMatrix.needsUpdate = true
    candidatsPetite.instanceMatrix.needsUpdate = true
  }

  // Les ARNt libres du cytosol, au-dessus de la membrane seulement : dans la
  // lumière il n'y en a pas, et c'est justement pour ça qu'on n'y traduit rien.
  const libres2 = new THREE.InstancedMesh(geos.arnt, mats.arntPale, NB_ARNT_LIBRES_2)
  libres2.frustumCulled = false
  groupe2.add(libres2)
  const centresLibres2: THREE.Vector3[] = []
  for (let i = 0; i < NB_ARNT_LIBRES_2; i++) {
    const x = (alea() - 0.5) * (LARGEUR_MEMBRANE - 0.1)
    const z = (alea() - 0.5) * (PROFONDEUR_MEMBRANE - 0.1)
    centresLibres2.push(
      new THREE.Vector3(x, hauteurMembrane(x, z) + 0.04 + alea() * 0.13, z),
    )
  }
  const freqLibres2 = new Float32Array(NB_ARNT_LIBRES_2 * 3 * NB_HARMONIQUES)
  const phasesLibres2 = new Float32Array(freqLibres2.length)
  tirerErrance(alea, freqLibres2, phasesLibres2)

  const animer2Complet = (temps: number): void => {
    animer2(temps)
    for (let i = 0; i < NB_ARNT_LIBRES_2; i++) {
      derive(i, temps, 0.04, freqLibres2, phasesLibres2, _errance)
      _position.copy(centresLibres2[i]!).add(_errance)
      _axe.copy(_errance).normalize()
      _quat.setFromUnitVectors(AXE_Y, _axe)
      _echelle.setScalar(1)
      _matrice.compose(_position, _quat, _echelle)
      libres2.setMatrixAt(i, _matrice)
    }
    libres2.instanceMatrix.needsUpdate = true
  }

  animer2Complet(0)
  groupe2.updateMatrixWorld(true)

  return [
    {
      cle: 'traduction-polysome',
      nom: 'Traduction : un polysome au travail',
      siege: 'Cytosol',
      ralentissement: 20,
      observable: {
        nom: 'arn-de-transfert',
        cycleReel: PAS_CYCLE * 0.17,
        pourquoi:
          "Les ARN de transfert bouclent avec le ribosome : douze codons traduits, " +
          "puis la relève. C'est ce cycle que le badge ralentit, et il dure treize " +
          'fois 170 ms dans le cytosol — la cadence du ribosome de mammifère.',
      },
      justificationFacteur:
        'Un ribosome de mammifère pose 5 à 6 acides aminés par seconde : un codon dure ' +
        '170 ms, qui deviennent 3,4 s à l’écran — un ralenti de 20. Une bactérie irait ' +
        'quatre fois plus vite.',
      ellision:
        'Douze codons seulement, puis le ribosome se défait et un autre repart en amont : ' +
        'une protéine de 300 acides aminés demanderait dix-sept minutes d’écran à ce ' +
        'ralenti. Le pas d’un codon est vrai — 0,9 nm, un trentième du ribosome — donc ' +
        'ce qui rend le cliquet lisible n’est pas la distance mais le RYTHME : trois ' +
        'secondes d’immobilité complète, puis tout d’un coup. La rotation des deux ' +
        'sous-unités est portée de 8° à 20°, et les résidus de la chaîne sont espacés de ' +
        '0,9 nm au lieu de 0,35, sans quoi l’ajout d’un acide aminé serait invisible. ' +
        'Les trente premiers résidus restent cachés dans le tunnel, comme en vrai. ' +
        'Trois à cinq rejets par codon est un minorant : il y en a souvent plus de dix. ' +
        'Les facteurs d’élongation eEF1A et eEF2, et le GTP qu’ils consomment, ne sont ' +
        'pas dessinés — à 1 nm ils ne feraient pas un pixel.',
      description:
        'Un ARNm n’est jamais lu par un seul ribosome, et il n’est jamais tendu : il est ' +
        'en pelote, sa coiffe tenue contre sa queue poly-A par eIF4G, et cinq ribosomes ' +
        'le parcourent en file — c’est un polysome. Chacun avance par cliquets discrets, ' +
        'un codon à la fois, et reste parfaitement immobile entre deux pas. Avant chaque ' +
        'pas, trois à cinq ARNt viennent percuter le ribosome et repartent, la plupart ' +
        'sans même tomber sur le site A : c’est cette accumulation de rejets, et rien ' +
        'd’autre, qui fait la fidélité de la traduction. Le bon ARNt cède son acide ' +
        'aminé, la liaison peptidique est formée par l’ARN ribosomique lui-même, les ' +
        'sous-unités pivotent, et la chaîne sort par le tunnel de dix nanomètres où elle ' +
        'commence déjà à se replier — le ribosome le plus avancé porte la plus longue.',
      objet: groupe1,
      ancre: ancre1,
      rayonCadrage: 0.3,
      couleur: TEINTES.ribosome,
      animer: animer1,
    },
    {
      cle: 'translocation-sec61',
      nom: 'Translocation dans le réticulum',
      siege: 'Réticulum endoplasmique rugueux',
      ralentissement: 20,
      justificationFacteur:
        'Même horloge que le polysome : 170 ms par codon, 3,4 s à l’écran, ralenti de 20. ' +
        'La chaîne traverse la membrane exactement au rythme où elle sort du tunnel.',
      ellision:
        'Le début manque : la reconnaissance du peptide signal par la SRP, l’arrêt ' +
        'momentané de la traduction et l’accostage au translocon ont déjà eu lieu quand ' +
        'la scène commence. Le clivage du peptide signal et le repliement assisté par ' +
        'les chaperons ne sont pas montrés non plus. Douze codons, puis on reprend — ' +
        'comme pour le polysome. Sur les cent cinquante ribosomes de ce fragment de ' +
        'membrane, on ne suit la chaîne que de quatre.',
      description:
        'Le même mécanisme, mais le ribosome est amarré à un canal Sec61 planté dans la ' +
        'membrane du réticulum : la chaîne qu’il fabrique ne part pas dans le cytosol, ' +
        'elle traverse la membrane à mesure qu’elle sort du tunnel et s’accumule dans la ' +
        'lumière, où elle rejoint les protéines déjà faites. C’est là, à ce canal, que ' +
        'se décide la différence entre une protéine cytosolique et une protéine destinée ' +
        'à l’export — le ribosome libre qui dérive au-dessus fait exactement le même ' +
        'travail, mais sa chaîne reste dehors. Trois autres ribosomes amarrés à côté ' +
        'font la même chose sur le même ARNm, et quelques-uns viennent cogner la ' +
        'membrane sans y trouver de canal et repartent : sans peptide signal, rien ne ' +
        'les retient.',
      objet: groupe2,
      ancre: groupe2.position.clone(),
      rayonCadrage: 0.3,
      couleur: TEINTES.reticulumRugueux,
      animer: animer2Complet,
    },
  ]
}
