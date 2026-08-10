import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import { contexteRepos } from '../../noyau/contexte.js'
import type { ContexteCellule, MecanismeBrut } from './contrat.js'

/**
 * L'apoptose : la mort décidée, exécutée par la mitochondrie.
 *
 * Le paradoxe à montrer : l'organite qui fait vivre la cellule est aussi
 * celui qui signe sa mort. Quand les dégâts l'emportent, Bax et Bak percent
 * la membrane externe mitochondriale, le cytochrome c — un transporteur
 * d'électrons ! — s'échappe dans le cytosol, y assemble l'APOPTOSOME (une
 * roue à sept rayons d'Apaf-1), et cette roue active les caspases : des
 * ciseaux qui démontent la cellule proprement, de l'intérieur, sans
 * inflammation. La nécrose déchire ; l'apoptose plie bagage.
 *
 * Dans une cellule saine, RIEN de tout cela ne tourne : l'horloge de cette
 * scène lit le destin du modèle, et reste à zéro tant que la cellule va
 * bien. Poussez le stress au laboratoire, et regardez-la démarrer.
 */

const GRAINE = 0x41504f50

/** Une exécution à l'écran : 30 s pour ~1 h réelle. */
const PERIODE = 30
const CYCLE_REEL = 3600

const NB_CYTC = 14
const NB_RAYONS_APOPTOSOME = 7
const NB_CASPASES = 10
const NB_BLEBS = 6

// Jalons.
const P_PORES = 0.12
const P_FUITE_FIN = 0.4
const P_ROUE = 0.45
const P_CASPASES = 0.6
const P_BLEBS = 0.72

const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _cible = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)

function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

