/**
 * Ce qui remplit les volumes : matrice mitochondriale et grain du cytosol.
 *
 * Une mitochondrie dessinée comme des crêtes flottant dans du vide est un
 * mensonge d'atlas. La matrice est l'un des compartiments les plus concentrés
 * de la cellule — de l'ordre de 500 g de protéines par litre, une pâte plus
 * qu'une solution. Même chose dehors : le cytosol n'est pas de l'eau, c'est un
 * gel où la GFP diffuse trois fois moins vite que dans un tampon, et le semis
 * de ribosomes libres en est la texture la plus reconnaissable.
 *
 * Ce module n'ajoute que du contenu : il ne touche ni aux capsules des
 * mitochondries ni au réticulum, qui vivent dans leurs propres fichiers.
 */
import * as THREE from 'three'
import {
  TEINTES,
  creerAlea,
  materiauOrganite,
  pointDansCoquille,
  type Organite,
} from '../contrat.js'

/* ------------------------------------------------------------------------- */
/* Recalage sur les capsules existantes                                       */
/* ------------------------------------------------------------------------- */

/**
 * ⚠️ Les six repères ci-dessous sont RECONSTRUITS, pas lus.
 *
 * `mitochondries.ts` ne publie pas les positions de ses capsules : chaque
 * exemplaire est un `Group` anonyme dans son propre `Organite`. On rejoue donc
 * la même graine et, surtout, la même SÉQUENCE de tirages — y compris les
 * tirages qu'on n'utilise pas (phase du profil, crêtes), car c'est leur
 * consommation qui maintient le générateur en phase. Un tirage oublié et tous
 * les exemplaires suivants sont décalés.
 *
 * Conséquence : toute modification de `mitochondries.ts` qui change le nombre
 * ou l'ordre de ses appels à `alea()` désaligne ce module en silence. La marge
 * de sécurité du remplissage (voir PORTEE_MATRICE) est là pour ça — un léger
 * décalage laisse le contenu dedans, il ne le vide pas dans le cytoplasme.
 */
const NOMBRE_MITOCHONDRIES = 6
const GRAINE_CAPSULES = 31_415
/** Grand axe local d'une capsule, tel que `mitochondries.ts` le pose. */
const AXE_LONG = new THREE.Vector3(0, 1, 0)
/** Tirages consommés par crête dans `creerCretes` : jeu, décalage, diamètre, z, deux angles. */
const TIRAGES_PAR_CRETE = 6

const GRAINE_CONTENU = 27_182
const GRAINE_RIBOSOMES = 16_180

/* ------------------------------------------------------------------------- */
/* Matrice mitochondriale                                                     */
/* ------------------------------------------------------------------------- */

const ENZYMES_PAR_MITOCHONDRIE = 2_500
/** Une enzyme moyenne fait une douzaine de nanomètres de diamètre. */
const RAYON_ENZYME = 0.006
const GRANULES_PAR_MITOCHONDRIE = 90
/** Les granules denses stockent le calcium : 30 à 50 nm, bien plus gros. */
const RAYON_GRANULE = 0.018
const NUCLEOIDES_PAR_MITOCHONDRIE = 3
const RAYON_TUBE_NUCLEOIDE = 0.004
const ENVERGURE_NUCLEOIDE = 0.12
/** Sept points de contrôle : assez pour une pelote emmêlée, pas pour un plat de nouilles. */
const POINTS_NUCLEOIDE = 7
const SEGMENTS_NUCLEOIDE = 48

/**
 * Enveloppe de remplissage, en coordonnées locales de la capsule.
 *
 * Un ellipsoïde de demi-axes (0,25 ; 0,55 ; 0,25) : aucun point n'est à plus de
 * 0,55 µm du centre, et le rayon reste sous les 0,30 µm auxquels la membrane
 * interne se resserre au plus étroit (0,35 × 0,93 de renflement × 0,93 d'écart
 * intermembranaire). Le compartiment vrai est plus long — on renonce aux pôles
 * en échange d'une tolérance au décalage.
 */
const PORTEE_MATRICE = 0.55
const RAYON_MATRICE = 0.25
const APLATISSEMENT = RAYON_MATRICE / PORTEE_MATRICE

/* ------------------------------------------------------------------------- */
/* Ribosomes libres du cytosol                                                */
/* ------------------------------------------------------------------------- */

