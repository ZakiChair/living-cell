/**
 * Lysosomes, peroxysomes et vésicules de transport.
 *
 * Trois familles de sacs membranaires que les planches confondent toujours,
 * parce qu'elles se ressemblent : ce sont des sphères. Elles sont donc séparées
 * ici par trois signes lisibles sans étiquette. Le lysosome est le plus gros et
 * son intérieur est GRANULEUX, vu au travers d'une enveloppe translucide. Le
 * peroxysome est plus petit, plus sombre, et porte un cœur cristallin en
 * octaèdre. La vésicule de transport n'est qu'un grain, aligné avec ses
 * semblables en chapelets qui partent du Golgi vers la membrane — et les plus
 * jeunes portent encore leur manteau, en cage polyédrique.
 */
import * as THREE from 'three'
import {
  RAYON_CELLULE,
  TEINTES,
  creerAlea,
  materiauOrganite,
  pointDansCoquille,
  type Organite,
} from '../contrat.js'

/** Une graine par famille : retoucher l'une ne redistribue pas les autres. */
const GRAINE_LYSOSOMES = 20_242
const GRAINE_PEROXYSOMES = 60_313
const GRAINE_VESICULES = 80_211

// ─── Lysosomes ──────────────────────────────────────────────────────────────
const NOMBRE_LYSOSOMES = 5
const RAYON_LYSOSOME = 0.25
const RAYON_GRAIN = 0.02
const GRAINS_MIN = 25
const GRAINS_MAX = 40
/** Marge intérieure : le plus gros grain doit rester enfermé dans l'enveloppe. */
const MARGE_GRAIN = 0.06

// ─── Peroxysomes ────────────────────────────────────────────────────────────
const NOMBRE_PEROXYSOMES = 4
const RAYON_PEROXYSOME = 0.18
/** Le cristalloïde occupe une bonne moitié du diamètre : c'est ce qu'on voit en EM. */
const RAYON_CRISTAL = 0.095

// ─── Vésicules de transport ─────────────────────────────────────────────────
/** Centre du Golgi, repris de golgi.ts : les vésicules en partent. */
const POSITION_GOLGI = new THREE.Vector3(3.2, -1.5, 0.5)
const VESICULES_PAR_ROUTE = 8
/** Les dix plus jeunes gardent leur manteau ; les autres l'ont déjà perdu. */
const VESICULES_MANTELEES = 10
const RAYON_VESICULE_MIN = 0.035
const RAYON_VESICULE_MAX = 0.05
/** Terme du trajet : juste sous la membrane, que les vésicules ne traversent pas. */
const RAYON_ARRIVEE = RAYON_CELLULE - 0.7
/**
 * Plongée imposée aux cinq routes vers le demi-espace ouvert par l'écorché.
 *
 * Le Golgi est en z positif, donc du côté retiré : sans cette pente, le premier
 * anneau du chapelet part à peine sous le plan de coupe et la moitié des
 * vésicules mantelées — celles qui portent tout le propos — est effacée.
 */
const PENTE_ROUTES = 0.45

/** Multiplie les trois canaux : la teinte de famille reste, la valeur baisse. */
function assombrir(couleur: number, facteur: number): number {
  const r = Math.round(((couleur >> 16) & 0xff) * facteur)
  const v = Math.round(((couleur >> 8) & 0xff) * facteur)
  const b = Math.round((couleur & 0xff) * facteur)
  return (r << 16) | (v << 8) | b
}

/**
 * Les cinq points d'arrivée des routes sécrétoires, en éventail autour de l'axe
 * Golgi → membrane. Un flux orienté se lit d'un coup d'œil ; quarante vésicules
 * semées au hasard ne racontent rien.
 */
