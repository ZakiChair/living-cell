/**
 * Le noyau peuplé : nucléosomes, territoires chromosomiques, machinerie.
 *
 * Le noyau des manuels est une bulle où flottent trois fils. Le vrai est
 * l'endroit le plus encombré de la cellule : deux mètres d'ADN tiennent dans six
 * micromètres, enroulés sur une trentaine de millions de nucléosomes. Ce module
 * n'ajoute donc aucune forme nouvelle au noyau — il ajoute la DENSITÉ, et les
 * deux structures que cette densité rend enfin lisibles : le gradient
 * hétérochromatine du bord / euchromatine du centre, et les territoires
 * chromosomiques, ces régions où chaque chromosome reste groupé au lieu
 * d'errer dans le volume.
 */
import * as THREE from 'three'
import {
  TEINTES,
  creerAlea,
  materiauOrganite,
  pointDansCoquille,
  type Organite,
} from '../contrat.js'

/** Centre du noyau, repris de son module : les deux nuages doivent se superposer. */
const CENTRE_NOYAU = new THREE.Vector3(-1, 0.5, 0)
/** Le noyau fait 3 µm de rayon : on s'arrête franchement avant l'enveloppe. */
const RAYON_UTILE = 2.74

/**
 * Le nucléole est posé là par le module du noyau, et il est opaque. Une
 * particule enfermée dedans est perdue, et la coupe la montrerait flotter dans
 * un cratère : on les repousse toutes sur son pourtour, ce qui reconstitue au
 * passage la chromatine périnucléolaire, bien réelle.
 */
const CENTRE_NUCLEOLE = new THREE.Vector3(0.95, -0.75, -0.95)
/** Rayon du nucléole relief compris (0,832), plus une marge de dégagement. */
const DEGAGEMENT_NUCLEOLE = 0.88

const GRAINE = 0x4e55434c

// ── Nucléosomes ────────────────────────────────────────────────────────────
const NOMBRE_NUCLEOSOMES = 40_000
/** 11 nm de diamètre, 5,5 nm d'épaisseur : un palet, pas une bille. */
const RAYON_NUCLEOSOME = 0.0055
const EPAISSEUR_NUCLEOSOME = 0.0055

/**
 * Les trois régimes de peuplement sont tirés dans UNE seule boucle, et non
 * concaténés. Le curseur de densité de la page tronque la fin du tableau
 * d'instances : mêlés, n'importe quel préfixe reste un échantillon du noyau
 * entier, et surtout le rapport de densité entre territoires et fond se
 * conserve à toutes les positions du curseur.
 */
const PART_TERRITOIRES = 0.075
const PART_HETEROCHROMATINE = 0.325

/** Couche plaquée sous l'enveloppe : c'est là que siège l'hétérochromatine. */
const LAMINE_MIN = 2.55
const LAMINE_MAX = 2.73
/**
 * Densité du reste du volume : ρ(r) ∝ r^0,6. Mesuré sur le tirage, cela donne
 * 105 nucléosomes/µm³ au centre contre 1 170 dans la couche périphérique. Un
 * semis uniforme donnerait un brouillard sans structure — et serait faux.
 */
const EXPOSANT_EUCHROMATINE = 3.6

/** Chromatine relâchée : la teinte de référence de la famille. */
const TEINTE_EUCHROMATINE = TEINTES.chromatine
/** Hétérochromatine compactée : même famille, valeur nettement plus sombre. */
const TEINTE_HETEROCHROMATINE = 0x246a94
/**
 * Une variation de chromatine par territoire : la teinte code la région, jamais
 * l'individu. Aucune ne reprend exactement la teinte de l'euchromatine, sinon
 * le territoire concerné se fondrait dans le fond au lieu de se détacher.
 */
const TEINTES_TERRITOIRES = [0x3f97cf, 0x4fb0e0, 0x5ec0d6, 0x6bc7e6, 0x7fd0f2, 0x93c9f0]

