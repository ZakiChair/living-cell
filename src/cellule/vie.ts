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
 * TRADUCTION D'UN ARN MESSAGER.
 *
 * Un brin d'ARNm porté par plusieurs ribosomes — un polysome, car un ARNm actif
 * n'en porte jamais un seul. Chaque ribosome avance codon par codon et laisse
 * derrière lui une chaîne d'acides aminés qui s'allonge.
 *
 * Le ribosome du mammifère assemble 5 à 6 acides aminés par seconde ; à un
 * ralenti de ×20, un codon prend un peu plus de trois secondes, ce qui est
 * lisible. Le mouvement est un CLIQUET discret, pas un glissement continu :
 * c'est l'erreur la plus répandue des animations de traduction.
 */
export function creerTraduction(): Flux {
  const alea = creerAlea(31337)
  const groupe = new THREE.Group()
  groupe.position.set(-4.6, 3.4, 1.6)

  const NB_CODONS = 42
  const PAS = 0.06

  // Le brin d'ARNm : replié, jamais tendu. Un ARNm réel est en pelote.
  const pointsBrin: THREE.Vector3[] = []
  for (let i = 0; i <= 10; i++) {
    const u = i / 10
    pointsBrin.push(
      new THREE.Vector3(
        (u - 0.5) * NB_CODONS * PAS,
        Math.sin(u * Math.PI * 2.2) * 0.22 + (alea() - 0.5) * 0.08,
        Math.cos(u * Math.PI * 1.7) * 0.18,
      ),
    )
  }
  const brin = new THREE.CatmullRomCurve3(pointsBrin)
  const tubeBrin = new THREE.Mesh(
    new THREE.TubeGeometry(brin, 140, 0.012, 6, false),
    materiauOrganite(TEINTES.chromatine),
  )
  groupe.add(tubeBrin)

  // Trois ribosomes sur le même brin : c'est un polysome.
  const NB_RIBOSOMES = 3
  const ribosomes: THREE.Group[] = []
  for (let i = 0; i < NB_RIBOSOMES; i++) {
    const ribosome = new THREE.Group()
    // Le ribosome a deux sous-unités de tailles nettement différentes, et c'est
    // à ça qu'on le reconnaît. Il mesure 25 nm, soit 0,025 µm.
    const grande = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.016, 2),
      materiauOrganite(TEINTES.ribosome),
    )
    grande.scale.set(1, 0.85, 1)
    const petite = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.011, 2),
      materiauOrganite(0xb04a00),
    )
    petite.position.y = -0.018
    petite.scale.set(1.05, 0.75, 1)
    ribosome.add(grande, petite)
    groupe.add(ribosome)
    ribosomes.push(ribosome)
  }

  // La chaîne naissante : elle sort par le tunnel du ribosome et s'allonge.
  const CHAINE_MAX = 26
  const geometrieAcide = new THREE.IcosahedronGeometry(0.009, 1)
  const materiauChaine = materiauOrganite(TEINTES.golgi, { doubleFace: false })
  const chaines = new THREE.InstancedMesh(
    geometrieAcide,
    materiauChaine,
    CHAINE_MAX * NB_RIBOSOMES,
  )
  chaines.frustumCulled = false
  groupe.add(chaines)

  const animer = (temps: number): void => {
    for (let r = 0; r < NB_RIBOSOMES; r++) {
      // Cliquet : la position avance par pas entiers de codon, jamais entre deux.
      const avance = temps * 0.42 + r * 0.31
      const codon = Math.floor(avance * NB_CODONS) % NB_CODONS
      const t = codon / NB_CODONS

      brin.getPointAt(t, positionTemp)
      const ribosome = ribosomes[r]!
      ribosome.position.copy(positionTemp)
      // Le ribosome est posé SUR le brin, pas traversé par lui.
      brin.getTangentAt(t, axeTemp)
      quaternionTemp.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axeTemp)
      ribosome.quaternion.copy(quaternionTemp)

      // La chaîne s'allonge à mesure que le ribosome avance, puis repart de zéro
      // au codon stop — la protéine est libérée et le ribosome se détache.
      const longueur = Math.min(CHAINE_MAX, codon)
      for (let a = 0; a < CHAINE_MAX; a++) {
        const indice = r * CHAINE_MAX + a
        if (a >= longueur) {
          echelleTemp.setScalar(0)
        } else {
          echelleTemp.setScalar(1)
          const recul = (a + 1) * 0.014
          positionTemp.copy(ribosome.position)
          positionTemp.x += Math.sin(a * 0.9 + r) * 0.03 - recul * 0.3
          positionTemp.y += 0.035 + recul * 0.55
          positionTemp.z += Math.cos(a * 0.7 + r) * 0.03
        }
        matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
        chaines.setMatrixAt(indice, matriceTemp)
      }
    }
    echelleTemp.setScalar(1)
    chaines.instanceMatrix.needsUpdate = true
  }

  animer(0)

  return {
    cle: 'traduction',
    nom: 'Traduction dans le ribosome',
    facteur: 'ralenti ×20',
    objet: groupe,
    animer,
  }
}

/** Tous les flux vivants de la cellule. */
export function creerFlux(): Flux[] {
  return [creerEchangesMineraux(), creerTraficProteines(), creerTraduction()]
}
