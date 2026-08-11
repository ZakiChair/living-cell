import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import { SIEGES, type MecanismeBrut } from './contrat.js'

/**
 * ÉPISSAGE DE L'ARN PRÉ-MESSAGER PAR LE SPLICEOSOME.
 *
 * La scène corrige d'emblée l'erreur de tous les schémas : chez l'humain l'exon
 * médian fait 120 paires de bases et l'intron moyen 5 419, soit un facteur 45.
 * Ce sont donc de PETITS blocs verts séparés de LONGS fils gris — l'inverse du
 * dessin habituel. À la fin, l'ARNm mature ne fait plus qu'un onzième de la
 * longueur du transcrit, et c'est le vrai visage d'un gène humain.
 *
 * Calibres : un brin d'ARN fait 1 nm de diamètre, invisible à cette distance.
 * Il est dessiné en cordon de 14 nm, comme le brin de la scène de traduction.
 * Les LONGUEURS, elles, sont vraies au nucléotide près (0,0003 µm par base) —
 * seuls les introns sont raccourcis, et le badge le dit.
 */

// ── Géométrie du transcrit, en micromètres ────────────────────────────────
const NB_EXONS = 4
const NB_INTRONS = 3
/** 120 pb × 0,0003 µm : longueur d'exon VRAIE, non retouchée. */
const LONG_EXON = 0.036
/** 5 419 pb feraient 1,626 µm. Seul élément raccourci de la scène (×3,4). */
const LONG_INTRON = 0.48
const LONG_TOTALE = NB_EXONS * LONG_EXON + NB_INTRONS * LONG_INTRON
const PAS_MOTIF = LONG_EXON + LONG_INTRON

/**
 * Position du point de branchement le long de l'intron.
 *
 * Il est réellement à ~25 nt du site 3', soit 99,5 % de l'intron. Dessiné là,
 * la queue du lasso ferait 8 nm et disparaîtrait : on la porte à 8 % pour
 * qu'elle reste lisible. C'est le seul écart de proportion interne au lasso.
 */
const U_BRANCHE = 0.92
const RAYON_BOUCLE = (LONG_INTRON * U_BRANCHE) / (Math.PI * 2)
const LONG_QUEUE = LONG_INTRON * (1 - U_BRANCHE)

const PERLES_EXON = 10
const PERLES_INTRON = 96
/** Perle qui porte l'adénosine du point de branchement. */
const PERLE_BRANCHE = Math.round(U_BRANCHE * (PERLES_INTRON - 1))

const RAYON_PERLE_INTRON = 0.007
/** L'exon est dessiné plus épais : c'est la convention « boîte / ligne ». */
const RAYON_PERLE_EXON = 0.013

// ── Minutage, en secondes d'écran ─────────────────────────────────────────
/** 5 à 10 min par intron ; 9 s d'écran à ×50 font 7,5 min réelles. */
const DUREE_CYCLE = 9
const ECART_CYCLE = 10
const DEBUT_PREMIER = 3.6
/** 16 737 pb à 2 kb/min font 8,4 min, soit 10 s à ×50. */
const DUREE_TRANSCRIPTION = 10
const DUREE_BOUCLE = 35

/**
 * La fenêtre du premier cycle, PUBLIÉE pour être mesurable.
 *
 * Les cinq snRNP servent les trois introns à tour de rôle : qui échantillonne
 * la scène sans savoir où commence un cycle mélange trois histoires et lit
 * n'importe quoi. Le mécanisme publie donc sa fenêtre, comme il publie déjà
 * son porteur de cycle pour le harnais de période.
 */
export const CYCLE_PREMIER_INTRON = { debut: DEBUT_PREMIER, duree: DUREE_CYCLE }

