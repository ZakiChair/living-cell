import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite, pointDansCoquille } from '../contrat.js'
import { siegeMitochondrie, type Mecanisme } from './contrat.js'

/**
 * LE CYCLE DE KREBS, DANS LA MATRICE MITOCHONDRIALE.
 *
 * Huit enzymes disposées en anneau : la forme dit tout de suite que ça tourne et
 * que ça revient au point de départ. Un seul substrat fait le tour, et il change
 * à chaque poste — six carbones, puis cinq, puis quatre. Les deux carbones perdus
 * partent en CO₂ et s'éloignent : c'est le carbone qu'on expire.
 *
 * Le cycle ne fabrique presque pas d'ATP. Sa vraie production, ce sont des
 * TRANSPORTEURS D'ÉLECTRONS — trois NADH et un FADH₂ par tour — qui montent vers
 * la crête, juste au-dessus, là où la chaîne respiratoire les encaisse. Les
 * navettes arrivent pâles et repartent pleines : c'est le lien entre les voies.
 *
 * Deux conventions de lecture, énoncées dans la fiche : l'anneau n'existe pas
 * dans la matrice (sept des huit enzymes y flottent librement, seule la succinate
 * déshydrogénase est plantée dans la membrane), et tout est dessiné beaucoup trop
 * gros — une enzyme fait 5 à 10 nm, elle en fait ici presque 200.
 */

// ── Repères et échelle ────────────────────────────────────────────────────
/** Sous la mitochondrie de démonstration, posée à (5,4 ; 2,6 ; −1,2). */
/** Posé sur une vraie mitochondrie, et non à des coordonnées littérales. */
const CENTRE = siegeMitochondrie(1)
/**
 * Normale de l'anneau. Le cadrage des mécanismes recule la caméra selon
 * (0,5 ; 0,36 ; 0,79) : en orientant l'anneau à peu près face à cette direction,
 * le cycle se lit comme un cercle et non comme un trait. Le léger écart laisse
 * l'ellipse ouverte, ce qui rend le volume.
 */
const NORMALE_ANNEAU = new THREE.Vector3(0.46, 0.44, 0.77).normalize()
const AXE_Z = new THREE.Vector3(0, 0, 1)
const QUAT_ANNEAU = new THREE.Quaternion().setFromUnitVectors(AXE_Z, NORMALE_ANNEAU)

const NB_ETAPES = 8
/** Rayon de l'anneau d'enzymes, en micromètres. */
const R_ANNEAU = 0.48
/** Rayon du lobe principal d'une enzyme : ~20 fois trop gros, et c'est dit. */
const RAYON_ENZYME = 0.088
/** Le substrat se pose dans la fente, côté intérieur de l'anneau. */
const R_DOCK = R_ANNEAU - 0.115
/** Angle du sommet de l'anneau, où siège l'enzyme membranaire. */
const ANGLE_SOMMET = Math.PI / 2
/** Le cycle tourne dans le sens des angles décroissants. */
const PAS_ANGLE = -(Math.PI * 2) / NB_ETAPES

/** Écart entre deux carbones du substrat. Une liaison C–C fait 0,15 nm. */
const ECART_CARBONE = 0.046
const RAYON_CARBONE = 0.021
const NB_CARBONES = 6

// ── Minutage ──────────────────────────────────────────────────────────────
/** Un tour complet à l'écran, en secondes. */
const DUREE_TOUR = 10
/** Part d'une étape passée à l'arrêt sur l'enzyme ; le reste est en transit. */
const ARRET = 0.42
/** Durée du remodelage du substrat après la réaction, en fraction d'étape. */
const MORPHE = 0.2
/** Durée de vie d'un CO₂ à l'écran, en tours. */
const VIE_CO2 = 1.3

// ── Les huit postes ───────────────────────────────────────────────────────
/** 0 : NAD⁺→NADH, 1 : FAD→FADH₂, 2 : GDP→GTP, aussitôt converti en ATP. */
const SANS_NAVETTE = -1

interface Poste {
  /** Nom de l'enzyme, poste fixe de la chaîne. */
  enzyme: string
  /** Intermédiaire qu'elle produit — c'est lui qui repart vers le poste suivant. */
  produit: string
  /** Carbones de ce produit : 6, 6, 5, puis 4 jusqu'au bout. */
  carbones: number
  /** Cofacteur chargé ici, ou SANS_NAVETTE. */
  navette: number
  /** Cette étape relâche-t-elle un CO₂ ? */
  co2: boolean
  /** Enzyme plantée dans la membrane interne : la seule du lot. */
  membranaire: boolean
}

const POSTES: Poste[] = [
  { enzyme: 'citrate synthase', produit: 'citrate', carbones: 6, navette: SANS_NAVETTE, co2: false, membranaire: false },
  { enzyme: 'aconitase', produit: 'isocitrate', carbones: 6, navette: SANS_NAVETTE, co2: false, membranaire: false },
  { enzyme: 'isocitrate déshydrogénase', produit: 'α-cétoglutarate', carbones: 5, navette: 0, co2: true, membranaire: false },
  { enzyme: 'α-cétoglutarate déshydrogénase', produit: 'succinyl-CoA', carbones: 4, navette: 0, co2: true, membranaire: false },
  { enzyme: 'succinyl-CoA synthétase', produit: 'succinate', carbones: 4, navette: 2, co2: false, membranaire: false },
  { enzyme: 'succinate déshydrogénase', produit: 'fumarate', carbones: 4, navette: 1, co2: false, membranaire: true },
  { enzyme: 'fumarase', produit: 'malate', carbones: 4, navette: SANS_NAVETTE, co2: false, membranaire: false },
  { enzyme: 'malate déshydrogénase', produit: 'oxaloacétate', carbones: 4, navette: 0, co2: false, membranaire: false },
]

/** Segments où le substrat part du mauvais côté avant de trouver la suite. */
const FAUX_DEPART = [false, true, false, false, false, true, false, false]
/** Sens de l'écart radial pendant le transit : la diffusion n'est pas un rail. */
const ECART_TRANSIT = [1, -1, 1, 1, -1, -1, 1, -1]

