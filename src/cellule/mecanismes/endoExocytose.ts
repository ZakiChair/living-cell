import * as THREE from 'three'
import { RAYON_CELLULE, TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import type { Mecanisme } from './contrat.js'

/**
 * ENDOCYTOSE ET EXOCYTOSE À LA MEMBRANE PLASMIQUE.
 *
 * Deux mécanismes distincts parce que leurs échelles de temps sont
 * inconciliables : un puits de clathrine met une minute à naître, se pincer et
 * perdre son manteau ; le pore de fusion, lui, s'ouvre en moins d'une
 * milliseconde. Un facteur unique mentirait sur l'un ou sur l'autre.
 *
 * Les deux se répondent : chaque fusion AJOUTE la surface d'une vésicule à la
 * membrane plasmique, chaque puits en RETIRE autant. Une cellule qui sécrète
 * sans internaliser gonflerait jusqu'à éclater.
 *
 * Tout est en micromètres : la vésicule à clathrine fait 0,09 µm de membrane,
 * son manteau 0,127 µm de bord à bord, un complexe SNARE 0,012 µm de long. Ce
 * sont les tailles vraies ; c'est pour cela qu'il faut cadrer serré.
 */

// ── Repères ────────────────────────────────────────────────────────────────
/** Les deux zones dégagées de la membrane où l'on travaille. */
const DIR_ENDOCYTOSE = new THREE.Vector3(0.15, 0.85, 0.5).normalize()
const DIR_EXOCYTOSE = new THREE.Vector3(0.6, -0.5, 0.62).normalize()
/** Demi-côté du carré de membrane traité : 1,5 µm de large en tout. */
const DEMI_PATCH = 0.75

const AXE_Y = new THREE.Vector3(0, 1, 0)
const AXE_Z = new THREE.Vector3(0, 0, 1)

// ── Temporaires hissés : animer() n'alloue jamais ───────────────────────────
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _e = new THREE.Vector3(1, 1, 1)
const _m = new THREE.Matrix4()
const _d = new THREE.Vector3()

function liss(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x
  return t * t * (3 - 2 * t)
}

/**
 * Enfoncement de la sphère cellulaire sous le plan tangent, à la distance `r`
 * de l'axe du site. Sur 0,75 µm il vaut 28 nm : ténu, mais sans lui le carré de
 * membrane serait un disque plat posé sur une bille et le raccord se verrait.
 */
function creuxSphere(r: number): number {
  return Math.sqrt(Math.max(0, RAYON_CELLULE * RAYON_CELLULE - r * r)) - RAYON_CELLULE
}

/** Pose une instance sphérique. Tous les canaux sont réécrits à chaque appel. */
function poser(
  maillage: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  taille: number,
): void {
  _p.set(x, y, z)
  _q.identity()
  _e.setScalar(taille)
  _m.compose(_p, _q, _e)
  maillage.setMatrixAt(i, _m)
}

/** Pose un cylindre unité (rayon 1, hauteur 1, axe Y) entre deux points. */
function poserSegment(
  maillage: THREE.InstancedMesh,
  i: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  epaisseur: number,
): void {
  _d.set(bx - ax, by - ay, bz - az)
  const longueur = _d.length()
  if (longueur < 1e-9 || epaisseur <= 0) {
    poser(maillage, i, ax, ay, az, 0)
    return
  }
  _d.divideScalar(longueur)
  _q.setFromUnitVectors(AXE_Y, _d)
  _p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
  _e.set(epaisseur, longueur, epaisseur)
  _m.compose(_p, _q, _e)
  maillage.setMatrixAt(i, _m)
}

/**
 * Errance procédurale : somme de deux sinus de périodes incommensurables.
 *
 * Ce n'est pas une intégration brownienne, mais la propriété qui compte est
 * là — la trajectoire n'est corrélée à aucune cible. Une molécule qui « vise »
 * son site est le mensonge le plus fréquent des animations cellulaires.
 */
function errer(t: number, par: Float32Array, base: number): number {
  return (
    0.62 * Math.sin(t * par[base]! + par[base + 1]!) +
    0.38 * Math.sin(t * par[base + 2]! + par[base + 3]!)
  )
}

function tirerErrance(par: Float32Array, base: number, alea: () => number): void {
  par[base] = 0.28 + alea() * 0.75
  par[base + 1] = alea() * Math.PI * 2
  par[base + 2] = 0.9 + alea() * 2.4
  par[base + 3] = alea() * Math.PI * 2
}

/** Repère local posé sur la membrane : +Z est la normale sortante. */
function reperMembrane(direction: THREE.Vector3): THREE.Group {
  const groupe = new THREE.Group()
  groupe.position.copy(direction).multiplyScalar(RAYON_CELLULE)
  groupe.quaternion.setFromUnitVectors(AXE_Z, direction)
  return groupe
}

// ── Surface de révolution déformable ───────────────────────────────────────
/**
 * Le carré de membrane est une surface de RÉVOLUTION, pas une grille de
 * hauteurs. Un champ de hauteurs ne peut pas décrire un surplomb, or c'est
 * précisément ce qu'est une vésicule presque fermée retenue par un col : la
 * membrane repasse au-dessus d'elle-même. Le profil (r, z) le fait sans peine.
 */
const NU_CALOTTE = 24
const NU_COL = 6
const NU_EVASE = 10
const NU = NU_CALOTTE + NU_COL + NU_EVASE
const NV = 28

interface SurfaceRevolution {
  maillage: THREE.Mesh
  rayons: Float32Array
  cotes: Float32Array
  appliquer: () => void
}

function creerSurfaceRevolution(materiau: THREE.Material): SurfaceRevolution {
  const positions = new Float32Array(NU * NV * 3)
  const normales = new Float32Array(NU * NV * 3)
  const indices: number[] = []
  for (let u = 0; u < NU - 1; u++) {
    for (let v = 0; v < NV; v++) {
      const w = (v + 1) % NV
      const a = u * NV + v
      const b = u * NV + w
      const c = (u + 1) * NV + v
      const d = (u + 1) * NV + w
      indices.push(a, c, b, b, c, d)
    }
  }
  const geometrie = new THREE.BufferGeometry()
  geometrie.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometrie.setAttribute('normal', new THREE.BufferAttribute(normales, 3))
  geometrie.setIndex(indices)

  const cos = new Float32Array(NV)
  const sin = new Float32Array(NV)
  for (let v = 0; v < NV; v++) {
    const a = (v / NV) * Math.PI * 2
    cos[v] = Math.cos(a)
    sin[v] = Math.sin(a)
  }

  const rayons = new Float32Array(NU)
  const cotes = new Float32Array(NU)
  const maillage = new THREE.Mesh(geometrie, materiau)
  // La géométrie change à chaque image : sa sphère englobante serait périmée.
  maillage.frustumCulled = false

  const appliquer = (): void => {
    for (let u = 0; u < NU; u++) {
      const um = u > 0 ? u - 1 : 0
      const up = u < NU - 1 ? u + 1 : NU - 1
      const dr = rayons[up]! - rayons[um]!
      const dz = cotes[up]! - cotes[um]!
      // Math.hypot est variadique ; dans une boucle à 60 images par seconde on
      // ne veut pas dépendre de la façon dont le moteur traite ses arguments.
      const l = Math.sqrt(dr * dr + dz * dz)
      // Au repos le bourgeon se replie sur l'axe et deux dizaines
      // d'échantillons deviennent confondus : normaliser (0,0) donnerait des
      // NaN qui noircissent le maillage sans lever la moindre erreur. La
      // normale de la membrane plate est alors la bonne réponse.
      const nr = l > 1e-9 ? -dz / l : 0
      const nz = l > 1e-9 ? dr / l : 1
      const r = rayons[u]!
      const z = cotes[u]!
      for (let v = 0; v < NV; v++) {
        const i = (u * NV + v) * 3
        positions[i] = r * cos[v]!
        positions[i + 1] = r * sin[v]!
        positions[i + 2] = z
        normales[i] = nr * cos[v]!
        normales[i + 1] = nr * sin[v]!
        normales[i + 2] = nz
      }
    }
    geometrie.attributes.position!.needsUpdate = true
    geometrie.attributes.normal!.needsUpdate = true
  }

  return { maillage, rayons, cotes, appliquer }
}

/**
 * Écrit le profil : calotte sphérique (le bourgeon) + col + évasement plat.
 *
 * `rho` est le rayon de la sphère du bourgeon et `beta` son demi-angle. Le même
 * couple décrit tous les états : à beta nul la membrane est plate, à beta = 2,7
 * c'est une vésicule que seul un col de 19 nm retient encore. `pincement`
 * resserre ce col — c'est le geste de la dynamine, et à l'envers celui du pore
 * de fusion qui s'ouvre.
 */
function remplirProfil(
  s: SurfaceRevolution,
  rho: number,
  beta: number,
  pincement: number,
  longueurCol: number,
): void {
  const rCol = rho * Math.sin(beta) * pincement
  for (let k = 0; k < NU_CALOTTE; k++) {
    const u = k / (NU_CALOTTE - 1)
    const psi = beta * u
    // Le pincement ne mord que sur le dernier cinquième : un col se serre,
    // un bourgeon ne se dégonfle pas.
    const f = 1 + (pincement - 1) * liss((u - 0.78) / 0.22)
    s.rayons[k] = rho * Math.sin(psi) * f
    s.cotes[k] = rho * (Math.cos(beta) - Math.cos(psi)) - longueurCol
  }
  for (let k = 0; k < NU_COL; k++) {
    const v = (k + 1) / NU_COL
    s.rayons[NU_CALOTTE + k] = rCol * (1 + 0.25 * v * v)
    s.cotes[NU_CALOTTE + k] = longueurCol * (0.7 * v - 1)
  }
  const rLevre = rCol * 1.25
  for (let k = 0; k < NU_EVASE; k++) {
    const v = (k + 1) / NU_EVASE
    const r = rLevre + (DEMI_PATCH - rLevre) * v * v
    s.rayons[NU_CALOTTE + NU_COL + k] = r
    s.cotes[NU_CALOTTE + NU_COL + k] = -0.3 * longueurCol * (1 - liss(v)) + creuxSphere(r)
  }
  s.appliquer()
}

// ── La cage de clathrine ───────────────────────────────────────────────────
/**
 * Le manteau n'est pas une bulle lisse : c'est un polyèdre d'hexagones et de
 * pentagones, et c'est à ce dessin qu'on le reconnaît sur une micrographie.
 *
 * On prend l'icosaèdre tronqué — 60 moyeux, 90 arêtes, 12 pentagones et 20
 * hexagones. Chaque moyeu est un triskèle, chaque arête le chevauchement de
 * deux jambes. L'axe d'assemblage traverse un centre d'hexagone : les six
 * sommets les plus éloignés (θ = 2,73) restent donc hors du manteau, ce qui
 * laisse autour du col l'ouverture hexagonale que le manteau ne referme jamais.
 */
const NB_MOYEUX = 60
const NB_ARETES = 90
/** Ouverture maximale du manteau, en angle polaire depuis son pôle. */
const THETA_MANTEAU = 2.7

interface Cage {
  theta: Float32Array
  phi: Float32Array
  aretes: Uint8Array
}

function construireCage(): Cage {
  const phiOr = (1 + Math.sqrt(5)) / 2
  const socles = [
    [0, 1, 3 * phiOr],
    [1, 2 + phiOr, 2 * phiOr],
    [phiOr, 2, 2 * phiOr + 1],
  ]
  const sommets: number[][] = []
  const vus = new Set<string>()
  for (const socle of socles) {
    for (let perm = 0; perm < 3; perm++) {
      const t = [socle[perm % 3]!, socle[(perm + 1) % 3]!, socle[(perm + 2) % 3]!]
      for (const sx of [1, -1]) {
        for (const sy of [1, -1]) {
          for (const sz of [1, -1]) {
            const v = [t[0]! * sx, t[1]! * sy, t[2]! * sz]
            const cle = v.map((x) => x.toFixed(6)).join(',')
            if (!vus.has(cle)) {
              vus.add(cle)
              sommets.push(v)
            }
          }
        }
      }
    }
  }

  const rayon = Math.hypot(sommets[0]![0]!, sommets[0]![1]!, sommets[0]![2]!)
  // Axe d'ordre 3 de l'icosaèdre : il perce un centre d'hexagone.
  const a = 1 / Math.sqrt(3)
  const e1 = [a * Math.sqrt(1.5), -a * Math.sqrt(1.5), 0]
  const e2 = [1 / Math.sqrt(6), 1 / Math.sqrt(6), -2 / Math.sqrt(6)]

  const theta = new Float32Array(NB_MOYEUX)
  const phi = new Float32Array(NB_MOYEUX)
  for (let i = 0; i < NB_MOYEUX; i++) {
    const v = sommets[i]!
    const proj = (v[0]! + v[1]! + v[2]!) * a / rayon
    theta[i] = Math.acos(Math.max(-1, Math.min(1, proj)))
    phi[i] = Math.atan2(
      v[0]! * e2[0]! + v[1]! * e2[1]! + v[2]! * e2[2]!,
      v[0]! * e1[0]! + v[1]! * e1[1]! + v[2]! * e1[2]!,
    )
  }

  const aretes = new Uint8Array(NB_ARETES * 2)
  let n = 0
  for (let i = 0; i < NB_MOYEUX; i++) {
    for (let j = i + 1; j < NB_MOYEUX; j++) {
      const vi = sommets[i]!
      const vj = sommets[j]!
      const d = Math.hypot(vi[0]! - vj[0]!, vi[1]! - vj[1]!, vi[2]! - vj[2]!)
      // L'arête canonique du solide vaut exactement 2.
      if (Math.abs(d - 2) < 1e-6 && n < NB_ARETES) {
        aretes[n * 2] = i
        aretes[n * 2 + 1] = j
        n++
      }
    }
  }
  return { theta, phi, aretes }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENDOCYTOSE PAR PUITS RECOUVERT DE CLATHRINE
// ═══════════════════════════════════════════════════════════════════════════

/** Le cycle complet tient en 20 s d'écran pour 45 s réelles : accéléré ×2,3. */
const PERIODE_ENDO = 20
/** Rayon de la membrane de la vésicule : 45 nm, soit 90 nm de diamètre. */
const RV_ENDO = 0.045
/** Épaisseur du manteau, du feuillet cytosolique au sommet des triskèles. */
const EPAISSEUR_MANTEAU = 0.015
/** Longueur du col à maturité : 22 nm, la place exacte d'un collier de dynamine. */
const COL_ENDO = 0.022
/** Cote du centre du bourgeon à l'instant du pincement : la vésicule y naît. */
const Z_SOUDURE_ENDO = RV_ENDO * Math.cos(THETA_MANTEAU) - COL_ENDO

// Jalons du cycle, en fraction de période.
const E_CROISSANCE = 0.42
const E_COURBURE_DEB = 0.1
const E_COURBURE_FIN = 0.46
const E_DYNAMINE_DEB = 0.4
const E_DYNAMINE_FIN = 0.51
const E_CONSTRICTION = 0.52
const E_SCISSION = 0.6
/** Le puits se referme en une demi-seconde d'écran : une rupture n'est pas un fondu. */
const E_RELAX = 0.625
const E_DECAPAGE_DEB = 0.66
const E_DECAPAGE_FIN = 0.86

const NB_DYNAMINE_COLLIER = 38
const NB_DYNAMINE_LIBRE = 8
const NB_DYNAMINE = NB_DYNAMINE_COLLIER + NB_DYNAMINE_LIBRE
const NB_TRISKELES = 6
const BRAS_PAR_TRISKELE = 3
const GRAINS_PAR_BRAS = 6
const NB_GRAINS_TRISKELE = NB_TRISKELES * BRAS_PAR_TRISKELE * GRAINS_PAR_BRAS
const NB_RECEPTEURS = 130
/** Trois manteaux : un qui aboutit, deux qui avortent. */
const NB_CAGES = 3

function creerEndocytose(): Mecanisme {
  const alea = creerAlea(0x454e444f)
  const groupe = reperMembrane(DIR_ENDOCYTOSE)
  const cage = construireCage()

  // ── Membrane ────────────────────────────────────────────────────────────
  // Translucide, sinon le puits creusé vers le cytosol serait caché par la
  // membrane elle-même dès que la caméra regarde depuis l'extérieur.
  const surface = creerSurfaceRevolution(materiauOrganite(TEINTES.membrane, { opacite: 0.5 }))
  // Un cheveu en deçà de la coquille globale de la scène, pour ne pas lutter
  // avec elle dans le tampon de profondeur.
  surface.maillage.position.z = -0.003
  groupe.add(surface.maillage)

  const vesiculeLibre = new THREE.Mesh(
    new THREE.SphereGeometry(RV_ENDO, 20, 14),
    materiauOrganite(TEINTES.membrane, { opacite: 0.55 }),
  )
  vesiculeLibre.frustumCulled = false
  groupe.add(vesiculeLibre)

  // ── Manteau ─────────────────────────────────────────────────────────────
  const matiereClathrine = materiauOrganite(0x8a5bb0, { doubleFace: false })
  const aretes = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1, 1, 1, 5, 1, true),
    matiereClathrine,
    NB_CAGES * NB_ARETES,
  )
  const moyeux = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0035, 0),
    matiereClathrine,
    NB_CAGES * NB_MOYEUX,
  )
  aretes.frustumCulled = false
  moyeux.frustumCulled = false
  groupe.add(aretes, moyeux)

  // Ordre de décapage : le manteau ne se défait pas par le bord mais par
  // arrachement de triskèles au hasard, sous la poussée de Hsc70.
  const rangDecapage = new Float32Array(NB_MOYEUX)
  for (let i = 0; i < NB_MOYEUX; i++) rangDecapage[i] = 0.05 + alea() * 0.9

  // Positions des 60 moyeux de la cage en cours de tracé.
  const pointsCage = new Float32Array(NB_MOYEUX * 3)

  // ── Triskèles libres ────────────────────────────────────────────────────
  // Un triskèle mesure 90 nm d'un bout de bras à l'autre : il est aussi large
  // que la vésicule qu'il aidera à faire. C'est vrai et c'est déroutant.
  const matiereTriskele = materiauOrganite(0x8a5bb0, { doubleFace: false })
  const triskeles = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0025, 0),
    matiereTriskele,
    NB_GRAINS_TRISKELE,
  )
  triskeles.frustumCulled = false
  groupe.add(triskeles)

  const offsetsTriskele = new Float32Array(NB_GRAINS_TRISKELE * 3)
  const erranceTriskele = new Float32Array(NB_TRISKELES * 12)
  const centreTriskele = new Float32Array(NB_TRISKELES * 3)
  for (let t = 0; t < NB_TRISKELES; t++) {
    // Orientation quelconque : trois bras à 120° dans un plan tiré au sort,
    // chacun recourbé hors de ce plan comme la jambe d'un vrai triskèle.
    const az = alea() * Math.PI * 2
    const el = (alea() - 0.5) * Math.PI
    const nx = Math.cos(el) * Math.cos(az)
    const ny = Math.cos(el) * Math.sin(az)
    const nz = Math.sin(el)
    const ux = -Math.sin(az)
    const uy = Math.cos(az)
    const vx = ny * 0 - nz * uy
    const vy = nz * ux - nx * 0
    const vz = nx * uy - ny * ux
    for (let b = 0; b < BRAS_PAR_TRISKELE; b++) {
      const ang = (b / BRAS_PAR_TRISKELE) * Math.PI * 2 + alea() * 0.3
      const dx = ux * Math.cos(ang) + vx * Math.sin(ang)
      const dy = uy * Math.cos(ang) + vy * Math.sin(ang)
      const dz = Math.sin(ang) * vz
      for (let g = 0; g < GRAINS_PAR_BRAS; g++) {
        const s = ((g + 1) / GRAINS_PAR_BRAS) * 0.045
        // La jambe se replie vers le pôle : c'est cette courbure qui impose au
        // manteau sa forme fermée plutôt qu'un tapis plat.
        const pli = s * s * 9
        const i = ((t * BRAS_PAR_TRISKELE + b) * GRAINS_PAR_BRAS + g) * 3
        offsetsTriskele[i] = dx * s + nx * pli
        offsetsTriskele[i + 1] = dy * s + ny * pli
        offsetsTriskele[i + 2] = dz * s + nz * pli
      }
    }
    for (let k = 0; k < 3; k++) tirerErrance(erranceTriskele, t * 12 + k * 4, alea)
    centreTriskele[t * 3] = (alea() - 0.5) * 0.44
    centreTriskele[t * 3 + 1] = (alea() - 0.5) * 0.44
    centreTriskele[t * 3 + 2] = -0.1 - alea() * 0.22
  }

  // ── Dynamine ────────────────────────────────────────────────────────────
  const dynamine = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.005, 0),
    materiauOrganite(0x00c78f, { doubleFace: false }),
    NB_DYNAMINE,
  )
  dynamine.frustumCulled = false
  groupe.add(dynamine)
  // Errance propre à la vésicule détachée : lui prêter celle d'un triskèle
  // ferait glisser ce triskèle en ligne droite au lieu de le faire errer.
  const erranceVesicule = new Float32Array(12)
  for (let k = 0; k < 3; k++) tirerErrance(erranceVesicule, k * 4, alea)
  const erranceDynamine = new Float32Array(NB_DYNAMINE_LIBRE * 12)
  for (let i = 0; i < NB_DYNAMINE_LIBRE * 3; i++) tirerErrance(erranceDynamine, i * 4, alea)

  // ── Récepteurs et fret ──────────────────────────────────────────────────
  const recepteurs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.006, 0),
    materiauOrganite(TEINTES.proteineMembranaire, { doubleFace: false }),
    NB_RECEPTEURS,
  )
  const fret = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.009, 0),
    materiauOrganite(0xd55e00, { doubleFace: false }),
    NB_RECEPTEURS,
  )
  recepteurs.frustumCulled = false
  fret.frustumCulled = false
  groupe.add(recepteurs, fret)

  // 10 flottants par récepteur : base (2) + errance en x (4) et en y (4).
  const PAS_REC = 10
  const parRecepteur = new Float32Array(NB_RECEPTEURS * PAS_REC)
  const aFret = new Uint8Array(NB_RECEPTEURS)
  for (let i = 0; i < NB_RECEPTEURS; i++) {
    const r = 0.38 * Math.sqrt(alea())
    const a = alea() * Math.PI * 2
    parRecepteur[i * PAS_REC] = r * Math.cos(a)
    parRecepteur[i * PAS_REC + 1] = r * Math.sin(a)
    tirerErrance(parRecepteur, i * PAS_REC + 2, alea)
    tirerErrance(parRecepteur, i * PAS_REC + 6, alea)
    aFret[i] = alea() < 0.62 ? 1 : 0
  }
  /** Récepteur pris au piège du manteau : arc conservé depuis le pôle. */
  const capture = new Uint8Array(NB_RECEPTEURS)
  const thetaCapture = new Float32Array(NB_RECEPTEURS)
  const phiCapture = new Float32Array(NB_RECEPTEURS)
  let pPrecedent = 1

  const animer = (temps: number): void => {
    const p = (((temps / PERIODE_ENDO) % 1) + 1) % 1
    // Nouveau tour : la vésicule est partie, ses récepteurs avec elle, et la
    // membrane repart avec un semis neuf.
    if (p < pPrecedent) capture.fill(0)
    pPrecedent = p

    const avantScission = p < E_SCISSION
    const courbure = Math.min(
      1,
      0.03 + 0.97 * liss((p - E_COURBURE_DEB) / (E_COURBURE_FIN - E_COURBURE_DEB)),
    )
    const thetaMax = THETA_MANTEAU * liss(p / E_CROISSANCE)
    const relax = liss((p - E_SCISSION) / (E_RELAX - E_SCISSION))
    const pincement = Math.max(
      0.03,
      1 - 0.97 * liss((p - E_CONSTRICTION) / (E_SCISSION - E_CONSTRICTION)),
    )
    const longueurCol = COL_ENDO * liss((p - 0.2) / 0.28) * (1 - relax)
    const rhoMembrane = (RV_ENDO / courbure) * (1 - relax)
    const beta = thetaMax * courbure
    remplirProfil(surface, rhoMembrane, beta, pincement, longueurCol)

    // Vésicule détachée : elle s'enfonce dans le cytosol en errant, elle ne
    // « part » nulle part.
    const tv = temps
    const derive = liss((p - E_SCISSION) / 0.3)
    const vx = derive * 0.16 * errer(tv, erranceVesicule, 0)
    const vy = derive * 0.16 * errer(tv, erranceVesicule, 4)
    const vz = Z_SOUDURE_ENDO - derive * 0.34 + derive * 0.05 * errer(tv, erranceVesicule, 8)
    // La scission est une rupture : la vésicule est là ou elle n'y est pas. Elle
    // paraît à l'endroit exact qu'occupait le bourgeon, qui se referme derrière.
    const echelleVes = avantScission ? 0 : 1 - liss((p - 0.93) / 0.04)
    vesiculeLibre.visible = echelleVes > 0.001
    vesiculeLibre.position.set(vx, vy, vz)
    vesiculeLibre.scale.setScalar(echelleVes)

    // Repère du manteau productif : avant la scission il colle au bourgeon,
    // après il colle à la vésicule libre — et la formule est la même.
    const rhoCage = avantScission ? rhoMembrane : RV_ENDO
    const courbureCage = avantScission ? courbure : 1
    const cxCage = avantScission ? 0 : vx
    const cyCage = avantScission ? 0 : vy
    const zcCage = avantScission ? rhoMembrane * Math.cos(beta) - longueurCol : vz
    const decapage = liss((p - E_DECAPAGE_DEB) / (E_DECAPAGE_FIN - E_DECAPAGE_DEB))

    for (let g = 0; g < NB_CAGES; g++) {
      let cx: number
      let cy: number
      let zc: number
      let rho: number
      let c: number
      let ouverture: number
      let vivant: number
      if (g === 0) {
        cx = cxCage
        cy = cyCage
        zc = zcCage
        rho = rhoCage
        c = courbureCage
        ouverture = thetaMax
        vivant = 1
      } else {
        // Puits abortifs : ils s'assemblent, restent plats, se défont. Plus de
        // la moitié des puits d'une cellule finissent ainsi ; les montrer
        // aboutir à tous les coups serait la caricature habituelle.
        const decal = g === 1 ? 0.37 : 0.71
        const pg = ((p + decal) % 1) / 0.3
        const env = pg < 1 ? Math.sin(Math.PI * pg) : 0
        cx = g === 1 ? -0.33 : 0.29
        cy = g === 1 ? 0.21 : -0.35
        c = 0.03 + 0.32 * env
        rho = RV_ENDO / c
        ouverture = THETA_MANTEAU * 0.5 * env
        zc = creuxSphere(Math.sqrt(cx * cx + cy * cy)) + rho * Math.cos(ouverture * c)
        vivant = env > 0.01 ? 1 : 0
      }

      const rayonCage = rho + EPAISSEUR_MANTEAU
      for (let i = 0; i < NB_MOYEUX; i++) {
        const psi = Math.min(Math.PI, cage.theta[i]! * c)
        const s = Math.sin(psi)
        pointsCage[i * 3] = cx + rayonCage * s * Math.cos(cage.phi[i]!)
        pointsCage[i * 3 + 1] = cy + rayonCage * s * Math.sin(cage.phi[i]!)
        pointsCage[i * 3 + 2] = zc - rayonCage * Math.cos(psi)
      }
      for (let i = 0; i < NB_MOYEUX; i++) {
        const pose =
          vivant === 1 && cage.theta[i]! <= ouverture && (g > 0 || rangDecapage[i]! > decapage)
        poser(
          moyeux,
          g * NB_MOYEUX + i,
          pointsCage[i * 3]!,
          pointsCage[i * 3 + 1]!,
          pointsCage[i * 3 + 2]!,
          pose ? 1 : 0,
        )
      }
      for (let a = 0; a < NB_ARETES; a++) {
        const i = cage.aretes[a * 2]!
        const j = cage.aretes[a * 2 + 1]!
        const pose =
          vivant === 1 &&
          cage.theta[i]! <= ouverture &&
          cage.theta[j]! <= ouverture &&
          (g > 0 || (rangDecapage[i]! > decapage && rangDecapage[j]! > decapage))
        poserSegment(
          aretes,
          g * NB_ARETES + a,
          pointsCage[i * 3]!,
          pointsCage[i * 3 + 1]!,
          pointsCage[i * 3 + 2]!,
          pointsCage[j * 3]!,
          pointsCage[j * 3 + 1]!,
          pointsCage[j * 3 + 2]!,
          pose ? 0.0022 : 0,
        )
      }
    }
    aretes.instanceMatrix.needsUpdate = true
    moyeux.instanceMatrix.needsUpdate = true

    // ── Dynamine ──────────────────────────────────────────────────────────
    // Elle ne se pose pas d'un bloc : elle polymérise tour après tour autour du
    // col, puis hydrolyse du GTP et se resserre. Le collier suit le col.
    const rCol = rhoMembrane * Math.sin(beta) * pincement
    const enroulement = liss((p - E_DYNAMINE_DEB) / (E_DYNAMINE_FIN - E_DYNAMINE_DEB))
    const presenceDyn = liss((p - E_DYNAMINE_DEB) / 0.02) * (1 - liss((p - E_SCISSION) / 0.03))
    for (let i = 0; i < NB_DYNAMINE_COLLIER; i++) {
      const u = i / (NB_DYNAMINE_COLLIER - 1)
      const pose = enroulement > u ? presenceDyn : 0
      const ang = u * Math.PI * 2 * 2.2
      const rayon = rCol * 1.15 + 0.012
      poser(
        dynamine,
        i,
        rayon * Math.cos(ang),
        rayon * Math.sin(ang),
        -longueurCol * 0.95 + u * longueurCol * 0.8,
        pose,
      )
    }
    // Quelques dynamines qui passent à côté sans jamais rejoindre le collier.
    const presenceLibre = liss((p - 0.34) / 0.04) * (1 - liss((p - 0.56) / 0.04))
    for (let i = 0; i < NB_DYNAMINE_LIBRE; i++) {
      const b = i * 12
      poser(
        dynamine,
        NB_DYNAMINE_COLLIER + i,
        0.07 * errer(tv, erranceDynamine, b),
        0.07 * errer(tv, erranceDynamine, b + 4),
        -0.055 + 0.045 * errer(tv, erranceDynamine, b + 8),
        presenceLibre,
      )
    }
    dynamine.instanceMatrix.needsUpdate = true

    // ── Triskèles ─────────────────────────────────────────────────────────
    // Trois d'entre eux jouent le cycle complet : libres dans le cytosol, pris
    // dans le manteau, puis ARRACHÉS au décapage et rendus au cytosol. Sans ce
    // dernier temps la clathrine ne serait jamais disponible pour le puits
    // suivant — c'est l'étape que les animations oublient toujours.
    for (let t = 0; t < NB_TRISKELES; t++) {
      const b = t * 12
      const wx = errer(tv, erranceTriskele, b)
      const wy = errer(tv, erranceTriskele, b + 4)
      const wz = errer(tv, erranceTriskele, b + 8)
      let bx: number
      let by: number
      let bz: number
      let ech: number
      if (t < 3 && p >= E_DECAPAGE_DEB) {
        const s = liss((p - E_DECAPAGE_DEB) / 0.26)
        bx = vx + wx * 0.3 * s
        by = vy + wy * 0.3 * s
        bz = vz + wz * 0.22 * s - 0.06 * s
        ech = liss((p - E_DECAPAGE_DEB) / 0.04) * (1 - liss((p - 0.93) / 0.04))
      } else {
        bx = centreTriskele[t * 3]! + wx * 0.18
        by = centreTriskele[t * 3 + 1]! + wy * 0.18
        bz = centreTriskele[t * 3 + 2]! + wz * 0.12
        ech = t < 3 ? 1 - liss((p - 0.55) / 0.05) : 1
      }
      for (let k = 0; k < BRAS_PAR_TRISKELE * GRAINS_PAR_BRAS; k++) {
        const i = t * BRAS_PAR_TRISKELE * GRAINS_PAR_BRAS + k
        poser(
          triskeles,
          i,
          bx + offsetsTriskele[i * 3]!,
          by + offsetsTriskele[i * 3 + 1]!,
          bz + offsetsTriskele[i * 3 + 2]!,
          ech,
        )
      }
    }
    triskeles.instanceMatrix.needsUpdate = true

    // ── Récepteurs et fret ────────────────────────────────────────────────
    // Le manteau ne prélève pas un échantillon de la membrane : il retient ce
    // qui entre dans son emprise. La concentration du fret dans la vésicule est
    // le résultat d'une capture, pas d'un tri intelligent.
    const emprise = rhoMembrane * Math.sin(beta)
    const manteauActif = avantScission && thetaMax > 0.05
    const echelleCapture = avantScission ? 1 : echelleVes
    for (let i = 0; i < NB_RECEPTEURS; i++) {
      const b = i * PAS_REC
      if (capture[i] === 0) {
        const x = parRecepteur[b]! + 0.19 * errer(tv, parRecepteur, b + 2)
        const y = parRecepteur[b + 1]! + 0.19 * errer(tv, parRecepteur, b + 6)
        const dd = Math.sqrt(x * x + y * y)
        if (manteauActif && dd < emprise) {
          capture[i] = 1
          const psi = Math.asin(Math.min(1, dd / rhoMembrane))
          thetaCapture[i] = psi / courbure
          phiCapture[i] = Math.atan2(y, x)
        } else {
          const z = creuxSphere(dd)
          poser(recepteurs, i, x, y, z, 1)
          // Le ligand est accroché côté extérieur, donc vers +Z sur le plat.
          poser(fret, i, x, y, z + 0.013, aFret[i]!)
          continue
        }
      }
      const psi = Math.min(Math.PI, thetaCapture[i]! * courbureCage)
      const rr = rhoCage * Math.sin(psi)
      const x = cxCage + rr * Math.cos(phiCapture[i]!)
      const y = cyCage + rr * Math.sin(phiCapture[i]!)
      const z = zcCage - rhoCage * Math.cos(psi)
      poser(recepteurs, i, x, y, z, echelleCapture)
      // Dans le puits, l'extérieur est du côté du centre de la calotte : le
      // fret se retrouve enfermé dans la lumière de la vésicule.
      const lx = cxCage - x
      const ly = cyCage - y
      const lz = zcCage - z
      const ll = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1
      poser(
        fret,
        i,
        x + (lx / ll) * 0.013,
        y + (ly / ll) * 0.013,
        z + (lz / ll) * 0.013,
        aFret[i]! * echelleCapture,
      )
    }
    recepteurs.instanceMatrix.needsUpdate = true
    fret.instanceMatrix.needsUpdate = true
  }

  animer(0)

  return {
    cle: 'endocytose-clathrine',
    nom: 'Endocytose par puits de clathrine',
    siege: 'Membrane plasmique',
    facteur: 'accéléré ×2,3',
    justificationFacteur:
      "Un puits de clathrine met 30 à 60 s à se creuser, à se pincer et à perdre " +
      "son manteau. Le cycle complet dure ici 20 s d'écran pour 45 s réelles, soit " +
      'un accéléré de ×2,3 environ. Aucun ralenti : à cette échelle de temps, ' +
      "l'endocytose est déjà lisible à l'œil nu.",
    ellision:
      "Le pincement lui-même — la scission par la dynamine — dure moins d'une " +
      "seconde et n'est donc pas ralenti par rapport au reste : il passe vite, comme " +
      'en vrai. Les adaptateurs AP2 qui cousent le manteau aux récepteurs, ' +
      "l'actine qui pousse le puits, et Hsc70 qui arrache les triskèles ne sont pas " +
      'dessinés ; on ne voit que leur effet. Chaque arête est tracée comme un seul ' +
      'segment alors que deux jambes de triskèles s\'y chevauchent. Les deux puits ' +
      'abortifs ne creusent pas la membrane, seul leur manteau est figuré.',
    description:
      'Un manteau de clathrine se polymérise sous la membrane, la courbe, et ' +
      "l'enfonce jusqu'à ne plus laisser qu'un col. La dynamine s'enroule autour de " +
      'ce col comme un ressort, hydrolyse du GTP et le pince : la vésicule se ' +
      "détache. Le manteau se défait alors aussitôt — sans ce décapage, la vésicule " +
      "ne pourrait fusionner avec rien et la clathrine ne servirait qu'une fois. " +
      'Les récepteurs ne sont pas prélevés au hasard : ils sont retenus par le ' +
      'manteau à mesure que leur errance les y amène, et le fret se retrouve ' +
      'concentré dans la vésicule.',
    chiffres: [
      { valeur: '20 à 200 nm', quoi: 'diamètre d\'une vésicule à clathrine ; celle-ci fait 90 nm de membrane et 127 nm avec son manteau' },
      { valeur: '3 bras', quoi: 'un triskèle de clathrine ; il mesure 90 nm d\'un bout de bras à l\'autre, aussi large que la vésicule qu\'il forme' },
      { valeur: '12 pentagones', quoi: 'nombre invariant dans toute cage close, quel que soit le nombre d\'hexagones ; la cage complète compte ici 60 moyeux et 90 arêtes, dont 54 et 78 sont posées — le manteau laisse toujours une ouverture autour du col' },
      { valeur: 'GTP', quoi: 'la dynamine en hydrolyse pour resserrer le col de 19 nm à moins de 2 nm, jusqu\'à la rupture' },
      { valeur: '~50 %', quoi: 'des puits avortent avant de produire une vésicule ; deux en avortent ici pour un qui aboutit' },
      { valeur: '1 heure', quoi: 'le temps qu\'il faut à une cellule pour internaliser l\'équivalent de toute sa surface — d\'où la nécessité de l\'exocytose pour la rendre' },
    ],
    objet: groupe,
    ancre: DIR_ENDOCYTOSE.clone().multiplyScalar(RAYON_CELLULE - 0.04),
    rayonCadrage: 0.5,
    couleur: 0x8a5bb0,
    animer,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXOCYTOSE : AMARRAGE SNARE, PORE DE FUSION, INTÉGRATION DE LA MEMBRANE
// ═══════════════════════════════════════════════════════════════════════════

const PERIODE_EXO = 16
/** Vésicule sécrétoire de 100 nm de diamètre. */
const RV_SEC = 0.05
/** Ouverture de la calotte à l'instant de la fusion : la vésicule est entière. */
const BETA_FUSION = 2.7
const COL_EXO = 0.004

const NB_VESICULES = 4
const GRAINS_PAR_VESICULE = 24
const NB_GRAINS = NB_VESICULES * GRAINS_PAR_VESICULE
const NB_COMPLEXES = 4
const HELICES_PAR_COMPLEXE = 4
const GRAINS_PAR_HELICE = 13
/** 1 nm entre deux grains : le motif SNARE fait 12 nm, et c'est sa vraie taille. */
const PAS_SNARE = 0.001
const RAYON_FAISCEAU = 0.0009
const RAYON_ANCRAGE = 0.024
const NB_TSNARE_LIBRES = 6
const HELICES_TSNARE = 3
const GRAINS_TSNARE = 9
const NB_PROT_VESICULE = 60
/** Amplitude de l'errance des vésicules, tenue dans le cadrage annoncé. */
const AMPL_VES = 0.12
const AMPL_VES_Z = 0.11

// Jalons du cycle.
const X_AMARRAGE_DEB = 0.3
const X_AMARRAGE_FIN = 0.39
const X_SNARE_DEB = 0.33
const X_ZIP_DEB = 0.42
const X_ZIP_FIN = 0.62
const X_FUSION = 0.63
const X_PORE_FIN = 0.73
const X_APLATI_FIN = 0.93
const X_RESET = 0.97

function creerExocytose(): Mecanisme {
  const alea = creerAlea(0x45584f43)
  const groupe = reperMembrane(DIR_EXOCYTOSE)

  const surface = creerSurfaceRevolution(materiauOrganite(TEINTES.membrane, { opacite: 0.5 }))
  surface.maillage.position.z = -0.003
  groupe.add(surface.maillage)

  // ── Vésicules ───────────────────────────────────────────────────────────
  const vesicules = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RV_SEC, 2),
    materiauOrganite(TEINTES.membrane, { opacite: 0.5 }),
    NB_VESICULES,
  )
  vesicules.frustumCulled = false
  groupe.add(vesicules)

  const centreVes = new Float32Array(NB_VESICULES * 3)
  const erranceVes = new Float32Array(NB_VESICULES * 12)
  const centres = [
    [0.02, -0.04, -0.18],
    [-0.16, 0.11, -0.155],
    [0.15, 0.13, -0.165],
    [0.03, -0.18, -0.15],
  ]
  for (let v = 0; v < NB_VESICULES; v++) {
    centreVes[v * 3] = centres[v]![0]!
    centreVes[v * 3 + 1] = centres[v]![1]!
    centreVes[v * 3 + 2] = centres[v]![2]!
    for (let k = 0; k < 3; k++) tirerErrance(erranceVes, v * 12 + k * 4, alea)
  }

  // ── Contenu sécrété ─────────────────────────────────────────────────────
  const contenu = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0045, 0),
    materiauOrganite(TEINTES.golgi, { doubleFace: false }),
    NB_GRAINS,
  )
  contenu.frustumCulled = false
  groupe.add(contenu)

  const baseGrain = new Float32Array(NB_GRAINS * 3)
  const erranceGrain = new Float32Array(NB_GRAINS * 12)
  const sortieGrain = new Float32Array(NB_GRAINS * 3)
  const instantSortie = new Float32Array(NB_GRAINS)
  for (let i = 0; i < NB_GRAINS; i++) {
    const r = 0.03 * Math.cbrt(alea())
    const u = alea() * 2 - 1
    const a = alea() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    baseGrain[i * 3] = r * s * Math.cos(a)
    baseGrain[i * 3 + 1] = r * s * Math.sin(a)
    baseGrain[i * 3 + 2] = r * u
    for (let k = 0; k < 3; k++) tirerErrance(erranceGrain, i * 12 + k * 4, alea)
    // Sortie vers le milieu extérieur, sans direction privilégiée au-delà.
    const su = 0.25 + alea() * 0.75
    const sa = alea() * Math.PI * 2
    const ss = Math.sqrt(1 - su * su)
    sortieGrain[i * 3] = ss * Math.cos(sa)
    sortieGrain[i * 3 + 1] = ss * Math.sin(sa)
    sortieGrain[i * 3 + 2] = su
    instantSortie[i] = 0.645 + alea() * 0.075
  }

  // ── Complexes SNARE ─────────────────────────────────────────────────────
  // Trois hélices vertes venues de la membrane plasmique (t-SNARE), une hélice
  // orange venue de la vésicule (v-SNARE) : le faisceau à QUATRE hélices se
  // compte à l'œil. C'est cet appariement, et lui seul, qui décide de la
  // spécificité — une vésicule ne fusionne pas avec n'importe quelle membrane.
  const matiereT = materiauOrganite(0x00c78f, { doubleFace: false })
  const matiereV = materiauOrganite(0xd55e00, { doubleFace: false })
  const geometrieGrainSnare = new THREE.IcosahedronGeometry(0.0007, 0)
  const snareT = new THREE.InstancedMesh(
    geometrieGrainSnare,
    matiereT,
    NB_COMPLEXES * 3 * GRAINS_PAR_HELICE + NB_TSNARE_LIBRES * HELICES_TSNARE * GRAINS_TSNARE,
  )
  const snareV = new THREE.InstancedMesh(
    geometrieGrainSnare,
    matiereV,
    NB_COMPLEXES * GRAINS_PAR_HELICE,
  )
  snareT.frustumCulled = false
  snareV.frustumCulled = false
  groupe.add(snareT, snareV)

  // Par complexe : cos, sin, axe(3), u1(3), u2(3).
  const PAS_CPX = 11
  const parComplexe = new Float32Array(NB_COMPLEXES * PAS_CPX)
  for (let j = 0; j < NB_COMPLEXES; j++) {
    const phi = (j / NB_COMPLEXES) * Math.PI * 2 + 0.4
    const cx = Math.cos(phi)
    const cy = Math.sin(phi)
    // Le faisceau s'écarte du point de contact : son extrémité N est la plus
    // éloignée des deux membranes, et c'est par là que la fermeture éclair part.
    const n = Math.hypot(cx, cy, 0.25)
    const ax = cx / n
    const ay = cy / n
    const az = 0.25 / n
    // Base orthonormale du faisceau, pour y enrouler les quatre hélices.
    let u1x = -ay
    let u1y = ax
    let u1z = 0
    const l1 = Math.hypot(u1x, u1y, u1z)
    u1x /= l1
    u1y /= l1
    u1z /= l1
    const b = j * PAS_CPX
    parComplexe[b] = cx
    parComplexe[b + 1] = cy
    parComplexe[b + 2] = ax
    parComplexe[b + 3] = ay
    parComplexe[b + 4] = az
    parComplexe[b + 5] = u1x
    parComplexe[b + 6] = u1y
    parComplexe[b + 7] = u1z
    parComplexe[b + 8] = ay * u1z - az * u1y
    parComplexe[b + 9] = az * u1x - ax * u1z
    parComplexe[b + 10] = ax * u1y - ay * u1x
  }

  // t-SNARE inoccupés, plantés ailleurs sur le carré de membrane : ils
  // s'agitent sans rien trouver, ce qui est leur sort le plus fréquent.
  const ancreLibre = new Float32Array(NB_TSNARE_LIBRES * 3)
  for (let i = 0; i < NB_TSNARE_LIBRES; i++) {
    const r = 0.12 + alea() * 0.3
    const a = alea() * Math.PI * 2
    ancreLibre[i * 3] = r * Math.cos(a)
    ancreLibre[i * 3 + 1] = r * Math.sin(a)
    ancreLibre[i * 3 + 2] = creuxSphere(r) - 0.002
  }

  // ── Protéines de la membrane vésiculaire ────────────────────────────────
  const protVesicule = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.006, 0),
    materiauOrganite(TEINTES.proteineMembranaire, { doubleFace: false }),
    NB_PROT_VESICULE,
  )
  protVesicule.frustumCulled = false
  groupe.add(protVesicule)
  const arcProt = new Uint8Array(NB_PROT_VESICULE)
  const phiProt = new Float32Array(NB_PROT_VESICULE)
  const erranceProt = new Float32Array(NB_PROT_VESICULE * 8)
  for (let i = 0; i < NB_PROT_VESICULE; i++) {
    arcProt[i] = 1 + Math.floor(alea() * (NU_CALOTTE - 1))
    phiProt[i] = alea() * Math.PI * 2
    tirerErrance(erranceProt, i * 8, alea)
    tirerErrance(erranceProt, i * 8 + 4, alea)
  }

  const DECALAGE_T = NB_COMPLEXES * 3 * GRAINS_PAR_HELICE

  const animer = (temps: number): void => {
    const p = (((temps / PERIODE_EXO) % 1) + 1) % 1
    const tv = temps
    const zip = liss((p - X_ZIP_DEB) / (X_ZIP_FIN - X_ZIP_DEB))
    const fusionne = p >= X_FUSION && p < X_RESET

    // ── Membrane et pore de fusion ────────────────────────────────────────
    // Après la fusion, la vésicule N'EST PLUS un objet : sa membrane est
    // devenue un repli de la membrane plasmique, ouvert sur le dehors. C'est le
    // même profil que l'endocytose, joué à l'envers. Le rayon de la calotte
    // grandit à mesure qu'elle s'aplatit de façon à CONSERVER SON AIRE : les
    // 0,031 µm² de la vésicule sont ajoutés à la surface de la cellule.
    let rhoFus = 0.001
    let betaFus = 0
    let colFus = 0
    if (fusionne) {
      const av = liss((p - X_FUSION) / (X_APLATI_FIN - X_FUSION))
      betaFus = Math.max(0.05, BETA_FUSION - (BETA_FUSION - 0.05) * av)
      rhoFus = RV_SEC * Math.sqrt((1 - Math.cos(BETA_FUSION)) / (1 - Math.cos(betaFus)))
      colFus = COL_EXO * (1 - liss((p - X_FUSION) / 0.12))
      const ouverturePore = 0.04 + 0.96 * liss((p - X_FUSION) / (X_PORE_FIN - X_FUSION))
      remplirProfil(surface, rhoFus, betaFus, ouverturePore, colFus)
    } else {
      remplirProfil(surface, 0.001, 0, 1, 0)
    }
    const zLumen = fusionne ? Math.min(-0.02, rhoFus * Math.cos(betaFus) - colFus) : 0

    // ── Vésicules ─────────────────────────────────────────────────────────
    // Trois d'entre elles errent sans jamais s'amarrer et frôlent la membrane
    // sans rien y trouver. La quatrième est prise au passage : elle n'a pas
    // « visé » le site, elle est simplement passée à portée des SNARE.
    const amarrage = liss((p - X_AMARRAGE_DEB) / (X_AMARRAGE_FIN - X_AMARRAGE_DEB))
    /** Centre de la vésicule au moment exact où les deux membranes fusionnent. */
    const zSoudure = RV_SEC * Math.cos(BETA_FUSION) - COL_EXO
    const zAmarre = -0.064 + (zSoudure + 0.064) * zip
    let vx0 = 0
    let vy0 = 0
    let vz0 = zAmarre
    for (let v = 0; v < NB_VESICULES; v++) {
      const b = v * 12
      let x = centreVes[v * 3]! + AMPL_VES * errer(tv, erranceVes, b)
      let y = centreVes[v * 3 + 1]! + AMPL_VES * errer(tv, erranceVes, b + 4)
      let z = centreVes[v * 3 + 2]! + AMPL_VES_Z * errer(tv, erranceVes, b + 8)
      let ech = 1
      if (v === 0) {
        x += (0 - x) * amarrage
        y += (0 - y) * amarrage
        z += (zAmarre - z) * amarrage
        vx0 = x
        vy0 = y
        vz0 = z
        // Fondue dans la membrane plasmique : elle n'existe plus comme objet.
        ech = p < X_FUSION ? 1 : liss((p - X_RESET) / 0.03)
      }
      poser(vesicules, v, x, y, z, ech)
    }
    vesicules.instanceMatrix.needsUpdate = true

    // ── Contenu ───────────────────────────────────────────────────────────
    for (let i = 0; i < NB_GRAINS; i++) {
      const v = Math.floor(i / GRAINS_PAR_VESICULE)
      const b = i * 12
      const jx = baseGrain[i * 3]! + 0.008 * errer(tv, erranceGrain, b)
      const jy = baseGrain[i * 3 + 1]! + 0.008 * errer(tv, erranceGrain, b + 4)
      const jz = baseGrain[i * 3 + 2]! + 0.008 * errer(tv, erranceGrain, b + 8)
      if (v !== 0) {
        const cx = centreVes[v * 3]! + AMPL_VES * errer(tv, erranceVes, v * 12)
        const cy = centreVes[v * 3 + 1]! + AMPL_VES * errer(tv, erranceVes, v * 12 + 4)
        const cz = centreVes[v * 3 + 2]! + AMPL_VES_Z * errer(tv, erranceVes, v * 12 + 8)
        poser(contenu, i, cx + jx, cy + jy, cz + jz, 1)
        continue
      }
      const dedansX = vx0 + jx
      const dedansY = vy0 + jy
      const dedansZ = (fusionne ? zLumen : vz0) + jz
      const tr = instantSortie[i]!
      if (p < tr - 0.04) {
        poser(contenu, i, dedansX, dedansY, dedansZ, liss(p / 0.05))
      } else if (p < tr) {
        // Le grain ne « sort » pas : il finit par se trouver devant le pore.
        const f = liss((p - (tr - 0.04)) / 0.04)
        poser(
          contenu,
          i,
          dedansX * (1 - f),
          dedansY * (1 - f),
          dedansZ + (0.008 - dedansZ) * f,
          1,
        )
      } else {
        const parcours = (p - tr) * 2.6
        const x = sortieGrain[i * 3]! * parcours + 0.035 * errer(tv, erranceGrain, b)
        const y = sortieGrain[i * 3 + 1]! * parcours + 0.035 * errer(tv, erranceGrain, b + 4)
        const z = 0.008 + sortieGrain[i * 3 + 2]! * parcours
        poser(contenu, i, x, y, z, 1 - liss((parcours - 0.22) / 0.28))
      }
    }
    contenu.instanceMatrix.needsUpdate = true

    // ── SNARE ─────────────────────────────────────────────────────────────
    // Les hélices se referment de l'extrémité N vers l'extrémité C, c'est-à-dire
    // du bout libre vers les deux membranes : c'est cette fermeture éclair qui
    // TIRE la vésicule contre la membrane plasmique, et rien d'autre.
    const echSnare = liss((p - X_SNARE_DEB) / 0.05) * (1 - liss((p - 0.7) / 0.08))
    const front = Math.round((1 - zip) * (GRAINS_PAR_HELICE - 1))
    const zSurfVes = vz0 + Math.sqrt(Math.max(0, RV_SEC * RV_SEC - (0.8 * RAYON_ANCRAGE) ** 2))
    for (let j = 0; j < NB_COMPLEXES; j++) {
      const b = j * PAS_CPX
      const cx = parComplexe[b]!
      const cy = parComplexe[b + 1]!
      const ax = parComplexe[b + 2]!
      const ay = parComplexe[b + 3]!
      const az = parComplexe[b + 4]!
      const u1x = parComplexe[b + 5]!
      const u1y = parComplexe[b + 6]!
      const u1z = parComplexe[b + 7]!
      const u2x = parComplexe[b + 8]!
      const u2y = parComplexe[b + 9]!
      const u2z = parComplexe[b + 10]!
      // Ancrage transmembranaire : la queue du t-SNARE dans la membrane
      // plasmique, celle du v-SNARE dans la membrane de la vésicule.
      const atx = RAYON_ANCRAGE * cx
      const aty = RAYON_ANCRAGE * cy
      const atz = creuxSphere(RAYON_ANCRAGE) - 0.002
      const avx = 0.8 * RAYON_ANCRAGE * cx + vx0
      const avy = 0.8 * RAYON_ANCRAGE * cy + vy0
      const avz = zSurfVes
      const bx = (atx + avx) / 2
      const by = (aty + avy) / 2
      const bz = (atz + avz) / 2

      for (let h = 0; h < HELICES_PAR_COMPLEXE; h++) {
        // Position du grain de tête du faisceau : origine des brins encore libres.
        const angF = h * (Math.PI / 2) + 0.42 * front
        const fx = bx + ax * front * PAS_SNARE + RAYON_FAISCEAU * (u1x * Math.cos(angF) + u2x * Math.sin(angF))
        const fy = by + ay * front * PAS_SNARE + RAYON_FAISCEAU * (u1y * Math.cos(angF) + u2y * Math.sin(angF))
        const fz = bz + az * front * PAS_SNARE + RAYON_FAISCEAU * (u1z * Math.cos(angF) + u2z * Math.sin(angF))
        const ancX = h < 3 ? atx : avx
        const ancY = h < 3 ? aty : avy
        const ancZ = h < 3 ? atz : avz
        const cible = h < 3 ? snareT : snareV
        const base = h < 3 ? (j * 3 + h) * GRAINS_PAR_HELICE : j * GRAINS_PAR_HELICE
        for (let k = 0; k < GRAINS_PAR_HELICE; k++) {
          let x: number
          let y: number
          let z: number
          if (k >= front) {
            const ang = h * (Math.PI / 2) + 0.42 * k
            const co = Math.cos(ang)
            const si = Math.sin(ang)
            x = bx + ax * k * PAS_SNARE + RAYON_FAISCEAU * (u1x * co + u2x * si)
            y = by + ay * k * PAS_SNARE + RAYON_FAISCEAU * (u1y * co + u2y * si)
            z = bz + az * k * PAS_SNARE + RAYON_FAISCEAU * (u1z * co + u2z * si)
          } else {
            const f = (front - k) / front
            const w = 0.004 * f * (1 - f) + 0.0012 * f
            const s1 = Math.sin(tv * 2.7 + h * 2.1 + k) * w
            const s2 = Math.cos(tv * 3.3 + h * 1.4 + k * 0.7) * w
            x = fx + (ancX - fx) * f + u1x * s1 + u2x * s2
            y = fy + (ancY - fy) * f + u1y * s1 + u2y * s2
            z = fz + (ancZ - fz) * f + u1z * s1 + u2z * s2
          }
          poser(cible, base + k, x, y, z, echSnare)
        }
      }
    }
    // t-SNARE libres : ils balaient le cytosol sans partenaire.
    for (let i = 0; i < NB_TSNARE_LIBRES; i++) {
      const ax = ancreLibre[i * 3]!
      const ay = ancreLibre[i * 3 + 1]!
      const az = ancreLibre[i * 3 + 2]!
      for (let h = 0; h < HELICES_TSNARE; h++) {
        const ang = (h / HELICES_TSNARE) * Math.PI * 2 + i
        for (let g = 0; g < GRAINS_TSNARE; g++) {
          const s = (g + 1) * 0.0013
          const ondul = Math.sin(tv * 2.2 + i * 1.7 + h + g * 0.55) * 0.0022 * s * 90
          poser(
            snareT,
            DECALAGE_T + (i * HELICES_TSNARE + h) * GRAINS_TSNARE + g,
            ax + Math.cos(ang) * s * 0.35 + ondul,
            ay + Math.sin(ang) * s * 0.35 + ondul * 0.6,
            az - s * 0.9,
            1,
          )
        }
      }
    }
    snareT.instanceMatrix.needsUpdate = true
    snareV.instanceMatrix.needsUpdate = true

    // ── Protéines de la membrane vésiculaire ──────────────────────────────
    // Elles ne disparaissent pas : elles restent dans le plan de la membrane et
    // s'y dispersent. C'est la preuve visible que la surface de la cellule a
    // augmenté, et pourquoi l'endocytose doit compenser.
    const diffusion = liss((p - 0.8) / 0.15)
    const echProt = p < X_RESET ? 1 - liss((p - 0.88) / 0.09) : liss((p - X_RESET) / 0.03)
    for (let i = 0; i < NB_PROT_VESICULE; i++) {
      const a = arcProt[i]!
      const co = Math.cos(phiProt[i]!)
      const si = Math.sin(phiProt[i]!)
      let x: number
      let y: number
      let z: number
      if (fusionne) {
        x = surface.rayons[a]! * co
        y = surface.rayons[a]! * si
        z = surface.cotes[a]!
      } else {
        const psi = (BETA_FUSION * a) / (NU_CALOTTE - 1)
        const rr = RV_SEC * Math.sin(psi)
        x = vx0 + rr * co
        y = vy0 + rr * si
        z = vz0 - RV_SEC * Math.cos(psi)
      }
      if (diffusion > 0) {
        x += 0.3 * diffusion * errer(tv, erranceProt, i * 8)
        y += 0.3 * diffusion * errer(tv, erranceProt, i * 8 + 4)
        const rr = Math.sqrt(x * x + y * y)
        z += (creuxSphere(rr) - z) * diffusion
      }
      poser(protVesicule, i, x, y, z, echProt)
    }
    protVesicule.instanceMatrix.needsUpdate = true
  }

  animer(0)

  return {
    cle: 'exocytose-snare',
    nom: 'Exocytose et fusion SNARE',
    siege: 'Membrane plasmique',
    facteur: 'deux temps : accéléré ×5, puis ralenti ×5 000',
    justificationFacteur:
      "Deux temps, parce qu'une seule vitesse serait fausse pour l'un des deux. " +
      "L'errance et l'amarrage de la vésicule prennent une trentaine de secondes : " +
      "ils occupent les 6,7 premières secondes d'écran, soit un accéléré d'environ " +
      "×5. La fermeture éclair des SNARE et l'ouverture du pore, elles, durent " +
      'moins de 1 ms et sont étalées sur les 5 s suivantes — un ralenti de ' +
      "×5 000. Sans ce ralenti, la fusion serait une image et demie.",
    ellision:
      'Le calcium qui déclenche la fusion, la synaptotagmine qui le détecte, ' +
      "Munc13 et Munc18 qui préparent la syntaxine, et NSF/α-SNAP qui redéfont le " +
      'complexe après coup ne sont pas dessinés ; les complexes SNARE disparaissent ' +
      'simplement une fois la fusion faite. Chaque hélice est figurée par 13 grains ' +
      "au lieu de la soixantaine de résidus qu'elle compte. Le mouvement des " +
      'vésicules est une errance à deux sinus, pas une intégration brownienne : la ' +
      "propriété conservée est l'absence de cap, pas la statistique du déplacement.",
    description:
      "Une vésicule sécrétoire erre sous la membrane. Quand elle passe à portée, " +
      'ses v-SNARE rencontrent les t-SNARE de la membrane et les quatre hélices se ' +
      "referment comme une fermeture éclair, du bout libre vers les membranes : " +
      "c'est cette fermeture qui tire les deux bicouches l'une contre l'autre " +
      "jusqu'au contact. Un pore de moins de 2 nm s'ouvre alors, le contenu part " +
      'dans le milieu extérieur, et la vésicule finit de se déplier dans la ' +
      'membrane plasmique. Sa membrane ne disparaît pas : elle S\'AJOUTE, et ses ' +
      'protéines se dispersent dans le plan — la surface de la cellule vient ' +
      "d'augmenter, et il faudra que l'endocytose la reprenne.",
    chiffres: [
      { valeur: '4 hélices', quoi: 'le complexe SNARE : trois de la membrane plasmique (vert), une de la vésicule (orange) ; long de 12 nm' },
      { valeur: '< 1 ms', quoi: "durée réelle de la fermeture des SNARE et de l'ouverture du pore, contre 5 s à l'écran : ralenti ×5 000" },
      { valeur: '1 à 2 nm', quoi: 'rayon du pore de fusion au moment où il s\'ouvre, avant de s\'élargir' },
      { valeur: '100 nm', quoi: 'diamètre de la vésicule sécrétoire figurée ici' },
      { valeur: '+0,031 µm²', quoi: "surface ajoutée à la membrane plasmique par une seule fusion ; il en faudrait 40 000 pour refaire les 1 257 µm² de la cellule" },
      { valeur: '3 sur 4', quoi: 'les vésicules qui passent sans s\'amarrer, ici ; aucune ne connaît sa destination' },
    ],
    objet: groupe,
    ancre: DIR_EXOCYTOSE.clone().multiplyScalar(RAYON_CELLULE - 0.04),
    rayonCadrage: 0.32,
    couleur: 0x00c78f,
    animer,
  }
}

/**
 * Les deux faces d'un même échange de membrane, séparées parce que leurs
 * horloges le sont.
 */
export function creerEndoExocytose(): Mecanisme[] {
  return [creerEndocytose(), creerExocytose()]
}
