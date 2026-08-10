import * as THREE from 'three'
import {
  creerAlea,
  materiauOrganite,
  pointDansCoquille,
  TEINTES,
  UM,
  type Organite,
  CENTRE_NOYAU,
  RAYON_NOYAU,
  SITES_PORES_ENVELOPPE,
} from '../contrat.js'

/**
 * Le noyau : enveloppe à deux membranes, pores, chromatine, nucléole.
 *
 * Tout est à l'échelle vraie. Le noyau fait 6 µm pour une cellule de 20 : c'est
 * la pièce la plus grosse et elle doit se lire comme telle. Sa signature
 * visuelle n'est pas la sphère bleue — n'importe quelle vésicule en est une —
 * mais le semis d'anneaux qui criblent sa surface et l'enchevêtrement de fibres
 * qui la remplit.
 */

/** Position et taille du noyau : `contrat.ts` en est la source unique. */
const CENTRE = CENTRE_NOYAU
/** Espace périnucléaire réel : 20 à 40 nm entre les deux membranes. */
const ESPACE_PERINUCLEAIRE = 0.04 * UM
const RAYON_INTERNE = RAYON_NOYAU - ESPACE_PERINUCLEAIRE
/** Les pores sont centrés à mi-épaisseur : l'anneau traverse les deux membranes d'un coup. */
const RAYON_MEDIAN = RAYON_NOYAU - ESPACE_PERINUCLEAIRE / 2

/**
 * Échantillon de pores. Un noyau réel en porte quelques milliers ; on en pose
 * soixante, assez pour que le criblage se lise sans transformer la surface en
 * grillage. Le chiffre vrai est dans la fiche. La valeur vient de la source
 * unique : `poresNucleaires.ts` rejoue la même spirale sur le même nombre.
 */
const NOMBRE_PORES = SITES_PORES_ENVELOPPE
/** Le pore réel fait 100 nm de diamètre externe : rayon 0,035 + tube 0,015. */
const RAYON_ANNEAU_PORE = 0.035
const RAYON_TUBE_PORE = 0.015

const NOMBRE_BRINS = 16
const RAYON_CHROMATINE = 0.035
/** La chromatine occupe le volume sans coller ni à l'enveloppe ni au centre. */
const COQUILLE_MIN = 0.6
const COQUILLE_MAX = 2.7
/** Pas court devant la largeur de la coquille : sans ça le brin traverse le noyau en corde droite. */
const PAS_MIN = 0.5
const PAS_MAX = 0.9
/** Écart angulaire appliqué à la direction à chaque pas : donne le serpentement. */
const SINUOSITE = 0.75

const RAYON_NUCLEOLE = 0.8
/**
 * Décentré, et entièrement derrière le plan de coupe.
 *
 * Le retrait doit dépasser le rayon relief compris (0,832) : un nucléole à
 * cheval sur la coupe serait creusé, et comme rien ne bouche une géométrie
 * tranchée on verrait son intérieur en cratère au lieu d'une masse dense.
 */
const CENTRE_NUCLEOLE = new THREE.Vector3(0.95, -0.75, -0.95)
/** Marge de dégagement autour du nucléole : les brins le contournent au lieu d'en sortir. */
const DEGAGEMENT_NUCLEOLE = 0.15

const ANGLE_OR = Math.PI * (3 - Math.sqrt(5))
/** Un tore est dessiné dans le plan XY : son axe est +Z. */
const AXE_TORE = new THREE.Vector3(0, 0, 1)

// Objets de travail hissés au niveau du module : aucune allocation dans les boucles.
const _normale = new THREE.Vector3()
const _centre = new THREE.Vector3()
const _rotation = new THREE.Quaternion()
const _taille = new THREE.Vector3(1, 1, 1)
const _matrice = new THREE.Matrix4()
const _sommet = new THREE.Vector3()
const _radial = new THREE.Vector3()
const _ecart = new THREE.Vector3()