/**
 * Disposition des carbones de chaque intermédiaire, en multiples de
 * ECART_CARBONE. Six emplacements par intermédiaire ; ceux qui dépassent le
 * compte réel sont réduits à zéro. La forme change à chaque étape, y compris
 * entre citrate et isocitrate qui ont les mêmes six carbones : c'est justement
 * ce que fait l'aconitase, elle déplace un groupe sans rien retirer.
 */
const DISPOSITIONS = [
  // citrate (6 C, ramifié)
  -1.40, 0.10, 0.00, -0.50, -0.15, 0.18, 0.45, 0.10, 0.00, 1.40, -0.10, -0.18, -0.05, 0.95, 0.14, -0.05, -0.95, -0.14,
  // isocitrate (6 C, ramification déplacée)
  -1.40, -0.10, 0.00, -0.55, 0.85, 0.16, 0.40, 0.05, 0.00, 1.35, -0.15, -0.16, -0.55, -0.80, -0.12, 1.30, 0.90, 0.10,
  // α-cétoglutarate (5 C, chaîne en zigzag)
  -1.75, 0.00, 0.00, -0.88, 0.50, 0.10, 0.00, 0.00, 0.00, 0.88, 0.50, -0.10, 1.75, 0.00, 0.00, 0.00, 0.00, 0.00,
  // succinyl-CoA (4 C, plus sa queue de coenzyme A)
  -1.20, 0.18, 0.00, -0.40, -0.30, 0.12, 0.40, 0.18, 0.00, 1.20, -0.30, -0.12, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
  // succinate (4 C, bien droit et symétrique)
  -1.25, 0.00, 0.00, -0.42, 0.00, 0.14, 0.42, 0.00, 0.14, 1.25, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
  // fumarate (4 C, coudé par la double liaison trans)
  -1.30, 0.42, 0.00, -0.45, 0.06, 0.00, 0.45, -0.06, 0.00, 1.30, -0.42, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
  // malate (4 C, un carbone porte l'hydroxyle)
  -1.20, 0.10, 0.00, -0.40, 0.58, 0.14, 0.40, 0.00, 0.00, 1.20, -0.38, -0.12, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
  // oxaloacétate (4 C, compact : il attend ses deux carbones)
  -0.55, 0.55, 0.00, 0.55, 0.55, 0.12, 0.55, -0.55, 0.00, -0.55, -0.55, -0.12, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
]

// ── Teintes ───────────────────────────────────────────────────────────────
/**
 * Le substrat parcourt une rampe violet → rose, et revient au violet quand
 * l'oxaloacétate redevient citrate : le retour de couleur boucle le cycle. La
 * bande verte-cyan, le jaune et l'orange sont interdits ici, ils appartiennent
 * aux cofacteurs et à eux seuls.
 */
const COULEURS_SUBSTRAT = [
  new THREE.Color(0x7f4fa8),
  new THREE.Color(0x8f52ab),
  new THREE.Color(0xa257ac),
  new THREE.Color(0xb45ea8),
  new THREE.Color(0xc266a3),
  new THREE.Color(0xcc6f9c),
  new THREE.Color(0xd47a97),
  new THREE.Color(0xda8794),
]

/** Navette vide, puis chargée : NAD⁺/NADH, FAD/FADH₂, GDP/GTP-ATP. */
const COULEURS_NAVETTE_VIDE = [
  new THREE.Color(0x9ecfbf),
  new THREE.Color(0xe0cf9e),
  new THREE.Color(0xdbb69a),
]
const COULEURS_NAVETTE_PLEINE = [
  new THREE.Color(TEINTES.reticulumLisse),
  new THREE.Color(TEINTES.vesicule),
  new THREE.Color(TEINTES.ribosome),
]
const TEINTES_NAVETTE_PLEINE = [TEINTES.reticulumLisse, TEINTES.vesicule, TEINTES.ribosome]

const TEINTE_CO2 = 0xb0b0ac
const TEINTE_ENZYME = TEINTES.centriole
const TEINTE_ENZYME_CLAIRE = 0x82796a
const TEINTE_SITE = 0x413b33
const TEINTE_COA = 0x4e5a63
const TEINTE_GRAIN = 0xada08a
const TEINTE_SOCLE = 0x8b8375
const TEINTE_ELECTRON = 0xffec9e

// ── Figurants et encombrement ─────────────────────────────────────────────
/** Cofacteurs qui errent sans rien trouver : la règle, pas l'exception. */
const NB_FIGURANTS_NAD = 18
/** Intermédiaires égarés, hors du fil que suit l'œil. */
const NB_FIGURANTS_ACIDE = 18
/** Grains de la matrice : elle contient 500 g de protéines par litre. */
const NB_GRAINS = 320

// ── Dérive déterministe ───────────────────────────────────────────────────
const NB_DERIVES = 56
const NB_HARM = 2
const POIDS_HARM = [0.62, 0.38]
const FREQ_DERIVE = new Float32Array(NB_DERIVES * 3 * NB_HARM)
const PHASE_DERIVE = new Float32Array(NB_DERIVES * 3 * NB_HARM)
{
  const aleaDerive = creerAlea(19371953)
  for (let i = 0; i < FREQ_DERIVE.length; i++) {
    FREQ_DERIVE[i] = 0.35 + aleaDerive() * 0.95
    PHASE_DERIVE[i] = aleaDerive() * Math.PI * 2
  }
}

// ── Temporaires hissés : animer() ne doit RIEN allouer ────────────────────
const matriceTemp = new THREE.Matrix4()
const quaternionTemp = new THREE.Quaternion()
const echelleTemp = new THREE.Vector3(1, 1, 1)
const positionTemp = new THREE.Vector3()
const positionTemp2 = new THREE.Vector3()
const deriveTemp = new THREE.Vector3()
const carboneTemp = new THREE.Vector3()

/** Rampe adoucie, bornée à [0, 1]. */
function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

/** Bosse brève : une rencontre qui touche puis repart. */
function bosse(x: number): number {
  return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x)
}