export function creerApoptose(): MecanismeBrut[] {
  const alea = creerAlea(GRAINE)
  const groupe = new THREE.Group()
  groupe.name = 'apoptose'
  groupe.position.set(-5.6, 2.6, -1.8)
  groupe.rotation.set(0.1, -0.3, 0)

  // ── La mitochondrie condamnée ───────────────────────────────────────────
  const mito = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.24, 4, 14),
    materiauOrganite(TEINTES.mitochondrie, { opacite: 0.5 }),
  )
  mito.rotation.z = Math.PI / 2
  mito.position.set(-0.25, 0.1, 0)
  groupe.add(mito)

  // Les pores Bax/Bak : des anneaux sombres qui s'assemblent sur sa surface.
  const NB_PORES = 3
  const pores = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.022, 0.008, 6, 12),
    materiauOrganite(0x2b2b2b),
    NB_PORES,
  )
  pores.frustumCulled = false
  groupe.add(pores)
  const ancresPores: THREE.Vector3[] = [
    new THREE.Vector3(-0.12, 0.26, 0.03),
    new THREE.Vector3(-0.32, 0.24, -0.05),
    new THREE.Vector3(-0.2, -0.06, 0.14),
  ]

  // ── Le cytochrome c qui fuit, et l'apoptosome ───────────────────────────
  const cytc = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.011, 0),
    materiauOrganite(0xb04a00, { doubleFace: false }),
    NB_CYTC,
  )
  cytc.frustumCulled = false
  cytc.name = 'cytochrome-c-libere'
  groupe.add(cytc)
  const fuites: THREE.Vector3[] = []
  for (let i = 0; i < NB_CYTC; i++) {
    fuites.push(
      new THREE.Vector3(0.3 + alea() * 0.3, -0.05 + (alea() - 0.5) * 0.3, (alea() - 0.5) * 0.25),
    )
  }

  /** Centre de l'apoptosome, là où le cytochrome c converge. */
  const CENTRE_ROUE = new THREE.Vector3(0.42, -0.02, 0)
  const rayons = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.012, 0.07, 3, 8),
    materiauOrganite(TEINTES.golgi, { doubleFace: false }),
    NB_RAYONS_APOPTOSOME,
  )
  rayons.frustumCulled = false
  groupe.add(rayons)

  // ── Les caspases, et la membrane qui bourgeonne ─────────────────────────
  const caspases = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.013, 0),
    materiauOrganite(TEINTES.lysosome, { doubleFace: false }),
    NB_CASPASES,
  )
  caspases.frustumCulled = false
  groupe.add(caspases)
  const ciblesCaspases: THREE.Vector3[] = []
  for (let i = 0; i < NB_CASPASES; i++) {
    ciblesCaspases.push(
      new THREE.Vector3(alea() * 2 - 1, alea() * 2 - 1, alea() * 2 - 1)
        .normalize()
        .multiplyScalar(0.45 + alea() * 0.3),
    )
  }

  // Un pan de membrane plasmique qui se soulève en blebs : la signature
  // morphologique que le médecin reconnaît au microscope.
  const membrane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.5, 24, 10),
    materiauOrganite(TEINTES.membrane, { opacite: 0.4 }),
  )
  membrane.position.set(0.1, -0.55, 0)
  membrane.rotation.x = -Math.PI / 2.4
  groupe.add(membrane)
  const blebs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    materiauOrganite(TEINTES.membrane, { opacite: 0.5 }),
    NB_BLEBS,
  )
  blebs.frustumCulled = false
  groupe.add(blebs)
  const ancresBlebs: THREE.Vector3[] = []
  for (let i = 0; i < NB_BLEBS; i++) {
    ancresBlebs.push(
      new THREE.Vector3(-0.4 + (i / (NB_BLEBS - 1)) * 1.0, -0.5 + (alea() - 0.5) * 0.08, (alea() - 0.5) * 0.3),
    )
  }

  const animer = (temps: number, contexte: ContexteCellule = contexteRepos()): void => {
    const p = ((temps / PERIODE) % 1 + 1) % 1
    // Le stress du modèle prépare la scène avant même qu'elle tourne : les
    // pores Bax s'ébauchent quand la cellule va mal — l'engagement précède
    // l'exécution.
    const menace = Math.min(1, contexte.stressRE * 1.6)

    const percement = lissage((p - P_PORES) / 0.1)
    for (let i = 0; i < NB_PORES; i++) {
      const ancre = ancresPores[i]!
      _position.copy(ancre)
      _quat.setFromAxisAngle(_position.clone().normalize(), i * 1.2)
      const ech = Math.max(0.001, Math.max(menace * 0.4, percement))
      _matrice.compose(_position, _quat, _echelle.setScalar(ech))
      pores.setMatrixAt(i, _matrice)
    }
    pores.instanceMatrix.needsUpdate = true

    // La mitochondrie pâlit à mesure qu'elle se vide.
    const fuite = lissage((p - P_PORES) / (P_FUITE_FIN - P_PORES))
    mito.scale.setScalar(1 - fuite * 0.12)

    // Le cytochrome c sort par les pores et CONVERGE vers la roue.
    const convergence = lissage((p - P_ROUE + 0.06) / 0.14)
    for (let i = 0; i < NB_CYTC; i++) {
      const sortie = lissage((fuite - i / NB_CYTC) / 0.25)
      const pore = ancresPores[i % 3]!
      _position.copy(pore).lerp(fuites[i]!, sortie)
      if (convergence > 0 && i < NB_RAYONS_APOPTOSOME) {
        // Sept d'entre eux deviennent le moyeu de la roue.
        const angle = (i / NB_RAYONS_APOPTOSOME) * Math.PI * 2
        _cible.set(
          CENTRE_ROUE.x + Math.cos(angle) * 0.035,
          CENTRE_ROUE.y + Math.sin(angle) * 0.035,
          CENTRE_ROUE.z,
        )
        _position.lerp(_cible, convergence)
      }
      _matrice.compose(_position, _quat.identity(), _echelle.setScalar(Math.max(0.001, sortie)))
      cytc.setMatrixAt(i, _matrice)
    }
    cytc.instanceMatrix.needsUpdate = true

    // La roue Apaf-1 se déploie autour du moyeu : sept rayons.
    const roue = lissage((p - P_ROUE) / 0.12)
    for (let r = 0; r < NB_RAYONS_APOPTOSOME; r++) {
      const angle = (r / NB_RAYONS_APOPTOSOME) * Math.PI * 2 + roue * 0.4
      _position.set(
        CENTRE_ROUE.x + Math.cos(angle) * 0.085 * roue,
        CENTRE_ROUE.y + Math.sin(angle) * 0.085 * roue,
        CENTRE_ROUE.z,
      )
      _quat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle + Math.PI / 2)
      _matrice.compose(_position, _quat, _echelle.setScalar(Math.max(0.001, roue)))
      rayons.setMatrixAt(r, _matrice)
    }
    rayons.instanceMatrix.needsUpdate = true

    // Les caspases naissent à la roue et partent couper partout.
    for (let i = 0; i < NB_CASPASES; i++) {
      const depart = lissage((p - P_CASPASES - i * 0.015) / 0.15)
      _position.copy(CENTRE_ROUE).lerp(ciblesCaspases[i]!, depart)
      _matrice.compose(_position, _quat.identity(), _echelle.setScalar(Math.max(0.001, depart)))
      caspases.setMatrixAt(i, _matrice)
    }
    caspases.instanceMatrix.needsUpdate = true

    // Les blebs : la membrane bouillonne — sans se rompre, c'est le point.
    const bourgeonnement = lissage((p - P_BLEBS) / 0.2)
    for (let i = 0; i < NB_BLEBS; i++) {
      const pousse = bourgeonnement * (0.5 + 0.5 * Math.sin(p * 25 + i * 2.4))
      _position.copy(ancresBlebs[i]!)
      _position.y += pousse * 0.06
      _matrice.compose(_position, _quat, _echelle.setScalar(Math.max(0.001, pousse)))
      blebs.setMatrixAt(i, _matrice)
    }
    blebs.instanceMatrix.needsUpdate = true
    _echelle.setScalar(1)
  }

  animer(0)

  return [
    {
      cle: 'apoptose',
      nom: "Apoptose : la mitochondrie signe, les caspases exécutent",
      siege: 'Cytosol',
      ralentissement: PERIODE / CYCLE_REEL,
      observable: {
        nom: 'cytochrome-c-libere',
        cycleReel: CYCLE_REEL,
        pourquoi:
          "Le cytochrome c libéré porte le cycle : de la fuite mitochondriale " +
          "aux blebs, l'exécution prend de l'ordre d'une heure, et c'est elle " +
          'que le badge annonce.',
      },
      justificationFacteur:
        "Du percement de la membrane mitochondriale aux bourgeonnements de la " +
        "membrane plasmique, l'exécution apoptotique prend de l'ordre d'une " +
        "heure ; le cycle tient ici en 30 s, soit un accéléré d'environ ×120. " +
        'La libération du cytochrome c, elle, est étonnamment brutale : ' +
        'quelques minutes dans la cellule réelle.',
      ellision:
        "DANS UNE CELLULE SAINE, CETTE SCÈNE NE TOURNE PAS : son horloge lit le " +
        'destin du modèle et reste arrêtée tant que la cellule va bien — ' +
        "poussez le stress au laboratoire pour la voir s'engager, et les pores " +
        "Bax s'ébaucher avant même l'exécution. Bcl-2 et les gardiens qui " +
        'retiennent Bax, la boucle p53, les caspases initiatrices (la 9 au ' +
        'moyeu de la roue) distinguées des exécutrices (la 3), SMAC/DIABLO et ' +
        'les IAP ne sont pas dessinés. La fragmentation de l\'ADN et le ' +
        'découpage en corps apoptotiques, mangés par les voisines, sont hors ' +
        'cadre. La nécrose — la mort par déchirure, inflammatoire — n\'a pas ' +
        'de scène : le modèle la connaît pourtant, aux grands délabrements.',
      description:
        "L'organite qui fait vivre la cellule est celui qui signe sa mort. " +
        'Quand les dégâts l\'emportent, Bax et Bak s\'assemblent en PORES — les ' +
        'anneaux sombres — dans la membrane externe de la mitochondrie, et le ' +
        "cytochrome c s'échappe : le même transporteur d'électrons qui, à " +
        'quelques nanomètres de là, nourrissait la chaîne respiratoire. Dans le ' +
        "cytosol, il assemble l'APOPTOSOME — une roue à sept rayons d'Apaf-1 — " +
        'qui active les caspases : des ciseaux à protéines qui démontent la ' +
        'cellule de l\'intérieur, proprement. La membrane bouillonne en BLEBS ' +
        'mais ne se rompt jamais : rien ne fuit, rien ne s\'enflamme — c\'est ' +
        'toute la différence avec la nécrose. Un adulte perd cinquante à ' +
        'soixante-dix milliards de cellules par jour, par ce chemin exact.',
      objet: groupe,
      ancre: groupe.position.clone(),
      rayonCadrage: 1.0,
      couleur: 0xb04a00,
      animer,
    },
  ]
}
