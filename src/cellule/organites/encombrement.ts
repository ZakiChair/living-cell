import * as THREE from 'three'
import {
  TEINTES,
  creerAlea,
  materiauOrganite,
  pointDansCoquille,
  type Organite,
} from '../contrat.js'

/**
 * L'encombrement moléculaire : ce qui remplit le cytoplasme.
 *
 * Le cytoplasme n'est pas de l'eau où flottent des organites, c'est un gel
 * saturé : 20 à 30 % du volume occupé par des macromolécules, 300 mg de
 * protéines par millilitre, et une GFP qui y diffuse trois fois plus lentement
 * que dans l'eau. Toutes les planches de manuel effacent ce fait ; ce module
 * n'existe que pour le rétablir.
 *
 * Il le fait à DEUX RÉGIMES, et la distinction est une exigence d'honnêteté :
 *
 *  — LA BOÎTE DE VÉRITÉ : un cube de 1,2 µm posé dans le cytoplasme dégagé, où
 *    157 000 complexes tiennent la densité réelle. C'est là qu'on regarde de près.
 *  — LE VOILE : 60 000 objets pour tout le reste de la cellule, soit trois
 *    ordres de grandeur SOUS le compte réel. À l'échelle de la cellule ces
 *    objets sont sub-pixel et forment un grain, comme en microscopie
 *    électronique ; en zoomant ils se résolvent, là où le vrai cytosol serait
 *    un mur.
 *
 * La cellule entière à densité vraie demanderait 10⁸ à 10¹⁰ objets, contre les
 * 2 × 10⁵ que la carte graphique tient à 60 images par seconde. L'écart n'est
 * pas rattrapable : il est déclaré, dans la fiche et par le liseré qui borne la
 * boîte.
 */

/** Le hasard est figé : le peuplement est le même à chaque chargement. */
const GRAINE = 250_982

/** Cube posé dans le cytoplasme dégagé, entre le Golgi et la membrane. */
const CENTRE_BOITE = new THREE.Vector3(5.2, -3.4, 2.2)
const ARETE_BOITE = 1.2
const DEMI_BOITE = ARETE_BOITE / 2

/**
 * Budget de la boîte.
 *
 * Un complexe reconnaissable occupe environ 2 750 nm³, soit 2,75 × 10⁻⁶ µm³.
 * Le cube fait 1,728 µm³ ; à 25 % du volume occupé, 1,728 × 0,25 / 2,75e-6
 * donne ≈ 157 000 instances. C'est un plafond, pas une cible à dépasser.
 */
const INSTANCES_BOITE = 157_000

/** Le voile couvre 3 500 µm³ avec le tiers d'instances de la seule boîte. */
const INSTANCES_VOILE = 60_000

/** Le noyau occupe tout ce qui est en deçà de ce rayon : le voile commence après. */
const RAYON_NOYAU_EVITE = 3.2
/** Le voile s'arrête sous le cortex, que le cytosquelette occupe déjà. */
const RAYON_VOILE_MAX = 9.6

/** Arêtes du cube : 4 nm de rayon, à peine plus qu'un filament d'actine. */
const RAYON_LISERE = 0.004

const AXE_Y = new THREE.Vector3(0, 1, 0)
const AXES = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
]

// Temporaires hissés au niveau du module : rien ne s'alloue instance par instance.
const _position = new THREE.Vector3()
const _quaternion = new THREE.Quaternion()
const _matrice = new THREE.Matrix4()
const _hsl = { h: 0, s: 0, l: 0 }
/** Les tailles sont vraies et portées par la géométrie : aucune instance n'est mise à l'échelle. */
const ECHELLE_UNITE = new THREE.Vector3(1, 1, 1)

/**
 * Teinte de famille, rabattue de 15 %.
 *
 * Le peuplement est le fond du tableau : à saturation pleine il rivaliserait
 * avec les organites qu'il est censé entourer.
 */
function desaturer(teinte: number): number {
  const couleur = new THREE.Color(teinte)
  couleur.getHSL(_hsl)
  return couleur.setHSL(_hsl.h, _hsl.s * 0.85, _hsl.l).getHex()
}

