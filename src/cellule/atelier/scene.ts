import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import { RAYON_NOYAU, SIEGES } from '../mecanismes/contrat.js'
import { TEINTES_CLASSE } from '../../noyau/codeGenetique.js'
import { arntGagnant, type Atelier } from '../../noyau/atelier.js'
import { poserSilhouette } from '../silhouette.js'

/**
 * LA SCÈNE DE L'ATELIER DU GÈNE.
 *
 * Tout y est à l'échelle vraie, et c'est ce qui rend la scène possible : un gène
 * de quatre-vingt-dix paires de bases fait 29 nm de contour, un ribosome 30 nm,
 * un pore nucléaire 120 nm de large. La distribution entière tient donc dans
 * trois cents nanomètres — rien n'est grossi, c'est la caméra qui descend, comme
 * pour les autres mécanismes.
 *
 * Trois partis pris, tous déclarés dans la fiche :
 *
 * 1. LE RIBOSOME EST FIXE ET L'ARN DÉFILE. Dans la cellule c'est le ribosome qui
 *    avance sur un messager immobile ; ici c'est le repère inverse, qui est le
 *    même mouvement vu d'ailleurs. Il est choisi parce qu'il garde le ribosome
 *    au centre du cadre, et l'expérience du reste du projet montre qu'un sujet
 *    de 30 nm qui dérive est un sujet qu'on ne voit pas.
 * 2. LES BARREAUX SONT COLORÉS PAR TYPE DE PAIRE. A–T d'une teinte, G–C d'une
 *    autre : deux liaisons hydrogène contre trois. La couleur encode une
 *    différence physique, et c'est ce qui rend la séquence lisible plutôt que
 *    décorative — on voit les régions riches en G–C, celles qui fondent le moins
 *    facilement.
 * 3. LES ACIDES AMINÉS SONT COLORÉS PAR CLASSE CHIMIQUE, jamais individuellement.
 *    Vingt teintes ne seraient discriminables par personne, et ce qui décide du
 *    repliement est l'alternance des caractères, pas l'identité des résidus.
 */

// ── Géométrie du plateau, en micromètres ───────────────────────────────────
/** 0,324 nm par paire de bases : la montée du B-ADN. */
const MONTEE = 0.000324
const PB_PAR_TOUR = 10.5
/** Le duplex fait 2 nm de large ; on le dessine à 2,2 pour que les brins se voient. */
const RAYON_HELICE = 0.0011
const RAYON_GRAIN = 0.00055
/** Les deux brins ne sont pas diamétralement opposés : petit et grand sillon. */
const DEPHASAGE = 2.51

/**
 * L'enveloppe est au milieu du plateau, le gène à gauche, le ribosome à droite.
 *
 * L'écartement est serré, et c'est un arbitrage mesuré. À l'échelle vraie, le
 * gène fait 29 nm de contour, le ribosome 30 et l'ARN messager 54 : tous dans
 * la même décade. Mais un pore nucléaire fait 120 nm de large. Un plateau qui
 * respecterait cet écart montrerait un pore correct et trois acteurs de dix
 * pixels — le décor écraserait le sujet.
 *
 * C'est donc le FRAGMENT D'ENVELOPPE qui est réduit, à 150 nm de côté, et
 * l'anneau du pore avec lui. Les acteurs de la chaîne, eux, gardent leurs
 * dimensions exactes. Le mécanisme « Export nucléaire » montre le pore à sa
 * vraie taille et dans le détail ; celui-ci montre la chaîne.
 */
const X_GENE = -0.055
const X_ENVELOPPE = 0
const X_RIBOSOME = 0.055

/** Rayon du fragment d'enveloppe montré : 75 nm. */
const RAYON_ENVELOPPE = 0.075
/** Canal du pore, réduit dans la même proportion que le fragment. */
const RAYON_CANAL = 0.012
const RAYON_ANNEAU = 0.03
const EPAISSEUR_ENVELOPPE = 0.03

