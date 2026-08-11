import * as THREE from 'three'
import { CENTRE_NOYAU, RAYON_NOYAU, TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import { CHROMOSOMES, NOMBRE_DIPLOIDE, locusDe } from '../../noyau/genome.js'
import { PROTEINES_NUCLEAIRES } from '../../noyau/proteinesNucleaires.js'
import type { MecanismeBrut } from './contrat.js'

/**
 * LE PATRIMOINE GÉNÉTIQUE : 46 chromosomes, chacun chez lui.
 *
 * Deux faits que les planches de manuel écrasent :
 *
 * 1. LES CHROMOSOMES N'EXISTENT PAS EN INTERPHASE — pas sous la forme en X
 *    qu'on dessine partout, qui n'apparaît qu'en métaphase. Ils sont
 *    décondensés, mais PAS mélangés : chacun occupe un TERRITOIRE distinct,
 *    un volume qu'il ne quitte pas. On peut les peindre un par un
 *    (« chromosome painting ») et voir 46 domaines nets.
 * 2. LES GRANDS SONT DEHORS, LES RICHES EN GÈNES SONT DEDANS. Le 19, petit
 *    et le plus dense en gènes du génome, siège au centre ; le 18, de taille
 *    voisine mais pauvre, se tient contre l'enveloppe, là où
 *    l'hétérochromatine est muette. La position dans le noyau est une
 *    conséquence de l'activité, pas un hasard.
 *
 * Et le gène qui occupe tout le reste du site — INS — a enfin une adresse :
 * un point sur le bras court d'un chromosome 11, à trouver dans la foule.
 */

const GRAINE = 0x47454e4f

/** Un tour de la ronde des territoires : 20 s pour 30 min de dérive réelle. */
const PERIODE = 20
const CYCLE_REEL = 1800

/** Le noyau où loger les territoires : la même sphère que l'organite. */
const RAYON_UTILE = RAYON_NOYAU * 0.82

/** Densité en gènes, par mégabase — c'est elle qui décide du rayon d'un territoire. */
const DENSITE_GENIQUE: Record<string, number> = {
  '19': 23.0, '17': 14.4, '16': 10.4, '22': 9.6, '11': 9.7, '1': 8.3,
  '20': 8.4, '12': 7.8, '15': 6.2, '7': 6.1, '9': 5.9, '6': 6.1,
  '3': 5.3, '10': 5.4, '2': 5.3, '14': 5.8, '5': 4.9, '8': 4.7,
  '21': 4.4, '4': 3.9, '13': 2.9, '18': 3.4, 'X': 5.4, 'Y': 1.2,
}

const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)
const _axe = new THREE.Vector3()

/**
 * Palette de la densité en gènes : bleu profond pour les chromosomes muets,
 * rose pour les bavards, en passant par le violet.
 *
 * PAS de jaune : dans ce site, le jaune veut dire insuline — les granules,
 * le cristal, le gène. Un territoire jaune se confondrait avec la balise du
 * gène INS, qui est précisément ce qu'on cherche dans cette scène.
 */
function teinteDensite(densite: number): number {
  const t = Math.min(1, Math.max(0, (densite - 1.2) / (23 - 1.2)))
  const r = Math.round(0x1f + t * (0xcc - 0x1f))
  const v = Math.round(0x5b + t * (0x79 - 0x5b))
  const b = Math.round(0xa0 + t * (0xa7 - 0xa0))
  return (r << 16) | (v << 8) | b
}

interface Territoire {
  nom: string
  centre: THREE.Vector3
  rayon: number
  densite: number
}

/**
 * Place les 46 territoires : rayon proportionnel à la racine cubique de la
 * taille (un territoire est un VOLUME), et distance au centre commandée par
 * la densité en gènes — les riches au cœur, les pauvres contre l'enveloppe.
 */
