import * as THREE from 'three'
import { siegeMitochondrie, type Mecanisme } from './contrat.js'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'

/**
 * LE DESTIN DU PYRUVATE : L'OXYGÈNE OU LA FERMENTATION.
 *
 * Le pyruvate sort de la glycolyse et se présente devant un aiguillage. Ce qui
 * décide n'est pas une porte qui s'ouvre ou se ferme : les deux chemins restent
 * physiquement ouverts en permanence. Ce qui décide est EN AVAL, et c'est tout
 * l'intérêt de la scène :
 *
 *   — l'oxygène est l'ACCEPTEUR FINAL D'ÉLECTRONS. Au complexe IV, O₂ + 4 e⁻ +
 *     4 H⁺ donnent 2 H₂O. Il ne pousse rien : il TIRE la file d'électrons.
 *   — qu'il manque, et le complexe IV se remplit, puis le III, puis le I. Le
 *     blocage remonte de proche en proche. Le NADH n'est plus réoxydé.
 *   — le NAD⁺ s'épuise, et la glycolyse — qui en consomme un par pyruvate à son
 *     étape 6 — s'arrête à son tour, faute de cofacteur.
 *   — la fermentation NE PRODUIT PAS D'ATP. Elle rend le NAD⁺, et c'est pour
 *     cela seulement qu'elle existe. Le lactate est un déchet, pas un but.
 *
 * Le compteur du bas rend le tout comptable : deux pastilles pour la glycolyse
 * seule, trente pour la respiration complète, côte à côte et à la même échelle.
 */

// ── Repères, en micromètres (1 unité = 1 µm) ───────────────────────────────

/** Cytosol, contre la glycolyse que le module voisin place à (-6.5, -4.2, -1.5). */
/** Posé sur une vraie mitochondrie, et non à des coordonnées littérales. */
const SIEGE = siegeMitochondrie(3)

/** Rayon du champ : au-delà, tout est renvoyé vers le centre. */
const RAYON_CHAMP = 1.25

/**
 * Faces des deux membranes mitochondriales, sur l'axe x.
 *
 * Toute la scène est tenue dans un plan : le cytosol à gauche, la mitochondrie
 * à droite, la chaîne respiratoire en COLONNE dans la membrane interne. Rangée
 * en profondeur, cette chaîne se verrait par la tranche et ne se lirait pas.
 */
const X_MEMBRANE_EXTERNE = 0.1
const X_MEMBRANE_INTERNE = 0.32
/** Un métabolite du cytosol ne franchit pas la membrane ailleurs qu'au pore. */
const LIMITE_CYTOSOL = 0.06
/** Ni un métabolite de la matrice, dans l'autre sens. */
const LIMITE_MATRICE = 0.44

// ── Postes fixes. Une voie métabolique est une chaîne de postes, pas une soupe ─
const POSTE_ENTREE = 0
const POSTE_GAPDH = 1
const POSTE_CARREFOUR = 2
const POSTE_PORE = 3
const POSTE_PDH = 4
const POSTE_KREBS = 5
const POSTE_LDH = 6
const POSTE_LACTATE = 7
const POSTE_NAVETTE = 8
const POSTE_I = 9
const POSTE_III = 10
const POSTE_IV = 11
const POSTE_SYNTHASE = 12
const POSTE_BULBE = 13
const POSTE_PDC = 14
const POSTE_ADH = 15
const POSTE_PORE_MATRICE = 16

/** Coordonnées locales des postes, dans l'ordre des constantes ci-dessus. */
const POSTES = new Float32Array([
  -0.74, 1.0, -0.3, // entrée : le pyruvate arrive de la glycolyse
  -0.8, 0.66, -0.2, // GAPDH : l'étape 6 de la glycolyse, celle qui prend le NAD⁺
  -0.36, 0.3, 0.0, // carrefour : l'aiguillage proprement dit
  0.02, 0.62, -0.1, // pore MPC, bouche côté cytosol
  0.74, 0.6, -0.1, // complexe pyruvate déshydrogénase, dans la matrice
  1.14, 0.96, -0.24, // départ vers le cycle de Krebs, à (5.4, 1.4, -1.2)
  -0.72, -0.32, 0.16, // lactate déshydrogénase
  -1.14, -0.7, 0.34, // sortie du lactate, vers le foie
  0.02, 0.02, 0.1, // navette malate-aspartate, face cytosolique
  0.32, 0.02, 0.1, // complexe I
  0.32, -0.34, 0.1, // complexe III
  0.32, -0.7, 0.1, // complexe IV : l'oxygène s'y fixe
  0.32, 0.44, 0.22, // ATP synthase
  -0.34, 1.06, 0.3, // réserve d'oxygène : l'indicateur qui bascule
  0.3, -1.06, 0.5, // vignette levure : pyruvate décarboxylase
  0.72, -1.06, 0.5, // vignette levure : alcool déshydrogénase
  0.44, 0.62, -0.1, // pore MPC, bouche côté matrice
])

const posteX = (p: number): number => POSTES[p * 3]!
const posteY = (p: number): number => POSTES[p * 3 + 1]!
const posteZ = (p: number): number => POSTES[p * 3 + 2]!

// ── Régime d'oxygène ───────────────────────────────────────────────────────
/** Sept secondes avec, sept secondes sans : les deux régimes se comparent. */
const O2_DUREE_PRESENT = 7
const O2_PERIODE = 14
/** Décalage : on démarre en aérobie et la première bascule tombe à t ≈ 4 s. */
const O2_PHASE = 3

// ── Peuplement : peu d'acteurs, tous suivables à l'œil ─────────────────────
const NB_SUBSTRATS = 6
const NB_VIGNETTE = 2
const NB_ACTEURS_C = NB_SUBSTRATS + NB_VIGNETTE
const BILLES_C = 3
const NB_NAVETTES = 4
/** Une navette décorative en plus, garée sur l'alcool déshydrogénase de la vignette. */
const NAVETTE_VIGNETTE = NB_NAVETTES
const NB_NAVETTES_RENDUES = NB_NAVETTES + 1
const NB_ELECTRONS = 12
const NB_O2 = 4
const NB_CO2 = 8
const NB_H2O = 10
const NB_ATP_VOL = 14

// ── Espèces carbonées. Le substrat CHANGE de forme et de couleur à chaque étape ─
const ESP_AUCUNE = 0
const ESP_PYRUVATE = 1
const ESP_ACETYL = 2
const ESP_LACTATE = 3
const ESP_ACETALDEHYDE = 4
const ESP_ETHANOL = 5
const NB_MAILLAGES_C = 5
/** Nombre de carbones dessinés, par espèce : 3 pour le pyruvate, 2 après le CO₂. */
const CARBONES = new Int8Array([0, 3, 2, 3, 2, 2])

// ── Capacités de la chaîne respiratoire ────────────────────────────────────
const CAP_I = 2
const CAP_III = 3
/** Quatre : c'est exactement ce qu'il faut pour réduire un O₂ en deux H₂O. */
const CAP_IV = 4
const CAPACITES = new Int8Array([CAP_I, CAP_III, CAP_IV])
/** Poste de chaque maillon de la chaîne, dans l'ordre du parcours. */
const POSTE_MAILLON = new Int8Array([POSTE_I, POSTE_III, POSTE_IV])

// ── États des substrats ────────────────────────────────────────────────────
const S_ABSENT = 0
const S_DIFFUSE = 1
const S_TRAVERSE = 2
const S_AU_PDH = 3
const S_VERS_KREBS = 4
const S_AU_LDH = 5
const S_SORT_LACTATE = 6

// ── États des navettes NAD⁺/NADH ───────────────────────────────────────────
const N_VERS_GAPDH = 0
const N_AU_GAPDH = 1
const N_VERS_CONSO = 2
const N_AU_CONSO = 3

// ── Durées d'écran ─────────────────────────────────────────────────────────
const DUREE_GAPDH = 0.35
const DUREE_PDH = 0.60
const DUREE_LDH = 0.42
const DUREE_PORE = 0.45
const DUREE_SORTIE = 0.85
const DUREE_SAUT = 0.22
const DUREE_VOL_ATP = 0.95
const DUREE_CO2 = 2.60
const DUREE_H2O = 2.20
const PERIODE_VIGNETTE = 4.2

/** Au-delà, un substrat qui n'a rien trouvé change de cible. */
const PATIENCE_CYTOSOL = 1.8
/** Au-delà, un pyruvate coincé dans la matrice ressort par le pore. */
const PATIENCE_MATRICE = 1.5
/** Au-delà, un NADH garé sur la LDH repart vers la mitochondrie si elle accepte. */
const PATIENCE_LDH = 1.2

// ── Cinétique de la diffusion ──────────────────────────────────────────────
const VITESSE_SUBSTRAT = 0.18
const VITESSE_NAVETTE = 0.26
const TAU_DERIVE = 0.22
const FACTEUR_IMPULSION = 6.7
/**
 * Le biais qui fait qu'une rencontre finit par arriver — jamais un rail.
 * Il est calibré pour que la dérive dirigée l'emporte de loin, et se dissolve
 * dans l'agitation à l'approche du poste : c'est là que se jouent les ratés.
 */
const FORCE_VISEE = 10.0
/** Rayon d'accrochage : en dessous, la rencontre a lieu. */
const RAYON_ACCROCHE = 0.16
/** Un refus doit se VOIR : le métabolite est chassé, pas simplement arrêté. */
const IMPULSION_REFUS = 0.42

// ── Dimensions de représentation ───────────────────────────────────────────
/** Un carbone. Un pyruvate réel fait 0,7 nm : celui-ci en fait 50. */
const RAYON_CARBONE = 0.026
const PAS_CARBONE = 0.056
const RAYON_CO2 = 0.022
const RAYON_H2O = 0.030
const RAYON_O2 = 0.030
const PAS_O2 = 0.050
const RAYON_ELECTRON = 0.015
const RAYON_HYDRURE = 0.020
const RAYON_PASTILLE = 0.028

// ── Le compteur du bas : deux barres à la même échelle ─────────────────────
const NB_SLOTS_A = 2
const NB_SLOTS_B = 30
const NB_SLOTS = NB_SLOTS_A + NB_SLOTS_B
const PAS_SLOT = 0.068
/** Même pas, même hauteur de rangée : le rapport 2 contre 30 se lit en longueur. */
const X_RACK_A = -1.14
const X_RACK_B = -1.0
const Y_RACK = -0.98
const Z_RACK = 0.38
/** 2,5 ATP par NADH, 4 électrons consommés d'un coup : 5 pastilles par O₂ réduit. */
const ATP_PAR_O2 = 5

// ── Teintes. Elles sont tenues d'un module à l'autre ───────────────────────
const TEINTE_NAD = TEINTES.reticulumLisse
const TEINTE_ATP = TEINTES.ribosome
const TEINTE_CO2 = 0x8f8b85
const TEINTE_EAU = TEINTES.chromatine
const TEINTE_O2 = 0xb5342a
const TEINTE_PYRUVATE = TEINTES.golgi
/** Vert feuille, franchement jaune : à ne pas confondre avec le NAD, bleu-vert. */
const TEINTE_ACETYL = 0x4c8c1f
const TEINTE_LACTATE = TEINTES.lysosome
const TEINTE_ACETALDEHYDE = 0xd9c8a6
const TEINTE_ETHANOL = 0xa07d3e
const TEINTE_ENZYME_CYTOSOL = TEINTES.noyau
const TEINTE_ENZYME_MITO = TEINTES.mitochondrieCrete
const TEINTE_COMPLEXE_IV = 0x7a2d10
const TEINTE_HYDRURE = 0xffe27a
/**
 * Les membranes prennent le brun de la crête, pas le vermillon de la
 * mitochondrie : ce vermillon-là est celui de l'ATP, et il ne doit servir qu'à
 * lui — un mur de la couleur de la monnaie brouillerait tout le compteur.
 */
