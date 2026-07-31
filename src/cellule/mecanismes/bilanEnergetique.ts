import * as THREE from 'three'
import type { Mecanisme } from './contrat.js'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'

/**
 * LE BILAN ÉNERGÉTIQUE — la carte qui relie les voies entre elles.
 *
 * Cinq voies montrées séparément ne s'expliquent pas : ce qui manque, c'est
 * l'endroit où elles se rejoignent. Ce panneau est donc une VUE SYNOPTIQUE
 * assumée — un schéma en volume posé dans le cytosol, pas une scène anatomique.
 * Rien ici n'est à l'échelle : les nœuds sont des cartouches, les molécules des
 * grains lisibles. C'est le seul module de la série où c'est vrai, et il vaut
 * mieux le dire que de le laisser croire.
 *
 * Trois choses doivent se lire sans un mot de commentaire :
 *   — la CONVERGENCE. Les sucres bleus et les graisses roses finissent tous en
 *     acétyl-CoA. Le flux change de teinte au carrefour : c'est la même matière
 *     qui devient autre chose.
 *   — les ÉPAISSEURS. Le faisceau qui alimente la chaîne respiratoire est
 *     massif, les deux filets d'ATP directs sont des filets. Quatre-vingt-dix
 *     pour cent de l'ATP passe par la chaîne, et ça se voit avant de lire.
 *   — la COMPTABILITÉ. Une réglette de trente-deux jetons se remplit en bas du
 *     panneau, groupée par origine : 2 + 2 + 26, et deux jetons qui clignotent
 *     parce que le total dépend de la navette.
 */

// ── Siège et cadrage, en micromètres (1 unité = 1 µm) ───────────────────────

/** Cytosol dégagé, à l'écart des organites. */
const SIEGE = new THREE.Vector3(0.5, -6.8, 3.6)

/** Direction depuis laquelle la caméra vient se poser (voir `allerAuMecanisme`). */
const DIRECTION_VUE = new THREE.Vector3(0.5, 0.36, 0.79).normalize()

/**
 * Le panneau fait environ 3 µm d'étendue : la scène à cadrer a donc bien 1,5 µm
 * de rayon. Cadrer plus serré gagnerait un sixième de taille apparente et
 * rognerait les bords dès qu'une fenêtre est plus haute que large.
 */
const RAYON_CADRAGE = 1.5

// ── Teintes ────────────────────────────────────────────────────────────────
// Les quatre teintes de la série sont tenues à l'identique dans les cinq
// modules : NADH bleu-vert, FADH₂ jaune, ATP orange vif, CO₂ gris.
const TEINTE_NADH = TEINTES.reticulumLisse
const TEINTE_NAD = 0x8fd9c4
const TEINTE_FADH2 = TEINTES.vesicule
const TEINTE_FAD = 0xf0cd85
const TEINTE_ATP = TEINTES.ribosome
const TEINTE_CO2 = TEINTES.cytosquelette
/** Gris bleuté : le fond de la scène est blanc cassé, un proton blanc n'existerait pas. */
const TEINTE_PROTON = 0x9fb2c6

/** Famille des sucres : du bleu franc au bleu ciel à mesure qu'ils se cassent. */
const TEINTE_GLUCOSE = TEINTES.noyau
const TEINTE_PYRUVATE = TEINTES.chromatine
const TEINTE_LACTATE = TEINTES.lysosome
/** Famille des graisses : rose sombre, qui s'éclaircit en acétyl-CoA. */
const TEINTE_ACIDE_GRAS = 0x9c4f7d
const TEINTE_ACETYL = TEINTES.golgi

const TEINTE_ENZYME_GLY = TEINTES.reticulumRugueux
const TEINTE_ENZYME_BETA = 0x7d3f63
const TEINTE_KREBS = TEINTES.mitochondrieCrete
const TEINTE_MEMBRANE = TEINTES.membraneNucleaire
const TEINTE_COMPLEXE = 0x7a3a10
const TEINTE_FERMENTATION = TEINTES.lysosome
const TEINTE_CREATINE = TEINTES.membraneNucleaire
const TEINTE_ADP = TEINTES.centriole

// ── Comptabilité, par glucose et par tour complet ───────────────────────────
const ATP_GLYCOLYSE = 2
const ATP_KREBS = 2
const ATP_CHAINE = 26
/** Les deux jetons qui dépendent de la navette : ils clignotent, ils ne mentent pas. */
const ATP_INCERTAINS = 2
const NB_JETONS = ATP_GLYCOLYSE + ATP_KREBS + ATP_CHAINE + ATP_INCERTAINS

/** Pas et taille des jetons de la réglette. */
const PAS_JETON = 0.05
const TAILLE_JETON = 0.036
const Y_REGLETTE = -1.3

// ── Durées d'écran ─────────────────────────────────────────────────────────
/** Un remplissage complet de la réglette. */
const PERIODE_BILAN = 8
/** Un cycle d'effort complet, pour l'encart phosphocréatine. */
const PERIODE_EFFORT = 12
/** Fin du régime phosphocréatine, en fraction du cycle d'effort. */
const FIN_PHOSPHOCREATINE = 0.18
/** Fin du régime glycolyse anaérobie ; au-delà, la respiration prend le relais. */
const FIN_ANAEROBIE = 0.62

// ── Trajets : échantillonnage ──────────────────────────────────────────────
/** Points échantillonnés le long d'un trajet, pour ne rien calculer à l'image. */
const NB_ECHANTILLONS = 48

// ── Afficheur à sept segments ──────────────────────────────────────────────
// Aucune police n'est chargée dans la scène : les nombres sont donc des
// volumes, comme le reste. Bits : a, b, c, d, e, f, g.
const MASQUES = new Uint8Array([63, 6, 91, 79, 102, 109, 125, 7, 127, 111])
const MASQUE_TIRET = 64
/** Par segment : décalage x, décalage y, largeur, hauteur — en fraction de la hauteur. */
const SEGMENTS = new Float32Array([
  0, 0.5, 0.58, 0.14,
  0.29, 0.25, 0.14, 0.5,
  0.29, -0.25, 0.14, 0.5,
  0, -0.5, 0.58, 0.14,
  -0.29, -0.25, 0.14, 0.5,
  -0.29, 0.25, 0.14, 0.5,
  0, 0, 0.58, 0.14,
])
/** Les chiffres flottent devant la carte pour rester lisibles. */
const Z_CHIFFRES = 0.2

// ── Nœuds de la carte, repère local du panneau ─────────────────────────────
const NB_POSTES_GLY = 10
const CENTRE_PYRUVATE = new THREE.Vector3(-0.72, -0.22, 0)
const CENTRE_ACETYL = new THREE.Vector3(0.3, 0.14, 0)
const CENTRE_BETA = new THREE.Vector3(0.84, 0.62, 0)
const RAYON_BETA = 0.17
const NB_POSTES_BETA = 4
const CENTRE_KREBS = new THREE.Vector3(0.02, -0.62, 0)
const RAYON_KREBS = 0.3
const NB_BLOBS_KREBS = 8
const CENTRE_FERMENTATION = new THREE.Vector3(-1.14, -0.8, 0)
/** Membrane interne dressée en muraille : matrice à gauche, espace intermembranaire à droite. */
const X_MEMBRANE = 1.3
const NB_COMPLEXES = 4
/** Hauteurs des complexes I, II, III et IV sur la muraille. */
const Y_COMPLEXES = new Float32Array([0.42, 0.16, -0.1, -0.36])
const RAYON_COMPLEXES = new Float32Array([0.078, 0.056, 0.075, 0.068])
/** Tête F1 de l'ATP synthase, côté matrice. */
const CENTRE_SYNTHASE = new THREE.Vector3(1.08, -0.76, 0)
const NB_LOBES_SYNTHASE = 3