const NOMBRE_RIBOSOMES = 9_000
/** Un ribosome fait 25 à 30 nm : la grande sous-unité en porte les deux tiers. */
const RAYON_GRANDE_SOUS_UNITE = 0.0125
const RAYON_PETITE_SOUS_UNITE = 0.009
/**
 * Écart entre les deux centres. Somme des rayons = 0,0215 : à cette distance
 * les sphères se touchent et donnent un bonhomme de neige. Les sous-unités
 * réelles sont emboîtées — on les fait s'interpénétrer pour retrouver la
 * silhouette bilobée d'un seul corps.
 */
const ECART_SOUS_UNITES = 0.014
/** Coquille cytosolique : au large du noyau, en retrait de la membrane. */
const COQUILLE_MIN = 3.6
const COQUILLE_MAX = 9.4
/**
 * Recopiés de `noyau.ts`, qui les garde privés : le noyau est décentré, si bien
 * qu'il déborde jusqu'à 4,1 µm du centre et mord franchement dans la coquille.
 * Le rayon d'exclusion ajoute de quoi passer au large des anneaux de pores.
 */
const CENTRE_NOYAU = new THREE.Vector3(-1, 0.5, 0)
const RAYON_EXCLUSION_NOYAU = 3.15
/** Au-delà, on repousse au lieu de retirer : la boucle se termine toujours. */
const TIRAGES_MAX = 24

/**
 * Ancre de l'étiquette du cytosol, du côté que l'écorché conserve (z négatif).
 */
const ANCRE_RIBOSOMES = new THREE.Vector3(4.4, 2.8, -4.6)

/* ------------------------------------------------------------------------- */
/* Teintes dérivées                                                           */
/* ------------------------------------------------------------------------- */

const _teinte = new THREE.Color()
const BLANC = new THREE.Color(0xffffff)
const NOIR = new THREE.Color(0x000000)

/** Nuance d'une teinte de famille sans en changer : la famille reste lisible. */
function nuancer(couleur: number, vers: THREE.Color, part: number): number {
  return _teinte.setHex(couleur).lerp(vers, part).getHex()
}

/** Les enzymes sont éclaircies : elles se détachent des crêtes qu'elles entourent. */
const TEINTE_ENZYME = nuancer(TEINTES.mitochondrieCrete, BLANC, 0.38)
/** Les granules de calcium sont assombris — en microscopie ils sont noirs. */
const TEINTE_GRANULE = nuancer(TEINTES.mitochondrieCrete, NOIR, 0.45)
/** Deuxième lobe à peine plus clair : même famille, silhouette lisible. */
const TEINTE_PETITE_SOUS_UNITE = nuancer(TEINTES.ribosome, BLANC, 0.2)

/* ------------------------------------------------------------------------- */
/* Temporaires hissés au module : rien ne s'alloue dans les boucles           */
/* ------------------------------------------------------------------------- */

const _local = new THREE.Vector3()
const _monde = new THREE.Vector3()
const _direction = new THREE.Vector3()
const _matrice = new THREE.Matrix4()
const _pivot = new THREE.Object3D()

/** Position et orientation d'une capsule, en coordonnées monde. */
interface RepereCapsule {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

/**
 * Rejoue tirage pour tirage la boucle de `creerMitochondries`, et n'en retient
 * que le placement. Les valeurs jetées ne sont pas du gaspillage : elles sont
 * le mécanisme du recalage.
 */
function reconstruireCapsules(): RepereCapsule[] {
  const alea = creerAlea(GRAINE_CAPSULES)
  const reperes: RepereCapsule[] = []

  for (let index = 0; index < NOMBRE_MITOCHONDRIES; index++) {
    alea() // phase du profil de révolution
    const nombreCretes = 8 + Math.floor(alea() * 5)
    for (let tirage = 0; tirage < nombreCretes * TIRAGES_PAR_CRETE; tirage++) alea()

    const position = pointDansCoquille(alea, 4, 8.5, new THREE.Vector3())
    // Même rabattement que dans `mitochondries.ts` : tout du côté ouvert.
    position.z = -Math.abs(position.z)

    // On repasse par l'API de Three plutôt que de composer la rotation à la
    // main : `rotateY` est une multiplication à droite, et un signe inversé
    // ferait tourner le contenu à l'envers dans sa capsule sans rien casser.
    // Le pivot est réutilisé d'un tour à l'autre sans remise à zéro, et c'est
    // sûr : `setFromUnitVectors` écrase le quaternion au lieu de l'accumuler.
    pointDansCoquille(alea, 1, 1, _direction).normalize()
    _pivot.quaternion.setFromUnitVectors(AXE_LONG, _direction)
    _pivot.rotateY(alea() * Math.PI * 2)

    reperes.push({ position, quaternion: _pivot.quaternion.clone() })
  }

  return reperes
}

/** Tire un point dans l'ellipsoïde de remplissage, en coordonnées locales. */
function pointDansMatrice(alea: () => number, portee: number): THREE.Vector3 {
  pointDansCoquille(alea, 0, portee, _local)
  _local.x *= APLATISSEMENT
  _local.z *= APLATISSEMENT
  return _local
}

/** Une pelote fermée de sept points : l'ADN mitochondrial est circulaire. */
function courbeNucleoide(alea: () => number): THREE.CatmullRomCurve3 {
  const points: THREE.Vector3[] = []
  for (let i = 0; i < POINTS_NUCLEOIDE; i++) {
    points.push(pointDansCoquille(alea, 0, ENVERGURE_NUCLEOIDE / 2))
  }
  return new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5)
}

