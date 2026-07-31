import * as THREE from 'three'
import { creerBanc, demarrerBoucle, definirLignes, mesurerGpu, enregistrerResultat } from './harnais.js'
import { nombreObjets, VOLUME_COMPLEXE_NM3, OCCUPATION_CYTOSOL } from '../src/noyau/densite.js'
import { nmVersUnites, RAYON_SCENE } from '../src/noyau/echelles.js'

/** Arêtes de dalle à essayer, en nanomètres. Réglable par `?arete=1000`. */
const ARETES_NM = [300, 500, 700, 1_000, 1_500, 2_000, 3_000, 4_000, 6_000]

/**
 * Profondeur de la dalle, en nanomètres.
 *
 * C'est le paramètre qui rend l'encombrement finançable : au-delà de la
 * première couche, plus de 99 % des instances sont occultées et les dessiner
 * est du gaspillage pur. Réglable par `?profondeur=200`.
 */
const PROFONDEUR_NM = lireParametre('profondeur', 300)

/** Six familles Okabe-Ito, palette validée de la spec. */
const FAMILLES = [0x0072b2, 0x009e73, 0xe69f00, 0xcc79a7, 0x56b4e9, 0xd55e00]

/** Portes chiffrées de la spec. */
const PORTE_BUREAU = 55
const PORTE_MOBILE = 28

function lireParametre(nom: string, defaut: number): number {
  const brut = new URLSearchParams(location.search).get(nom)
  const valeur = Number.parseInt(brut ?? '', 10)
  return Number.isFinite(valeur) && valeur > 0 ? valeur : defaut
}

const ctx = creerBanc({ titre: 'Banc 0b — dalle à densité vraie' })
ctx.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f6d, 2.2))

// La caméra est placée pour que l'arête de la dalle remplisse la hauteur du
// champ, quelle que soit l'arête choisie : on compare toujours la même surface
// à l'écran, donc le même taux de remplissage.
const FOV_RAD = (50 * Math.PI) / 180
ctx.camera.position.set(0, 0, RAYON_SCENE / Math.tan(FOV_RAD / 2))

// Objets temporaires hissés hors de toute boucle.
const matriceTemp = new THREE.Matrix4()
const positionTemp = new THREE.Vector3()
const quaternionTemp = new THREE.Quaternion()
const echelleTemp = new THREE.Vector3()
const couleurTemp = new THREE.Color()

let dalle: THREE.InstancedMesh | null = null
let indexArete = Math.max(0, ARETES_NM.indexOf(lireParametre('arete', 0)))
const mesures: Array<{
  areteNm: number
  profondeurNm: number
  instances: number
  gpuMs: number
  ips: number
}> = []

function construireDalle(areteNm: number): void {
  if (dalle) {
    ctx.scene.remove(dalle)
    dalle.geometry.dispose()
    ;(dalle.material as THREE.Material).dispose()
    dalle.dispose()
  }

  const instances = nombreObjets(areteNm, PROFONDEUR_NM, OCCUPATION_CYTOSOL, VOLUME_COMPLEXE_NM3)

  // Le champ visible vaut l'arête : la dalle remplit toujours l'écran de la
  // même façon, seule la finesse des objets change.
  const areteUnites = nmVersUnites(areteNm, areteNm)
  const profondeurUnites = nmVersUnites(PROFONDEUR_NM, areteNm)

  // Rayon d'une sphère de volume VOLUME_COMPLEXE_NM3.
  const rayonNm = Math.cbrt((3 * VOLUME_COMPLEXE_NM3) / (4 * Math.PI))
  const rayonUnites = nmVersUnites(rayonNm, areteNm)

  const materiau = new THREE.MeshLambertMaterial()
  dalle = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(rayonUnites, 1), materiau, instances)
  dalle.frustumCulled = false

  for (let i = 0; i < instances; i++) {
    positionTemp.set(
      (Math.random() - 0.5) * areteUnites,
      (Math.random() - 0.5) * areteUnites,
      (Math.random() - 0.5) * profondeurUnites,
    )
    quaternionTemp.set(Math.random(), Math.random(), Math.random(), Math.random()).normalize()
    // Les complexes réels ne sont pas tous de même taille : ±25 % de variation.
    echelleTemp.setScalar(0.75 + Math.random() * 0.5)
    matriceTemp.compose(positionTemp, quaternionTemp, echelleTemp)
    dalle.setMatrixAt(i, matriceTemp)
    couleurTemp.setHex(FAMILLES[i % FAMILLES.length]!)
    dalle.setColorAt(i, couleurTemp)
  }
  dalle.instanceMatrix.needsUpdate = true
  if (dalle.instanceColor) dalle.instanceColor.needsUpdate = true
  ctx.scene.add(dalle)
}

construireDalle(ARETES_NM[indexArete]!)

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' && indexArete < ARETES_NM.length - 1) {
    indexArete++
    construireDalle(ARETES_NM[indexArete]!)
  }
  if (e.key === 'ArrowLeft' && indexArete > 0) {
    indexArete--
    construireDalle(ARETES_NM[indexArete]!)
  }
  if (e.key === 'e') {
    mesures.push({
      areteNm: ARETES_NM[indexArete]!,
      profondeurNm: PROFONDEUR_NM,
      instances: dalle!.count,
      gpuMs: mesurerGpu() ?? -1,
      ips: ctx.compteur.imagesParSeconde(),
    })
    enregistrerResultat('0b-dalle', mesures)
  }
})

demarrerBoucle(ctx, () => {
  const areteNm = ARETES_NM[indexArete]!
  const ips = ctx.compteur.imagesParSeconde()
  const gpu = mesurerGpu()
  definirLignes([
    `BANC 0b — dalle à densité vraie`,
    ``,
    `arête           ${areteNm} nm`,
    `profondeur      ${PROFONDEUR_NM} nm`,
    `occupation      ${(OCCUPATION_CYTOSOL * 100).toFixed(0)} %`,
    `instances       ${dalle!.count.toLocaleString('fr-FR')}`,
    `temps GPU       ${gpu === null ? 'extension absente' : gpu.toFixed(2) + ' ms'}`,
    `images/s        ${ips.toFixed(0)}`,
    ``,
    `porte bureau    ${ips >= PORTE_BUREAU ? 'PASSÉE' : 'ÉCHOUÉE'} (≥ ${PORTE_BUREAU})`,
    `porte mobile    ${ips >= PORTE_MOBILE ? 'PASSÉE' : 'ÉCHOUÉE'} (≥ ${PORTE_MOBILE})`,
    ``,
    `[← →] changer d'arête   [e] exporter`,
    `?arete=1000&profondeur=300 pour fixer la mesure`,
  ])
})
