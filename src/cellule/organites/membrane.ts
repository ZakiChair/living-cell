import * as THREE from 'three'
import {
  creerAlea,
  materiauOrganite,
  RAYON_CELLULE,
  TEINTES,
  type Organite,
} from '../contrat.js'

/**
 * La membrane plasmique : la bicouche lipidique et ses protéines.
 *
 * Tout est à l'échelle vraie. La bicouche fait 5 nm, soit 0,005 unité : à
 * l'écran les deux feuillets sont presque confondus, et c'est exactement le
 * fait à faire passer. Les protéines, elles, sont des grains de 0,024 unité —
 * invisibles une par une, lisibles en semis.
 */

/** Épaisseur réelle de la bicouche : 5 nm. */
const EPAISSEUR_BICOUCHE = 0.005
const RAYON_INTERNE = RAYON_CELLULE - EPAISSEUR_BICOUCHE
/** Plan médian de la bicouche : les protéines y sont centrées pour la traverser. */
const RAYON_MEDIAN = RAYON_CELLULE - EPAISSEUR_BICOUCHE / 2

/**
 * Nombre de protéines transmembranaires dessinées.
 *
 * La membrane fait 1 257 µm² et en porte réellement de 10 000 à 30 000 par µm²,
 * soit de l'ordre de 10⁷ molécules — hors budget de trois ordres de grandeur.
 * On en dessine 60 000, ce qui donne 48 par µm² : assez pour que la membrane se
 * lise comme une mosaïque hérissée et non comme un ballon lisse, et il faut dire
 * ce qui manque plutôt que de le taire. La fiche porte l'écart.
 *
 * Le chiffre précédent, 700, contredisait ouvertement la fiche du module, qui
 * annonce que la moitié de la masse membranaire est protéique.
 */
const NOMBRE_PROTEINES = 60_000
const RAYON_PROTEINE = 0.012
const HAUTEUR_PROTEINE = 0.009
/** Hauteur de la calotte externe, la part qui dépasse côté milieu extérieur. */
const HAUTEUR_CALOTTE = 0.006
const SEGMENTS_PROTEINE = 8
const PAS_CALOTTE = 3
/** Variation de taille des instances, ±30 %. */
const VARIATION_TAILLE = 0.3
/** Amplitude du désordre appliqué aux directions, en fraction du rayon unité. */
const DISPERSION = 0.09

const ANGLE_OR = Math.PI * (3 - Math.sqrt(5))
const AXE_Y = new THREE.Vector3(0, 1, 0)

// Objets de travail hissés au niveau du module : aucune allocation dans la boucle.
const _normale = new THREE.Vector3()
const _centre = new THREE.Vector3()
const _rotation = new THREE.Quaternion()
const _taille = new THREE.Vector3()
const _matrice = new THREE.Matrix4()

/**
 * Profil de révolution d'une protéine transmembranaire : un fût cylindrique
 * qui traverse la bicouche, coiffé d'une calotte côté extérieur.
 */
function profilProteine(): THREE.Vector2[] {
  const demiHauteur = HAUTEUR_PROTEINE / 2
  const profil: THREE.Vector2[] = [
    new THREE.Vector2(0, -demiHauteur), // fond fermé, côté cytosol
    new THREE.Vector2(RAYON_PROTEINE, -demiHauteur),
    new THREE.Vector2(RAYON_PROTEINE, demiHauteur),
  ]
  for (let i = 1; i < PAS_CALOTTE; i++) {
    const angle = (Math.PI / 2) * (i / PAS_CALOTTE)
    profil.push(
      new THREE.Vector2(
        RAYON_PROTEINE * Math.cos(angle),
        demiHauteur + HAUTEUR_CALOTTE * Math.sin(angle),
      ),
    )
  }
  // LatheGeometry ne corrige la normale du pôle que si x vaut exactement 0 :
  // un cosinus donnerait 6e-17 et le sommet serait pincé.
  profil.push(new THREE.Vector2(0, demiHauteur + HAUTEUR_CALOTTE))
  return profil
}