// Fractions du cycle d'un intron. L'ordre d'arrivée est celui de la biochimie :
// U1 sur le site 5', U2 sur le point de branchement, puis le tri-snRNP en bloc.
const P_U1 = 0.12
const P_U2 = 0.28
const P_TRI = 0.44
const P_DEPART_U1 = 0.56
const P_DEPART_U4 = 0.6
/** Première transestérification : le site 5' attaque l'adénosine, le lasso naît. */
const P_LASSO = 0.64
const P_LASSO_FIN = 0.76
/** Seconde transestérification : les exons se soudent, le lasso se détache. */
const P_JONCTION = 0.79
const P_JONCTION_FIN = 0.89
const P_DISPERSION = 0.89
const P_DEGRADATION = 0.95
const DUREE_DEGRADATION = 0.2

// ── Acteurs du spliceosome ────────────────────────────────────────────────
const NB_SNRNP = 5
const I_U1 = 0
const I_U2 = 1
const I_U4 = 2
const I_U5 = 3
const I_U6 = 4
/** Les noms tels que la biologie les écrit, et tels que la scène les publie. */
const NOMS_SNRNP = ['U1', 'U2', 'U4', 'U5', 'U6']

/** Jaune Okabe-Ito, réservé aux deux sites qui vont se lier en 2'-5'. */
const TEINTE_SITE = 0xf0e442
const TEINTES_SNRNP = [0xd55e00, 0xcc79a7, 0x56b4e9, 0x8a5bb0, 0x0072b2]

/** Figurants : les rencontres improductives sont la règle, pas l'exception. */
const NB_FIGURANTS_U1 = 18
const NB_FIGURANTS_U2 = 12

// ── Temporaires hissés : animer() ne doit RIEN allouer ────────────────────
const AXE_Y = new THREE.Vector3(0, 1, 0)
const matriceTemp = new THREE.Matrix4()
const quaternionTemp = new THREE.Quaternion()
const echelleTemp = new THREE.Vector3(1, 1, 1)
const positionTemp = new THREE.Vector3()
const lassoTemp = new THREE.Vector3()
const brownienTemp = new THREE.Vector3()
const ancreTemp = new THREE.Vector3()
const ancreTemp2 = new THREE.Vector3()
const ancreTemp3 = new THREE.Vector3()
const pointQ = new THREE.Vector3()
const pointNoeud = new THREE.Vector3()
const centreBoucle = new THREE.Vector3()
const tangenteA = new THREE.Vector3()
const tangenteB = new THREE.Vector3()

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
 * Trois sinusoïdes de fréquences incommensurables par axe : ce n'est pas un vrai
 * mouvement brownien — il faudrait de l'état — mais le tracé est errant, sans
 * période perceptible, et surtout SANS DIRECTION : aucune molécule ne sait où
 * elle va.
 */
function derive(
  indice: number,
  temps: number,
  amplitude: number,
  frequences: Float32Array,
  phases: Float32Array,
  sortie: THREE.Vector3,
): THREE.Vector3 {
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
  return sortie.set(x * amplitude, y * amplitude, z * amplitude)
}

