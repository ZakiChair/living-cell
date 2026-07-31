import * as THREE from 'three'
import {
  TEINTES,
  creerAlea,
  materiauOrganite,
  pointDansCoquille,
  type Organite,
} from '../contrat.js'
import {
  OCCUPATION_CYTOSOL,
  areteTenable,
  volumeMoyenPondere,
} from '../../noyau/densite.js'

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
 *  — LA BOÎTE DE VÉRITÉ : une DALLE posée dans le cytoplasme dégagé, où 157 000
 *    objets tiennent la densité réelle. Son arête est DÉDUITE du volume
 *    réellement semé, pas choisie : voir `ARETE_BOITE`. C'est là qu'on regarde
 *    de près.
 *  — LE VOILE : 60 000 objets pour tout le reste de la cellule, soit trois
 *    ordres de grandeur SOUS le compte réel. À l'échelle de la cellule ces
 *    objets sont sub-pixel et forment un grain, comme en microscopie
 *    électronique ; en zoomant ils se résolvent, là où le vrai cytosol serait
 *    un mur.
 *
 * La cellule entière à densité vraie demanderait 10⁸ à 10¹⁰ objets, contre les
 * 2 × 10⁵ que la carte graphique tient à 60 images par seconde. L'écart n'est
 * pas rattrapable : il est déclaré dans la fiche de chaque amas, et nulle part
 * ailleurs — le liseré qui bornait la boîte a été retiré, pour la raison écrite
 * plus bas. Rien, en revanche, ne réduit jamais la densité DANS la boîte : ni le
 * curseur, ni le gros plan sur un mécanisme, ni l'atelier.
 */

/** Le hasard est figé : le peuplement est le même à chaque chargement. */
const GRAINE = 250_982

/** Cube posé dans le cytoplasme dégagé, entre le Golgi et la membrane. */
const CENTRE_BOITE = new THREE.Vector3(5.2, -3.4, 2.2)

/**
 * Budget de la boîte : un plafond d'instances, pas une cible à dépasser.
 */
const INSTANCES_BOITE = 157_000

/** Le voile couvre 3 500 µm³ avec le tiers d'instances de la seule boîte. */
const INSTANCES_VOILE = 60_000

/** Le noyau occupe tout ce qui est en deçà de ce rayon : le voile commence après. */
const RAYON_NOYAU_EVITE = 3.2
/** Le voile s'arrête sous le cortex, que le cytosquelette occupe déjà. */
const RAYON_VOILE_MAX = 9.6

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
 * Le ribosome doit garder ses deux sous-unités dans UNE instance. Les
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
 * Volume intérieur d'un maillage fermé, en µm³.
 *
 * Somme des volumes signés des tétraèdres (origine, v₀, v₁, v₂) : exact pour
 * tout polyèdre fermé, quelle que soit sa position. C'est la seule façon de
 * connaître le volume RÉELLEMENT semé, plutôt que celui qu'on croit semer.
 */
function volumeDeGeometrie(geometrie: THREE.BufferGeometry): number {
  const plate = geometrie.index ? geometrie.toNonIndexed() : geometrie
  const p = plate.getAttribute('position')
  let six = 0
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i), ay = p.getY(i), az = p.getZ(i)
    const bx = p.getX(i + 1), by = p.getY(i + 1), bz = p.getZ(i + 1)
    const cx = p.getX(i + 2), cy = p.getY(i + 2), cz = p.getZ(i + 2)
    six += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
  }
  return Math.abs(six) / 6
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
      // Fermé aux deux bouts : les capsules sont invisibles à 8 nm, et un
      // maillage ouvert n'a pas de volume calculable — or c'est son volume qui
      // décide de la taille de la boîte.
      geometrie: new THREE.CylinderGeometry(0.0012, 0.0012, 0.008, 5, 1, false),
      teinte: desaturer(TEINTES.vesicule),
      part: 0.02,
    },
  ]
}

/**
 * L'ARÊTE DE LA BOÎTE EST DÉDUITE, PAS CHOISIE.
 *
 * C'était le défaut le plus grave du produit, et il portait sur son unique
 * affirmation de vérité. Le budget d'instances était calculé avec
 * `VOLUME_COMPLEXE_NM3` — 2 750 nm³, le volume d'un ribosome — alors que le
 * peuplement livré est fait à 55 % de grains de 5 nm, qui en occupent 21. Le
 * volume moyen réel est de 432 nm³, six fois moins : la boîte annonçait 25 %
 * d'occupation pour **3,9 % mesurés**.
 *
 * On pèse donc ce qu'on sème, et on en déduit l'arête. La spec disait déjà quoi
 * faire dans ce cas : « quand le budget manque, on rétrécit la dalle, jamais sa
 * densité ». Changer la taille ou la proportion d'une famille redimensionne
 * désormais la boîte pour qu'elle reste honnête, au lieu de rendre son texte
 * faux en silence.
 */