function creerMatriceMitochondriale(): Organite {
  const reperes = reconstruireCapsules()
  const alea = creerAlea(GRAINE_CONTENU)
  const groupe = new THREE.Group()

  // Une seule géométrie par famille, une seule instanciée pour les six capsules :
  // le contenu est posé en coordonnées monde, pas parenté aux capsules.
  const enzymes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_ENZYME, 0),
    materiauOrganite(TEINTE_ENZYME, { doubleFace: false }),
    NOMBRE_MITOCHONDRIES * ENZYMES_PAR_MITOCHONDRIE,
  )
  const granules = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_GRANULE, 1),
    materiauOrganite(TEINTE_GRANULE, { doubleFace: false }),
    NOMBRE_MITOCHONDRIES * GRANULES_PAR_MITOCHONDRIE,
  )
  // L'ADN garde la teinte de la chromatine : la couleur code la famille, et une
  // pelote d'ADN dans une mitochondrie se lit alors du premier coup d'œil.
  const materiauNucleoide = materiauOrganite(TEINTES.chromatine)

  let compteurEnzymes = 0
  let compteurGranules = 0

  for (const repere of reperes) {
    for (let i = 0; i < ENZYMES_PAR_MITOCHONDRIE; i++) {
      _monde.copy(pointDansMatrice(alea, PORTEE_MATRICE))
      _monde.applyQuaternion(repere.quaternion).add(repere.position)
      enzymes.setMatrixAt(compteurEnzymes++, _matrice.makeTranslation(_monde.x, _monde.y, _monde.z))
    }

    for (let i = 0; i < GRANULES_PAR_MITOCHONDRIE; i++) {
      _monde.copy(pointDansMatrice(alea, PORTEE_MATRICE))
      _monde.applyQuaternion(repere.quaternion).add(repere.position)
      granules.setMatrixAt(
        compteurGranules++,
        _matrice.makeTranslation(_monde.x, _monde.y, _monde.z),
      )
    }

    for (let i = 0; i < NUCLEOIDES_PAR_MITOCHONDRIE; i++) {
      // Portée réduite de la demi-envergure : la pelote entière reste dedans.
      _monde.copy(pointDansMatrice(alea, PORTEE_MATRICE - ENVERGURE_NUCLEOIDE))
      _monde.applyQuaternion(repere.quaternion).add(repere.position)

      const pelote = new THREE.Mesh(
        new THREE.TubeGeometry(
          courbeNucleoide(alea),
          SEGMENTS_NUCLEOIDE,
          RAYON_TUBE_NUCLEOIDE,
          5,
          true,
        ),
        materiauNucleoide,
      )
      pelote.position.copy(_monde)
      pelote.quaternion.copy(repere.quaternion)
      groupe.add(pelote)
    }
  }

  enzymes.instanceMatrix.needsUpdate = true
  granules.instanceMatrix.needsUpdate = true
  groupe.add(enzymes, granules)
  groupe.name = 'matrice-mitochondriale'

  // On étiquette la capsule la plus enfoncée en z : c'est celle que l'écorché
  // dégage le plus longtemps quand la coupe s'ouvre.
  let vitrine = reperes[0]!
  for (const repere of reperes) if (repere.position.z < vitrine.position.z) vitrine = repere
  // Décalage sur l'axe court, à 0,5 µm : juste au large de la membrane externe.
  const ancre = new THREE.Vector3(0.5, 0, 0)
    .applyQuaternion(vitrine.quaternion)
    .add(vitrine.position)

  return {
    cle: 'matrice-mitochondriale',
    nom: 'Matrice mitochondriale',
    role: "Le compartiment le plus concentré de la cellule, entre les crêtes.",
    description:
      "Entre les crêtes il n'y a pas de vide : la matrice est une pâte d'enzymes " +
      'où se déroule le cycle de Krebs, qui démonte les nutriments et charge les ' +
      'transporteurs alimentant la chaîne respiratoire. On y voit aussi des ' +
      'granules denses de calcium, réserve tampon de la cellule, et surtout des ' +
      "nucléoïdes : la mitochondrie possède son propre ADN, circulaire comme celui " +
      "d'une bactérie, souvenir de l'organisme libre qu'elle a été. Cet ADN ne vient " +
      'que de la mère, ce qui en fait la trace la plus lisible des lignées humaines.',
    objet: groupe,
    ancre,
    couleur: TEINTES.mitochondrieCrete,
  }
}