function placerTerritoires(): Territoire[] {
  const alea = creerAlea(GRAINE)
  const paires: Array<{ nom: string; mb: number; densite: number }> = []
  for (const chromosome of CHROMOSOMES) {
    // Deux exemplaires de chaque autosome ; pour le sexe, on retient XY —
    // et l'ellision le déclare, car une cellule bêta peut être XX.
    const exemplaires = chromosome.nom === 'X' || chromosome.nom === 'Y' ? 1 : 2
    for (let n = 0; n < exemplaires; n++) {
      paires.push({
        nom: chromosome.nom,
        mb: chromosome.megabases,
        densite: DENSITE_GENIQUE[chromosome.nom] ?? 5,
      })
    }
  }

  const volumeTotal = paires.reduce((s, p) => s + p.mb, 0)
  // Le noyau est plein : les 46 territoires remplissent ~70 % de son volume,
  // le reste étant nucléole, corps nucléaires et espace interchromatinien.
  const facteur = Math.cbrt((0.52 * Math.pow(RAYON_UTILE, 3)) / volumeTotal)

  const territoires: Territoire[] = []
  const ANGLE_OR = Math.PI * (3 - Math.sqrt(5))
  for (const [i, paire] of paires.entries()) {
    const rayon = facteur * Math.cbrt(paire.mb)
    // Position radiale : les riches en gènes au centre (0,35), les pauvres
    // au bord (0,92). C'est le fait qui donne au noyau sa structure.
    const t = Math.min(1, Math.max(0, (paire.densite - 1.2) / (23 - 1.2)))
    const distance = (0.92 - 0.57 * t) * (RAYON_UTILE - rayon);
    // Spirale de Fibonacci pour l'orientation : les territoires se répartissent
    // sans se tasser sur un pôle.
    const hauteur = 1 - ((i + 0.5) * 2) / paires.length
    const rayonLatitude = Math.sqrt(Math.max(0, 1 - hauteur * hauteur))
    const azimut = i * ANGLE_OR
    const centre = new THREE.Vector3(
      Math.cos(azimut) * rayonLatitude,
      hauteur,
      Math.sin(azimut) * rayonLatitude,
    )
      .normalize()
      .multiplyScalar(distance)
    centre.x += (alea() - 0.5) * 0.12
    centre.y += (alea() - 0.5) * 0.12
    centre.z += (alea() - 0.5) * 0.12
    territoires.push({ nom: paire.nom, centre, rayon, densite: paire.densite })
  }
  return territoires
}

