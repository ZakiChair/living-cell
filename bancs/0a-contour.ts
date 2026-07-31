import * as THREE from 'three'
import { creerBanc, demarrerBoucle, definirLignes, mesurerGpu, enregistrerResultat } from './harnais.js'
import { projection11 } from '../src/noyau/contour.js'

const NOMBRE = 100_000

/**
 * Largeur du contour en pixels PHYSIQUES du tampon de dessin, pas en pixels CSS.
 * L'uniforme `hauteurEcran` étant lui aussi en pixels physiques, les deux doivent
 * s'accorder : à DPR 2, demander 1,5 donnerait 0,75 pixel CSS, soit un fil
 * invisible. 3 pixels physiques valent 1,5 pixel CSS à DPR 2.
 */
const LARGEUR_CONTOUR_PX = 3.0

/** Six familles Okabe-Ito, palette validée de la spec. */
const FAMILLES = [0x0072b2, 0x009e73, 0xe69f00, 0xcc79a7, 0x56b4e9, 0xd55e00]

const ctx = creerBanc({ titre: 'Banc 0a — contour par coque inversée' })
ctx.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f6d, 2.2))

// Uniformes partagés par toutes les coques : une seule source de vérité pour
// la largeur du contour, mise à jour au redimensionnement.
const uniformesContour = {
  largeurPx: { value: LARGEUR_CONTOUR_PX },
  hauteurEcran: { value: window.innerHeight * Math.min(window.devicePixelRatio, 2) },
  p11: { value: projection11(50) },
}

/**
 * Matériau de coque : faces arrière, couleur sombre, sommets poussés le long
 * de la normale d'une distance qui compense la perspective.
 */
