import * as THREE from 'three'
import {
  UM,
  TEINTES,
  creerAlea,
  materiauOrganite,
  pointDansCoquille,
  type Organite,
} from '../contrat.js'

/**
 * Le réticulum endoplasmique rugueux.
 *
 * Une pile de citernes aplaties qui prend naissance sur l'enveloppe nucléaire
 * et s'évase dans le cytoplasme, constellée de ribosomes sur ses deux faces.
 * La silhouette recherchée est celle des clichés de microscopie électronique :
 * des nappes presque parallèles, ondulées, séparées d'un quart de micromètre,
 * et un grain orangé si fin qu'il ne se lit qu'en s'approchant.
 */

/** Direction d'étalement dans le cytoplasme, à l'opposé de l'appareil de Golgi. */
const AXE = new THREE.Vector3(-4, -1, 0).normalize()

const NB_NAPPES = 6
/** Étendue d'une citerne : 4 µm du noyau vers le large, 2,5 µm de flanc. */
const LONGUEUR = 4 * UM
const LARGEUR = 2.5 * UM
const SEGMENTS_LONG = 40
const SEGMENTS_LARGE = 24
/** Espacement des citernes à l'attache nucléaire. */
const ECART = 0.25 * UM

/**
 * Bascule de la pile autour de son axe d'étalement.
 *
 * À plat les nappes se masqueraient l'une l'autre, de chant elles se
 * réduiraient à des traits : cette inclinaison intermédiaire laisse voir à la
 * fois la surface des citernes et l'épaisseur de la pile.
 */
const INCLINAISON = 1.15

/**
 * Rayon (dans le plan xy) auquel la pile rejoint le noyau.
 *
 * Volontairement court : l'attache est glissée SOUS l'enveloppe nucléaire. Le
 * noyau mesurant 5 à 6 µm de diamètre, son rayon exact n'est pas connu d'ici ;
 * un léger recouvrement se cache derrière la membrane, alors qu'un jour entre
 * les deux contredirait la continuité qu'on veut justement montrer.
 */
const RAYON_ATTACHE = 0.95 * UM

/** Retrait sous le plan de coupe : la pile affleure sans se faire trancher. */
const MARGE_COUPE = 0.05 * UM

const NB_RIBOSOMES = 1800
/** Un ribosome mesure 25 nm : à l'échelle vraie, c'est un grain. */
const RAYON_RIBOSOME = 0.0125 * UM

// Objets de travail hissés au niveau du module : aucune allocation par instance.
const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _normale = new THREE.Vector3()
const _axe = new THREE.Vector3()
const _quaternion = new THREE.Quaternion()
const _echelle = new THREE.Vector3()

type Attribut = THREE.BufferAttribute | THREE.InterleavedBufferAttribute

/**
 * Déforme une nappe plane en citerne.
 *
 * Trois effets se superposent : un contour qui part étroit contre l'enveloppe
 * et s'évase vers le cytoplasme, une ondulation douce (somme de deux
 * sinusoïdes), et le décalage de la citerne dans la pile.
 */
function sculpterNappe(geometrie: THREE.PlaneGeometry, rang: number, alea: () => number): void {
  const sommets = geometrie.getAttribute('position')
  // Une phase propre à chaque citerne : les nappes restent presque parallèles
  // sans pour autant être des copies conformes.
  const phase = rang * 0.37 + alea() * 0.4
  const decalPile = ECART * (rang - (NB_NAPPES - 1) / 2)

  for (let i = 0; i < sommets.count; i += 1) {
    const x = sommets.getX(i)
    const y = sommets.getY(i)
    // t = 0 contre l'enveloppe nucléaire, t = 1 au bord cytoplasmique.
    const t = (x + LONGUEUR / 2) / LONGUEUR

    // Contour : pincé à l'attache, large au loin, flancs jamais rectilignes.
    const evasement = 0.32 + 0.68 * Math.pow(t, 0.8)
    const largeurLocale = y * evasement * (1 + 0.16 * Math.sin(2.3 * x + phase))
    // Les deux extrémités sont découpées elles aussi.
    const longueurLocale = x + 0.18 * Math.sin(1.9 * y + phase * 1.7)

    // L'ondulation s'efface près de l'attache : les citernes s'y rejoignent
    // proprement, comme si elles sortaient d'une même membrane.
    const ondulation =
      (0.09 * Math.sin(1.6 * x + phase) + 0.06 * Math.sin(2.2 * y - phase)) * (0.25 + 0.75 * t)

    // L'écart vaut exactement 0,25 µm à l'attache puis la pile diverge.
    const hauteurPile = decalPile * (1 + 0.55 * t) + ondulation

    sommets.setXYZ(i, longueurLocale, largeurLocale, hauteurPile)
  }

  sommets.needsUpdate = true
  geometrie.computeVertexNormals()
}