const TEINTE_MEMBRANE = TEINTES.mitochondrieCrete

// ── Anneaux d'activité : un poste allumé travaille, un poste éteint est bloqué ─
const ANNEAU_GAPDH = 0
const ANNEAU_LDH = 1
const ANNEAU_PDH = 2
const ANNEAU_NAVETTE = 3
const ANNEAU_I = 4
const ANNEAU_III = 5
const ANNEAU_IV = 6
const ANNEAU_SYNTHASE = 7
const NB_ANNEAUX = 8
/** Poste porté par chaque anneau. */
const POSTE_ANNEAU = new Int8Array([
  POSTE_GAPDH,
  POSTE_LDH,
  POSTE_PDH,
  POSTE_NAVETTE,
  POSTE_I,
  POSTE_III,
  POSTE_IV,
  POSTE_SYNTHASE,
])
/** Rayon de chaque anneau, ajusté au volume du poste qu'il cercle. */
const RAYON_ANNEAU = new Float32Array([0.13, 0.15, 0.24, 0.12, 0.13, 0.12, 0.13, 0.12])
/** Composantes de l'émissif à pleine activité, par anneau. */
const EMISSIF_ANNEAU = new Float32Array([
  0.15, 0.55, 0.85, // GAPDH, bleu cytosol
  0.15, 0.55, 0.85, // LDH
  0.85, 0.35, 0.08, // PDH, orange mitochondrie
  0.15, 0.55, 0.85, // navette, côté cytosol
  0.85, 0.35, 0.08, // complexe I
  0.85, 0.35, 0.08, // complexe III
  0.95, 0.25, 0.12, // complexe IV, le site de l'oxygène
  0.95, 0.45, 0.05, // ATP synthase
])

// ── Disposition des sous-unités des postes enzymatiques ────────────────────
/** GAPDH et LDH sont deux homotétramères : quatre sous-unités, disposées en tétraèdre. */
const TETRAEDRE = new Float32Array([
  0.052, 0.052, 0.052, -0.052, -0.052, 0.052, -0.052, 0.052, -0.052, 0.052, -0.052, -0.052,
])
/** Complexe I : la crosse caractéristique, un bras dans la membrane et un dans la matrice. */
const LOBES_COMPLEXE_I = new Float32Array([
  0.0, -0.07, 0.0, 0.05, 0.0, -0.03, 0.05, 0.0, 0.02, 0.14, 0.03, 0.0, 0.22, 0.05, 0.0,
])
/** Complexe III : un dimère trapu. */
const LOBES_COMPLEXE_III = new Float32Array([
  0.0, -0.05, -0.05, 0.0, -0.05, 0.05, 0.11, 0.03, -0.04, 0.11, 0.03, 0.04,
])
/** Complexe IV : trapu lui aussi, avec le site à cuivre tourné vers la matrice. */
const LOBES_COMPLEXE_IV = new Float32Array([
  0.0, -0.06, 0.0, 0.06, 0.0, -0.06, 0.06, 0.0, 0.06, 0.13, 0.04, 0.0, 0.19, 0.02, 0.0,
])
/** Trois lobes pour les petites enzymes de la vignette et pour la navette. */
const LOBES_TRIADE = new Float32Array([0.0, 0.05, 0.0, 0.045, -0.03, 0.02, -0.045, -0.03, -0.02])

// ── Temporaires hissés : animer() ne doit RIEN allouer ─────────────────────
const matriceTemp = new THREE.Matrix4()
const positionTemp = new THREE.Vector3()
const quaternionTemp = new THREE.Quaternion()
const echelleTemp = new THREE.Vector3(1, 1, 1)
const directionTemp = new THREE.Vector3()
const AXE_X = new THREE.Vector3(1, 0, 0)
/** Axe naturel d'un cylindre Three.js : c'est lui qu'on fait pivoter. */
const AXE_Y_LOCAL = new THREE.Vector3(0, 1, 0)

/** Sorties de `axeTumble`, lues juste après l'appel. */
let axeTumbleX = 1
let axeTumbleY = 0
let axeTumbleZ = 0

/** Axe de la molécule, qui culbute lentement : rien n'est figé dans le cytosol. */
function axeTumble(phase: number, temps: number): void {
  const a = phase * 6.283 + temps * 0.8
  const b = phase * 4.1 + temps * 0.55
  const sb = Math.sin(b)
  axeTumbleX = Math.cos(a) * sb
  axeTumbleY = Math.cos(b)
  axeTumbleZ = Math.sin(a) * sb
}

