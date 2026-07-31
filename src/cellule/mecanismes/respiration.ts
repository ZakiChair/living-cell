import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import { siegeMitochondrie, type Mecanisme } from './contrat.js'

/**
 * La chaîne respiratoire et l'ATP synthase.
 *
 * C'est le mécanisme central de la bioénergétique, et le seul endroit de la
 * cellule où l'on trouve un moteur rotatif. Ce qu'il faut faire comprendre tient
 * en une phrase : la chaîne ne fabrique pas d'ATP, elle POMPE DES PROTONS ; et
 * c'est le retour de ces protons qui fait tourner un rotor, lequel fabrique
 * l'ATP. L'énergie transite par un gradient, pas par une molécule.
 *
 * La vue est un gros plan sur une crête, à l'échelle du complexe protéique, et
 * à la taille vraie : la portion représentée fait 160 nm, un complexe I en fait
 * 20. Rien n'est grossi — c'est la caméra qui descend à cette échelle.
 */

/** Posé sur une vraie mitochondrie, et non à des coordonnées littérales. */
const CENTRE = siegeMitochondrie(0)

/** Demi-longueur de la crête représentée, en unités de scène. */
const DEMI_LONGUEUR = 0.62
/** Épaisseur de la bicouche de la crête. */
const EPAISSEUR = 0.055

/** Le côté matrice est en bas, l'espace intermembranaire en haut. */
const MATRICE = -1
const INTERMEMBRANAIRE = 1

const NB_ELECTRONS = 14
const NB_PROTONS = 120

/** Un tour de rotor à l'écran, en secondes. */
export const DUREE_TOUR = 1.5

/**
 * La stœchiométrie commande le débit, et non l'inverse.
 *
 * La tête F1 a trois sites catalytiques et fabrique un ATP par tiers de tour :
 * trois par tour complet, donc deux par seconde d'écran. C'est le seul chiffre
 * choisi ici ; le nombre de molécules en vol s'en déduit.
 *
 * Le compte précédent était faux d'un facteur trois — vingt-six molécules à
 * 0,24 tour par seconde faisaient 9,4 ATP par tour là où la fiche en annonçait
 * trois. Écrire le débit et laisser l'effectif suivre rend l'écart impossible :
 * un réglage visuel ne peut plus déplacer la stœchiométrie en silence.
 */
export const ATP_PAR_TOUR = 3
export const ATP_PAR_SECONDE = ATP_PAR_TOUR / DUREE_TOUR
/** Huit en vol, chacun visible quatre secondes : le débit tombe juste. */
export const NB_ATP = 8
export const VITESSE_ATP = ATP_PAR_SECONDE / NB_ATP

/** Tours du rotor par seconde dans la cellule : c'est ce que le badge ralentit. */
export const TOURS_PAR_SECONDE_REELS = 130

/**
 * L'eau suit la même règle.
 *
 * Un NADH cède deux électrons, qui réduisent un demi-O₂ en une molécule d'eau,
 * et rapportent environ 2,5 ATP. Il naît donc une eau pour 2,5 ATP.
 */
const EAU_PAR_SECONDE = ATP_PAR_SECONDE / 2.5
const NB_EAU = 4
const VITESSE_EAU = EAU_PAR_SECONDE / NB_EAU

/** Teintes tenues dans tout le métabolisme. */
const TEINTE_ELECTRON = 0x56b4e9
const TEINTE_PROTON = 0xe69f00
const TEINTE_ATP = TEINTES.ribosome
const TEINTE_EAU = 0x3b8fc4

/**
 * Postes de la chaîne, en abscisse locale.
 *
 * L'ordre est celui du transfert : les électrons descendent une pente de
 * potentiel rédox, de −320 mV au NADH jusqu'à +820 mV pour le couple O₂/H₂O.
 * Trois des quatre complexes pompent des protons ; le complexe II, lui, ne pompe
 * pas — il ne fait qu'injecter des électrons issus du succinate. C'est une
 * exception que les schémas gomment toujours.
 */