/**
 * Dérive erratique déterministe : deux sinusoïdes de fréquences incommensurables
 * par axe. Ce n'est pas un vrai mouvement brownien — il faudrait de l'état — mais
 * le tracé est errant et surtout SANS DIRECTION. Aucune molécule ne sait où elle va.
 */
function derive(indice: number, temps: number, amplitude: number, sortie: THREE.Vector3): THREE.Vector3 {
  const base = indice * 3 * NB_HARM
  let x = 0
  let y = 0
  let z = 0
  for (let h = 0; h < NB_HARM; h++) {
    const poids = POIDS_HARM[h]!
    const ix = base + h
    const iy = base + NB_HARM + h
    const iz = base + 2 * NB_HARM + h
    x += Math.sin(temps * FREQ_DERIVE[ix]! + PHASE_DERIVE[ix]!) * poids
    y += Math.sin(temps * FREQ_DERIVE[iy]! + PHASE_DERIVE[iy]!) * poids
    z += Math.sin(temps * FREQ_DERIVE[iz]! + PHASE_DERIVE[iz]!) * poids
  }
  return sortie.set(x * amplitude, y * amplitude, z * amplitude)
}

/** Point d'une courbe quadratique, sans allocation. */
function bezier(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number, sortie: THREE.Vector3): THREE.Vector3 {
  const u = 1 - t
  sortie.copy(a).multiplyScalar(u * u)
  sortie.addScaledVector(c, 2 * u * t)
  sortie.addScaledVector(b, t * t)
  return sortie
}

// ── Indices de dérive réservés ────────────────────────────────────────────
const DERIVE_SUBSTRAT = 0
const DERIVE_ACETYL = 1
const DERIVE_CO2 = 2
const DERIVE_NAVETTES = 6
const DERIVE_FIGURANTS = 12

/** Une navette de cofacteur : elle arrive vide, repart chargée. */
interface Navette {
  poste: number
  type: number
  /** La succinate déshydrogénase est dans la membrane : son FAD ne voyage pas. */
  fixe: boolean
  groupe: THREE.Group
  matiere: THREE.MeshLambertMaterial
  temoin: THREE.Mesh
  arrivee: THREE.Vector3
  controleEntree: THREE.Vector3
  dock: THREE.Vector3
  controleSortie: THREE.Vector3
  sortie: THREE.Vector3
}

/** Une case du bilan : elle se remplit quand le produit sort. */
interface Case {
  pastille: THREE.Mesh
  phase: number
}

