import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import { RAYON_NOYAU, SIEGES, type Mecanisme } from './contrat.js'

/**
 * L'EXPORT DE L'ARN MESSAGER PAR LE PORE NUCLÉAIRE.
 *
 * Un seul pore, vu de très près. Trois choses que les animations de pore ratent
 * presque toujours, et qui sont ici le sujet même du plan :
 *
 * 1. LE CANAL N'EST PAS UN TROU. Il est bourré de nucléoporines FG, des chaînes
 *    protéiques désordonnées qui forment un hydrogel. Un cargo ne « passe » pas :
 *    il FOND dans le maillage par des milliers d'interactions transitoires, et
 *    c'est de là que viennent ses quelques millisecondes de temps de séjour.
 * 2. L'ARNm N'EST JAMAIS NU. Il sort empaqueté de protéines — un mRNP — et il
 *    doit se DÉPLIER pour entrer en file, tête la première, puis se replier.
 * 3. LA DIRECTIONNALITÉ N'EST PAS DANS LA MACHINE. Le pore est symétrique et
 *    passif ; c'est le gradient RanGTP (noyau) / RanGDP (cytosol) qui décide du
 *    sens. On voit donc RanGTP heurter l'importine et lui faire lâcher son cargo.
 *
 * Et surtout : aucune molécule ne sait où elle va. Les essais ratés sont
 * majoritaires — vingt-huit molécules abordent le pore et rebondissent pour
 * trois qui le franchissent.
 */

/* ── Le site : un point bien dégagé de l'enveloppe, du côté que la coupe garde ── */
const DIRECTION_SITE = new THREE.Vector3(0.8, 0.4, 0.45).normalize()
/** Le canal enjambe la membrane : l'origine locale est au milieu de l'enveloppe. */
const CENTRE_MONDE = SIEGES.noyau.clone().addScaledVector(DIRECTION_SITE, RAYON_NOYAU)

const AXE_Z = new THREE.Vector3(0, 0, 1)
const AXE_Y = new THREE.Vector3(0, 1, 0)
const ROTATION_NULLE = new THREE.Quaternion()

/* ── Géométrie du complexe, en micromètres. Tout est à l'échelle vraie. ────────
 * Repère local : +Z pointe vers le cytosol, -Z vers le nucléoplasme.
 */
/** La signature du complexe, comme l'ordre 9 l'est du centriole. */
const SYMETRIE = 8
/** Canal central : 40 nm de diamètre. */
const RAYON_CANAL = 0.02
/** Il se dilate jusqu'à 70 nm pour un mRNP : +15 nm de rayon. */
const DILATATION_MRNP = 0.015
/** Une importine fait 10 nm : le maillage doit s'ouvrir d'au moins autant. */
const DILATATION_CARGO = 0.009
/** Diamètre externe ~100 nm : rayon 0,042 + tube 0,008. */
const RAYON_ANNEAU = 0.042
const TUBE_ANNEAU = 0.008
/** Les deux anneaux coiffent l'enveloppe, épaisse de 40 nm. */
const Z_ANNEAU = 0.02
const RAYON_ANNEAU_INTERNE = 0.031
const RAYON_ANNEAU_DISTAL = 0.016
const Z_ANNEAU_DISTAL = -0.088
/** Une nucléoporine structurale est une corde de ~4 nm. */
const RAYON_FILAMENT = 0.0022
/** Une chaîne FG désordonnée est deux fois plus fine : ~2 nm. */
const RAYON_FG = 0.0011

/* ── L'hydrogel FG ─────────────────────────────────────────────────────────── */
/**
 * Cinq couronnes de huit ancrages : le maillage respecte l'ordre 8 du complexe.
 * Le vrai canal en compte environ deux cents ; à cette densité-là le cargo
 * disparaîtrait pendant ses deux secondes de traversée, c'est-à-dire pendant le
 * seul moment qui compte. Quarante chaînes suffisent à faire lire le bouchon.
 */
const NIVEAUX_FG = 5
const CHAINES_FG = NIVEAUX_FG * SYMETRIE
const SEGMENTS_FG = 6

/* ── Le mRNP ───────────────────────────────────────────────────────────────── */
/** Vingt-huit protéines d'emballage sur le brin : un mRNP n'est pas une bille. */
const BILLES_MRNP = 28
/** Écart entre billes, en fraction du chemin : 28 billes ≈ 190 nm déplié. */
const ECART_MRNP = 0.032
const CYCLE_MRNP = 18
const Z_ENTREE_MRNP = -0.115
const COURSE_MRNP = 0.22

/* ── Les navettes ──────────────────────────────────────────────────────────── */
const NB_IMPORTS = 3
const CYCLE_IMPORT = 12
/** Douze importines qui plongent dans le gel et ressortent bredouilles. */
const NB_ECHECS_SIGNAL = 12
/** Seize grosses molécules sans signal : elles butent sur la bouche du pore. */
const NB_ECHECS_INERTES = 16
const NB_RAN_AMBIANT = 6
const NB_RANGDP = 4

const GRAINE = 0x6d524e41