/**
 * Concatène plusieurs géométries en une seule.
 *
 * Sert deux fois : le ribosome doit garder ses deux sous-unités dans UNE
 * instance, et les douze arêtes du liseré doivent former UN maillage. Les
 * géométries indexées sont dépliées d'abord — on ne recolle alors que des
 * tableaux de sommets, sans décalage d'index à tenir.
 */
function fusionner(morceaux: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const plats = morceaux.map((m) => (m.index ? m.toNonIndexed() : m))
  const fusion = new THREE.BufferGeometry()
  for (const nom of ['position', 'normal'] as const) {
    const total = plats.reduce((somme, m) => somme + m.getAttribute(nom).count, 0)
    const donnees = new Float32Array(total * 3)
    let decalage = 0
    for (const m of plats) {
      const attribut = m.getAttribute(nom)
      donnees.set(attribut.array as ArrayLike<number>, decalage)
      decalage += attribut.count * 3
    }
    fusion.setAttribute(nom, new THREE.BufferAttribute(donnees, 3))
  }
  return fusion
}

/**
 * Orientation quelconque, uniforme sur les rotations (méthode de Shoemake).
 *
 * Sans elle, un champ de polyèdres tous orientés pareil se lit comme une
 * grille, et la trame trahit immédiatement la génération procédurale.
 */
function orientationAleatoire(alea: () => number, cible: THREE.Quaternion): THREE.Quaternion {
  const u1 = alea()
  const r1 = Math.sqrt(1 - u1)
  const r2 = Math.sqrt(u1)
  const t1 = alea() * Math.PI * 2
  const t2 = alea() * Math.PI * 2
  return cible.set(r1 * Math.sin(t1), r1 * Math.cos(t1), r2 * Math.sin(t2), r2 * Math.cos(t2))
}

/** Une famille de forme : sa silhouette, sa teinte, sa part du semis. */
interface Famille {
  cle: string
  geometrie: THREE.BufferGeometry
  teinte: number
  /** Part du total. La somme des cinq vaut 1. */
  part: number
}

/**
 * Les cinq familles du peuplement, aux tailles vraies.
 *
 * Chacune tient dans un polyèdre à très peu de faces : à ces tailles un objet
 * couvre quelques pixels, la facette ne se voit pas, et c'est le nombre
 * d'instances qui coûte, pas la rondeur. Les silhouettes restent distinctes —
 * grain, bâtonnet, gros bloc facetté, ribosome bilobé — parce que c'est la
 * forme, jamais la texture, qui permet de lire une image saturée.
 *
 * Cinq teintes pour cinq familles : `TEINTES.vesicule` et
 * `TEINTES.proteineMembranaire` sont le même ambre, la palette n'en distingue
 * pas six.
 */
function creerFamilles(): Famille[] {
  return [
    {
      cle: 'petites-proteines',
      // 5 nm de diamètre : la protéine globulaire moyenne, ~50 kDa.
      geometrie: new THREE.OctahedronGeometry(0.0025, 0),
      teinte: desaturer(TEINTES.golgi),
      part: 0.55,
    },
    {
      cle: 'proteines-moyennes',
      // Allongée : la plupart des protéines de taille moyenne ne sont pas des billes.
      geometrie: new THREE.IcosahedronGeometry(0.004, 0).scale(1, 1.6, 1),
      teinte: desaturer(TEINTES.reticulumLisse),
      part: 0.25,
    },
    {
      cle: 'gros-complexes',
      // 14 nm : protéasome, chaperonne, complexe pyruvate déshydrogénase.
      geometrie: new THREE.DodecahedronGeometry(0.007, 0),
      teinte: desaturer(TEINTES.lysosome),
      part: 0.12,
    },
    {
      cle: 'ribosomes',
      // 25 nm de haut pour 18 de large, et deux sous-unités inégales : c'est à
      // ça qu'on le reconnaît. Les rayons sont relevés d'un dixième par rapport
      // aux 12,5 nm nominaux, parce qu'un icosaèdre à zéro subdivision n'atteint
      // que 0,9 fois son rayon sur ses axes — la silhouette, elle, doit faire
      // ses 25 nm. Les deux lobes sont fusionnés pour ne coûter qu'une instance.
      geometrie: fusionner([
        new THREE.IcosahedronGeometry(0.0105, 0).translate(0, -0.0028, 0),
        new THREE.IcosahedronGeometry(0.0075, 0).translate(0, 0.006, 0),
      ]),
      teinte: desaturer(TEINTES.ribosome),
      part: 0.06,
    },
    {
      cle: 'arn',
      // ARNt et petits ARN : 8 nm de long pour 2,4 nm d'épaisseur, la double
      // hélice repliée. Bâtonnet ouvert aux deux bouts, invisibles à cette taille.
      geometrie: new THREE.CylinderGeometry(0.0012, 0.0012, 0.008, 5, 1, true),
      teinte: desaturer(TEINTES.vesicule),
      part: 0.02,
    },
  ]
}

