import * as THREE from 'three'
import { CENTRE_NOYAU, TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import type { MecanismeBrut } from './contrat.js'

/**
 * CRISPR : les ciseaux programmables — ADN par Cas9, ARN par Cas13.
 *
 * Ce que ces deux scènes tiennent à montrer, et que les vidéos grand public
 * escamotent toutes :
 *
 * 1. LE PAM D'ABORD, LA SÉQUENCE ENSUITE. Cas9 ne lit pas le génome comme un
 *    texte : il percute l'ADN au hasard, teste en une milliseconde s'il y a
 *    un motif NGG — le PAM — et repart s'il n'y en a pas. Un NGG tombe en
 *    moyenne toutes les huit paires de bases : il y en a des CENTAINES de
 *    millions dans un génome humain, sur les deux brins. Ce n'est qu'AU PAM qu'il
 *    ouvre la double hélice et compare son guide, base à base.
 * 2. LA COUPURE EST À BOUTS FRANCS, ET DEUX DOMAINES LA FONT : HNH coupe le
 *    brin apparié au guide, RuvC coupe l'autre, trois paires de bases en
 *    amont du PAM.
 * 3. CE QUI SUIT N'EST PAS DE CRISPR. Cas9 coupe ; c'est la CELLULE qui
 *    répare — mal (NHEJ, qui perd ou ajoute des bases et casse le gène) ou
 *    bien (HDR, sur matrice, qui le réécrit). L'édition est un accident de
 *    réparation qu'on provoque.
 * 4. CAS13 N'A PAS DE PAM ET NE S'ARRÊTE PAS. Il cible l'ARN, et une fois
 *    activé il devient une nucléase générale : il coupe les ARN voisins,
 *    innocents compris — le clivage COLLATÉRAL, qui est un défaut en
 *    thérapie et le principe même du diagnostic SHERLOCK.
 */

const GRAINE = 0x43524953

// ── Cas9 : le tour complet, recherche comprise ────────────────────────────
/** À l'écran : 30 s. Dans le noyau, une cible dans 3 Gb demande des heures. */
const PERIODE_CAS9 = 30
const CYCLE_REEL_CAS9 = 5400

const N_BASES = 46
/** Pas de l'ADN : 0,34 nm, mais la scène travaille au dixième de micromètre. */
const PAS_BASE = 0.0034
const RAYON_HELICE = 0.0012
const RAYON_BASE = 0.0007
/** Le guide : 20 nucléotides d'appariement — la longueur qui fait la spécificité. */
const N_GUIDE = 20
/** Position du PAM sur le brin dessiné, en index de base. */
const INDEX_PAM = 30
/** Cas9 coupe 3 paires de bases en amont du PAM. À bouts francs. */
const COUPURE = INDEX_PAM - 3
const N_ESSAIS = 5

// Jalons du cycle Cas9.
const P_ARRIVEE = 0.28
const P_PAM = 0.34
const P_OUVERTURE = 0.46
const P_APPARIEMENT = 0.62
const P_COUPURE = 0.70
const P_ECART = 0.82

// ── Cas13 : l'ARN et le clivage collatéral ────────────────────────────────
const PERIODE_CAS13 = 18
const CYCLE_REEL_CAS13 = 900
const N_BASES_ARN = 34
const N_ARN_VOISINS = 7
const N_BASES_VOISIN = 11

const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

/** Position d'une base sur un des deux brins de la double hélice. */
function surHelice(i: number, brin: 0 | 1, ouverture: number, cible: THREE.Vector3): void {
  const angle = i * ((Math.PI * 2) / 10.5) + brin * Math.PI
  // La bulle : entre le PAM et la fin du guide, les deux brins s'écartent —
  // c'est la R-loop, et c'est là que le guide vient s'apparier.
  const dansBulle = i <= INDEX_PAM && i >= INDEX_PAM - N_GUIDE
  const ecart = dansBulle ? ouverture * 0.004 : 0
  const rayon = RAYON_HELICE + ecart * (brin === 0 ? 1 : 0.35)
  cible.set(
    (i - N_BASES / 2) * PAS_BASE,
    Math.sin(angle) * rayon + (brin === 0 ? ecart : -ecart * 0.6),
    Math.cos(angle) * rayon,
  )
}

function creerCas9(): MecanismeBrut {
  const alea = creerAlea(GRAINE)
  const groupe = new THREE.Group()
  groupe.name = 'crispr-cas9'
  groupe.position.copy(CENTRE_NOYAU).add(new THREE.Vector3(-0.7, -1.35, -1.1))
  groupe.rotation.set(0.12, 0.5, 0.05)

  // ── L'ADN cible ─────────────────────────────────────────────────────────
  const matBrin = materiauOrganite(TEINTES.noyau, { doubleFace: false })
  const matPam = materiauOrganite(0xd55e00, { doubleFace: false })
  const bases = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_BASE, 1),
    matBrin,
    N_BASES * 2,
  )
  bases.frustumCulled = false
  bases.name = 'double-helice'
  groupe.add(bases)

  // Le PAM : trois bases orange — NGG. Sans lui, Cas9 ne s'arrête même pas.
  const pam = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_BASE * 1.35, 1),
    matPam,
    3,
  )
  pam.frustumCulled = false
  groupe.add(pam)

  // ── Cas9 et son guide ───────────────────────────────────────────────────
  // Deux lobes : REC (reconnaissance) et NUC (les nucléases). 160 kDa, ~10 nm.
  const cas9 = new THREE.Group()
  const lobeRec = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0052, 2),
    materiauOrganite(TEINTES.lysosome, { opacite: 0.86 }),
  )
  lobeRec.scale.set(1.25, 1, 0.9)
  lobeRec.position.set(-0.002, 0.0015, 0)
  const lobeNuc = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0044, 2),
    materiauOrganite(0x7a4b96, { opacite: 0.86 }),
  )
  lobeNuc.position.set(0.0035, -0.0012, 0)
  // Les deux lames, nommées : HNH coupe le brin cible, RuvC l'autre.
  const hnh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0018, 1),
    materiauOrganite(0xcc79a7, { doubleFace: false }),
  )
  hnh.position.set(0.0028, 0.0028, 0.0018)
  const ruvc = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0018, 1),
    materiauOrganite(0x00c78f, { doubleFace: false }),
  )
  ruvc.position.set(0.0042, -0.003, -0.0016)
  cas9.add(lobeRec, lobeNuc, hnh, ruvc)
  cas9.name = 'cas9'
  groupe.add(cas9)

  // L'ARN guide : 20 nt d'appariement, qui viennent se coller au brin cible.
  const guide = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(RAYON_BASE * 0.9, 1),
    materiauOrganite(TEINTES.chromatine, { doubleFace: false }),
    N_GUIDE,
  )
  guide.frustumCulled = false
  groupe.add(guide)

  // ── Les essais infructueux : la vraie vie de Cas9 ───────────────────────
  const essais = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0048, 1),
    materiauOrganite(TEINTES.lysosome, { opacite: 0.4 }),
    N_ESSAIS,
  )
  essais.frustumCulled = false
  groupe.add(essais)
  const sitesEssais = new Float32Array(N_ESSAIS * 3)
  for (let e = 0; e < N_ESSAIS; e++) {
    sitesEssais[e * 3] = (alea() - 0.5) * N_BASES * PAS_BASE * 0.9
    sitesEssais[e * 3 + 1] = 0.006 + alea() * 0.012
    sitesEssais[e * 3 + 2] = (alea() - 0.5) * 0.02
  }

  const animer = (temps: number): void => {
    const p = ((temps / PERIODE_CAS9) % 1 + 1) % 1
    const approche = lissage((p - P_ARRIVEE) / (P_PAM - P_ARRIVEE))
    const lecturePam = lissage((p - P_PAM) / 0.06)
    const ouverture = lissage((p - P_OUVERTURE) / (P_APPARIEMENT - P_OUVERTURE))
    const appariement = lissage((p - P_APPARIEMENT) / (P_COUPURE - P_APPARIEMENT))
    const coupe = lissage((p - P_COUPURE) / 0.05)
    const ecart = lissage((p - P_ECART) / (1 - P_ECART))

    // L'ADN : les deux brins, et l'écartement des extrémités après coupure.
    for (let brin = 0; brin < 2; brin++) {
      for (let i = 0; i < N_BASES; i++) {
        surHelice(i, brin as 0 | 1, ouverture, _position)
        // Après la coupure, les deux moitiés s'éloignent : une cassure
        // double-brin est une plaie ouverte, que la cellule doit refermer.
        if (coupe > 0) {
          const cote = i < COUPURE ? -1 : 1
          _position.x += cote * coupe * 0.006
        }
        _matrice.compose(_position, _quat.identity(), _echelle.setScalar(1))
        bases.setMatrixAt(brin * N_BASES + i, _matrice)
      }
    }
    bases.instanceMatrix.needsUpdate = true

    for (let k = 0; k < 3; k++) {
      surHelice(INDEX_PAM + k, 0, ouverture, _position)
      if (coupe > 0) _position.x += coupe * 0.006
      _matrice.compose(_position, _quat, _echelle.setScalar(1 + 0.4 * lecturePam))
      pam.setMatrixAt(k, _matrice)
    }
    pam.instanceMatrix.needsUpdate = true

    // Cas9 : il arrive, s'arrime au PAM, coupe, puis reste accroché — et
    // c'est un fait mal connu : il ne lâche sa cible qu'après des heures.
    surHelice(INDEX_PAM - 4, 0, ouverture, _a)
    _b.set(_a.x - 0.01, 0.028, 0.012)
    _position.copy(_b).lerp(_a.clone().add(new THREE.Vector3(0, 0.0075, 0)), approche);
    cas9.position.copy(_position)
    cas9.rotation.z = (1 - approche) * 0.8 + Math.sin(temps * 1.1) * 0.04 * (1 - approche)
    // Les lames pivotent au moment de couper : HNH bascule sur le brin cible.
    hnh.position.set(0.0028, 0.0028 - coupe * 0.0042, 0.0018 - coupe * 0.0012)
    ruvc.position.set(0.0042, -0.003 + coupe * 0.0008, -0.0016)
    cas9.scale.setScalar(ecart > 0 ? 1 - 0.15 * ecart : 1)

    // Le guide s'apparie base à base, du PAM vers l'amont : c'est la
    // fermeture éclair de la R-loop, et chaque mésappariement l'arrête.
    for (let g = 0; g < N_GUIDE; g++) {
      const pose = lissage((appariement - g / N_GUIDE) * 3)
      surHelice(INDEX_PAM - 1 - g, 1, ouverture, _a)
      _b.copy(_a).add(new THREE.Vector3(0, 0.0055, 0.001))
      _position.copy(_b).lerp(_a, pose)
      if (coupe > 0 && INDEX_PAM - 1 - g < COUPURE) _position.x -= coupe * 0.006
      _matrice.compose(_position, _quat, _echelle.setScalar(ouverture > 0.05 ? 1 : 0.001))
      guide.setMatrixAt(g, _matrice)
    }
    guide.instanceMatrix.needsUpdate = true

    // Les essais : d'autres Cas9 percutent l'ADN où il n'y a pas de PAM et
    // repartent aussitôt. Dans la cellule, c'est l'immense majorité du temps.
    for (let e = 0; e < N_ESSAIS; e++) {
      const q = (temps / (1.6 + e * 0.42) + e * 0.37) % 1
      const plongee = Math.sin(Math.PI * lissage(q * 2.2))
      _position.set(
        sitesEssais[e * 3]! + Math.sin(temps * 0.5 + e) * 0.004,
        sitesEssais[e * 3 + 1]! * (1 - plongee) + 0.005 * plongee,
        sitesEssais[e * 3 + 2]!,
      )
      _axeAleatoire(e, _a)
      _quat.setFromAxisAngle(_a, temps * 0.4 + e)
      _matrice.compose(_position, _quat, _echelle.setScalar(1))
      essais.setMatrixAt(e, _matrice)
    }
    essais.instanceMatrix.needsUpdate = true
    _echelle.setScalar(1)
  }

  animer(0)

  return {
    cle: 'crispr-cas9',
    nom: "CRISPR-Cas9 : le PAM, la R-loop, la cassure double-brin",
    siege: 'Noyau',
    ralentissement: PERIODE_CAS9 / CYCLE_REEL_CAS9,
    observable: {
      nom: 'double-helice',
      cycleReel: CYCLE_REEL_CAS9,
      pourquoi:
        "L'ADN cible porte le cycle : de l'arrivée de Cas9 à l'écartement des " +
        "deux moitiés coupées, il se passe des heures dans un noyau — le temps " +
        "de trouver UNE séquence de vingt bases dans trois milliards.",
    },
    justificationFacteur:
      "Trouver une cible dans trois milliards de bases prend des heures : Cas9 " +
      'teste des centaines de millions de PAM par collisions successives, une ' +
      "milliseconde chacun. La coupure elle-même, une fois l'appariement fait, " +
      "prend moins d'une seconde. Le cycle entier tient ici en 30 s, soit un " +
      "accéléré d'environ ×180 — mais les trois horloges qu'il contient ne " +
      "sont pas au même facteur, et l'ellision le dit.",
    ellision:
      "LA RECHERCHE EST ÉCRASÉE, PAS ACCÉLÉRÉE : on montre cinq essais ratés " +
      "là où il y en a des millions, et le temps réel de la traque — des " +
      "heures — ne tient dans aucun facteur. À l'inverse, la coupure est " +
      "RALENTIE pour être visible. Quarante-six paires de bases sont dessinées " +
      "pour un génome de trois milliards, et un grain par base au lieu des " +
      "vingt atomes qu'elle compte. Ce qui SUIT la coupure n'est pas montré et " +
      "n'est pas de CRISPR : c'est la cellule qui répare, mal par NHEJ — elle " +
      "perd ou ajoute des bases, et c'est ainsi qu'on éteint un gène — ou bien " +
      "par HDR sur matrice, plus rare, qui le réécrit. Enfin Cas9 est ici " +
      "SpCas9, celle de Streptococcus pyogenes : son PAM est NGG, d'autres " +
      "orthologues en ont d'autres, et les éditeurs de base modernes ne " +
      'coupent plus du tout les deux brins.',
    description:
      "Cas9 ne lit pas le génome comme un texte : il le PERCUTE au hasard. À " +
      'chaque collision, une seule question, tranchée en une milliseconde : ' +
      "y a-t-il un PAM — le motif NGG, en orange ? S'il n'y en a pas, il " +
      "repart aussitôt, et c'est ce que font les autres Cas9 qu'on voit " +
      "rebondir. S'il y en a un, alors seulement il ouvre la double hélice et " +
      "présente son ARN GUIDE : vingt bases qui s'apparient une à une, du PAM " +
      "vers l'amont, comme une fermeture éclair — un seul mésappariement près " +
      'du PAM et tout se défait. Quand les vingt tiennent, la protéine change ' +
      'de forme et arme ses DEUX lames : HNH, en rose, coupe le brin apparié ' +
      "au guide ; RuvC, en vert, coupe l'autre. La cassure est à bouts francs, " +
      'trois paires de bases en amont du PAM — et les deux moitiés du ' +
      "chromosome s'écartent. Ce qui se passe ensuite n'est plus de CRISPR : " +
      "c'est la cellule qui referme la plaie, et c'est en réparant mal qu'elle " +
      "casse le gène. L'édition du génome est un accident de réparation qu'on " +
      'provoque à un endroit choisi.',
    objet: groupe,
    ancre: groupe.position.clone(),
    rayonCadrage: 0.1,
    couleur: TEINTES.lysosome,
    animer,
  }
}