/**
 * Relief du nucléole : ±1 en sortie, fonction PURE de la position.
 *
 * IcosahedronGeometry n'est pas indexée — chaque sommet partagé existe en
 * plusieurs exemplaires. Un tirage aléatoire par sommet les séparerait et
 * fissurerait la surface. Une somme de sinusoïdes donne la même valeur pour
 * deux copies du même point, et ses basses fréquences produisent des bosses
 * plutôt qu'un grain de papier de verre.
 */
function relief(p: THREE.Vector3): number {
  return (
    0.6 * Math.sin(p.x * 4.1 + 0.7) * Math.sin(p.y * 3.7 + 1.9) * Math.sin(p.z * 4.3 + 2.4) +
    0.4 * Math.sin(p.x * 7.9 + 2.1) * Math.sin(p.y * 8.3 + 0.3) * Math.sin(p.z * 7.1 + 1.1)
  )
}

/** Anneaux de pores répartis sur toute la sphère, chacun perpendiculaire à la surface. */
function creerPores(): THREE.InstancedMesh {
  const pores = new THREE.InstancedMesh(
    new THREE.TorusGeometry(RAYON_ANNEAU_PORE, RAYON_TUBE_PORE, 8, 16),
    materiauOrganite(TEINTES.proteineMembranaire),
    NOMBRE_PORES,
  )
  for (let i = 0; i < NOMBRE_PORES; i++) {
    // Spirale de Fibonacci sur la sphère entière : la coupe en emporte la
    // moitié, et c'est le comportement juste d'un écorché.
    const hauteur = 1 - ((i + 0.5) * 2) / NOMBRE_PORES
    const rayonAnneau = Math.sqrt(1 - hauteur * hauteur)
    const azimut = i * ANGLE_OR
    _normale.set(Math.cos(azimut) * rayonAnneau, hauteur, Math.sin(azimut) * rayonAnneau)
    _rotation.setFromUnitVectors(AXE_TORE, _normale)
    _centre.copy(_normale).multiplyScalar(RAYON_MEDIAN)
    _matrice.compose(_centre, _rotation, _taille)
    pores.setMatrixAt(i, _matrice)
  }
  // La géométrie d'un pore ne mesure que 0,1 µm : sans ce recalcul, le tronc de
  // vision juge les soixante instances sur une bulle grosse comme un seul anneau.
  pores.computeBoundingSphere()
  return pores
}

/**
 * Un brin de chromatine : marche au hasard à pas courts dans la coquille,
 * repliée vers l'intérieur dès qu'elle en sort.
 *
 * Des points tirés indépendamment donneraient des cordes traversant le noyau de
 * part en part — une étoile, pas une pelote. La continuité de la marche est ce
 * qui fait lire une fibre.
 */
function tracerBrin(alea: () => number): THREE.Vector3[] {
  const nombrePoints = 8 + Math.floor(alea() * 5)
  const position = pointDansCoquille(alea, COQUILLE_MIN, COQUILLE_MAX, new THREE.Vector3())
  const direction = new THREE.Vector3(alea() * 2 - 1, alea() * 2 - 1, alea() * 2 - 1).normalize()
  const points: THREE.Vector3[] = []

  for (let i = 0; i < nombrePoints; i++) {
    points.push(position.clone())

    direction
      .set(
        direction.x + (alea() * 2 - 1) * SINUOSITE,
        direction.y + (alea() * 2 - 1) * SINUOSITE,
        direction.z + (alea() * 2 - 1) * SINUOSITE,
      )
      .normalize()
    const pas = PAS_MIN + alea() * (PAS_MAX - PAS_MIN)
    position.addScaledVector(direction, pas)

    const rayon = position.length()
    if (rayon > COQUILLE_MAX || rayon < COQUILLE_MIN) {
      // Rebond sur la coquille : on annule le pas, on renverse la composante
      // radiale de la direction, on rejoue le pas.
      position.addScaledVector(direction, -pas)
      _radial.copy(position).normalize()
      direction.reflect(_radial).normalize()
      position.addScaledVector(direction, pas)
    }

    // Le nucléole est opaque : un brin qui le traverse en ressortirait
    // brutalement au niveau de la coupe.
    _ecart.subVectors(position, CENTRE_NUCLEOLE)
    const distance = _ecart.length()
    const degagement = RAYON_NUCLEOLE + DEGAGEMENT_NUCLEOLE
    if (distance < degagement) {
      position.copy(CENTRE_NUCLEOLE).addScaledVector(_ecart.divideScalar(distance), degagement)
    }
  }
  return points
}