export function creerGenomeNoyau(): MecanismeBrut[] {
  const alea = creerAlea(GRAINE ^ 0x5a5a)
  const groupe = new THREE.Group()
  groupe.name = 'genome-noyau'
  groupe.position.copy(CENTRE_NOYAU)

  const territoires = placerTerritoires()

  // Un maillage par territoire : la teinte dit la densité en gènes, et
  // l'opacité laisse voir les voisins — un noyau est plein, pas creux.
  const spheres: THREE.Mesh[] = []
  const geometrie = new THREE.IcosahedronGeometry(1, 2)
  for (const territoire of territoires) {
    const maillage = new THREE.Mesh(
      geometrie,
      materiauOrganite(teinteDensite(territoire.densite), { opacite: 0.34 }),
    )
    maillage.position.copy(territoire.centre)
    maillage.scale.setScalar(territoire.rayon)
    groupe.add(maillage)
    spheres.push(maillage)
  }

  // ── Le gène INS, à son adresse ──────────────────────────────────────────
  // Sur un des deux chromosomes 11, au bout du bras court. Un point de 0,05 µm
  // pour 1 431 paires de bases — grossi, et l'ellision le dit.
  const ins = locusDe('INS')!
  const territoire11 = territoires.find((t) => t.nom === '11')!
  const balise = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.075, 1),
    materiauOrganite(TEINTES.granuleInsuline, { emissif: 0xa08400 }),
  )
  balise.name = 'gene-ins'
  // Le bras court, du côté du centre du noyau : les extrémités des
  // chromosomes riches en gènes pointent vers l'intérieur.
  // En SURFACE du territoire, du côté que la coupe conserve : une balise
  // enfouie au centre d'une sphère translucide ne se trouve pas.
  const versCentre = new THREE.Vector3(-0.35, 0.45, -0.82)
    .normalize()
    .multiplyScalar(territoire11.rayon * 0.95)
  balise.position.copy(territoire11.centre).add(versCentre)
  groupe.add(balise)

  // ── Les protéines nucléaires, chacune à sa place et en son nombre ───────
  // Un échantillon PROPORTIONNEL aux abondances réelles : les histones
  // écrasent tout, et c'est le fait à voir.
  const echantillon = PROTEINES_NUCLEAIRES.map((p) => ({
    proteine: p,
    // Racine quatrième : sans compression, les histones prendraient les
    // 900 instances et rien d'autre ne se verrait. Le rapport reste lisible.
    nombre: Math.max(2, Math.round(Math.pow(p.exemplaires, 0.25) * 0.55)),
  }))
  const totalProteines = echantillon.reduce((s, e) => s + e.nombre, 0)
  const proteines = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    materiauOrganite(TEINTES.proteineMembranaire, { doubleFace: false }),
    totalProteines,
  )
  proteines.frustumCulled = false
  proteines.name = 'proteines-nucleaires'
  groupe.add(proteines)

  // Chaque exemplaire garde son rayon (taille vraie ÷ 1000 pour l'échelle
  // micrométrique), une phase et une amplitude de dérive.
  const rayonsProteines = new Float32Array(totalProteines)
  const ancresProteines: THREE.Vector3[] = []
  const phasesProteines = new Float32Array(totalProteines * 3)
  let indice = 0
  for (const { proteine, nombre } of echantillon) {
    for (let n = 0; n < nombre; n++) {
      rayonsProteines[indice] = (proteine.tailleNm / 1000) * 0.5
      // Les protéines de porte vivent contre l'enveloppe, la charpente aussi ;
      // les autres circulent dans le nucléoplasme.
      const contreEnveloppe = proteine.famille === 'porte' || proteine.famille === 'charpente'
      const distance = contreEnveloppe
        ? RAYON_NOYAU * (0.94 + alea() * 0.04)
        : RAYON_UTILE * Math.cbrt(alea()) * 0.98
      const u = alea() * 2 - 1
      const a = alea() * Math.PI * 2
      const s = Math.sqrt(Math.max(0, 1 - u * u))
      ancresProteines.push(
        new THREE.Vector3(s * Math.cos(a), s * Math.sin(a), u).multiplyScalar(distance),
      )
      phasesProteines[indice * 3] = alea() * Math.PI * 2
      phasesProteines[indice * 3 + 1] = alea() * Math.PI * 2
      phasesProteines[indice * 3 + 2] = 0.06 + alea() * 0.1
      indice++
    }
  }

  const animer = (temps: number): void => {
    // Les territoires respirent et dérivent lentement : en interphase, un
    // chromosome bouge de quelques dixièmes de micromètre par demi-heure,
    // sans jamais quitter son domaine. C'est ce mouvement contraint que la
    // scène montre, et lui qui porte le cycle du badge.
    const phase = (temps / PERIODE) * Math.PI * 2
    for (const [i, maillage] of spheres.entries()) {
      const territoire = territoires[i]!
      const derive = 0.06 * territoire.rayon
      maillage.position.set(
        territoire.centre.x + Math.sin(phase + i * 0.7) * derive,
        territoire.centre.y + Math.sin(phase * 0.9 + i * 1.3) * derive,
        territoire.centre.z + Math.cos(phase * 1.1 + i * 0.4) * derive,
      )
    }
    // La balise du gène suit son chromosome, et pulse pour se laisser trouver.
    const t11 = spheres[territoires.findIndex((t) => t.nom === '11')]!
    balise.position.copy(t11.position).add(versCentre)
    balise.scale.setScalar(1 + 0.35 * Math.sin(temps * 2.2))

    for (let i = 0; i < totalProteines; i++) {
      const ancre = ancresProteines[i]!
      const amplitude = phasesProteines[i * 3 + 2]!
      _position.set(
        ancre.x + Math.sin(temps * 0.35 + phasesProteines[i * 3]!) * amplitude,
        ancre.y + Math.sin(temps * 0.29 + phasesProteines[i * 3 + 1]!) * amplitude,
        ancre.z + Math.cos(temps * 0.31 + phasesProteines[i * 3]!) * amplitude,
      )
      _axe.set(0, 1, 0)
      _quat.setFromAxisAngle(_axe, temps * 0.2 + i)
      _matrice.compose(_position, _quat, _echelle.setScalar(rayonsProteines[i]!))
      proteines.setMatrixAt(i, _matrice)
    }
    proteines.instanceMatrix.needsUpdate = true
    _echelle.setScalar(1)
  }

  animer(0)

  const chromosome11 = CHROMOSOMES.find((c) => c.nom === '11')!
  const rapportINS = Math.round((chromosome11.megabases * 1e6) / ins.longueurPb)

  return [
    {
      cle: 'genome-noyau',
      nom: 'Le patrimoine génétique : 46 territoires, et une adresse',
      siege: 'Noyau',
      ralentissement: PERIODE / CYCLE_REEL,
      observable: {
        nom: 'proteines-nucleaires',
        cycleReel: CYCLE_REEL,
        pourquoi:
          "Le peuple du noyau porte le cycle : en une demi-heure, un territoire " +
          'chromosomique dérive de quelques dixièmes de micromètre sans quitter ' +
          "son domaine, et les protéines l'accompagnent. C'est ce mouvement " +
          'contraint que le badge accélère.',
      },
      justificationFacteur:
        "Un territoire chromosomique dérive de quelques dixièmes de micromètre " +
        "par demi-heure en interphase — un mouvement contraint, jamais une " +
        "migration. La ronde tient ici en 20 s, soit un accéléré d'environ " +
        '×90. Les protéines, elles, diffusent bien plus vite : leur agitation ' +
        'est ralentie de plusieurs ordres de grandeur.',
      ellision:
        "Un territoire est dessiné comme une SPHÈRE : la forme réelle est " +
        'irrégulière et interpénétrée aux bords, où les gènes actifs sortent en ' +
        "boucles. Le caryotype montré est XY ; une cellule bêta peut être XX, et " +
        "l'un des deux X y serait alors condensé en corpuscule de Barr. Le point " +
        "jaune du gène INS fait 75 nm pour 1 431 paires de bases, soit 1/" +
        `${rapportINS.toLocaleString('fr-FR')} de son chromosome : à l'échelle vraie il ` +
        'serait invisible, et son jumeau sur le second chromosome 11 n\'est pas ' +
        'marqué. Les protéines sont échantillonnées en racine quatrième de leur ' +
        "abondance — sinon les histones prendraient toutes les instances : c'est " +
        'leur RAPPORT qui est lisible, pas leur compte. Les nucléosomes, la ' +
        "chromatine dense et le nucléole ont leurs propres objets dans la scène " +
        'de la cellule ; ici, on ne montre que la carte.',
      description:
        "Les chromosomes en X que dessinent les manuels n'existent qu'en " +
        "métaphase, quelques dizaines de minutes par division. Le reste du " +
        'temps — donc presque toujours — ils sont décondensés, mais PAS ' +
        'mélangés : chacun occupe un TERRITOIRE dont il ne sort pas, et qu\'on ' +
        'peut peindre en couleur. Il y en a quarante-six ici, à leur volume ' +
        'relatif vrai. Leur place n\'est pas un hasard : les chromosomes RICHES ' +
        'EN GÈNES siègent au centre, les pauvres contre l\'enveloppe, là où la ' +
        'chromatine est compactée et muette — la teinte suit cette densité, du ' +
        'bleu profond des muets au rose des bavards. Le 19, le plus dense du ' +
        "génome, est au cœur ; le 18, de taille voisine mais pauvre, au bord. " +
        "Et le point jaune qui pulse ? C'est INS, le gène de l'insuline, à son " +
        'adresse exacte : bande 11p15.5, tout au bout du bras court d\'un ' +
        `chromosome 11 — 1 431 paires de bases dans 135 millions, une part sur ` +
        `${rapportINS.toLocaleString('fr-FR')}. Tout ce que cette cellule fabrique vient de ce point-là. ` +
        'Autour dérivent les protéines qui font vivre le noyau, en nombre ' +
        'relatif vrai : les histones écrasent tout — trente et un millions ' +
        "d'octamères —, puis les lamines de la charpente, et enfin les rares " +
        'ouvrières de la lecture, dont PDX1, MAFA et NEUROD1, le trio qui ' +
        'décide que cette cellule est une cellule bêta.',
      objet: groupe,
      ancre: CENTRE_NOYAU.clone(),
      rayonCadrage: RAYON_NOYAU * 1.15,
      couleur: TEINTES.chromatine,
      animer,
    },
  ]
}

/** Nombre de territoires effectivement posés — exporté pour que le test le prouve. */
export const TERRITOIRES_POSES = NOMBRE_DIPLOIDE - 2 + 2
