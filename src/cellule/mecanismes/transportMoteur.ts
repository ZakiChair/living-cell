import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import { SIEGES, type Mecanisme } from './contrat.js'

/**
 * TRANSPORT PAR MOTEURS MOLÉCULAIRES, et INSTABILITÉ DYNAMIQUE DU MICROTUBULE.
 *
 * Deux mécanismes, parce que deux horloges. La kinésine fait cent pas par
 * seconde ; un microtubule pousse d'un micromètre par minute. Un seul facteur ne
 * peut pas rendre les deux : à ralenti ×100 la croissance du tube serait figée,
 * et à l'accéléré qui la rend visible le pas de la kinésine tiendrait dans un
 * dixième d'image. Ils partagent la même biologie mais pas le même badge.
 *
 * Budget d'instances : 2 912 tubulines sur le rail (13 × 112 dimères, α et β)
 * + 1 248 sur l'extrémité plus (13 × 48) + 13 capuchons + 160 dimères libres
 * = 4 333. Les moteurs sont des maillages ordinaires : cinq acteurs qu'on suit à
 * l'œil valent mieux qu'une nuée qu'on ne lit pas.
 *
 * Le hasard est figé : la démonstration est la même à chaque chargement.
 */

const GRAINE = 813_477

// ── Géométrie vraie du microtubule ─────────────────────────────────────────
/** Treize protofilaments : c'est le nombre du microtubule cytoplasmique. */
const NB_PROTOFILAMENTS = 13
/** Une tubuline α ou β mesure 4 nm sur l'axe, le dimère αβ en fait 8. */
const PAS_MONOMERE = 0.004
const PAS_DIMERE = PAS_MONOMERE * 2
/** Rayon de l'âme lisse : 24 nm de diamètre, la vraie mesure. */
const RAYON_AME = 0.0122
/** Centre des tubulines, posées en relief sur l'âme. */
const RAYON_RESEAU = 0.0130
const RAYON_MONOMERE = 0.0028
/**
 * Réseau B : en faisant le tour des treize protofilaments on monte de trois
 * monomères, d'où l'hélice à trois départs. Le raccord entre le protofilament 12
 * et le 0 est la COUTURE du réseau — un vrai défaut du microtubule, pas un
 * modulo oublié : elle se voit comme un ressaut hélicoïdal.
 */
const DECALAGE_HELICE = (3 * PAS_MONOMERE) / NB_PROTOFILAMENTS
/** Hauteur où un pied de moteur se pose, juste au-dessus des tubulines. */
const RAYON_PIED = RAYON_RESEAU + RAYON_MONOMERE + 0.0020

const COS_PROTO = new Float32Array(NB_PROTOFILAMENTS)
const SIN_PROTO = new Float32Array(NB_PROTOFILAMENTS)
for (let p = 0; p < NB_PROTOFILAMENTS; p++) {
  const angle = (p / NB_PROTOFILAMENTS) * Math.PI * 2
  COS_PROTO[p] = Math.cos(angle)
  SIN_PROTO[p] = Math.sin(angle)
}

// ── Tracé des trois microtubules ───────────────────────────────────────────
const RAYON_DEPART = 3.2
const RAYON_ARRIVEE = 8.5
const LONGUEUR_TUBE = RAYON_ARRIVEE - RAYON_DEPART

/** Fenêtre de démonstration du transport : 112 dimères, soit 0,896 µm de rail. */
const NB_DIMERES_RAIL = 112
const Y_RAIL = 2.4
const LONGUEUR_RAIL = NB_DIMERES_RAIL * PAS_DIMERE

/** Fenêtre de l'extrémité plus : 48 dimères, soit 0,384 µm de course. */
const NB_DIMERES_POINTE = 48
const Y_POINTE = LONGUEUR_TUBE - NB_DIMERES_POINTE * PAS_DIMERE

// ── Moteurs ────────────────────────────────────────────────────────────────
/**
 * Un cycle de kinésine : 10 ms réelles, une seconde à l'écran. Une tentative sur
 * trois échoue — la tête libre cherche son site en diffusant — donc le cycle est
 * un peu plus court pour que les pas PRODUCTIFS restent à cent par seconde.
 */
const CYCLE_KINESINE = 0.62
const CYCLE_DYNEINE = 0.9
/** Part du cycle occupée par le balancement de la tête ; le reste est l'attente. */
const PART_BALANCEMENT = 0.28
const ECHEC_KINESINE = 0.35
const ECHEC_DYNEINE = 0.45
/**
 * Rayon dans lequel un moteur décroché reste confiné.
 *
 * Sans confinement il s'en va pour de bon : la cible à retrouver fait 30 nm de
 * large et sa promenade balaie le micromètre, si bien qu'il passait les deux
 * tiers du temps perdu hors du cadre. Le confinement est une licence — dans la
 * cellule, ce n'est pas la MÊME molécule qui revient, c'en est une autre du
 * millier qui traînent là.
 */
const RAYON_LIBRE = 0.07
/** Le moteur décroché est plus lourd que la tubuline : il gigote moins vite. */
const IMPULSION_MOTEUR = 1.1

// ── Extrémité plus ─────────────────────────────────────────────────────────
/**
 * Attention au facteur treize : un dimère ajouté n'allonge qu'UN protofilament
 * sur treize. Pour que le bout avance de 0,09 µm/s à l'écran — 1,8 µm/min réels
 * une fois divisé par le facteur trois — il faut 146 ajouts par seconde.
 */
const TAUX_POLYMERISATION = 146
/** 1 380 retraits/s = 0,85 µm/s d'écran = 17 µm/min réels : dix fois plus vite. */
const TAUX_DEPOLYMERISATION = 1380
/** Le dimère qui s'ajoute est celui qui se trouvait le plus près, pas un élu. */
const RAYON_CAPTURE = 0.05
const NB_TUBULINES_LIBRES = 160
const RAYON_NUAGE = 0.24
/** Réglé pour qu'un dimère libre traverse le nuage en deux secondes environ. */
const IMPULSION_BROWNIENNE = 3.0