export function creerEpissage(): MecanismeBrut[] {
  const alea = creerAlea(58201)
  const groupe = new THREE.Group()
  // Décalage donné par rapport au CENTRE du noyau : posé en coordonnées monde,
  // un transcrit de 1,6 µm sortirait de la sphère nucléaire.
  groupe.position.copy(SIEGES.noyau).add(new THREE.Vector3(0.4, -0.8, -1.3))
  groupe.rotation.set(0.18, 0.42, -0.12)

  // ── Le brin : replié, jamais tendu — un ARN naissant est en pelote lâche ──
  const pointsBrin: THREE.Vector3[] = []
  for (let i = 0; i <= 14; i++) {
    const u = i / 14
    pointsBrin.push(
      new THREE.Vector3(
        (u - 0.5) * 0.85,
        Math.sin(u * Math.PI * 2.8) * 0.17 + (alea() - 0.5) * 0.03,
        Math.cos(u * Math.PI * 2.0) * 0.12 + (alea() - 0.5) * 0.03,
      ),
    )
  }
  // On met la courbe à l'échelle pour que sa longueur d'arc vaille exactement
  // celle du transcrit : sans ça, exons et introns seraient à la bonne
  // proportion mais à la mauvaise taille.
  const brouillon = new THREE.CatmullRomCurve3(pointsBrin)
  const ajustement = LONG_TOTALE / brouillon.getLength()
  for (const point of pointsBrin) point.multiplyScalar(ajustement)
  const courbe = new THREE.CatmullRomCurve3(pointsBrin)
  // Amorce le cache d'abscisse curviligne AVANT la première image : sinon il
  // serait construit — et alloué — dans animer().
  courbe.getLength()

  const surBrin = (s: number, sortie: THREE.Vector3): THREE.Vector3 =>
    courbe.getPointAt(s <= 0 ? 0 : s >= LONG_TOTALE ? 1 : s / LONG_TOTALE, sortie)

  // Curve.getTangent appelle getPoint SANS cible : deux Vector3 alloués par
  // appel. On dérive donc la tangente à la main.
  const tangenteSurBrin = (s: number, sortie: THREE.Vector3): THREE.Vector3 => {
    surBrin(s - 0.005, tangenteA)
    surBrin(s + 0.005, tangenteB)
    return sortie.copy(tangenteB).sub(tangenteA).normalize()
  }

  const debutExon = (i: number): number => i * PAS_MOTIF
  const debutIntron = (k: number): number => LONG_EXON + k * PAS_MOTIF

  // Plan de chaque lasso : perpendiculaire au brin, tourné d'un intron à
  // l'autre pour que les trois boucles ne pendent pas toutes du même côté.
  const dirLasso: THREE.Vector3[] = []
  const perpLasso: THREE.Vector3[] = []
  for (let k = 0; k < NB_INTRONS; k++) {
    const tangente = tangenteSurBrin(debutIntron(k) + LONG_INTRON * 0.5, new THREE.Vector3())
    const e1 = new THREE.Vector3().crossVectors(tangente, AXE_Y).normalize()
    const e2 = new THREE.Vector3().crossVectors(tangente, e1).normalize()
    const angle = k * 2.1
    dirLasso.push(
      e1.clone().multiplyScalar(Math.cos(angle)).addScaledVector(e2, Math.sin(angle)).normalize(),
    )
    perpLasso.push(
      e1.clone().multiplyScalar(-Math.sin(angle)).addScaledVector(e2, Math.cos(angle)).normalize(),
    )
  }

  // ── Le transcrit : deux cordons, deux teintes, aucune ambiguïté ──────────
  const geoPerleExon = new THREE.IcosahedronGeometry(RAYON_PERLE_EXON, 1)
  const geoPerleIntron = new THREE.IcosahedronGeometry(RAYON_PERLE_INTRON, 0)
  const perlesExon = new THREE.InstancedMesh(
    geoPerleExon,
    materiauOrganite(TEINTES.reticulumRugueux, { doubleFace: false }),
    NB_EXONS * PERLES_EXON,
  )
  const perlesIntron = new THREE.InstancedMesh(
    geoPerleIntron,
    materiauOrganite(TEINTES.cytosquelette, { doubleFace: false }),
    NB_INTRONS * PERLES_INTRON,
  )
  // Porte le cycle auquel le badge se réfère : voir `observable`.
  perlesIntron.name = 'intron-en-cours-d-excision'
  // Trois marqueurs par intron : site 5', adénosine du branchement, et le nœud
  // 2'-5' lui-même — la signature chimique de la réaction.
  const marqueurs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0105, 1),
    materiauOrganite(TEINTE_SITE, { doubleFace: false, emissif: 0x3a3610 }),
    NB_INTRONS * 3,
  )
  perlesExon.frustumCulled = false
  perlesIntron.frustumCulled = false
  marqueurs.frustumCulled = false
  groupe.add(perlesExon, perlesIntron, marqueurs)

  // ── Les cinq snRNP ───────────────────────────────────────────────────────
  // Formes et tailles distinctes : U5 est le plus gros, U6 le plus menu. Le
  // complexe assemblé fait une cinquantaine de nanomètres, plus large que
  // l'exon qu'il traite — ce déséquilibre-là est vrai.
  const geoSnrnp = [
    new THREE.IcosahedronGeometry(0.0105, 1),
    new THREE.IcosahedronGeometry(0.0125, 1),
    new THREE.OctahedronGeometry(0.0095, 0),
    new THREE.IcosahedronGeometry(0.0145, 1),
    new THREE.DodecahedronGeometry(0.008, 0),
  ]
  const snrnp: THREE.Mesh[] = []
  for (let i = 0; i < NB_SNRNP; i++) {
    const corps = new THREE.Mesh(
      geoSnrnp[i]!,
      materiauOrganite(TEINTES_SNRNP[i]!, { doubleFace: false }),
    )
    if (i === I_U2) corps.scale.set(1.25, 0.8, 1)
    // Nommés : la relève de U1 par U6 est le fait central de cette scène,
    // et un test doit pouvoir la MESURER sur la géométrie livrée.
    corps.name = NOMS_SNRNP[i]!
    groupe.add(corps)
    snrnp.push(corps)
  }

  // Figurants : d'autres U1 et U2, identiques aux vrais, qui heurtent le brin
  // sans jamais s'y fixer. C'est ce que fait l'immense majorité d'entre eux.
  const figurantsU1 = new THREE.InstancedMesh(
    geoSnrnp[I_U1]!,
    materiauOrganite(TEINTES_SNRNP[I_U1]!, { doubleFace: false, opacite: 0.75 }),
    NB_FIGURANTS_U1,
  )
  const figurantsU2 = new THREE.InstancedMesh(
    geoSnrnp[I_U2]!,
    materiauOrganite(TEINTES_SNRNP[I_U2]!, { doubleFace: false, opacite: 0.75 }),
    NB_FIGURANTS_U2,
  )
  figurantsU1.frustumCulled = false
  figurantsU2.frustumCulled = false
  groupe.add(figurantsU1, figurantsU2)

  // ── L'ARN polymérase, qui transcrit encore pendant qu'on épisse ──────────
  const machine = new THREE.Group()
  const corpsPolymerase = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0095, 1),
    materiauOrganite(TEINTES.nucleole, { doubleFace: false }),
  )
  corpsPolymerase.scale.set(1, 1.5, 1)
  // Le duplex d'ADN se prolonge DEVANT la polymérase, là où l'ARN n'existe pas
  // encore : c'est ce qui rend l'épissage co-transcriptionnel lisible.
  const adn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0035, 0.0035, 0.16, 6, 1, true),
    materiauOrganite(TEINTES.membraneNucleaire),
  )
  adn.position.y = 0.082
  machine.add(corpsPolymerase, adn)
  groupe.add(machine)

  // ── Trajectoires errantes, tirées une fois pour toutes ───────────────────
  const NB_ERRANTS = NB_SNRNP + NB_INTRONS + NB_FIGURANTS_U1 + NB_FIGURANTS_U2
  const frequences = new Float32Array(NB_ERRANTS * 3 * NB_HARMONIQUES)
  const phases = new Float32Array(NB_ERRANTS * 3 * NB_HARMONIQUES)
  for (let i = 0; i < frequences.length; i++) {
    frequences[i] = 0.13 + alea() * 0.72
    phases[i] = alea()
  }
  const OFFSET_LASSO = NB_SNRNP
  const OFFSET_FIGURANTS = NB_SNRNP + NB_INTRONS

  const centresFigurants: THREE.Vector3[] = []
  for (let i = 0; i < NB_FIGURANTS_U1 + NB_FIGURANTS_U2; i++) {
    centresFigurants.push(
      new THREE.Vector3((alea() - 0.5) * 0.84, (alea() - 0.5) * 0.4, (alea() - 0.5) * 0.36),
    )
  }

  // Points clés du transcrit, réévalués à chaque image : les snRNP s'y
  // accrochent, et ils suivent donc le lasso quand il se forme.
  const site5: THREE.Vector3[] = []
  const branche: THREE.Vector3[] = []
  const jonction: THREE.Vector3[] = []
  for (let k = 0; k < NB_INTRONS; k++) {
    site5.push(new THREE.Vector3())
    branche.push(new THREE.Vector3())
    jonction.push(new THREE.Vector3())
  }

  const etatLasso = new Float32Array(NB_INTRONS)
  const etatRetrait = new Float32Array(NB_INTRONS)
  const etatDetache = new Float32Array(NB_INTRONS)
  const etatDegrade = new Float32Array(NB_INTRONS)
  const phaseCycle = new Float32Array(NB_INTRONS)

  const PHASE_ARRIVEE = [P_U1, P_U2, P_TRI, P_TRI, P_TRI]
  const PHASE_SORTIE = [P_DEPART_U1, P_DISPERSION, P_DEPART_U4, P_DISPERSION, P_DISPERSION]

  /**
   * Accrochage d'un snRNP, entre 0 (libre) et 1 (fixé).
   *
   * Deux rencontres improductives précèdent la bonne : la reconnaissance du
   * site est réversible, et un snRNP qui touche repart le plus souvent.
   */
  const accrochage = (i: number, p: number): number => {
    const arrivee = PHASE_ARRIVEE[i]!
    let a = 0.7 * bosse((p - (arrivee - 0.1)) / 0.03)
    const seconde = 0.78 * bosse((p - (arrivee - 0.05)) / 0.026)
    if (seconde > a) a = seconde
    const prise = lissage((p - arrivee) / 0.017)
    if (prise > a) a = prise
    return a * (1 - lissage((p - PHASE_SORTIE[i]!) / 0.07))
  }

  /** Où le snRNP `i` se fixe sur l'intron `k`. */
  const ancrage = (i: number, k: number, p: number, sortie: THREE.Vector3): THREE.Vector3 => {
    const d1 = dirLasso[k]!
    const d2 = perpLasso[k]!
    if (i === I_U1) return sortie.copy(site5[k]!).addScaledVector(d1, 0.03)
    if (i === I_U2) return sortie.copy(branche[k]!).addScaledVector(d1, 0.034)
    if (i === I_U4) {
      return sortie.copy(site5[k]!).addScaledVector(d1, 0.028).addScaledVector(d2, 0.044)
    }
    if (i === I_U5) return sortie.copy(jonction[k]!).addScaledVector(d2, 0.038)
    if (i === I_U6) {
      // U6 rejoint d'abord U2 au point de branchement, puis PREND LA PLACE de
      // U1 sur le site 5' : c'est la raison même du départ de U1.
      sortie.copy(branche[k]!).addScaledVector(d2, 0.034)
      ancreTemp3.copy(site5[k]!).addScaledVector(d1, 0.03)
      return sortie.lerp(ancreTemp3, lissage((p - P_DEPART_U1) / 0.08))
    }
    // Le cas U6 était implicite : il attrapait « tout le reste ». Un sixième
    // snRNP ajouté un jour aurait donc été placé en U6, en silence. Chaque
    // acteur a maintenant sa branche, et l'oubli devient une erreur.
    throw new Error(`snRNP ${i} sans ancrage déclaré`)
  }

  const animer = (temps: number): void => {
    const tb = temps % DUREE_BOUCLE
    const transcrit = Math.min(LONG_TOTALE, (tb / DUREE_TRANSCRIPTION) * LONG_TOTALE)
    // L'ARNm mature s'éclipse en fin de boucle plutôt que de disparaître d'un
    // coup, puis la transcription repart de zéro.
    const sortie = 1 - lissage((tb - (DUREE_BOUCLE - 2)) / 2)

    for (let k = 0; k < NB_INTRONS; k++) {
      const p = (tb - (DEBUT_PREMIER + k * ECART_CYCLE)) / DUREE_CYCLE
      phaseCycle[k] = p
      etatLasso[k] = lissage((p - P_LASSO) / (P_LASSO_FIN - P_LASSO))
      etatRetrait[k] = lissage((p - P_JONCTION) / (P_JONCTION_FIN - P_JONCTION))
      etatDetache[k] = lissage((p - P_JONCTION_FIN) / 0.1)
      etatDegrade[k] = lissage((p - P_DEGRADATION) / DUREE_DEGRADATION)
    }

    // ── Exons : ils glissent l'un vers l'autre à mesure qu'on retire ────────
    for (let i = 0; i < NB_EXONS; i++) {
      let retrait = 0
      for (let k = 0; k < i; k++) retrait += etatRetrait[k]! * LONG_INTRON
      for (let j = 0; j < PERLES_EXON; j++) {
        const s = debutExon(i) + (j / (PERLES_EXON - 1)) * LONG_EXON
        surBrin(s - retrait, positionTemp)
        // Une perle n'existe qu'une fois transcrite : le brin naît derrière la
        // polymérase, il n'est pas là depuis le début.
        const apparu = lissage((transcrit - s) / 0.02)
        echelleTemp.setScalar(apparu * sortie)
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        perlesExon.setMatrixAt(i * PERLES_EXON + j, matriceTemp)
        // La dernière perle de l'exon amont : c'est là que U5 tient les deux
        // extrémités à souder.
        if (j === PERLES_EXON - 1 && i < NB_INTRONS) jonction[i]!.copy(positionTemp)
      }
    }

    // ── Introns : sur le brin, puis en lasso, puis digérés ─────────────────
    for (let k = 0; k < NB_INTRONS; k++) {
      let retrait = 0
      for (let q = 0; q < k; q++) retrait += etatRetrait[q]! * LONG_INTRON
      const f = etatLasso[k]!
      const detache = etatDetache[k]!

      // Point d'attache 3' : la queue du lasso reste soudée à l'exon aval
      // jusqu'à la seconde transestérification, puis le lasso part à la dérive.
      surBrin(debutIntron(k) + LONG_INTRON - retrait, pointQ)
      if (detache > 0) {
        derive(OFFSET_LASSO + k, temps, 0.045 * detache, frequences, phases, brownienTemp)
        pointQ.addScaledVector(dirLasso[k]!, detache * 0.1).add(brownienTemp)
      }
      pointNoeud.copy(pointQ).addScaledVector(dirLasso[k]!, LONG_QUEUE)
      centreBoucle.copy(pointNoeud).addScaledVector(dirLasso[k]!, RAYON_BOUCLE)

      for (let j = 0; j < PERLES_INTRON; j++) {
        const u = j / (PERLES_INTRON - 1)
        const s = debutIntron(k) + u * LONG_INTRON
        surBrin(s - retrait, positionTemp)

        if (f > 0) {
          if (u <= U_BRANCHE) {
            // La boucle se referme exactement là où le site 5' rencontre
            // l'adénosine : le lasso est fermé par cette liaison 2'-5'.
            const angle = (Math.PI * 2 * u) / U_BRANCHE
            lassoTemp
              .copy(centreBoucle)
              .addScaledVector(dirLasso[k]!, -RAYON_BOUCLE * Math.cos(angle))
              .addScaledVector(perpLasso[k]!, -RAYON_BOUCLE * Math.sin(angle))
          } else {
            lassoTemp.copy(pointNoeud).lerp(pointQ, (u - U_BRANCHE) / (1 - U_BRANCHE))
          }
          positionTemp.lerp(lassoTemp, f)
        }

        // Digestion : une vague qui part du nœud débranché et remonte le lasso.
        const reste = 1 - Math.min(1, Math.max(0, etatDegrade[k]! * (PERLES_INTRON + 14) - j) / 14)
        const apparu = lissage((transcrit - s) / 0.02)
        echelleTemp.setScalar(apparu * reste * sortie)
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        perlesIntron.setMatrixAt(k * PERLES_INTRON + j, matriceTemp)

        if (j === 0) site5[k]!.copy(positionTemp)
        if (j === PERLE_BRANCHE) branche[k]!.copy(positionTemp)
      }

      // Les deux points jaunes se rejoignent, et le nœud apparaît entre eux.
      // Chacun n'existe qu'une fois SA base transcrite : le point de branchement
      // arrive bien après le site 5', et c'est pour ça que l'ordre d'assemblage
      // est celui-là.
      const survie = 1 - Math.min(1, etatDegrade[k]! * 3)
      const vu5 = lissage((transcrit - debutIntron(k)) / 0.02) * sortie * survie
      const vuBranche =
        lissage((transcrit - (debutIntron(k) + U_BRANCHE * LONG_INTRON)) / 0.02) * sortie * survie
      echelleTemp.setScalar(vu5)
      matriceTemp.compose(site5[k]!, quaternionTemp, echelleTemp)
      marqueurs.setMatrixAt(k * 3, matriceTemp)
      echelleTemp.setScalar(vuBranche)
      matriceTemp.compose(branche[k]!, quaternionTemp, echelleTemp)
      marqueurs.setMatrixAt(k * 3 + 1, matriceTemp)
      echelleTemp.setScalar(vuBranche * f * 1.45)
      matriceTemp.compose(pointNoeud, quaternionTemp, echelleTemp)
      marqueurs.setMatrixAt(k * 3 + 2, matriceTemp)
    }
    echelleTemp.setScalar(1)

    // ── Les snRNP : ils rôdent, se cognent, et finissent par prendre ────────
    // L'intron courant est celui dont le cycle est en cours ; le relais se fait
    // à l'instant où le précédent a fini de disperser ses snRNP.
    let kCourant = 0
    for (let k = 1; k < NB_INTRONS; k++) {
      if (tb >= DEBUT_PREMIER + k * ECART_CYCLE - 0.8) kCourant = k
    }
    const p = phaseCycle[kCourant]!
    // Après dispersion, les snRNP ne disparaissent pas : ils sont RECYCLÉS et
    // dérivent vers l'intron suivant.
    const relais = lissage((p - P_DISPERSION) / 0.13)

    for (let i = 0; i < NB_SNRNP; i++) {
      ancrage(i, kCourant, p, ancreTemp)
      if (relais > 0) {
        if (kCourant + 1 < NB_INTRONS) {
          ancrage(i, kCourant + 1, -1, ancreTemp2)
        } else {
          // Plus d'intron à épisser : ils s'en vont vers le nucléoplasme.
          ancreTemp2.copy(ancreTemp).addScaledVector(perpLasso[kCourant]!, 0.14)
        }
        ancreTemp.lerp(ancreTemp2, relais)
      }
      const a = accrochage(i, p)
      derive(i, temps, 0.13, frequences, phases, brownienTemp)
      // Une seule formule : fixé, le snRNP est sur son site ; libre, il erre
      // autour. Rien ne le guide, il passe et repasse jusqu'à ce qu'il prenne.
      snrnp[i]!.position.copy(ancreTemp).addScaledVector(brownienTemp, 1 - a)
    }

    // ── Figurants : la nuée de rencontres qui ne mènent à rien ──────────────
    // Pilotés par le temps NON bouclé, sinon la boucle se verrait sur eux.
    for (let i = 0; i < NB_FIGURANTS_U1 + NB_FIGURANTS_U2; i++) {
      derive(OFFSET_FIGURANTS + i, temps, 0.15, frequences, phases, brownienTemp)
      positionTemp.copy(centresFigurants[i]!).add(brownienTemp)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      if (i < NB_FIGURANTS_U1) figurantsU1.setMatrixAt(i, matriceTemp)
      else figurantsU2.setMatrixAt(i - NB_FIGURANTS_U1, matriceTemp)
    }

    // ── La polymérase, encore au travail pendant qu'on épisse en amont ──────
    const enTranscription = 1 - lissage((tb - DUREE_TRANSCRIPTION) / 0.6)
    surBrin(transcrit, positionTemp)
    machine.position.copy(positionTemp)
    tangenteSurBrin(transcrit, brownienTemp)
    quaternionTemp.setFromUnitVectors(AXE_Y, brownienTemp)
    machine.quaternion.copy(quaternionTemp)
    machine.scale.setScalar(enTranscription * sortie)
    quaternionTemp.identity()

    perlesExon.instanceMatrix.needsUpdate = true
    perlesIntron.instanceMatrix.needsUpdate = true
    marqueurs.instanceMatrix.needsUpdate = true
    figurantsU1.instanceMatrix.needsUpdate = true
    figurantsU2.instanceMatrix.needsUpdate = true
  }

  animer(0)

  return [
    {
      cle: 'epissage',
      nom: "Épissage de l'ARN par le spliceosome",
      siege: 'Noyau',
      ralentissement: 1 / 50,
      observable: {
        nom: 'intron-en-cours-d-excision',
        cycleReel: 1750,
        pourquoi:
          "Les introns se replient en lasso puis se détachent, et la boucle recommence " +
          "quand les trois sont excisés. C'est cette boucle entière que le badge " +
          'accélère : transcrire 16 737 paires de bases à 2 kb/min prend 8,4 minutes, ' +
          "et les trois excisions, échelonnées et co-transcriptionnelles, portent " +
          "l'ensemble à une trentaine de minutes — 1 750 s.",
      },
      justificationFacteur:
        "L'épissage d'un intron prend 5 à 10 minutes ; à ×50 il tient en 9 secondes. " +
        'La transcription des 16 737 pb du transcrit, 8,4 minutes à 2 kb/min, en occupe 10. ' +
        "Ces 2 kb/min sont le bas de la fourchette mesurée in vivo, 1 à 6 kb/min ; la fiche " +
        'de la transcription prend 60 nt/s, soit 3,6 kb/min, plus haut dans la même fourchette.',
      ellision:
        'Intron raccourci ×3,4 : 5 419 pb feraient 1,63 µm, il en est dessiné 0,48. ' +
        "L'exon garde sa longueur vraie (120 pb, 0,036 µm). " +
        "4 exons et 3 introns au lieu de 8,8 et 7,8 en moyenne, et la queue 3' du " +
        "lasso est portée de 0,5 % à 8 % de l'intron pour rester visible.",
      description:
        "Le pré-ARN messager sort de la polymérase par petits blocs codants — les exons — " +
        "séparés de très longs introns : chez l'humain le rapport est de 45 pour 1, " +
        "l'inverse de ce que montrent les schémas. Pour chaque intron, le spliceosome " +
        "s'assemble de zéro : U1 reconnaît le site 5', U2 le point de branchement, puis " +
        'le tri-snRNP U4/U6·U5 arrive et U1 et U4 repartent, U6 prenant la place de U1. ' +
        "L'intron est alors coupé et refermé sur lui-même en LASSO par une liaison 2'-5' " +
        "à l'adénosine du branchement, les exons sont soudés, et le lasso est débranché " +
        "puis digéré. L'épissage du premier intron commence — et forme son lasso — bien " +
        'avant que la polymérase ait fini de transcrire le gène.',
      objet: groupe,
      ancre: groupe.position.clone(),
      rayonCadrage: 0.8,
      couleur: TEINTES.reticulumRugueux,
      animer,
    },
  ]
}