function creerMateriauCoque(): THREE.MeshBasicMaterial {
  const materiau = new THREE.MeshBasicMaterial({ color: 0x2a2320, side: THREE.BackSide })
  materiau.onBeforeCompile = (shader) => {
    shader.uniforms.largeurPx = uniformesContour.largeurPx
    shader.uniforms.hauteurEcran = uniformesContour.hauteurEcran
    shader.uniforms.p11 = uniformesContour.p11
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float largeurPx;
         uniform float hauteurEcran;
         uniform float p11;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         // Position en espace vue, instanciation comprise.
         #ifdef USE_INSTANCING
           vec4 posVue = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
           vec3 normaleVue = mat3(modelViewMatrix) * mat3(instanceMatrix) * normal;
         #else
           vec4 posVue = modelViewMatrix * vec4(position, 1.0);
           vec3 normaleVue = mat3(modelViewMatrix) * normal;
         #endif
         // La longueur de la normale transformée NON normalisée donne le facteur
         // d'échelle entre espace objet et espace vue. On évite ainsi inverse(),
         // qui n'existe qu'en GLSL ES 3.00.
         float echelleVue = max(length(normaleVue), 1e-6);
         // Largeur constante à l'écran : l'offset croît avec la distance.
         float offsetVue = (-posVue.z * largeurPx * 2.0) / (hauteurEcran * p11);
         // Ramené en espace objet, où vit « transformed ».
         transformed += normal * (offsetVue / echelleVue);`,
      )
  }
  return materiau
}

/**
 * Crée un couple corps + coque partageant les mêmes matrices d'instance.
 * Les deux sont peuplés par le même appel, pour qu'ils ne puissent pas diverger.
 */
function creerCouple(
  geometrie: THREE.BufferGeometry,
  nombre: number,
  placer: (i: number, matrice: THREE.Matrix4) => number,
): { corps: THREE.InstancedMesh; coque: THREE.InstancedMesh } {
  // Surtout PAS `vertexColors: true` avec setColorAt. Three.js définit USE_COLOR
  // dans le vertex shader dès que vertexColors est vrai, ce qui déclare un
  // attribut `color` que la géométrie n'a pas : son défaut est (0,0,0) et tout
  // devient noir, sans erreur. instanceColor suffit — le fragment shader définit
  // USE_COLOR de lui-même quand instanceColor existe (WebGLProgram, ligne 737).
  const corps = new THREE.InstancedMesh(geometrie, new THREE.MeshLambertMaterial(), nombre)
  const coque = new THREE.InstancedMesh(geometrie, creerMateriauCoque(), nombre)
  corps.frustumCulled = false
  coque.frustumCulled = false
  coque.renderOrder = -1

  const matrice = new THREE.Matrix4()
  const couleur = new THREE.Color()
  for (let i = 0; i < nombre; i++) {
    const teinte = placer(i, matrice)
    corps.setMatrixAt(i, matrice)
    coque.setMatrixAt(i, matrice)
    couleur.setHex(teinte)
    corps.setColorAt(i, couleur)
  }
  corps.instanceMatrix.needsUpdate = true
  coque.instanceMatrix.needsUpdate = true
  if (corps.instanceColor) corps.instanceColor.needsUpdate = true

  return { corps, coque }
}

// --- Amas principal : la charge de 100 000 instances ---
// Boîte et rayon calibrés pour ~13 % d'occupation volumique. À plus dense, la
// scène devient un bloc opaque où l'on ne distingue plus aucune silhouette :
// elle mesurerait le coût sans rien montrer du rendu.
// L'amas est repoussé au fond pour laisser le premier plan aux deux tests.
const BOITE = { x: 74, y: 44, z: 30, centreZ: -30 }
const amas = creerCouple(new THREE.IcosahedronGeometry(0.22, 1), NOMBRE, (i, m) => {
  m.setPosition(
    (Math.random() - 0.5) * BOITE.x,
    (Math.random() - 0.5) * BOITE.y,
    BOITE.centreZ + (Math.random() - 0.5) * BOITE.z,
  )
  return FAMILLES[i % FAMILLES.length]!
})
ctx.scene.add(amas.corps, amas.coque)

ctx.camera.position.set(0, 0, 34)

// --- Témoins : douze sphères de la MÊME teinte, qui se recouvrent À L'ÉCRAN
// sans s'interpénétrer dans l'espace — le cas réel d'un encombrement
// moléculaire, où les molécules se touchent mais ne se traversent pas.
// Décalage latéral 1,4 et décalage en profondeur 2,4 : la distance entre
// centres vaut 2,8 pour un rayon de 1,0, donc aucune intersection.
const temoins = creerCouple(new THREE.IcosahedronGeometry(1.0, 2), 12, (i, m) => {
  const colonne = i % 4
  const rangee = Math.floor(i / 4)
  m.setPosition(6.5 + colonne * 1.4, 5.2 - rangee * 1.4, 22 - (colonne + rangee) * 2.4)
  return FAMILLES[0]!
})
ctx.scene.add(temoins.corps, temoins.coque)

// --- Échelle de profondeur : six sphères mises à l'échelle pour occuper la
// MÊME taille à l'écran malgré des distances allant de 12 à 72 unités.
// Si la formule de contour est juste, les six contours paraissent identiques ;
// si l'offset était constant en espace objet, le plus lointain aurait disparu.
const PROFONDEURS = [22, 10, -2, -14, -26, -38]
const positionTemp = new THREE.Vector3()
const rotationTemp = new THREE.Quaternion()
const echelleTemp = new THREE.Vector3()
const echelle = creerCouple(new THREE.IcosahedronGeometry(1.0, 2), PROFONDEURS.length, (i, m) => {
  const z = PROFONDEURS[i]!
  const facteur = (34 - z) / 12
  positionTemp.set(-13 + i * 5.2, -9.5, z)
  echelleTemp.setScalar(facteur)
  m.compose(positionTemp, rotationTemp, echelleTemp)
  return FAMILLES[2]!
})
ctx.scene.add(echelle.corps, echelle.coque)

window.addEventListener('resize', () => {
  uniformesContour.hauteurEcran.value = window.innerHeight * Math.min(window.devicePixelRatio, 2)
})

// --- Bascules clavier ---
let contourActif = true
let rotationActive = true
const mesures: Array<{ mode: string; gpuMs: number; ips: number }> = []

// L'amas sert à mesurer le coût ; les témoins et l'échelle servent à juger le
// rendu. Les regarder en même temps ne marche pas : on masque l'amas pour juger.
let amasVisible = true

window.addEventListener('keydown', (e) => {
  if (e.key === 'a') {
    amasVisible = !amasVisible
    amas.corps.visible = amasVisible
    amas.coque.visible = amasVisible && contourActif
  }
  if (e.key === 'c') {
    contourActif = !contourActif
    amas.coque.visible = contourActif && amasVisible
    temoins.coque.visible = contourActif
    echelle.coque.visible = contourActif
  }
  if (e.key === ' ') rotationActive = !rotationActive
  if (e.key === 'e') {
    mesures.push({
      mode: contourActif ? 'coque inversée' : 'sans contour',
      gpuMs: mesurerGpu() ?? -1,
      ips: ctx.compteur.imagesParSeconde(),
    })
    enregistrerResultat('0a-coque-inversee', mesures)
  }
})

demarrerBoucle(ctx, () => {
  if (rotationActive) {
    amas.corps.rotation.y += 0.0015
    amas.coque.rotation.y = amas.corps.rotation.y
  }
  const gpu = mesurerGpu()
  definirLignes([
    `BANC 0a — coque inversée`,
    ``,
    `instances       ${NOMBRE.toLocaleString('fr-FR')} × 2 passes`,
    `contour         ${contourActif ? `actif, ${LARGEUR_CONTOUR_PX} px` : 'coupé'}`,
    `temps GPU       ${gpu === null ? 'extension absente' : gpu.toFixed(2) + ' ms'}`,
    `images/s        ${ctx.compteur.imagesParSeconde().toFixed(0)}`,
    `temps image     ${ctx.compteur.moyenne().toFixed(2)} ms`,
    ``,
    `amas            ${amasVisible ? 'visible (charge)' : 'masqué (jugement)'}`,
    ``,
    `[a] amas  [c] contour  [espace] rotation  [e] exporter`,
    ``,
    `Masquer l'amas pour juger : les six sphères du bas ont la`,
    `MÊME taille à l'écran mais sont à 12 et 72 unités — leurs`,
    `contours doivent paraître identiques. Les douze sphères de`,
    `droite sont d'une seule teinte et se recouvrent sans se`,
    `traverser : sont-elles séparées les unes des autres ?`,
  ])
})
