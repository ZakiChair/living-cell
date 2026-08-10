import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import { contexteRepos } from '../../noyau/contexte.js'
import type { ContexteCellule, MecanismeBrut } from './contrat.js'

/**
 * L'îlot de Langerhans, en maquette : la cellule bêta n'est jamais seule.
 *
 * Tout le site regarde UNE cellule ; ce zoom arrière la remet dans son
 * organe. Trois vérités que la vue solitaire cache :
 * 1. L'îlot HUMAIN est ENTREMÊLÉ — bêta, alpha et delta se côtoient, au
 *    contraire du manteau bien rangé des rongeurs qu'on dessine partout.
 * 2. La sécrétion est POLARISÉE : chaque cellule est à moins de vingt
 *    micromètres d'un capillaire, et ses granules fusionnent vers lui, pas
 *    n'importe où.
 * 3. Les bêta battent ENSEMBLE : couplées par la connexine 36, elles
 *    partagent leurs ondes calciques — et la somatostatine des delta freine
 *    tout le monde, en continu.
 */

const GRAINE = 0x494c4f54

/** Une onde calcique d'îlot à l'écran : 16 s pour ~4 min réelles. */
const PERIODE = 16
const CYCLE_REEL = 240

/** Rayon d'une cellule de la maquette : stylisée, l'ellision le déclare. */
const R_CELLULE = 0.27
const NB_BETA = 7
const NB_GRAINS_SECRETION = 21
const NB_SST = 8
const NB_JONCTIONS = 6

const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const AXE_Y = new THREE.Vector3(0, 1, 0)

function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