/** Particules qui hésitent à chaque carrefour : rien ne sait où ça va. */
const NB_HESITANTS = 8
const RAYON_HESITATION = 0.13

/** Slots de l'encart phosphocréatine. */
const NB_PHOSPHOCREATINE = 6
const X_ENCART = -0.02
const Y_ENCART = 1.04
const LARGEUR_ENCART = 0.62
const HAUTEUR_ENCART = 0.66
const Y_RANG_CREATINE = 1.26
const Y_RANG_ADP = 0.88
const Y_BARRE_REGIMES = 0.79
const PAS_ENCART = 0.096

// ── Temporaires hissés : animer() ne doit rien allouer ──────────────────────
const matriceTemp = new THREE.Matrix4()
const positionTemp = new THREE.Vector3()
const quaternionTemp = new THREE.Quaternion()
const echelleTemp = new THREE.Vector3(1, 1, 1)

/** Un flux : un chapelet de particules qui descend un trajet échantillonné. */
interface Flux {
  maillage: THREE.InstancedMesh
  nb: number
  /** Trajet échantillonné, trois flottants par échantillon. Partagé avec le retour. */
  points: Float32Array
  phases: Float32Array
  /** Écart au trajet, trois flottants par particule : c'est lui qui donne l'épaisseur. */
  decalages: Float32Array
  /** Trajets ratés : la particule s'avance à mi-chemin puis rebrousse. */
  rates: Uint8Array
  taille: number
  vitesse: number
  /** +1 vers l'aval, -1 pour le retour à vide du cofacteur. */
  sens: number
  /** Le substrat raccourcit à mesure qu'il tourne (spirale de la bêta-oxydation). */
  retrecit: boolean
  /** Boucle fermée : pas de fondu aux extrémités. */
  boucle: boolean
  /** Soumis au régime d'effort : la fermentation s'emballe en anaérobie. */
  modulee: boolean
}