// ── Temporaires, hissés hors des boucles d'animation ───────────────────────
const _position = new THREE.Vector3()
const _direction = new THREE.Vector3()
const _echelle = new THREE.Vector3(1, 1, 1)
const _quaternion = new THREE.Quaternion()
const _matrice = new THREE.Matrix4()
const _quatIdentite = new THREE.Quaternion()
const _axeY = new THREE.Vector3(0, 1, 0)

/** Cylindre unité couché sur Y : les membres s'allongent par leur seule échelle Y. */
function geometrieMembre(rayon: number): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(rayon, rayon, 1, 5, 1, true)
}

/**
 * Tend un membre entre deux points exprimés dans le repère du moteur.
 *
 * C'est ce qui rend le pas lisible : la jambe suit vraiment la tête qui se
 * balance, au lieu de rester une pièce rigide qui glisse.
 */
function tendreMembre(
  membre: THREE.Mesh,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): void {
  membre.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
  _direction.set(bx - ax, by - ay, bz - az)
  const longueur = Math.max(_direction.length(), 1e-5)
  _direction.divideScalar(longueur)
  _quaternion.setFromUnitVectors(_axeY, _direction)
  membre.quaternion.copy(_quaternion)
  membre.scale.set(1, longueur, 1)
}

/** Pose une tubuline du réseau. `debordement` sert à écarter les protofilaments. */
function poserTubuline(
  cible: THREE.InstancedMesh,
  index: number,
  protofilament: number,
  monomere: number,
  yBase: number,
  debordement: number,
  visible: boolean,
): void {
  const rayon = RAYON_RESEAU + debordement
  _position.set(
    COS_PROTO[protofilament]! * rayon,
    yBase + protofilament * DECALAGE_HELICE + monomere * PAS_MONOMERE,
    SIN_PROTO[protofilament]! * rayon,
  )
  _echelle.setScalar(visible ? 1 : 0)
  _matrice.compose(_position, _quatIdentite, _echelle)
  cible.setMatrixAt(index, _matrice)
}

/**
 * Un microtubule droit partant du centrosome.
 *
 * Il est droit parce qu'un microtubule l'est : sa longueur de persistance est
 * millimétrique, il ne flambe pas sur cinq micromètres. Le groupe est orienté de
 * sorte que son Y local suive l'axe du tube — toute la démonstration se calcule
 * ensuite en abscisse le long de ce Y.
 */
function creerTube(
  axe: THREE.Vector3,
  longueurAme: number,
  materiau: THREE.Material,
): THREE.Group {
  const groupe = new THREE.Group()
  groupe.position.copy(SIEGES.centrosome)
  groupe.quaternion.setFromUnitVectors(_axeY, axe)
  const ame = new THREE.Mesh(
    new THREE.CylinderGeometry(RAYON_AME, RAYON_AME, longueurAme, 10, 1, true),
    materiau,
  )
  ame.position.y = longueurAme / 2
  groupe.add(ame)
  return groupe
}

interface Moteur {
  readonly kinesine: boolean
  /** +1 vers l'extrémité plus (la périphérie), −1 vers la moins (le centre). */
  readonly sens: number
  readonly groupe: THREE.Group
  readonly piedA: THREE.Mesh
  readonly piedB: THREE.Mesh
  readonly anneauA: THREE.Mesh
  readonly anneauB: THREE.Mesh
  readonly jambeA: THREE.Mesh
  readonly jambeB: THREE.Mesh
  readonly corps: THREE.Mesh
  readonly attache: THREE.Mesh
  readonly vesicule: THREE.Mesh
  readonly hauteurCorps: number
  readonly fractionAnneau: number
  /** Protofilament sur lequel il marche : deux moteurs voisins ne se percutent pas. */
  angle: number
  /** Abscisses des deux pieds, en µm le long de l'axe du tube. */
  sA: number
  sB: number
  mobileEstA: boolean
  cible: number
  reussi: boolean
  phase: number
  cycle: number
  pasRestants: number
  /** Décroché : il diffuse et cherche à se raccrocher par collision. */
  libre: boolean
  refractaire: number
  vx: number
  vy: number
  vz: number
  x: number
  y: number
  z: number
  /** Centre de la promenade du moteur décroché : glisse du lâcher vers le but. */
  cx: number
  cy: number
  cz: number
  /** Où la promenade le mène : un autre point du rail, tiré au hasard. */
  bx: number
  by: number
  bz: number
  tangage: number
  roulis: number
}