export function creerIlot(): MecanismeBrut[] {
  const alea = creerAlea(GRAINE)
  const groupe = new THREE.Group()
  groupe.name = 'ilot'
  groupe.position.set(5.2, 1.9, -2.3)
  groupe.rotation.set(0.1, -0.4, 0.05)

  // ── Le capillaire fenestré, qui traverse l'îlot ─────────────────────────
  const capillaire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 2.6, 12, 1, true),
    materiauOrganite(0x9e3a30, { opacite: 0.55 }),
  )
  capillaire.rotation.z = Math.PI / 2.15
  capillaire.position.set(0, -0.12, 0)
  groupe.add(capillaire)
  // Les hématies qui y défilent : le sang est le destinataire de tout ceci.
  const NB_HEMATIES = 4
  const hematies = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.07, 10, 8),
    materiauOrganite(0xc0392b, { doubleFace: false }),
    NB_HEMATIES,
  )
  hematies.frustumCulled = false
  groupe.add(hematies)

  // ── Les cellules : entremêlées, comme dans l'îlot humain ────────────────
  const matBeta = materiauOrganite(TEINTES.granuleInsuline, { opacite: 0.85 })
  const matAlpha = materiauOrganite(0xd55e00, { opacite: 0.85 })
  const matDelta = materiauOrganite(TEINTES.lysosome, { opacite: 0.85 })

  const betas: THREE.Mesh[] = []
  const posBetas: THREE.Vector3[] = []
  const geoCellule = new THREE.SphereGeometry(R_CELLULE, 16, 12)
  // Placement déterministe en couronne double autour du capillaire, alpha et
  // delta INTERCALÉES — l'îlot humain n'a pas de manteau.
  const roles: Array<'beta' | 'alpha' | 'delta'> = [
    'beta', 'alpha', 'beta', 'beta', 'delta', 'beta', 'alpha',
    'beta', 'delta', 'beta', 'alpha', 'beta',
  ]
  let indice = 0
  for (const role of roles) {
    const angle = (indice / roles.length) * Math.PI * 2 + 0.3
    const rayon = 0.52 + (indice % 2) * 0.34
    const cellule = new THREE.Mesh(
      geoCellule,
      role === 'beta' ? matBeta : role === 'alpha' ? matAlpha : matDelta,
    )
    cellule.position.set(
      Math.cos(angle) * rayon,
      Math.sin(angle) * rayon * 0.75,
      (alea() - 0.5) * 0.3,
    )
    groupe.add(cellule)
    if (role === 'beta') {
      betas.push(cellule)
      posBetas.push(cellule.position.clone())
    }
    indice++
  }

  // ── Les jonctions connexine 36, entre bêta voisines ─────────────────────
  const jonctions = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.02, 0.02, 1, 6, 1, true),
    materiauOrganite(TEINTES.proteineMembranaire),
    NB_JONCTIONS,
  )
  jonctions.frustumCulled = false
  groupe.add(jonctions)
  // Paires de bêta proches, figées à la construction.
  const paires: Array<[number, number]> = []
  for (let i = 0; i < posBetas.length && paires.length < NB_JONCTIONS; i++) {
    for (let j = i + 1; j < posBetas.length && paires.length < NB_JONCTIONS; j++) {
      if (posBetas[i]!.distanceTo(posBetas[j]!) < R_CELLULE * 3.1) paires.push([i, j])
    }
  }

  // ── L'onde calcique qui parcourt les bêta ───────────────────────────────
  // De petits éclats bleus naissent sur chaque bêta À SON TOUR : l'onde fait
  // le tour du réseau couplé en une période. C'est elle que le harnais mesure.
  const eclats = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.045, 0),
    materiauOrganite(0x56b4e9, { doubleFace: false }),
    NB_BETA,
  )
  eclats.frustumCulled = false
  eclats.name = 'onde-calcique'
  groupe.add(eclats)

  // ── Les sécrétions ──────────────────────────────────────────────────────
  // Insuline : des grains jaunes qui partent du PÔLE VASCULAIRE de chaque
  // bêta vers le capillaire — jamais du côté opposé. La polarité se voit.
  const insuline = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.02, 0),
    materiauOrganite(TEINTES.granuleInsuline, { doubleFace: false }),
    NB_GRAINS_SECRETION,
  )
  insuline.frustumCulled = false
  groupe.add(insuline)
  const emetteurs = new Float32Array(NB_GRAINS_SECRETION)
  const phasesGrains = new Float32Array(NB_GRAINS_SECRETION)
  for (let i = 0; i < NB_GRAINS_SECRETION; i++) {
    emetteurs[i] = Math.floor(alea() * NB_BETA)
    phasesGrains[i] = alea()
  }

  // Somatostatine : le frein des delta, qui dérive vers les voisines.
  const sst = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.016, 0),
    materiauOrganite(TEINTES.lysosome, { doubleFace: false }),
    NB_SST,
  )
  sst.frustumCulled = false
  groupe.add(sst)
  const departsSst: THREE.Vector3[] = []
  const cibleSst: THREE.Vector3[] = []
  const positionsDelta = [roles.indexOf('delta'), roles.lastIndexOf('delta')]
  for (let i = 0; i < NB_SST; i++) {
    const delta = positionsDelta[i % 2]!
    const angle = (delta / roles.length) * Math.PI * 2 + 0.3
    const rayon = 0.52 + (delta % 2) * 0.34
    departsSst.push(new THREE.Vector3(Math.cos(angle) * rayon, Math.sin(angle) * rayon * 0.75, 0))
    cibleSst.push(posBetas[i % posBetas.length]!.clone())
  }

  const axeCapillaire = new THREE.Vector3(Math.cos(Math.PI / 2.15), Math.sin(Math.PI / 2.15), 0)
    .normalize()

  const animer = (temps: number, contexte: ContexteCellule = contexteRepos()): void => {
    const p = ((temps / PERIODE) % 1 + 1) % 1
    // Le débit de sécrétion de l'îlot suit la CELLULE du site : stimulez-la
    // au glucose, et c'est tout l'organe qui répond.
    const debit = 0.25 + 0.75 * contexte.secretionRelative

    // L'onde : chaque bêta s'illumine à son tour, puis l'éclat s'éteint.
    for (let k = 0; k < NB_BETA; k++) {
      const tour = (p - k / NB_BETA + 1) % 1
      const eclat = lissage(tour / 0.08) * (1 - lissage((tour - 0.14) / 0.12))
      _position.copy(posBetas[k]!)
      // L'éclat S'ÉLÈVE en s'allumant : c'est sa position qui porte le cycle —
      // la signature du harnais de période ne lit pas les échelles.
      _position.y += R_CELLULE * 0.7 + eclat * 0.12
      _matrice.compose(_position, _quat.identity(), _echelle.setScalar(Math.max(0.001, eclat)))
      eclats.setMatrixAt(k, _matrice)
      // La cellule elle-même pulse avec son onde.
      betas[k]!.scale.setScalar(1 + eclat * 0.05)
    }
    eclats.instanceMatrix.needsUpdate = true

    // Les jonctions relient les paires, immobiles mais présentes.
    for (const [j, paire] of paires.entries()) {
      _a.copy(posBetas[paire[0]]!)
      _b.copy(posBetas[paire[1]]!)
      const longueur = _a.distanceTo(_b) - R_CELLULE * 1.6
      _position.copy(_a).lerp(_b, 0.5)
      _quat.setFromUnitVectors(AXE_Y, _b.sub(_a).normalize())
      _echelle.set(1, Math.max(0.02, longueur), 1)
      _matrice.compose(_position, _quat, _echelle)
      jonctions.setMatrixAt(j, _matrice)
    }
    jonctions.instanceMatrix.needsUpdate = true

    // L'insuline part du pôle vasculaire, plonge vers le capillaire, disparaît dedans.
    for (let i = 0; i < NB_GRAINS_SECRETION; i++) {
      const k = emetteurs[i]!
      const q = (p * 2 + phasesGrains[i]!) % 1
      _a.copy(posBetas[k]!)
      // Le pôle vasculaire : le point de la cellule le plus proche du capillaire.
      _b.set(0, -0.12, 0).sub(_a).normalize()
      _a.addScaledVector(_b, R_CELLULE)
      _position.copy(_a).lerp(_b.set(0, -0.12, _a.z * 0.3), lissage(q))
      const ech = debit * lissage(q / 0.1) * (1 - lissage((q - 0.75) / 0.25))
      _matrice.compose(_position, _quat.identity(), _echelle.setScalar(Math.max(0.001, ech)))
      insuline.setMatrixAt(i, _matrice)
    }
    insuline.instanceMatrix.needsUpdate = true

    // La somatostatine dérive des delta vers les bêta : le frein permanent.
    for (let i = 0; i < NB_SST; i++) {
      const q = (temps * 0.05 + i / NB_SST) % 1
      _position.copy(departsSst[i]!).lerp(cibleSst[i]!, lissage(q))
      const ech = 0.8 * lissage(q / 0.15) * (1 - lissage((q - 0.8) / 0.2))
      _matrice.compose(_position, _quat, _echelle.setScalar(Math.max(0.001, ech)))
      sst.setMatrixAt(i, _matrice)
    }
    sst.instanceMatrix.needsUpdate = true

    // Les hématies défilent dans le capillaire.
    for (let h = 0; h < NB_HEMATIES; h++) {
      const q = (temps * 0.11 + h / NB_HEMATIES) % 1
      _position.copy(axeCapillaire).multiplyScalar((q - 0.5) * 2.4)
      _position.y -= 0.12
      _echelle.set(1, 0.55, 1)
      _matrice.compose(_position, _quat, _echelle)
      hematies.setMatrixAt(h, _matrice)
    }
    hematies.instanceMatrix.needsUpdate = true
    _echelle.setScalar(1)
  }

  animer(0)

  return [
    {
      cle: 'ilot',
      nom: "L'îlot de Langerhans : la cellule dans son organe",
      siege: 'Îlot de Langerhans',
      ralentissement: PERIODE / CYCLE_REEL,
      observable: {
        nom: 'onde-calcique',
        cycleReel: CYCLE_REEL,
        pourquoi:
          "L'onde calcique qui parcourt les bêta couplées porte le cycle : les " +
          'oscillations lentes d\'un îlot stimulé se répètent toutes les trois à ' +
          'cinq minutes, et c\'est ce tour-là que le badge annonce.',
      },
      justificationFacteur:
        "Les oscillations calciques lentes d'un îlot stimulé ont une période de " +
        "trois à cinq minutes ; le tour tient ici en 16 s, soit un accéléré " +
        "d'environ ×15. Le passage d'une hématie, lui, est bien plus rapide en " +
        'vrai — le sang traverse un îlot en une seconde.',
      ellision:
        "C'EST UNE MAQUETTE, posée dans le cytoplasme comme la mitose : douze " +
        'cellules stylisées d\'un demi-micromètre pour un îlot réel de mille à ' +
        'trois mille cellules de dix micromètres — les proportions internes ' +
        "sont fausses et déclarées. L'architecture, elle, est HUMAINE : bêta, " +
        'alpha et delta entremêlées, pas le manteau des rongeurs. Le glucagon ' +
        "des alpha n'est pas figuré, ni les cellules PP, ni les nerfs ; la " +
        'somatostatine est réduite à quelques grains, et le couplage électrique ' +
        "des bêta à l'onde qui les parcourt — la connexine 36 est dessinée, pas " +
        'simulée. Le débit de sécrétion lit le modèle de LA cellule du site.',
      description:
        'Un pour cent du pancréas, tout le contrôle de la glycémie : un îlot est ' +
        'un organe dans l\'organe, mille à trois mille cellules pelotonnées ' +
        "autour de leurs capillaires. Les BÊTA — jaunes — n'y travaillent " +
        'jamais seules : couplées par la connexine 36, elles partagent leurs ' +
        "ondes calciques et sécrètent EN CHŒUR — regardez l'éclat bleu faire le " +
        'tour du réseau, et les grains d\'insuline partir du PÔLE VASCULAIRE de ' +
        'chaque cellule, jamais du côté opposé : chaque cellule est à moins de ' +
        "vingt micromètres d'un capillaire, et sa sécrétion est dirigée. Les " +
        'ALPHA — orange — feront le glucagon quand le glucose manquera ; les ' +
        'DELTA — violettes — freinent tout le monde à la somatostatine, en ' +
        "continu. L'îlot humain est entremêlé : alpha et delta au contact des " +
        'bêta, partout — le manteau bien rangé des schémas est une anatomie de ' +
        'rongeur.',
      objet: groupe,
      ancre: groupe.position.clone(),
      rayonCadrage: 1.6,
      couleur: TEINTES.granuleInsuline,
      animer,
    },
  ]
}