export function creerKrebs(): Mecanisme[] {
  const alea = creerAlea(1937)

  // Le parent ne tourne pas : il garde les axes du monde, dont dépendent la
  // sortie des CO₂ et la montée des navettes vers la chaîne respiratoire.
  const groupe = new THREE.Group()
  groupe.position.copy(CENTRE)

  // L'anneau, lui, est incliné face à la caméra de cadrage.
  const anneau = new THREE.Group()
  anneau.quaternion.copy(QUAT_ANNEAU)
  groupe.add(anneau)

  // ── La matrice ──────────────────────────────────────────────────────────
  const matiereMatrice = materiauOrganite(TEINTES.mitochondrie, { opacite: 0.08 })
  matiereMatrice.depthWrite = false
  const enveloppe = new THREE.Mesh(new THREE.SphereGeometry(0.76, 26, 18), matiereMatrice)
  enveloppe.scale.set(1.06, 0.84, 1)
  groupe.add(enveloppe)

  // Encombrement : la matrice n'est pas un bocal d'eau claire.
  const matiereGrain = materiauOrganite(TEINTE_GRAIN, { opacite: 0.5, doubleFace: false })
  matiereGrain.depthWrite = false
  const grains = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.0062, 0), matiereGrain, NB_GRAINS)
  grains.frustumCulled = false
  groupe.add(grains)
  const basesGrain: THREE.Vector3[] = []
  const phasesGrain = new Float32Array(NB_GRAINS * 2)
  for (let i = 0; i < NB_GRAINS; i++) {
    const point = pointDansCoquille(alea, 0.2, 0.74, new THREE.Vector3())
    point.y *= 0.8
    basesGrain.push(point)
    phasesGrain[i * 2] = alea() * Math.PI * 2
    phasesGrain[i * 2 + 1] = 0.5 + alea()
  }

  // ── Les huit postes ─────────────────────────────────────────────────────
  const anglesPoste = new Float32Array(NB_ETAPES)
  const postesLocaux: THREE.Vector3[] = []
  const docksLocaux: THREE.Vector3[] = []
  const postesParent: THREE.Vector3[] = []
  const docksParent: THREE.Vector3[] = []
  const radialesParent: THREE.Vector3[] = []
  const enzymes: THREE.Group[] = []
  const echellesEnzyme = new Float32Array(NB_ETAPES)

  const geoLobe = new THREE.IcosahedronGeometry(RAYON_ENZYME, 1)
  const geoLobeSecond = new THREE.IcosahedronGeometry(RAYON_ENZYME * 0.62, 1)
  const geoSite = new THREE.IcosahedronGeometry(0.034, 1)
  const geoCoiffe = new THREE.IcosahedronGeometry(0.038, 1)
  const matiereEnzyme = materiauOrganite(TEINTE_ENZYME)
  const matiereEnzymeClaire = materiauOrganite(TEINTE_ENZYME_CLAIRE)
  const matiereSite = materiauOrganite(TEINTE_SITE)
  const matieresCoiffe = TEINTES_NAVETTE_PLEINE.map((teinte) => materiauOrganite(teinte))

  for (let i = 0; i < NB_ETAPES; i++) {
    const poste = POSTES[i]!
    // Le sommet de l'anneau est réservé à la succinate déshydrogénase, la seule
    // enzyme membranaire : elle doit se trouver sous la crête, en haut.
    const angle = ANGLE_SOMMET + (i - 5) * PAS_ANGLE
    anglesPoste[i] = angle
    // L'enzyme membranaire est poussée vers l'extérieur, contre la crête.
    const rayon = R_ANNEAU * (poste.membranaire ? 1.1 : 1)
    const local = new THREE.Vector3(Math.cos(angle) * rayon, Math.sin(angle) * rayon, 0)
    const dock = new THREE.Vector3(Math.cos(angle) * R_DOCK, Math.sin(angle) * R_DOCK, 0)
    postesLocaux.push(local)
    docksLocaux.push(dock)
    postesParent.push(local.clone().applyQuaternion(QUAT_ANNEAU))
    docksParent.push(dock.clone().applyQuaternion(QUAT_ANNEAU))
    radialesParent.push(local.clone().applyQuaternion(QUAT_ANNEAU).normalize())

    const enzyme = new THREE.Group()
    enzyme.position.copy(local)
    // Chaque enzyme a sa silhouette : ce sont huit protéines différentes.
    const lobe = new THREE.Mesh(geoLobe, matiereEnzyme)
    lobe.scale.set(1, 0.82 + alea() * 0.3, 0.86 + alea() * 0.24)
    lobe.rotation.set(alea() * 3, alea() * 3, alea() * 3)
    enzyme.add(lobe)

    const second = new THREE.Mesh(geoLobeSecond, matiereEnzymeClaire)
    second.position.set(
      Math.cos(angle) * RAYON_ENZYME * 0.55,
      Math.sin(angle) * RAYON_ENZYME * 0.55 + 0.03,
      0.045 + alea() * 0.03,
    )
    enzyme.add(second)

    // La fente catalytique regarde l'intérieur de l'anneau : c'est là que le
    // substrat se pose, et le seul endroit où il se passe quelque chose.
    const site = new THREE.Mesh(geoSite, matiereSite)
    site.position.set(-Math.cos(angle) * RAYON_ENZYME * 0.86, -Math.sin(angle) * RAYON_ENZYME * 0.86, 0.012)
    enzyme.add(site)

    // Une coiffe colorée là où la récolte se fait : d'un coup d'œil, on voit
    // que quatre postes sur huit rapportent un transporteur, et un seul un ATP.
    if (poste.navette !== SANS_NAVETTE) {
      const coiffe = new THREE.Mesh(geoCoiffe, matieresCoiffe[poste.navette]!)
      coiffe.position.set(Math.cos(angle) * RAYON_ENZYME * 0.8, Math.sin(angle) * RAYON_ENZYME * 0.8 + 0.05, -0.03)
      enzyme.add(coiffe)
    }

    echellesEnzyme[i] = 0.9 + alea() * 0.22
    enzyme.scale.setScalar(echellesEnzyme[i]!)
    anneau.add(enzyme)
    enzymes.push(enzyme)
  }

  // ── La crête, juste au-dessus du poste membranaire ───────────────────────
  // La succinate déshydrogénase EST le complexe II de la chaîne respiratoire :
  // elle est la seule enzyme du cycle à ne pas flotter dans la matrice.
  const socleCrete = postesParent[5]!
  const matiereCrete = materiauOrganite(TEINTES.mitochondrieCrete, { opacite: 0.55 })
  const geoCrete = new THREE.TorusGeometry(0.2, 0.026, 6, 18, Math.PI * 1.1)
  for (let i = 0; i < 3; i++) {
    const pli = new THREE.Mesh(geoCrete, matiereCrete)
    pli.position.set(socleCrete.x + (i - 1) * 0.12, socleCrete.y + 0.13 + i * 0.055, socleCrete.z - i * 0.06)
    pli.rotation.set(Math.PI / 2, 0, i * 0.5)
    pli.scale.set(1, 1, 0.7)
    groupe.add(pli)
  }

  // ── Le substrat : un objet, qui se transforme à chaque poste ─────────────
  const molecule = new THREE.Group()
  anneau.add(molecule)
  const matiereSubstrat = materiauOrganite(COULEURS_SUBSTRAT[0]!.getHex(), { doubleFace: false })
  const carbones = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_CARBONE, 2),
    matiereSubstrat,
    NB_CARBONES,
  )
  carbones.frustumCulled = false
  molecule.add(carbones)

  const matiereHalo = materiauOrganite(COULEURS_SUBSTRAT[0]!.getHex(), { opacite: 0.22 })
  matiereHalo.depthWrite = false
  const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.078, 2), matiereHalo)
  molecule.add(halo)

  // La queue de coenzyme A, portée seulement par le succinyl-CoA.
  const matiereCoA = materiauOrganite(TEINTE_COA)
  const queueCoA = new THREE.Group()
  const tigeCoA = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 6), matiereCoA)
  tigeCoA.position.y = 0.065
  const boutCoA = new THREE.Mesh(new THREE.IcosahedronGeometry(0.026, 1), matiereCoA)
  boutCoA.position.y = 0.14
  queueCoA.add(tigeCoA, boutCoA)
  queueCoA.position.set(0.06, 0.02, 0)
  molecule.add(queueCoA)

  // ── L'acétyl-CoA qui entre : deux carbones, et deux ratés avant de trouver ─
  const acetyl = new THREE.Group()
  anneau.add(acetyl)
  const matiereAcetyl = materiauOrganite(COULEURS_SUBSTRAT[0]!.getHex(), { doubleFace: false })
  const geoCarbone = new THREE.IcosahedronGeometry(RAYON_CARBONE, 2)
  const acetylA = new THREE.Mesh(geoCarbone, matiereAcetyl)
  const acetylB = new THREE.Mesh(geoCarbone, matiereAcetyl)
  acetyl.add(acetylA, acetylB)
  const queueAcetyl = new THREE.Group()
  const tigeAcetyl = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.13, 6), matiereCoA)
  tigeAcetyl.position.y = 0.065
  const boutAcetyl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.026, 1), matiereCoA)
  boutAcetyl.position.y = 0.14
  queueAcetyl.add(tigeAcetyl, boutAcetyl)
  acetyl.add(queueAcetyl)

  const dockEntree = docksLocaux[0]!
  const posteEntree = postesLocaux[0]!
  // Quatre points de passage : le large, deux quasi-rencontres, puis la fente.
  const cheminAcetyl = [
    posteEntree.clone().multiplyScalar(2.3).setZ(0.42),
    dockEntree.clone().add(new THREE.Vector3(0.16, -0.12, 0.19)),
    posteEntree.clone().multiplyScalar(1.75).setZ(-0.34),
    dockEntree.clone().add(new THREE.Vector3(0.12, -0.16, -0.13)),
    dockEntree.clone().add(new THREE.Vector3(0.07, -0.085, 0.02)),
  ]

  // ── Les CO₂ : le carbone qu'on expire ───────────────────────────────────
  const postesCO2: number[] = []
  for (let i = 0; i < NB_ETAPES; i++) if (POSTES[i]!.co2) postesCO2.push(i)
  /** Deux générations par événement : celle du tour en cours, celle d'avant. */
  const NB_CO2 = postesCO2.length * 2
  const matiereCO2 = materiauOrganite(TEINTE_CO2, { doubleFace: false })
  const co2 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.026, 2), matiereCO2, NB_CO2)
  co2.frustumCulled = false
  groupe.add(co2)

  // ── Les navettes de cofacteurs ──────────────────────────────────────────
  const matiereElectron = materiauOrganite(TEINTE_ELECTRON, { emissif: 0x3b3000, doubleFace: false })
  const geoCorps = new THREE.CylinderGeometry(0.042, 0.042, 0.028, 12)
  const geoLobeNavette = new THREE.IcosahedronGeometry(0.027, 1)
  const geoTemoin = new THREE.IcosahedronGeometry(0.019, 1)
  const navettes: Navette[] = []

  for (let i = 0; i < NB_ETAPES; i++) {
    const poste = POSTES[i]!
    if (poste.navette === SANS_NAVETTE) continue
    const matiere = materiauOrganite(COULEURS_NAVETTE_VIDE[poste.navette]!.getHex())
    const corpsNavette = new THREE.Group()
    const disque = new THREE.Mesh(geoCorps, matiere)
    const lobeNavette = new THREE.Mesh(geoLobeNavette, matiere)
    lobeNavette.position.set(0.047, 0.004, 0)
    const temoin = new THREE.Mesh(geoTemoin, matiereElectron)
    temoin.position.set(0, 0.032, 0)
    temoin.scale.setScalar(0)
    corpsNavette.add(disque, lobeNavette, temoin)
    groupe.add(corpsNavette)

    const ancrage = postesParent[i]!
    const radiale = radialesParent[i]!
    // Elle descend de la crête, se charge, et y remonte : le NADH ne va nulle
    // part ailleurs. C'est ce trajet qui relie le cycle à la chaîne respiratoire.
    // Le sommet du trajet est à environ 1 µm au-dessus du centre de la scène,
    // soit juste sous la mitochondrie de démonstration : le NADH y va, et
    // nulle part ailleurs.
    const dock = ancrage.clone().addScaledVector(radiale, 0.12).add(new THREE.Vector3(0, 0.11, 0.03))
    const arrivee = dock.clone().add(new THREE.Vector3(0, 0.6, 0)).addScaledVector(radiale, 0.2)
    const sortie = dock.clone().add(new THREE.Vector3(0, 0.62, 0)).addScaledVector(radiale, -0.05)
    const controleEntree = dock.clone().add(new THREE.Vector3(0, 0.26, 0)).addScaledVector(radiale, 0.34)
    const controleSortie = dock.clone().add(new THREE.Vector3(0, 0.28, 0)).addScaledVector(radiale, 0.24)

    if (poste.membranaire) {
      // Le FAD de la succinate déshydrogénase est enfoui dans l'enzyme : il ne
      // se détache jamais. Ses électrons partent seuls dans la membrane.
      corpsNavette.position.copy(ancrage).addScaledVector(radiale, 0.08).add(new THREE.Vector3(0, 0.06, 0))
    }

    navettes.push({
      poste: i,
      type: poste.navette,
      fixe: poste.membranaire,
      groupe: corpsNavette,
      matiere,
      temoin,
      arrivee,
      controleEntree,
      dock,
      controleSortie,
      sortie,
    })
  }

  // Les électrons du FADH₂ filent dans la membrane sans passer par la matrice.
  const electron = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 1), matiereElectron)
  groupe.add(electron)

  // ── Figurants : les rencontres qui ne donnent rien ──────────────────────
  const matiereFigurantNad = materiauOrganite(COULEURS_NAVETTE_VIDE[0]!.getHex(), { doubleFace: false })
  const matiereFigurantAcide = materiauOrganite(0xb07ec2, { doubleFace: false })
  const figurantsNad = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.03, 1),
    matiereFigurantNad,
    NB_FIGURANTS_NAD,
  )
  const figurantsAcide = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.024, 1),
    matiereFigurantAcide,
    NB_FIGURANTS_ACIDE,
  )
  figurantsNad.frustumCulled = false
  figurantsAcide.frustumCulled = false
  groupe.add(figurantsNad, figurantsAcide)

  const basesFigurant: THREE.Vector3[] = []
  for (let i = 0; i < NB_FIGURANTS_NAD + NB_FIGURANTS_ACIDE; i++) {
    const point = pointDansCoquille(alea, 0.16, 0.64, new THREE.Vector3())
    point.y *= 0.75
    basesFigurant.push(point)
  }

  // ── Le bilan, en dehors de la matrice : c'est une réglette, pas un organite ─
  const bilan = new THREE.Group()
  bilan.position.set(0, -0.7, 0.03)
  anneau.add(bilan)

  const matiereSocle = materiauOrganite(TEINTE_SOCLE)
  const barre = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.01, 0.01), matiereSocle)
  barre.position.z = -0.03
  bilan.add(barre)

  // Ordre du comptage : 2 CO₂, 3 NADH, 1 FADH₂, 1 ATP. La récolte d'un tour.
  const TYPES_CASE = [-1, -1, 0, 0, 0, 1, 2]
  const PHASES_CASE = [0.25, 0.375, 0.25, 0.375, 0.875, 0.625, 0.5]
  const geoSocleCase = new THREE.TorusGeometry(0.04, 0.008, 6, 14)
  const geoPastille = new THREE.IcosahedronGeometry(0.031, 2)
  const matiereCasePastille = [
    materiauOrganite(TEINTE_CO2),
    materiauOrganite(TEINTES_NAVETTE_PLEINE[0]!),
    materiauOrganite(TEINTES_NAVETTE_PLEINE[1]!),
    materiauOrganite(TEINTES_NAVETTE_PLEINE[2]!),
  ]
  const cases: Case[] = []
  for (let i = 0; i < TYPES_CASE.length; i++) {
    const x = (i - (TYPES_CASE.length - 1) / 2) * 0.115
    const socle = new THREE.Mesh(geoSocleCase, matiereSocle)
    socle.position.set(x, 0, 0)
    bilan.add(socle)
    const type = TYPES_CASE[i]!
    const pastille = new THREE.Mesh(geoPastille, matiereCasePastille[type + 1]!)
    pastille.position.set(x, 0, 0)
    pastille.scale.setScalar(0)
    bilan.add(pastille)
    cases.push({ pastille, phase: PHASES_CASE[i]! })
  }

  // Deux tours par glucose : la glycolyse livre deux pyruvates, donc deux
  // acétyl-CoA. Les deux jetons se remplissent l'un après l'autre, puis tout
  // repart à zéro — un glucose brûlé.
  const matiereJeton = materiauOrganite(COULEURS_SUBSTRAT[0]!.getHex())
  const geoSocleJeton = new THREE.TorusGeometry(0.032, 0.007, 6, 14)
  const jetons: THREE.Mesh[] = []
  for (let i = 0; i < 2; i++) {
    const x = (i - 0.5) * 0.15
    const socle = new THREE.Mesh(geoSocleJeton, matiereSocle)
    socle.position.set(x, -0.15, 0)
    bilan.add(socle)
    const jeton = new THREE.Mesh(new THREE.IcosahedronGeometry(0.024, 2), matiereJeton)
    jeton.position.set(x, -0.15, 0)
    jeton.scale.setScalar(0)
    bilan.add(jeton)
    jetons.push(jeton)
  }

  // ── Animation ───────────────────────────────────────────────────────────
  const animer = (temps: number): void => {
    const progression = temps / DUREE_TOUR
    const tour = Math.floor(progression)
    const p = progression - tour
    const f = p * NB_ETAPES
    const etape = Math.min(NB_ETAPES - 1, Math.floor(f))
    const u = f - etape
    const precedente = (etape + NB_ETAPES - 1) % NB_ETAPES
    const poste = POSTES[etape]!

    // ── Le substrat : position ────────────────────────────────────────────
    if (u < ARRET) {
      positionTemp.copy(docksLocaux[etape]!)
    } else {
      const t = (u - ARRET) / (1 - ARRET)
      let angle = anglesPoste[etape]! + PAS_ANGLE * lissage(t)
      // Hésitation : sur deux segments, il part franchement du mauvais côté
      // avant de revenir. Rien ne le guide, il tombe sur l'enzyme par collision.
      if (FAUX_DEPART[etape]!) angle -= PAS_ANGLE * 0.34 * bosse(Math.min(1, t / 0.36))
      const rayon = R_DOCK * (1 + 0.2 * Math.sin(Math.PI * t) * ECART_TRANSIT[etape]!)
      positionTemp.set(Math.cos(angle) * rayon, Math.sin(angle) * rayon, 0)
      derive(DERIVE_SUBSTRAT, temps, 0.055 * Math.sin(Math.PI * t), deriveTemp)
      positionTemp.add(deriveTemp)
    }
    molecule.position.copy(positionTemp)
    molecule.rotation.z = temps * 0.32
    // La réaction : une secousse brève au moment exact du passage.
    const eclat = bosse(Math.min(1, u / 0.26))
    molecule.scale.setScalar(1 + 0.2 * eclat)

    // ── Le substrat : forme et couleur ────────────────────────────────────
    const morphe = lissage(u / MORPHE)
    const carbonesAvant = POSTES[precedente]!.carbones
    const carbonesApres = poste.carbones
    for (let k = 0; k < NB_CARBONES; k++) {
      const baseAvant = (precedente * NB_CARBONES + k) * 3
      const baseApres = (etape * NB_CARBONES + k) * 3
      carboneTemp.set(
        DISPOSITIONS[baseAvant]!,
        DISPOSITIONS[baseAvant + 1]!,
        DISPOSITIONS[baseAvant + 2]!,
      )
      positionTemp2.set(
        DISPOSITIONS[baseApres]!,
        DISPOSITIONS[baseApres + 1]!,
        DISPOSITIONS[baseApres + 2]!,
      )
      carboneTemp.lerp(positionTemp2, morphe).multiplyScalar(ECART_CARBONE)
      // Un carbone qui s'en va rétrécit à la place même où le CO₂ apparaît.
      const presenceAvant = k < carbonesAvant ? 1 : 0
      const presenceApres = k < carbonesApres ? 1 : 0
      echelleTemp.setScalar(presenceAvant + (presenceApres - presenceAvant) * morphe)
      matriceTemp.compose(carboneTemp, quaternionTemp, echelleTemp)
      carbones.setMatrixAt(k, matriceTemp)
    }
    carbones.instanceMatrix.needsUpdate = true
    echelleTemp.setScalar(1)

    matiereSubstrat.color.copy(COULEURS_SUBSTRAT[precedente]!).lerp(COULEURS_SUBSTRAT[etape]!, morphe)
    matiereHalo.color.copy(matiereSubstrat.color)
    matiereSubstrat.emissive.setScalar(0.32 * eclat)
    const largeur = carbonesAvant + (carbonesApres - carbonesAvant) * morphe
    halo.scale.setScalar(0.74 + 0.11 * (largeur - 4))

    // La queue de coenzyme A n'existe qu'entre l'α-cétoglutarate déshydrogénase
    // et la succinyl-CoA synthétase : une étape, pas plus.
    const avecCoA = etape === 3 ? morphe : precedente === 3 ? 1 - morphe : 0
    queueCoA.scale.setScalar(avecCoA)

    // ── L'acétyl-CoA entrant ──────────────────────────────────────────────
    // Il rôde à la fin du tour et fusionne au passage du zéro : sa phase court
    // donc de 0,55 à 1,03, à cheval sur la frontière des tours.
    const pa = p < 0.3 ? p + 1 : p
    if (pa < 0.55 || pa > 1.03) {
      acetyl.scale.setScalar(0)
    } else {
      let segment = 0
      let t = 0
      if (pa < 0.7) {
        segment = 0
        t = (pa - 0.55) / 0.15
      } else if (pa < 0.79) {
        segment = 1
        t = (pa - 0.7) / 0.09
      } else if (pa < 0.89) {
        segment = 2
        t = (pa - 0.79) / 0.1
      } else {
        segment = 3
        t = Math.min(1, (pa - 0.89) / 0.08)
      }
      positionTemp.copy(cheminAcetyl[segment]!).lerp(cheminAcetyl[segment + 1]!, lissage(t))
      // Il erre, sauf quand il est arrimé : alors il ne bouge plus du tout.
      const arrime = lissage((pa - 0.93) / 0.05)
      derive(DERIVE_ACETYL, temps, 0.05 * (1 - arrime), deriveTemp)
      positionTemp.add(deriveTemp)

      // Fusion : les deux carbones glissent dans l'oxaloacétate, le CoA se
      // détache. Quatre plus deux font six, et ça se voit.
      const fusion = lissage((pa - 0.995) / 0.032)
      positionTemp.lerp(docksLocaux[0]!, fusion)
      acetyl.position.copy(positionTemp)
      acetyl.scale.setScalar(lissage((pa - 0.55) / 0.05))
      const ecart = ECART_CARBONE * (0.55 - 0.45 * fusion)
      acetylA.position.set(-ecart, 0, 0)
      acetylB.position.set(ecart, 0, 0)
      acetylA.scale.setScalar(1 - fusion)
      acetylB.scale.setScalar(1 - fusion)
      queueAcetyl.position.set(0.05 * fusion, 0.03 + 0.16 * fusion, 0)
      queueAcetyl.scale.setScalar(1 - lissage((pa - 0.995) / 0.02))
    }

    // ── Les deux CO₂ qui s'échappent ──────────────────────────────────────
    for (let j = 0; j < NB_CO2; j++) {
      const evenement = j % postesCO2.length
      const generation = Math.floor(j / postesCO2.length)
      const posteEmission = postesCO2[evenement]!
      const phaseEmission = posteEmission / NB_ETAPES
      const depart = (p >= phaseEmission ? tour : tour - 1) + phaseEmission - generation
      const age = progression - depart
      if (depart < 0 || age < 0 || age > VIE_CO2) {
        echelleTemp.setScalar(0)
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        co2.setMatrixAt(j, matriceTemp)
        continue
      }
      const a = age / VIE_CO2
      positionTemp.copy(docksParent[posteEmission]!)
      positionTemp.addScaledVector(radialesParent[posteEmission]!, 0.95 * a)
      positionTemp.y += 0.5 * a * a
      derive(DERIVE_CO2 + j, temps, 0.06, deriveTemp)
      positionTemp.add(deriveTemp)
      // Il enfle en apparaissant, s'efface en s'éloignant : il sort du cadre,
      // il ne disparaît pas d'un coup.
      echelleTemp.setScalar(lissage(a / 0.06) * (1 - lissage((a - 0.7) / 0.3)))
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      co2.setMatrixAt(j, matriceTemp)
    }
    co2.instanceMatrix.needsUpdate = true
    echelleTemp.setScalar(1)

    // ── Les navettes : vides à l'aller, pleines au retour ─────────────────
    for (let n = 0; n < navettes.length; n++) {
      const navette = navettes[n]!
      const phaseEvenement = navette.poste / NB_ETAPES
      // Âge depuis la dernière charge, en fraction de tour.
      const depuis = p >= phaseEvenement ? p - phaseEvenement : p + 1 - phaseEvenement
      const avant = 1 - depuis

      if (navette.fixe) {
        // Elle est plantée dans l'enzyme : elle ne fait que se charger, se
        // décharger dans la membrane, et attendre le tour suivant.
        const charge = lissage(depuis / 0.02) * (1 - lissage((depuis - 0.1) / 0.06))
        navette.matiere.color
          .copy(COULEURS_NAVETTE_VIDE[navette.type]!)
          .lerp(COULEURS_NAVETTE_PLEINE[navette.type]!, charge)
        navette.temoin.scale.setScalar(charge)
        navette.groupe.rotation.y = temps * 0.6
        continue
      }

      let visible = 0
      if (avant < 0.2) {
        // Descente depuis la crête, la navette encore vide.
        const t = 1 - avant / 0.2
        bezier(navette.arrivee, navette.controleEntree, navette.dock, lissage(t), positionTemp)
        visible = lissage(t / 0.12)
        navette.matiere.color.copy(COULEURS_NAVETTE_VIDE[navette.type]!)
        navette.temoin.scale.setScalar(0)
      } else if (depuis < 0.06) {
        // Chargement sur place : la couleur se remplit, les électrons arrivent.
        const t = depuis / 0.06
        positionTemp.copy(navette.dock)
        navette.matiere.color
          .copy(COULEURS_NAVETTE_VIDE[navette.type]!)
          .lerp(COULEURS_NAVETTE_PLEINE[navette.type]!, lissage(t))
        navette.temoin.scale.setScalar(lissage(t))
        visible = 1
      } else if (depuis < 0.3) {
        // Remontée vers la chaîne respiratoire, chargée cette fois.
        const t = (depuis - 0.06) / 0.24
        bezier(navette.dock, navette.controleSortie, navette.sortie, lissage(t), positionTemp)
        navette.matiere.color.copy(COULEURS_NAVETTE_PLEINE[navette.type]!)
        navette.temoin.scale.setScalar(1)
        visible = 1 - lissage((t - 0.6) / 0.4)
      } else {
        positionTemp.copy(navette.sortie)
      }
      derive(DERIVE_NAVETTES + n, temps, 0.02, deriveTemp)
      positionTemp.add(deriveTemp)
      navette.groupe.position.copy(positionTemp)
      navette.groupe.scale.setScalar(visible)
      navette.groupe.rotation.y = temps * 0.5 + n
    }

    // Les électrons du FADH₂ passent directement dans la membrane.
    const ageElectron = p >= 0.625 ? p - 0.625 : p + 1 - 0.625
    if (ageElectron < 0.14) {
      const t = ageElectron / 0.14
      electron.position.copy(postesParent[5]!)
      electron.position.y += 0.1 + 0.26 * t
      electron.position.z -= 0.05 * t
      electron.scale.setScalar(bosse(t))
    } else {
      electron.scale.setScalar(0)
    }

    // ── Les enzymes : postes fixes, mais vivants ──────────────────────────
    for (let i = 0; i < NB_ETAPES; i++) {
      const base = echellesEnzyme[i]!
      const secousse = i === etape ? 0.16 * bosse(Math.min(1, u / 0.3)) : 0
      enzymes[i]!.scale.setScalar(base * (1 + secousse))
    }

    // ── Les figurants : ça se croise sans arrêt, ça ne réagit presque jamais ─
    for (let i = 0; i < NB_FIGURANTS_NAD + NB_FIGURANTS_ACIDE; i++) {
      derive(DERIVE_FIGURANTS + i, temps, 0.16, deriveTemp)
      positionTemp.copy(basesFigurant[i]!).add(deriveTemp)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      if (i < NB_FIGURANTS_NAD) figurantsNad.setMatrixAt(i, matriceTemp)
      else figurantsAcide.setMatrixAt(i - NB_FIGURANTS_NAD, matriceTemp)
    }
    figurantsNad.instanceMatrix.needsUpdate = true
    figurantsAcide.instanceMatrix.needsUpdate = true

    // ── L'encombrement de la matrice ──────────────────────────────────────
    for (let i = 0; i < NB_GRAINS; i++) {
      const phaseGrain = phasesGrain[i * 2]!
      const vitesseGrain = phasesGrain[i * 2 + 1]!
      positionTemp.copy(basesGrain[i]!)
      positionTemp.x += Math.sin(temps * vitesseGrain + phaseGrain) * 0.03
      positionTemp.y += Math.sin(temps * vitesseGrain * 0.7 + phaseGrain * 2) * 0.03
      positionTemp.z += Math.sin(temps * vitesseGrain * 1.3 + phaseGrain * 3) * 0.03
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      grains.setMatrixAt(i, matriceTemp)
    }
    grains.instanceMatrix.needsUpdate = true

    // ── Le bilan du tour ──────────────────────────────────────────────────
    for (let i = 0; i < cases.length; i++) {
      const bilanCase = cases[i]!
      const rempli = p < bilanCase.phase ? 0 : lissage((p - bilanCase.phase) / 0.05)
      bilanCase.pastille.scale.setScalar(rempli * (1 + 0.4 * bosse((p - bilanCase.phase) / 0.12)))
    }
    const pair = tour % 2 === 0
    const remplissage = lissage((p - 0.02) / 0.06)
    jetons[0]!.scale.setScalar(pair ? remplissage : 1)
    jetons[1]!.scale.setScalar(pair ? 0 : remplissage)
  }

  animer(0)

  return [
    {
      cle: 'krebs',
      nom: 'Cycle de Krebs',
      siege: 'Matrice mitochondriale',
      facteur: 'accéléré ×5',
      justificationFacteur:
        "Le temps qu'un carbone met à faire le tour des huit enzymes dépend du régime : " +
        "de l'ordre d'une cinquantaine de secondes dans un muscle au repos, où le flux est " +
        "faible et les réserves d'intermédiaires larges, et quelques secondes seulement à " +
        "l'effort. Le tour dure ici dix secondes : accéléré ×5 par rapport au repos, et " +
        "ralenti d'autant par rapport à l'effort.",
      ellision:
        "L'anneau est une convention de lecture, pas une structure : seule la succinate " +
        "déshydrogénase est réellement fixée — c'est le complexe II, planté dans la membrane " +
        'interne, dessiné ici contre la crête. Les sept autres flottent dans la matrice, où le ' +
        'substrat les trouve par collision. Tout est à la taille vraie : les huit enzymes ' +
        "tiennent dans un anneau de 50 nm, une enzyme fait 5 à 10 nm et une liaison " +
        "carbone-carbone 0,15 nm. Les " +
        "molécules d'eau, les protons et le coenzyme A libre ne sont pas dessinés, et la vraie " +
        'matrice est bien plus encombrée que ce brouillard de grains.',
      description:
        "Huit enzymes en anneau. L'acétyl-CoA à deux carbones — que livrent aussi bien le sucre " +
        'que les acides gras et les acides aminés — se condense sur un oxaloacétate à quatre ' +
        'carbones pour donner le citrate à six ; le tour qui suit démonte ce citrate jusqu\'à ' +
        "régénérer l'oxaloacétate, prêt à recommencer. Deux carbones s'échappent en chemin sous " +
        "forme de CO₂, à l'isocitrate déshydrogénase puis à l'α-cétoglutarate déshydrogénase : " +
        "c'est exactement le carbone que vous expirez en lisant cette phrase. Le cycle ne " +
        "produit qu'une seule liaison riche par tour — un GTP, aussitôt converti en ATP — et " +
        'là n\'est pas l\'essentiel : sa vraie récolte, ce sont trois NADH et un FADH₂, des ' +
        'transporteurs d\'électrons qui montent vers la chaîne respiratoire de la crête et y ' +
        'valent neuf ATP de plus. Un glucose donne deux pyruvates, donc deux ' +
        "tours — les deux jetons du bas — et comme le cycle fournit aussi le squelette de " +
        "plusieurs acides aminés, de l'hème et du glucose, on le dit amphibolique : il brûle et " +
        'il construit.',
      objet: groupe,
      ancre: CENTRE.clone(),
      rayonCadrage: 0.9,
      couleur: TEINTES.mitochondrie,
      animer,
    },
  ]
}