/** Point quelconque dans le cube, en repère local de la boîte. */
function placerDansBoite(alea: () => number, cible: THREE.Vector3): void {
  cible.set(
    (alea() - 0.5) * ARETE_BOITE,
    (alea() - 0.5) * ARETE_BOITE,
    (alea() - 0.5) * ARETE_BOITE,
  )
}

/** Vrai si le point tombe dans la région déclarée, en coordonnées monde. */
function dansLaBoite(point: THREE.Vector3): boolean {
  return (
    Math.abs(point.x - CENTRE_BOITE.x) < DEMI_BOITE &&
    Math.abs(point.y - CENTRE_BOITE.y) < DEMI_BOITE &&
    Math.abs(point.z - CENTRE_BOITE.z) < DEMI_BOITE
  )
}

/**
 * Point quelconque du cytosol, en coordonnées monde.
 *
 * La coquille demandée va de 1 à 9,6 µm en évitant le noyau, sphère de 3,2 µm
 * centrée sur l'origine : c'est exactement la coquille 3,2 – 9,6, qu'on tire
 * directement plutôt que par rejet. Seule la boîte de vérité est retirée, pour
 * que la région déclarée ne contienne que ses propres 157 000 objets.
 */
function placerDansVoile(alea: () => number, cible: THREE.Vector3): void {
  do {
    pointDansCoquille(alea, RAYON_NOYAU_EVITE, RAYON_VOILE_MAX, cible)
  } while (dansLaBoite(cible))
}

/**
 * Sème une population : un InstancedMesh par famille, matériaux propres au régime.
 *
 * Les matériaux ne sont jamais partagés entre les deux régimes : l'isolement de
 * la légende désature les matériaux organite par organite, et un partage
 * ferait bouger la boîte quand on isole le cytosol.
 */
function semer(
  familles: Famille[],
  total: number,
  alea: () => number,
  placer: (alea: () => number, cible: THREE.Vector3) => void,
): THREE.InstancedMesh[] {
  return familles.map((famille) => {
    const nombre = Math.round(total * famille.part)
    const maillage = new THREE.InstancedMesh(
      famille.geometrie,
      // Faces avant seulement : ces solides sont convexes et fermés, la face
      // arrière n'est jamais vue et doublerait le travail de rastérisation.
      materiauOrganite(famille.teinte, { doubleFace: false }),
      nombre,
    )
    maillage.name = famille.cle

    // Le raycaster teste les instances UNE PAR UNE : laissé actif, le survol
    // parcourrait 217 000 objets à chaque mouvement de souris et figerait la
    // page. La boîte reste désignable par sa cible dédiée, et le cytosol par
    // son entrée de légende.
    maillage.raycast = () => {}

    for (let i = 0; i < nombre; i++) {
      placer(alea, _position)
      orientationAleatoire(alea, _quaternion)
      maillage.setMatrixAt(i, _matrice.compose(_position, _quaternion, ECHELLE_UNITE))
    }
    maillage.instanceMatrix.needsUpdate = true
    return maillage
  })
}


