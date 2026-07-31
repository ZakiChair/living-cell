import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { PLAN_COUPE, RAYON_CELLULE, TEINTES, type Organite } from './contrat.js'

export interface Vue {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controles: OrbitControls
  organites: Organite[]
  /** Correspondance objet 3D → organite, pour retrouver la fiche au survol. */
  proprietaire: Map<THREE.Object3D, Organite>
  /**
   * Les seuls maillages que le rayon de survol teste.
   *
   * Le raycaster de Three.js n'a aucune accélération spatiale sur les
   * `InstancedMesh` : il les parcourt instance par instance. Lancer un rayon sur
   * toute la scène coûtait 9,7 ms par mouvement de souris, soit davantage qu'une
   * image entière à 120 par seconde. On tient donc une liste blanche, dressée à
   * la pose, d'où les grands amas sont exclus.
   */
  designables: THREE.Object3D[]
}

/**
 * Au-delà de ce nombre d'instances, un amas n'est plus désignable.
 *
 * Ce n'est pas qu'un compromis de vitesse : un grain de cytosol parmi soixante
 * mille n'a pas d'identité propre, et l'étiquette qu'il ouvrirait serait celle
 * de la famille entière — que la légende donne déjà. `encombrement.ts` avait
 * d'ailleurs déjà pris cette décision pour ses propres amas ; on la généralise
 * au lieu de la laisser à chaque module.
 */
const SEUIL_INSTANCES_DESIGNABLES = 400

export function creerVue(conteneur: HTMLElement): Vue {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    // La scène couvre du nanomètre à la dizaine de micromètres. Un tampon de
    // profondeur linéaire y ferait vibrer les surfaces lointaines.
    logarithmicDepthBuffer: true,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  // Sans ça, les plans de coupe des matériaux sont ignorés et l'écorché n'existe pas.
  renderer.localClippingEnabled = true
  // La scène EST la totalité du contenu de la page : sans rôle ni description,
  // un lecteur d'écran n'en reçoit rien du tout. Ce n'est pas une alternative
  // complète — il n'en existe pas — mais l'annoncer vaut mieux que le silence,
  // et la légende comme la liste des mécanismes, elles, sont du texte lisible.
  renderer.domElement.setAttribute('role', 'img')
  renderer.domElement.setAttribute(
    'aria-label',
    "Écorché en trois dimensions d'une cellule eucaryote animale : noyau, " +
      'mitochondries, réticulum endoplasmique, appareil de Golgi, vésicules et ' +
      'cytosquelette, à leurs proportions réelles. La légende et la liste des ' +
      'mécanismes, à gauche, donnent le même contenu en texte.',
  )
  conteneur.appendChild(renderer.domElement)

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    console.error('contexte WebGL perdu')
  })

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(TEINTES.cytosol)
  // Le brouillard fait reculer le fond de la cellule et donne la profondeur
  // sans coûter le prix d'une vraie profondeur de champ.
  scene.fog = new THREE.Fog(TEINTES.cytosol, RAYON_CELLULE * 2.2, RAYON_CELLULE * 5.5)

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    // 2 nm de plan proche : sans ça, s'approcher d'une ATP synthase la
    // trancherait. Le rapport près/loin atteint 10⁵, d'où le tampon de
    // profondeur logarithmique activé sur le renderer.
    0.002,
    200,
  )
  // Assez près pour que les organites soient lisibles, assez loin pour que la
  // cellule tienne dans le cadre : une mitochondrie de 2 µm doit faire une
  // silhouette identifiable, pas un grain.
  camera.position.set(5, 5, 24)

  const controles = new OrbitControls(camera, renderer.domElement)
  controles.enableDamping = true
  controles.dampingFactor = 0.06
  // 5 nm : la cellule fait 20 µm et une ATP synthase 10 nm. Sans cette borne
  // très basse, la caméra ne peut pas descendre à l'échelle où les mécanismes
  // se passent réellement, et il faudrait les grossir pour les montrer — c'est
  // exactement ce qu'on refuse de faire.
  controles.minDistance = 0.005
  controles.maxDistance = 45
  controles.target.set(0, 0, 0)

  // Éclairage d'atlas : une dominante douce, une clé haute, un contre-jour
  // froid pour détacher les silhouettes du fond. Aucun reflet spéculaire.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f6d, 1.9))
  const cle = new THREE.DirectionalLight(0xfff4e2, 1.5)
  cle.position.set(8, 14, 12)
  scene.add(cle)
  const contre = new THREE.DirectionalLight(0xbcd4ff, 0.7)
  contre.position.set(-10, -6, -8)
  scene.add(contre)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  return {
    renderer,
    scene,
    camera,
    controles,
    organites: [],
    proprietaire: new Map(),
    designables: [],
  }
}

/** Ajoute un organite à la scène et l'inscrit pour le survol. */
export function poser(vue: Vue, organites: Organite[]): void {
  for (const organite of organites) {
    vue.scene.add(organite.objet)
    vue.organites.push(organite)
    organite.objet.traverse((noeud) => {
      const maillage = noeud as THREE.Mesh
      if (!maillage.isMesh) return
      vue.proprietaire.set(noeud, organite)
      const amas = noeud as THREE.InstancedMesh
      if (amas.isInstancedMesh && amas.count > SEUIL_INSTANCES_DESIGNABLES) return
      vue.designables.push(noeud)
    })
  }
}

/**
 * Ouvre ou ferme l'écorché.
 *
 * Le plan de coupe est partagé par tous les matériaux : déplacer sa constante
 * suffit à ouvrir la cellule d'un bloc. À 0 elle est tranchée en son milieu, à
 * RAYON_CELLULE elle est entière.
 */
export function reglerCoupe(fraction: number): void {
  // À 0 la coupe passe par le centre, à 1 la cellule est refermée.
  PLAN_COUPE.constant = fraction * RAYON_CELLULE * 1.08
}

const rayon = new THREE.Raycaster()
const pointeur = new THREE.Vector2()

/** Renvoie l'organite sous le curseur, ou null. */
export function organiteSous(vue: Vue, x: number, y: number): Organite | null {
  pointeur.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1)
  rayon.setFromCamera(pointeur, vue.camera)
  // Liste blanche et non récursif : les enfants sont déjà tous dans la liste,
  // et `true` les ferait tester deux fois.
  const touches = rayon.intersectObjects(vue.designables, false)
  for (const touche of touches) {
    // Un point retiré par l'écorché est visuellement absent, mais le raycaster
    // l'atteindrait quand même : on refait donc le test du plan de coupe.
    if (PLAN_COUPE.distanceToPoint(touche.point) < 0) continue
    const organite = vue.proprietaire.get(touche.object)
    if (organite) return organite
  }
  return null
}