/** Grande sous-unité 25 nm, petite 18 nm : c'est à ça qu'on reconnaît un ribosome. */
const RAYON_GRANDE = 0.0125
const RAYON_PETITE = 0.009

/** Un grain d'ARN messager pour trois nucléotides, soit un par codon. */
const PAS_ARN = 0.0018
const RAYON_GRAIN_ARN = 0.0009
const RAYON_ACIDE = 0.0011

/** Teintes des deux types de paire de bases. */
const TEINTE_AT = 0xe69f00
const TEINTE_GC = 0x0072b2

const AXE_Y = new THREE.Vector3(0, 1, 0)
const ROTATION_NULLE = new THREE.Quaternion()

// ── Temporaires hissés : animer() ne doit rien allouer ─────────────────────
const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _echelle = new THREE.Vector3(1, 1, 1)
const _quaternion = new THREE.Quaternion()
const _axe = new THREE.Vector3()

/** Rampe adoucie, bornée à [0, 1]. */
function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

export interface SceneAtelier {
  objet: THREE.Object3D
  /** Où poser la caméra, en coordonnées de la scène. */
  ancre: THREE.Vector3
  /** Rayon à cadrer, en micromètres. */
  rayonCadrage: number
  /**
   * D'où regarder le plateau, en coordonnées de la scène.
   *
   * Un vecteur de recul fixe en coordonnées monde ne peut pas convenir : le
   * plateau est orienté radialement depuis le noyau, et son axe +X — celui qui
   * va du gène au ribosome — peut tomber n'importe où. Regarder par cet axe
   * empile le gène, le pore et le ribosome les uns derrière les autres, et on
   * ne voit qu'un anneau. La direction est donc déclarée dans le repère LOCAL,
   * franchement perpendiculaire à la disposition, puis tournée avec le plateau.
   */
  directionCadrage: THREE.Vector3
  /** Position monde du brin d'ARN messager libre, pour le saisir. */
  positionBrin: (sortie: THREE.Vector3) => THREE.Vector3
  /** Position monde du ribosome, pour savoir si on lui a bien donné le brin. */
  positionRibosome: (sortie: THREE.Vector3) => THREE.Vector3
  /**
   * Position où l'utilisateur tient le brin pendant qu'il le déplace, en
   * coordonnées locales du plateau. `null` quand il ne le tient pas.
   */
  brinTenu: THREE.Vector3 | null
  animer: (atelier: Atelier, temps: number) => void
}