/** Interpolation bilinéaire des quatre coins d'une maille. */
function interpolerMaille(
  attribut: Attribut,
  i00: number,
  i10: number,
  i01: number,
  i11: number,
  a: number,
  b: number,
  cible: THREE.Vector3,
): void {
  const p00 = (1 - a) * (1 - b)
  const p10 = a * (1 - b)
  const p01 = (1 - a) * b
  const p11 = a * b
  cible.set(
    attribut.getX(i00) * p00 + attribut.getX(i10) * p10 + attribut.getX(i01) * p01 + attribut.getX(i11) * p11,
    attribut.getY(i00) * p00 + attribut.getY(i10) * p10 + attribut.getY(i01) * p01 + attribut.getY(i11) * p11,
    attribut.getZ(i00) * p00 + attribut.getZ(i10) * p10 + attribut.getZ(i01) * p01 + attribut.getZ(i11) * p11,
  )
}

/**
 * Sème les ribosomes sur les deux faces des nappes.
 *
 * Les grains sont tirés à l'intérieur des mailles et non sur les sommets :
 * sinon plusieurs tirages tombent au même endroit et le semis fait des paquets.
 * Les mailles étant plus serrées près du noyau, le grain y est plus dense —
 * c'est aussi ce qu'on observe.
 */
function semerRibosomes(nappes: THREE.PlaneGeometry[]): THREE.InstancedMesh {
  // Flux de hasard distinct de celui des nappes : retoucher le relief des
  // citernes ne doit pas rebattre les 1 800 grains.
  const alea = creerAlea(0x5249_424f)
  const grain = new THREE.IcosahedronGeometry(RAYON_RIBOSOME, 0)
  const semis = new THREE.InstancedMesh(
    grain,
    materiauOrganite(TEINTES.ribosome, { doubleFace: false }),
    NB_RIBOSOMES,
  )
  const largeurGrille = SEGMENTS_LONG + 1
  const parNappe = Math.floor(NB_RIBOSOMES / nappes.length)
  let pose = 0

  for (const geometrie of nappes) {
    const sommets = geometrie.getAttribute('position')
    const normales = geometrie.getAttribute('normal')

    for (let n = 0; n < parNappe; n += 1) {
      const colonne = Math.floor(alea() * SEGMENTS_LONG)
      const ligne = Math.floor(alea() * SEGMENTS_LARGE)
      const a = alea()
      const b = alea()
      const i00 = ligne * largeurGrille + colonne
      const i01 = i00 + largeurGrille

      interpolerMaille(sommets, i00, i00 + 1, i01, i01 + 1, a, b, _position)
      interpolerMaille(normales, i00, i00 + 1, i01, i01 + 1, a, b, _normale)
      _normale.normalize()

      // Une face ou l'autre, le grain à demi enfoncé dans la membrane.
      const face = alea() < 0.5 ? 1 : -1
      _position.addScaledVector(_normale, face * RAYON_RIBOSOME * 0.7)

      // Orientation quelconque : l'icosaèdre ne doit pas trahir sa maille.
      pointDansCoquille(alea, 1, 1, _axe)
      _quaternion.setFromAxisAngle(_axe, alea() * Math.PI * 2)
      // Le ribosome fait 25 à 30 nm : un cinquième de dispersion sur le calibre.
      _echelle.setScalar(1 + alea() * 0.2)

      _matrice.compose(_position, _quaternion, _echelle)
      semis.setMatrixAt(pose, _matrice)
      pose += 1
    }
  }

  semis.count = pose
  semis.instanceMatrix.needsUpdate = true
  return semis
}