const POSTES = {
  complexeI: -0.5,
  complexeII: -0.24,
  complexeIII: 0.02,
  complexeIV: 0.28,
  synthase: 0.54,
} as const

/** Les trois complexes qui pompent réellement des protons. */
const POMPES = [POSTES.complexeI, POSTES.complexeIII, POSTES.complexeIV]

// ── Temporaires hissés : animer() ne doit jamais allouer ───────────────────
const _position = new THREE.Vector3()
const _rotation = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)
const _matrice = new THREE.Matrix4()

/** Chemin d'un électron le long de la chaîne, en abscisse locale. */
const ETAPES_ELECTRON = [
  POSTES.complexeI,
  // Le coenzyme Q est une navette MOBILE dans la bicouche : c'est lui qui relie
  // les complexes I et II au complexe III, et il voyage dans le plan lipidique.
  (POSTES.complexeI + POSTES.complexeIII) / 2,
  POSTES.complexeIII,
  // Le cytochrome c est l'autre navette, mais celle-ci glisse SUR la face
  // externe de la membrane, côté espace intermembranaire.
  (POSTES.complexeIII + POSTES.complexeIV) / 2,
  POSTES.complexeIV,
]

function creerComplexe(
  x: number,
  largeur: number,
  hauteur: number,
  profondeur: number,
  couleur: number,
): THREE.Mesh {
  const maillage = new THREE.Mesh(
    new THREE.BoxGeometry(largeur, hauteur, profondeur, 2, 2, 2),
    materiauOrganite(couleur),
  )
  maillage.position.set(x, 0, 0)
  return maillage
}