export function creerSceneAtelier(): SceneAtelier {
  const alea = creerAlea(20260731)
  const groupe = new THREE.Group()

  // Le plateau est posé sur l'enveloppe nucléaire, à un endroit dégagé et
  // distinct de celui du mécanisme d'export, qui montre le pore en détail.
  const direction = new THREE.Vector3(0.34, 0.56, 0.76).normalize()
  const centre = SIEGES.noyau.clone().addScaledVector(direction, RAYON_NOYAU)
  groupe.position.copy(centre)
  // +X du plateau part du noyau vers le cytosol : le sens du trajet.
  groupe.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction)

  // ── L'enveloppe nucléaire et son pore ───────────────────────────────────
  // DEUX membranes, pas une : l'enveloppe nucléaire est une double bicouche
  // séparée par un espace périnucléaire, et le pore est le seul endroit où les
  // deux fusionnent. Un cylindre unique se lisait comme un anneau et ratait ce
  // qui fait de l'enveloppe autre chose qu'une membrane ordinaire.
  const geoMembrane = new THREE.RingGeometry(RAYON_ANNEAU * 1.15, RAYON_ENVELOPPE, 40, 1)
  for (const cote of [-1, 1]) {
    const membrane = new THREE.Mesh(
      geoMembrane,
      materiauOrganite(TEINTES.membraneNucleaire, { opacite: 0.34 }),
    )
    membrane.rotation.y = Math.PI / 2
    membrane.position.x = X_ENVELOPPE + (cote * EPAISSEUR_ENVELOPPE) / 2
    groupe.add(membrane)
  }

  // L'anneau du pore : huit sous-unités, la symétrie qui le signe.
  const anneau = new THREE.Group()
  anneau.position.x = X_ENVELOPPE
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const grain = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.007, 1),
      materiauOrganite(TEINTES.nucleole, { doubleFace: false }),
    )
    grain.position.set(0, Math.cos(angle) * RAYON_ANNEAU, Math.sin(angle) * RAYON_ANNEAU)
    anneau.add(grain)
  }
  groupe.add(anneau)

  // Le canal n'est PAS un trou : il est bourré de nucléoporines désordonnées
  // qui forment un hydrogel. Un cargo n'y « passe » pas, il y fond par des
  // milliers d'interactions transitoires — d'où son temps de séjour. Le
  // dessiner vide serait la faute la plus répandue des schémas de pore.
  const hydrogel = new THREE.Mesh(
    new THREE.SphereGeometry(RAYON_CANAL, 16, 12),
    materiauOrganite(TEINTES.chromatine, { opacite: 0.22 }),
  )
  hydrogel.position.x = X_ENVELOPPE
  hydrogel.scale.set(EPAISSEUR_ENVELOPPE / RAYON_CANAL / 2, 1, 1)
  groupe.add(hydrogel)

  // ── LE GÈNE ─────────────────────────────────────────────────────────────
  // Une double hélice de 90 paires de bases, aux longueurs vraies. Les barreaux
  // sont colorés par type de paire : c'est ce qui rend la séquence visible.
  const gene = new THREE.Group()
  gene.position.x = X_GENE
  groupe.add(gene)

  const NB_PB = 90
  const LONGUEUR_GENE = NB_PB * MONTEE

  const geoGrain = new THREE.IcosahedronGeometry(RAYON_GRAIN, 0)
  const brinA = new THREE.InstancedMesh(
    geoGrain,
    materiauOrganite(TEINTES.noyau, { doubleFace: false }),
    NB_PB,
  )
  const brinB = new THREE.InstancedMesh(
    geoGrain,
    materiauOrganite(TEINTES.membraneNucleaire, { doubleFace: false }),
    NB_PB,
  )
  brinA.frustumCulled = false
  brinB.frustumCulled = false
  gene.add(brinA, brinB)

  const geoBarreau = new THREE.CylinderGeometry(0.00035, 0.00035, 1, 5, 1, false)
  const barreauxAT = new THREE.InstancedMesh(
    geoBarreau,
    materiauOrganite(TEINTE_AT, { doubleFace: false }),
    NB_PB,
  )
  const barreauxGC = new THREE.InstancedMesh(
    geoBarreau,
    materiauOrganite(TEINTE_GC, { doubleFace: false }),
    NB_PB,
  )
  barreauxAT.frustumCulled = false
  barreauxGC.frustumCulled = false
  gene.add(barreauxAT, barreauxGC)

  /** Position d'un point de brin, en fonction de la paire de bases et de l'ouverture. */
  const pointBrin = (pb: number, dephasage: number, ouverture: number, sortie: THREE.Vector3) => {
    const x = (pb - NB_PB / 2) * MONTEE
    const phi = (pb / PB_PAR_TOUR) * Math.PI * 2 + dephasage
    // Dans la bulle, les deux brins quittent l'hélice et s'écartent selon Y.
    const r = RAYON_HELICE
    const ecart = ouverture * 0.0026 * Math.sign(Math.cos(dephasage) || 1)
    return sortie.set(
      x,
      r * Math.cos(phi) * (1 - ouverture) + ecart,
      r * Math.sin(phi) * (1 - ouverture),
    )
  }

  // ── LA POLYMÉRASE ───────────────────────────────────────────────────────
  const polymerase = new THREE.Group()
  const corpsPge = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0065, 1),
    // Translucide : à sa taille réelle de 13 nm, elle engloberait entièrement
    // la bulle de 4 nm qu'elle ouvre, et on ne verrait rien du procédé.
    materiauOrganite(TEINTES.golgi, { opacite: 0.5, emissif: 0x2a1420 }),
  )
  corpsPge.scale.set(1.05, 0.95, 1.15)
  const machoire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0034, 1),
    materiauOrganite(0xa85a86, { doubleFace: false }),
  )
  machoire.position.set(0.0052, -0.001, 0)
  polymerase.add(corpsPge, machoire)
  gene.add(polymerase)

  // ── L'ARN MESSAGER ──────────────────────────────────────────────────────
  // Trente grains, un par codon. Le même objet sert à trois moments : il naît
  // derrière la polymérase, franchit le pore, puis défile dans le ribosome.
  const NB_GRAINS = 30
  const arn = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_GRAIN_ARN, 1),
    materiauOrganite(TEINTES.vesicule, { doubleFace: false }),
    NB_GRAINS,
  )
  arn.frustumCulled = false
  groupe.add(arn)

  const coiffe = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0014, 1),
    materiauOrganite(0xf0e442, { doubleFace: false, emissif: 0x3a3610 }),
  )
  coiffe.scale.setScalar(0)
  groupe.add(coiffe)

  // Repli figé du transcrit tant qu'il n'est pas dans le ribosome : un ARNm
  // libre est en pelote, jamais tendu.
  const repli = new Float32Array(NB_GRAINS * 3)
  {
    let dy = 0
    let dz = 0
    for (let i = 0; i < NB_GRAINS; i++) {
      dy += (alea() - 0.5) * 0.9
      dz += (alea() - 0.5) * 0.9
      const n = Math.hypot(1, dy, dz)
      repli[i * 3] = 1 / n
      repli[i * 3 + 1] = dy / n
      repli[i * 3 + 2] = dz / n
    }
  }

  // ── LE RIBOSOME ─────────────────────────────────────────────────────────
  const ribosome = new THREE.Group()
  ribosome.position.x = X_RIBOSOME
  groupe.add(ribosome)

  // Deux boules : la forme de repli, celle que la scène garde si la
  // silhouette cristallographique n'arrive pas. Elle dit déjà le fait qui
  // compte — deux sous-unités de tailles nettement différentes.
  const grande = new THREE.Mesh(
    new THREE.IcosahedronGeometry(RAYON_GRANDE, 2),
    materiauOrganite(TEINTES.ribosome),
  )
  grande.scale.set(1, 0.88, 1)
  grande.position.y = RAYON_PETITE * 0.75
  const petite = new THREE.Mesh(
    new THREE.IcosahedronGeometry(RAYON_PETITE, 2),
    materiauOrganite(0xb04a00),
  )
  petite.position.y = -RAYON_GRANDE * 0.72
  petite.scale.set(1.1, 0.8, 1)
  ribosome.add(grande, petite)

  // ── LA VRAIE FORME ──────────────────────────────────────────────────────
  // 6EK0 : le ribosome 80S HUMAIN, résolu par cryo-microscopie électronique.
  // Onze mille sept cents carbones α, un par acide aminé — la forme mesurée,
  // pas dessinée. C'est le seul objet du site qui ne soit pas une invention
  // de géomètre, et c'est l'objet-héros : celui à qui l'on donne le brin.
  //
  // Le budget tient parce qu'il est UNIQUE : 11 725 instances en un seul
  // appel de dessin. Les cent cinquante ribosomes du tapis de réticulum
  // resteront procéduraux — ils coûteraient un million et demi d'instances.
  poserSilhouette(
    '6EK0',
    ribosome,
    { rayon: RAYON_GRANDE * 1.5, materiau: materiauOrganite(TEINTES.ribosome) },
    () => {
      // La silhouette a pris le relais : les deux boules s'effacent.
      grande.visible = false
      petite.visible = false
    },
  )
  // Les deux sous-unités ne sont assemblées que lorsqu'elles tiennent un brin.
  ribosome.visible = true

  // ── LES ARN DE TRANSFERT ────────────────────────────────────────────────
  // Six en approche : un seul finira par s'installer, les autres cognent et
  // repartent. Cette accumulation de rejets EST le mécanisme de la fidélité.
  const NB_ARNT = 6
  const arnt = new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(0.0026, 0),
    materiauOrganite(TEINTES.chromatine, { doubleFace: false, opacite: 0.9 }),
    NB_ARNT,
  )
  arnt.frustumCulled = false
  groupe.add(arnt)

  const capsArnt = new Float32Array(NB_ARNT * 3)
  for (let i = 0; i < NB_ARNT; i++) {
    const u = alea() * Math.PI * 2
    const v = alea() * 2 - 1
    const s = Math.sqrt(1 - v * v)
    capsArnt[i * 3] = Math.cos(u) * s
    capsArnt[i * 3 + 1] = v
    capsArnt[i * 3 + 2] = Math.sin(u) * s
  }

  // ── LA CHAÎNE NAISSANTE ─────────────────────────────────────────────────
  // Un maillage instancié par classe chimique : quatre appels de dessin, et la
  // couleur d'un résidu ne peut pas se retrouver sur le mauvais.
  const chaines = new Map<string, THREE.InstancedMesh>()
  const geoAcide = new THREE.IcosahedronGeometry(RAYON_ACIDE, 1)
  for (const [classe, teinte] of Object.entries(TEINTES_CLASSE)) {
    const maillage = new THREE.InstancedMesh(
      geoAcide,
      materiauOrganite(teinte, { doubleFace: false }),
      NB_GRAINS,
    )
    maillage.frustumCulled = false
    maillage.count = 0
    ribosome.add(maillage)
    chaines.set(classe, maillage)
  }

  // ── État de l'image en cours ────────────────────────────────────────────
  /** Là où l'utilisateur tient le brin, en coordonnées locales du plateau. */
  let brinTenu: THREE.Vector3 | null = null
  /** Position locale de la tête du brin libre, dont l'interface a besoin. */
  const teteBrin = new THREE.Vector3()

  /** Écrit les deux brins d'ADN et leurs barreaux pour une bulle donnée. */
  const majGene = (tetePb: number, presence: number): void => {
    _echelle.set(1, 1, 1)
    let nAT = 0
    let nGC = 0
    for (let pb = 0; pb < NB_PB; pb++) {
      // La bulle fait treize paires de bases et voyage avec l'enzyme.
      const ecart = Math.abs(pb - tetePb)
      const ouverture = presence * lissage(1 - ecart / 6.5)

      pointBrin(pb, 0, ouverture, _position)
      _matrice.compose(_position, ROTATION_NULLE, _echelle)
      brinA.setMatrixAt(pb, _matrice)
      const a = _position.clone()

      pointBrin(pb, DEPHASAGE, ouverture, _position)
      _matrice.compose(_position, ROTATION_NULLE, _echelle)
      brinB.setMatrixAt(pb, _matrice)

      // Le barreau relie les deux brins, et disparaît dans la bulle : la paire
      // y est rompue, c'est toute la mécanique du procédé.
      _axe.subVectors(_position, a)
      const longueur = _axe.length()
      _axe.divideScalar(longueur || 1)
      _quaternion.setFromUnitVectors(AXE_Y, _axe)
      const visible = 1 - lissage(ouverture / 0.3)
      _echelle.set(visible, longueur * visible, visible)
      _position.copy(a).addScaledVector(_axe, longueur * 0.5)
      _matrice.compose(_position, _quaternion, _echelle)

      // Deux liaisons hydrogène pour A–T, trois pour G–C : la couleur encode
      // une différence physique, et rend la séquence lisible.
      if (paireEstGC(pb)) barreauxGC.setMatrixAt(nGC++, _matrice)
      else barreauxAT.setMatrixAt(nAT++, _matrice)
      _echelle.set(1, 1, 1)
    }
    barreauxAT.count = nAT
    barreauxGC.count = nGC
    brinA.instanceMatrix.needsUpdate = true
    brinB.instanceMatrix.needsUpdate = true
    barreauxAT.instanceMatrix.needsUpdate = true
    barreauxGC.instanceMatrix.needsUpdate = true
  }

  /** Quelle est la paire à cette position : lue dans la séquence, pas tirée au sort. */
  let sequence = ''
  function paireEstGC(pb: number): boolean {
    const base = sequence[pb]
    return base === 'G' || base === 'C'
  }

  /**
   * Le brin d'ARN, replié, à une position et une longueur données.
   *
   * `teteBrin` reçoit l'origine AVANT que la marche ne commence : les appelants
   * passent souvent `_position` lui-même, et la boucle la déplace. Lire
   * l'origine après coup rendrait la position de la tête dépendante de l'ordre
   * des instructions — un piège classique des vecteurs temporaires partagés.
   */
  const majArnLibre = (origine: THREE.Vector3, nbGrains: number, taille: number): void => {
    teteBrin.copy(origine)
    _position.copy(origine)
    for (let i = 0; i < NB_GRAINS; i++) {
      if (i < nbGrains) {
        if (i > 0) {
          _position.x += repli[i * 3]! * PAS_ARN
          _position.y += repli[i * 3 + 1]! * PAS_ARN
          _position.z += repli[i * 3 + 2]! * PAS_ARN
        }
        _echelle.setScalar(taille)
      } else {
        _echelle.setScalar(0)
      }
      _matrice.compose(_position, ROTATION_NULLE, _echelle)
      arn.setMatrixAt(i, _matrice)
    }
    arn.instanceMatrix.needsUpdate = true
  }

  /** Le brin tendu, défilant dans le ribosome, codon par codon. */
  const majArnDansRibosome = (codons: number, fraction: number): void => {
    // Le brin glisse d'un codon vers la gauche à chaque pas : le codon lu est
    // toujours au même endroit, sous l'interface des deux sous-unités.
    const glissement = (codons + fraction) * PAS_ARN
    _echelle.setScalar(1)
    for (let i = 0; i < NB_GRAINS; i++) {
      _position.set(
        X_RIBOSOME + (i - NB_GRAINS / 2) * PAS_ARN - glissement + (NB_GRAINS / 2) * PAS_ARN,
        -RAYON_GRANDE * 0.05,
        0,
      )
      _matrice.compose(_position, ROTATION_NULLE, _echelle)
      arn.setMatrixAt(i, _matrice)
    }
    arn.instanceMatrix.needsUpdate = true
  }

  /** La chaîne d'acides aminés, colorée par classe, sortant du tunnel. */
  const majChaine = (atelier: Atelier): void => {
    const compteurs = new Map<string, number>()
    for (const classe of chaines.keys()) compteurs.set(classe, 0)
    _echelle.setScalar(1)
    for (let i = 0; i < atelier.codons; i++) {
      const residu = atelier.gene.residus[i]
      if (!residu) continue
      const maillage = chaines.get(residu.classe)
      if (!maillage) continue
      // Elle sort par le tunnel de la grande sous-unité et s'enroule : une
      // chaîne naissante n'est jamais tendue, elle commence à se replier dès
      // qu'elle a de quoi.
      const t = i * 0.5
      const rayon = 0.004 + i * 0.00035
      _position.set(
        Math.cos(t) * rayon * 0.6,
        RAYON_PETITE * 0.75 + RAYON_GRANDE * 0.75 + i * 0.0009,
        Math.sin(t) * rayon,
      )
      _matrice.compose(_position, ROTATION_NULLE, _echelle)
      const n = compteurs.get(residu.classe)!
      maillage.setMatrixAt(n, _matrice)
      compteurs.set(residu.classe, n + 1)
    }
    for (const [classe, maillage] of chaines) {
      maillage.count = compteurs.get(classe)!
      maillage.instanceMatrix.needsUpdate = true
    }
  }

  /** Les ARN de transfert qui cognent, et celui qui s'installe. */
  const majArnt = (atelier: Atelier, temps: number, actif: boolean): void => {
    for (let i = 0; i < NB_ARNT; i++) {
      if (!actif) {
        _echelle.setScalar(0)
        _matrice.compose(_position, ROTATION_NULLE, _echelle)
        arnt.setMatrixAt(i, _matrice)
        continue
      }
      // Chacun arrive de sa direction, touche, et repart. Le dernier reste :
      // c'est celui dont l'anticodon apparie le codon lu.
      const gagnant = i === arntGagnant(atelier.codons, NB_ARNT)
      const phase = (temps * 0.7 + i / NB_ARNT) % 1
      const approche = gagnant ? 1 - lissage(1 - atelier.fractionCodon) : Math.sin(phase * Math.PI)
      const distance = 0.05 * (1 - approche) + RAYON_PETITE * 1.2
      _position.set(
        X_RIBOSOME + capsArnt[i * 3]! * distance,
        -RAYON_GRANDE * 0.72 + capsArnt[i * 3 + 1]! * distance * 0.6,
        capsArnt[i * 3 + 2]! * distance,
      )
      _echelle.setScalar(1)
      _matrice.compose(_position, ROTATION_NULLE, _echelle)
      arnt.setMatrixAt(i, _matrice)
    }
    arnt.instanceMatrix.needsUpdate = true
  }

  const animer = (atelier: Atelier, temps: number): void => {
    sequence = atelier.gene.adn

    const enTranscription = atelier.etape === 'transcription'
    const tetePb = enTranscription ? atelier.bases : 0
    majGene(tetePb, enTranscription ? 1 : 0)

    // La polymérase suit la tête, et disparaît dès qu'elle a fini.
    polymerase.position.set((tetePb - NB_PB / 2) * MONTEE, 0.004, 0)
    polymerase.scale.setScalar(enTranscription ? 1 : 0)

    // ── Où est le brin, et de quelle longueur ? ────────────────────────────
    const grainsTranscrits = Math.min(NB_GRAINS, Math.floor(atelier.bases / 3))
    switch (atelier.etape) {
      case 'repos':
        majArnLibre(_position.set(0, 0, 0), 0, 0)
        coiffe.scale.setScalar(0)
        break

      case 'transcription': {
        // Le transcrit sort par le canal latéral de l'enzyme et s'allonge.
        _position.set(X_GENE + (tetePb - NB_PB / 2) * MONTEE, 0.009, -0.004)
        majArnLibre(_position, grainsTranscrits, 1)
        coiffe.scale.setScalar(atelier.bases >= 25 ? 1 : 0)
        coiffe.position.copy(teteBrin)
        break
      }

      case 'coiffe': {
        _position.set(X_GENE + LONGUEUR_GENE * 0.5, 0.012, -0.004)
        majArnLibre(_position, NB_GRAINS, 1)
        // La coiffe pulse une fois : elle vient d'être posée.
        coiffe.scale.setScalar(1 + Math.sin(temps * 6) * 0.25)
        coiffe.position.copy(teteBrin)
        break
      }

      case 'export': {
        // Il franchit le pore, tête la première, et doit se déplier pour entrer.
        const t = lissage(atelier.horloge / 4.5)
        _position.set(
          THREE.MathUtils.lerp(X_GENE + LONGUEUR_GENE * 0.5, 0.022, t),
          THREE.MathUtils.lerp(0.012, 0.05, t),
          -0.004 * (1 - t),
        )
        majArnLibre(_position, NB_GRAINS, 1)
        coiffe.scale.setScalar(1)
        coiffe.position.copy(teteBrin)
        break
      }

      case 'attente': {
        // Il flotte, et il est saisissable. La pulsation est l'affordance :
        // sans elle, rien ne dirait qu'on peut le prendre.
        // Il flotte du côté cytosolique du pore, à quatre-vingts nanomètres du
        // ribosome : assez loin pour que le porter soit un geste, et non un
        // clic accidentel. Un brin qui reposerait déjà dans la zone de dépôt
        // rendrait l'interaction fictive.
        if (brinTenu) _position.copy(brinTenu)
        else _position.set(0.022, 0.05 + Math.sin(temps * 1.6) * 0.005, 0)
        majArnLibre(_position, NB_GRAINS, 1)
        coiffe.scale.setScalar(1)
        coiffe.position.copy(teteBrin)
        break
      }

      case 'traduction':
      case 'termine': {
        majArnDansRibosome(atelier.codons, atelier.fractionCodon)
        coiffe.scale.setScalar(0)
        break
      }
    }

    // ── Le ribosome ───────────────────────────────────────────────────────
    const traduit = atelier.etape === 'traduction'
    // Les deux sous-unités se rapprochent quand elles tiennent un brin, et se
    // séparent à la libération : un ribosome n'est assemblé qu'en travail.
    const serrage = traduit ? 1 : atelier.etape === 'termine' ? 0 : 0.35
    grande.position.y = RAYON_PETITE * 0.75 + (1 - serrage) * 0.012
    petite.position.y = -RAYON_GRANDE * 0.72 - (1 - serrage) * 0.012
    // Le mouvement est un CLIQUET, pas un glissement : les sous-unités pivotent
    // l'une contre l'autre au moment de la translocation, puis tout se fige.
    const cliquet = traduit ? lissage((atelier.fractionCodon - 0.8) / 0.2) : 0
    petite.rotation.y = cliquet * 0.22

    majChaine(atelier)
    majArnt(atelier, temps, traduit)
  }

  return {
    objet: groupe,
    ancre: centre.clone(),
    rayonCadrage: 0.088,
    // Très peu de X : on regarde la disposition de côté, en plongée légère.
    directionCadrage: new THREE.Vector3(0.12, 0.42, 0.9)
      .normalize()
      .applyQuaternion(groupe.quaternion),
    positionBrin: (sortie) => {
      groupe.updateMatrixWorld(true)
      return sortie.copy(teteBrin).applyMatrix4(groupe.matrixWorld)
    },
    positionRibosome: (sortie) => {
      groupe.updateMatrixWorld(true)
      return sortie.set(X_RIBOSOME, 0, 0).applyMatrix4(groupe.matrixWorld)
    },
    get brinTenu() {
      return brinTenu
    },
    set brinTenu(valeur: THREE.Vector3 | null) {
      brinTenu = valeur
    },
    animer,
  }
}

/** Convertit un point monde en coordonnées locales du plateau. */
export function versLocal(
  scene: SceneAtelier,
  monde: THREE.Vector3,
  sortie: THREE.Vector3,
): THREE.Vector3 {
  scene.objet.updateMatrixWorld(true)
  return sortie.copy(monde).applyMatrix4(_matriceInverse.copy(scene.objet.matrixWorld).invert())
}

const _matriceInverse = new THREE.Matrix4()

/**
 * À quelle distance du ribosome le brin est pris, en micromètres.
 *
 * Trente nanomètres, c'est-à-dire le diamètre du ribosome lui-même : le
 * critère est « assez près pour le toucher », ce qui est une distance
 * biologique et non un nombre de pixels. Le brin au repos en est à quatre-vingts.
 */
export const RAYON_DEPOT = 0.03