function creerRibosomesLibres(): Organite {
  const alea = creerAlea(GRAINE_RIBOSOMES)
  const groupe = new THREE.Group()

  const grandes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_GRANDE_SOUS_UNITE, 0),
    materiauOrganite(TEINTES.ribosome, { doubleFace: false }),
    NOMBRE_RIBOSOMES,
  )
  const petites = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_PETITE_SOUS_UNITE, 0),
    materiauOrganite(TEINTE_PETITE_SOUS_UNITE, { doubleFace: false }),
    NOMBRE_RIBOSOMES,
  )

  for (let i = 0; i < NOMBRE_RIBOSOMES; i++) {
    pointDansCoquille(alea, COQUILLE_MIN, COQUILLE_MAX, _monde)
    for (
      let essai = 0;
      essai < TIRAGES_MAX && _monde.distanceTo(CENTRE_NOYAU) < RAYON_EXCLUSION_NOYAU;
      essai++
    ) {
      pointDansCoquille(alea, COQUILLE_MIN, COQUILLE_MAX, _monde)
    }
    // Filet de sécurité : si le tirage s'obstine, on pousse le point hors du
    // noyau au lieu de le supprimer — le compte d'instances doit rester exact.
    if (_monde.distanceTo(CENTRE_NOYAU) < RAYON_EXCLUSION_NOYAU) {
      _direction.subVectors(_monde, CENTRE_NOYAU).normalize()
      _monde.copy(CENTRE_NOYAU).addScaledVector(_direction, RAYON_EXCLUSION_NOYAU)
    }
    grandes.setMatrixAt(i, _matrice.makeTranslation(_monde.x, _monde.y, _monde.z))

    // Axe propre à chaque ribosome : un axe partagé donnerait neuf mille
    // haltères alignées, que le moindre éclairage rasant trahirait.
    pointDansCoquille(alea, 1, 1, _direction).normalize()
    _monde.addScaledVector(_direction, ECART_SOUS_UNITES)
    petites.setMatrixAt(i, _matrice.makeTranslation(_monde.x, _monde.y, _monde.z))
  }

  grandes.instanceMatrix.needsUpdate = true
  petites.instanceMatrix.needsUpdate = true
  groupe.add(grandes, petites)
  groupe.name = 'ribosomes-libres'

  return {
    cle: 'ribosomes-libres',
    nom: 'Ribosomes libres',
    role: 'Traduisent les ARN messagers en protéines, en plein cytosol.',
    description:
      "Ce semis de grains est ce qui donne au cytoplasme sa texture granuleuse en " +
      'microscopie électronique — le mot « ribosome » vient de là. Chacun est fait ' +
      "de deux sous-unités emboîtées, une grande et une petite, qui se referment sur " +
      "un ARN messager le temps d'assembler une protéine puis se séparent. Ceux-ci " +
      'sont libres : ils fabriquent les protéines qui resteront dans le cytosol, ' +
      'tandis que leurs jumeaux accrochés au réticulum produisent les protéines ' +
      'destinées à être exportées ou insérées dans une membrane.',
    objet: groupe,
    ancre: ANCRE_RIBOSOMES.clone(),
    couleur: TEINTES.ribosome,
  }
}

export function creerMatrices(): Organite[] {
  return [creerMatriceMitochondriale(), creerRibosomesLibres()]
}