export function creerReticulumRugueux(): Organite[] {
  const alea = creerAlea(0x5245_5247)
  const groupe = new THREE.Group()
  groupe.name = 'reticulum-rugueux'

  // Repère de la pile : x le long de l'étalement, z la normale des citernes,
  // basculée hors du plan xy pour qu'on lise à la fois surface et empilement.
  const perpendiculaire = new THREE.Vector3(-AXE.y, AXE.x, 0)
  const normalePile = perpendiculaire
    .clone()
    .multiplyScalar(Math.cos(INCLINAISON))
    .addScaledVector(new THREE.Vector3(0, 0, 1), Math.sin(INCLINAISON))
  const flanc = normalePile.clone().cross(AXE)
  const repere = new THREE.Matrix4().makeBasis(AXE, flanc, normalePile)

  const matiere = materiauOrganite(TEINTES.reticulumRugueux, { opacite: 0.75 })
  const nappes: THREE.PlaneGeometry[] = []

  for (let rang = 0; rang < NB_NAPPES; rang += 1) {
    const geometrie = new THREE.PlaneGeometry(LONGUEUR, LARGEUR, SEGMENTS_LONG, SEGMENTS_LARGE)
    sculpterNappe(geometrie, rang, alea)
    // Le repère est cuit dans la géométrie : les ribosomes se sèment ensuite
    // directement dans le repère du groupe, sans conversion.
    geometrie.applyMatrix4(repere)
    nappes.push(geometrie)
    groupe.add(new THREE.Mesh(geometrie, matiere))
  }

  groupe.add(semerRibosomes(nappes))

  // Crête de la pile, pour la glisser juste derrière le plan de coupe.
  let crete = -Infinity
  for (const geometrie of nappes) {
    const sommets = geometrie.getAttribute('position')
    for (let i = 0; i < sommets.count; i += 1) crete = Math.max(crete, sommets.getZ(i))
  }

  const portee = RAYON_ATTACHE + LONGUEUR / 2
  groupe.position.set(AXE.x * portee, AXE.y * portee, -MARGE_COUPE - crete)
  groupe.updateMatrixWorld(true)

  // Étiquette accrochée au-dessus de la citerne supérieure, dans la moitié
  // large. Le point est donné dans le repère de la pile : il faut le basculer
  // comme elle avant de le passer en coordonnées monde.
  const ancre = new THREE.Vector3(LONGUEUR * 0.22, 0, ECART * NB_NAPPES * 0.7).applyMatrix4(repere)
  groupe.localToWorld(ancre)

  return [
    {
      cle: 'reticulum-rugueux',
      nom: 'Réticulum endoplasmique rugueux',
      role: 'Fabrique et replie les protéines destinées à l’export et aux membranes.',
      description:
        'Le réticulum endoplasmique rugueux est un empilement de citernes aplaties dont la ' +
        'membrane prolonge directement celle de l’enveloppe nucléaire : les deux compartiments ' +
        'n’en forment qu’un. Sa face cytosolique est couverte de ribosomes — ce sont eux qui la ' +
        'rendent « rugueuse » — qui poussent la protéine naissante dans la lumière des citernes au ' +
        'fur et à mesure qu’ils la lisent. Les protéines y sont repliées, contrôlées, puis ' +
        'expédiées vers l’appareil de Golgi par vésicules. Une cellule qui sécrète beaucoup, ' +
        'comme un plasmocyte, en est presque entièrement remplie.',
      chiffres: [
        { valeur: '25 à 30 nm', quoi: 'diamètre d’un ribosome' },
        { valeur: '5 à 6 par seconde', quoi: 'acides aminés enchaînés par un ribosome de mammifère' },
        { valeur: 'continu', quoi: 'ses citernes prolongent l’enveloppe nucléaire' },
        { valeur: 'toutes', quoi: 'les protéines exportées ou membranaires y sont fabriquées' },
      ],
      objet: groupe,
      ancre,
      couleur: TEINTES.reticulumRugueux,
    },
  ]
}