const RAYON_TERRITOIRE = 0.8
/** Les centres restent à mi-rayon : un territoire entier doit tenir dans le noyau. */
const TERRITOIRE_MIN = 1
const TERRITOIRE_MAX = 1.85
/** Écart minimal entre deux centres : les territoires se touchent sans se confondre. */
const ECART_TERRITOIRES = 1.5
const ESSAIS_PLACEMENT = 60

// ── Machinerie ─────────────────────────────────────────────────────────────
const NOMBRE_MACHINERIE = 1_200
/** 24 nm : l'ordre de grandeur d'une polymérase engagée ou d'un spliceosome. */
const RAYON_MACHINERIE = 0.012
const RAYON_MACHINERIE_MAX = 2.5
/** ρ(r) ∝ r^−1,2 : on transcrit au centre, pas contre l'hétérochromatine du bord. */
const EXPOSANT_MACHINERIE = 1.8

const NOMBRE_CORPS = 12
/** 0,3 µm de diamètre : une tache nucléaire est visible en microscopie optique. */
const RAYON_CORPS = 0.15
const CORPS_MIN = 0.9
const CORPS_MAX = 2.3
/** Nucléole assombri : les corps nucléaires sont de la même famille, en plus dense. */
const TEINTE_CORPS = 0x002f4d

/** L'axe d'un CylinderGeometry est Y : c'est lui qu'on couche au hasard. */
const AXE_PALET = new THREE.Vector3(0, 1, 0)

// Temporaires hissés au module : la construction ne réalloue rien par instance.
const _position = new THREE.Vector3()
const _axe = new THREE.Vector3()
const _ecart = new THREE.Vector3()
const _rotation = new THREE.Quaternion()
const _taille = new THREE.Vector3(1, 1, 1)
const _matrice = new THREE.Matrix4()
const _couleur = new THREE.Color()

interface Territoire {
  centre: THREE.Vector3
  teinte: THREE.Color
}

/**
 * Point du volume tiré avec une densité radiale ρ(r) ∝ r^(exposant−3).
 *
 * `pointDansCoquille` répartit uniformément, ce qu'il faut pour une coquille
 * mince mais pas pour un noyau : au-dessus de 3 la densité croît vers le bord,
 * en dessous elle se concentre au centre.
 */
function pointRadial(
  alea: () => number,
  rayonMax: number,
  exposant: number,
  cible: THREE.Vector3,
): THREE.Vector3 {
  const u = alea() * 2 - 1
  const theta = alea() * Math.PI * 2
  const r = rayonMax * Math.pow(alea(), 1 / exposant)
  const s = Math.sqrt(1 - u * u)
  return cible.set(r * s * Math.cos(theta), r * s * Math.sin(theta), r * u)
}

/**
 * Repousse un point hors du nucléole.
 *
 * La cible est tirée dans une fourchette et non fixée : projetées sur un rayon
 * unique, les quelque sept cents particules concernées formeraient une coque
 * géométriquement parfaite, qui se lirait comme un artefact. Avec de
 * l'épaisseur, c'est un manchon de chromatine.
 */
function ecarterDuNucleole(point: THREE.Vector3, alea: () => number): void {
  _ecart.subVectors(point, CENTRE_NUCLEOLE)
  const distance = _ecart.length()
  const degagement = DEGAGEMENT_NUCLEOLE * (1 + 0.15 * alea())
  if (distance >= degagement) return
  point.copy(CENTRE_NUCLEOLE).addScaledVector(_ecart.divideScalar(distance), degagement)
}

/** Six centres tenus à l'écart les uns des autres, par tirage avec rejet. */
function placerTerritoires(alea: () => number): Territoire[] {
  const territoires: Territoire[] = []
  for (const teinte of TEINTES_TERRITOIRES) {
    const centre = new THREE.Vector3()
    for (let essai = 0; essai < ESSAIS_PLACEMENT; essai++) {
      pointDansCoquille(alea, TERRITOIRE_MIN, TERRITOIRE_MAX, centre)
      // Le dernier tirage est gardé tel quel : mieux vaut deux territoires un
      // peu proches qu'une boucle sans condition de sortie.
      if (territoires.every((t) => t.centre.distanceTo(centre) >= ECART_TERRITOIRES)) break
    }
    territoires.push({ centre, teinte: new THREE.Color(teinte) })
  }
  return territoires
}