const FAMILLES = creerFamilles()
/** Volume moyen d'un objet du peuplement, en nm³ (1 µm³ = 10⁹ nm³). */
const VOLUME_MOYEN_NM3 = volumeMoyenPondere(
  FAMILLES.map((f) => ({ part: f.part, volumeNm3: volumeDeGeometrie(f.geometrie) * 1e9 })),
)
/**
 * ET C'EST UNE DALLE, PAS UN CUBE.
 *
 * Le corollaire de D7 que le lot 0 avait mesuré et que le produit n'appliquait
 * pas : « il faut une dalle à profondeur bornée, pas un volume ». La raison est
 * physique — au-delà de la première couche, plus de 99 % des instances sont
 * occultées par celles de devant. Le budget part alors en objets que personne
 * ne voit, et l'arête tenable s'en trouve limitée par le remplissage plutôt que
 * par la surface lisible.
 *
 * Au même budget de 157 000 objets et à la même densité vraie, la dalle porte
 * **1 165 nm de côté** là où le cube plafonnait à 647. C'est presque deux fois
 * plus de cytoplasme à densité vraie sous les yeux de l'étudiant, sans qu'une
 * seule instance de plus soit dessinée.
 *
 * La PROFONDEUR est choisie, et une seule fois : deux cents nanomètres, soit
 * l'ordre d'épaisseur d'une coupe épaisse de microscopie électronique. C'est
 * l'objet réel auquel la boîte ressemble, et ce n'est pas un hasard — une coupe
 * est justement ce qu'on obtient quand on veut voir un cytoplasme dense sans
 * que tout se superpose.
 */
const PROFONDEUR_DALLE_NM = 200
const PROFONDEUR_DALLE = PROFONDEUR_DALLE_NM / 1000
/** Côté latéral, en micromètres, qui fait vraiment 25 % d'occupation. */
const ARETE_BOITE =
  areteTenable(INSTANCES_BOITE, PROFONDEUR_DALLE_NM, OCCUPATION_CYTOSOL, VOLUME_MOYEN_NM3) / 1000
const DEMI_BOITE = ARETE_BOITE / 2
const DEMI_PROFONDEUR = PROFONDEUR_DALLE / 2

/**
 * L'axe mince de la dalle, en coordonnées monde.
 *
 * Il pointe vers la caméra à sa position par défaut : on arrive donc sur la
 * dalle de face, et c'est en la faisant tourner qu'on découvre que c'en est
 * une. Un axe quelconque donnerait une tranche vue de profil, c'est-à-dire un
 * trait.
 */
export const NORMALE_DALLE = new THREE.Vector3(0.18, 0.32, 0.93).normalize()

/** Repère de la dalle : Z local le long de son épaisseur. */
const REPERE_DALLE = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  NORMALE_DALLE,
)

/** Point quelconque dans la dalle, en repère local. */
function placerDansBoite(alea: () => number, cible: THREE.Vector3): void {
  cible.set(
    (alea() - 0.5) * ARETE_BOITE,
    (alea() - 0.5) * ARETE_BOITE,
    (alea() - 0.5) * PROFONDEUR_DALLE,
  )
}

const _localBoite = new THREE.Vector3()
const _repereInverse = REPERE_DALLE.clone().invert()

/** Vrai si le point tombe dans la dalle, en coordonnées monde. */
function dansLaBoite(point: THREE.Vector3): boolean {
  _localBoite.copy(point).sub(CENTRE_BOITE).applyQuaternion(_repereInverse)
  return (
    Math.abs(_localBoite.x) < DEMI_BOITE &&
    Math.abs(_localBoite.y) < DEMI_BOITE &&
    Math.abs(_localBoite.z) < DEMI_PROFONDEUR
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
  const familles = FAMILLES

  const boite = new THREE.Group()
  boite.name = 'boite-de-verite'
  boite.position.copy(CENTRE_BOITE)
  boite.quaternion.copy(REPERE_DALLE)
  boite.add(...semer(familles, INSTANCES_BOITE, alea, placerDansBoite))
  // Le liseré de boîte a été retiré : un cube filaire flottant dans le cytoplasme
  // ne ressemble à rien de biologique, et cette page doit montrer la cellule, pas
  // un schéma d'elle. Ce que le liseré déclarait — l'endroit où la densité est
  // exacte — est désormais dit dans la fiche et nulle part ailleurs.

  // Cible de survol de la région : un cube que le raycaster voit et que le
  // rendu ignore. Sans lui la boîte ne serait désignable que par ses arêtes de
  // 4 nm, impossibles à viser.
  const cible = new THREE.Mesh(
    new THREE.BoxGeometry(ARETE_BOITE, ARETE_BOITE, PROFONDEUR_DALLE),
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
        `Dans cette dalle de ${(ARETE_BOITE * 1000).toFixed(0)} nm de côté sur ` +
        `${PROFONDEUR_DALLE_NM} nm d'épaisseur — l'ordre d'une coupe épaisse de microscopie ` +
        "électronique —, et nulle part ailleurs dans cette " +
        "cellule, l'encombrement est celui de la biologie : 157 000 protéines, " +
        'complexes, ribosomes et ARN, tous dessinés à leur taille vraie, du grain ' +
        'de 5 nm au ribosome de 25 nm. Une protéine ne traverse jamais un tel ' +
        "milieu en ligne droite ; elle rebondit sur ses voisines, et c'est " +
        'pourquoi la GFP y diffuse trois fois plus lentement que dans l’eau. ' +
        "Cette densité ne peut pas être tenue partout : à l'échelle de la cellule " +
        "entière il faudrait des centaines de millions d'objets, contre les deux " +
        'cent mille que la carte graphique dessine à 60 images par seconde. Si cette région ' +
        "est une dalle et non un cube, c'est pour cette raison : au-delà de la première " +
        "couche, plus de 99 % des objets sont cachés par ceux de devant. Borner l'épaisseur " +
        'rend donc visible presque deux fois plus de cytoplasme, au même budget. ' +
        "Partout ailleurs dans cette cellule, le cytosol est éclairci d'environ " +
        'trois ordres de grandeur : le grain que vous y voyez est un ' +
        "échantillon, pas un inventaire.",
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
      objet: voile,
      ancre: new THREE.Vector3(-6.2, 3.6, -2.4),
      couleur: desaturer(TEINTES.golgi),
    },
  ]
}