/** Axe pseudo-aléatoire stable, dérivé d'un index : aucune allocation. */
function _axeAleatoire(index: number, cible: THREE.Vector3): void {
  cible
    .set(Math.sin(index * 12.9898), Math.sin(index * 78.233), Math.sin(index * 37.719))
    .normalize()
}

function creerCas13(): MecanismeBrut {
  const alea = creerAlea(GRAINE ^ 0x1313)
  const groupe = new THREE.Group()
  groupe.name = 'crispr-cas13'
  // Dans le cytosol : Cas13 travaille sur les ARN messagers, pas dans le noyau.
  groupe.position.set(-2.4, 4.1, -1.6)
  groupe.rotation.set(0.1, -0.35, 0)

  const matArn = materiauOrganite(TEINTES.noyau, { doubleFace: false })
  const matVoisin = materiauOrganite(TEINTES.reticulumLisse, { doubleFace: false })

  // ── L'ARN cible : un simple brin, ondulant ──────────────────────────────
  const cible = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0009, 1),
    matArn,
    N_BASES_ARN,
  )
  cible.frustumCulled = false
  cible.name = 'arn-cible'
  groupe.add(cible)

  // ── Cas13 et ses deux domaines HEPN ─────────────────────────────────────
  const cas13 = new THREE.Group()
  const corps = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0048, 2),
    materiauOrganite(0xb04a00, { opacite: 0.86 }),
  )
  corps.scale.set(1.2, 0.95, 1)
  // Les deux HEPN forment UN site catalytique composite, et il est
  // À L'EXTÉRIEUR de la protéine : c'est pour ça qu'il coupe tout ce qui passe.
  const hepnA = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0016, 1),
    materiauOrganite(0xd55e00, { doubleFace: false }),
  )
  const hepnB = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.0016, 1),
    materiauOrganite(0xd55e00, { doubleFace: false }),
  )
  cas13.add(corps, hepnA, hepnB)
  cas13.name = 'cas13'
  groupe.add(cas13)

  const guide13 = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0008, 1),
    materiauOrganite(TEINTES.chromatine, { doubleFace: false }),
    N_GUIDE,
  )
  guide13.frustumCulled = false
  groupe.add(guide13)

  // ── Les ARN voisins : les victimes collatérales ─────────────────────────
  const voisins = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0009, 1),
    matVoisin,
    N_ARN_VOISINS * N_BASES_VOISIN,
  )
  voisins.frustumCulled = false
  groupe.add(voisins)
  const ancresVoisins: THREE.Vector3[] = []
  const orientations: THREE.Vector3[] = []
  for (let v = 0; v < N_ARN_VOISINS; v++) {
    ancresVoisins.push(
      new THREE.Vector3((alea() - 0.5) * 0.08, (alea() - 0.5) * 0.05, (alea() - 0.5) * 0.05),
    )
    orientations.push(
      new THREE.Vector3(alea() - 0.5, alea() - 0.5, alea() - 0.5).normalize(),
    )
  }

  const animer = (temps: number): void => {
    const p = ((temps / PERIODE_CAS13) % 1 + 1) % 1
    const accroche = lissage((p - 0.2) / 0.18)
    const active = lissage((p - 0.42) / 0.08)
    const massacre = lissage((p - 0.5) / 0.4)

    // L'ARN cible : simple brin ondulant, coupé en son milieu à l'activation.
    for (let i = 0; i < N_BASES_ARN; i++) {
      const x = (i - N_BASES_ARN / 2) * 0.0026
      _position.set(
        x,
        Math.sin(i * 0.55 + temps * 0.8) * 0.0035,
        Math.cos(i * 0.4 + temps * 0.6) * 0.0025,
      )
      if (active > 0) {
        const cote = i < N_BASES_ARN / 2 ? -1 : 1
        _position.x += cote * active * 0.008
        _position.y += cote * active * 0.002
      }
      _matrice.compose(_position, _quat.identity(), _echelle.setScalar(1))
      cible.setMatrixAt(i, _matrice)
    }
    cible.instanceMatrix.needsUpdate = true

    // Cas13 vient s'apparier — SANS PAM : rien ne l'autorise, rien ne le
    // freine, il suffit que la séquence soit là et accessible.
    _a.set(0, 0.0075, 0.002)
    _b.set(-0.03, 0.03, 0.02)
    cas13.position.copy(_b).lerp(_a, accroche)
    cas13.rotation.z = (1 - accroche) * 0.7
    // À l'activation, les deux HEPN se rejoignent : le site composite se forme.
    const ecartement = 0.004 * (1 - active) + 0.0012
    hepnA.position.set(-ecartement, -0.0032, 0.001)
    hepnB.position.set(ecartement, -0.0032, -0.001)

    for (let g = 0; g < N_GUIDE; g++) {
      const pose = lissage((accroche - g / N_GUIDE) * 2.5)
      const i = Math.round(N_BASES_ARN / 2 - N_GUIDE / 2 + g)
      const x = (i - N_BASES_ARN / 2) * 0.0026
      _a.set(x, Math.sin(i * 0.55 + temps * 0.8) * 0.0035 + 0.0016, 0.0012)
      _b.copy(_a).add(new THREE.Vector3(0, 0.006, 0.004))
      _position.copy(_b).lerp(_a, pose)
      _matrice.compose(_position, _quat, _echelle.setScalar(1))
      guide13.setMatrixAt(g, _matrice)
    }
    guide13.instanceMatrix.needsUpdate = true

    // LE CLIVAGE COLLATÉRAL : une fois activé, Cas13 coupe les ARN voisins,
    // innocents compris. C'est un défaut en thérapie — et le principe même
    // du test SHERLOCK, où ces coupures allument un rapporteur fluorescent.
    for (let v = 0; v < N_ARN_VOISINS; v++) {
      const ancre = ancresVoisins[v]!
      const axe = orientations[v]!
      // Chaque voisin est haché à son tour, dans l'ordre de la distance.
      const distance = ancre.length()
      const hache = lissage((massacre - distance * 6) * 2.5)
      for (let b = 0; b < N_BASES_VOISIN; b++) {
        const t = (b - N_BASES_VOISIN / 2) * 0.0022
        _position
          .copy(ancre)
          .addScaledVector(axe, t)
          .add(
            _a.set(
              Math.sin(temps * 0.7 + v + b * 0.4) * 0.0016,
              Math.cos(temps * 0.6 + v * 2 + b * 0.3) * 0.0016,
              0,
            ),
          )
        // Haché : les morceaux s'éparpillent et s'effacent.
        if (hache > 0) {
          _position.addScaledVector(axe, hache * (b % 3 === 0 ? 0.006 : -0.004))
          _position.y += hache * ((b % 2 === 0 ? 1 : -1) * 0.005)
        }
        _matrice.compose(
          _position,
          _quat,
          _echelle.setScalar(Math.max(0.001, 1 - lissage((hache - 0.55) / 0.45))),
        )
        voisins.setMatrixAt(v * N_BASES_VOISIN + b, _matrice)
      }
    }
    voisins.instanceMatrix.needsUpdate = true
    _echelle.setScalar(1)
  }

  animer(0)

  return {
    cle: 'crispr-cas13',
    nom: 'CRISPR-Cas13 : couper l’ARN, et tout ce qui passe',
    siege: 'Cytosol',
    ralentissement: PERIODE_CAS13 / CYCLE_REEL_CAS13,
    observable: {
      nom: 'arn-cible',
      cycleReel: CYCLE_REEL_CAS13,
      pourquoi:
        "L'ARN cible porte le cycle : de la rencontre à sa coupure, il se passe " +
        "une quinzaine de minutes dans un cytosol encombré — et c'est cette " +
        'reconnaissance-là que le badge accélère.',
    },
    justificationFacteur:
      "Trouver un ARN messager parmi les centaines de milliers du cytosol prend " +
      "une quinzaine de minutes ; le cycle tient ici en 18 s, soit un accéléré " +
      "d'environ ×50. Le clivage collatéral, lui, est bien plus rapide : une " +
      'fois Cas13 activé, des milliers de coupures par minute.',
    ellision:
      "Sept ARN voisins pour les centaines de milliers d'un cytosol, et une " +
      'dizaine de grains par ARN. La cible est dessinée nue : un ARN messager ' +
      "réel est empaqueté de protéines, et son repliement décide de son " +
      "accessibilité — c'est la première difficulté de la méthode. Le PFS, " +
      "cette préférence de base juste à côté de la cible que montrent certains " +
      "orthologues, n'est pas figuré. Ce qui suit la coupure — la dégradation " +
      "des morceaux par les exonucléases — est hors cadre, et le rapporteur " +
      'fluorescent du test SHERLOCK aussi.',
    description:
      "Cas13 est le cousin qui coupe l'ARN. Deux choses le séparent de Cas9, " +
      'et elles changent tout. La première : IL N’A PAS DE PAM. Rien ne ' +
      'l’autorise à s’arrêter quelque part, rien ne le freine — il suffit que ' +
      "la séquence soit là et que le repliement de l'ARN la laisse " +
      'accessible. La seconde est plus surprenante : une fois apparié à sa ' +
      'cible, ses deux domaines HEPN se rejoignent en un site catalytique ' +
      "unique, placé À L'EXTÉRIEUR de la protéine — et il devient une " +
      'nucléase GÉNÉRALE. Il coupe sa cible, puis les ARN qui passent à sa ' +
      "portée, innocents compris : c'est le clivage COLLATÉRAL, qu'on voit " +
      'ici hacher les voisins verts. En thérapie, c’est un défaut qu’il faut ' +
      'contenir. En diagnostic, c’est devenu le principe d’un test : dans ' +
      'SHERLOCK, on ajoute des ARN rapporteurs qui s’allument en étant coupés ' +
      '— un seul ARN viral suffit à déclencher le massacre, et le massacre se ' +
      'voit à l’œil nu. Le défaut est devenu la mesure.',
    objet: groupe,
    ancre: groupe.position.clone(),
    rayonCadrage: 0.09,
    couleur: 0xb04a00,
    animer,
  }
}

export function creerCrispr(): MecanismeBrut[] {
  return [creerCas9(), creerCas13()]
}