export function creerFermentation(): Mecanisme[] {
  const alea = creerAlea(70_413)
  const groupe = new THREE.Group()
  groupe.position.copy(SIEGE)

  const geoBlob = new THREE.IcosahedronGeometry(1, 1)
  const geoGrain = new THREE.IcosahedronGeometry(1, 0)
  const geoAnneau = new THREE.TorusGeometry(1, 0.055, 6, 22)

  // ── Décor : les deux membranes de la mitochondrie et sa matrice ──────────
  // On ne voit ici qu'un coin de mitochondrie : elle mesure 1 à 2 µm de long,
  // soit toute la hauteur de ce champ.
  const membraneExterne = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 1.86, 1.24),
    materiauOrganite(TEINTE_MEMBRANE, { opacite: 0.34 }),
  )
  membraneExterne.position.set(X_MEMBRANE_EXTERNE, 0, 0.02)
  const membraneInterne = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 1.76, 1.18),
    materiauOrganite(TEINTE_MEMBRANE, { opacite: 0.55 }),
  )
  membraneInterne.position.set(X_MEMBRANE_INTERNE, 0, 0.02)
  const matriceVolume = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.72, 1.14),
    materiauOrganite(TEINTE_MEMBRANE, { opacite: 0.1 }),
  )
  matriceVolume.position.set(X_MEMBRANE_INTERNE + 0.47, 0, 0.02)
  // Ces trois volumes sont des enveloppes : elles teintent ce qu'il y a derrière
  // mais ne doivent jamais le cacher, sinon la chaîne disparaît sous sa membrane.
  for (const enveloppe of [membraneExterne, membraneInterne, matriceVolume]) {
    ;(enveloppe.material as THREE.MeshLambertMaterial).depthWrite = false
  }
  groupe.add(membraneExterne, membraneInterne, matriceVolume)

  // Le pore MPC : un tube qui traverse les deux membranes, toujours ouvert.
  // Ce n'est JAMAIS lui qui décide : ce qui bloque est plus loin.
  const pore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.46, 12, 1, true),
    materiauOrganite(TEINTE_ENZYME_MITO, { opacite: 0.75 }),
  )
  pore.position.set(0.23, posteY(POSTE_PORE), posteZ(POSTE_PORE))
  pore.rotation.z = Math.PI / 2
  groupe.add(pore)

  // Cartouche de la vignette « levure », pour qu'elle se lise comme un encart.
  const cartouche = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.4, 0.012),
    materiauOrganite(TEINTES.cytosquelette, { opacite: 0.3 }),
  )
  cartouche.position.set(0.51, -1.03, 0.4)
  groupe.add(cartouche)

  // ── Le compteur : deux plaques, l'une d'une colonne, l'autre de quinze ───
  const plaqueA = new THREE.Mesh(
    new THREE.BoxGeometry(0.096, 0.155, 0.012),
    materiauOrganite(TEINTES.centriole, { opacite: 0.45 }),
  )
  plaqueA.position.set(X_RACK_A, Y_RACK - PAS_SLOT * 0.5, Z_RACK - 0.035)
  const plaqueB = new THREE.Mesh(
    new THREE.BoxGeometry(PAS_SLOT * 14 + 0.096, 0.155, 0.012),
    materiauOrganite(TEINTES.centriole, { opacite: 0.45 }),
  )
  plaqueB.position.set(X_RACK_B + PAS_SLOT * 7, Y_RACK - PAS_SLOT * 0.5, Z_RACK - 0.035)
  groupe.add(plaqueA, plaqueB)

  // ── La jauge de NAD⁺ : la seule grandeur qui commande tout le reste ──────
  const HAUTEUR_JAUGE = 0.42
  const X_JAUGE = -1.16
  const Y_JAUGE = 0.6
  const Z_JAUGE = -0.05
  const cadreJauge = new THREE.Mesh(
    new THREE.BoxGeometry(0.062, HAUTEUR_JAUGE + 0.02, 0.062),
    materiauOrganite(TEINTES.centriole, { opacite: 0.3 }),
  )
  cadreJauge.position.set(X_JAUGE, Y_JAUGE, Z_JAUGE)
  const barreJauge = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 1, 0.042),
    materiauOrganite(TEINTE_NAD, { emissif: 0x0a3a2c }),
  )
  groupe.add(cadreJauge, barreJauge)

  // ── L'indicateur d'oxygène ───────────────────────────────────────────────
  const materiauBulbe = materiauOrganite(TEINTE_O2, { doubleFace: false })
  const bulbe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 2), materiauBulbe)
  bulbe.position.set(posteX(POSTE_BULBE), posteY(POSTE_BULBE), posteZ(POSTE_BULBE))
  groupe.add(bulbe)

  // ── L'aiguillage ────────────────────────────────────────────────────────
  // Deux quais partent du carrefour, sous l'indicateur d'oxygène : l'un vers la
  // mitochondrie, l'autre vers la lactate déshydrogénase. Celui qui est allumé
  // est celui qu'on emprunte — mais AUCUN des deux n'est jamais fermé, et c'est
  // tout le sujet : ce qui décide se passe au bout de l'autre chemin.
  const moyeu = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.05, 1),
    materiauOrganite(TEINTES.centriole, { doubleFace: false }),
  )
  moyeu.position.set(posteX(POSTE_CARREFOUR), posteY(POSTE_CARREFOUR), posteZ(POSTE_CARREFOUR))
  groupe.add(moyeu)

  const geoQuai = new THREE.CylinderGeometry(0.012, 0.03, 1, 8)
  const materiauQuaiMito = materiauOrganite(TEINTES.centriole, { doubleFace: false })
  const materiauQuaiFerment = materiauOrganite(TEINTES.centriole, { doubleFace: false })
  const LONGUEUR_QUAI = 0.32
  const quais: THREE.Mesh[] = []
  for (let q = 0; q < 2; q++) {
    const vers = q === 0 ? POSTE_PORE : POSTE_LDH
    directionTemp
      .set(
        posteX(vers) - posteX(POSTE_CARREFOUR),
        posteY(vers) - posteY(POSTE_CARREFOUR),
        posteZ(vers) - posteZ(POSTE_CARREFOUR),
      )
      .normalize()
    const quai = new THREE.Mesh(geoQuai, q === 0 ? materiauQuaiMito : materiauQuaiFerment)
    quai.scale.set(1, LONGUEUR_QUAI, 1)
    quaternionTemp.setFromUnitVectors(AXE_Y_LOCAL, directionTemp)
    quai.quaternion.copy(quaternionTemp)
    quai.position.set(
      posteX(POSTE_CARREFOUR) + directionTemp.x * (0.06 + LONGUEUR_QUAI * 0.5),
      posteY(POSTE_CARREFOUR) + directionTemp.y * (0.06 + LONGUEUR_QUAI * 0.5),
      posteZ(POSTE_CARREFOUR) + directionTemp.z * (0.06 + LONGUEUR_QUAI * 0.5),
    )
    quais.push(quai)
    groupe.add(quai)
  }
  quaternionTemp.identity()

  // ── Les postes enzymatiques. Ils sont FIXES : c'est le substrat qui passe ─
  const enzymesCytosol = new THREE.InstancedMesh(
    geoBlob,
    materiauOrganite(TEINTE_ENZYME_CYTOSOL, { doubleFace: false }),
    16,
  )
  const enzymesMito = new THREE.InstancedMesh(
    geoBlob,
    materiauOrganite(TEINTE_ENZYME_MITO, { doubleFace: false }),
    33,
  )
  const complexeIV = new THREE.InstancedMesh(
    geoBlob,
    materiauOrganite(TEINTE_COMPLEXE_IV, { doubleFace: false }),
    5,
  )
  const synthase = new THREE.InstancedMesh(
    geoBlob,
    materiauOrganite(TEINTE_ATP, { doubleFace: false }),
    3,
  )
  enzymesCytosol.frustumCulled = false
  enzymesMito.frustumCulled = false
  complexeIV.frustumCulled = false
  synthase.frustumCulled = false
  groupe.add(enzymesCytosol, enzymesMito, complexeIV, synthase)

  /** Pose un blob à un décalage donné d'un poste. Utilisé au montage seulement. */
  const poserBlob = (
    maillage: THREE.InstancedMesh,
    indice: number,
    poste: number,
    dx: number,
    dy: number,
    dz: number,
    rayon: number,
  ): void => {
    positionTemp.set(posteX(poste) + dx, posteY(poste) + dy, posteZ(poste) + dz)
    echelleTemp.setScalar(rayon)
    matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
    maillage.setMatrixAt(indice, matriceTemp)
  }

  let curseur = 0
  // GAPDH, homotétramère : c'est lui qui prend le NAD⁺, à l'étape 6.
  for (let s = 0; s < 4; s++) {
    poserBlob(
      enzymesCytosol,
      curseur++,
      POSTE_GAPDH,
      TETRAEDRE[s * 3]! * 0.85,
      TETRAEDRE[s * 3 + 1]! * 0.85,
      TETRAEDRE[s * 3 + 2]! * 0.85,
      0.048,
    )
  }
  // LDH, homotétramère elle aussi.
  for (let s = 0; s < 4; s++) {
    poserBlob(
      enzymesCytosol,
      curseur++,
      POSTE_LDH,
      TETRAEDRE[s * 3]!,
      TETRAEDRE[s * 3 + 1]!,
      TETRAEDRE[s * 3 + 2]!,
      0.056,
    )
  }
  // La navette malate-aspartate : deux transporteurs enjambant les membranes.
  poserBlob(enzymesCytosol, curseur++, POSTE_NAVETTE, 0.06, 0.03, 0, 0.05)
  poserBlob(enzymesCytosol, curseur++, POSTE_NAVETTE, 0.24, -0.02, 0, 0.05)
  // Vignette levure : pyruvate décarboxylase puis alcool déshydrogénase.
  for (let s = 0; s < 3; s++) {
    poserBlob(
      enzymesCytosol,
      curseur++,
      POSTE_PDC,
      LOBES_TRIADE[s * 3]!,
      LOBES_TRIADE[s * 3 + 1]!,
      LOBES_TRIADE[s * 3 + 2]!,
      0.042,
    )
  }
  for (let s = 0; s < 3; s++) {
    poserBlob(
      enzymesCytosol,
      curseur++,
      POSTE_ADH,
      LOBES_TRIADE[s * 3]!,
      LOBES_TRIADE[s * 3 + 1]!,
      LOBES_TRIADE[s * 3 + 2]!,
      0.042,
    )
  }
  enzymesCytosol.instanceMatrix.needsUpdate = true

  // Le complexe pyruvate déshydrogénase : 9,5 MDa, une soixantaine de
  // sous-unités en coque quasi sphérique. C'est le plus gros poste du champ,
  // et il est réellement énorme dans la cellule.
  curseur = 0
  for (let s = 0; s < 24; s++) {
    const u = 1 - (2 * (s + 0.5)) / 24
    const r = Math.sqrt(Math.max(0, 1 - u * u))
    const angle = s * 2.399963
    poserBlob(
      enzymesMito,
      curseur++,
      POSTE_PDH,
      Math.cos(angle) * r * 0.115,
      u * 0.115,
      Math.sin(angle) * r * 0.115,
      0.044,
    )
  }
  for (let s = 0; s < 5; s++) {
    poserBlob(
      enzymesMito,
      curseur++,
      POSTE_I,
      LOBES_COMPLEXE_I[s * 3]!,
      LOBES_COMPLEXE_I[s * 3 + 1]!,
      LOBES_COMPLEXE_I[s * 3 + 2]!,
      0.045,
    )
  }
  for (let s = 0; s < 4; s++) {
    poserBlob(
      enzymesMito,
      curseur++,
      POSTE_III,
      LOBES_COMPLEXE_III[s * 3]!,
      LOBES_COMPLEXE_III[s * 3 + 1]!,
      LOBES_COMPLEXE_III[s * 3 + 2]!,
      0.045,
    )
  }
  enzymesMito.instanceMatrix.needsUpdate = true

  for (let s = 0; s < 5; s++) {
    poserBlob(
      complexeIV,
      s,
      POSTE_IV,
      LOBES_COMPLEXE_IV[s * 3]!,
      LOBES_COMPLEXE_IV[s * 3 + 1]!,
      LOBES_COMPLEXE_IV[s * 3 + 2]!,
      0.046,
    )
  }
  complexeIV.instanceMatrix.needsUpdate = true

  // L'ATP synthase : le pied dans la membrane, la tête dans la matrice.
  poserBlob(synthase, 0, POSTE_SYNTHASE, 0, 0, 0, 0.052)
  poserBlob(synthase, 1, POSTE_SYNTHASE, 0.09, 0, 0, 0.022)
  poserBlob(synthase, 2, POSTE_SYNTHASE, 0.18, 0.01, 0, 0.072)
  synthase.instanceMatrix.needsUpdate = true

  // ── Les anneaux d'activité ───────────────────────────────────────────────
  const anneaux: THREE.Mesh[] = []
  const materiauxAnneaux: THREE.MeshLambertMaterial[] = []
  for (let a = 0; a < NB_ANNEAUX; a++) {
    // Gris chaud : éteint, l'anneau se fond dans le cytosol ; allumé, il brûle.
    const materiau = materiauOrganite(0xdcd7cb, { opacite: 0.8, doubleFace: false })
    const anneau = new THREE.Mesh(geoAnneau, materiau)
    const poste = POSTE_ANNEAU[a]!
    anneau.position.set(posteX(poste), posteY(poste), posteZ(poste))
    anneau.scale.setScalar(RAYON_ANNEAU[a]!)
    anneaux.push(anneau)
    materiauxAnneaux.push(materiau)
    groupe.add(anneau)
  }

  // ── Les espèces carbonées : un maillage par espèce, jamais de setColorAt ──
  const maillagesCarbone: THREE.InstancedMesh[] = []
  const teintesCarbone = new Int32Array([
    TEINTE_PYRUVATE,
    TEINTE_ACETYL,
    TEINTE_LACTATE,
    TEINTE_ACETALDEHYDE,
    TEINTE_ETHANOL,
  ])
  for (let e = 0; e < NB_MAILLAGES_C; e++) {
    const maillage = new THREE.InstancedMesh(
      geoBlob,
      materiauOrganite(teintesCarbone[e]!, { doubleFace: false }),
      NB_ACTEURS_C * BILLES_C,
    )
    maillage.frustumCulled = false
    maillagesCarbone.push(maillage)
    groupe.add(maillage)
  }

  // ── Cofacteurs, gaz, électrons, pastilles ────────────────────────────────
  const maillageNad = new THREE.InstancedMesh(
    geoBlob,
    materiauOrganite(TEINTE_NAD, { doubleFace: false }),
    NB_NAVETTES_RENDUES,
  )
  const maillageHydrure = new THREE.InstancedMesh(
    geoGrain,
    materiauOrganite(TEINTE_HYDRURE, { doubleFace: false, emissif: 0x555033 }),
    NB_NAVETTES_RENDUES,
  )
  const maillageElectrons = new THREE.InstancedMesh(
    geoGrain,
    materiauOrganite(TEINTE_HYDRURE, { doubleFace: false, emissif: 0x555033 }),
    NB_ELECTRONS,
  )
  const maillageO2 = new THREE.InstancedMesh(
    geoBlob,
    materiauOrganite(TEINTE_O2, { doubleFace: false }),
    NB_O2 * 2,
  )
  const maillageCO2 = new THREE.InstancedMesh(
    geoBlob,
    materiauOrganite(TEINTE_CO2, { doubleFace: false }),
    NB_CO2 * 3,
  )
  const maillageH2O = new THREE.InstancedMesh(
    geoBlob,
    materiauOrganite(TEINTE_EAU, { doubleFace: false }),
    NB_H2O,
  )
  const maillageAtp = new THREE.InstancedMesh(
    geoBlob,
    materiauOrganite(TEINTE_ATP, { doubleFace: false }),
    NB_ATP_VOL,
  )
  const maillagePastilles = new THREE.InstancedMesh(
    geoBlob,
    materiauOrganite(TEINTE_ATP, { doubleFace: false, emissif: 0x3a1600 }),
    NB_SLOTS,
  )
  maillageNad.frustumCulled = false
  maillageHydrure.frustumCulled = false
  maillageElectrons.frustumCulled = false
  maillageO2.frustumCulled = false
  maillageCO2.frustumCulled = false
  maillageH2O.frustumCulled = false
  maillageAtp.frustumCulled = false
  maillagePastilles.frustumCulled = false
  groupe.add(
    maillageNad,
    maillageHydrure,
    maillageElectrons,
    maillageO2,
    maillageCO2,
    maillageH2O,
    maillageAtp,
    maillagePastilles,
  )

  // ── Positions des pastilles du compteur ──────────────────────────────────
  const posSlot = new Float32Array(NB_SLOTS * 3)
  for (let k = 0; k < NB_SLOTS_A; k++) {
    posSlot[k * 3] = X_RACK_A
    posSlot[k * 3 + 1] = Y_RACK - k * PAS_SLOT
    posSlot[k * 3 + 2] = Z_RACK
  }
  for (let j = 0; j < NB_SLOTS_B; j++) {
    const k = NB_SLOTS_A + j
    posSlot[k * 3] = X_RACK_B + (j >> 1) * PAS_SLOT
    posSlot[k * 3 + 1] = Y_RACK - (j & 1) * PAS_SLOT
    posSlot[k * 3 + 2] = Z_RACK
  }
  const allumee = new Uint8Array(NB_SLOTS)
  const remplissage = new Float32Array(NB_SLOTS)
  let prochainSlotA = 0
  let prochainSlotB = 0

  // ── États : substrats ────────────────────────────────────────────────────
  const etatS = new Int8Array(NB_SUBSTRATS)
  const especeS = new Int8Array(NB_ACTEURS_C)
  const minuteurS = new Float32Array(NB_SUBSTRATS)
  const cibleS = new Int8Array(NB_SUBSTRATS)
  const dansMatrice = new Uint8Array(NB_SUBSTRATS)
  const posS = new Float32Array(NB_ACTEURS_C * 3)
  const vitS = new Float32Array(NB_SUBSTRATS * 3)
  const phaseS = new Float32Array(NB_ACTEURS_C)
  const fonduS = new Float32Array(NB_ACTEURS_C)

  // ── États : navettes NAD⁺/NADH ───────────────────────────────────────────
  const etatN = new Int8Array(NB_NAVETTES)
  const chargeN = new Uint8Array(NB_NAVETTES)
  const cibleN = new Int8Array(NB_NAVETTES)
  const minuteurN = new Float32Array(NB_NAVETTES)
  const posN = new Float32Array(NB_NAVETTES * 3)
  const vitN = new Float32Array(NB_NAVETTES * 3)

  // ── États : électrons. -1 = libre, sinon indice du maillon occupé ────────
  const maillonE = new Int8Array(NB_ELECTRONS)
  const transitE = new Uint8Array(NB_ELECTRONS)
  const progresE = new Float32Array(NB_ELECTRONS)
  const sourceE = new Int8Array(NB_ELECTRONS)
  const phaseE = new Float32Array(NB_ELECTRONS)

  // ── États : oxygène, gaz carbonique, eau, ATP en vol ─────────────────────
  const etatO2 = new Int8Array(NB_O2)
  const posO2 = new Float32Array(NB_O2 * 3)
  const vitO2 = new Float32Array(NB_O2 * 3)
  const fonduO2 = new Float32Array(NB_O2)
  const phaseO2 = new Float32Array(NB_O2)

  const posCO2 = new Float32Array(NB_CO2 * 3)
  const vitCO2 = new Float32Array(NB_CO2 * 3)
  const axeCO2 = new Float32Array(NB_CO2 * 3)
  const vieCO2 = new Float32Array(NB_CO2)
  let prochainCO2 = 0

  const posH2O = new Float32Array(NB_H2O * 3)
  const vitH2O = new Float32Array(NB_H2O * 3)
  const vieH2O = new Float32Array(NB_H2O)
  let prochainH2O = 0

  const actifAtp = new Uint8Array(NB_ATP_VOL)
  const slotAtp = new Int16Array(NB_ATP_VOL)
  const progresAtp = new Float32Array(NB_ATP_VOL)
  const sourceAtp = new Float32Array(NB_ATP_VOL * 3)

  // ── Activités des postes ─────────────────────────────────────────────────
  const activite = new Float32Array(NB_ANNEAUX)
  let pulseSynthase = 0
  let presenceLissee = 1

  // Occupants, recomptés à chaque image : aucun compteur à désynchroniser.
  let occupantGapdh = -1
  let occupantPdh = -1
  let occupantLdhSub = -1
  let occupantLdhNad = -1
  let o2AmarreIV = -1
  let occupationI = 0
  let occupationIII = 0
  let occupationIV = 0
  let nbNadPlus = 0

  let tempsPrecedent = 0
  let aerobieAvant = true

  // ── Outils de déplacement ────────────────────────────────────────────────

  /** Marche brownienne amortie : rien ne se déplace en ligne droite ici. */
  const deriver = (
    pos: Float32Array,
    vit: Float32Array,
    i: number,
    vitesse: number,
    amorti: number,
    racineDt: number,
    dt: number,
  ): void => {
    const i3 = i * 3
    const impulsion = vitesse * FACTEUR_IMPULSION * racineDt
    for (let c = 0; c < 3; c++) {
      vit[i3 + c] = vit[i3 + c]! * amorti + (alea() - 0.5) * impulsion
      pos[i3 + c] = pos[i3 + c]! + vit[i3 + c]! * dt
    }
  }

  /** Biais léger vers un poste : la rencontre finit par arriver, sans rail. */
  const viser = (
    pos: Float32Array,
    vit: Float32Array,
    i: number,
    poste: number,
    force: number,
    dt: number,
  ): void => {
    const i3 = i * 3
    vit[i3] = vit[i3]! + (posteX(poste) - pos[i3]!) * force * dt
    vit[i3 + 1] = vit[i3 + 1]! + (posteY(poste) - pos[i3 + 1]!) * force * dt
    vit[i3 + 2] = vit[i3 + 2]! + (posteZ(poste) - pos[i3 + 2]!) * force * dt
  }

  const distanceCarree = (pos: Float32Array, i: number, poste: number): number => {
    const dx = pos[i * 3]! - posteX(poste)
    const dy = pos[i * 3 + 1]! - posteY(poste)
    const dz = pos[i * 3 + 2]! - posteZ(poste)
    return dx * dx + dy * dy + dz * dz
  }

  /** Un refus : le métabolite est chassé du poste, et il faudra revenir. */
  const repousser = (pos: Float32Array, vit: Float32Array, i: number, poste: number): void => {
    const i3 = i * 3
    const dx = pos[i3]! - posteX(poste)
    const dy = pos[i3 + 1]! - posteY(poste)
    const dz = pos[i3 + 2]! - posteZ(poste)
    const d = Math.sqrt(Math.max(1e-12, dx * dx + dy * dy + dz * dz))
    vit[i3] = vit[i3]! + (dx / d) * IMPULSION_REFUS
    vit[i3 + 1] = vit[i3 + 1]! + (dy / d) * IMPULSION_REFUS
    vit[i3 + 2] = vit[i3 + 2]! + (dz / d) * IMPULSION_REFUS
  }

  /** Confinement au champ, et à son compartiment : la membrane est étanche. */
  const confiner = (
    pos: Float32Array,
    vit: Float32Array,
    i: number,
    matrice: boolean,
  ): void => {
    const i3 = i * 3
    const x = pos[i3]!
    const y = pos[i3 + 1]!
    const z = pos[i3 + 2]!
    const r = Math.sqrt(Math.max(1e-12, x * x + y * y + z * z))
    if (r > RAYON_CHAMP) {
      const f = RAYON_CHAMP / r
      pos[i3] = x * f
      pos[i3 + 1] = y * f
      pos[i3 + 2] = z * f
      const vn = (vit[i3]! * x + vit[i3 + 1]! * y + vit[i3 + 2]! * z) / r
      if (vn > 0) {
        vit[i3] = vit[i3]! - (2 * vn * x) / r
        vit[i3 + 1] = vit[i3 + 1]! - (2 * vn * y) / r
        vit[i3 + 2] = vit[i3 + 2]! - (2 * vn * z) / r
      }
    }
    if (matrice) {
      if (pos[i3]! < LIMITE_MATRICE) {
        pos[i3] = LIMITE_MATRICE
        if (vit[i3]! < 0) vit[i3] = -vit[i3]!
      }
    } else if (pos[i3]! > LIMITE_CYTOSOL) {
      pos[i3] = LIMITE_CYTOSOL
      if (vit[i3]! > 0) vit[i3] = -vit[i3]!
    }
  }

  /** Sème un métabolite autour d'un poste. */
  const semerAutour = (pos: Float32Array, i: number, poste: number, rayon: number): void => {
    pos[i * 3] = posteX(poste) + (alea() - 0.5) * rayon
    pos[i * 3 + 1] = posteY(poste) + (alea() - 0.5) * rayon
    pos[i * 3 + 2] = posteZ(poste) + (alea() - 0.5) * rayon
  }

  // ── Émissions ────────────────────────────────────────────────────────────

  const emettreCO2 = (x: number, y: number, z: number, vx: number, vy: number, vz: number): void => {
    const c = prochainCO2
    prochainCO2 = (prochainCO2 + 1) % NB_CO2
    posCO2[c * 3] = x
    posCO2[c * 3 + 1] = y
    posCO2[c * 3 + 2] = z
    vitCO2[c * 3] = vx
    vitCO2[c * 3 + 1] = vy
    vitCO2[c * 3 + 2] = vz
    const u = alea() * 2 - 1
    const theta = alea() * 6.283
    const s = Math.sqrt(Math.max(0, 1 - u * u))
    axeCO2[c * 3] = s * Math.cos(theta)
    axeCO2[c * 3 + 1] = u
    axeCO2[c * 3 + 2] = s * Math.sin(theta)
    vieCO2[c] = DUREE_CO2
  }

  const emettreH2O = (x: number, y: number, z: number): void => {
    const h = prochainH2O
    prochainH2O = (prochainH2O + 1) % NB_H2O
    posH2O[h * 3] = x
    posH2O[h * 3 + 1] = y
    posH2O[h * 3 + 2] = z
    vitH2O[h * 3] = 0.10 + alea() * 0.10
    vitH2O[h * 3 + 1] = -0.12 - alea() * 0.10
    vitH2O[h * 3 + 2] = (alea() - 0.5) * 0.18
    vieH2O[h] = DUREE_H2O
  }

  /** Une pastille de plus au compteur, et le jeton qui va l'allumer. */
  const emettreATP = (respiration: boolean, x: number, y: number, z: number): void => {
    let slot = -1
    if (respiration) {
      if (prochainSlotB >= NB_SLOTS_B) return
      slot = NB_SLOTS_A + prochainSlotB
      prochainSlotB++
    } else {
      if (prochainSlotA >= NB_SLOTS_A) return
      slot = prochainSlotA
      prochainSlotA++
    }
    for (let a = 0; a < NB_ATP_VOL; a++) {
      if (actifAtp[a] === 1) continue
      actifAtp[a] = 1
      slotAtp[a] = slot
      progresAtp[a] = 0
      sourceAtp[a * 3] = x
      sourceAtp[a * 3 + 1] = y
      sourceAtp[a * 3 + 2] = z
      return
    }
    // Aucun jeton libre : la pastille s'allume quand même, le bilan reste juste.
    allumee[slot] = 1
  }

  /** Verse des électrons dans le complexe I, depuis le poste qui les fournit. */
  const injecterElectrons = (nombre: number, source: number): void => {
    let poses = 0
    // Jamais au-delà de la capacité du complexe : c'est elle qui fait blocage.
    const place = Math.min(nombre, CAP_I - occupationI)
    for (let e = 0; e < NB_ELECTRONS && poses < place; e++) {
      if (maillonE[e]! >= 0) continue
      maillonE[e] = 0
      transitE[e] = 1
      progresE[e] = 0
      sourceE[e] = source
      phaseE[e] = alea()
      occupationI++
      poses++
    }
  }

  /** Émet un pyruvate à l'entrée, et l'ATP de la glycolyse qui l'accompagne. */
  const emettrePyruvate = (): boolean => {
    for (let s = 0; s < NB_SUBSTRATS; s++) {
      if (etatS[s] !== S_ABSENT) continue
      etatS[s] = S_DIFFUSE
      especeS[s] = ESP_PYRUVATE
      minuteurS[s] = 0
      dansMatrice[s] = 0
      fonduS[s] = 0
      semerAutour(posS, s, POSTE_ENTREE, 0.1)
      vitS[s * 3] = 0
      vitS[s * 3 + 1] = -0.1
      vitS[s * 3 + 2] = 0
      phaseS[s] = alea()
      // Tout pyruvate descend d'abord à l'aiguillage : c'est là, et là seulement,
      // qu'il prend un chemin — et la cible n'est jamais qu'un biais de diffusion.
      cibleS[s] = POSTE_CARREFOUR
      // Deux ATP par glucose, donc un par pyruvate : ils viennent de la
      // glycolyse, jamais de la fermentation.
      emettreATP(false, posteX(POSTE_ENTREE), posteY(POSTE_ENTREE), posteZ(POSTE_ENTREE))
      return true
    }
    return false
  }

  // ── Amorce : le mécanisme a déjà commencé quand on arrive ────────────────
  for (let s = 0; s < NB_SUBSTRATS; s++) {
    etatS[s] = S_ABSENT
    especeS[s] = ESP_AUCUNE
    cibleS[s] = POSTE_CARREFOUR
  }
  emettrePyruvate()
  emettrePyruvate()
  for (let n = 0; n < NB_NAVETTES; n++) {
    chargeN[n] = n % 2 === 0 ? 0 : 1
    if (chargeN[n] === 0) {
      etatN[n] = N_VERS_GAPDH
      cibleN[n] = POSTE_GAPDH
      semerAutour(posN, n, POSTE_CARREFOUR, 0.7)
    } else {
      etatN[n] = N_VERS_CONSO
      cibleN[n] = POSTE_NAVETTE
      semerAutour(posN, n, POSTE_NAVETTE, 0.6)
    }
    posN[n * 3] = Math.min(posN[n * 3]!, LIMITE_CYTOSOL - 0.02)
    minuteurN[n] = 0
  }
  for (let e = 0; e < NB_ELECTRONS; e++) maillonE[e] = -1
  for (let e = 0; e < 5; e++) {
    // La file est déjà engagée : deux électrons au complexe III, trois au IV.
    maillonE[e] = e < 2 ? 1 : 2
    transitE[e] = 0
    progresE[e] = 0
    sourceE[e] = POSTE_MAILLON[maillonE[e]!]!
    phaseE[e] = alea()
  }
  for (let o = 0; o < NB_O2; o++) etatO2[o] = 0
  etatO2[0] = 2
  fonduO2[0] = 1
  posO2[0] = posteX(POSTE_IV) - 0.16
  posO2[1] = posteY(POSTE_IV) - 0.02
  posO2[2] = posteZ(POSTE_IV) + 0.02
  etatO2[1] = 1
  fonduO2[1] = 1
  semerAutour(posO2, 1, POSTE_CARREFOUR, 0.5)
  for (let o = 0; o < NB_O2; o++) phaseO2[o] = alea()
  for (let s = 0; s < NB_SLOTS_A; s++) {
    allumee[s] = 1
    remplissage[s] = 1
  }
  prochainSlotA = NB_SLOTS_A
  for (let j = 0; j < 12; j++) {
    allumee[NB_SLOTS_A + j] = 1
    remplissage[NB_SLOTS_A + j] = 1
  }
  prochainSlotB = 12
  for (let a = 0; a < NB_ANNEAUX; a++) activite[a] = 0.6
  for (let v = 0; v < NB_VIGNETTE; v++) {
    especeS[NB_SUBSTRATS + v] = ESP_PYRUVATE
    phaseS[NB_SUBSTRATS + v] = alea()
    fonduS[NB_SUBSTRATS + v] = 1
  }

  /** Vignette levure : mémorise le CO₂ déjà lâché à ce tour. */
  const co2LacheVignette = new Uint8Array(NB_VIGNETTE)
  let minuteurO2 = 0

  // ── Rendu d'une molécule carbonée : trois billes, ou deux après le CO₂ ───
  const rendreCarbone = (acteur: number, temps: number): void => {
    const espece = especeS[acteur]!
    const nb = espece === ESP_AUCUNE ? 0 : CARBONES[espece]!
    const fondu = fonduS[acteur]!
    axeTumble(phaseS[acteur]!, temps)
    const cx = posS[acteur * 3]!
    const cy = posS[acteur * 3 + 1]!
    const cz = posS[acteur * 3 + 2]!
    for (let m = 0; m < NB_MAILLAGES_C; m++) {
      const maillage = maillagesCarbone[m]!
      const visible = m === espece - 1
      for (let b = 0; b < BILLES_C; b++) {
        if (!visible || b >= nb) {
          echelleTemp.setScalar(0)
          positionTemp.set(0, 0, 0)
        } else {
          const decalage = (b - (nb - 1) * 0.5) * PAS_CARBONE
          positionTemp.set(
            cx + axeTumbleX * decalage,
            cy + axeTumbleY * decalage,
            cz + axeTumbleZ * decalage,
          )
          echelleTemp.setScalar(RAYON_CARBONE * fondu)
        }
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        maillage.setMatrixAt(acteur * BILLES_C + b, matriceTemp)
      }
    }
  }

  const animer = (temps: number): void => {
    // Pas borné : une image sautée ne doit pas téléporter la scène.
    const dt = Math.min(0.05, Math.max(0, temps - tempsPrecedent))
    tempsPrecedent = temps
    const amorti = Math.exp(-dt / TAU_DERIVE)
    const racineDt = Math.sqrt(dt)

    // 0. Le régime d'oxygène, et la remise à zéro du compteur à chaque bascule.
    const aerobie = (temps + O2_PHASE) % O2_PERIODE < O2_DUREE_PRESENT
    if (aerobie !== aerobieAvant) {
      aerobieAvant = aerobie
      prochainSlotA = 0
      prochainSlotB = 0
      for (let k = 0; k < NB_SLOTS; k++) allumee[k] = 0
      for (let a = 0; a < NB_ATP_VOL; a++) actifAtp[a] = 0
    }
    presenceLissee += ((aerobie ? 1 : 0) - presenceLissee) * Math.min(1, dt * 3)

    // 1. Recensement. Tout le reste en découle, et rien ne peut se désynchroniser.
    occupantGapdh = -1
    occupantPdh = -1
    occupantLdhSub = -1
    occupantLdhNad = -1
    o2AmarreIV = -1
    occupationI = 0
    occupationIII = 0
    occupationIV = 0
    nbNadPlus = 0
    for (let n = 0; n < NB_NAVETTES; n++) {
      if (chargeN[n] === 0) nbNadPlus++
      if (etatN[n] === N_AU_GAPDH) occupantGapdh = n
      else if (etatN[n] === N_AU_CONSO && cibleN[n] === POSTE_LDH) occupantLdhNad = n
    }
    for (let s = 0; s < NB_SUBSTRATS; s++) {
      if (etatS[s] === S_AU_PDH) occupantPdh = s
      else if (etatS[s] === S_AU_LDH) occupantLdhSub = s
    }
    for (let e = 0; e < NB_ELECTRONS; e++) {
      const m = maillonE[e]!
      if (m === 0) occupationI++
      else if (m === 1) occupationIII++
      else if (m === 2) occupationIV++
    }
    for (let o = 0; o < NB_O2; o++) if (etatO2[o] === 2) o2AmarreIV = o
    // Deux questions distinctes, et il ne faut pas les confondre. La première
    // est de tuyauterie : le complexe I a-t-il deux places libres à l'instant ?
    // La seconde est le vrai sujet : la file est-elle BOUCHÉE, c'est-à-dire le
    // complexe IV plein sans oxygène pour la vider ? C'est celle-là qui décide
    // du sort du pyruvate, et elle se pose tout au bout, EN AVAL.
    const chaineAccepte = occupationI <= CAP_I - 2
    const chaineBouchee = occupationIV >= CAP_IV && o2AmarreIV < 0

    // 2. Les navettes NAD⁺ / NADH. C'est la boucle qui compte.
    for (let n = 0; n < NB_NAVETTES; n++) {
      const etat = etatN[n]!
      minuteurN[n]! += dt

      if (etat === N_VERS_GAPDH || etat === N_VERS_CONSO) {
        deriver(posN, vitN, n, VITESSE_NAVETTE, amorti, racineDt, dt)
        viser(posN, vitN, n, cibleN[n]!, FORCE_VISEE, dt)
        confiner(posN, vitN, n, false)
        const cible = cibleN[n]!
        if (distanceCarree(posN, n, cible) < RAYON_ACCROCHE * RAYON_ACCROCHE) {
          if (etat === N_VERS_GAPDH) {
            if (occupantGapdh < 0) {
              etatN[n] = N_AU_GAPDH
              minuteurN[n] = 0
              occupantGapdh = n
            } else {
              repousser(posN, vitN, n, cible)
            }
          } else if (cible === POSTE_NAVETTE) {
            if (chaineAccepte) {
              // L'hydrure passe la membrane, pas la molécule : c'est la navette
              // malate-aspartate qui fait traverser les électrons.
              injecterElectrons(2, POSTE_NAVETTE)
              chargeN[n] = 0
              etatN[n] = N_VERS_GAPDH
              cibleN[n] = POSTE_GAPDH
              minuteurN[n] = 0
              repousser(posN, vitN, n, cible)
            } else {
              // Refus. Si la file est seulement occupée, le NADH insiste ; si
              // elle est BOUCHÉE faute d'oxygène, il finira par trouver la
              // lactate déshydrogénase, et c'est la fermentation qui démarre.
              repousser(posN, vitN, n, cible)
              if (chaineBouchee) cibleN[n] = alea() < 0.85 ? POSTE_LDH : POSTE_NAVETTE
            }
          } else if (occupantLdhNad < 0) {
            etatN[n] = N_AU_CONSO
            minuteurN[n] = 0
            occupantLdhNad = n
          } else {
            repousser(posN, vitN, n, cible)
          }
        } else if (minuteurN[n]! > PATIENCE_CYTOSOL && etat === N_VERS_CONSO) {
          minuteurN[n] = 0
          cibleN[n] = chaineBouchee ? POSTE_LDH : POSTE_NAVETTE
        }
      } else if (etat === N_AU_GAPDH) {
        // Étape 6 de la glycolyse : le NAD⁺ y devient NADH, et c'est ce même
        // tour de manivelle qui fournit le pyruvate et l'ATP.
        posN[n * 3]! += (posteX(POSTE_GAPDH) - posN[n * 3]!) * Math.min(1, dt * 8)
        posN[n * 3 + 1]! += (posteY(POSTE_GAPDH) + 0.09 - posN[n * 3 + 1]!) * Math.min(1, dt * 8)
        posN[n * 3 + 2]! += (posteZ(POSTE_GAPDH) - posN[n * 3 + 2]!) * Math.min(1, dt * 8)
        vitN[n * 3] = 0
        vitN[n * 3 + 1] = 0
        vitN[n * 3 + 2] = 0
        if (minuteurN[n]! >= DUREE_GAPDH) {
          // Le tour de manivelle a toujours lieu : ce qui l'arrête est le NAD⁺,
          // jamais la place à l'écran. Si le champ est déjà plein de pyruvate,
          // on charge la navette sans en dessiner un de plus.
          emettrePyruvate()
          chargeN[n] = 1
          etatN[n] = N_VERS_CONSO
          // Le débouché normal d'un NADH est la mitochondrie, et il y va tant
          // qu'elle prend. Quand la file est bouchée, deux sur cinq vont quand
          // même y frapper — et c'est ce refus-là qu'il faut avoir vu.
          cibleN[n] = chaineBouchee && alea() < 0.6 ? POSTE_LDH : POSTE_NAVETTE
          minuteurN[n] = 0
          occupantGapdh = -1
          repousser(posN, vitN, n, POSTE_GAPDH)
        }
      } else {
        // Garé sur la LDH, en attente d'un pyruvate à réduire.
        posN[n * 3]! += (posteX(POSTE_LDH) - 0.11 - posN[n * 3]!) * Math.min(1, dt * 8)
        posN[n * 3 + 1]! += (posteY(POSTE_LDH) + 0.1 - posN[n * 3 + 1]!) * Math.min(1, dt * 8)
        posN[n * 3 + 2]! += (posteZ(POSTE_LDH) + 0.02 - posN[n * 3 + 2]!) * Math.min(1, dt * 8)
        vitN[n * 3] = 0
        vitN[n * 3 + 1] = 0
        vitN[n * 3 + 2] = 0
        if (occupantLdhSub < 0 && !chaineBouchee && minuteurN[n]! > PATIENCE_LDH) {
          etatN[n] = N_VERS_CONSO
          cibleN[n] = POSTE_NAVETTE
          minuteurN[n] = 0
          occupantLdhNad = -1
          repousser(posN, vitN, n, POSTE_LDH)
        }
      }
    }

    // 3. Les substrats carbonés.
    for (let s = 0; s < NB_SUBSTRATS; s++) {
      const etat = etatS[s]!
      if (etat === S_ABSENT) continue
      const s3 = s * 3
      minuteurS[s]! += dt

      if (etat === S_DIFFUSE) {
        const matrice = dansMatrice[s] === 1
        deriver(posS, vitS, s, VITESSE_SUBSTRAT, amorti, racineDt, dt)
        viser(posS, vitS, s, cibleS[s]!, FORCE_VISEE, dt)
        confiner(posS, vitS, s, matrice)
        const cible = cibleS[s]!
        // Le carrefour est un lieu de passage, pas un site actif : on y arrive
        // de plus loin qu'on n'entre dans une enzyme.
        const portee = cible === POSTE_CARREFOUR ? 0.24 : RAYON_ACCROCHE
        if (distanceCarree(posS, s, cible) < portee * portee) {
          if (cible === POSTE_CARREFOUR) {
            // L'aiguillage. Le tirage est biaisé par l'oxygène, jamais forcé :
            // même sans O₂, un pyruvate sur quatre part vers la mitochondrie.
            cibleS[s] = (aerobie ? alea() < 0.8 : alea() < 0.25) ? POSTE_PORE : POSTE_LDH
            minuteurS[s] = 0
          } else if (cible === POSTE_PORE || cible === POSTE_PORE_MATRICE) {
            // Le pore est toujours ouvert : ce n'est jamais lui qui décide.
            etatS[s] = S_TRAVERSE
            minuteurS[s] = 0
          } else if (cible === POSTE_PDH) {
            if (occupantPdh < 0 && !chaineBouchee) {
              etatS[s] = S_AU_PDH
              minuteurS[s] = 0
              occupantPdh = s
            } else {
              // La PDH est à l'arrêt : sans chaîne pour réoxyder son NADH, elle
              // ne décarboxyle plus rien. Le pyruvate rebondit, puis ressort de
              // la mitochondrie — c'est le trajet raté qui explique le lactate.
              repousser(posS, vitS, s, cible)
              if (chaineBouchee) {
                cibleS[s] = POSTE_PORE_MATRICE
                minuteurS[s] = 0
              }
            }
          } else if (occupantLdhSub < 0 && occupantLdhNad >= 0) {
            etatS[s] = S_AU_LDH
            minuteurS[s] = 0
            occupantLdhSub = s
          } else {
            // Pas de NADH sur la LDH : rien à donner, donc rien à faire.
            repousser(posS, vitS, s, cible)
          }
        } else if (matrice && minuteurS[s]! > PATIENCE_MATRICE && cible !== POSTE_PORE_MATRICE) {
          // Le pyruvate s'accumule dans la matrice et ressort : c'est ainsi
          // qu'il finit en lactate quand l'oxygène manque.
          cibleS[s] = POSTE_PORE_MATRICE
          minuteurS[s] = 0
        } else if (!matrice && minuteurS[s]! > PATIENCE_CYTOSOL && cible !== POSTE_CARREFOUR) {
          // Rien trouvé au bout : on revient à l'aiguillage, et on retire au sort.
          cibleS[s] = POSTE_CARREFOUR
          minuteurS[s] = 0
        }
      } else if (etat === S_TRAVERSE) {
        // Passage du pore, scripté : un canal n'est pas un lieu de hasard.
        const t = Math.min(1, minuteurS[s]! / DUREE_PORE)
        const entrant = dansMatrice[s] === 0
        const x0 = entrant ? posteX(POSTE_PORE) : posteX(POSTE_PORE_MATRICE)
        const x1 = entrant ? posteX(POSTE_PORE_MATRICE) : posteX(POSTE_PORE)
        posS[s3] = x0 + (x1 - x0) * t
        posS[s3 + 1]! += (posteY(POSTE_PORE) - posS[s3 + 1]!) * Math.min(1, dt * 10)
        posS[s3 + 2]! += (posteZ(POSTE_PORE) - posS[s3 + 2]!) * Math.min(1, dt * 10)
        vitS[s3] = 0
        vitS[s3 + 1] = 0
        vitS[s3 + 2] = 0
        if (t >= 1) {
          dansMatrice[s] = entrant ? 1 : 0
          etatS[s] = S_DIFFUSE
          cibleS[s] = entrant ? POSTE_PDH : POSTE_CARREFOUR
          minuteurS[s] = 0
        }
      } else if (etat === S_AU_PDH) {
        posS[s3]! += (posteX(POSTE_PDH) - 0.17 - posS[s3]!) * Math.min(1, dt * 8)
        posS[s3 + 1]! += (posteY(POSTE_PDH) + 0.02 - posS[s3 + 1]!) * Math.min(1, dt * 8)
        posS[s3 + 2]! += (posteZ(POSTE_PDH) - posS[s3 + 2]!) * Math.min(1, dt * 8)
        if (chaineBouchee && minuteurS[s]! > 0.3) {
          // La file s'est bouchée pendant qu'il était en place : la PDH le
          // relâche sans rien en faire, et il repart vers le cytosol.
          etatS[s] = S_DIFFUSE
          cibleS[s] = POSTE_PORE_MATRICE
          minuteurS[s] = 0
          occupantPdh = -1
          repousser(posS, vitS, s, POSTE_PDH)
        } else if (minuteurS[s]! >= DUREE_PDH) {
          // Décarboxylation : trois carbones entrent, un part en CO₂, deux
          // continuent en acétyl-CoA. Le NADH que la PDH produit est figuré
          // par les deux électrons qu'elle verse au complexe I.
          axeTumble(phaseS[s]!, temps)
          emettreCO2(
            posS[s3]! + axeTumbleX * PAS_CARBONE,
            posS[s3 + 1]! + axeTumbleY * PAS_CARBONE,
            posS[s3 + 2]! + axeTumbleZ * PAS_CARBONE,
            0.10 + alea() * 0.12,
            0.16 + alea() * 0.12,
            (alea() - 0.5) * 0.2,
          )
          injecterElectrons(2, POSTE_PDH)
          especeS[s] = ESP_ACETYL
          etatS[s] = S_VERS_KREBS
          minuteurS[s] = 0
          occupantPdh = -1
        }
      } else if (etat === S_AU_LDH) {
        posS[s3]! += (posteX(POSTE_LDH) + 0.11 - posS[s3]!) * Math.min(1, dt * 8)
        posS[s3 + 1]! += (posteY(POSTE_LDH) + 0.06 - posS[s3 + 1]!) * Math.min(1, dt * 8)
        posS[s3 + 2]! += (posteZ(POSTE_LDH) + 0.02 - posS[s3 + 2]!) * Math.min(1, dt * 8)
        vitS[s3] = 0
        vitS[s3 + 1] = 0
        vitS[s3 + 2] = 0
        if (minuteurS[s]! >= DUREE_LDH) {
          // Le pyruvate garde ses trois carbones : le lactate est une impasse.
          // Ce qui compte est ailleurs — le NADH redevient NAD⁺, et il repart.
          especeS[s] = ESP_LACTATE
          etatS[s] = S_SORT_LACTATE
          minuteurS[s] = 0
          occupantLdhSub = -1
          const n = occupantLdhNad
          if (n >= 0) {
            chargeN[n] = 0
            etatN[n] = N_VERS_GAPDH
            cibleN[n] = POSTE_GAPDH
            minuteurN[n] = 0
            occupantLdhNad = -1
          }
        }
      } else {
        // Sortie : vers le cycle de Krebs, ou vers le foie pour le lactate.
        const versKrebs = etat === S_VERS_KREBS
        const cible = versKrebs ? POSTE_KREBS : POSTE_LACTATE
        const t = Math.min(1, minuteurS[s]! / DUREE_SORTIE)
        const prise = Math.min(1, dt * 2.6)
        posS[s3]! += (posteX(cible) - posS[s3]!) * prise
        posS[s3 + 1]! += (posteY(cible) - posS[s3 + 1]!) * prise
        posS[s3 + 2]! += (posteZ(cible) - posS[s3 + 2]!) * prise
        fonduS[s] = Math.min(1, (1 - t) * 3)
        if (t >= 1) {
          etatS[s] = S_ABSENT
          especeS[s] = ESP_AUCUNE
          fonduS[s] = 0
        }
      }
      if (etatS[s] !== S_ABSENT && etatS[s] !== S_VERS_KREBS && etatS[s] !== S_SORT_LACTATE) {
        fonduS[s] = Math.min(1, fonduS[s]! + dt * 5)
      }
    }

    // 4. Les électrons. Ils n'avancent que si la place suivante est libre :
    //    c'est exactement là que le manque d'oxygène se fait sentir.
    for (let e = 0; e < NB_ELECTRONS; e++) {
      const maillon = maillonE[e]!
      if (maillon < 0) continue
      if (transitE[e] === 1) {
        progresE[e]! += dt / DUREE_SAUT
        if (progresE[e]! >= 1) {
          progresE[e] = 1
          transitE[e] = 0
        }
        continue
      }
      if (maillon >= 2) continue
      const suivant = maillon + 1
      const occupation = suivant === 1 ? occupationIII : occupationIV
      if (occupation >= CAPACITES[suivant]!) continue
      if (suivant === 1) occupationIII++
      else occupationIV++
      if (maillon === 0) occupationI--
      else occupationIII--
      maillonE[e] = suivant
      transitE[e] = 1
      progresE[e] = 0
      sourceE[e] = POSTE_MAILLON[maillon]!
    }

    // 5. Le complexe IV. Quatre électrons et un O₂ : deux molécules d'eau.
    //    Sans O₂, les quatre électrons restent là et bloquent toute la file.
    let posesIV = 0
    for (let e = 0; e < NB_ELECTRONS; e++) {
      if (maillonE[e] === 2 && transitE[e] === 0) posesIV++
    }
    if (posesIV >= CAP_IV && o2AmarreIV >= 0) {
      let retires = 0
      for (let e = 0; e < NB_ELECTRONS && retires < CAP_IV; e++) {
        if (maillonE[e] !== 2 || transitE[e] === 1) continue
        maillonE[e] = -1
        occupationIV--
        retires++
      }
      const o = o2AmarreIV
      etatO2[o] = 0
      fonduO2[o] = 0
      emettreH2O(posO2[o * 3]!, posO2[o * 3 + 1]!, posO2[o * 3 + 2]!)
      emettreH2O(posO2[o * 3]! + 0.04, posO2[o * 3 + 1]! - 0.03, posO2[o * 3 + 2]!)
      o2AmarreIV = -1
      pulseSynthase = 1
      for (let k = 0; k < ATP_PAR_O2; k++) {
        emettreATP(
          true,
          posteX(POSTE_SYNTHASE) + 0.2,
          posteY(POSTE_SYNTHASE) + 0.02,
          posteZ(POSTE_SYNTHASE),
        )
      }
    }

    // 6. L'oxygène : il arrive de l'extérieur et se fixe sur le complexe IV.
    minuteurO2 += dt
    if (aerobie && minuteurO2 > 0.6) {
      minuteurO2 = 0
      for (let o = 0; o < NB_O2; o++) {
        if (etatO2[o] !== 0) continue
        etatO2[o] = 1
        fonduO2[o] = 0
        semerAutour(posO2, o, POSTE_BULBE, 0.12)
        vitO2[o * 3] = 0
        vitO2[o * 3 + 1] = -0.2
        vitO2[o * 3 + 2] = 0
        break
      }
    }
    for (let o = 0; o < NB_O2; o++) {
      const etat = etatO2[o]!
      if (etat === 0) {
        fonduO2[o] = Math.max(0, fonduO2[o]! - dt * 3)
        continue
      }
      if (!aerobie) {
        // L'oxygène local s'épuise : ce qui reste se dissipe.
        fonduO2[o] = Math.max(0, fonduO2[o]! - dt * 2)
        // Ce qui était fixé se décroche : dès que l'oxygène local manque, le
        // complexe IV n'a plus rien à qui céder ses électrons.
        if (etatO2[o] === 2) {
          etatO2[o] = 1
          if (o2AmarreIV === o) o2AmarreIV = -1
        }
        if (fonduO2[o]! <= 0) {
          etatO2[o] = 0
          continue
        }
      } else {
        fonduO2[o] = Math.min(1, fonduO2[o]! + dt * 3)
      }
      if (etatO2[o] === 1) {
        deriver(posO2, vitO2, o, 0.24, amorti, racineDt, dt)
        viser(posO2, vitO2, o, POSTE_IV, FORCE_VISEE * 1.3, dt)
        if (aerobie && distanceCarree(posO2, o, POSTE_IV) < 0.16 * 0.16 && o2AmarreIV < 0) {
          etatO2[o] = 2
          o2AmarreIV = o
        }
      } else {
        posO2[o * 3]! += (posteX(POSTE_IV) - 0.16 - posO2[o * 3]!) * Math.min(1, dt * 6)
        posO2[o * 3 + 1]! += (posteY(POSTE_IV) - 0.02 - posO2[o * 3 + 1]!) * Math.min(1, dt * 6)
        posO2[o * 3 + 2]! += (posteZ(POSTE_IV) + 0.02 - posO2[o * 3 + 2]!) * Math.min(1, dt * 6)
      }
    }

    // 7. La vignette « levure » : même logique, autre produit.
    for (let v = 0; v < NB_VIGNETTE; v++) {
      const acteur = NB_SUBSTRATS + v
      const phase = ((temps / PERIODE_VIGNETTE + v * 0.5) % 1 + 1) % 1
      let espece = ESP_PYRUVATE
      let ax = posteX(POSTE_PDC) - 0.16
      let ay = posteY(POSTE_PDC) + 0.16
      let az = posteZ(POSTE_PDC)
      let fondu = 1
      if (phase < 0.3) {
        const t = phase / 0.3
        ax += (posteX(POSTE_PDC) - 0.11 - ax) * t
        ay += (posteY(POSTE_PDC) + 0.09 - ay) * t
        co2LacheVignette[v] = 0
      } else if (phase < 0.44) {
        ax = posteX(POSTE_PDC) - 0.11
        ay = posteY(POSTE_PDC) + 0.09
        if (phase > 0.36) espece = ESP_ACETALDEHYDE
        if (phase > 0.34 && co2LacheVignette[v] === 0) {
          co2LacheVignette[v] = 1
          emettreCO2(ax, ay, az, -0.05, 0.20, -0.06)
        }
      } else if (phase < 0.62) {
        const t = (phase - 0.44) / 0.18
        espece = ESP_ACETALDEHYDE
        ax = posteX(POSTE_PDC) - 0.11 + (posteX(POSTE_ADH) - 0.11 - (posteX(POSTE_PDC) - 0.11)) * t
        ay = posteY(POSTE_PDC) + 0.09
      } else if (phase < 0.76) {
        ax = posteX(POSTE_ADH) - 0.11
        ay = posteY(POSTE_ADH) + 0.09
        espece = phase > 0.7 ? ESP_ETHANOL : ESP_ACETALDEHYDE
      } else {
        const t = (phase - 0.76) / 0.24
        espece = ESP_ETHANOL
        ax = posteX(POSTE_ADH) - 0.11 + 0.28 * t
        ay = posteY(POSTE_ADH) + 0.09 - 0.16 * t
        fondu = Math.min(1, (1 - t) * 3)
      }
      especeS[acteur] = espece
      fonduS[acteur] = fondu
      posS[acteur * 3] = ax
      posS[acteur * 3 + 1] = ay
      posS[acteur * 3 + 2] = az
    }

    // 8. Les activités des postes. Un anneau éteint est un poste bloqué, et
    //    l'extinction se propage de l'oxygène jusqu'à la glycolyse.
    for (let a = 0; a < NB_ANNEAUX; a++) {
      let cible = 0.08
      if (a === ANNEAU_GAPDH) cible = nbNadPlus > 0 ? 1 : 0.08
      else if (a === ANNEAU_LDH) cible = occupantLdhNad >= 0 ? 1 : 0.1
      else if (a === ANNEAU_PDH) cible = chaineBouchee ? 0.08 : 1
      else if (a === ANNEAU_NAVETTE) cible = chaineBouchee ? 0.08 : 1
      else if (a === ANNEAU_I) cible = occupationI < CAP_I ? 1 : 0.08
      else if (a === ANNEAU_III) cible = occupationIII < CAP_III ? 1 : 0.08
      else if (a === ANNEAU_IV) cible = o2AmarreIV >= 0 ? 1 : 0.08
      else if (a === ANNEAU_SYNTHASE) cible = 0.1 + pulseSynthase * 0.9
      activite[a]! += (cible - activite[a]!) * Math.min(1, dt * 5)
      const intensite = activite[a]!
      const materiau = materiauxAnneaux[a]!
      materiau.emissive.setRGB(
        EMISSIF_ANNEAU[a * 3]! * intensite,
        EMISSIF_ANNEAU[a * 3 + 1]! * intensite,
        EMISSIF_ANNEAU[a * 3 + 2]! * intensite,
      )
      anneaux[a]!.scale.setScalar(RAYON_ANNEAU[a]! * (1 + 0.1 * intensite))
    }
    pulseSynthase = Math.max(0, pulseSynthase - dt * 1.6)

    // 9. L'indicateur d'oxygène, l'aiguillage, et la jauge de NAD⁺.
    materiauBulbe.emissive.setRGB(presenceLissee * 0.75, presenceLissee * 0.12, presenceLissee * 0.05)
    bulbe.scale.setScalar(0.55 + 0.45 * presenceLissee)
    // Les deux quais du carrefour : celui qu'on emprunte s'allume. Aucun des
    // deux ne se ferme jamais — ils ne font qu'indiquer où mène l'énergie.
    const manque = 1 - presenceLissee
    materiauQuaiMito.emissive.setRGB(
      presenceLissee * 0.85,
      presenceLissee * 0.35,
      presenceLissee * 0.08,
    )
    materiauQuaiFerment.emissive.setRGB(manque * 0.15, manque * 0.55, manque * 0.85)
    quais[0]!.scale.set(0.7 + 0.5 * presenceLissee, LONGUEUR_QUAI, 0.7 + 0.5 * presenceLissee)
    quais[1]!.scale.set(0.7 + 0.5 * manque, LONGUEUR_QUAI, 0.7 + 0.5 * manque)
    const fractionNad = nbNadPlus / NB_NAVETTES
    barreJauge.scale.set(1, Math.max(0.004, fractionNad * HAUTEUR_JAUGE), 1)
    barreJauge.position.set(
      X_JAUGE,
      Y_JAUGE - HAUTEUR_JAUGE * 0.5 + fractionNad * HAUTEUR_JAUGE * 0.5,
      Z_JAUGE,
    )

    // 10. Rendu des molécules carbonées, vignette comprise.
    quaternionTemp.identity()
    for (let acteur = 0; acteur < NB_ACTEURS_C; acteur++) rendreCarbone(acteur, temps)
    for (let m = 0; m < NB_MAILLAGES_C; m++) maillagesCarbone[m]!.instanceMatrix.needsUpdate = true

    // 11. Rendu des navettes et de leur hydrure.
    for (let n = 0; n < NB_NAVETTES_RENDUES; n++) {
      let px: number
      let py: number
      let pz: number
      let charge: boolean
      quaternionTemp.identity()
      if (n === NAVETTE_VIGNETTE) {
        // La navette garée sur l'alcool déshydrogénase de la vignette : elle
        // aussi rend son NAD⁺, et c'est le même point qu'à la LDH.
        px = posteX(POSTE_ADH) + 0.02
        py = posteY(POSTE_ADH) + 0.15
        pz = posteZ(POSTE_ADH)
        const phase = (((temps / PERIODE_VIGNETTE) % 1) + 1) % 1
        charge = phase < 0.7
      } else {
        px = posN[n * 3]!
        py = posN[n * 3 + 1]!
        pz = posN[n * 3 + 2]!
        charge = chargeN[n] === 1
        // Orientée par sa course : le dinucléotide est allongé, il se voit passer.
        directionTemp.set(vitN[n * 3]!, vitN[n * 3 + 1]!, vitN[n * 3 + 2]!)
        if (directionTemp.lengthSq() > 1e-8) {
          directionTemp.normalize()
          quaternionTemp.setFromUnitVectors(AXE_X, directionTemp)
        }
      }
      positionTemp.set(px, py, pz)
      echelleTemp.set(0.055, 0.030, 0.030)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      maillageNad.setMatrixAt(n, matriceTemp)

      // L'hydrure : le NADH le porte, le NAD⁺ ne l'a plus. C'est à ce seul
      // détail qu'on lit l'état de charge, et il se voit de loin.
      if (charge) {
        let hx = px + 0.05
        let hy = py + 0.05
        let hz = pz
        if (n < NB_NAVETTES && etatN[n] === N_AU_CONSO && occupantLdhSub >= 0) {
          // Transfert en cours : l'hydrure traverse vers le pyruvate.
          const t = Math.min(1, minuteurS[occupantLdhSub]! / DUREE_LDH)
          hx = px + (posS[occupantLdhSub * 3]! - px) * t
          hy = py + (posS[occupantLdhSub * 3 + 1]! - py) * t
          hz = pz + (posS[occupantLdhSub * 3 + 2]! - pz) * t
        }
        positionTemp.set(hx, hy, hz)
        echelleTemp.setScalar(RAYON_HYDRURE)
      } else {
        positionTemp.set(0, 0, 0)
        echelleTemp.setScalar(0)
      }
      quaternionTemp.identity()
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      maillageHydrure.setMatrixAt(n, matriceTemp)
    }
    maillageNad.instanceMatrix.needsUpdate = true
    maillageHydrure.instanceMatrix.needsUpdate = true

    // 12. Rendu des électrons.
    quaternionTemp.identity()
    for (let e = 0; e < NB_ELECTRONS; e++) {
      const maillon = maillonE[e]!
      if (maillon < 0) {
        positionTemp.set(0, 0, 0)
        echelleTemp.setScalar(0)
      } else {
        const arrivee = POSTE_MAILLON[maillon]!
        const phase = phaseE[e]!
        const orbite = 0.055
        const ax = Math.cos(phase * 6.283 + temps * 3.1) * orbite
        const ay = Math.sin(phase * 6.283 + temps * 3.1) * orbite
        if (transitE[e] === 1) {
          const t = progresE[e]!
          const lisse = t * t * (3 - 2 * t)
          const src = sourceE[e]!
          positionTemp.set(
            posteX(src) + (posteX(arrivee) - posteX(src)) * lisse,
            posteY(src) + (posteY(arrivee) - posteY(src)) * lisse + Math.sin(lisse * 3.14) * 0.05,
            posteZ(src) + (posteZ(arrivee) - posteZ(src)) * lisse,
          )
        } else {
          positionTemp.set(posteX(arrivee) + 0.06 + ax * 0.4, posteY(arrivee) + ay, posteZ(arrivee) + ax)
        }
        echelleTemp.setScalar(RAYON_ELECTRON)
      }
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      maillageElectrons.setMatrixAt(e, matriceTemp)
    }
    maillageElectrons.instanceMatrix.needsUpdate = true

    // 13. Rendu de l'oxygène : deux atomes, toujours, jusqu'à sa réduction.
    for (let o = 0; o < NB_O2; o++) {
      const fondu = fonduO2[o]!
      axeTumble(phaseO2[o]!, temps)
      for (let b = 0; b < 2; b++) {
        if (fondu <= 0.001) {
          positionTemp.set(0, 0, 0)
          echelleTemp.setScalar(0)
        } else {
          const decalage = (b - 0.5) * PAS_O2
          positionTemp.set(
            posO2[o * 3]! + axeTumbleX * decalage,
            posO2[o * 3 + 1]! + axeTumbleY * decalage,
            posO2[o * 3 + 2]! + axeTumbleZ * decalage,
          )
          echelleTemp.setScalar(RAYON_O2 * fondu)
        }
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        maillageO2.setMatrixAt(o * 2 + b, matriceTemp)
      }
    }
    maillageO2.instanceMatrix.needsUpdate = true

    // 14. Le CO₂ qui s'en va : trois atomes, le carbone qui vient de partir.
    for (let c = 0; c < NB_CO2; c++) {
      const reste = vieCO2[c]!
      if (reste > 0) {
        vieCO2[c] = reste - dt
        const c3 = c * 3
        const frein = Math.exp(-dt * 0.9)
        for (let k = 0; k < 3; k++) {
          vitCO2[c3 + k] = vitCO2[c3 + k]! * frein + (alea() - 0.5) * 0.06 * racineDt
          posCO2[c3 + k] = posCO2[c3 + k]! + vitCO2[c3 + k]! * dt
        }
      }
      const fondu = reste > 0 ? Math.min(1, (DUREE_CO2 - reste) * 6, reste * 1.6) : 0
      for (let b = 0; b < 3; b++) {
        if (fondu <= 0.001) {
          positionTemp.set(0, 0, 0)
          echelleTemp.setScalar(0)
        } else {
          const decalage = (b - 1) * 0.042
          positionTemp.set(
            posCO2[c * 3]! + axeCO2[c * 3]! * decalage,
            posCO2[c * 3 + 1]! + axeCO2[c * 3 + 1]! * decalage,
            posCO2[c * 3 + 2]! + axeCO2[c * 3 + 2]! * decalage,
          )
          echelleTemp.setScalar((b === 1 ? RAYON_CARBONE : RAYON_CO2) * fondu)
        }
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        maillageCO2.setMatrixAt(c * 3 + b, matriceTemp)
      }
    }
    maillageCO2.instanceMatrix.needsUpdate = true

    // 15. L'eau formée au complexe IV : la seule sortie de l'oxygène.
    for (let h = 0; h < NB_H2O; h++) {
      const reste = vieH2O[h]!
      if (reste > 0) {
        vieH2O[h] = reste - dt
        const h3 = h * 3
        const frein = Math.exp(-dt * 1.1)
        for (let k = 0; k < 3; k++) {
          vitH2O[h3 + k] = vitH2O[h3 + k]! * frein + (alea() - 0.5) * 0.05 * racineDt
          posH2O[h3 + k] = posH2O[h3 + k]! + vitH2O[h3 + k]! * dt
        }
      }
      const fondu = reste > 0 ? Math.min(1, (DUREE_H2O - reste) * 6, reste * 1.6) : 0
      if (fondu <= 0.001) {
        positionTemp.set(0, 0, 0)
        echelleTemp.setScalar(0)
      } else {
        positionTemp.set(posH2O[h * 3]!, posH2O[h * 3 + 1]!, posH2O[h * 3 + 2]!)
        echelleTemp.setScalar(RAYON_H2O * fondu)
      }
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      maillageH2O.setMatrixAt(h, matriceTemp)
    }
    maillageH2O.instanceMatrix.needsUpdate = true

    // 16. Les jetons d'ATP en vol vers le compteur.
    for (let a = 0; a < NB_ATP_VOL; a++) {
      if (actifAtp[a] === 0) {
        positionTemp.set(0, 0, 0)
        echelleTemp.setScalar(0)
      } else {
        progresAtp[a]! += dt / DUREE_VOL_ATP
        const t = Math.min(1, progresAtp[a]!)
        const slot = slotAtp[a]!
        const sx = sourceAtp[a * 3]!
        const sy = sourceAtp[a * 3 + 1]!
        const sz = sourceAtp[a * 3 + 2]!
        positionTemp.set(
          sx + (posSlot[slot * 3]! - sx) * t,
          sy + (posSlot[slot * 3 + 1]! - sy) * t + Math.sin(t * 3.14) * 0.14,
          sz + (posSlot[slot * 3 + 2]! - sz) * t,
        )
        echelleTemp.set(0.045, 0.026, 0.026)
        if (t >= 1) {
          actifAtp[a] = 0
          allumee[slot] = 1
        }
      }
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      maillageAtp.setMatrixAt(a, matriceTemp)
    }
    maillageAtp.instanceMatrix.needsUpdate = true

    // 17. Le compteur : deux pastilles pour la glycolyse, trente pour la
    //     respiration. C'est ce qui transforme l'animation en explication.
    for (let k = 0; k < NB_SLOTS; k++) {
      remplissage[k]! += ((allumee[k] === 1 ? 1 : 0) - remplissage[k]!) * Math.min(1, dt * 6)
      positionTemp.set(posSlot[k * 3]!, posSlot[k * 3 + 1]!, posSlot[k * 3 + 2]!)
      echelleTemp.setScalar(RAYON_PASTILLE * Math.max(0.12, remplissage[k]!))
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      maillagePastilles.setMatrixAt(k, matriceTemp)
    }
    maillagePastilles.instanceMatrix.needsUpdate = true

    echelleTemp.set(1, 1, 1)
  }

  animer(0)

  return [
    {
      cle: 'fermentation',
      nom: 'Le destin du pyruvate : oxygène ou fermentation',
      siege: 'Cytosol et mitochondrie',
      facteur: 'accéléré ×5',
      justificationFacteur:
        "Ce qui est accéléré ×5 ici est le RÉGIME, pas le geste enzymatique : dans un muscle qui " +
        "démarre, l'oxygène local s'épuise puis revient en une trentaine de secondes — 35 s réelles " +
        "deviennent 7 s d'écran, et les deux régimes se comparent dans le même plan, à la suite.",
      ellision:
        "Trois horloges cohabitent, et une seule porte le facteur affiché. Les actes enzymatiques sont " +
        "en réalité RALENTIS d'environ ×1 000 : la lactate déshydrogénase traite quelques centaines de " +
        "molécules par seconde et un électron traverse la chaîne en quelques millisecondes ; à vitesse " +
        "vraie on ne verrait qu'un flou. Les attentes de rencontre sont COUPÉES, et la densité divisée " +
        "par plusieurs milliers. Sont absentes la glycolyse et les dix étapes du cycle de Krebs, qui " +
        "sont des modules voisins ; le coenzyme A n'est pas dessiné ; l'ubiquinone et le cytochrome c " +
        "sont sautés — un électron passe du complexe I au III puis au IV sans transporteur visible ; " +
        "le complexe II et les FADH₂ du cycle de Krebs sont absents ; le gradient de protons est figuré " +
        "par l'ATP synthase mais non compté (≈ 10 H⁺ pompés par NADH). Le NADH cytosolique ne traverse " +
        "PAS la membrane : ce sont ses électrons qui passent, par la navette malate-aspartate, et c'est " +
        "cela que montre l'hydrure qui franchit la paroi. La diffusion est brownienne mais BIAISÉE vers " +
        "le poste visé : livrée au pur hasard, une rencontre demanderait ici des minutes — les refus, " +
        "eux, sont réels et se voient. Enfin la vignette « levure », en bas à droite, est scriptée et " +
        "non simulée.",
      description:
        "Le pyruvate sorti de la glycolyse se présente devant un aiguillage : avec de l'oxygène il entre " +
        "dans la mitochondrie, où la pyruvate déshydrogénase lui retire un carbone — le CO₂ qui s'en va — " +
        "et envoie les deux autres au cycle de Krebs, pour 30 à 32 ATP par glucose ; sans oxygène, la " +
        "lactate déshydrogénase le réduit en lactate et le bilan reste aux 2 ATP de la glycolyse. La " +
        "fermentation ne fabrique aucun ATP : sa seule fonction est de rendre le NAD⁺ que la glycolyse " +
        "consomme, et c'est cette boucle — les navettes et la jauge — qu'il faut suivre, pas le lactate. " +
        "L'oxygène, lui, ne pousse rien : il TIRE les électrons au bout de la chaîne, au complexe IV, et " +
        "qu'il manque, la file se bloque de proche en proche jusqu'à la glycolyse, anneau par anneau. " +
        "Molécules et enzymes sont dessinées trente à cinquante fois trop grosses pour rester visibles à " +
        "côté d'une membrane : c'est un parti de représentation, pas une échelle.",
      objet: groupe,
      ancre: SIEGE.clone(),
      rayonCadrage: 1.4,
      couleur: TEINTE_NAD,
      animer,
    },
  ]
}
