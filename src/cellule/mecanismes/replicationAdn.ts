import * as THREE from 'three'
import { CENTRE_NOYAU, TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import type { MecanismeBrut } from './contrat.js'

/**
 * La fourche de réplication : semi-conservative, asymétrique, machinée.
 *
 * Trois vérités que les schémas de manuel écrasent :
 * 1. SEMI-CONSERVATIVE — chaque duplex fille garde UN brin parental. Ici la
 *    couleur le dit : les brins anciens sont sombres, les neufs clairs.
 * 2. ASYMÉTRIQUE — la polymérase ne sait lire que dans un sens. Le brin
 *    avancé est copié d'un trait ; le brin retardé, à REBOURS, par fragments
 *    d'Okazaki amorcés à l'ARN, et sa matrice fait une boucle — le trombone.
 * 3. MACHINÉE — l'hélicase CMG ouvre, les RPA gainent le simple brin, PCNA
 *    encercle et retient la polymérase, la topoisomérase détend l'amont, la
 *    ligase soude. Rien de tout cela n'est spontané.
 *
 * Le référentiel est celui de la FOURCHE, comme l'atelier tient son ribosome
 * au centre : c'est l'ADN qui défile.
 */

const GRAINE = 0x5245504c

/** Un fragment d'Okazaki à l'écran : 15 s pour 5 s réelles (150 nt à 30 nt/s). */
const PERIODE = 15
const CYCLE_REEL = 5

/** Montée par paire de bases : 0,324 nm. Un grain pour deux paires. */
const RISE = 0.000324
const PB_PAR_GRAIN = 2
const PAS_GRAIN = RISE * PB_PAR_GRAIN
/** Tour d'hélice : 10,5 pb. */
const ANGLE_GRAIN = (Math.PI * 2 * PB_PAR_GRAIN) / 10.5
/** Rayon du duplex dessiné : 1,25 nm (2,5 nm de large, comme la transcription). */
const RAYON_DUPLEX = 0.00125
const RAYON_GRAIN = 0.0006

/** Longueur des tronçons, en grains. */
const N_PARENT = 34
const N_FILLE = 30
const N_FRAGMENT = 22
/** L'amorce ARN : ~10 nt, soit 5 grains, en tête de chaque fragment. */
const N_AMORCE = 5

const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)

function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

/** Point sur l'axe parental : la fourche est à l'origine, le duplex part en +x. */
function axeParent(s: number, cible: THREE.Vector3): void {
  cible.set(s * PAS_GRAIN, 0, 0)
}

/** Axe de la fille avancée : elle part de la fourche vers −x, +y. */
function axeAvance(s: number, cible: THREE.Vector3): void {
  cible.set(-s * PAS_GRAIN * 0.92, s * PAS_GRAIN * 0.4, 0)
}

/** Axe de la fille retardée : vers −x, −y. */
function axeRetarde(s: number, cible: THREE.Vector3): void {
  cible.set(-s * PAS_GRAIN * 0.92, -s * PAS_GRAIN * 0.4, 0)
}

/**
 * La boucle du trombone : la matrice du brin retardé sort de la fourche, fait
 * un lasso vers le bas, et revient au duplex retardé. `q` va de 0 (fourche) à
 * 1 (retour), `ampleur` gonfle la boucle à mesure que le fragment s'allonge.
 */
function boucleTrombone(q: number, ampleur: number, cible: THREE.Vector3): void {
  const angle = Math.PI * (0.15 + 1.1 * q)
  const rayon = 0.0035 + ampleur * 0.006
  cible.set(
    -0.001 - Math.sin(angle) * rayon * 0.9,
    -0.0035 - (1 - Math.cos(angle)) * rayon,
    0.0012 * Math.sin(q * Math.PI),
  )
}