export function creerMembrane(): Organite[] {
  const groupe = new THREE.Group()
  groupe.name = 'membrane'

  // Deux coquilles distantes de 5 nm. Subdivision élevée pour que le bord de
  // la coupe reste un cercle net et non un polygone.
  const matiereBicouche = materiauOrganite(TEINTES.membrane, { opacite: 0.2 })
  // La coquille enveloppe toute la scène : si elle écrivait la profondeur,
  // le tri des transparences lui ferait masquer les organites situés derrière.
  matiereBicouche.depthWrite = false
  groupe.add(
    new THREE.Mesh(new THREE.SphereGeometry(RAYON_CELLULE, 64, 48), matiereBicouche),
    new THREE.Mesh(new THREE.SphereGeometry(RAYON_INTERNE, 64, 48), matiereBicouche),
  )

  // Tranche de l'écorché. Sans elle la coupe laisse deux bords ouverts et
  // l'épaisseur de la membrane ne se lit nulle part.
  const tranche = new THREE.Mesh(
    new THREE.RingGeometry(RAYON_INTERNE, RAYON_CELLULE, 128),
    materiauOrganite(TEINTES.membrane, { opacite: 0.9 }),
  )
  // Juste derrière le plan de coupe : posée dessus, elle scintillerait.
  tranche.position.z = -0.001
  groupe.add(tranche)

  const alea = creerAlea(0x4d454d42)
  const geometrieProteine = new THREE.LatheGeometry(profilProteine(), SEGMENTS_PROTEINE)
  // LatheGeometry laisse la normale du sommet à la longueur du dernier segment
  // au lieu de 1 : sans remise à l'échelle, la calotte s'éclaire mal à sa pointe.
  geometrieProteine.normalizeNormals()

  const proteines = new THREE.InstancedMesh(
    geometrieProteine,
    materiauOrganite(TEINTES.proteineMembranaire),
    NOMBRE_PROTEINES,
  )
  for (let i = 0; i < NOMBRE_PROTEINES; i++) {
    // Spirale de Fibonacci : couverture régulière de la sphère, sans amas ni
    // vide. Le décalage aléatoire casse ensuite l'effet de tapis tissé.
    const hauteur = 1 - ((i + 0.5) * 2) / NOMBRE_PROTEINES
    const rayonAnneau = Math.sqrt(1 - hauteur * hauteur)
    const azimut = i * ANGLE_OR
    _normale
      .set(
        Math.cos(azimut) * rayonAnneau + (alea() - 0.5) * DISPERSION,
        hauteur + (alea() - 0.5) * DISPERSION,
        Math.sin(azimut) * rayonAnneau + (alea() - 0.5) * DISPERSION,
      )
      .normalize()

    _rotation.setFromUnitVectors(AXE_Y, _normale)
    _centre.copy(_normale).multiplyScalar(RAYON_MEDIAN)
    _taille.setScalar(1 + (alea() * 2 - 1) * VARIATION_TAILLE)
    _matrice.compose(_centre, _rotation, _taille)
    proteines.setMatrixAt(i, _matrice)
  }
  // La géométrie seule ne mesure que 0,024 µm : sans ce recalcul, le tronc de
  // vision jugerait tout le semis sur une bulle minuscule au centre de la cellule.
  proteines.computeBoundingSphere()
  groupe.add(proteines)

  return [
    {
      cle: 'membrane',
      nom: 'Membrane plasmique',
      role: 'Ferme la cellule et trie tout ce qui entre et sort.',
      description:
        "La membrane plasmique n'est pas une paroi mais un film : deux couches de " +
        'lipides dos à dos, cinq nanomètres en tout, mille deux cents fois plus ' +
        'fin que la cellule est large. La moitié de sa masse est faite de ' +
        'protéines plantées de part en part — pompes, canaux, récepteurs — si ' +
        'nombreuses que la surface tient de la mosaïque plutôt que du ballon. ' +
        'Le lipide isole, les protéines choisissent : la cellule reste chimiquement ' +
        "distincte du monde tout en négociant avec lui.",
      objet: groupe,
      // Ancre posée sur la membrane, du côté conservé par la coupe (z négatif).
      ancre: new THREE.Vector3(-0.45, 0.72, -0.53).normalize().multiplyScalar(RAYON_CELLULE),
      couleur: TEINTES.membrane,
    },
  ]
}