export function creerRespiration(): Mecanisme[] {
  const alea = creerAlea(60_607)
  const groupe = new THREE.Group()
  groupe.position.copy(CENTRE)
  // La crête est inclinée : de face, un plan se lit comme une ligne.
  groupe.rotation.set(-0.22, 0.55, 0.08)

  // ── La crête : un repli de la membrane interne ──────────────────────────
  const crete = new THREE.Mesh(
    new THREE.BoxGeometry(DEMI_LONGUEUR * 2.3, EPAISSEUR, 0.42),
    materiauOrganite(TEINTES.mitochondrieCrete, { opacite: 0.62 }),
  )
  groupe.add(crete)

  // ── Les quatre complexes, de tailles et silhouettes distinctes ──────────
  // Le complexe I est de loin le plus gros — 45 sous-unités, un million de
  // daltons — et sa forme en L est sa signature.
  const complexeI = new THREE.Group()
  complexeI.add(creerComplexe(POSTES.complexeI, 0.1, 0.16, 0.14, 0x0072b2))
  const brasI = creerComplexe(POSTES.complexeI - 0.03, 0.05, 0.1, 0.1, 0x0072b2)
  brasI.position.y = -0.11
  complexeI.add(brasI)
  groupe.add(complexeI)

  groupe.add(creerComplexe(POSTES.complexeII, 0.07, 0.09, 0.1, 0x009e73))

  // Le complexe III fonctionne en dimère : deux moitiés accolées.
  groupe.add(creerComplexe(POSTES.complexeIII - 0.025, 0.05, 0.13, 0.11, 0xcc79a7))
  groupe.add(creerComplexe(POSTES.complexeIII + 0.025, 0.05, 0.13, 0.11, 0xcc79a7))

  groupe.add(creerComplexe(POSTES.complexeIV, 0.08, 0.12, 0.12, 0xd55e00))

  // ── L'ATP synthase : le plus petit moteur rotatif connu ─────────────────
  const synthase = new THREE.Group()
  synthase.position.set(POSTES.synthase, 0, 0)

  // Le rotor F0, enchâssé dans la membrane. C'est lui qui tourne.
  const rotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, EPAISSEUR * 1.5, 12, 1),
    materiauOrganite(0xa84800),
  )
  // Des crans visibles, sinon une rotation sur un cylindre lisse ne se voit pas.
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2
    const cran = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, EPAISSEUR * 1.5, 0.014),
      materiauOrganite(0x7a3400),
    )
    cran.position.set(Math.cos(angle) * 0.055, 0, Math.sin(angle) * 0.055)
    rotor.add(cran)
  }
  synthase.add(rotor)

  // La tige centrale, solidaire du rotor.
  const tige = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8),
    materiauOrganite(0x7a3400),
  )
  tige.position.y = MATRICE * 0.075
  rotor.add(tige)

  // La tête F1, côté matrice, où l'ATP est fabriqué. Elle NE tourne pas : elle
  // est tenue par un bras statorique, et c'est la tige qui tourne dedans. Ses
  // trois sites catalytiques passent par trois conformations à chaque tour.
  const teteF1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 20, 14),
    materiauOrganite(0xe0851a, { opacite: 0.9 }),
  )
  teteF1.position.y = MATRICE * 0.135
  teteF1.scale.set(1, 0.85, 1)
  synthase.add(teteF1)

  // Le bras statorique : sans lui la tête tournerait avec la tige et rien ne
  // se passerait. C'est la pièce que tous les schémas oublient.
  const stator = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.16, 0.012),
    materiauOrganite(0x6b6357),
  )
  stator.position.set(0.078, MATRICE * 0.09, 0)
  synthase.add(stator)

  groupe.add(synthase)

  // ── Les navettes mobiles ────────────────────────────────────────────────
  const coenzymeQ = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.022, 1),
    materiauOrganite(0xf0c040),
  )
  groupe.add(coenzymeQ)

  const cytochromeC = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.018, 1),
    materiauOrganite(0xb04a00),
  )
  groupe.add(cytochromeC)

  // ── Électrons, protons, ATP, eau ────────────────────────────────────────
  const electrons = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.011, 1),
    materiauOrganite(TEINTE_ELECTRON, { emissif: 0x1a4a6b }),
    NB_ELECTRONS,
  )
  electrons.frustumCulled = false
  groupe.add(electrons)

  const protons = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.009, 0),
    materiauOrganite(TEINTE_PROTON),
    NB_PROTONS,
  )
  protons.frustumCulled = false
  groupe.add(protons)

  const atp = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.02, 1),
    materiauOrganite(TEINTE_ATP),
    NB_ATP,
  )
  atp.frustumCulled = false
  // Nommé pour que le test D3 puisse retrouver l'amas et COMPTER les naissances
  // qu'`animer` produit, au lieu de relire les constantes qui les commandent.
  atp.name = 'atp'
  groupe.add(atp)

  const eau = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.012, 0),
    materiauOrganite(TEINTE_EAU),
    NB_EAU,
  )
  eau.frustumCulled = false
  groupe.add(eau)

  // Phases figées à la construction : le hasard ne doit pas entrer dans animer().
  const phaseElectron = new Float32Array(NB_ELECTRONS)
  for (let i = 0; i < NB_ELECTRONS; i++) phaseElectron[i] = i / NB_ELECTRONS

  const phaseProton = new Float32Array(NB_PROTONS)
  const pompeProton = new Int8Array(NB_PROTONS)
  const derveProton = new Float32Array(NB_PROTONS * 2)
  for (let i = 0; i < NB_PROTONS; i++) {
    phaseProton[i] = alea()
    // Trois quarts des protons sont pompés par un des trois complexes ; le
    // dernier quart redescend par la synthase. Le déséquilibre entretient le
    // gradient au lieu de le vider.
    pompeProton[i] = i % 4 === 3 ? -1 : (i % 3) as -1 | 0 | 1
    derveProton[i * 2] = (alea() - 0.5) * 0.3
    derveProton[i * 2 + 1] = (alea() - 0.5) * 0.32
  }

  const phaseAtp = new Float32Array(NB_ATP)
  const derveAtp = new Float32Array(NB_ATP * 2)
  for (let i = 0; i < NB_ATP; i++) {
    phaseAtp[i] = alea()
    derveAtp[i * 2] = (alea() - 0.5) * 0.5
    derveAtp[i * 2 + 1] = (alea() - 0.5) * 0.36
  }

  const phaseEau = new Float32Array(NB_EAU)
  for (let i = 0; i < NB_EAU; i++) phaseEau[i] = alea()

  const animer = (temps: number): void => {
    // ── Le rotor tourne, et c'est le cœur de la démonstration ─────────────
    rotor.rotation.y = (temps / DUREE_TOUR) * Math.PI * 2

    // ── Les électrons descendent la chaîne ────────────────────────────────
    for (let i = 0; i < NB_ELECTRONS; i++) {
      const t = (temps * 0.22 + phaseElectron[i]!) % 1
      // Progression par segments : l'électron saute d'un poste au suivant.
      const brut = t * (ETAPES_ELECTRON.length - 1)
      const segment = Math.min(ETAPES_ELECTRON.length - 2, Math.floor(brut))
      const local = brut - segment
      const x =
        ETAPES_ELECTRON[segment]! +
        (ETAPES_ELECTRON[segment + 1]! - ETAPES_ELECTRON[segment]!) * local
      // La descente de potentiel rédox se lit comme une descente réelle.
      const y = 0.045 - t * 0.05
      _position.set(x, y, Math.sin(t * 9 + i) * 0.03)
      _echelle.setScalar(1)
      _matrice.compose(_position, _rotation, _echelle)
      electrons.setMatrixAt(i, _matrice)
    }
    electrons.instanceMatrix.needsUpdate = true

    // Les navettes suivent le flux au lieu de rester plantées.
    const tq = (temps * 0.22) % 1
    coenzymeQ.position.set(
      POSTES.complexeI + (POSTES.complexeIII - POSTES.complexeI) * tq,
      -0.01,
      Math.sin(tq * Math.PI * 2) * 0.06,
    )
    const tc = (temps * 0.22 + 0.5) % 1
    cytochromeC.position.set(
      POSTES.complexeIII + (POSTES.complexeIV - POSTES.complexeIII) * tc,
      INTERMEMBRANAIRE * 0.055,
      Math.sin(tc * Math.PI * 2) * 0.05,
    )

    // ── Les protons : pompés vers le haut, ils redescendent par la synthase ─
    for (let i = 0; i < NB_PROTONS; i++) {
      const t = (temps * 0.3 + phaseProton[i]!) % 1
      const versLaSynthase = pompeProton[i]! === -1
      let x: number
      let y: number

      if (versLaSynthase) {
        // Retour : le proton dérive dans l'espace intermembranaire, puis
        // traverse le rotor vers la matrice. C'est ce passage qui fait tourner.
        if (t < 0.6) {
          const u = t / 0.6
          x = -0.4 + (POSTES.synthase + 0.4) * u + derveProton[i * 2]! * 0.2
          y = INTERMEMBRANAIRE * (0.1 + derveProton[i * 2 + 1]! * 0.12)
        } else {
          const u = (t - 0.6) / 0.4
          x = POSTES.synthase
          y = INTERMEMBRANAIRE * 0.1 - u * 0.24
        }
      } else {
        // Pompage : le proton part de la matrice, traverse un complexe et
        // ressort côté intermembranaire, où il s'accumule.
        const poste = POMPES[pompeProton[i]!]!
        if (t < 0.45) {
          const u = t / 0.45
          x = poste + derveProton[i * 2]! * (1 - u) * 0.4
          y = MATRICE * (0.16 - u * 0.16) + derveProton[i * 2 + 1]! * (1 - u) * 0.1
        } else {
          const u = (t - 0.45) / 0.55
          x = poste + derveProton[i * 2]! * u * 0.55
          y = INTERMEMBRANAIRE * (0.04 + u * 0.14) + derveProton[i * 2 + 1]! * u * 0.1
        }
      }

      _position.set(x, y, derveProton[i * 2 + 1]! * 0.5)
      _echelle.setScalar(1)
      _matrice.compose(_position, _rotation, _echelle)
      protons.setMatrixAt(i, _matrice)
    }
    protons.instanceMatrix.needsUpdate = true

    // ── L'ATP sort de la tête F1 et diffuse dans la matrice ───────────────
    for (let i = 0; i < NB_ATP; i++) {
      const t = (temps * VITESSE_ATP + phaseAtp[i]!) % 1
      // Un ATP naît à chaque tiers de tour : trois par tour complet.
      const naissance = Math.min(1, t * 8)
      _position.set(
        POSTES.synthase + derveAtp[i * 2]! * t,
        MATRICE * (0.2 + t * 0.42),
        derveAtp[i * 2 + 1]! * t,
      )
      _echelle.setScalar(naissance * (1 - t * 0.25))
      _matrice.compose(_position, _rotation, _echelle)
      atp.setMatrixAt(i, _matrice)
    }
    atp.instanceMatrix.needsUpdate = true

    // ── L'eau produite au complexe IV, là où l'oxygène accepte les électrons ─
    for (let i = 0; i < NB_EAU; i++) {
      const t = (temps * VITESSE_EAU + phaseEau[i]!) % 1
      _position.set(
        POSTES.complexeIV + (phaseEau[i]! - 0.5) * 0.2 * t,
        MATRICE * (0.12 + t * 0.34),
        (phaseEau[i]! - 0.5) * 0.18 * t,
      )
      _echelle.setScalar(Math.min(1, t * 6) * (1 - t * 0.3))
      _matrice.compose(_position, _rotation, _echelle)
      eau.setMatrixAt(i, _matrice)
    }
    eau.instanceMatrix.needsUpdate = true

    // Léger vacillement d'ensemble : rien n'est immobile dans une cellule.
    groupe.rotation.z = 0.08 + Math.sin(temps * 0.4) * 0.012
  }

  animer(0)

  return [
    {
      cle: 'respiration',
      nom: 'Chaîne respiratoire et ATP synthase',
      siege: 'Mitochondrie',
      facteur: 'ralenti ×200',
      justificationFacteur:
        "L'ATP synthase tourne à environ 130 tours par seconde : un tour prend 8 ms, " +
        "ce qui devient 1,5 s à l'écran et se suit à l'œil — un ralenti de 200, arrondi " +
        'depuis les 195 que donne le calcul exact. Rien n’est agrandi : la ' +
        'portion de crête représentée fait 160 nm, un complexe I en fait 20, et il ' +
        "faut donc descendre à cette échelle pour les voir — c'est ce que fait la " +
        'caméra, et la barre en bas à droite dit où on en est.',
      ellision:
        "Le débit d'ATP est juste — trois par tour, deux par seconde d'écran — mais les EFFECTIFS " +
        "sont échantillonnés : huit ATP et quatre molécules d'eau en vol à la fois, là où une crête " +
        "réelle en libère un flot continu. Les quatorze électrons et les cent vingt protons sont de " +
        "même des représentants, pas un inventaire. Une seule crête est montrée sur les quelques " +
        "dizaines d'une mitochondrie, et les complexes y sont espacés régulièrement alors qu'ils " +
        "sont en réalité rassemblés en supercomplexes mobiles.",
      description:
        "La chaîne ne fabrique pas d'ATP : elle pompe des protons. Les électrons " +
        "arrivés du NADH descendent une pente de potentiel rédox, de −320 mV jusqu'à " +
        "+820 mV pour l'oxygène, et à chaque marche les complexes I, III et IV " +
        "éjectent des protons hors de la matrice. Le complexe II, lui, ne pompe pas : " +
        "il ne fait qu'injecter des électrons. Le gradient ainsi créé est la vraie " +
        "monnaie d'énergie. Les protons qui redescendent traversent le rotor de l'ATP " +
        'synthase et le font tourner ; la tête F1, tenue immobile par un bras ' +
        "statorique, voit sa tige tourner dedans et fabrique un ATP par tiers de tour. " +
        "C'est le plus petit moteur rotatif connu. Au bout de la chaîne, l'oxygène " +
        "accepte les électrons et devient de l'eau — il ne brûle rien, il tire.",
      objet: groupe,
      ancre: CENTRE.clone(),
      rayonCadrage: 0.78,
      couleur: TEINTES.mitochondrie,
      animer,
    },
  ]
}
