import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import type { MecanismeBrut } from './contrat.js'

/**
 * La mitose, sur une maquette.
 *
 * On ne peut pas diviser LA cellule du site : une bêta adulte se divise
 * environ une fois tous les deux cents ans de vie cellulaire (~0,5 % par an),
 * et l'écorché entier est bâti sur son anatomie interphasique. La mitose est
 * donc jouée sur une MAQUETTE posée dans le cytoplasme — même statut déclaré
 * que la vignette levure de la fermentation — parce qu'elle est universelle
 * et qu'un site sur la cellule ne peut pas la taire.
 *
 * Ce que la maquette tient à montrer : la condensation (un chromosome
 * métaphasique n'existe que là), le fuseau qui CAPTURE les kinétochores, la
 * cohésine qui tient les sœurs jusqu'à l'instant de la séparase, l'anaphase
 * comme rupture — pas comme glissement —, et l'anneau d'actomyosine qui pince.
 */

const GRAINE = 0x4d49544f

/** Une mitose à l'écran : 30 s pour ~1 h réelle. */
const PERIODE = 30
const CYCLE_REEL = 3600

/** Rayon de la maquette : une cellule stylisée de 1 µm — l'ellision le déclare. */
const R = 0.5

const NB_CHROMOSOMES = 4
const NB_KMT = 4

// Jalons.
const P_CONDENSE_FIN = 0.18
const P_ENVELOPPE_OUT = 0.22
const P_CONGRESSION_FIN = 0.42
const P_ANAPHASE = 0.55
const P_ANAPHASE_FIN = 0.72
const P_TELO_DEB = 0.74
const P_RESET = 0.96

const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)
const AXE_Y = new THREE.Vector3(0, 1, 0)
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