export function creerBilanEnergetique(): Mecanisme[] {
  const alea = creerAlea(70_312)
  const groupe = new THREE.Group()
  groupe.position.copy(SIEGE)
  // Le panneau se tourne vers l'endroit d'où la caméra vient le regarder :
  // une carte vue de biais n'est plus une carte.
  positionTemp.copy(SIEGE).add(DIRECTION_VUE)
  groupe.lookAt(positionTemp)

  const geometrieGrain = new THREE.IcosahedronGeometry(1, 0)
  const geometrieBlob = new THREE.IcosahedronGeometry(1, 1)
  const geometrieBoite = new THREE.BoxGeometry(1, 1, 1)

  /** Plaque rectangulaire posée à plat dans le panneau. */
  const ajouterPlaque = (
    x: number,
    y: number,
    z: number,
    largeur: number,
    hauteur: number,
    epaisseur: number,
    couleur: number,
    opacite: number,
  ): THREE.Mesh => {
    const plaque = new THREE.Mesh(geometrieBoite, materiauOrganite(couleur, { opacite }))
    plaque.position.set(x, y, z)
    plaque.scale.set(largeur, hauteur, epaisseur)
    groupe.add(plaque)
    return plaque
  }

  // ── Les deux compartiments ───────────────────────────────────────────────
  // À gauche le cytosol, à droite la mitochondrie avec sa double membrane
  // suggérée par deux plaques emboîtées. La frontière compte : c'est elle que
  // le pyruvate franchit, et c'est de son côté droit que vient l'énergie.
  ajouterPlaque(-1.02, -0.1, -0.14, 1.0, 2.55, 0.02, TEINTES.chromatine, 0.08)
  ajouterPlaque(0.55, -0.05, -0.15, 2.02, 2.12, 0.02, TEINTE_KREBS, 0.3)
  ajouterPlaque(0.55, -0.05, -0.13, 1.9, 2.0, 0.02, TEINTES.cytosol, 0.62)

  // ── Fabrique de flux ─────────────────────────────────────────────────────
  const flux: Flux[] = []

  const ajouterFlux = (options: {
    trajet: THREE.Vector3[]
    couleur: number
    nb: number
    taille: number
    faisceau: number
    vitesse: number
    rates?: number
    gaine?: boolean
    fermee?: boolean
    retrecit?: boolean
    modulee?: boolean
  }): Flux => {
    const fermee = options.fermee === true
    const courbe = new THREE.CatmullRomCurve3(options.trajet, fermee)

    // Le trajet est échantillonné une fois pour toutes : à l'image on ne fait
    // plus qu'une interpolation linéaire entre deux points, sans allocation.
    const points = new Float32Array(NB_ECHANTILLONS * 3)
    for (let i = 0; i < NB_ECHANTILLONS; i++) {
      courbe.getPointAt(i / (NB_ECHANTILLONS - 1), positionTemp)
      points[i * 3] = positionTemp.x
      points[i * 3 + 1] = positionTemp.y
      points[i * 3 + 2] = positionTemp.z
    }

    // La gaine translucide donne l'épaisseur du flux même à l'arrêt : c'est
    // elle qui rend le rendement lisible sans compter les particules.
    if (options.gaine !== false) {
      const materiauGaine = materiauOrganite(options.couleur, { opacite: 0.15 })
      materiauGaine.depthWrite = false
      const gaine = new THREE.Mesh(
        new THREE.TubeGeometry(courbe, 28, options.faisceau, 7, fermee),
        materiauGaine,
      )
      gaine.renderOrder = -1
      groupe.add(gaine)
    }

    const maillage = new THREE.InstancedMesh(
      geometrieGrain,
      materiauOrganite(options.couleur, { doubleFace: false }),
      options.nb,
    )
    maillage.frustumCulled = false
    groupe.add(maillage)

    const phases = new Float32Array(options.nb)
    const decalages = new Float32Array(options.nb * 3)
    const rates = new Uint8Array(options.nb)
    const proportionRatee = options.rates ?? 0
    for (let i = 0; i < options.nb; i++) {
      phases[i] = alea()
      const rayon = options.faisceau * 0.66
      decalages[i * 3] = (alea() - 0.5) * 2 * rayon
      decalages[i * 3 + 1] = (alea() - 0.5) * 2 * rayon
      decalages[i * 3 + 2] = (alea() - 0.5) * 2 * rayon
      rates[i] = alea() < proportionRatee ? 1 : 0
    }

    const cree: Flux = {
      maillage,
      nb: options.nb,
      points,
      phases,
      decalages,
      rates,
      taille: options.taille,
      vitesse: options.vitesse,
      sens: 1,
      retrecit: options.retrecit === true,
      boucle: fermee,
      modulee: options.modulee === true,
    }
    flux.push(cree)
    return cree
  }

  /**
   * Le retour à vide du cofacteur, sur le trajet de l'aller mais à contresens.
   * NAD⁺ et FAD ne sont pas consommés : ce sont des NAVETTES, et c'est ce
   * va-et-vient qui relie la glycolyse et Krebs à la chaîne respiratoire.
   */
  const ajouterRetour = (aller: Flux, couleur: number, nb: number, taille: number): void => {
    const maillage = new THREE.InstancedMesh(
      geometrieGrain,
      materiauOrganite(couleur, { doubleFace: false }),
      nb,
    )
    maillage.frustumCulled = false
    groupe.add(maillage)

    const phases = new Float32Array(nb)
    const decalages = new Float32Array(nb * 3)
    for (let i = 0; i < nb; i++) {
      phases[i] = alea()
      decalages[i * 3] = (alea() - 0.5) * 0.05
      decalages[i * 3 + 1] = (alea() - 0.5) * 0.05
      decalages[i * 3 + 2] = (alea() - 0.5) * 0.05
    }

    flux.push({
      maillage,
      nb,
      points: aller.points,
      phases,
      decalages,
      rates: new Uint8Array(nb),
      taille,
      vitesse: aller.vitesse * 0.8,
      sens: -1,
      retrecit: false,
      boucle: false,
      modulee: aller.modulee,
    })
  }

  // ── Glycolyse : dix postes en escalier ───────────────────────────────────
  // La glycolyse n'est pas une réaction, c'est une chaîne de dix enzymes. On
  // la dessine comme telle, et l'onde qui descend l'escalier dit dans quel
  // sens on la lit.
  const posPostes = new Float32Array(NB_POSTES_GLY * 3)
  const postesGly = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_ENZYME_GLY, { doubleFace: false }),
    NB_POSTES_GLY,
  )
  postesGly.frustumCulled = false
  groupe.add(postesGly)
  for (let i = 0; i < NB_POSTES_GLY; i++) {
    posPostes[i * 3] = -1.3 + 0.0578 * i + 0.018 * Math.sin(i * 1.7)
    posPostes[i * 3 + 1] = 0.92 - 0.0956 * i
    posPostes[i * 3 + 2] = 0.02 * Math.cos(i * 1.3)
  }

  const trajetGlycolyse: THREE.Vector3[] = []
  for (let i = 0; i < NB_POSTES_GLY; i += 2) {
    trajetGlycolyse.push(
      new THREE.Vector3(posPostes[i * 3]! + 0.045, posPostes[i * 3 + 1]! + 0.02, 0.05),
    )
  }
  trajetGlycolyse.push(new THREE.Vector3(-0.735, 0.076, 0.05))

  ajouterFlux({
    trajet: [
      new THREE.Vector3(-1.3, 1.42, 0.06),
      new THREE.Vector3(-1.31, 1.16, 0.03),
      new THREE.Vector3(-1.28, 0.96, 0.02),
    ],
    couleur: TEINTE_GLUCOSE,
    nb: 14,
    taille: 0.028,
    faisceau: 0.05,
    vitesse: 0.2,
    rates: 0.25,
  })
  ajouterFlux({
    trajet: trajetGlycolyse,
    couleur: TEINTE_GLUCOSE,
    nb: 16,
    taille: 0.024,
    faisceau: 0.042,
    vitesse: 0.14,
  })
  ajouterFlux({
    trajet: [
      new THREE.Vector3(-0.735, 0.076, 0.05),
      new THREE.Vector3(-0.72, -0.08, 0.03),
      new THREE.Vector3(-0.72, -0.2, 0.01),
    ],
    couleur: TEINTE_PYRUVATE,
    nb: 12,
    taille: 0.026,
    faisceau: 0.045,
    vitesse: 0.2,
  })

  // Le filet d'ATP direct de la glycolyse : deux par glucose, et ça se voit.
  ajouterFlux({
    trajet: [
      new THREE.Vector3(-1.0, 0.44, 0.12),
      new THREE.Vector3(-0.86, -0.1, 0.18),
      new THREE.Vector3(-0.7, -0.7, 0.18),
      new THREE.Vector3(-0.45, -1.1, 0.12),
      new THREE.Vector3(-0.31, -1.24, 0.06),
    ],
    couleur: TEINTE_ATP,
    nb: 6,
    taille: 0.022,
    faisceau: 0.018,
    vitesse: 0.18,
  })

  // Les deux NADH cytosoliques : ils n'entrent pas seuls dans la mitochondrie,
  // une navette les fait passer, et c'est de là que vient toute l'incertitude
  // du total. Le faisceau est donc modeste et le trajet long.
  const fluxNadhGlycolyse = ajouterFlux({
    trajet: [
      new THREE.Vector3(-0.92, 0.38, 0.1),
      new THREE.Vector3(-0.55, 0.54, 0.16),
      new THREE.Vector3(0.1, 0.55, 0.16),
      new THREE.Vector3(0.55, 0.36, 0.14),
      new THREE.Vector3(1.02, 0.36, 0.1),
      new THREE.Vector3(1.24, 0.41, 0.04),
    ],
    couleur: TEINTE_NADH,
    nb: 24,
    taille: 0.026,
    faisceau: 0.055,
    vitesse: 0.16,
  })
  ajouterRetour(fluxNadhGlycolyse, TEINTE_NAD, 10, 0.016)

  // ── Fermentation : la sortie de secours, sans oxygène ────────────────────
  const fermentation = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_FERMENTATION, { doubleFace: false }),
    3,
  )
  fermentation.frustumCulled = false
  groupe.add(fermentation)
  quaternionTemp.identity()
  for (let i = 0; i < 3; i++) {
    positionTemp.set(
      CENTRE_FERMENTATION.x + Math.cos(i * 2.2) * 0.055,
      CENTRE_FERMENTATION.y + Math.sin(i * 2.2) * 0.045,
      Math.sin(i * 1.1) * 0.03,
    )
    echelleTemp.setScalar(0.062 - i * 0.008)
    matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
    fermentation.setMatrixAt(i, matriceTemp)
  }
  fermentation.instanceMatrix.needsUpdate = true

  ajouterFlux({
    trajet: [
      new THREE.Vector3(-0.76, -0.3, 0.02),
      new THREE.Vector3(-0.94, -0.55, 0.06),
      new THREE.Vector3(-1.08, -0.72, 0.02),
    ],
    couleur: TEINTE_PYRUVATE,
    nb: 10,
    taille: 0.024,
    faisceau: 0.04,
    vitesse: 0.19,
    rates: 0.3,
    modulee: true,
  })
  ajouterFlux({
    trajet: [
      new THREE.Vector3(-1.2, -0.88, 0.02),
      new THREE.Vector3(-1.32, -1.02, 0.04),
      new THREE.Vector3(-1.44, -1.16, 0.06),
    ],
    couleur: TEINTE_LACTATE,
    nb: 10,
    taille: 0.024,
    faisceau: 0.04,
    vitesse: 0.19,
    modulee: true,
  })
  // Le retour du NAD⁺ : c'est LA raison d'être de la fermentation. Sans lui la
  // glycolyse s'arrête au bout de quelques secondes, faute d'accepteur.
  ajouterFlux({
    trajet: [
      new THREE.Vector3(-1.22, -0.72, -0.06),
      new THREE.Vector3(-1.44, -0.3, -0.1),
      new THREE.Vector3(-1.46, 0.3, -0.1),
      new THREE.Vector3(-1.36, 0.72, -0.08),
      new THREE.Vector3(-1.28, 0.9, -0.04),
    ],
    couleur: TEINTE_NAD,
    nb: 14,
    taille: 0.018,
    faisceau: 0.03,
    vitesse: 0.21,
    modulee: true,
  })

  // ── Le pyruvate franchit la membrane et perd un carbone ──────────────────
  ajouterFlux({
    trajet: [
      new THREE.Vector3(-0.66, -0.19, 0.02),
      new THREE.Vector3(-0.3, -0.02, 0.1),
      new THREE.Vector3(0.05, 0.1, 0.08),
      new THREE.Vector3(0.24, 0.13, 0.02),
    ],
    couleur: TEINTE_PYRUVATE,
    nb: 12,
    taille: 0.026,
    faisceau: 0.045,
    vitesse: 0.17,
    rates: 0.25,
  })
  // Le carbone qui part. Trois carbones entrent, un ressort en gaz : sur un
  // schéma de flux c'est la seule matière qui QUITTE le circuit.
  ajouterFlux({
    trajet: [
      new THREE.Vector3(0.26, 0.2, -0.04),
      new THREE.Vector3(0.0, 0.34, -0.12),
      new THREE.Vector3(-0.3, 0.48, -0.16),
      new THREE.Vector3(-0.44, 0.72, -0.18),
      new THREE.Vector3(-0.46, 1.1, -0.18),
      new THREE.Vector3(-0.44, 1.4, -0.18),
    ],
    couleur: TEINTE_CO2,
    nb: 14,
    taille: 0.024,
    faisceau: 0.038,
    vitesse: 0.22,
  })
  const fluxNadhDecarboxylation = ajouterFlux({
    trajet: [
      new THREE.Vector3(0.36, 0.16, 0.06),
      new THREE.Vector3(0.7, 0.22, 0.1),
      new THREE.Vector3(1.05, 0.34, 0.08),
      new THREE.Vector3(1.24, 0.4, 0.03),
    ],
    couleur: TEINTE_NADH,
    nb: 22,
    taille: 0.026,
    faisceau: 0.055,
    vitesse: 0.18,
  })
  ajouterRetour(fluxNadhDecarboxylation, TEINTE_NAD, 8, 0.016)

  // ── Bêta-oxydation : une spirale de quatre postes ────────────────────────
  // À chaque tour la chaîne perd deux carbones et lâche un acétyl-CoA, un NADH
  // et un FADH₂. Les particules rétrécissent en tournant : c'est le seul
  // endroit de la carte où le substrat maigrit sous les yeux.
  const postesBeta = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_ENZYME_BETA, { doubleFace: false }),
    NB_POSTES_BETA,
  )
  postesBeta.frustumCulled = false
  groupe.add(postesBeta)

  const trajetSpirale: THREE.Vector3[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    trajetSpirale.push(
      new THREE.Vector3(
        CENTRE_BETA.x + Math.cos(angle) * RAYON_BETA,
        CENTRE_BETA.y + Math.sin(angle) * RAYON_BETA,
        Math.sin(angle * 2) * 0.05,
      ),
    )
  }

  ajouterFlux({
    trajet: [
      new THREE.Vector3(1.3, 1.42, 0.06),
      new THREE.Vector3(1.1, 1.05, 0.04),
      new THREE.Vector3(0.92, 0.78, 0.02),
    ],
    couleur: TEINTE_ACIDE_GRAS,
    nb: 12,
    taille: 0.03,
    faisceau: 0.05,
    vitesse: 0.19,
    rates: 0.2,
  })
  ajouterFlux({
    trajet: trajetSpirale,
    couleur: TEINTE_ACIDE_GRAS,
    nb: 18,
    taille: 0.03,
    faisceau: 0.045,
    vitesse: 0.13,
    fermee: true,
    retrecit: true,
  })
  ajouterFlux({
    trajet: [
      new THREE.Vector3(0.7, 0.52, 0.02),
      new THREE.Vector3(0.52, 0.34, 0.06),
      new THREE.Vector3(0.37, 0.19, 0.02),
    ],
    couleur: TEINTE_ACETYL,
    nb: 14,
    taille: 0.026,
    faisceau: 0.045,
    vitesse: 0.18,
  })
  const fluxNadhBeta = ajouterFlux({
    trajet: [
      new THREE.Vector3(0.94, 0.5, 0.08),
      new THREE.Vector3(1.1, 0.44, 0.1),
      new THREE.Vector3(1.24, 0.42, 0.04),
    ],
    couleur: TEINTE_NADH,
    nb: 18,
    taille: 0.026,
    faisceau: 0.05,
    vitesse: 0.2,
  })
  ajouterRetour(fluxNadhBeta, TEINTE_NAD, 8, 0.016)
  const fluxFadhBeta = ajouterFlux({
    trajet: [
      new THREE.Vector3(0.92, 0.46, -0.06),
      new THREE.Vector3(1.08, 0.28, -0.08),
      new THREE.Vector3(1.24, 0.17, -0.03),
    ],
    couleur: TEINTE_FADH2,
    nb: 12,
    taille: 0.024,
    faisceau: 0.042,
    vitesse: 0.2,
  })
  ajouterRetour(fluxFadhBeta, TEINTE_FAD, 6, 0.015)

  // ── Cycle de Krebs : un anneau, parce que c'en est un ────────────────────
  const anneauKrebs = new THREE.Mesh(
    new THREE.TorusGeometry(RAYON_KREBS, 0.016, 8, 44),
    materiauOrganite(TEINTE_KREBS),
  )
  anneauKrebs.position.copy(CENTRE_KREBS)
  groupe.add(anneauKrebs)

  const blobsKrebs = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_KREBS, { doubleFace: false }),
    NB_BLOBS_KREBS,
  )
  blobsKrebs.frustumCulled = false
  groupe.add(blobsKrebs)

  const trajetCycle: THREE.Vector3[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    trajetCycle.push(
      new THREE.Vector3(
        CENTRE_KREBS.x + Math.cos(angle) * RAYON_KREBS,
        CENTRE_KREBS.y + Math.sin(angle) * RAYON_KREBS,
        0.04 + Math.sin(angle * 2) * 0.04,
      ),
    )
  }

  ajouterFlux({
    trajet: [
      new THREE.Vector3(0.28, 0.06, 0.02),
      new THREE.Vector3(0.2, -0.16, 0.06),
      new THREE.Vector3(0.15, -0.34, 0.03),
    ],
    couleur: TEINTE_ACETYL,
    nb: 12,
    taille: 0.026,
    faisceau: 0.045,
    vitesse: 0.18,
  })
  ajouterFlux({
    trajet: trajetCycle,
    couleur: TEINTE_ACETYL,
    nb: 16,
    taille: 0.024,
    faisceau: 0.04,
    vitesse: 0.12,
    fermee: true,
  })
  // Les deux carbones ressortent en gaz, et rejoignent la colonne de CO₂.
  ajouterFlux({
    trajet: [
      new THREE.Vector3(-0.18, -0.46, -0.04),
      new THREE.Vector3(-0.36, -0.1, -0.12),
      new THREE.Vector3(-0.44, 0.3, -0.16),
      new THREE.Vector3(-0.46, 0.72, -0.18),
      new THREE.Vector3(-0.46, 1.1, -0.18),
      new THREE.Vector3(-0.44, 1.4, -0.18),
    ],
    couleur: TEINTE_CO2,
    nb: 16,
    taille: 0.024,
    faisceau: 0.038,
    vitesse: 0.2,
  })
  // Le second filet d'ATP : un par tour, deux par glucose. Aussi maigre que
  // celui de la glycolyse, et c'est tout le propos.
  ajouterFlux({
    trajet: [
      new THREE.Vector3(0.02, -0.92, 0.06),
      new THREE.Vector3(-0.04, -1.12, 0.06),
      new THREE.Vector3(-0.1, -1.24, 0.04),
    ],
    couleur: TEINTE_ATP,
    nb: 6,
    taille: 0.022,
    faisceau: 0.018,
    vitesse: 0.18,
  })
  // Le gros faisceau de la carte côté entrée : six NADH par glucose sortent
  // d'ici, c'est la source principale de la chaîne respiratoire.
  const fluxNadhKrebs = ajouterFlux({
    trajet: [
      new THREE.Vector3(0.3, -0.5, 0.1),
      new THREE.Vector3(0.62, -0.28, 0.16),
      new THREE.Vector3(0.95, 0.06, 0.14),
      new THREE.Vector3(1.18, 0.32, 0.08),
      new THREE.Vector3(1.25, 0.42, 0.03),
    ],
    couleur: TEINTE_NADH,
    nb: 60,
    taille: 0.028,
    faisceau: 0.1,
    vitesse: 0.17,
  })
  ajouterRetour(fluxNadhKrebs, TEINTE_NAD, 20, 0.017)
  const fluxFadhKrebs = ajouterFlux({
    trajet: [
      new THREE.Vector3(0.3, -0.7, -0.08),
      new THREE.Vector3(0.65, -0.62, -0.1),
      new THREE.Vector3(1.0, -0.3, -0.08),
      new THREE.Vector3(1.2, 0.05, -0.04),
      new THREE.Vector3(1.25, 0.16, -0.02),
    ],
    couleur: TEINTE_FADH2,
    nb: 20,
    taille: 0.026,
    faisceau: 0.055,
    vitesse: 0.17,
  })
  ajouterRetour(fluxFadhKrebs, TEINTE_FAD, 8, 0.016)

  // ── Chaîne respiratoire : la muraille, les quatre complexes, la turbine ──
  ajouterPlaque(X_MEMBRANE, -0.19, 0, 0.1, 1.58, 0.24, TEINTE_MEMBRANE, 1)

  const complexes = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_COMPLEXE, { doubleFace: false }),
    NB_COMPLEXES,
  )
  complexes.frustumCulled = false
  groupe.add(complexes)

  const tigeSynthase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8),
    materiauOrganite(TEINTE_ATP, { doubleFace: false }),
  )
  tigeSynthase.position.set(1.2, CENTRE_SYNTHASE.y, 0)
  tigeSynthase.rotation.z = Math.PI / 2
  groupe.add(tigeSynthase)

  const moyeuSynthase = new THREE.Mesh(
    geometrieBlob,
    materiauOrganite(TEINTE_ATP, { doubleFace: false }),
  )
  moyeuSynthase.position.copy(CENTRE_SYNTHASE)
  moyeuSynthase.scale.setScalar(0.045)
  groupe.add(moyeuSynthase)

  // La tête F1 tourne : c'est un moteur rotatif, le seul de la cellule avec le
  // flagelle. Trois lobes suffisent pour que la rotation se VOIE.
  const lobesSynthase = new THREE.InstancedMesh(
    geometrieBlob,
    materiauOrganite(TEINTE_ATP, { doubleFace: false }),
    NB_LOBES_SYNTHASE,
  )
  lobesSynthase.frustumCulled = false
  groupe.add(lobesSynthase)

  // Le gradient de protons. Les complexes I, III et IV pompent des protons hors
  // de la matrice ; ils redescendent par la turbine. C'est l'intermédiaire
  // obligé entre les cofacteurs et l'ATP, et il n'est pas fait de molécules
  // comptables : c'est une différence de potentiel.
  ajouterFlux({
    trajet: [
      new THREE.Vector3(1.38, 0.44, 0.02),
      new THREE.Vector3(1.44, 0.1, 0.02),
      new THREE.Vector3(1.45, -0.3, 0.02),
      new THREE.Vector3(1.42, -0.62, 0.02),
      new THREE.Vector3(1.34, -0.75, 0.02),
    ],
    couleur: TEINTE_PROTON,
    nb: 36,
    taille: 0.014,
    faisceau: 0.032,
    vitesse: 0.42,
  })
  for (let c = 0; c < NB_COMPLEXES; c++) {
    if (c === 1) continue // le complexe II ne pompe pas : d'où 1,5 ATP par FADH₂
    const y = Y_COMPLEXES[c]!
    ajouterFlux({
      trajet: [
        new THREE.Vector3(X_MEMBRANE + 0.04, y, 0.02),
        new THREE.Vector3(X_MEMBRANE + 0.09, y + 0.05, 0.02),
      ],
      couleur: TEINTE_PROTON,
      nb: 5,
      taille: 0.013,
      faisceau: 0.022,
      vitesse: 0.5,
      gaine: false,
    })
  }

  // Le flux le plus gros de toute la carte, et de loin.
  ajouterFlux({
    trajet: [
      new THREE.Vector3(1.02, -0.82, 0.04),
      new THREE.Vector3(0.9, -1.0, 0.06),
      new THREE.Vector3(0.74, -1.16, 0.06),
      new THREE.Vector3(0.66, -1.24, 0.04),
    ],
    couleur: TEINTE_ATP,
    nb: 90,
    taille: 0.03,
    faisceau: 0.11,
    vitesse: 0.24,
  })

  // ── Carrefours : le pyruvate et l'acétyl-CoA ─────────────────────────────
  const carrefourPyruvate = new THREE.Mesh(
    geometrieBlob,
    materiauOrganite(TEINTE_PYRUVATE, { doubleFace: false }),
  )
  carrefourPyruvate.position.copy(CENTRE_PYRUVATE)
  carrefourPyruvate.scale.setScalar(0.062)
  groupe.add(carrefourPyruvate)

  const carrefourAcetyl = new THREE.Mesh(
    geometrieBlob,
    materiauOrganite(TEINTE_ACETYL, { doubleFace: false }),
  )
  carrefourAcetyl.position.copy(CENTRE_ACETYL)
  carrefourAcetyl.scale.setScalar(0.062)
  groupe.add(carrefourAcetyl)

  // Autour de chaque carrefour, des molécules qui n'ont pas encore rencontré
  // l'enzyme suivante. Aucune ne sait où elle va : elle dérive et se cogne.
  const hesitantsPyruvate = new THREE.InstancedMesh(
    geometrieGrain,
    materiauOrganite(TEINTE_PYRUVATE, { doubleFace: false }),
    NB_HESITANTS,
  )
  const hesitantsAcetyl = new THREE.InstancedMesh(
    geometrieGrain,
    materiauOrganite(TEINTE_ACETYL, { doubleFace: false }),
    NB_HESITANTS,
  )
  hesitantsPyruvate.frustumCulled = false
  hesitantsAcetyl.frustumCulled = false
  groupe.add(hesitantsPyruvate, hesitantsAcetyl)
  const phasesHesitants = new Float32Array(NB_HESITANTS)
  for (let i = 0; i < NB_HESITANTS; i++) phasesHesitants[i] = alea()

  // ── La réglette du bilan : trente-deux jetons, groupés par origine ───────
  const xJetons = new Float32Array(NB_JETONS)
  const groupeJeton = new Uint8Array(NB_JETONS)
  let rang = 0
  for (let i = 0; i < ATP_GLYCOLYSE; i++) {
    xJetons[rang] = -0.3 + i * PAS_JETON
    groupeJeton[rang] = 0
    rang++
  }
  for (let i = 0; i < ATP_KREBS; i++) {
    xJetons[rang] = -0.13 + i * PAS_JETON
    groupeJeton[rang] = 1
    rang++
  }
  for (let i = 0; i < ATP_CHAINE; i++) {
    xJetons[rang] = 0.04 + i * PAS_JETON
    groupeJeton[rang] = 2
    rang++
  }
  for (let i = 0; i < ATP_INCERTAINS; i++) {
    xJetons[rang] = 1.36 + i * PAS_JETON
    groupeJeton[rang] = 3
    rang++
  }

  ajouterPlaque(-0.275, Y_REGLETTE, -0.06, 0.15, 0.075, 0.02, TEINTE_ENZYME_GLY, 0.85)
  ajouterPlaque(-0.105, Y_REGLETTE, -0.06, 0.15, 0.075, 0.02, TEINTE_KREBS, 0.85)
  ajouterPlaque(0.665, Y_REGLETTE, -0.06, 1.3, 0.075, 0.02, TEINTE_COMPLEXE, 0.85)
  ajouterPlaque(1.385, Y_REGLETTE, -0.06, 0.15, 0.075, 0.02, TEINTE_CO2, 0.6)

  const jetons = new THREE.InstancedMesh(
    geometrieBoite,
    materiauOrganite(TEINTE_ATP, { doubleFace: false }),
    NB_JETONS,
  )
  jetons.frustumCulled = false
  groupe.add(jetons)

  // ── Les nombres, en volume ───────────────────────────────────────────────
  interface Afficheur {
    maillage: THREE.InstancedMesh
    utilise: number
  }

  const creerAfficheur = (couleur: number, nbCaracteres: number): Afficheur => {
    const maillage = new THREE.InstancedMesh(
      geometrieBoite,
      materiauOrganite(couleur, { doubleFace: false }),
      nbCaracteres * 7,
    )
    maillage.frustumCulled = false
    groupe.add(maillage)
    return { maillage, utilise: 0 }
  }

  const ecrire = (
    afficheur: Afficheur,
    texte: string,
    x: number,
    y: number,
    hauteur: number,
  ): void => {
    const pas = hauteur * 0.85
    const depart = x - ((texte.length - 1) * pas) / 2
    quaternionTemp.identity()
    for (let c = 0; c < texte.length; c++) {
      const code = texte.charCodeAt(c)
      const masque = code === 45 ? MASQUE_TIRET : MASQUES[code - 48] ?? 0
      const centre = depart + c * pas
      for (let s = 0; s < 7; s++) {
        if ((masque & (1 << s)) === 0) continue
        positionTemp.set(
          centre + SEGMENTS[s * 4]! * hauteur,
          y + SEGMENTS[s * 4 + 1]! * hauteur,
          Z_CHIFFRES,
        )
        echelleTemp.set(
          SEGMENTS[s * 4 + 2]! * hauteur,
          SEGMENTS[s * 4 + 3]! * hauteur,
          hauteur * 0.1,
        )
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        afficheur.maillage.setMatrixAt(afficheur.utilise, matriceTemp)
        afficheur.utilise++
      }
    }
  }

  /** Les segments non allumés sont mis à zéro : rien ne traîne à l'origine. */
  const clore = (afficheur: Afficheur): void => {
    echelleTemp.setScalar(0)
    positionTemp.set(0, 0, 0)
    quaternionTemp.identity()
    matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
    for (let i = afficheur.utilise; i < afficheur.maillage.count; i++) {
      afficheur.maillage.setMatrixAt(i, matriceTemp)
    }
    afficheur.maillage.instanceMatrix.needsUpdate = true
    echelleTemp.setScalar(1)
  }

  const afficheurAtp = creerAfficheur(TEINTE_ATP, 9)
  ecrire(afficheurAtp, '2', -0.275, -1.19, 0.075)
  ecrire(afficheurAtp, '2', -0.105, -1.19, 0.075)
  ecrire(afficheurAtp, '26', 0.3, -1.19, 0.09)
  ecrire(afficheurAtp, '30-32', -0.9, -1.3, 0.17)
  clore(afficheurAtp)

  const afficheurNadh = creerAfficheur(TEINTE_NADH, 2)
  ecrire(afficheurNadh, '10', 1.14, 0.56, 0.08)
  clore(afficheurNadh)

  const afficheurFadh = creerAfficheur(TEINTE_FADH2, 1)
  ecrire(afficheurFadh, '2', 1.08, 0.09, 0.08)
  clore(afficheurFadh)

  // ── Encart : la phosphocréatine, réserve la plus rapide du corps ─────────
  // Elle ne PRODUIT rien. Elle tamponne : la créatine kinase rend un phosphate
  // à l'ADP en quelques millisecondes, bien avant que la glycolyse ait démarré.
  ajouterPlaque(
    X_ENCART,
    Y_ENCART,
    -0.12,
    LARGEUR_ENCART,
    HAUTEUR_ENCART,
    0.02,
    TEINTES.cytosquelette,
    0.16,
  )

  const kinase = new THREE.Mesh(geometrieBlob, materiauOrganite(TEINTE_FERMENTATION))
  kinase.position.set(X_ENCART - 0.29, Y_RANG_CREATINE - 0.19, 0.02)
  kinase.scale.setScalar(0.045)
  groupe.add(kinase)

  const xSlot = new Float32Array(NB_PHOSPHOCREATINE)
  for (let j = 0; j < NB_PHOSPHOCREATINE; j++) {
    xSlot[j] = X_ENCART - ((NB_PHOSPHOCREATINE - 1) * PAS_ENCART) / 2 + j * PAS_ENCART
  }

  const creatines = new THREE.InstancedMesh(
    geometrieBoite,
    materiauOrganite(TEINTE_CREATINE, { doubleFace: false }),
    NB_PHOSPHOCREATINE,
  )
  const phosphates = new THREE.InstancedMesh(
    geometrieGrain,
    materiauOrganite(TEINTE_ATP, { doubleFace: false }),
    NB_PHOSPHOCREATINE,
  )
  const jetonsAdp = new THREE.InstancedMesh(
    geometrieBoite,
    materiauOrganite(TEINTE_ADP, { doubleFace: false }),
    NB_PHOSPHOCREATINE,
  )
  const jetonsAtp = new THREE.InstancedMesh(
    geometrieBoite,
    materiauOrganite(TEINTE_ATP, { doubleFace: false }),
    NB_PHOSPHOCREATINE,
  )
  creatines.frustumCulled = false
  phosphates.frustumCulled = false
  jetonsAdp.frustumCulled = false
  jetonsAtp.frustumCulled = false
  groupe.add(creatines, phosphates, jetonsAdp, jetonsAtp)

  quaternionTemp.identity()
  for (let j = 0; j < NB_PHOSPHOCREATINE; j++) {
    positionTemp.set(xSlot[j]!, Y_RANG_CREATINE, 0.02)
    echelleTemp.set(0.05, 0.05, 0.05)
    matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
    creatines.setMatrixAt(j, matriceTemp)
  }
  creatines.instanceMatrix.needsUpdate = true

  // Les trois régimes qui se succèdent à l'effort. L'axe est logarithmique :
  // quelques secondes, une minute, puis des heures.
  ajouterPlaque(-0.246, Y_BARRE_REGIMES, 0.0, 0.108, 0.045, 0.02, TEINTE_CREATINE, 0.9)
  ajouterPlaque(-0.06, Y_BARRE_REGIMES, 0.0, 0.264, 0.045, 0.02, TEINTE_ENZYME_GLY, 0.9)
  ajouterPlaque(0.186, Y_BARRE_REGIMES, 0.0, 0.228, 0.045, 0.02, TEINTE_COMPLEXE, 0.9)

  const curseur = new THREE.Mesh(geometrieBoite, materiauOrganite(TEINTE_ATP, { doubleFace: false }))
  curseur.scale.set(0.018, 0.075, 0.03)
  curseur.position.set(-0.3, Y_BARRE_REGIMES, 0.06)
  groupe.add(curseur)

  // ── Animation ────────────────────────────────────────────────────────────
  /**
   * Avancement accumulé de chaque flux, dans un tableau typé et non dans une
   * propriété d'objet : la vitesse peut varier sans saut, et l'image n'écrit
   * que des flottants déjà logés.
   */
  const avances = new Float32Array(flux.length)
  let tempsPrecedent = 0

  const animer = (temps: number): void => {
    // Pas borné : une image sautée ne doit pas téléporter la scène.
    const dt = Math.min(0.05, Math.max(0, temps - tempsPrecedent))
    tempsPrecedent = temps

    // Régime d'effort : trois plages qui se succèdent, et qui commandent le
    // débit de la branche fermentation.
    const phaseEffort = (temps / PERIODE_EFFORT) % 1
    let anaerobie = 0
    if (phaseEffort > FIN_PHOSPHOCREATINE && phaseEffort < FIN_ANAEROBIE) {
      const dedans = (phaseEffort - FIN_PHOSPHOCREATINE) / (FIN_ANAEROBIE - FIN_PHOSPHOCREATINE)
      anaerobie = Math.min(1, Math.min(dedans, 1 - dedans) * 6)
    }

    // 1. Les flux. Tout le reste de la carte n'est qu'un décor pour eux.
    quaternionTemp.identity()
    for (let f = 0; f < flux.length; f++) {
      const fl = flux[f]!
      const vitesse = fl.modulee ? fl.vitesse * (0.35 + 1.35 * anaerobie) : fl.vitesse
      let avance = avances[f]! + vitesse * dt
      avance -= Math.floor(avance)
      avances[f] = avance

      const points = fl.points
      const phases = fl.phases
      const decalages = fl.decalages
      const rates = fl.rates
      for (let i = 0; i < fl.nb; i++) {
        let u = (avance + phases[i]!) % 1
        if (rates[i] === 1) {
          // Trajet raté : la molécule s'engage, ne rencontre rien, revient.
          u = u < 0.5 ? u : 1 - u
        } else if (fl.sens < 0) {
          u = 1 - u
        }

        const position = u * (NB_ECHANTILLONS - 1)
        let indice = Math.floor(position)
        if (indice > NB_ECHANTILLONS - 2) indice = NB_ECHANTILLONS - 2
        if (indice < 0) indice = 0
        const fraction = position - indice
        const a = indice * 3
        const d = i * 3
        positionTemp.set(
          points[a]! + (points[a + 3]! - points[a]!) * fraction + decalages[d]!,
          points[a + 1]! + (points[a + 4]! - points[a + 1]!) * fraction + decalages[d + 1]!,
          points[a + 2]! + (points[a + 5]! - points[a + 2]!) * fraction + decalages[d + 2]!,
        )
        // Un peu de frétillement : à cette échelle rien ne va tout droit.
        positionTemp.y += Math.sin(temps * 1.7 + phases[i]! * 21) * 0.005

        // Fondu aux deux bouts, sinon les particules surgissent et s'évanouissent.
        let taille = fl.taille
        if (!fl.boucle) taille *= Math.min(1, u * 7, (1 - u) * 7)
        if (fl.retrecit) taille *= 1 - 0.45 * u
        echelleTemp.setScalar(taille)
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        fl.maillage.setMatrixAt(i, matriceTemp)
      }
      fl.maillage.instanceMatrix.needsUpdate = true
    }

    // 2. Les hésitants des deux carrefours.
    for (let i = 0; i < NB_HESITANTS; i++) {
      const p = phasesHesitants[i]!
      const dx = Math.sin(temps * 0.9 + p * 6.3) * Math.cos(temps * 0.53 + p * 3.1)
      const dy = Math.sin(temps * 0.71 + p * 4.4)
      const dz = Math.cos(temps * 0.83 + p * 5.2)
      echelleTemp.setScalar(0.019)

      positionTemp.set(
        CENTRE_PYRUVATE.x + dx * RAYON_HESITATION,
        CENTRE_PYRUVATE.y + dy * RAYON_HESITATION,
        CENTRE_PYRUVATE.z + dz * RAYON_HESITATION * 0.6,
      )
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      hesitantsPyruvate.setMatrixAt(i, matriceTemp)

      positionTemp.set(
        CENTRE_ACETYL.x + dy * RAYON_HESITATION,
        CENTRE_ACETYL.y + dz * RAYON_HESITATION,
        CENTRE_ACETYL.z + dx * RAYON_HESITATION * 0.6,
      )
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      hesitantsAcetyl.setMatrixAt(i, matriceTemp)
    }
    hesitantsPyruvate.instanceMatrix.needsUpdate = true
    hesitantsAcetyl.instanceMatrix.needsUpdate = true

    // 3. L'escalier de la glycolyse : une onde qui descend les dix postes.
    for (let i = 0; i < NB_POSTES_GLY; i++) {
      const battement = Math.max(0, Math.sin(temps * 2.2 - i * 0.55))
      echelleTemp.setScalar(0.042 * (1 + 0.3 * battement))
      positionTemp.set(posPostes[i * 3]!, posPostes[i * 3 + 1]!, posPostes[i * 3 + 2]!)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      postesGly.setMatrixAt(i, matriceTemp)
    }
    postesGly.instanceMatrix.needsUpdate = true

    // 4. Les quatre postes de la bêta-oxydation, dans l'ordre du tour.
    for (let i = 0; i < NB_POSTES_BETA; i++) {
      const angle = (i / NB_POSTES_BETA) * Math.PI * 2 + 0.4
      const battement = Math.max(0, Math.sin(temps * 1.9 - i * 1.5))
      positionTemp.set(
        CENTRE_BETA.x + Math.cos(angle) * RAYON_BETA,
        CENTRE_BETA.y + Math.sin(angle) * RAYON_BETA,
        0.02,
      )
      echelleTemp.setScalar(0.05 * (1 + 0.28 * battement))
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      postesBeta.setMatrixAt(i, matriceTemp)
    }
    postesBeta.instanceMatrix.needsUpdate = true

    // 5. Les huit enzymes du cycle tournent sur leur anneau.
    for (let i = 0; i < NB_BLOBS_KREBS; i++) {
      const angle = temps * 0.5 + (i / NB_BLOBS_KREBS) * Math.PI * 2
      positionTemp.set(
        CENTRE_KREBS.x + Math.cos(angle) * RAYON_KREBS,
        CENTRE_KREBS.y + Math.sin(angle) * RAYON_KREBS,
        0,
      )
      echelleTemp.setScalar(0.042)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      blobsKrebs.setMatrixAt(i, matriceTemp)
    }
    blobsKrebs.instanceMatrix.needsUpdate = true

    // 6. Les quatre complexes battent, sauf le II qui ne pompe pas.
    for (let c = 0; c < NB_COMPLEXES; c++) {
      const battement = c === 1 ? 0 : Math.max(0, Math.sin(temps * 3.1 - c * 0.9))
      positionTemp.set(X_MEMBRANE, Y_COMPLEXES[c]!, 0)
      echelleTemp.setScalar(RAYON_COMPLEXES[c]! * (1 + 0.18 * battement))
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      complexes.setMatrixAt(c, matriceTemp)
    }
    complexes.instanceMatrix.needsUpdate = true

    // 7. La turbine. Elle tourne à trois cents tours par seconde et fabrique
    //    trois ATP par tour ; ici on se contente de la faire tourner.
    for (let i = 0; i < NB_LOBES_SYNTHASE; i++) {
      const angle = temps * 2.6 + (i / NB_LOBES_SYNTHASE) * Math.PI * 2
      positionTemp.set(
        CENTRE_SYNTHASE.x,
        CENTRE_SYNTHASE.y + Math.cos(angle) * 0.055,
        CENTRE_SYNTHASE.z + Math.sin(angle) * 0.055,
      )
      echelleTemp.setScalar(0.042)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      lobesSynthase.setMatrixAt(i, matriceTemp)
    }
    lobesSynthase.instanceMatrix.needsUpdate = true

    // 8. La réglette se remplit. Les trois groupes se remplissent en parallèle
    //    et dans le même temps : celui de la chaîne va donc treize fois plus
    //    vite que les autres, et c'est exactement le rapport des rendements.
    const phaseBilan = (temps / PERIODE_BILAN) % 1
    for (let i = 0; i < NB_JETONS; i++) {
      const g = groupeJeton[i]!
      let allume: number
      if (g === 3) {
        // Les deux jetons de la fourchette : ils n'arrivent que si la navette
        // malate-aspartate est celle qui a fait entrer les NADH cytosoliques.
        allume =
          phaseBilan < 0.86 ? 0 : 0.35 + 0.65 * Math.max(0, Math.sin(temps * 4.2 + i * 2.1))
      } else {
        const dans = g === 0 ? ATP_GLYCOLYSE : g === 1 ? ATP_KREBS : ATP_CHAINE
        const debut = g === 0 ? 0 : g === 1 ? ATP_GLYCOLYSE : ATP_GLYCOLYSE + ATP_KREBS
        allume = Math.max(0, Math.min(1, (phaseBilan * dans - (i - debut)) * 4))
      }
      positionTemp.set(xJetons[i]!, Y_REGLETTE, 0.02)
      echelleTemp.set(TAILLE_JETON * allume, TAILLE_JETON * allume, TAILLE_JETON * 0.6)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      jetons.setMatrixAt(i, matriceTemp)
    }
    jetons.instanceMatrix.needsUpdate = true

    // 9. L'encart. Les six phosphates partent vers l'ADP dans les premières
    //    secondes de l'effort, et ne reviennent qu'une fois la respiration
    //    installée : la phosphocréatine se vide vite et se recharge lentement.
    for (let j = 0; j < NB_PHOSPHOCREATINE; j++) {
      const debutDecharge = 0.012 + j * 0.026
      const finDecharge = debutDecharge + 0.026
      const debutRecharge = 0.66 + j * 0.05
      const finRecharge = debutRecharge + 0.05
      let transfert: number
      if (phaseEffort < debutDecharge) transfert = 0
      else if (phaseEffort < finDecharge) {
        transfert = (phaseEffort - debutDecharge) / (finDecharge - debutDecharge)
      } else if (phaseEffort < debutRecharge) transfert = 1
      else if (phaseEffort < finRecharge) {
        transfert = 1 - (phaseEffort - debutRecharge) / (finRecharge - debutRecharge)
      } else transfert = 0

      const x = xSlot[j]!
      const charge = transfert > 0.97 ? 1 : 0

      // Le phosphate en vol, et sa courbe : il passe par la kinase.
      const yPhosphate =
        Y_RANG_CREATINE + 0.04 + (Y_RANG_ADP + 0.04 - Y_RANG_CREATINE - 0.04) * transfert
      positionTemp.set(
        x + Math.sin(transfert * Math.PI) * 0.03,
        yPhosphate,
        0.06 + Math.sin(transfert * Math.PI) * 0.03,
      )
      echelleTemp.setScalar(charge === 1 ? 0 : 0.02)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      phosphates.setMatrixAt(j, matriceTemp)

      // Le jeton du bas est ADP ou ATP, jamais les deux : celui qui n'a pas
      // cours est réduit à zéro EN LARGEUR, sinon il resterait un carré plat
      // face à la caméra.
      positionTemp.set(x, Y_RANG_ADP, 0.02)
      const vide = charge === 1 ? 0 : 0.05
      echelleTemp.set(vide, vide, 0.05)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      jetonsAdp.setMatrixAt(j, matriceTemp)

      const plein = 0.05 * charge
      echelleTemp.set(plein, plein, 0.05)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      jetonsAtp.setMatrixAt(j, matriceTemp)
    }
    phosphates.instanceMatrix.needsUpdate = true
    jetonsAdp.instanceMatrix.needsUpdate = true
    jetonsAtp.instanceMatrix.needsUpdate = true

    curseur.position.x = -0.3 + 0.6 * phaseEffort
    kinase.scale.setScalar(0.045 * (1 + 0.2 * Math.max(0, Math.sin(temps * 5.5))))

    echelleTemp.set(1, 1, 1)
  }

  animer(0)

  return [
    {
      cle: 'bilan-energetique',
      nom: 'Bilan énergétique',
      siege: 'Cytosol et mitochondrie',
      facteur: 'accéléré ×5',
      justificationFacteur:
        "Il n'y a pas une horloge unique ici : chaque voie a la sienne, d'une milliseconde par " +
        "réaction enzymatique à la minute pour un tour complet. Le facteur ×5 est celui des autres " +
        'modules de la série, repris pour que les débits se comparent d\'un panneau à l\'autre ; il ' +
        "correspond à peu près au parcours complet d'un glucose, une trentaine de secondes en régime " +
        "établi, ramené à six secondes d'écran.",
      ellision:
        "Ce panneau est une CARTE, pas une scène : rien n'y est à l'échelle et l'intérieur des voies " +
        'est coupé, pas ralenti. Les dix étapes de la glycolyse sont dix postes, les huit du cycle de ' +
        'Krebs huit grains sur un anneau, les quarante-cinq sous-unités du complexe I un seul volume. ' +
        "Sont absents : le transporteur du pyruvate, la navette carnitine qui fait entrer les acides " +
        'gras, les deux navettes des NADH cytosoliques, le transporteur ADP/ATP, les corps cétoniques, ' +
        "le glycogène, les acides aminés, et la régulation entière — c'est elle qui décide, à chaque " +
        'instant, laquelle de ces voies tourne. Le gradient de protons est figuré par un chapelet de ' +
        "grains alors que c'est une différence de potentiel, pas un stock de billes. Enfin l'encart " +
        "phosphocréatine n'est PAS au facteur affiché : ses trois régimes — quelques secondes, la " +
        "minute, puis les heures — sont posés sur un axe LOGARITHMIQUE compressé en douze secondes, " +
        "parce qu'un facteur qui rendrait la phosphocréatine lisible rendrait la respiration invisible.",
      description:
        "Vue synoptique assumée : un schéma en volume qui relie les voies au lieu de les montrer une à " +
        'une. Les sucres descendent à gauche dans le cytosol, les graisses entrent en haut à droite dans ' +
        'la mitochondrie, et les deux familles finissent en acétyl-CoA — le flux change de teinte au ' +
        "carrefour, c'est là que la convergence se voit. Le cycle de Krebs ne fabrique presque pas d'ATP : " +
        "il fabrique des NADH et des FADH₂, et ce sont eux qui alimentent le faisceau massif de la chaîne " +
        'respiratoire, à côté duquel les deux filets d\'ATP directs sont des filets. Le total est une ' +
        'fourchette et non un nombre exact pour deux raisons : le rendement dépend de la navette qui fait ' +
        'entrer les NADH cytosoliques dans la mitochondrie (26 ou 28 ATP selon la navette), et le gradient ' +
        "de protons n'est pas un compte entier de molécules — les deux derniers jetons de la réglette " +
        'clignotent pour cette raison. En encart, la phosphocréatine : elle ne produit pas d\'énergie, elle ' +
        'la tamponne, et se vide en quelques secondes avant que la glycolyse puis la respiration prennent ' +
        'le relais.',
      chiffres: [
        { valeur: '~30 à 32', quoi: "ATP par glucose, oxydation complète" },
        { valeur: '~90 %', quoi: "de l'ATP vient de la chaîne respiratoire" },
        { valeur: '2,5 et 1,5', quoi: 'ATP par NADH et par FADH₂ oxydés' },
        { valeur: '10 et 2', quoi: 'NADH et FADH₂ produits par glucose' },
        { valeur: '~106', quoi: 'ATP par palmitate : une graisse rend trois fois plus' },
        { valeur: '2', quoi: "ATP par glucose sans oxygène : la fermentation ne rend presque rien" },
        { valeur: '~1 fois son poids', quoi: "d'ATP régénéré par une cellule chaque jour" },
        { valeur: 'quelques secondes', quoi: "d'effort couvertes par la phosphocréatine seule" },
      ],
      objet: groupe,
      ancre: SIEGE.clone(),
      rayonCadrage: RAYON_CADRAGE,
      couleur: TEINTE_ATP,
      animer,
    },
  ]
}
