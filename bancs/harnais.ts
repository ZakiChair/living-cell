import * as THREE from 'three'
import { creerCompteur, type Compteur } from '../src/noyau/metrologie.js'

export interface ContexteBanc {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  compteur: Compteur
}

let panneau: HTMLPreElement | null = null

/** Sondes de temps GPU en attente de résultat. */
const requetes: WebGLQuery[] = []
/** Au-delà de ce nombre de sondes en attente, on cesse d'en créer : quelque chose ne se vide pas. */
const SONDES_MAX = 32
let extensionTimer: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null = null
let dernierGpuMs: number | null = null

export function creerBanc(options: { titre: string }): ContexteBanc {
  document.title = options.titre

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  // Sans ce gestionnaire, le mode de panne d'iOS est un canvas blanc silencieux.
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    definirLignes(['CONTEXTE WEBGL PERDU — dépassement mémoire probable'])
  })

  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#F2EEE4')

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500)
  camera.position.set(0, 0, 28)

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  panneau = document.createElement('pre')
  panneau.style.cssText =
    'position:fixed;top:0;left:0;margin:0;padding:12px 16px;' +
    'font:13px/1.5 ui-monospace,Menlo,monospace;color:#1C1A17;' +
    'background:rgba(242,238,228,.82);backdrop-filter:blur(6px);' +
    'white-space:pre;pointer-events:none'
  document.body.appendChild(panneau)

  const gl = renderer.getContext() as WebGL2RenderingContext
  extensionTimer = gl.getExtension('EXT_disjoint_timer_query_webgl2')

  return { renderer, scene, camera, compteur: creerCompteur({ taille: 60 }) }
}

export function definirLignes(lignes: string[]): void {
  if (panneau) panneau.textContent = lignes.join('\n')
}

export function mesurerGpu(): number | null {
  return dernierGpuMs
}

export function demarrerBoucle(ctx: ContexteBanc, parImage: (dt: number) => void): void {
  let precedent = performance.now()

  const boucle = (): void => {
    requestAnimationFrame(boucle)

    // Onglet masqué : on ne brûle pas de batterie et on ne pollue pas les mesures.
    if (document.visibilityState === 'hidden') {
      precedent = performance.now()
      return
    }

    const maintenant = performance.now()
    const dt = maintenant - precedent
    precedent = maintenant
    ctx.compteur.ajouter(dt)

    const gl = ctx.renderer.getContext() as WebGL2RenderingContext
    let requete: WebGLQuery | null = null
    if (extensionTimer && requetes.length < SONDES_MAX) {
      requete = gl.createQuery()
      if (requete) gl.beginQuery(extensionTimer.TIME_ELAPSED_EXT, requete)
    }

    parImage(dt)
    ctx.renderer.render(ctx.scene, ctx.camera)

    if (extensionTimer && requete) {
      gl.endQuery(extensionTimer.TIME_ELAPSED_EXT)
      requetes.push(requete)
    }
    recolterGpu(gl)
  }

  requestAnimationFrame(boucle)
}

/** Relève les sondes GPU dont le résultat est arrivé. Non bloquant. */
function recolterGpu(gl: WebGL2RenderingContext): void {
  if (!extensionTimer) return
  while (requetes.length > 0) {
    const q = requetes[0]!
    const prete = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) as boolean
    const invalide = gl.getParameter(extensionTimer.GPU_DISJOINT_EXT) as boolean
    if (!prete && !invalide) return
    requetes.shift()
    if (prete && !invalide) {
      dernierGpuMs = (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6
    }
    gl.deleteQuery(q)
  }
}

export function enregistrerResultat(nom: string, donnees: unknown): void {
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' })
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(blob)
  lien.download = `${nom}.json`
  lien.click()
  URL.revokeObjectURL(lien.href)
}
