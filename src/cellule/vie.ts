import * as THREE from 'three'
import { RAYON_CELLULE, TEINTES, creerAlea, materiauOrganite } from './contrat.js'

/**
 * Les processus vivants de la cellule.
 *
 * Trois flux, chacun avec son propre facteur de temps affiché : les échelles
 * réelles sont incompatibles — un ion traverse un canal en quelques dizaines de
 * nanosecondes, une protéine met vingt minutes à rejoindre la surface. Les
 * montrer « à vitesse réelle » dans le même plan est impossible, pas seulement
 * coûteux. Chaque flux déclare donc son ralenti ou son accéléré.
 */

export interface Flux {
  cle: string
  nom: string
  /** Ce que le badge affiche : « ralenti ×1 000 », « accéléré ×100 ». */
  facteur: string
  objet: THREE.Object3D
  animer: (temps: number) => void
}

const POSITION_GOLGI = new THREE.Vector3(3.2, -1.5, 0.5)
const POSITION_RER = new THREE.Vector3(-4, -1, 0)

// ── Objets temporaires, hissés hors des boucles d'animation ────────────────
const matriceTemp = new THREE.Matrix4()
const positionTemp = new THREE.Vector3()
const quaternionTemp = new THREE.Quaternion()
const echelleTemp = new THREE.Vector3(1, 1, 1)
const axeTemp = new THREE.Vector3()

/**
 * ÉCHANGES DE MINÉRAUX À LA SURFACE.
 *
 * Le contraste que cette scène doit faire voir : une pompe fait ~100 cycles par
 * seconde, un canal ouvert laisse passer jusqu'à 10⁸ ions par seconde. L'écart
 * est de cent mille. On le rend en dessinant les ions des canaux comme un JET
 * continu et rapide, et ceux des pompes comme des grains qu'on peut suivre à
 * l'œil. Le contraste visuel encode le rapport, sans un mot de commentaire.
 */
export function creerEchangesMineraux(): Flux {
  const alea = creerAlea(4711)
  const groupe = new THREE.Group()

  const NB_SITES = 26
  const IONS_PAR_SITE = 14
  const NB_IONS = NB_SITES * IONS_PAR_SITE

  // Chaque site est un point de la membrane : la moitié sont des canaux
  // (flux rapide, sortant ou entrant en jet), l'autre des pompes (lentes).
  const sites: Array<{ base: THREE.Vector3; normale: THREE.Vector3; canal: boolean }> = []
  for (let i = 0; i < NB_SITES; i++) {
    // Répartition en spirale de Fibonacci : régulière sans être grillagée.
    const y = 1 - (i / (NB_SITES - 1)) * 2
    const rayon = Math.sqrt(Math.max(0, 1 - y * y))
    const angle = i * 2.399963
    const normale = new THREE.Vector3(Math.cos(angle) * rayon, y, Math.sin(angle) * rayon).normalize()
    sites.push({
      base: normale.clone().multiplyScalar(RAYON_CELLULE),
      normale,
      canal: i % 2 === 0,
    })
  }

  const geometrieIon = new THREE.IcosahedronGeometry(0.055, 0)
  const materiauSodium = materiauOrganite(0xe69f00, { doubleFace: false })
  const materiauPotassium = materiauOrganite(0x56b4e9, { doubleFace: false })

  const sodium = new THREE.InstancedMesh(geometrieIon, materiauSodium, NB_IONS)
  const potassium = new THREE.InstancedMesh(geometrieIon, materiauPotassium, NB_IONS)
  sodium.frustumCulled = false
  potassium.frustumCulled = false
  groupe.add(sodium, potassium)

  // Décalage de phase par ion, pour que le flux ne pulse pas en bloc.
  const phases = new Float32Array(NB_IONS)
  for (let i = 0; i < NB_IONS; i++) phases[i] = alea()

  /** Course d'un ion de part et d'autre de la membrane, en micromètres. */
  const COURSE = 1.5

  const animer = (temps: number): void => {
    for (let i = 0; i < NB_IONS; i++) {
      const site = sites[Math.floor(i / IONS_PAR_SITE)]!
      const phase = phases[i]!
      // Un canal débite cent mille fois plus qu'une pompe : on le rend par une
      // vitesse de défilement très supérieure, jusqu'à ce que les grains se
      // fondent en un jet continu.
      const vitesse = site.canal ? 0.85 : 0.075
      const t = (temps * vitesse + phase) % 1

      // Le sodium sort, le potassium entre : les deux gradients sont opposés,
      // et c'est ce que la pompe entretient en permanence.
      const sortieNa = (t - 0.5) * COURSE
      positionTemp.copy(site.normale).multiplyScalar(RAYON_CELLULE + sortieNa)
      // Léger éparpillement latéral, sinon les ions défilent en file indienne.
      axeTemp.set(phase - 0.5, 0.5 - phase, phase * 0.7 - 0.35).multiplyScalar(0.18)
      positionTemp.add(axeTemp)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      sodium.setMatrixAt(i, matriceTemp)

      const entreeK = (0.5 - t) * COURSE
      positionTemp.copy(site.normale).multiplyScalar(RAYON_CELLULE + entreeK)
      positionTemp.sub(axeTemp)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      potassium.setMatrixAt(i, matriceTemp)
    }
    sodium.instanceMatrix.needsUpdate = true
    potassium.instanceMatrix.needsUpdate = true
  }

  animer(0)

  return {
    cle: 'echanges-mineraux',
    nom: 'Échanges de minéraux',
    facteur: 'ralenti ×1 000',
    objet: groupe,
    animer,
  }
}