function construireArrivees(): THREE.Vector3[] {
  // Repère orthonormé autour de la direction de sortie du Golgi.
  const axe = POSITION_GOLGI.clone().normalize()
  const lateral = new THREE.Vector3().crossVectors(axe, new THREE.Vector3(0, 1, 0)).normalize()
  const normal = new THREE.Vector3().crossVectors(axe, lateral)

  const ouvertures = [0.12, 0.34, 0.34, 0.55, 0.55]
  const azimuts = [0, 0.9, 3.4, 2.1, 4.9]

  return ouvertures.map((ouverture, i) => {
    const azimut = azimuts[i]!
    const direction = axe
      .clone()
      .multiplyScalar(Math.cos(ouverture))
      .addScaledVector(lateral, Math.sin(ouverture) * Math.cos(azimut))
      .addScaledVector(normal, Math.sin(ouverture) * Math.sin(azimut))
    // Même rabat que les autres organites : l'écorché retire le demi-espace z > 0.
    direction.z = -Math.abs(direction.z) - PENTE_ROUTES
    return direction.normalize().multiplyScalar(RAYON_ARRIVEE)
  })
}

const ARRIVEES = construireArrivees()
const NOMBRE_VESICULES = ARRIVEES.length * VESICULES_PAR_ROUTE

// Temporaires hissés au niveau du module : rien ne s'alloue instance par instance.
const _point = new THREE.Vector3()
const _position = new THREE.Vector3()
const _echelle = new THREE.Vector3()
const _rotation = new THREE.Quaternion()
const _euler = new THREE.Euler()
const _matrice = new THREE.Matrix4()
const _sansRotation = new THREE.Quaternion()

/** Centre de gravité d'une famille : c'est lui que porte l'origine du groupe. */
function barycentre(points: THREE.Vector3[]): THREE.Vector3 {
  const centre = new THREE.Vector3()
  for (const point of points) centre.add(point)
  return centre.divideScalar(points.length)
}

/**
 * Position dispersée dans le cytoplasme, rabattue du côté ouvert de l'écorché.
 *
 * Sans ce rabat, la moitié des exemplaires se trouve dans le demi-espace que le
 * plan de coupe retire, et l'étudiant en compte deux au lieu de cinq. Le prix à
 * payer est assumé : la population n'occupe que la moitié visible du cytoplasme.
 */
function positionVisible(alea: () => number, rayonMin: number, rayonMax: number): THREE.Vector3 {
  pointDansCoquille(alea, rayonMin, rayonMax, _point)
  _point.z = -Math.abs(_point.z)
  return _point.clone()
}

