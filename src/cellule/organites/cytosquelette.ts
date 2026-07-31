import * as THREE from 'three'
import {
  creerAlea,
  materiauOrganite,
  pointDansCoquille,
  TEINTES,
  type Organite,
} from '../contrat.js'

/**
 * Cytosquelette et centrosome.
 *
 * C'est la pièce qui empêche le cytoplasme de passer pour de l'eau. Trois
 * échelles cohabitent ici, toutes à leur taille vraie : le microtubule fait
 * 25 nm de diamètre, le filament d'actine 7 nm, et le centriole tient dans
 * 0,4 µm. Rien n'est grossi ; ce qui rend l'image lisible, c'est le nombre de
 * fibres et leur organisation, pas leur épaisseur.
 */

/** Le hasard est figé : la charpente est la même à chaque chargement. */
const GRAINE = 730_731

/** Le noyau occupe le centre de la cellule ; les microtubules le contournent. */
const CENTRE_NOYAU = new THREE.Vector3(0, 0, 0)
const RAYON_EVITEMENT_NOYAU = 3.2

/**
 * Marge ajoutée à la sphère de garde pour les points de contrôle.
 *
 * Une courbe de Catmull-Rom passe par ses points mais s'en écarte entre eux :
 * les poser exactement sur la sphère d'évitement laisserait le tube mordre dans
 * le noyau. Cette marge absorbe le dépassement.
 */
const MARGE_SPLINE = 0.35

/**
 * Le centrosome est collé au noyau, jamais au milieu de la cellule.
 *
 * La direction (1,5 ; 2,2 ; 0) demandée pour le poser tombe à 2,66 µm du
 * centre, c'est-à-dire à l'intérieur même de la sphère de garde de 3,2 µm que
 * les microtubules doivent respecter. On conserve la direction et on remonte le
 * point sur cette sphère : le centrosome reste au contact de l'enveloppe
 * nucléaire sans risquer de s'y enterrer, que le noyau fasse 5 ou 6 µm.
 */
const POSITION_CENTROSOME = new THREE.Vector3(1.5, 2.2, 0)
  .normalize()
  .multiplyScalar(RAYON_EVITEMENT_NOYAU)

const RAYON_MICROTUBULE = 0.0125
const RAYON_ACTINE = 0.0035

/** Barillet du centriole : neuf triplets sur un cercle de 0,1 µm. */
const RAYON_BARILLET = 0.1
const LONGUEUR_CENTRIOLE = 0.4
const RAYON_TUBULE_CENTRIOLE = 0.012
const NOMBRE_TRIPLETS = 9
/** Deux rayons de tubule : les trois microtubules d'un triplet se touchent. */
const ESPACEMENT_TUBULE = 0.025
/** Les triplets penchent en moulinet, c'est ce qui signe la coupe du centriole. */
const INCLINAISON_TRIPLET = 0.6

/** L'actine reprend la teinte du cytosquelette, éclaircie pour distinguer les deux réseaux. */
const TEINTE_ACTINE = new THREE.Color(TEINTES.cytosquelette)
  .lerp(new THREE.Color(0xffffff), 0.3)
  .getHex()

/**
 * Pose des deux centrioles, en repère local du centrosome.
 *
 * Le cylindre de base est dressé sur Y : chaque matrice couche le barillet sur
 * son axe. La fille est perpendiculaire à la mère et posée à son pied, sans la
 * traverser.
 */
const PLACEMENTS_CENTRIOLES: THREE.Matrix4[] = [
  new THREE.Matrix4().makeRotationZ(-Math.PI / 2),
  new THREE.Matrix4()
    .makeRotationX(Math.PI / 2)
    .premultiply(new THREE.Matrix4().makeTranslation(-0.34, 0, 0)),
]

// Objets de travail hissés au niveau du module : aucune allocation par fibre.
const _appui = new THREE.Vector3()
const _base1 = new THREE.Vector3()
const _base2 = new THREE.Vector3()
const _direction = new THREE.Vector3()
const _dirDepart = new THREE.Vector3()
const _dirArrivee = new THREE.Vector3()
const _axeContour = new THREE.Vector3()
const _centre = new THREE.Vector3()
const _normale = new THREE.Vector3()
const _tangente = new THREE.Vector3()
const _bitangente = new THREE.Vector3()
const _radial = new THREE.Vector3()
const _position = new THREE.Vector3()
const _echelle = new THREE.Vector3()
const _matrice = new THREE.Matrix4()

/** Direction unitaire perpendiculaire à `axe`, prise à un angle donné autour de lui. */
function directionPerpendiculaire(
  axe: THREE.Vector3,
  angle: number,
  cible: THREE.Vector3,
): THREE.Vector3 {
  _appui.set(0, 0, 1)
  if (Math.abs(axe.z) > 0.9) _appui.set(1, 0, 0)
  _base1.crossVectors(axe, _appui).normalize()
  _base2.crossVectors(axe, _base1)
  return cible
    .copy(_base1)
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(_base2, Math.sin(angle))
}

