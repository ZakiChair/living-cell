import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import type { MecanismeBrut } from './contrat.js'

/**
 * La maturation du granule : PC1/3, PC2, le peptide C, le zinc et le cristal.
 *
 * Le granule qui bourgeonne du trans-Golgi ne contient pas d'insuline : il
 * contient de la PROINSULINE, une seule chaîne où A et B sont reliées par le
 * peptide C. La maturation est une usine intérieure : le pH tombe, les
 * convertases PC1/3 et PC2 coupent aux deux jonctions, la carboxypeptidase E
 * ébarbe les résidus basiques, et l'insuline libérée cristallise en hexamères
 * autour du zinc que ZnT8 pompe dedans — le cœur dense des clichés EM.
 *
 * Le peptide C ne part pas : il reste dissous dans le halo et sera co-sécrété
 * MOLE POUR MOLE avec l'insuline. C'est lui qu'on dose en clinique pour savoir
 * si un pancréas fabrique encore — l'insuline injectée n'en a pas.
 */

const GRAINE = 0x4d415455

/** Une maturation à l'écran : 24 s pour ~1 h réelle. */
const PERIODE = 24
const CYCLE_REEL = 3600

/** Rayon du granule : 150 nm, taille vraie. */
const RAYON_GRANULE = 0.15
const NB_PROINSULINES = 10
const NB_ZINC = 8
const NB_PLAQUES_CLATHRINE = 3

// Jalons.
const P_CLATHRINE_PART = 0.3
const P_COUPES_DEB = 0.22
const P_COUPES_FIN = 0.62
const P_ZINC_DEB = 0.3
const P_ZINC_FIN = 0.7
const P_CRISTAL_DEB = 0.45

const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)

function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