/**
 * Le feutre de nucléosomes.
 *
 * Le matériau est blanc à dessein : la couleur est portée par `instanceColor`,
 * sinon les teintes de territoire seraient multipliées par celle du matériau et
 * ressortiraient toutes assombries. `vertexColors` reste à faux — l'activer
 * ferait déclarer un attribut `color` absent de la géométrie, et tout
 * deviendrait noir sans la moindre erreur.
 */
function creerNucleosomes(alea: () => number, territoires: Territoire[]): THREE.InstancedMesh {
  const nucleosomes = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(RAYON_NUCLEOSOME, RAYON_NUCLEOSOME, EPAISSEUR_NUCLEOSOME, 6),
    materiauOrganite(0xffffff, { doubleFace: false }),
    NOMBRE_NUCLEOSOMES,
  )
  const rayonTerritoireCarre = RAYON_TERRITOIRE * RAYON_TERRITOIRE

  for (let i = 0; i < NOMBRE_NUCLEOSOMES; i++) {
    const tirage = alea()
    if (tirage < PART_TERRITOIRES) {
      // Le surplus qui porte la densité du territoire au double de son voisinage :
      // mesuré, 490 instances en renfort de 550 déjà présentes par territoire.
      const territoire = territoires[Math.floor(alea() * territoires.length)]!
      pointRadial(alea, RAYON_TERRITOIRE, 3, _position).add(territoire.centre)
    } else if (tirage < PART_TERRITOIRES + PART_HETEROCHROMATINE) {
      pointDansCoquille(alea, LAMINE_MIN, LAMINE_MAX, _position)
    } else {
      pointRadial(alea, RAYON_UTILE, EXPOSANT_EUCHROMATINE, _position)
    }
    ecarterDuNucleole(_position, alea)

    // La teinte suit la RÉGION où le point a atterri, pas le tirage qui l'y a
    // mis : un nucléosome de fond tombé dans un territoire en prend la couleur,
    // sans quoi le territoire ne se lirait pas comme une région.
    _couleur.set(
      _position.length() >= LAMINE_MIN ? TEINTE_HETEROCHROMATINE : TEINTE_EUCHROMATINE,
    )
    for (const territoire of territoires) {
      if (_position.distanceToSquared(territoire.centre) < rayonTerritoireCarre) {
        _couleur.copy(territoire.teinte)
        break
      }
    }

    // Orientation quelconque : l'ADN aborde chaque octamère sous son angle.
    pointDansCoquille(alea, 1, 1, _axe)
    _rotation.setFromUnitVectors(AXE_PALET, _axe)
    nucleosomes.setMatrixAt(i, _matrice.compose(_position, _rotation, _taille))
    nucleosomes.setColorAt(i, _couleur)
  }

  nucleosomes.instanceMatrix.needsUpdate = true
  nucleosomes.instanceColor!.needsUpdate = true
  // Sans ce recalcul, le tronc de vision juge les 40 000 instances sur la bulle
  // d'un seul palet de 11 nm, et le nuage entier disparaît dès qu'on tourne.
  nucleosomes.computeBoundingSphere()
  nucleosomes.name = 'nucleosomes'
  return nucleosomes
}

/** ARN polymérases, facteurs de transcription, spliceosomes : des globules de 24 nm. */
function creerComplexes(alea: () => number): THREE.InstancedMesh {
  const complexes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_MACHINERIE, 1),
    materiauOrganite(TEINTES.reticulumLisse, { doubleFace: false }),
    NOMBRE_MACHINERIE,
  )
  for (let i = 0; i < NOMBRE_MACHINERIE; i++) {
    pointRadial(alea, RAYON_MACHINERIE_MAX, EXPOSANT_MACHINERIE, _position)
    ecarterDuNucleole(_position, alea)
    pointDansCoquille(alea, 1, 1, _axe)
    _rotation.setFromUnitVectors(AXE_PALET, _axe)
    complexes.setMatrixAt(i, _matrice.compose(_position, _rotation, _taille))
  }
  complexes.instanceMatrix.needsUpdate = true
  complexes.computeBoundingSphere()
  complexes.name = 'complexes-nucleaires'
  return complexes
}