export function creerReplicationAdn(): MecanismeBrut[] {
  const alea = creerAlea(GRAINE)
  const groupe = new THREE.Group()
  groupe.name = 'replication-adn'
  // Dans le noyau, à l'écart du gène transcrit et du côté que la coupe garde.
  groupe.position.copy(CENTRE_NOYAU).add(new THREE.Vector3(0.9, 1.1, -1.3))
  groupe.rotation.set(0.2, 0.5, 0.1)

  const matAncien = materiauOrganite(TEINTES.noyau, { doubleFace: false })
  const matNeuf = materiauOrganite(TEINTES.chromatine, { doubleFace: false })
  const matArn = materiauOrganite(0xd55e00, { doubleFace: false })
  const matMachine = materiauOrganite(TEINTES.proteineMembranaire)

  // ── Les brins, tous en grains instanciés ────────────────────────────────
  const anciens = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_GRAIN, 1),
    matAncien,
    N_PARENT * 2 + N_FILLE + N_FILLE + N_FRAGMENT,
  )
  anciens.frustumCulled = false
  groupe.add(anciens)

  const neufs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_GRAIN, 1),
    matNeuf,
    N_FILLE,
  )
  neufs.frustumCulled = false
  groupe.add(neufs)

  // Le fragment porte le badge : il vit dans son propre amas pour que le
  // harnais mesure SON cycle, sans le glissement continu du brin avancé.
  const fragment = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_GRAIN, 1),
    matNeuf,
    N_FRAGMENT,
  )
  fragment.frustumCulled = false
  fragment.name = 'fragment-okazaki'
  groupe.add(fragment)

  const amorces = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_GRAIN * 1.15, 1),
    matArn,
    N_AMORCE * 2,
  )
  amorces.frustumCulled = false
  groupe.add(amorces)

  // ── La machinerie ───────────────────────────────────────────────────────
  // L'hélicase CMG : un anneau à l'apex, qui encercle UN brin — elle avance
  // sur la matrice du brin avancé, elle n'écarte pas les deux à la main.
  const helicase = new THREE.Mesh(
    new THREE.TorusGeometry(0.0028, 0.0012, 8, 6),
    matMachine,
  )
  helicase.position.set(0.0012, 0.0008, 0)
  helicase.rotation.y = Math.PI / 2
  groupe.add(helicase)

  // Deux PCNA : les anneaux coulissants qui retiennent chaque polymérase.
  const geoPcna = new THREE.TorusGeometry(0.0021, 0.0007, 8, 10)
  const pcnaAvance = new THREE.Mesh(geoPcna, matMachine)
  const pcnaRetarde = new THREE.Mesh(geoPcna, matMachine)
  groupe.add(pcnaAvance, pcnaRetarde)

  const geoPol = new THREE.IcosahedronGeometry(0.0024, 1)
  const matPol = materiauOrganite(TEINTES.golgi, { doubleFace: false })
  const polAvance = new THREE.Mesh(geoPol, matPol)
  const polRetarde = new THREE.Mesh(geoPol, matPol)
  groupe.add(polAvance, polRetarde)

  // La primase (avec pol α) : celle qui pose l'amorce ARN.
  const primase = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0019, 1),
    materiauOrganite(0xd55e00, { doubleFace: false }),
  )
  groupe.add(primase)

  // FEN1 et la ligase, au point de soudure du fragment précédent.
  const fen1 = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0016, 1),
    materiauOrganite(TEINTES.lysosome, { doubleFace: false }),
  )
  const ligase = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0018, 1),
    materiauOrganite(TEINTES.reticulumLisse, { doubleFace: false }),
  )
  groupe.add(fen1, ligase)

  // La topoisomérase, en amont : la fourche vrille le parent devant elle.
  const topo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0022, 1), matMachine)
  topo.position.set(N_PARENT * PAS_GRAIN * 0.75, 0.0022, 0.0008)
  groupe.add(topo)

  // Les RPA : elles gainent le simple brin exposé dans la boucle.
  const NB_RPA = 5
  const rpas = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0012, 0),
    matMachine,
    NB_RPA,
  )
  rpas.frustumCulled = false
  groupe.add(rpas)

  const phases = new Float32Array(N_PARENT * 2 + N_FILLE * 2 + N_FRAGMENT * 2)
  for (let i = 0; i < phases.length; i++) phases[i] = alea() * 0.0002

  /** Pose un grain hélicoïdal autour d'un axe donné par `poserAxe`. */
  const poserBrin = (
    amas: THREE.InstancedMesh,
    indice: number,
    poserAxe: (s: number, cible: THREE.Vector3) => void,
    s: number,
    demiTour: number,
    ech: number,
  ): void => {
    poserAxe(s, _position)
    const angle = s * ANGLE_GRAIN + demiTour
    _position.y += Math.sin(angle) * RAYON_DUPLEX
    _position.z += Math.cos(angle) * RAYON_DUPLEX
    _matrice.compose(_position, _quat, _echelle.setScalar(Math.max(0.001, ech)))
    amas.setMatrixAt(indice, _matrice)
  }

  const animer = (temps: number): void => {
    const p = ((temps / PERIODE) % 1 + 1) % 1
    // L'ADN défile d'un grain de fragment par période : le glissement continu
    // rend la marche de la fourche, le cycle rend l'Okazaki.
    const glisse = p * N_FRAGMENT * 0.2

    let indice = 0
    // Parent : les deux brins anciens, appariés, qui entrent dans la fourche.
    for (let s = 0; s < N_PARENT; s++) {
      const u = s + (glisse % 1)
      // La vrille d'amont : le duplex tourne sur lui-même en approchant de la
      // topoisomérase — la contrainte que la fourche pousse devant elle.
      const vrille = Math.sin(temps * 0.4) * 0.6 * lissage((s - 12) / 14)
      poserBrin(anciens, indice++, axeParent, u, vrille, 1)
      poserBrin(anciens, indice++, axeParent, u, vrille + Math.PI, 1)
    }
    // Fille avancée : brin ancien (matrice) + brin neuf continu.
    for (let s = 0; s < N_FILLE; s++) {
      const u = s + (glisse % 1)
      poserBrin(anciens, indice++, axeAvance, u, 0, 1)
    }
    // Fille retardée : matrice ancienne du duplex déjà fait.
    for (let s = 0; s < N_FILLE; s++) {
      const u = s + (glisse % 1)
      poserBrin(anciens, indice++, axeRetarde, u, 0, 1)
    }
    // La matrice dans la BOUCLE : simple brin, gainé de RPA.
    const ampleur = lissage((p - 0.1) / 0.7)
    for (let s = 0; s < N_FRAGMENT; s++) {
      const q = s / (N_FRAGMENT - 1)
      boucleTrombone(q, ampleur, _position)
      _matrice.compose(_position, _quat, _echelle.setScalar(1))
      anciens.setMatrixAt(indice++, _matrice)
    }
    anciens.instanceMatrix.needsUpdate = true

    // Brin neuf avancé : continu, appairé à sa matrice.
    for (let s = 0; s < N_FILLE; s++) {
      const u = s + (glisse % 1)
      poserBrin(neufs, s, axeAvance, u, Math.PI, 1)
    }
    neufs.instanceMatrix.needsUpdate = true
    // Le fragment d'Okazaki en cours : il pousse à REBOURS le long de la
    // boucle, du point d'amorçage vers le fragment précédent.
    const avancee = lissage((p - 0.15) / 0.75)
    const nFaits = Math.round(avancee * (N_FRAGMENT - N_AMORCE))
    for (let s = 0; s < N_FRAGMENT; s++) {
      const visible = s >= N_AMORCE && s - N_AMORCE < nFaits ? 1 : 0.001
      const q = 1 - s / (N_FRAGMENT - 1)
      boucleTrombone(q, ampleur, _position)
      _position.y -= 0.0011
      _matrice.compose(_position, _quat, _echelle.setScalar(visible))
      fragment.setMatrixAt(s, _matrice)
    }
    fragment.instanceMatrix.needsUpdate = true

    // Les amorces ARN : celle du fragment en cours (posée à p≈0,1), et celle
    // du fragment PRÉCÉDENT, que FEN1 retire pendant que la ligase soude.
    const poseAmorce = lissage((p - 0.06) / 0.08)
    for (let a = 0; a < N_AMORCE; a++) {
      const q = 1 - a / (N_FRAGMENT - 1)
      boucleTrombone(q, ampleur, _position)
      _position.y -= 0.0011
      _matrice.compose(_position, _quat, _echelle.setScalar(Math.max(0.001, poseAmorce)))
      amorces.setMatrixAt(a, _matrice)

      // L'ancienne amorce, sur le duplex retardé, s'efface grain à grain.
      const retrait = lissage((p - 0.3 - a * 0.06) / 0.08)
      poserBrin(amorces, N_AMORCE + a, axeRetarde, 6 + a, Math.PI, Math.max(0.001, 1 - retrait))
    }
    amorces.instanceMatrix.needsUpdate = true

    // Machinerie mobile.
    axeAvance(5, _position)
    polAvance.position.copy(_position)
    pcnaAvance.position.set(_position.x + 0.0016, _position.y - 0.0008, _position.z)
    pcnaAvance.rotation.set(0.4, temps * 0.15, 0.9)

    const qPol = 1 - (N_AMORCE + nFaits) / (N_FRAGMENT - 1)
    boucleTrombone(Math.max(0, qPol), ampleur, _position)
    _position.y -= 0.0011
    polRetarde.position.copy(_position)
    pcnaRetarde.position.set(_position.x - 0.0014, _position.y - 0.001, _position.z)
    pcnaRetarde.rotation.set(1.1, temps * 0.12, 0.3)

    boucleTrombone(1, ampleur, _position)
    primase.position.set(_position.x + 0.001, _position.y - 0.002, _position.z)
    primase.scale.setScalar(0.7 + 0.5 * lissage((p - 0.02) / 0.1) * (1 - lissage((p - 0.2) / 0.1)))

    axeRetarde(7, _position)
    fen1.position.set(_position.x, _position.y - 0.0022, _position.z + 0.001)
    fen1.scale.setScalar(0.6 + 0.6 * lissage((p - 0.3) / 0.1) * (1 - lissage((p - 0.65) / 0.1)))
    ligase.position.set(_position.x - 0.002, _position.y - 0.0018, _position.z - 0.001)
    ligase.scale.setScalar(0.6 + 0.6 * lissage((p - 0.68) / 0.1) * (1 - lissage((p - 0.92) / 0.08)))

    // Les RPA suivent la boucle, espacées.
    for (let i = 0; i < NB_RPA; i++) {
      boucleTrombone((i + 0.5) / NB_RPA, ampleur, _position)
      _position.z += 0.0012
      const ech = 0.6 + 0.4 * Math.sin(temps * 0.8 + i * 2)
      _matrice.compose(_position, _quat, _echelle.setScalar(ech * Math.max(0.2, ampleur)))
      rpas.setMatrixAt(i, _matrice)
    }
    rpas.instanceMatrix.needsUpdate = true

    // La topoisomérase pulse quand la vrille d'amont culmine.
    topo.scale.setScalar(0.8 + 0.3 * Math.abs(Math.sin(temps * 0.4)))
    _echelle.setScalar(1)
  }

  animer(0)

  return [
    {
      cle: 'replication-adn',
      nom: "Réplication : la fourche et ses fragments d'Okazaki",
      siege: 'Noyau',
      ralentissement: PERIODE / CYCLE_REEL,
      observable: {
        nom: 'fragment-okazaki',
        cycleReel: CYCLE_REEL,
        pourquoi:
          "Le brin retardé porte le cycle : un fragment d'Okazaki eucaryote fait " +
          '~150 nucléotides et la fourche avance à ~30 par seconde — cinq secondes ' +
          "par fragment, et c'est ce cycle amorçage-extension-soudure que le badge annonce.",
      },
      justificationFacteur:
        "Une fourche humaine avance à ~30 nucléotides par seconde : un fragment " +
        "d'Okazaki de 150 nt naît toutes les cinq secondes. Le cycle en prend " +
        'quinze à l\'écran — ralenti ×3, juste assez pour suivre l\'amorçage.',
      ellision:
        'Le fragment est raccourci (22 grains pour ~150 nt) et le duplex ' +
        'échantillonné à un grain pour deux paires de bases. La cellule bêta ' +
        'adulte ne se divise presque jamais — ~0,5 % par an — et cette fourche ' +
        'est donc une démonstration de ce qui se passe dans les cellules qui se ' +
        'divisent, pas un événement fréquent de celle-ci ; la même machinerie ' +
        'sert aussi à la réparation. Pas d\'origine de réplication ni de ' +
        'chargement du CMG (phase G1), pas de point de contrôle, pas de ' +
        'télomères. La boucle du trombone est une hypothèse d\'école bien ' +
        'étayée, pas une photographie.',
      description:
        'La réplication est SEMI-CONSERVATIVE — suivez les couleurs : chaque ' +
        'duplex fille garde un brin parental sombre et gagne un brin neuf clair. ' +
        'Et elle est ASYMÉTRIQUE : la polymérase ne lit que dans un sens, alors ' +
        "le brin avancé est copié d'un trait derrière l'hélicase, tandis que " +
        "l'autre est copié à REBOURS, par fragments : la primase pose une amorce " +
        "d'ARN — en orange —, la polymérase δ, retenue par son anneau PCNA, " +
        'étend le fragment le long de la boucle du trombone, FEN1 retire ' +
        "l'amorce du fragment précédent et la ligase soude. L'hélicase n'écarte " +
        'pas les brins à la main : elle encercle une matrice et avance. Les RPA ' +
        'gainent le simple brin exposé, et en amont la topoisomérase détend la ' +
        'vrille que la fourche pousse devant elle — la même contrainte que ' +
        'montre la transcription.',
      objet: groupe,
      ancre: groupe.position.clone(),
      rayonCadrage: 0.024,
      couleur: TEINTES.chromatine,
      animer,
    },
  ]
}