export function creerMaturationGranule(): MecanismeBrut[] {
  const alea = creerAlea(GRAINE)
  const groupe = new THREE.Group()
  groupe.name = 'maturation-granule'
  // Entre le Golgi et la membrane, sur le trajet de la sécrétion.
  groupe.position.set(4.4, -2.9, -1.5)
  groupe.rotation.set(0.1, 0.3, 0)

  // ── L'enveloppe du granule, et ses restes de clathrine ──────────────────
  const enveloppe = new THREE.Mesh(
    new THREE.SphereGeometry(RAYON_GRANULE, 20, 14),
    materiauOrganite(TEINTES.granuleInsuline, { opacite: 0.28 }),
  )
  groupe.add(enveloppe)

  // Le granule immature porte encore des plaques de clathrine : c'est par
  // elles que les protéines qui n'ont rien à faire là sont retirées, et leur
  // départ SIGNE la maturité.
  const matClathrine = materiauOrganite(TEINTES.vesicule, { opacite: 0.9 })
  const plaques: THREE.Mesh[] = []
  const ancresPlaques: THREE.Vector3[] = []
  for (let i = 0; i < NB_PLAQUES_CLATHRINE; i++) {
    const plaque = new THREE.Mesh(new THREE.IcosahedronGeometry(0.028, 0), matClathrine)
    plaque.scale.setScalar(1)
    const direction = new THREE.Vector3(
      alea() * 2 - 1,
      alea() * 2 - 1,
      alea() * 2 - 1,
    ).normalize()
    ancresPlaques.push(direction)
    plaques.push(plaque)
    groupe.add(plaque)
  }

  // ── Les proinsulines : B — C — A, trois grains liés ─────────────────────
  // Le grain du milieu est le peptide C, gris : c'est lui qui saute.
  const matInsuline = materiauOrganite(TEINTES.granuleInsuline, { doubleFace: false })
  const matPeptideC = materiauOrganite(TEINTES.cytosquelette, { doubleFace: false })
  const segments = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0075, 1),
    matInsuline,
    NB_PROINSULINES * 2,
  )
  const peptidesC = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.006, 1),
    matPeptideC,
    NB_PROINSULINES,
  )
  segments.frustumCulled = false
  peptidesC.frustumCulled = false
  groupe.add(segments, peptidesC)

  // Position de repos de chaque proinsuline, et l'instant où elle est coupée.
  const centres: THREE.Vector3[] = []
  const instantsCoupe = new Float32Array(NB_PROINSULINES)
  for (let i = 0; i < NB_PROINSULINES; i++) {
    const r = RAYON_GRANULE * 0.72 * Math.cbrt(alea())
    const u = alea() * 2 - 1
    const a = alea() * Math.PI * 2
    const s = Math.sqrt(Math.max(0, 1 - u * u))
    centres.push(new THREE.Vector3(r * s * Math.cos(a), r * s * Math.sin(a), r * u))
    instantsCoupe[i] = P_COUPES_DEB + (i / NB_PROINSULINES) * (P_COUPES_FIN - P_COUPES_DEB)
  }

  // ── Les convertases, la CPE, et ZnT8 ────────────────────────────────────
  const pc13 = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.011, 1),
    materiauOrganite(TEINTES.golgi, { doubleFace: false }),
  )
  const pc2 = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.009, 1),
    materiauOrganite(TEINTES.lysosome, { doubleFace: false }),
  )
  const cpe = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.007, 1),
    materiauOrganite(TEINTES.reticulumLisse, { doubleFace: false }),
  )
  groupe.add(pc13, pc2, cpe)

  const znt8 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.007, 0.014, 8),
    materiauOrganite(TEINTES.proteineMembranaire, { doubleFace: false }),
  )
  znt8.position.set(RAYON_GRANULE - 0.002, 0.03, 0.02)
  znt8.rotation.z = Math.PI / 2
  groupe.add(znt8)

  const zincs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0018, 0),
    materiauOrganite(TEINTES.cytosquelette, { doubleFace: false }),
    NB_ZINC,
  )
  zincs.frustumCulled = false
  groupe.add(zincs)

  // ── Le cœur qui cristallise ─────────────────────────────────────────────
  const coeur = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), matInsuline)
  coeur.name = 'coeur-en-cristallisation'
  groupe.add(coeur)

  const animer = (temps: number): void => {
    const p = ((temps / PERIODE) % 1 + 1) % 1

    // Les plaques de clathrine s'en vont au tiers du cycle.
    const departClathrine = lissage((p - P_CLATHRINE_PART) / 0.15)
    for (const [i, plaque] of plaques.entries()) {
      const direction = ancresPlaques[i]!
      plaque.position
        .copy(direction)
        .multiplyScalar(RAYON_GRANULE + 0.004 + departClathrine * 0.12)
      plaque.scale.setScalar(Math.max(0.001, (1 - departClathrine) * 0.55 + 0.45 * (1 - departClathrine)))
    }

    // Le cœur : néant, puis cristal. Sa croissance suit les coupes.
    const cristal = lissage((p - P_CRISTAL_DEB) / (1 - P_CRISTAL_DEB - 0.05))
    coeur.scale.setScalar(Math.max(0.001, cristal))
    coeur.rotation.y = p * 0.8

    for (let i = 0; i < NB_PROINSULINES; i++) {
      const centre = centres[i]!
      const coupe = lissage((p - instantsCoupe[i]!) / 0.05)
      // Après la coupe, l'insuline (B+A soudés) migre vers le cœur et s'y fond.
      const versCoeur = lissage((p - instantsCoupe[i]! - 0.06) / 0.2)
      const errX = Math.sin(temps * 0.9 + i * 2.1) * 0.006 * (1 - versCoeur)
      const errY = Math.cos(temps * 0.7 + i * 1.3) * 0.006 * (1 - versCoeur)

      // Segment B (index pair) et segment A (impair) : écartés avant la coupe,
      // soudés en un seul grain d'insuline après.
      for (let s = 0; s < 2; s++) {
        const ecart = (s === 0 ? -1 : 1) * (0.0075 * (1 - coupe) + 0.0015)
        _position.set(
          centre.x * (1 - versCoeur) + errX,
          centre.y * (1 - versCoeur) + errY + ecart,
          centre.z * (1 - versCoeur),
        )
        const fondu = Math.max(0.001, 1 - lissage((versCoeur - 0.75) / 0.25))
        _matrice.compose(_position, _quat.identity(), _echelle.setScalar(fondu))
        segments.setMatrixAt(i * 2 + s, _matrice)
      }

      // Le peptide C, éjecté à la coupe, RESTE dans le granule : il dérive
      // dans le halo, dissous, prêt à être co-sécrété.
      const derive = coupe
      _position.set(
        centre.x + derive * Math.sin(i * 2.7) * 0.05 + errX * 1.5,
        centre.y + derive * Math.cos(i * 1.9) * 0.05 + errY * 1.5,
        centre.z + derive * Math.sin(i * 1.1) * 0.04,
      )
      // Il ne sort jamais de l'enveloppe.
      const norme = _position.length()
      const limite = RAYON_GRANULE - 0.015
      if (norme > limite) _position.multiplyScalar(limite / norme)
      _matrice.compose(_position, _quat, _echelle.setScalar(1))
      peptidesC.setMatrixAt(i, _matrice)
    }
    segments.instanceMatrix.needsUpdate = true
    peptidesC.instanceMatrix.needsUpdate = true

    // Les enzymes font leur tournée pendant la fenêtre des coupes.
    const tournee = (p - P_COUPES_DEB) / (P_COUPES_FIN - P_COUPES_DEB)
    const cible = centres[
      Math.min(NB_PROINSULINES - 1, Math.max(0, Math.floor(tournee * NB_PROINSULINES)))
    ]!
    pc13.position.set(cible.x + 0.014, cible.y + 0.004, cible.z)
    pc2.position.set(cible.x - 0.013, cible.y - 0.005, cible.z + 0.004)
    cpe.position.set(cible.x, cible.y - 0.013, cible.z - 0.005)
    const enzymesVisibles = tournee > 0 && tournee < 1.15 ? 1 : 0.35
    pc13.scale.setScalar(enzymesVisibles)
    pc2.scale.setScalar(enzymesVisibles)
    cpe.scale.setScalar(enzymesVisibles)

    // Le zinc entre par ZnT8 et rejoint le cœur : deux ions par hexamère.
    for (let z = 0; z < NB_ZINC; z++) {
      const q = lissage((p - P_ZINC_DEB - (z / NB_ZINC) * (P_ZINC_FIN - P_ZINC_DEB)) / 0.12)
      _position.copy(znt8.position).multiplyScalar(1 - q * 0.98)
      _position.y += Math.sin(q * Math.PI) * 0.03
      const ech = p > P_ZINC_DEB ? Math.max(0.001, 1 - lissage((q - 0.9) / 0.1)) : 0.001
      _matrice.compose(_position, _quat, _echelle.setScalar(ech))
      zincs.setMatrixAt(z, _matrice)
    }
    zincs.instanceMatrix.needsUpdate = true
    _echelle.setScalar(1)
  }

  animer(0)

  return [
    {
      cle: 'maturation-granule',
      nom: 'Maturation du granule : convertases, peptide C, cristal de zinc',
      siege: 'Appareil de Golgi',
      ralentissement: PERIODE / CYCLE_REEL,
      observable: {
        nom: 'coeur-en-cristallisation',
        cycleReel: CYCLE_REEL,
        pourquoi:
          "Le cœur dense naît et grandit une fois par maturation : sa croissance " +
          "est le cycle même que le badge annonce — environ une heure de la " +
          'proinsuline au cristal.',
      },
      justificationFacteur:
        "La conversion de la proinsuline et la cristallisation prennent de " +
        "l'ordre d'une heure dans le granule ; le cycle tient ici en 24 s, soit " +
        "un accéléré d'environ ×150. Les coupes elles-mêmes sont des gestes " +
        "d'enzyme, bien plus rapides : c'est l'acidification progressive qui " +
        'donne son tempo à la maturation.',
      ellision:
        "Dix proinsulines pour les dizaines de milliers d'un granule réel, et " +
        'chacune réduite à trois grains — B, C, A. La baisse de pH (6,5 → 5,5), ' +
        "qui active les convertases et précipite le cristal, n'est pas figurée : " +
        "on n'en voit que les effets. La pompe à protons qui la produit n'est " +
        'pas dessinée — ZnT8, lui, l\'est, parce que le zinc se voit dans le ' +
        'cristal. Les résidus basiques que la CPE ébarbe après les coupes sont ' +
        'sous la taille du grain. Le granule est immobile : dans la cellule il ' +
        'voyage pendant qu\'il mûrit.',
      description:
        "Le granule qui vient du trans-Golgi ne contient pas d'insuline : il " +
        'contient de la PROINSULINE — une seule chaîne, B et A reliées par le ' +
        'peptide C, le grain gris du milieu. La maturation est une usine : les ' +
        'plaques de clathrine repartent avec les protéines mal adressées, le pH ' +
        'tombe, et les CONVERTASES passent — PC1/3 coupe à la jonction B–C, PC2 ' +
        'à la jonction C–A, la carboxypeptidase E ébarbe. L\'insuline libérée ' +
        'cristallise en hexamères autour du zinc que ZnT8 pompe dans le granule : ' +
        "c'est le cœur dense des clichés de microscopie. Le peptide C, lui, ne " +
        'part pas : dissous dans le halo, il sera co-sécrété MOLE POUR MOLE avec ' +
        "l'insuline — c'est lui qu'on dose en clinique pour savoir si un " +
        "pancréas fabrique encore, car l'insuline injectée n'en a pas.",
      objet: groupe,
      ancre: groupe.position.clone(),
      rayonCadrage: 0.28,
      couleur: TEINTES.granuleInsuline,
      animer,
    },
  ]
}