/**
 * TRAFIC DE PROTÉINES.
 *
 * Réticulum rugueux → Golgi → membrane plasmique. Chaque vésicule suit une
 * courbe et repart au début. Le trajet réel prend vingt à soixante minutes ;
 * ici il tient en une dizaine de secondes, soit un accéléré d'environ ×100.
 */
export function creerTraficProteines(): Flux {
  const alea = creerAlea(90210)
  const groupe = new THREE.Group()

  const NB_VESICULES = 34
  const trajets: THREE.CatmullRomCurve3[] = []

  for (let i = 0; i < NB_VESICULES; i++) {
    // Deux tiers vont du réticulum au Golgi, un tiers du Golgi à la membrane :
    // le trafic n'est pas un tapis roulant uniforme.
    const versMembrane = i % 3 === 0
    const depart = versMembrane ? POSITION_GOLGI : POSITION_RER
    const arrivee = versMembrane
      ? new THREE.Vector3(
          alea() * 2 - 1,
          alea() * 2 - 1,
          alea() * 2 - 1,
        ).normalize().multiplyScalar(RAYON_CELLULE - 0.1)
      : POSITION_GOLGI

    const milieu = depart.clone().lerp(arrivee, 0.5)
    milieu.x += (alea() - 0.5) * 3
    milieu.y += (alea() - 0.5) * 3
    milieu.z += (alea() - 0.5) * 2

    trajets.push(
      new THREE.CatmullRomCurve3([
        depart.clone().add(new THREE.Vector3((alea() - 0.5) * 1.2, (alea() - 0.5) * 1.2, (alea() - 0.5) * 1.2)),
        milieu,
        arrivee,
      ]),
    )
  }

  const geometrie = new THREE.IcosahedronGeometry(0.055, 1)
  const materiau = materiauOrganite(TEINTES.vesicule, { doubleFace: false })
  const vesicules = new THREE.InstancedMesh(geometrie, materiau, NB_VESICULES)
  vesicules.frustumCulled = false
  groupe.add(vesicules)

  const phases = new Float32Array(NB_VESICULES)
  const vitesses = new Float32Array(NB_VESICULES)
  for (let i = 0; i < NB_VESICULES; i++) {
    phases[i] = alea()
    // Les temps de transit sont dispersés : une protéine met de vingt minutes
    // à une heure selon sa destination, ce n'est pas un tapis à vitesse unique.
    vitesses[i] = 0.05 + alea() * 0.06
  }

  const animer = (temps: number): void => {
    for (let i = 0; i < NB_VESICULES; i++) {
      const t = (temps * vitesses[i]! + phases[i]!) % 1
      trajets[i]!.getPointAt(t, positionTemp)
      // La vésicule naît et disparaît en fondu de taille, pour éviter qu'elle
      // ne surgisse et ne s'évanouisse d'un coup à chaque tour de boucle.
      const apparition = Math.min(1, Math.min(t, 1 - t) * 12)
      echelleTemp.setScalar(apparition)
      matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
      vesicules.setMatrixAt(i, matriceTemp)
    }
    echelleTemp.setScalar(1)
    vesicules.instanceMatrix.needsUpdate = true
  }

  animer(0)

  return {
    cle: 'trafic-proteines',
    nom: 'Trafic de protéines',
    facteur: 'accéléré ×100',
    objet: groupe,
    animer,
  }
}

/**
 * Les flux d'ambiance de la cellule.
 *
 * Il y en avait trois. La traduction a été retirée : elle était la TROISIÈME du
 * projet — après le polysome libre et la translocation au réticulum — et son
 * champ `facteur` annonçait « ralenti ×20 » pour un accéléré ×3, faux de signe
 * et d'un facteur cinquante-neuf. Rien ne pouvait le signaler, ce champ n'étant
 * lu par personne : le panneau n'est peuplé que depuis `mecanismes`. L'atelier
 * du gène en ajoutant une quatrième, la garder revenait à ajouter à la pile.
 */
export function creerFlux(): Flux[] {
  return [creerEchangesMineraux(), creerTraficProteines()]
}