export function creerMitose(): MecanismeBrut[] {
  const alea = creerAlea(GRAINE)
  const groupe = new THREE.Group()
  groupe.name = 'mitose'
  // Une maquette dans le cytoplasme, du côté que la coupe conserve.
  groupe.position.set(0.8, 3.6, -2.4)
  groupe.rotation.set(0.1, 0.2, 0.05)

  // ── L'enveloppe de la maquette, qui se pincera ──────────────────────────
  const matCellule = materiauOrganite(TEINTES.membrane, { opacite: 0.3 })
  const moitieA = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), matCellule)
  const moitieB = new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), matCellule)
  groupe.add(moitieA, moitieB)

  // L'anneau contractile d'actomyosine, à l'équateur.
  const anneau = new THREE.Mesh(
    new THREE.TorusGeometry(R * 0.9, 0.012, 8, 24),
    materiauOrganite(TEINTES.cytosquelette),
  )
  anneau.rotation.x = Math.PI / 2
  groupe.add(anneau)

  // L'enveloppe nucléaire : elle se défait en prométaphase, se refait en deux.
  const matNoyau = materiauOrganite(TEINTES.membraneNucleaire, { opacite: 0.4 })
  const noyauUn = new THREE.Mesh(new THREE.SphereGeometry(R * 0.42, 16, 12), matNoyau)
  const noyauA = new THREE.Mesh(new THREE.SphereGeometry(R * 0.3, 16, 12), matNoyau)
  const noyauB = new THREE.Mesh(new THREE.SphereGeometry(R * 0.3, 16, 12), matNoyau)
  groupe.add(noyauUn, noyauA, noyauB)

  // ── Les chromosomes : quatre, en paires de chromatides sœurs ────────────
  const chromatides = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.016, 0.05, 3, 8),
    materiauOrganite(TEINTES.chromatine, { doubleFace: false }),
    NB_CHROMOSOMES * 2,
  )
  chromatides.frustumCulled = false
  chromatides.name = 'chromatides'
  groupe.add(chromatides)

  // La cohésine : un grain au centromère de chaque paire, qui SAUTE à la séparase.
  const cohesines = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.011, 0),
    materiauOrganite(TEINTES.lysosome, { doubleFace: false }),
    NB_CHROMOSOMES,
  )
  cohesines.frustumCulled = false
  groupe.add(cohesines)

  // ── Le fuseau : deux centrosomes, microtubules kinétochoriens et astraux ─
  const matCentro = materiauOrganite(TEINTES.centriole)
  const centroA = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 9), matCentro)
  const centroB = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 9), matCentro)
  groupe.add(centroA, centroB)

  const fuseau = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.003, 0.003, 1, 5, 1, true),
    materiauOrganite(TEINTES.cytosquelette, { opacite: 0.85 }),
    NB_CHROMOSOMES * 2 + NB_KMT * 2,
  )
  fuseau.frustumCulled = false
  groupe.add(fuseau)

  // Positions de plaque métaphasique, tirées une fois.
  const plaques: THREE.Vector3[] = []
  const departs: THREE.Vector3[] = []
  for (let c = 0; c < NB_CHROMOSOMES; c++) {
    const angle = (c / NB_CHROMOSOMES) * Math.PI * 2 + 0.5
    plaques.push(
      new THREE.Vector3(Math.cos(angle) * R * 0.34, 0, Math.sin(angle) * R * 0.34),
    )
    departs.push(
      new THREE.Vector3(
        (alea() - 0.5) * R * 0.5,
        (alea() - 0.5) * R * 0.5,
        (alea() - 0.5) * R * 0.5,
      ),
    )
  }

  /** Tend un cylindre unitaire entre deux points. */
  const tendre = (amas: THREE.InstancedMesh, i: number, a: THREE.Vector3, b: THREE.Vector3, ech: number): void => {
    const longueur = Math.max(1e-5, a.distanceTo(b))
    _position.copy(a).lerp(b, 0.5)
    _quat.setFromUnitVectors(AXE_Y, _b.copy(b).sub(a).divideScalar(longueur))
    _echelle.set(ech, longueur, ech)
    _matrice.compose(_position, _quat, _echelle)
    amas.setMatrixAt(i, _matrice)
  }

  const animer = (temps: number): void => {
    const p = ((temps / PERIODE) % 1 + 1) % 1
    const condense = lissage(p / P_CONDENSE_FIN)
    const congression = lissage((p - P_ENVELOPPE_OUT) / (P_CONGRESSION_FIN - P_ENVELOPPE_OUT))
    const separation = lissage((p - P_ANAPHASE) / (P_ANAPHASE_FIN - P_ANAPHASE))
    const pincement = lissage((p - P_TELO_DEB) / (P_RESET - P_TELO_DEB))
    const fondu = 1 - lissage((p - P_RESET) / (1 - P_RESET))

    // Les pôles s'écartent dès la prométaphase, encore un peu à l'anaphase B.
    const ecartPole = R * (0.35 + 0.35 * congression + 0.18 * separation)
    centroA.position.set(0, ecartPole, 0)
    centroB.position.set(0, -ecartPole, 0)

    // La cellule se pince : deux moitiés qui s'éloignent, l'anneau qui serre.
    const allonge = 1 + pincement * 0.55
    moitieA.position.set(0, pincement * R * 0.62, 0)
    moitieB.position.set(0, -pincement * R * 0.62, 0)
    moitieA.scale.set(1 / (1 + pincement * 0.25), allonge / (1 + pincement * 0.35), 1 / (1 + pincement * 0.25))
    moitieB.scale.copy(moitieA.scale)
    anneau.scale.setScalar(Math.max(0.02, 1 - pincement * 0.92))

    // L'enveloppe nucléaire : une, puis aucune, puis deux.
    const envOut = lissage((p - P_ENVELOPPE_OUT + 0.04) / 0.08)
    noyauUn.scale.setScalar(Math.max(0.001, (1 - envOut) * fondu))
    const refait = lissage((p - P_TELO_DEB - 0.05) / 0.12)
    noyauA.position.set(0, ecartPole * 0.6 + pincement * R * 0.3, 0)
    noyauB.position.set(0, -ecartPole * 0.6 - pincement * R * 0.3, 0)
    noyauA.scale.setScalar(Math.max(0.001, refait * fondu))
    noyauB.scale.setScalar(Math.max(0.001, refait * fondu))

    for (let c = 0; c < NB_CHROMOSOMES; c++) {
      const depart = departs[c]!
      const plaque = plaques[c]!
      // Oscillation de congression : la plaque n'est jamais parfaitement immobile.
      const oscille = Math.sin(p * 40 + c * 2.2) * 0.014 * congression * (1 - separation)
      for (let s = 0; s < 2; s++) {
        const signe = s === 0 ? 1 : -1
        // Avant l'anaphase les sœurs sont côte à côte ; après, chacune monte
        // vers son pôle — et c'est une RUPTURE, pas un glissement.
        _a.copy(depart)
          .lerp(plaque, Math.max(condense * 0.4, congression))
        _a.x += signe * 0.014 * (1 - separation)
        _a.y += oscille
        // L'anaphase : chaque sœur rejoint son pôle, tirée par son kinétochore.
        if (separation > 0) _a.y = _a.y * (1 - separation) + signe * ecartPole * 0.8 * separation
        // En télophase les chromatides rejoignent leur nouveau noyau et se décondensent.
        if (refait > 0) _a.lerp(s === 0 ? noyauA.position : noyauB.position, refait * 0.8)
        const grosseur = (0.35 + 0.65 * condense) * fondu * (1 - refait * 0.55)
        _quat.setFromAxisAngle(AXE_Y, c * 1.3 + s * 0.4)
        _matrice.compose(_a, _quat, _echelle.setScalar(Math.max(0.001, grosseur)))
        chromatides.setMatrixAt(c * 2 + s, _matrice)

        // Microtubule kinétochorien : du pôle au centromère de cette chromatide.
        _b.set(0, signe * ecartPole, 0)
        tendre(fuseau, c * 2 + s, _b, _a, congression * fondu * (1 - refait))
      }

      // La cohésine tient les sœurs — jusqu'à la séparase, et alors elle SAUTE.
      _a.copy(depart).lerp(plaque, Math.max(condense * 0.4, congression))
      const tenue = condense * (1 - lissage((p - P_ANAPHASE) / 0.03))
      _matrice.compose(_a, _quat, _echelle.setScalar(Math.max(0.001, tenue * fondu)))
      cohesines.setMatrixAt(c, _matrice)
    }
    chromatides.instanceMatrix.needsUpdate = true
    cohesines.instanceMatrix.needsUpdate = true

    // Microtubules astraux et interpolaires : le fuseau a une charpente.
    for (let k = 0; k < NB_KMT * 2; k++) {
      const signe = k < NB_KMT ? 1 : -1
      const angle = ((k % NB_KMT) / NB_KMT) * Math.PI * 2 + 0.4
      _a.set(0, signe * ecartPole, 0)
      _b.set(
        Math.cos(angle) * R * 0.45,
        -signe * ecartPole * 0.35,
        Math.sin(angle) * R * 0.45,
      )
      tendre(fuseau, NB_CHROMOSOMES * 2 + k, _a, _b, congression * fondu * (1 - refait))
    }
    fuseau.instanceMatrix.needsUpdate = true
    _echelle.setScalar(1)
  }

  animer(0)

  return [
    {
      cle: 'mitose',
      nom: 'Mitose : le fuseau, la cohésine, le pincement',
      // Le siège n'est pas le noyau : la mitose est l'événement qui le DÉFAIT,
      // et son héros mécanique est le fuseau — la plus grande structure de
      // microtubules qu'une cellule construise.
      siege: 'Cytosquelette',
      ralentissement: PERIODE / CYCLE_REEL,
      observable: {
        nom: 'chromatides',
        cycleReel: CYCLE_REEL,
        pourquoi:
          'Les chromatides portent le cycle entier — condensation, congression, ' +
          'anaphase, décondensation : une mitose humaine prend environ une heure, ' +
          "et c'est elle que le badge annonce.",
      },
      justificationFacteur:
        "Une mitose de cellule humaine dure de l'ordre d'une heure, dont la " +
        "moitié pour la seule métaphase ; le cycle tient ici en 30 s, soit un " +
        "accéléré d'environ ×120. L'anaphase réelle, elle, ne prend que " +
        'quelques minutes : à ce facteur elle reste un instant — et c\'en est un.',
      ellision:
        "C'EST UNE MAQUETTE, posée dans le cytoplasme comme la vignette levure " +
        'de la fermentation : la cellule bêta adulte ne se divise presque ' +
        'jamais (~0,5 % par an) et l\'écorché entier est interphasique — la ' +
        'mitose est montrée parce qu\'elle est universelle, sur une cellule ' +
        'stylisée de un micromètre. Quatre chromosomes pour quarante-six. Le ' +
        'point de contrôle du fuseau est réduit à l\'attente métaphasique : ' +
        'aucune capture ratée n\'est montrée, alors que la congression réelle ' +
        'en est pleine. Condensine, kinétochores, séparase et Aurora ne sont ' +
        'pas dessinés — on ne voit que leurs effets : la condensation, la ' +
        'capture, l\'instant où la cohésine saute.',
      description:
        'Une cellule ne « copie » pas son noyau : elle le DÉMONTE. La chromatine ' +
        'se condense en chromosomes — deux chromatides sœurs tenues par la ' +
        'COHÉSINE, le grain violet du centromère —, l\'enveloppe nucléaire se ' +
        'défait, et le fuseau bâti par les deux centrosomes capture chaque ' +
        'chromosome pour l\'amener à la plaque métaphasique, où tout oscille et ' +
        'attend. Le déclic est biochimique : quand le dernier kinétochore est ' +
        'capturé, la séparase clive la cohésine — regardez le grain violet ' +
        'sauter — et les sœurs partent chacune vers son pôle : l\'anaphase est ' +
        'une rupture, pas un glissement. Deux enveloppes se referment, les ' +
        'chromosomes se décondensent, et l\'anneau d\'actomyosine pince le ' +
        'cytoplasme en deux. Toute l\'anatomie du reste du site — centrosome ' +
        'dupliqué, microtubules dynamiques, moteurs — trouve ici son emploi.',
      objet: groupe,
      ancre: groupe.position.clone(),
      rayonCadrage: 1.3,
      couleur: TEINTES.chromatine,
      animer,
    },
  ]
}