function creerFamilleLysosomes(): Organite {
  const alea = creerAlea(GRAINE_LYSOSOMES)

  const centres: THREE.Vector3[] = []
  const nombresDeGrains: number[] = []
  for (let i = 0; i < NOMBRE_LYSOSOMES; i++) {
    centres.push(positionVisible(alea, 5, 7.5))
    nombresDeGrains.push(GRAINS_MIN + Math.floor(alea() * (GRAINS_MAX - GRAINS_MIN + 1)))
  }
  const centreFamille = barycentre(centres)
  const totalGrains = nombresDeGrains.reduce((somme, n) => somme + n, 0)

  const enveloppes = new THREE.InstancedMesh(
    new THREE.SphereGeometry(RAYON_LYSOSOME, 22, 14),
    materiauOrganite(TEINTES.lysosome, { opacite: 0.5 }),
    NOMBRE_LYSOSOMES,
  )
  // Le contenu en digestion : hétéroclite par définition, donc jamais calibré.
  const grains = new THREE.InstancedMesh(
    new THREE.SphereGeometry(RAYON_GRAIN, 6, 5),
    materiauOrganite(assombrir(TEINTES.lysosome, 0.45), { doubleFace: false }),
    totalGrains,
  )

  let curseur = 0
  for (let i = 0; i < NOMBRE_LYSOSOMES; i++) {
    const centreLocal = centres[i]!.clone().sub(centreFamille)
    _echelle.setScalar(1)
    enveloppes.setMatrixAt(i, _matrice.compose(centreLocal, _sansRotation, _echelle))

    for (let g = 0; g < nombresDeGrains[i]!; g++) {
      pointDansCoquille(alea, 0, RAYON_LYSOSOME - MARGE_GRAIN, _point)
      _position.copy(centreLocal).add(_point)
      _echelle.setScalar(0.7 + alea() * 0.8)
      grains.setMatrixAt(curseur++, _matrice.compose(_position, _sansRotation, _echelle))
    }
  }
  enveloppes.instanceMatrix.needsUpdate = true
  grains.instanceMatrix.needsUpdate = true

  // Les grains sont opaques et passent donc avant l'enveloppe transparente ;
  // l'ordre explicite évite d'en dépendre par accident.
  grains.renderOrder = 1
  enveloppes.renderOrder = 2

  const groupe = new THREE.Group()
  groupe.name = 'lysosomes'
  groupe.add(grains, enveloppes)
  groupe.position.copy(centreFamille)

  // L'étiquette se pose sur l'exemplaire le plus haut, donc le moins encombré.
  let vedette = centres[0]!
  for (const centre of centres) if (centre.y > vedette.y) vedette = centre

  return {
    cle: 'lysosomes',
    nom: 'Lysosomes',
    role: "Digèrent et recyclent : l'estomac de la cellule.",
    description:
      "Un lysosome est une poche d'enzymes hydrolytiques qui démonte ce que la cellule " +
      "a ingéré, et ses propres organites usés. Une pompe à protons maintient son " +
      "intérieur à pH 4,5-5, deux unités et demie sous le cytosol : les hydrolases n'y " +
      "sont actives que là, si bien qu'une fuite ne digère pas la cellule. Le contenu " +
      "granuleux visible ici par transparence est ce matériel en cours de digestion — " +
      "c'est lui qui a valu à ces vésicules leur premier nom, corps denses.",
    chiffres: [
      { valeur: '0,1 à 1,2 µm', quoi: 'diamètre, très variable selon le contenu' },
      { valeur: 'pH 4,5 à 5', quoi: 'acidité interne (cytosol : 7,2)' },
      { valeur: '≈ 60', quoi: 'enzymes hydrolytiques différentes' },
      { valeur: 'ATPase à protons', quoi: "pompe qui acidifie, alimentée par l'ATP" },
    ],
    objet: groupe,
    ancre: vedette.clone().add(new THREE.Vector3(0, RAYON_LYSOSOME + 0.4, 0)),
    couleur: TEINTES.lysosome,
  }
}