/**
 * Aster de microtubules.
 *
 * Chaque tube part du centrosome et file vers le cortex en s'incurvant. Le
 * réseau est convergent : c'est cette convergence, plus que les fibres
 * elles-mêmes, qui rend le centre organisateur lisible.
 *
 * Les points de contrôle ne sont pas posés en ligne droite mais sur un grand
 * cercle centré sur le noyau, avec un rayon qui ne fait que monter. Une corde
 * tendue entre le centrosome et une cible opposée plongerait droit dans le
 * noyau ; l'arc, lui, en épouse la surface, ce que fait aussi le vrai tube.
 */
function creerMicrotubules(alea: () => number): THREE.Group {
  const groupe = new THREE.Group()
  groupe.name = 'microtubules'
  const materiau = materiauOrganite(TEINTES.cytosquelette)
  const nombre = 26 + Math.floor(alea() * 9)

  for (let i = 0; i < nombre; i++) {
    const arrivee = pointDansCoquille(alea, 8.5, 9.5)
    _direction.copy(arrivee).sub(POSITION_CENTROSOME).normalize()
    // Le tube naît en bordure du matériel péricentriolaire, pas au centre exact.
    const depart = POSITION_CENTROSOME.clone().addScaledVector(_direction, 0.11)

    _dirDepart.copy(depart).sub(CENTRE_NOYAU)
    const rayonDepart = _dirDepart.length()
    _dirDepart.divideScalar(rayonDepart)
    _dirArrivee.copy(arrivee).sub(CENTRE_NOYAU)
    const rayonArrivee = _dirArrivee.length()
    _dirArrivee.divideScalar(rayonArrivee)

    const angleLateral = alea() * Math.PI * 2
    const amplitude = 0.3 + alea() * 0.8

    // Plan de contournement. Départ et cible confondus ou opposés : le produit
    // vectoriel s'effondre, n'importe quel plan les contient alors.
    _axeContour.crossVectors(_dirDepart, _dirArrivee)
    if (_axeContour.lengthSq() < 1e-8) {
      directionPerpendiculaire(_dirDepart, angleLateral, _axeContour)
    } else {
      _axeContour.normalize()
    }
    const angleTotal = _dirDepart.angleTo(_dirArrivee)
    const sens = angleLateral < Math.PI ? 1 : -1

    const points: THREE.Vector3[] = [depart]
    for (let j = 1; j <= 3; j++) {
      const t = j / 4
      // Le rayon ne fait que monter, en partant de la sphère de garde où siège
      // le centrosome, et ne descend jamais sous cette sphère élargie de la
      // marge : aucun point de contrôle ne retombe donc dans le noyau, et il n'y
      // a rien à rattraper après coup.
      const rayon = Math.max(
        rayonDepart + (rayonArrivee - rayonDepart) * t,
        RAYON_EVITEMENT_NOYAU + MARGE_SPLINE,
      )
      const point = new THREE.Vector3()
        .copy(_dirDepart)
        .applyAxisAngle(_axeContour, angleTotal * t)
        .multiplyScalar(rayon)
        .add(CENTRE_NOYAU)
      // La courbure se prend hors du plan de contournement, donc perpendiculaire
      // au rayon : elle ne peut qu'éloigner le tube du noyau, jamais l'y ramener.
      point.addScaledVector(_axeContour, sens * Math.sin(Math.PI * t) * amplitude)
      points.push(point)
    }
    points.push(arrivee)

    const courbe = new THREE.CatmullRomCurve3(points)
    const geometrie = new THREE.TubeGeometry(courbe, 36, RAYON_MICROTUBULE, 5, false)
    groupe.add(new THREE.Mesh(geometrie, materiau))
  }

  return groupe
}

/**
 * Filament d'actine de référence, couché sur Y, long d'une unité et à peine arqué.
 *
 * Les instances l'étirent uniquement en longueur : l'épaisseur reste à 7 nm et
 * l'arc garde sa flèche quelle que soit la taille du filament.
 */
function geometrieFilamentActine(): THREE.BufferGeometry {
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= 4; i++) {
    const t = i / 4
    points.push(new THREE.Vector3(Math.sin(t * Math.PI) * 0.05, t - 0.5, 0))
  }
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points),
    12,
    RAYON_ACTINE,
    4,
    false,
  )
}

/**
 * Cortex d'actine : feutrage serré plaqué sous la membrane.
 *
 * Chaque filament est couché dans le plan tangent à la coquille — un filament
 * qui pointerait vers le centre trahirait tout de suite le cortex.
 */
function creerCortexActine(alea: () => number): THREE.InstancedMesh {
  const nombre = 60 + Math.floor(alea() * 31)
  const maillage = new THREE.InstancedMesh(
    geometrieFilamentActine(),
    materiauOrganite(TEINTE_ACTINE),
    nombre,
  )
  maillage.name = 'cortex-actine'

  for (let i = 0; i < nombre; i++) {
    pointDansCoquille(alea, 8.8, 9.7, _centre)
    _normale.copy(_centre).normalize()
    directionPerpendiculaire(_normale, alea() * Math.PI * 2, _tangente)
    // Repère direct : X et Y dans le plan tangent, Z suivant la normale.
    _bitangente.crossVectors(_tangente, _normale)
    _matrice.makeBasis(_bitangente, _tangente, _normale)
    _matrice.scale(_echelle.set(1, 0.8 + alea() * 1.2, 1))
    _matrice.setPosition(_centre)
    maillage.setMatrixAt(i, _matrice)
  }
  maillage.instanceMatrix.needsUpdate = true

  return maillage
}