/* ── Temporaires hissés au module : animer() n'alloue rien. ──────────────────
 * poserSegment() écrit _direction, _rotation, _position, _echelle et _matrice :
 * ne jamais lui passer l'un d'eux comme extrémité.
 */
const _direction = new THREE.Vector3()
const _position = new THREE.Vector3()
const _rotation = new THREE.Quaternion()
const _echelle = new THREE.Vector3()
const _matrice = new THREE.Matrix4()
/** Extrémités des chaînes (gel, panier, filaments, liens du mRNP). */
const _noeudA = new THREE.Vector3()
const _noeudB = new THREE.Vector3()
/** Acteurs : mRNP, importine, cargo, Ran. Jamais partagés avec les chaînes. */
const _acteur = new THREE.Vector3()
const _acteurBis = new THREE.Vector3()
const _billePrecedente = new THREE.Vector3()
const _bille = new THREE.Vector3()

/**
 * Bruit brownien bon marché : trois sinusoïdes de fréquences incommensurables.
 * L'excursion typique est d'environ 0,6 — les amplitudes en tiennent compte.
 */
function bruit(t: number, phase: number): number {
  return (
    Math.sin(t * 2.13 + phase) * 0.55 +
    Math.sin(t * 5.31 + phase * 2.7) * 0.3 +
    Math.sin(t * 11.9 + phase * 4.1) * 0.15
  )
}

function poserBille(mesh: THREE.InstancedMesh, index: number, p: THREE.Vector3, rayon: number): void {
  _echelle.setScalar(rayon)
  _matrice.compose(p, ROTATION_NULLE, _echelle)
  mesh.setMatrixAt(index, _matrice)
}

/** Un segment tendu entre deux points, taillé dans un cylindre unitaire le long de Y. */
function poserSegment(
  mesh: THREE.InstancedMesh,
  index: number,
  a: THREE.Vector3,
  b: THREE.Vector3,
  rayon: number,
): void {
  _direction.subVectors(b, a)
  const longueur = _direction.length()
  if (longueur < 1e-7) {
    _echelle.setScalar(0)
    _matrice.compose(a, ROTATION_NULLE, _echelle)
    mesh.setMatrixAt(index, _matrice)
    return
  }
  _rotation.setFromUnitVectors(AXE_Y, _direction.divideScalar(longueur))
  _position.addVectors(a, b).multiplyScalar(0.5)
  _echelle.set(rayon, longueur, rayon)
  _matrice.compose(_position, _rotation, _echelle)
  mesh.setMatrixAt(index, _matrice)
}

/** Point du chemin du mRNP, du panier au cytosol. `s` est borné à [0, 1]. */
function pointChemin(s: number, cible: THREE.Vector3): THREE.Vector3 {
  const sc = s < 0 ? 0 : s > 1 ? 1 : s
  // Le canal n'est pas un tube rectiligne parfait : le brin serpente un peu.
  const r = 0.004 * Math.sin(sc * Math.PI)
  return cible.set(Math.cos(sc * 4) * r, Math.sin(sc * 4) * r, Z_ENTREE_MRNP + sc * COURSE_MRNP)
}

