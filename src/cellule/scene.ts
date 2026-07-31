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
}

export function creerVue(conteneur: HTMLElement): Vue {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  // Sans ça, les plans de coupe des matériaux sont ignorés et l'écorché n'existe pas.
  renderer.localClippingEnabled = true
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
    0.05,
    200,
  )
  // Assez près pour que les organites soient lisibles, assez loin pour que la
  // cellule tienne dans le cadre : une mitochondrie de 2 µm doit faire une
  // silhouette identifiable, pas un grain.
  camera.position.set(5, 5, 24)

  const controles = new OrbitControls(camera, renderer.domElement)
  controles.enableDamping = true
  controles.dampingFactor = 0.06
  controles.minDistance = 1.2
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

  return { renderer, scene, camera, controles, organites: [], proprietaire: new Map() }
}

/** Ajoute un organite à la scène et l'inscrit pour le survol. */
export function poser(vue: Vue, organites: Organite[]): void {
  for (const organite of organites) {
    vue.scene.add(organite.objet)
    vue.organites.push(organite)
    organite.objet.traverse((noeud) => {
      if ((noeud as THREE.Mesh).isMesh) vue.proprietaire.set(noeud, organite)
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
  const touches = rayon.intersectObjects(vue.scene.children, true)
  for (const touche of touches) {
    // Un point retiré par l'écorché est visuellement absent, mais le raycaster
    // l'atteindrait quand même : on refait donc le test du plan de coupe.
    if (PLAN_COUPE.distanceToPoint(touche.point) < 0) continue
    const organite = vue.proprietaire.get(touche.object)
    if (organite) return organite
  }
  return null
}