export function creerEncombrement(): Organite[] {
  const alea = creerAlea(GRAINE)
  // Une seule géométrie par famille, partagée par les deux régimes.
  const familles = creerFamilles()

  const boite = new THREE.Group()
  boite.name = 'boite-de-verite'
  boite.position.copy(CENTRE_BOITE)
  boite.add(...semer(familles, INSTANCES_BOITE, alea, placerDansBoite))
  // Le liseré de boîte a été retiré : un cube filaire flottant dans le cytoplasme
  // ne ressemble à rien de biologique, et cette page doit montrer la cellule, pas
  // un schéma d'elle. Ce que le liseré déclarait — l'endroit où la densité est
  // exacte — est désormais dit dans la fiche et nulle part ailleurs.

  // Cible de survol de la région : un cube que le raycaster voit et que le
  // rendu ignore. Sans lui la boîte ne serait désignable que par ses arêtes de
  // 4 nm, impossibles à viser.
  const cible = new THREE.Mesh(
    new THREE.BoxGeometry(ARETE_BOITE, ARETE_BOITE, ARETE_BOITE),
    materiauOrganite(TEINTES.cytosquelette),
  )
  cible.name = 'cible-boite'
  cible.visible = false
  boite.add(cible)

  const voile = new THREE.Group()
  voile.name = 'voile-cytosol'
  voile.add(...semer(familles, INSTANCES_VOILE, alea, placerDansVoile))

  return [
    {
      cle: 'boite-de-verite',
      nom: 'Boîte de vérité',
      role: 'Le cytoplasme à sa densité réelle : 25 % du volume',
      description:
        "Dans ce cube de 1,2 µm d'arête, et nulle part ailleurs dans cette " +
        "cellule, l'encombrement est celui de la biologie : 157 000 protéines, " +
        'complexes, ribosomes et ARN, tous dessinés à leur taille vraie, du grain ' +
        'de 5 nm au ribosome de 25 nm. Une protéine ne traverse jamais un tel ' +
        "milieu en ligne droite ; elle rebondit sur ses voisines, et c'est " +
        'pourquoi la GFP y diffuse trois fois plus lentement que dans l’eau. ' +
        "Cette densité ne peut pas être tenue partout : à l'échelle de la cellule " +
        "entière il faudrait des centaines de millions d'objets, contre les deux " +
        'cent mille que la carte graphique dessine à 60 images par seconde. Le ' +
        "liseré qui borne le cube dit exactement où s'arrête la vérité.",
      chiffres: [
        { valeur: '157 000', quoi: 'complexes dessinés dans 1,7 µm³, à densité réelle' },
        { valeur: '20 à 30 %', quoi: 'du volume du cytoplasme occupé par des macromolécules' },
        { valeur: '300 mg/mL', quoi: 'de protéines dans le cytosol' },
        { valeur: '27 µm²/s', quoi: "diffusion de la GFP ici, contre 87 dans l'eau" },
      ],
      objet: boite,
      // Le bouton « aller à la boîte » recopie cette ancre dans la cible de la
      // caméra : elle doit être le centre du cube, pas un point flottant à côté.
      ancre: CENTRE_BOITE.clone(),
      couleur: desaturer(TEINTES.ribosome),
    },
    {
      cle: 'voile-cytosol',
      nom: 'Cytosol',
      role: 'Le milieu, jamais vide',
      description:
        "Le cytosol est un gel encombré, pas une solution : 300 mg de protéines " +
        "par millilitre, un cinquième à un tiers du volume occupé, et une bonne " +
        "part de l'eau retenue à la surface des macromolécules. Le semis dessiné " +
        'ici est honnête sur sa propre limite : sa densité est réduite ' +
        "d'environ trois ordres de grandeur par rapport au réel, faute de budget " +
        "de rendu — 60 000 objets là où la biologie en met des centaines de " +
        "millions. À l'échelle de la cellule il donne le grain fin qu'on voit en " +
        'microscopie électronique ; en zoomant il se résout en objets isolés, là ' +
        'où le vrai cytosol serait un mur. Pour voir cette densité vraie, il faut ' +
        'entrer dans la boîte de vérité.',
      chiffres: [
        { valeur: '60 000', quoi: 'objets pour 3 500 µm³ : le semis, pas la réalité' },
        { valeur: '10⁸ à 10¹⁰', quoi: 'objets qu’il faudrait pour la cellule entière' },
        { valeur: '×3', quoi: 'ralentissement de la diffusion dû à cet encombrement' },
        { valeur: '20 à 30 %', quoi: 'du volume occupé par des macromolécules' },
      ],
      objet: voile,
      ancre: new THREE.Vector3(-6.2, 3.6, -2.4),
      couleur: desaturer(TEINTES.golgi),
    },
  ]
}