/** Sphère dense à surface bosselée : le nucléole ne se confond pas avec une vésicule lisse. */
function creerNucleole(): THREE.Mesh {
  const geometrie = new THREE.IcosahedronGeometry(RAYON_NUCLEOLE, 3)
  const sommets = geometrie.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < sommets.count; i++) {
    _sommet.fromBufferAttribute(sommets, i)
    // La sphère est centrée sur l'origine : la normale est la position normalisée,
    // donc un facteur d'échelle suffit à déplacer le sommet le long de sa normale.
    _sommet.multiplyScalar(1 + 0.04 * relief(_sommet))
    sommets.setXYZ(i, _sommet.x, _sommet.y, _sommet.z)
  }
  sommets.needsUpdate = true
  geometrie.computeVertexNormals()

  const nucleole = new THREE.Mesh(geometrie, materiauOrganite(TEINTES.nucleole))
  nucleole.position.copy(CENTRE_NUCLEOLE)
  nucleole.name = 'nucleole'
  return nucleole
}

export function creerNoyau(): Organite[] {
  const groupe = new THREE.Group()
  groupe.name = 'noyau'
  groupe.position.copy(CENTRE)

  // Enveloppe à double membrane. Translucide : on doit deviner la chromatine à
  // travers la moitié conservée, sinon le noyau redevient une bille pleine.
  const matiereEnveloppe = materiauOrganite(TEINTES.membraneNucleaire, { opacite: 0.55 })
  const enveloppe = new THREE.Group()
  enveloppe.name = 'enveloppe-nucleaire'
  enveloppe.add(
    new THREE.Mesh(new THREE.SphereGeometry(RAYON_NOYAU, 64, 48), matiereEnveloppe),
    new THREE.Mesh(new THREE.SphereGeometry(RAYON_INTERNE, 64, 48), matiereEnveloppe),
  )
  groupe.add(enveloppe)

  groupe.add(creerPores())

  const alea = creerAlea(0x4e4f5941)
  const matiereChromatine = materiauOrganite(TEINTES.chromatine)
  const chromatine = new THREE.Group()
  chromatine.name = 'chromatine'
  for (let i = 0; i < NOMBRE_BRINS; i++) {
    const points = tracerBrin(alea)
    // Courbe centripète : elle ne fait pas de boucle parasite quand deux points
    // consécutifs se rapprochent, ce que la marche produit régulièrement.
    const courbe = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    chromatine.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(courbe, points.length * 8, RAYON_CHROMATINE, 6, false),
        matiereChromatine,
      ),
    )
  }
  groupe.add(chromatine)

  groupe.add(creerNucleole())

  return [
    {
      cle: 'noyau',
      nom: 'Noyau',
      role: "Conserve l'ADN et gouverne la cellule en exportant ses ARN messagers.",
      description:
        "Le noyau met les chromosomes à l'abri du cytoplasme derrière une enveloppe " +
        'faite de deux membranes accolées, séparées par un espace de quarante ' +
        'nanomètres. Rien ne franchit cette double paroi ailleurs que par les pores ' +
        'nucléaires, des anneaux de protéines qui percent les deux membranes à la ' +
        "fois et filtrent le trafic dans les deux sens. À l'intérieur, la chromatine " +
        "remplit tout le volume : c'est l'ADN enroulé sur des protéines, relâché là " +
        "où les gènes se lisent, compacté ailleurs. La masse dense qu'on aperçoit " +
        "dedans est le nucléole, l'atelier où les ribosomes sont assemblés avant de " +
        'sortir travailler dans le cytoplasme.',
      objet: groupe,
      // Ancre en coordonnées monde, posée au-dessus du noyau et du côté conservé
      // par la coupe pour que le trait d'étiquette ne parte pas d'un vide.
      ancre: CENTRE.clone().add(new THREE.Vector3(0, RAYON_NOYAU + 0.4, -0.8)),
      couleur: TEINTES.noyau,
    },
  ]
}