/**
 * Les deux centrioles, en 54 petits cylindres.
 *
 * Neuf triplets par barillet, chaque triplet incliné en moulinet : la symétrie
 * d'ordre 9 doit se lire d'un coup d'œil dès qu'on regarde le centriole par le bout.
 */
function creerCentrioles(): THREE.InstancedMesh {
  const geometrie = new THREE.CylinderGeometry(
    RAYON_TUBULE_CENTRIOLE,
    RAYON_TUBULE_CENTRIOLE,
    LONGUEUR_CENTRIOLE,
    6,
    1,
  )
  const maillage = new THREE.InstancedMesh(
    geometrie,
    materiauOrganite(TEINTES.centriole),
    PLACEMENTS_CENTRIOLES.length * NOMBRE_TRIPLETS * 3,
  )
  maillage.name = 'centrioles'

  let index = 0
  for (const placement of PLACEMENTS_CENTRIOLES) {
    for (let triplet = 0; triplet < NOMBRE_TRIPLETS; triplet++) {
      const angle = (triplet / NOMBRE_TRIPLETS) * Math.PI * 2
      _radial.set(Math.cos(angle), 0, Math.sin(angle))
      _tangente.set(-Math.sin(angle), 0, Math.cos(angle))
      _direction
        .copy(_tangente)
        .multiplyScalar(Math.cos(INCLINAISON_TRIPLET))
        .addScaledVector(_radial, -Math.sin(INCLINAISON_TRIPLET))

      for (let tubule = -1; tubule <= 1; tubule++) {
        _position
          .copy(_radial)
          .multiplyScalar(RAYON_BARILLET)
          .addScaledVector(_direction, tubule * ESPACEMENT_TUBULE)
        _matrice
          .makeTranslation(_position.x, _position.y, _position.z)
          .premultiply(placement)
        maillage.setMatrixAt(index, _matrice)
        index += 1
      }
    }
  }
  maillage.instanceMatrix.needsUpdate = true

  return maillage
}

export function creerCytosquelette(): Organite[] {
  const alea = creerAlea(GRAINE)

  const reseau = new THREE.Group()
  reseau.name = 'cytosquelette'
  reseau.add(creerMicrotubules(alea))
  reseau.add(creerCortexActine(alea))

  const centrosome = new THREE.Group()
  centrosome.name = 'centrosome'
  centrosome.position.copy(POSITION_CENTROSOME)
  centrosome.add(creerCentrioles())

  return [
    {
      cle: 'cytosquelette',
      nom: 'Cytosquelette',
      role: 'Charpente dynamique : elle tient la forme de la cellule et sert de rails au transport interne.',
      description:
        "Des réseaux de fibres protéiques traversent tout le cytoplasme et lui donnent sa tenue : sans eux, la cellule s'affaisserait comme une poche d'eau. Les microtubules, les plus épais, rayonnent du centrosome vers la périphérie et servent de rails aux moteurs moléculaires qui déplacent vésicules et chromosomes. Sous la membrane, un feutrage serré de filaments d'actine — le cortex — fixe la forme de la surface et permet à la cellule de ramper, de se contracter et de se diviser. L'ensemble se démonte et se reconstruit sans arrêt : c'est une charpente qui se réinvente en quelques minutes.",
      chiffres: [
        { valeur: '25 nm', quoi: "diamètre d'un microtubule" },
        { valeur: '7 nm', quoi: "diamètre d'un filament d'actine" },
        {
          valeur: '≈ 1 µm/min',
          quoi: 'vitesse à laquelle un microtubule pousse ou se raccourcit',
        },
      ],
      objet: reseau,
      ancre: new THREE.Vector3(-4.6, 5.9, -3.4),
      couleur: TEINTES.cytosquelette,
    },
    {
      cle: 'centrosome',
      nom: 'Centrosome',
      role: "Centre organisateur des microtubules : c'est de lui que part toute la charpente.",
      description:
        "Le centrosome est le point de départ des microtubules, un nuage de matériel péricentriolaire qui les amorce autour de deux centrioles disposés à angle droit. Chaque centriole est un barillet creux de neuf triplets de microtubules ; cette symétrie d'ordre 9 est conservée à l'identique de l'algue verte à l'être humain. Avant la division, le centrosome se duplique et les deux copies migrent aux pôles opposés de la cellule pour bâtir le fuseau qui séparera les chromosomes.",
      chiffres: [
        { valeur: '9', quoi: 'triplets de microtubules par centriole' },
        { valeur: '0,4 µm', quoi: "longueur d'un centriole, pour 0,2 µm de diamètre" },
      ],
      objet: centrosome,
      ancre: POSITION_CENTROSOME.clone().add(new THREE.Vector3(0, 0.35, -0.3)),
      couleur: TEINTES.centriole,
    },
  ]
}