/** Taches nucléaires et corps de Cajal : les réserves de facteurs d'épissage. */
function creerCorpsNucleaires(alea: () => number): THREE.InstancedMesh {
  const corps = new THREE.InstancedMesh(
    new THREE.SphereGeometry(RAYON_CORPS, 16, 12),
    materiauOrganite(TEINTE_CORPS),
    NOMBRE_CORPS,
  )
  _rotation.identity()
  for (let i = 0; i < NOMBRE_CORPS; i++) {
    pointDansCoquille(alea, CORPS_MIN, CORPS_MAX, _position)
    ecarterDuNucleole(_position, alea)
    corps.setMatrixAt(i, _matrice.compose(_position, _rotation, _taille))
  }
  corps.instanceMatrix.needsUpdate = true
  corps.computeBoundingSphere()
  corps.name = 'corps-nucleaires'
  return corps
}

export function creerChromatineDense(): Organite[] {
  const alea = creerAlea(GRAINE)
  const territoires = placerTerritoires(alea)

  const nucleosomes = creerNucleosomes(alea, territoires)
  nucleosomes.position.copy(CENTRE_NOYAU)

  const machinerie = new THREE.Group()
  machinerie.name = 'machinerie-nucleaire'
  machinerie.position.copy(CENTRE_NOYAU)
  machinerie.add(creerComplexes(alea), creerCorpsNucleaires(alea))

  return [
    {
      cle: 'nucleosomes',
      nom: 'Nucléosomes',
      role: "Empaquettent l'ADN : deux mètres de double hélice dans six micromètres.",
      description:
        "Un nucléosome, ce sont 147 paires de bases enroulées 1,7 fois autour d'un " +
        "octamère d'histones : un palet de onze nanomètres. Il y en a une trentaine " +
        'de millions dans un noyau humain, et ce sont eux qui remplissent réellement ' +
        "le volume — pas quelques fils dans une bulle, un feutre saturé. La densité " +
        "n'y est pas la même partout : contre l'enveloppe, l'hétérochromatine est " +
        'compactée et muette ; vers le centre, ' +
        "l'euchromatine relâchée laisse lire les gènes. Enfin chaque chromosome " +
        'reste groupé dans son territoire au lieu de se disperser — ce sont les ' +
        'régions de teintes différentes.',
      objet: nucleosomes,
      // Du côté conservé par l'écorché : sinon le trait d'étiquette part d'un vide.
      ancre: CENTRE_NOYAU.clone().add(new THREE.Vector3(0.6, 2.3, -1.6)),
      couleur: TEINTES.chromatine,
    },
    {
      cle: 'machinerie-nucleaire',
      nom: 'Machinerie nucléaire',
      role: 'Lit les gènes et découpe les ARN : polymérases, facteurs, spliceosomes.',
      description:
        "Entre les nucléosomes circule tout ce qui travaille sur l'ADN : les ARN " +
        'polymérases qui recopient les gènes, les facteurs de transcription qui ' +
        'décident lesquels, les spliceosomes qui découpent les ARN à peine ' +
        'transcrits. Ces complexes se tiennent surtout là où la chromatine est ' +
        "desserrée, vers le centre du noyau — contre l'enveloppe, la chromatine " +
        'compactée ne se lit pas. Les grosses masses sombres sont des corps ' +
        "nucléaires : taches d'épissage et corps de Cajal, où les facteurs sont " +
        'stockés et remis en état entre deux usages.',
      objet: machinerie,
      ancre: CENTRE_NOYAU.clone().add(new THREE.Vector3(0.5, -2.5, -2.2)),
      couleur: TEINTES.reticulumLisse,
    },
  ]
}