export function creerExportNucleaire(): Mecanisme[] {
  const alea = creerAlea(GRAINE)

  const groupe = new THREE.Group()
  groupe.name = 'export-nucleaire'
  groupe.position.copy(CENTRE_MONDE)
  // Le pore traverse la membrane perpendiculairement : son axe est la normale.
  groupe.quaternion.setFromUnitVectors(AXE_Z, DIRECTION_SITE)

  // Une seule teinte pour tout l'échafaudage : le pore est UNE machine, c'est le
  // relief qui sépare ses trente nucléoporines, pas la couleur.
  const matiereComplexe = materiauOrganite(TEINTES.proteineMembranaire)
  const matiereGel = materiauOrganite(TEINTES.cytosquelette)
  const matiereEmballage = materiauOrganite(TEINTES.noyau, { doubleFace: false })
  const matiereARN = materiauOrganite(TEINTES.chromatine, { doubleFace: false })
  const matiereImportine = materiauOrganite(TEINTES.golgi, { doubleFace: false })
  const matiereCargo = materiauOrganite(TEINTES.lysosome, { doubleFace: false })
  // RanGTP est légèrement émissif : c'est lui qu'il faut voir arriver.
  const matiereRanGTP = materiauOrganite(TEINTES.reticulumLisse, {
    doubleFace: false,
    emissif: 0x0a4034,
  })
  const matiereRanGDP = materiauOrganite(0x3f6b5c, { doubleFace: false })
  // Bleu-gris désaturé : « molécule inerte, mauvais signal ». Ne doit pas se
  // confondre avec le beige du gel FG.
  const matiereInerte = materiauOrganite(0x5c6b78, { doubleFace: false })

  const geoCorde = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true)
  const geoBille = new THREE.IcosahedronGeometry(1, 1)
  const geoGrain = new THREE.IcosahedronGeometry(1, 0)
  // L'importine β est un solénoïde allongé : elle enfile le canal dans sa longueur.
  const geoImportine = new THREE.IcosahedronGeometry(1, 1)
  geoImportine.scale(0.78, 0.78, 1.7)

  /* ── Échafaudage statique ───────────────────────────────────────────────── */
  const anneaux = new THREE.InstancedMesh(
    new THREE.TorusGeometry(RAYON_ANNEAU, TUBE_ANNEAU, 8, 24),
    matiereComplexe,
    2,
  )
  anneaux.name = 'anneaux-cytoplasmique-et-nucleoplasmique'
  _position.set(0, 0, Z_ANNEAU)
  _echelle.setScalar(1)
  anneaux.setMatrixAt(0, _matrice.compose(_position, ROTATION_NULLE, _echelle))
  _position.set(0, 0, -Z_ANNEAU)
  anneaux.setMatrixAt(1, _matrice.compose(_position, ROTATION_NULLE, _echelle))

  const anneauInterne = new THREE.Mesh(
    new THREE.TorusGeometry(RAYON_ANNEAU_INTERNE, 0.011, 8, 24),
    matiereComplexe,
  )
  anneauInterne.name = 'anneau-interne'

  const anneauDistal = new THREE.Mesh(
    new THREE.TorusGeometry(RAYON_ANNEAU_DISTAL, 0.004, 6, 18),
    matiereComplexe,
  )
  anneauDistal.name = 'anneau-distal-du-panier'
  anneauDistal.position.z = Z_ANNEAU_DISTAL

  // Trois couronnes de huit lobes : c'est cette répétition qui fait lire l'ordre 8.
  const sousUnites = new THREE.InstancedMesh(geoBille, matiereComplexe, SYMETRIE * 3)
  sousUnites.name = 'sous-unites-ordre-8'
  for (let j = 0; j < SYMETRIE; j++) {
    const angle = (j * Math.PI * 2) / SYMETRIE
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    _echelle.set(0.011, 0.011, 0.008)
    _position.set(cos * RAYON_ANNEAU, sin * RAYON_ANNEAU, Z_ANNEAU + 0.011)
    sousUnites.setMatrixAt(j, _matrice.compose(_position, ROTATION_NULLE, _echelle))
    _position.set(cos * RAYON_ANNEAU, sin * RAYON_ANNEAU, -Z_ANNEAU - 0.011)
    sousUnites.setMatrixAt(SYMETRIE + j, _matrice.compose(_position, ROTATION_NULLE, _echelle))
    // Les rayons : ils relient l'anneau interne à l'enveloppe.
    _echelle.set(0.008, 0.008, 0.014)
    _position.set(cos * RAYON_ANNEAU_INTERNE, sin * RAYON_ANNEAU_INTERNE, 0)
    sousUnites.setMatrixAt(2 * SYMETRIE + j, _matrice.compose(_position, ROTATION_NULLE, _echelle))
  }

  /* ── Pièces mobiles ─────────────────────────────────────────────────────── */
  const filamentsCyto = new THREE.InstancedMesh(geoCorde, matiereComplexe, SYMETRIE * 3)
  filamentsCyto.name = 'filaments-cytoplasmiques'

  const panier = new THREE.InstancedMesh(geoCorde, matiereComplexe, SYMETRIE * 3)
  panier.name = 'panier-nucleoplasmique'

  const gel = new THREE.InstancedMesh(geoCorde, matiereGel, CHAINES_FG * SEGMENTS_FG)
  gel.name = 'hydrogel-fg'

  const billesMrnp = new THREE.InstancedMesh(geoBille, matiereEmballage, BILLES_MRNP)
  billesMrnp.name = 'proteines-d-emballage-du-mrnp'
  const liensMrnp = new THREE.InstancedMesh(geoCorde, matiereARN, BILLES_MRNP - 1)
  liensMrnp.name = 'brin-d-arn-messager'

  const importines = new THREE.InstancedMesh(geoImportine, matiereImportine, NB_IMPORTS)
  importines.name = 'importines-en-transit'
  const cargos = new THREE.InstancedMesh(geoBille, matiereCargo, NB_IMPORTS)
  cargos.name = 'cargos-importes'
  const ranGTP = new THREE.InstancedMesh(geoGrain, matiereRanGTP, NB_IMPORTS + NB_RAN_AMBIANT)
  ranGTP.name = 'rangtp-nucleaire'
  const ranGDP = new THREE.InstancedMesh(geoGrain, matiereRanGDP, NB_RANGDP)
  ranGDP.name = 'rangdp-cytosolique'

  const echecsSignal = new THREE.InstancedMesh(geoImportine, matiereImportine, NB_ECHECS_SIGNAL)
  echecsSignal.name = 'essais-infructueux-avec-signal'
  const echecsInertes = new THREE.InstancedMesh(geoBille, matiereInerte, NB_ECHECS_INERTES)
  echecsInertes.name = 'molecules-refoulees-sans-signal'

  /* ── Semis déterministe des chaînes FG et des figurants ─────────────────── */
  const fgAngle = new Float32Array(CHAINES_FG)
  const fgZ = new Float32Array(CHAINES_FG)
  const fgPhase = new Float32Array(CHAINES_FG)
  const fgVrille = new Float32Array(CHAINES_FG)
  const fgPortee = new Float32Array(CHAINES_FG)
  const fgDerive = new Float32Array(CHAINES_FG)
  const fgAgitation = new Float32Array(CHAINES_FG)
  for (let n = 0; n < NIVEAUX_FG; n++) {
    // Les ancrages débordent le canal : les FG tapissent aussi les vestibules.
    const z = -0.028 + (n / (NIVEAUX_FG - 1)) * 0.056
    for (let j = 0; j < SYMETRIE; j++) {
      const c = n * SYMETRIE + j
      fgAngle[c] = (j * Math.PI * 2) / SYMETRIE + n * 0.42 + (alea() - 0.5) * 0.3
      fgZ[c] = z + (alea() - 0.5) * 0.006
      fgPhase[c] = alea() * 10
      fgVrille[c] = (alea() - 0.5) * 1.8
      // Un tiers seulement atteint l'axe : le bouchon est dense sans être plein.
      fgPortee[c] = 0.55 + alea() * 0.45
      fgDerive[c] = (alea() - 0.5) * 0.03
      fgAgitation[c] = 1.6 + alea() * 1.4
    }
  }

  // Décalages fixes des billes dans le paquet compact : le mRNP se replie
  // toujours de la même façon, ce n'est pas une pelote refaite à chaque tour.
  const paquetX = new Float32Array(BILLES_MRNP)
  const paquetY = new Float32Array(BILLES_MRNP)
  const paquetZ = new Float32Array(BILLES_MRNP)
  for (let i = 0; i < BILLES_MRNP; i++) {
    // Un mRNP compact fait 30 à 50 nm : la pelote tient dans 22 nm de rayon.
    const u = alea() * 2 - 1
    const theta = alea() * Math.PI * 2
    const r = 0.022 * Math.cbrt(alea())
    const s = Math.sqrt(1 - u * u)
    paquetX[i] = r * s * Math.cos(theta)
    paquetY[i] = r * s * Math.sin(theta)
    paquetZ[i] = r * u
  }

  const echecPhase = new Float32Array(NB_ECHECS_SIGNAL)
  const echecPeriode = new Float32Array(NB_ECHECS_SIGNAL)
  const echecProfondeur = new Float32Array(NB_ECHECS_SIGNAL)
  const echecCote = new Float32Array(NB_ECHECS_SIGNAL)
  for (let i = 0; i < NB_ECHECS_SIGNAL; i++) {
    echecPhase[i] = alea() * 12
    // Périodes volontairement non commensurables avec les cycles principaux,
    // sinon toute la scène se met à battre à l'unisson.
    echecPeriode[i] = 3.4 + alea() * 3.8
    // Ils s'enfoncent dans le gel — jamais au-delà : le pore les recrache.
    echecProfondeur[i] = 0.002 + alea() * 0.014
    echecCote[i] = i % 3 === 0 ? -1 : 1
  }

  const inertePhase = new Float32Array(NB_ECHECS_INERTES)
  const inerteCote = new Float32Array(NB_ECHECS_INERTES)
  const inerteVitesse = new Float32Array(NB_ECHECS_INERTES)
  for (let i = 0; i < NB_ECHECS_INERTES; i++) {
    inertePhase[i] = alea() * 12
    inerteCote[i] = i % 5 === 0 ? -1 : 1
    inerteVitesse[i] = 0.55 + alea() * 0.7
  }

  const ranBase = new Float32Array(NB_RAN_AMBIANT * 3)
  for (let i = 0; i < NB_RAN_AMBIANT; i++) {
    ranBase[i * 3] = (alea() - 0.5) * 0.13
    ranBase[i * 3 + 1] = (alea() - 0.5) * 0.13
    // RanGTP n'existe QUE dans le noyau : tous ces grains sont en Z négatif.
    ranBase[i * 3 + 2] = -0.055 - alea() * 0.095
  }
  const gdpBase = new Float32Array(NB_RANGDP * 3)
  for (let i = 0; i < NB_RANGDP; i++) {
    gdpBase[i * 3] = (alea() - 0.5) * 0.13
    gdpBase[i * 3 + 1] = (alea() - 0.5) * 0.13
    gdpBase[i * 3 + 2] = 0.055 + alea() * 0.085
  }

  /** Toutes les pièces dont la matrice est réécrite à chaque image. */
  const mobiles: THREE.InstancedMesh[] = [
    filamentsCyto,
    panier,
    gel,
    billesMrnp,
    liensMrnp,
    importines,
    cargos,
    ranGTP,
    ranGDP,
    echecsSignal,
    echecsInertes,
  ]

  /* ── État de dilatation du canal, remis à zéro à chaque image ───────────── */
  let dilatZmrnp = 999
  let dilatRmrnp = 0
  let dilatZcargo = 999
  let dilatRcargo = 0

  /** De combien le maillage FG s'écarte de l'axe à la hauteur `z`. */
  const ecartement = (z: number): number => {
    let e = 0
    if (dilatRmrnp > 0) {
      const d = (z - dilatZmrnp) / 0.03
      e = dilatRmrnp * Math.exp(-d * d)
    }
    if (dilatRcargo > 0) {
      const d = (z - dilatZcargo) / 0.01
      const f = dilatRcargo * Math.exp(-d * d)
      if (f > e) e = f
    }
    return e
  }

  const animer = (temps: number): void => {
    // 1. Toujours purger la dilatation : sinon le canal reste ouvert à 70 nm
    //    pour l'éternité après le passage du premier cargo.
    dilatZmrnp = 999
    dilatRmrnp = 0
    dilatZcargo = 999
    dilatRcargo = 0

    /* ── 2. LE mRNP : il se déplie, traverse en file, puis se replie ─────── */
    const tm = temps % CYCLE_MRNP
    let teteM: number
    let eloignement: number
    if (tm < 4.5) {
      // Il erre dans le nucléoplasme et s'approche du panier sans le viser.
      teteM = -0.35
      eloignement = 0.05 * (1 - tm / 4.5) * (0.55 + 0.45 * bruit(tm * 0.9, 7.1)) + 0.014
    } else if (tm < 6) {
      // Happé par le panier : les premières billes s'alignent.
      const u = (tm - 4.5) / 1.5
      teteM = -0.35 + u * 0.45
      eloignement = 0.014 * (1 - u)
    } else if (tm < 14.5) {
      // Translocation : marche au hasard biaisée, avec des reculs visibles.
      const u = (tm - 6) / 8.5
      teteM = 0.1 + u * 1.35 + Math.sin(tm * 4.3) * 0.022
      eloignement = 0
    } else if (tm < 17) {
      const u = (tm - 14.5) / 2.5
      teteM = 1.45 + u * 0.9
      eloignement = 0
    } else {
      teteM = 2.35
      eloignement = 0
    }

    // Centres des deux paquets : un mRNP est compact avant ET après, jamais entre.
    const largeurErrance = 0.045 * (eloignement / 0.064 + 0.18)
    _acteur.set(
      bruit(tm * 1.1, 1.3) * largeurErrance,
      bruit(tm * 1.1, 3.9) * largeurErrance,
      Z_ENTREE_MRNP - eloignement,
    )
    const deriveSortie = Math.max(0, tm - 15.5) * 0.03
    _acteurBis.set(
      bruit(tm * 1.0, 5.7) * (0.014 + deriveSortie),
      bruit(tm * 1.0, 8.2) * (0.014 + deriveSortie),
      Z_ENTREE_MRNP + COURSE_MRNP + 0.016 + deriveSortie,
    )

    // Le paquet en travers du canal le force à 70 nm : c'est LA raison pour
    // laquelle le mRNP met cinquante fois plus de temps qu'une importine.
    if (teteM > -0.05 && teteM < 2.3) {
      dilatZmrnp = 0
      dilatRmrnp = DILATATION_MRNP * Math.min(1, Math.min(teteM + 0.05, 2.3 - teteM) * 5)
    }

    const apparitionM = Math.min(1, Math.min(tm, CYCLE_MRNP - tm) / 0.7)
    for (let i = 0; i < BILLES_MRNP; i++) {
      const s = teteM - i * ECART_MRNP
      pointChemin(s, _bille)
      if (s < 0) {
        // Encore dans la pelote nucléaire : plus la bille est loin de son tour,
        // plus elle est enfouie dans le paquet.
        const g = Math.min(1, -s / 0.3)
        _bille.x += (_acteur.x + paquetX[i]! - _bille.x) * g
        _bille.y += (_acteur.y + paquetY[i]! - _bille.y) * g
        _bille.z += (_acteur.z + paquetZ[i]! - _bille.z) * g
      } else if (s > 1) {
        const g = Math.min(1, (s - 1) / 0.3)
        _bille.x += (_acteurBis.x + paquetX[i]! - _bille.x) * g
        _bille.y += (_acteurBis.y + paquetY[i]! - _bille.y) * g
        _bille.z += (_acteurBis.z + paquetZ[i]! - _bille.z) * g
      } else {
        // En file dans le canal : elle est secouée par le gel qu'elle traverse.
        _bille.x += bruit(temps * 2.6, i * 1.7) * 0.005
        _bille.y += bruit(temps * 2.6, i * 1.7 + 3.1) * 0.005
        _bille.z += bruit(temps * 3.1, i * 2.3) * 0.004
      }
      poserBille(billesMrnp, i, _bille, 0.004 * apparitionM)
      if (i > 0) poserSegment(liensMrnp, i - 1, _billePrecedente, _bille, 0.0012 * apparitionM)
      _billePrecedente.copy(_bille)
    }

    /* ── 3. IMPORT : importine + cargo entrent, RanGTP les sépare ────────── */
    for (let k = 0; k < NB_IMPORTS; k++) {
      const g = k * 2.71 + 0.4
      const te = (temps + k * (CYCLE_IMPORT / NB_IMPORTS)) % CYCLE_IMPORT
      let zi: number
      let ri: number
      if (te < 3.2) {
        // Errance cytosolique. Elle ne vise pas le pore : elle le rencontre.
        const u = te / 3.2
        zi = 0.105 - u * 0.055 + bruit(temps * 1.3, g + 1.1) * 0.022
        ri = 0.055 - u * 0.02 + bruit(temps * 1.1, g + 3.3) * 0.02
      } else if (te < 4) {
        // Accrochée par un filament cytoplasmique, elle glisse vers la bouche.
        const u = (te - 3.2) / 0.8
        zi = 0.05 - u * 0.026 + bruit(temps * 2, g + 1.1) * 0.007 * (1 - u)
        ri = 0.035 - u * 0.026 + bruit(temps * 1.7, g + 3.3) * 0.007 * (1 - u)
      } else if (te < 6) {
        // Dans le gel : deux secondes d'écran pour dix millisecondes réelles.
        const u = (te - 4) / 2
        zi = 0.024 - u * 0.048 + Math.sin(te * 9.1 + g) * 0.006
        ri = 0.009 + bruit(temps * 3.4, g + 2.2) * 0.008
        dilatZcargo = zi
        dilatRcargo = DILATATION_CARGO
      } else if (te < 7.6) {
        const u = (te - 6) / 1.6
        zi = -0.026 - u * 0.03 + bruit(temps * 1.4, g + 1.1) * 0.012
        ri = 0.01 + u * 0.016 + bruit(temps * 1.2, g + 3.3) * 0.014
      } else if (te < 9.2) {
        // RanGTP est fixé, le cargo est lâché ; la navette revient vers le pore.
        const u = (te - 7.6) / 1.6
        zi = -0.056 + u * 0.028 + bruit(temps * 1.4, g + 1.1) * 0.01 * (1 - u)
        ri = 0.026 - u * 0.016 + bruit(temps * 1.2, g + 3.3) * 0.012
      } else if (te < 11) {
        // Recyclage : l'importine ressort, toujours chargée de son RanGTP.
        const u = (te - 9.2) / 1.8
        zi = -0.028 + u * 0.075 + Math.sin(te * 8.3 + g) * 0.005
        ri = 0.01 + Math.max(0, u - 0.6) * 0.05 + bruit(temps * 3, g + 2.2) * 0.006
        if (u > 0.15 && u < 0.7) {
          dilatZcargo = zi
          dilatRcargo = DILATATION_CARGO
        }
      } else {
        const u = te - 11
        zi = 0.047 + u * 0.035
        ri = 0.03 + u * 0.025
      }

      const ai = g * 2.1 + bruit(temps * 0.45, g) * 1.5
      const echelleI = Math.min(1, te / 0.5) * Math.min(1, (CYCLE_IMPORT - te) / 1)
      _acteur.set(Math.cos(ai) * ri, Math.sin(ai) * ri, zi)
      poserBille(importines, k, _acteur, 0.005 * echelleI)

      // Le cargo : accroché jusqu'à la rencontre avec RanGTP, libre ensuite.
      if (te < 7.6) {
        _acteurBis.set(
          _acteur.x + Math.cos(ai + 1.9) * 0.007,
          _acteur.y + Math.sin(ai + 1.9) * 0.007,
          _acteur.z - 0.002,
        )
        poserBille(cargos, k, _acteurBis, 0.005 * echelleI)
      } else {
        const u = (te - 7.6) / 3.4
        const rc = 0.026 + u * 0.032 + bruit(temps * 1, g + 9.1) * 0.016
        const ac = ai + 0.9 + bruit(temps * 0.6, g + 6.1) * 1.1
        _acteurBis.set(
          Math.cos(ac) * rc,
          Math.sin(ac) * rc,
          -0.056 - u * 0.055 + bruit(temps * 1.2, g + 7.7) * 0.014,
        )
        poserBille(cargos, k, _acteurBis, 0.005 * Math.max(0, Math.min(1, (11 - te) / 1.2)))
      }

      // RanGTP : il n'escorte rien, il percute. Sa fixation est la seule chose
      // qui rende l'import unidirectionnel — le pore, lui, est symétrique.
      if (te < 5.8 || te > 11.4) {
        poserBille(ranGTP, k, _acteur, 0)
      } else if (te < 7.6) {
        const u = (te - 5.8) / 1.8
        const d = (1 - u) * (1 - u) * 0.06
        _acteurBis.set(
          _acteur.x + bruit(temps * 2.2, g + 11.3) * d * 1.6,
          _acteur.y + bruit(temps * 2, g + 12.5) * d * 1.6,
          _acteur.z - d * 0.7 + bruit(temps * 2.4, g + 13.9) * d,
        )
        poserBille(ranGTP, k, _acteurBis, 0.0018 * Math.min(1, (te - 5.8) / 0.35))
      } else {
        _acteurBis.set(
          _acteur.x + Math.cos(ai - 1.6) * 0.0062,
          _acteur.y + Math.sin(ai - 1.6) * 0.0062,
          _acteur.z + 0.002,
        )
        poserBille(ranGTP, k, _acteurBis, 0.0018 * Math.min(1, (11.4 - te) / 0.4))
      }
    }

    /* ── 4. L'hydrogel FG. Il lit la dilatation calculée juste au-dessus. ── */
    const rAncre = RAYON_CANAL + 0.003
    for (let c = 0; c < CHAINES_FG; c++) {
      const phase = fgPhase[c]!
      const agitation = fgAgitation[c]!
      const zAncre = fgZ[c]!
      const angleAncre = fgAngle[c]!
      const vrille = fgVrille[c]!
      const portee = fgPortee[c]!
      const derive = fgDerive[c]!
      const base = c * SEGMENTS_FG
      for (let n = 0; n <= SEGMENTS_FG; n++) {
        const u = n / SEGMENTS_FG
        const b1 = bruit(temps * agitation + u * 3.4, phase)
        const b2 = bruit(temps * agitation + u * 3.4, phase + 2.4)
        const z = zAncre + derive * u + b1 * 0.02 * u
        // La chaîne plonge vers l'axe — sauf si un cargo écarte le maillage.
        let r = rAncre * (1 - portee * u) + ecartement(z) * u
        r += b2 * 0.006 * u
        if (r < 0.0008) r = 0.0008
        const angle = angleAncre + vrille * u + b1 * 0.9 * u
        _noeudB.set(Math.cos(angle) * r, Math.sin(angle) * r, z)
        if (n > 0) poserSegment(gel, base + n - 1, _noeudA, _noeudB, RAYON_FG)
        _noeudA.copy(_noeudB)
      }
    }

    /* ── 5. Filaments cytoplasmiques et panier : ils remuent, ils pêchent ── */
    for (let j = 0; j < SYMETRIE; j++) {
      const angle = (j * Math.PI * 2) / SYMETRIE
      const ph = j * 1.37

      _noeudA.set(Math.cos(angle) * 0.038, Math.sin(angle) * 0.038, Z_ANNEAU + 0.006)
      for (let n = 1; n <= 3; n++) {
        const u = n / 3
        const ondule = bruit(temps * 1.5, ph + n) * 0.016 * u
        const a = angle + bruit(temps * 1.2, ph + n * 2.1) * 0.5 * u
        const r = 0.04 + u * 0.012 + ondule
        _noeudB.set(Math.cos(a) * r, Math.sin(a) * r, Z_ANNEAU + 0.006 + u * 0.056 + ondule * 0.5)
        poserSegment(filamentsCyto, j * 3 + n - 1, _noeudA, _noeudB, RAYON_FILAMENT)
        _noeudA.copy(_noeudB)
      }

      // Le panier s'écarte lui aussi quand le mRNP le franchit.
      _noeudA.set(Math.cos(angle) * 0.036, Math.sin(angle) * 0.036, -Z_ANNEAU - 0.006)
      for (let n = 1; n <= 3; n++) {
        const u = n / 3
        const z = -Z_ANNEAU - 0.006 + u * (Z_ANNEAU_DISTAL + Z_ANNEAU + 0.006)
        const r =
          0.036 + (RAYON_ANNEAU_DISTAL - 0.036) * u +
          ecartement(z) * 0.4 +
          bruit(temps * 1.1, ph + n * 1.6) * 0.004 * u
        const a = angle + 0.34 * u + bruit(temps * 0.9, ph + n) * 0.2 * u
        _noeudB.set(Math.cos(a) * r, Math.sin(a) * r, z)
        poserSegment(panier, j * 3 + n - 1, _noeudA, _noeudB, RAYON_FILAMENT)
        _noeudA.copy(_noeudB)
      }
    }

    /* ── 6. LES ÉCHECS. Ils sont la majorité, et c'est le sujet. ─────────── */
    for (let i = 0; i < NB_ECHECS_SIGNAL; i++) {
      const ph = echecPhase[i]!
      const periode = echecPeriode[i]!
      const cote = echecCote[i]!
      const frac = ((temps + ph) % periode) / periode
      // Une plongée par cycle : elle s'enfonce dans le gel, hésite, ressort.
      const plongee = frac < 0.45 ? Math.sin((frac / 0.45) * Math.PI) : 0
      const a = ph * 6.28 + bruit(temps * 0.35, ph * 3.1) * 1.4
      const r =
        (0.034 + bruit(temps * 0.95, ph + 1.7) * 0.012) * (1 - plongee * 0.78) + plongee * 0.004
      const z =
        cote * (0.05 - plongee * (0.05 + echecProfondeur[i]!)) +
        bruit(temps * 1.15, ph + 4.4) * 0.01 * (1 - plongee * 0.85)
      _acteur.set(Math.cos(a) * r, Math.sin(a) * r, z)
      poserBille(echecsSignal, i, _acteur, 0.005)
    }

    for (let i = 0; i < NB_ECHECS_INERTES; i++) {
      const ph = inertePhase[i]!
      const cote = inerteCote[i]!
      const v = inerteVitesse[i]!
      _acteur.set(
        bruit(temps * v, ph) * 0.075,
        bruit(temps * v, ph + 2.3) * 0.075,
        cote * 0.055 + bruit(temps * v * 0.85, ph + 5.1) * 0.05,
      )
      // Sans signal d'adressage, rien de gros n'entre : la molécule bute sur la
      // bouche et repart. Le pore est un filtre, pas une porte ouverte.
      const r = Math.sqrt(_acteur.x * _acteur.x + _acteur.y * _acteur.y)
      if (cote * _acteur.z < 0.028 && r < 0.027) {
        if (0.027 - r < 0.028 - cote * _acteur.z && r > 1e-6) {
          const k = 0.027 / r
          _acteur.x *= k
          _acteur.y *= k
        } else {
          _acteur.z = cote * 0.028
        }
      }
      poserBille(echecsInertes, i, _acteur, 0.0045)
    }

    /* ── 7. Le gradient Ran, la vraie source de la directionnalité ───────── */
    for (let i = 0; i < NB_RAN_AMBIANT; i++) {
      _acteur.set(
        ranBase[i * 3]! + bruit(temps * 0.9, i * 2.9) * 0.035,
        ranBase[i * 3 + 1]! + bruit(temps * 0.9, i * 2.9 + 2.1) * 0.035,
        Math.min(-0.04, ranBase[i * 3 + 2]! + bruit(temps * 0.9, i * 2.9 + 4.3) * 0.03),
      )
      poserBille(ranGTP, NB_IMPORTS + i, _acteur, 0.0018)
    }
    for (let i = 0; i < NB_RANGDP; i++) {
      _acteur.set(
        gdpBase[i * 3]! + bruit(temps * 0.9, i * 3.7 + 1.1) * 0.035,
        gdpBase[i * 3 + 1]! + bruit(temps * 0.9, i * 3.7 + 3.3) * 0.035,
        Math.max(0.04, gdpBase[i * 3 + 2]! + bruit(temps * 0.9, i * 3.7 + 5.5) * 0.03),
      )
      poserBille(ranGDP, i, _acteur, 0.0018)
    }

    for (let m = 0; m < mobiles.length; m++) mobiles[m]!.instanceMatrix.needsUpdate = true
  }

  groupe.add(anneaux, anneauInterne, anneauDistal, sousUnites)
  for (const piece of mobiles) groupe.add(piece)
  for (const piece of [anneaux, sousUnites, ...mobiles]) {
    piece.instanceMatrix.needsUpdate = true
    // Les pièces mesurent 2 à 100 nm et bougent à chaque image : sans quoi le
    // tronc de vision les juge sur une bulle grosse comme l'une d'entre elles.
    piece.frustumCulled = false
  }

  animer(0)

  return [
    {
      cle: 'export-nucleaire',
      nom: "Export de l'ARN messager",
      siege: 'Enveloppe nucléaire',
      facteur: 'ralenti ×200',
      justificationFacteur:
        "Une importine reconnue franchit le pore en moins de dix millisecondes : à ×200 " +
        "la traversée dure deux secondes, juste au-dessus du seuil où l'œil décroche. Le " +
        "mRNP, lui, met 50 à 350 ms, soit dix à soixante-dix secondes à l'écran — c'est " +
        "pourquoi il reste si longtemps en travers du canal alors que les navettes le " +
        "doublent. Attention : c'est un RALENTI, à l'inverse du trafic vésiculaire qui est " +
        "accéléré ×100. Les deux plans sont dans la même cellule et n'ont pas la même " +
        "horloge : d'où le badge, propre à chaque mécanisme.",
      ellision:
        "Un noyau porte des milliers de pores et chacun laisse passer plusieurs centaines " +
        "de molécules par seconde ; on en montre un seul, et une trentaine de molécules. " +
        "Les trente nucléoporines différentes sont dessinées comme une seule famille — " +
        "seul le relief les sépare. Le maillage FG est réduit à quarante chaînes au lieu " +
        "de deux cents environ, sans quoi on ne verrait plus rien traverser. Enfin " +
        "l'hydrolyse du RanGTP côté cytosol, qui recharge le gradient, n'est pas montrée.",
      description:
        "Le canal du pore n'est pas un trou : il est bourré de nucléoporines FG, des " +
        "chaînes protéiques désordonnées qui forment un hydrogel. Un cargo ne franchit " +
        "rien, il FOND dedans par interactions transitoires — d'où les 2,5 ms de séjour de " +
        "l'importine β et les 7,1 ms de la transportine. L'ARN messager, lui, n'est jamais " +
        "nu : empaqueté de protéines en mRNP, il doit se déplier pour entrer en file, tête " +
        "la première, et le canal se dilate de 40 à 70 nm sur son passage. Le pore lui-même " +
        "est symétrique et passif : la directionnalité vient du gradient RanGTP nucléaire / " +
        "RanGDP cytosolique, et c'est bien RanGTP qu'on voit percuter l'importine et lui " +
        "faire lâcher son cargo. Tout autour, des molécules abordent le pore et repartent : " +
        "les essais infructueux sont l'immense majorité.",
      chiffres: [
        { valeur: '2,5 ms', quoi: "temps de séjour de l'importine β dans le canal" },
        { valeur: '5,8 ms', quoi: 'pour NTF2, 7,1 ms pour la transportine' },
        { valeur: '50 à 350 ms', quoi: "pour un mRNP entier, cinquante fois plus lent" },
        { valeur: '40 → 70 nm', quoi: 'canal central, dilatable pour les gros cargos' },
        { valeur: 'des centaines', quoi: 'de molécules par seconde et par pore' },
        { valeur: '~30', quoi: 'nucléoporines différentes, en huit exemplaires chacune' },
      ],
      objet: groupe,
      ancre: CENTRE_MONDE.clone(),
      // De quoi tenir le panier (−0,17) et l'errance cytosolique (+0,14).
      rayonCadrage: 0.22,
      couleur: TEINTES.proteineMembranaire,
      animer,
    },
  ]
}