function creerFamillePeroxysomes(): Organite {
  const alea = creerAlea(GRAINE_PEROXYSOMES)

  const centres: THREE.Vector3[] = []
  for (let i = 0; i < NOMBRE_PEROXYSOMES; i++) centres.push(positionVisible(alea, 4, 7))
  const centreFamille = barycentre(centres)

  const teintePeroxysome = assombrir(TEINTES.vesicule, 0.62)
  const enveloppes = new THREE.InstancedMesh(
    new THREE.SphereGeometry(RAYON_PEROXYSOME, 20, 13),
    // Un peu moins transparente que le lysosome : c'est le cristal qu'on cherche,
    // pas un grouillement, et la nuance de matière sépare aussi les deux familles.
    materiauOrganite(teintePeroxysome, { opacite: 0.55 }),
    NOMBRE_PEROXYSOMES,
  )
  const cristaux = new THREE.InstancedMesh(
    // Détail 0 : PolyhedronGeometry laisse alors des normales par face, et
    // l'octaèdre accroche la lumière facette par facette, comme un cristal.
    new THREE.OctahedronGeometry(RAYON_CRISTAL, 0),
    materiauOrganite(assombrir(TEINTES.vesicule, 0.3), {
      doubleFace: false,
      // Le cœur est très sombre : sans cette lueur il vire au noir plat sous
      // l'enveloppe et cesse de se lire comme un solide.
      emissif: 0x160f00,
    }),
    NOMBRE_PEROXYSOMES,
  )

  for (let i = 0; i < NOMBRE_PEROXYSOMES; i++) {
    const centreLocal = centres[i]!.clone().sub(centreFamille)
    // Enveloppe et cristal partagent délibérément cette échelle unitaire : leurs
    // tailles sont déjà dans les deux géométries. Faire varier l'une des deux
    // imposerait de remettre _echelle à 1 avant chaque compose.
    _echelle.setScalar(1)
    enveloppes.setMatrixAt(i, _matrice.compose(centreLocal, _sansRotation, _echelle))

    // Chaque cristal a son orientation propre : quatre losanges identiques
    // trahiraient tout de suite la copie instanciée.
    _euler.set(alea() * Math.PI, alea() * Math.PI, alea() * Math.PI)
    _rotation.setFromEuler(_euler)
    cristaux.setMatrixAt(i, _matrice.compose(centreLocal, _rotation, _echelle))
  }
  enveloppes.instanceMatrix.needsUpdate = true
  cristaux.instanceMatrix.needsUpdate = true

  cristaux.renderOrder = 1
  enveloppes.renderOrder = 2

  const groupe = new THREE.Group()
  groupe.name = 'peroxysomes'
  groupe.add(cristaux, enveloppes)
  groupe.position.copy(centreFamille)

  let vedette = centres[0]!
  for (const centre of centres) if (centre.y > vedette.y) vedette = centre

  return {
    cle: 'peroxysomes',
    nom: 'Peroxysomes',
    role: "Oxydent les longues chaînes grasses et détruisent le peroxyde d'hydrogène.",
    description:
      "Le peroxysome coupe les acides gras à très longue chaîne que la mitochondrie ne " +
      "sait pas attaquer, et détoxifie l'alcool dans le foie. Ces oxydations produisent " +
      "du peroxyde d'hydrogène, un poison, que la catalase logée dans la même vésicule " +
      "casse aussitôt en eau et en oxygène : produire et neutraliser au même endroit, " +
      "c'est toute l'idée. L'octaèdre central figure le cœur cristallin d'urate oxydase, " +
      "sa signature en microscopie — décrit chez le rat et beaucoup de mammifères, mais " +
      "le gène est inactivé chez l'humain. Il ne vient pas du Golgi : il se divise, ou " +
      "bourgeonne du réticulum.",
    chiffres: [
      { valeur: '0,1 à 1 µm', quoi: 'diamètre' },
      { valeur: 'quelques centaines', quoi: 'par cellule' },
      { valeur: '> C22', quoi: 'acides gras à très longue chaîne pris en charge' },
    ],
    objet: groupe,
    ancre: vedette.clone().add(new THREE.Vector3(0, RAYON_PEROXYSOME + 0.4, 0)),
    couleur: teintePeroxysome,
  }
}