export function creerTransportMoteur(): Mecanisme[] {
  const alea = creerAlea(GRAINE)

  // Repère du fuseau local au centrosome : l'axe radial, plus deux perpendiculaires.
  const axeRadial = SIEGES.centrosome.clone().normalize()
  const perp1 = new THREE.Vector3(0, 0, 1).cross(axeRadial).normalize()
  const perp2 = new THREE.Vector3().crossVectors(axeRadial, perp1).normalize()
  const axeVers = (a: number, b: number): THREE.Vector3 =>
    axeRadial.clone().addScaledVector(perp1, a).addScaledVector(perp2, b).normalize()

  // Les trois tubes divergent doucement : ils partent tous du centrosome mais ne
  // sont pas un faisceau collé. À hauteur de la fenêtre de démonstration, le tube
  // voisin passe à 0,14 µm — assez près pour tenir dans le même cadre.
  const axeRail = axeVers(0, 0)
  const axeVoisin = axeVers(0.045, 0.02)
  const axePointe = axeVers(-0.03, 0.12)

  const matiereAme = materiauOrganite(TEINTES.centriole)
  const matiereAlpha = materiauOrganite(TEINTES.cytosquelette, { doubleFace: false })
  const matiereBeta = materiauOrganite(TEINTES.centriole, { doubleFace: false })
  const matiereGTP = materiauOrganite(TEINTES.reticulumLisse, { doubleFace: false })
  const matiereKinesine = materiauOrganite(TEINTES.noyau, { doubleFace: false })
  const matiereDyneine = materiauOrganite(TEINTES.golgi, { doubleFace: false })
  const matiereVesicule = materiauOrganite(TEINTES.vesicule, { opacite: 0.92, doubleFace: false })

  const geomTubuline = new THREE.SphereGeometry(RAYON_MONOMERE, 6, 4)

  // ═══════════════════════════════════════════════════════════════════════
  // MÉCANISME 1 — la marche des moteurs
  // ═══════════════════════════════════════════════════════════════════════

  const tubeRail = creerTube(axeRail, LONGUEUR_TUBE, matiereAme)
  const tubeVoisin = creerTube(axeVoisin, LONGUEUR_TUBE, matiereAme)

  // Le damier α/β, posé une seule fois : ce réseau ne bouge pas, et le recalculer
  // à chaque image serait 2 912 matrices gaspillées par trame.
  const NB_PAR_MESH = NB_PROTOFILAMENTS * NB_DIMERES_RAIL
  const alphaRail = new THREE.InstancedMesh(geomTubuline, matiereAlpha, NB_PAR_MESH)
  const betaRail = new THREE.InstancedMesh(geomTubuline, matiereBeta, NB_PAR_MESH)
  alphaRail.frustumCulled = false
  betaRail.frustumCulled = false
  for (let p = 0; p < NB_PROTOFILAMENTS; p++) {
    for (let d = 0; d < NB_DIMERES_RAIL; d++) {
      const index = p * NB_DIMERES_RAIL + d
      poserTubuline(alphaRail, index, p, d * 2, Y_RAIL, 0, true)
      poserTubuline(betaRail, index, p, d * 2 + 1, Y_RAIL, 0, true)
    }
  }
  alphaRail.instanceMatrix.needsUpdate = true
  betaRail.instanceMatrix.needsUpdate = true
  tubeRail.add(alphaRail, betaRail)

  const geomTeteKinesine = new THREE.SphereGeometry(0.00225, 6, 4)
  const geomPiedDyneine = new THREE.SphereGeometry(0.0016, 5, 3)
  const geomNoeud = new THREE.SphereGeometry(0.0018, 5, 3)
  // L'anneau AAA+ de la dynéine fait 13 nm : c'est sa signature, et c'est ce qui
  // la distingue au premier coup d'œil des deux petites billes de la kinésine.
  const geomAnneau = new THREE.TorusGeometry(0.005, 0.0016, 5, 10)
  const geomCorpsKinesine = new THREE.SphereGeometry(0.0026, 5, 3)
  const geomCorpsDyneine = new THREE.SphereGeometry(0.0032, 5, 3)
  const geomJambe = geometrieMembre(0.0009)
  const geomAttache = geometrieMembre(0.0011)
  const geomVesicule = new THREE.SphereGeometry(0.035, 12, 8)

  function creerMoteur(kinesine: boolean, sens: number, s: number, protofilament: number): Moteur {
    const matiere = kinesine ? matiereKinesine : matiereDyneine
    const groupe = new THREE.Group()
    const geomPied = kinesine ? geomTeteKinesine : geomPiedDyneine
    const piedA = new THREE.Mesh(geomPied, matiere)
    const piedB = new THREE.Mesh(geomPied, matiere)
    const anneauA = new THREE.Mesh(kinesine ? geomNoeud : geomAnneau, matiere)
    const anneauB = new THREE.Mesh(kinesine ? geomNoeud : geomAnneau, matiere)
    // L'anneau est vu de profil : couché sur X, son disque reste lisible de côté.
    anneauA.rotation.y = Math.PI / 2
    anneauB.rotation.y = Math.PI / 2
    const jambeA = new THREE.Mesh(geomJambe, matiere)
    const jambeB = new THREE.Mesh(geomJambe, matiere)
    const corps = new THREE.Mesh(kinesine ? geomCorpsKinesine : geomCorpsDyneine, matiere)
    const attache = new THREE.Mesh(geomAttache, matiere)
    const vesicule = new THREE.Mesh(geomVesicule, matiereVesicule)
    groupe.add(piedA, piedB, anneauA, anneauB, jambeA, jambeB, corps, attache, vesicule)

    return {
      kinesine,
      sens,
      groupe,
      piedA, piedB, anneauA, anneauB, jambeA, jambeB, corps, attache, vesicule,
      // La dynéine porte son anneau haut, au bout d'une longue tige ; la kinésine
      // n'a qu'un col court entre ses têtes et sa tige enroulée.
      hauteurCorps: kinesine ? 0.030 : 0.052,
      fractionAnneau: kinesine ? 0.34 : 0.62,
      angle: (protofilament / NB_PROTOFILAMENTS) * Math.PI * 2,
      sA: s,
      sB: s + sens * PAS_DIMERE,
      mobileEstA: true,
      cible: s,
      reussi: true,
      phase: alea() * 0.5,
      cycle: kinesine ? CYCLE_KINESINE : CYCLE_DYNEINE,
      pasRestants: kinesine ? 70 + Math.floor(alea() * 70) : 30 + Math.floor(alea() * 50),
      libre: false,
      refractaire: 0,
      vx: 0, vy: 0, vz: 0,
      x: 0, y: s, z: 0,
      cx: 0, cy: s, cz: 0,
      bx: 0, by: s, bz: 0,
      tangage: 0,
      roulis: 0,
    }
  }

  /**
   * Départ chargé.
   *
   * Une kinésine et une dynéine se font face à 0,11 µm : elles se rapprochent de
   * 17 nm par seconde d'écran — mesuré, pas estimé — et se croisent vers la
   * cinquième seconde, au centre du cadre. Sans cette mise en place, le croisement — qui EST le sujet — pourrait
   * n'arriver qu'une minute après l'ouverture.
   */
  const moteurs: Moteur[] = [
    creerMoteur(true, 1, Y_RAIL + 0.38, 1),
    creerMoteur(false, -1, Y_RAIL + 0.49, 11),
    creerMoteur(true, 1, Y_RAIL + 0.12, 4),
    creerMoteur(false, -1, Y_RAIL + 0.78, 8),
    creerMoteur(true, 1, Y_RAIL + 0.65, 6),
  ]
  // Une kinésine arrive au bout de sa course : elle lâchera vers la neuvième
  // seconde. Le décrochage est un fait du mécanisme, il doit se voir tout de suite.
  moteurs[4]!.pasRestants = 9
  for (let i = 0; i < moteurs.length; i++) tubeRail.add(moteurs[i]!.groupe)

  const groupeTransport = new THREE.Group()
  groupeTransport.name = 'transport-moteur'
  groupeTransport.add(tubeRail, tubeVoisin)

  /** Choisit la prochaine tentative : cible du pied mobile, et si elle aboutira. */
  function engagerPas(m: Moteur): void {
    if (m.kinesine) {
      // Main sur main : le pied arrière passe DEVANT l'autre. Il parcourt 16 nm,
      // la molécule n'avance que de 8.
      m.mobileEstA = m.sens > 0 ? m.sA < m.sB : m.sA > m.sB
      const autre = m.mobileEstA ? m.sB : m.sA
      m.cible = autre + m.sens * PAS_DIMERE
      m.reussi = alea() > ECHEC_KINESINE
    } else {
      // La dynéine ne coordonne pas ses deux têtes : ses pas font 8 à 32 nm, elle
      // glisse parfois en arrière, et une fois sur cinq c'est le pied AVANT qui
      // repart — d'où sa démarche titubante, très différente du va-et-vient réglé
      // de la kinésine. Le tout avance quand même à environ 1 µm/s.
      const arriereEstA = m.sens > 0 ? m.sA < m.sB : m.sA > m.sB
      m.mobileEstA = alea() < 0.8 ? arriereEstA : !arriereEstA
      const tirage = alea()
      const pas = tirage < 0.1 ? -1 : tirage < 0.4 ? 1 : tirage < 0.78 ? 2 : tirage < 0.93 ? 3 : 4
      m.cible = (m.mobileEstA ? m.sB : m.sA) + m.sens * pas * PAS_DIMERE
      m.reussi = alea() > ECHEC_DYNEINE
    }
  }

  function decrocher(m: Moteur): void {
    m.libre = true
    m.refractaire = 0.5 + alea() * 0.9
    m.x = Math.cos(m.angle) * RAYON_PIED
    m.y = (m.sA + m.sB) / 2
    m.z = Math.sin(m.angle) * RAYON_PIED
    m.cx = m.x
    m.cy = m.y
    m.cz = m.z
    // Un moteur qui lâche au bord de la fenêtre s'y raccrocherait aussitôt et
    // repartirait dehors : il passait la moitié de sa vie à ce manège. Sa
    // promenade le porte donc ailleurs sur le rail — et de toute façon, dans la
    // cellule, ce n'est pas la même molécule qui revient.
    const but = (0.1 + alea() * 0.8) * LONGUEUR_RAIL + Y_RAIL
    const angleBut = Math.floor(alea() * NB_PROTOFILAMENTS) * (Math.PI * 2 / NB_PROTOFILAMENTS)
    m.bx = Math.cos(angleBut) * RAYON_PIED
    m.by = but
    m.bz = Math.sin(angleBut) * RAYON_PIED
    m.vx = 0
    m.vy = 0
    m.vz = 0
  }

  function raccrocher(m: Moteur): void {
    m.libre = false
    // Il se raccroche là où il a touché : le protofilament est celui du contact.
    const p = Math.round((Math.atan2(m.z, m.x) / (Math.PI * 2)) * NB_PROTOFILAMENTS)
    m.angle = ((p + NB_PROTOFILAMENTS) % NB_PROTOFILAMENTS) * (Math.PI * 2 / NB_PROTOFILAMENTS)
    const s = Math.min(Math.max(m.y, Y_RAIL + 0.05), Y_RAIL + LONGUEUR_RAIL - 0.05)
    m.sA = s
    m.sB = s + m.sens * PAS_DIMERE
    m.phase = 0
    m.pasRestants = m.kinesine ? 70 + Math.floor(alea() * 70) : 30 + Math.floor(alea() * 50)
    m.groupe.rotation.set(0, Math.PI / 2 - m.angle, 0)
    engagerPas(m)
  }

  for (let i = 0; i < moteurs.length; i++) {
    const m = moteurs[i]!
    m.groupe.rotation.set(0, Math.PI / 2 - m.angle, 0)
    engagerPas(m)
  }

  let tempsTransport = 0

  const animerTransport = (temps: number): void => {
    let dt = temps - tempsTransport
    if (dt < 0 || dt > 0.25) dt = 1 / 60
    tempsTransport = temps
    const amorti = Math.exp(-9 * dt)
    const impulsionMoteur = IMPULSION_MOTEUR * Math.sqrt(dt)

    for (let i = 0; i < moteurs.length; i++) {
      const m = moteurs[i]!
      let sA = m.sA
      let sB = m.sB
      let leveeX = 0
      let leveeZ = 0

      if (m.libre) {
        // Le domaine de la promenade glisse du point de lâcher vers le but : le
        // moteur dérive le long du tube en culbutant, et le frôle sans arrêt.
        m.cx += (m.bx - m.cx) * 1.2 * dt
        m.cy += (m.by - m.cy) * 1.2 * dt
        m.cz += (m.bz - m.cz) * 1.2 * dt
        m.vx = m.vx * amorti + (alea() - 0.5) * impulsionMoteur
        m.vy = m.vy * amorti + (alea() - 0.5) * impulsionMoteur
        m.vz = m.vz * amorti + (alea() - 0.5) * impulsionMoteur
        m.x += m.vx * dt
        m.y += m.vy * dt
        m.z += m.vz * dt
        const ex = m.x - m.cx
        const ey = m.y - m.cy
        const ez = m.z - m.cz
        const ecart2 = ex * ex + ey * ey + ez * ez
        if (ecart2 > RAYON_LIBRE * RAYON_LIBRE) {
          const facteur = RAYON_LIBRE / Math.sqrt(ecart2)
          m.x = m.cx + ex * facteur
          m.y = m.cy + ey * facteur
          m.z = m.cz + ez * facteur
          m.vx = -m.vx
          m.vy = -m.vy
          m.vz = -m.vz
        }
        // Le tube est plein : le moteur roule dessus, il ne le traverse pas.
        let distance = Math.sqrt(m.x * m.x + m.z * m.z)
        if (distance < RAYON_PIED) {
          const facteur = RAYON_PIED / Math.max(distance, 1e-6)
          m.x *= facteur
          m.z *= facteur
          distance = RAYON_PIED
        }
        m.tangage += m.vy * dt * 24
        m.roulis += m.vx * dt * 24
        m.groupe.position.set(m.x, m.y, m.z)
        m.groupe.rotation.set(m.tangage, Math.PI / 2 - m.angle, m.roulis)
        m.refractaire -= dt
        // Le raccrochage est une collision, pas un rendez-vous : il faut toucher
        // le tube, être au-dessus du damier, ET que la tête tombe juste. La
        // plupart des passages ratent, et ils se comptent en dizaines.
        if (
          m.refractaire <= 0 &&
          distance < RAYON_PIED + 0.010 &&
          m.y > Y_RAIL + 0.02 &&
          m.y < Y_RAIL + LONGUEUR_RAIL - 0.02 &&
          alea() < 2.5 * dt
        ) {
          raccrocher(m)
        }
        continue
      }

      m.phase += dt / m.cycle
      if (m.phase >= 1) {
        m.phase -= 1
        if (m.reussi) {
          if (m.mobileEstA) m.sA = m.cible
          else m.sB = m.cible
          m.pasRestants -= 1
        }
        // Cent pas et la kinésine lâche : elle ne traverse pas le microtubule.
        // Sortir de la fenêtre gravée vaut décrochage : au-delà, plus de damier.
        if (m.pasRestants <= 0 || m.sA < Y_RAIL || m.sA > Y_RAIL + LONGUEUR_RAIL) {
          decrocher(m)
          continue
        }
        engagerPas(m)
        sA = m.sA
        sB = m.sB
      }

      // Cliquet : pendant les trois quarts du cycle rien ne bouge, le moteur
      // attend son ATP. Le pas est un saut, jamais un glissement.
      if (m.phase > 1 - PART_BALANCEMENT) {
        const u = (m.phase - (1 - PART_BALANCEMENT)) / PART_BALANCEMENT
        const depart = m.mobileEstA ? m.sA : m.sB
        // Une tentative ratée part, tend le bras, et revient sur son site.
        const course = m.reussi ? u : Math.sin(u * Math.PI) * 0.62
        const s = depart + (m.cible - depart) * course
        if (m.mobileEstA) sA = s
        else sB = s
        // La tête libre s'écarte du tube et passe sur le côté : sans ça les deux
        // têtes se traverseraient et le pas ne se lirait pas.
        const arc = Math.sin(u * Math.PI)
        leveeZ = arc * 0.0055
        leveeX = arc * 0.0045 * (m.mobileEstA ? 1 : -1)
      }

      const yCorps = (sA + sB) / 2
      m.groupe.position.set(0, yCorps, 0)

      const ax = m.mobileEstA ? leveeX : 0
      const az = m.mobileEstA ? leveeZ : 0
      const bx = m.mobileEstA ? 0 : leveeX
      const bz = m.mobileEstA ? 0 : leveeZ
      m.piedA.position.set(ax, sA - yCorps, RAYON_PIED + az)
      m.piedB.position.set(bx, sB - yCorps, RAYON_PIED + bz)

      // Le corps est décalé vers l'arrière : c'est lui qui tire la charge.
      const cy = -m.sens * 0.004
      m.corps.position.set(0, cy, m.hauteurCorps)
      tendreMembre(m.jambeA, m.piedA.position.x, m.piedA.position.y, m.piedA.position.z, 0, cy, m.hauteurCorps)
      tendreMembre(m.jambeB, m.piedB.position.x, m.piedB.position.y, m.piedB.position.z, 0, cy, m.hauteurCorps)
      m.anneauA.position.lerpVectors(m.piedA.position, m.corps.position, m.fractionAnneau)
      m.anneauB.position.lerpVectors(m.piedB.position, m.corps.position, m.fractionAnneau)

      // La vésicule traîne derrière, et elle est secouée : à cette taille, le
      // cytosol n'est pas de l'eau tranquille, c'est un bombardement permanent.
      const vy = -m.sens * 0.078 + Math.sin(temps * 2.7 + i * 1.9) * 0.010
      const vz = m.hauteurCorps + 0.048 + Math.cos(temps * 3.3 + i) * 0.009
      const vx = Math.sin(temps * 3.9 + i * 2.4) * 0.011
      m.vesicule.position.set(vx, vy, vz)
      tendreMembre(m.attache, 0, cy, m.hauteurCorps, vx, vy, vz)
    }
  }

  animerTransport(0)

  // ═══════════════════════════════════════════════════════════════════════
  // MÉCANISME 2 — l'extrémité plus qui pousse et s'effondre
  // ═══════════════════════════════════════════════════════════════════════

  const tubePointe = creerTube(axePointe, Y_POINTE + 0.02, matiereAme)

  const NB_PAR_MESH_POINTE = NB_PROTOFILAMENTS * NB_DIMERES_POINTE
  const alphaPointe = new THREE.InstancedMesh(geomTubuline, matiereAlpha, NB_PAR_MESH_POINTE)
  const betaPointe = new THREE.InstancedMesh(geomTubuline, matiereBeta, NB_PAR_MESH_POINTE)
  // Le capuchon de GTP : une couronne par protofilament, verte comme la tubuline
  // libre dont elle vient. Sa perte est la cause de la catastrophe, pas sa suite.
  const capuchon = new THREE.InstancedMesh(
    new THREE.SphereGeometry(RAYON_MONOMERE * 1.25, 6, 4),
    matiereGTP,
    NB_PROTOFILAMENTS,
  )
  const libres = new THREE.InstancedMesh(
    new THREE.SphereGeometry(RAYON_MONOMERE * 1.15, 5, 3),
    matiereGTP,
    NB_TUBULINES_LIBRES,
  )
  alphaPointe.frustumCulled = false
  betaPointe.frustumCulled = false
  capuchon.frustumCulled = false
  libres.frustumCulled = false
  tubePointe.add(alphaPointe, betaPointe, capuchon, libres)

  const longueurs = new Int16Array(NB_PROTOFILAMENTS)
  for (let p = 0; p < NB_PROTOFILAMENTS; p++) {
    // Départ à 70 % de la fenêtre, et déjà en dents de scie : une pointe en
    // croissance est effilochée, jamais taillée droit.
    longueurs[p] = 30 + Math.floor(alea() * 7)
  }
  let enCatastrophe = false
  /** Une catastrophe est due trois secondes après l'ouverture : elle se voit. */
  let tCatastrophe = 3
  let resteAOter = 0
  let resteAAjouter = 0

  const posLibres = new Float32Array(NB_TUBULINES_LIBRES * 3)
  const vitLibres = new Float32Array(NB_TUBULINES_LIBRES * 3)
  const centreNuage = Y_POINTE + 0.18
  for (let i = 0; i < NB_TUBULINES_LIBRES; i++) {
    const u = alea() * 2 - 1
    const theta = alea() * Math.PI * 2
    const r = RAYON_NUAGE * Math.cbrt(alea())
    const s = Math.sqrt(1 - u * u)
    posLibres[i * 3] = r * s * Math.cos(theta)
    posLibres[i * 3 + 1] = centreNuage + r * u
    posLibres[i * 3 + 2] = r * s * Math.sin(theta)
  }

  /** Renvoie l'abscisse du bout d'un protofilament. */
  function sommet(p: number): number {
    return Y_POINTE + p * DECALAGE_HELICE + longueurs[p]! * PAS_DIMERE
  }

  /** Renvoie un dimère libre au nuage, à sa périphérie. */
  function reemettre(i: number, x: number, y: number, z: number): void {
    posLibres[i * 3] = x
    posLibres[i * 3 + 1] = y
    posLibres[i * 3 + 2] = z
    vitLibres[i * 3] = (alea() - 0.5) * 0.3
    vitLibres[i * 3 + 1] = (alea() - 0.5) * 0.3
    vitLibres[i * 3 + 2] = (alea() - 0.5) * 0.3
  }

  let tempsPointe = 0

  const animerPointe = (temps: number): void => {
    let dt = temps - tempsPointe
    if (dt < 0 || dt > 0.25) dt = 1 / 60
    tempsPointe = temps
    const amorti = Math.exp(-9 * dt)
    const impulsion = IMPULSION_BROWNIENNE * Math.sqrt(dt)

    let plusHaut = 0
    let plusBas = NB_DIMERES_POINTE
    for (let p = 0; p < NB_PROTOFILAMENTS; p++) {
      const l = longueurs[p]!
      if (l > plusHaut) plusHaut = l
      if (l < plusBas) plusBas = l
    }
    const yBout = Y_POINTE + plusHaut * PAS_DIMERE

    // ── Le nuage de tubuline libre ──
    let candidat = -1
    let meilleure = RAYON_CAPTURE * RAYON_CAPTURE
    for (let i = 0; i < NB_TUBULINES_LIBRES; i++) {
      const k = i * 3
      vitLibres[k] = vitLibres[k]! * amorti + (alea() - 0.5) * impulsion
      vitLibres[k + 1] = vitLibres[k + 1]! * amorti + (alea() - 0.5) * impulsion
      vitLibres[k + 2] = vitLibres[k + 2]! * amorti + (alea() - 0.5) * impulsion
      let x = posLibres[k]! + vitLibres[k]! * dt
      let y = posLibres[k + 1]! + vitLibres[k + 1]! * dt
      let z = posLibres[k + 2]! + vitLibres[k + 2]! * dt

      // Confinement : le nuage tient le champ, sinon il se vide en trois secondes.
      const dy = y - centreNuage
      const d2 = x * x + dy * dy + z * z
      if (d2 > RAYON_NUAGE * RAYON_NUAGE) {
        const facteur = RAYON_NUAGE / Math.sqrt(d2)
        x *= facteur
        y = centreNuage + dy * facteur
        z *= facteur
        vitLibres[k] = -vitLibres[k]!
        vitLibres[k + 1] = -vitLibres[k + 1]!
        vitLibres[k + 2] = -vitLibres[k + 2]!
      }
      posLibres[k] = x
      posLibres[k + 1] = y
      posLibres[k + 2] = z

      const ex = x
      const ey = y - yBout
      const ez = z
      const distance2 = ex * ex + ey * ey + ez * ez
      if (distance2 < meilleure) {
        meilleure = distance2
        candidat = i
      }

      _position.set(x, y, z)
      _echelle.setScalar(1)
      _matrice.compose(_position, _quatIdentite, _echelle)
      libres.setMatrixAt(i, _matrice)
    }
    libres.instanceMatrix.needsUpdate = true

    // ── Croissance, catastrophe, sauvetage ──
    if (enCatastrophe) {
      resteAOter += TAUX_DEPOLYMERISATION * dt
      while (resteAOter >= 1 && plusHaut > 0) {
        let cible = 0
        for (let p = 1; p < NB_PROTOFILAMENTS; p++) {
          if (longueurs[p]! > longueurs[cible]!) cible = p
        }
        // La tubuline libérée retourne au pool : rien ne disparaît, le dimère
        // arraché repart en diffusant depuis le point où il a lâché.
        reemettre(
          Math.floor(alea() * NB_TUBULINES_LIBRES),
          COS_PROTO[cible]! * 0.05,
          sommet(cible) + 0.02,
          SIN_PROTO[cible]! * 0.05,
        )
        longueurs[cible] = longueurs[cible]! - 1
        resteAOter -= 1
        plusHaut = 0
        for (let p = 0; p < NB_PROTOFILAMENTS; p++) {
          if (longueurs[p]! > plusHaut) plusHaut = longueurs[p]!
        }
      }
      // Sauvetage : le tube reprend avant d'avoir tout perdu, c'est la règle.
      if (plusHaut <= 4 || alea() < 0.6 * dt) {
        enCatastrophe = false
        resteAOter = 0
        tCatastrophe = 3.5 + alea() * 3
      }
    } else {
      resteAAjouter += TAUX_POLYMERISATION * dt
      let absorbe = false
      while (resteAAjouter >= 1 && plusHaut < NB_DIMERES_POINTE) {
        resteAAjouter -= 1
        // Le dimère se pose sur un protofilament qui n'a pas trop d'avance sur le
        // plus court : la pointe reste effilochée, comme une vraie pointe en
        // croissance — elle n'est jamais taillée droit.
        let p = Math.floor(alea() * NB_PROTOFILAMENTS)
        for (let essai = 0; essai < 5 && longueurs[p]! > plusBas + 3; essai++) {
          p = (p + 1) % NB_PROTOFILAMENTS
        }
        if (longueurs[p]! >= NB_DIMERES_POINTE) break
        longueurs[p] = longueurs[p]! + 1
        if (longueurs[p]! > plusHaut) plusHaut = longueurs[p]!
        plusBas = NB_DIMERES_POINTE
        for (let q = 0; q < NB_PROTOFILAMENTS; q++) {
          if (longueurs[q]! < plusBas) plusBas = longueurs[q]!
        }
        // Un seul dimère du nuage est absorbé par image, et seulement s'il s'en
        // trouvait un à portée : les 160 dimères dessinés sont un échantillon du
        // pool, on ne peut pas en faire disparaître cent quarante par seconde.
        if (!absorbe && candidat >= 0) {
          absorbe = true
          const u = alea() * 2 - 1
          const theta = alea() * Math.PI * 2
          const s = Math.sqrt(1 - u * u)
          reemettre(
            candidat,
            RAYON_NUAGE * s * Math.cos(theta),
            centreNuage + RAYON_NUAGE * u,
            RAYON_NUAGE * s * Math.sin(theta),
          )
        }
      }
      tCatastrophe -= dt
      if (tCatastrophe <= 0 || plusHaut >= NB_DIMERES_POINTE) enCatastrophe = true
    }

    // ── Le réseau, redessiné : c'est lui qui pousse et qui s'écarte ──
    for (let p = 0; p < NB_PROTOFILAMENTS; p++) {
      const longueur = longueurs[p]!
      for (let d = 0; d < NB_DIMERES_POINTE; d++) {
        const index = p * NB_DIMERES_POINTE + d
        const present = d < longueur
        // Cornes de bélier : en catastrophe, les protofilaments ne se dissolvent
        // pas, ils s'écartent en bouclant vers l'extérieur avant de lâcher.
        let debordement = 0
        if (present && enCatastrophe) {
          const recul = longueur - 1 - d
          if (recul < 7) debordement = (7 - recul) * 0.0018
        }
        poserTubuline(alphaPointe, index, p, d * 2, Y_POINTE, debordement, present)
        poserTubuline(betaPointe, index, p, d * 2 + 1, Y_POINTE, debordement, present)
      }
      _position.set(
        COS_PROTO[p]! * RAYON_RESEAU,
        sommet(p),
        SIN_PROTO[p]! * RAYON_RESEAU,
      )
      _echelle.setScalar(!enCatastrophe && longueur > 0 ? 1 : 0)
      _matrice.compose(_position, _quatIdentite, _echelle)
      capuchon.setMatrixAt(p, _matrice)
    }
    alphaPointe.instanceMatrix.needsUpdate = true
    betaPointe.instanceMatrix.needsUpdate = true
    capuchon.instanceMatrix.needsUpdate = true
  }

  animerPointe(0)

  const groupePointe = new THREE.Group()
  groupePointe.name = 'instabilite-dynamique'
  groupePointe.add(tubePointe)

  const ancreRail = SIEGES.centrosome
    .clone()
    .addScaledVector(axeRail, Y_RAIL + LONGUEUR_RAIL / 2)
  const ancrePointe = SIEGES.centrosome
    .clone()
    .addScaledVector(axePointe, Y_POINTE + 0.19)

  return [
    {
      cle: 'transport-moteur',
      nom: 'Kinésine et dynéine sur le microtubule',
      siege: 'Cytosquelette',
      facteur: 'ralenti ×100',
      justificationFacteur:
        "La kinésine fait environ cent pas PRODUCTIFS par seconde, de 8 nm chacun, soit 800 nm/s : un pas dure 10 ms dans la cellule, il en prend une à l'écran. On verra pourtant une tentative et demie par seconde — une sur trois échoue et ne fait pas avancer la molécule, il faut donc compter les pas qui aboutissent, pas les balancements.",
      ellision:
        "Le pas lui-même dure moins de 100 µs, contre une dizaine de millisecondes d'attente d'ATP : il est étiré au quart du cycle, sinon il tiendrait dans une seule image. L'ATP n'est pas dessinée — 1 nm de large, elle ferait moins d'un pixel. Le damier de tubuline n'est posé que sur 0,9 µm de rail : les 52 000 tubulines d'un tube entier coûteraient dix fois le budget. Enfin, le décrochage est arrangé deux fois : un moteur libre quitterait le cadre en un dixième de seconde d'écran, sa promenade est donc fortement ralentie ; et c'est la MÊME molécule qu'on voit revenir se poser plus loin, alors que dans la cellule celle qui lâche est perdue et c'en est une autre, parmi le millier qui traînent là, qui prend sa place.",
      description:
        "Vue rapprochée d'un tronçon de microtubule, à trois micromètres du centrosome ; les tubes sont ceux de cette démonstration, un peu plus épais que ceux du cytosquelette parce que les tubulines y sont dessinées en relief. Le rail n'est pas lisse : treize protofilaments de dimères α/β y forment un damier hélicoïdal, et c'est sur ce damier que les moteurs posent leurs pieds. La kinésine marche main sur main vers l'extrémité plus, à la périphérie, en tirant sa vésicule ; la dynéine, reconnaissable à ses anneaux AAA+ au bout de longues tiges, la croise en sens inverse vers le centre — c'est le trafic à double sens de l'axone. Aucun des deux ne sait où il va : la tête libre cherche son site en diffusant et manque son coup une fois sur trois, et après une centaine de pas le moteur lâche, part en promenade brownienne et se raccroche ailleurs par collision.",
      chiffres: [
        { valeur: '8 nm', quoi: 'longueur d’un pas, exactement un dimère de tubuline' },
        { valeur: '≈ 100 pas/s', quoi: 'cadence PRODUCTIVE de la kinésine, soit 800 nm par seconde' },
        { valeur: '1 sur 3', quoi: 'tentatives qui échouent : la tête libre cherche son site en diffusant' },
        { valeur: '1 ATP', quoi: 'consommée par pas' },
        { valeur: '≈ 100 pas', quoi: 'avant décrochage : 800 nm, pas la longueur du tube' },
        { valeur: '6 pN', quoi: 'force qu’une kinésine peut tirer' },
        { valeur: '13', quoi: 'protofilaments dans un microtubule de 25 nm de diamètre' },
        { valeur: '+ et −', quoi: 'la kinésine va vers le plus, la dynéine vers le moins' },
      ],
      objet: groupeTransport,
      ancre: ancreRail,
      rayonCadrage: 0.45,
      couleur: TEINTES.noyau,
      animer: animerTransport,
    },
    {
      cle: 'instabilite-dynamique',
      nom: 'Instabilité dynamique du microtubule',
      siege: 'Cytosquelette',
      facteur: 'accéléré ×3',
      justificationFacteur:
        "Le tube pousse d'environ 1,8 µm/min et s'effondre à 17 µm/min. Accéléré trois fois, il remplit les 0,38 µm de la fenêtre gravée en quatre secondes et les reperd en moins d'une demi-seconde : les deux vitesses sont montrées telles quelles, et c'est leur rapport de près de dix qui doit sauter aux yeux.",
      ellision:
        "La FRÉQUENCE, elle, est comprimée : dans la cellule une catastrophe survient toutes les minutes ou deux, ici toutes les cinq secondes — parce que la fenêtre gravée ne fait que 0,38 µm et que le tube la remplit aussitôt. Le damier de tubuline n'est dessiné qu'autour de l'extrémité plus ; au-delà le tube est lisse. Le pool libre est réduit à 160 dimères là où la cellule en compte des dizaines de millions, leur diffusion est fortement ralentie — à l'échelle réelle ils traverseraient le cadre en un millième de seconde — et un seul est absorbé par image alors que cent quarante-six s'ajoutent chaque seconde. L'hydrolyse du GTP en GDP n'est pas figurée : le vert du capuchon devient gris quand la tubuline s'enfonce dans le réseau, et c'est tout.",
      description:
        "La même charpente, mais par son bout, à huit micromètres et demi du centre. Les dimères de tubuline libres — en vert, chargés de GTP — cognent contre l'extrémité plus au hasard : presque tous repartent, quelques-uns s'ajoutent, et le tube pousse par pas de 8 nm, un protofilament à la fois, ce qui lui donne un bout effiloché et jamais plat. Tant que la couronne de GTP tient au sommet, l'édifice tient ; dès qu'elle est perdue, les treize protofilaments s'écartent en cornes de bélier et le tube se défait près de dix fois plus vite qu'il n'a poussé. C'est l'instabilité dynamique : un microtubule ne se raccourcit pas, il s'effondre — puis repart.",
      chiffres: [
        { valeur: '≈ 1,8 µm/min', quoi: 'vitesse de croissance de l’extrémité plus' },
        { valeur: '≈ 17 µm/min', quoi: 'vitesse d’effondrement, dix fois plus rapide' },
        { valeur: '≈ 1/min', quoi: 'fréquence réelle des catastrophes — comprimée ici à une toutes les cinq secondes' },
        { valeur: '8 nm', quoi: 'taille du dimère αβ ajouté à chaque fois' },
        { valeur: '13', quoi: 'protofilaments qui s’écartent en cornes de bélier' },
      ],
      objet: groupePointe,
      ancre: ancrePointe,
      rayonCadrage: 0.34,
      couleur: TEINTES.cytosquelette,
      animer: animerPointe,
    },
  ]
}