function creerFamilleVesicules(): Organite {
  const alea = creerAlea(GRAINE_VESICULES)

  const positions: THREE.Vector3[] = []
  const rayons: number[] = []
  // Génération par anneaux successifs, et non route par route : les dix
  // premières vésicules sont ainsi les dix plus proches du Golgi, celles qui
  // viennent de bourgeonner et portent encore leur manteau.
  for (let etape = 0; etape < VESICULES_PAR_ROUTE; etape++) {
    const avancement = 0.17 + (etape / (VESICULES_PAR_ROUTE - 1)) * 0.8
    for (const arrivee of ARRIVEES) {
      const position = POSITION_GOLGI.clone().lerp(arrivee, avancement + (alea() - 0.5) * 0.06)
      // Dispersion latérale : un chapelet, pas un rail.
      position.x += (alea() - 0.5) * 0.45
      position.y += (alea() - 0.5) * 0.45
      position.z += (alea() - 0.5) * 0.45
      positions.push(position)
      rayons.push(RAYON_VESICULE_MIN + alea() * (RAYON_VESICULE_MAX - RAYON_VESICULE_MIN))
    }
  }
  const centreFamille = barycentre(positions)

  // Sphère unitaire mise à l'échelle par instance : une seule géométrie pour
  // toute la gamme 35-50 nm.
  const vesicules = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 12, 8),
    materiauOrganite(TEINTES.vesicule, { doubleFace: false }),
    NOMBRE_VESICULES,
  )

  const materiauManteau = materiauOrganite(TEINTES.vesicule, { opacite: 0.38 })
  // Le manteau de clathrine est une cage polyédrique de triskèles, pas une bulle
  // lisse : les facettes doivent se voir, sinon on a dessiné une deuxième vésicule.
  materiauManteau.flatShading = true
  const manteaux = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    materiauManteau,
    VESICULES_MANTELEES,
  )

  for (let i = 0; i < NOMBRE_VESICULES; i++) {
    const rayon = rayons[i]!
    _position.copy(positions[i]!).sub(centreFamille)
    _echelle.setScalar(rayon)
    vesicules.setMatrixAt(i, _matrice.compose(_position, _sansRotation, _echelle))

    if (i < VESICULES_MANTELEES) {
      // Le manteau enveloppe la membrane sans la toucher : il s'y accroche par
      // des adaptateurs, ce qui laisse un jeu de quelques nanomètres.
      _echelle.setScalar(rayon * 1.5)
      manteaux.setMatrixAt(i, _matrice.compose(_position, _sansRotation, _echelle))
    }
  }
  vesicules.instanceMatrix.needsUpdate = true
  manteaux.instanceMatrix.needsUpdate = true

  vesicules.renderOrder = 1
  manteaux.renderOrder = 2

  const groupe = new THREE.Group()
  groupe.name = 'vesicules-de-transport'
  groupe.add(vesicules, manteaux)
  groupe.position.copy(centreFamille)

  // Étiquette accrochée au milieu de la route la plus ouverte, là où le chapelet
  // est le plus dégagé. La position est reprise du tableau, pas recalculée.
  const vedette = positions[4 * ARRIVEES.length]!

  return {
    cle: 'vesicules-de-transport',
    nom: 'Vésicules de transport',
    role: 'Portent les protéines du Golgi jusqu’à la membrane.',
    description:
      "Ce sont les navettes de la voie sécrétoire : elles bourgeonnent de la face trans " +
      "du Golgi, traversent le cytoplasme en chapelets et fusionnent avec la membrane " +
      "plasmique, qui libère leur contenu au-dehors. Une vésicule ne naît jamais nue : " +
      "un manteau protéique — COPII, COPI ou clathrine — déforme la membrane, la découpe, " +
      "puis se démonte aussitôt le bourgeon détaché. Les dix vésicules encore proches du " +
      "Golgi le portent ici, en cage polyédrique translucide ; les autres l'ont déjà perdu. " +
      "C'est ce détail que les vulgarisations oublient, et sans lui on ne comprend pas " +
      "comment une membrane plate devient une bulle.",
    chiffres: [
      { valeur: '60 à 80 nm', quoi: 'vésicules COPII, du réticulum vers le Golgi' },
      { valeur: '20 à 200 nm', quoi: 'vésicules à manteau de clathrine' },
      { valeur: '3', quoi: 'familles de manteaux : COPII, COPI, clathrine' },
    ],
    objet: groupe,
    ancre: vedette.clone().add(new THREE.Vector3(0, 0.5, 0)),
    couleur: TEINTES.vesicule,
  }
}

export function creerVesiculesEtLysosomes(): Organite[] {
  return [creerFamilleLysosomes(), creerFamillePeroxysomes(), creerFamilleVesicules()]
}
