import * as THREE from 'three'
import type { Organite } from './cellule/contrat.js'
import { RAYON_CELLULE } from './cellule/contrat.js'
import { creerVue, organiteSous, poser, reglerCoupe } from './cellule/scene.js'
import { creerNoyau } from './cellule/organites/noyau.js'
import { creerMitochondries } from './cellule/organites/mitochondries.js'
import { creerGolgi } from './cellule/organites/golgi.js'
import { creerReticulumRugueux } from './cellule/organites/reticulumRugueux.js'
import { creerReticulumLisse } from './cellule/organites/reticulumLisse.js'
import { creerMembrane } from './cellule/organites/membrane.js'
import { creerVesiculesEtLysosomes } from './cellule/organites/vesiculesEtLysosomes.js'
import { creerCytosquelette } from './cellule/organites/cytosquelette.js'
import { creerFlux } from './cellule/vie.js'

const vue = creerVue(document.body)

// L'ordre de pose suit la profondeur de lecture : d'abord ce qui enveloppe,
// puis ce qui remplit, enfin ce qui se pose dessus.
poser(vue, creerMembrane())
poser(vue, creerCytosquelette())
poser(vue, creerReticulumRugueux())
poser(vue, creerReticulumLisse())
poser(vue, creerNoyau())
poser(vue, creerGolgi())
poser(vue, creerMitochondries())
poser(vue, creerVesiculesEtLysosomes())

// ── Les flux vivants ──────────────────────────────────────────────────────
const flux = creerFlux()
for (const f of flux) vue.scene.add(f.objet)

const bandeauFlux = document.getElementById('flux')!
for (const f of flux) {
  const ligne = document.createElement('div')
  ligne.className = 'flux'
  const nom = document.createElement('b')
  nom.textContent = f.nom
  const badge = document.createElement('span')
  badge.className = 'badge'
  // Le facteur de temps est affiché en permanence : sans lui, une animation
  // qui montre quatre phénomènes aux échelles incompatibles ment par omission.
  badge.textContent = f.facteur
  ligne.append(nom, badge)
  bandeauFlux.appendChild(ligne)
}

// ── Légende ───────────────────────────────────────────────────────────────
// Une entrée par famille, pas par exemplaire : six mitochondries font une
// seule ligne, sinon la légende devient un inventaire illisible.
const familles = new Map<string, { organite: Organite; membres: Organite[] }>()
for (const organite of vue.organites) {
  const racine = organite.cle.replace(/-\d+$/, '')
  const existante = familles.get(racine)
  if (existante) existante.membres.push(organite)
  else familles.set(racine, { organite, membres: [organite] })
}

const legende = document.getElementById('legende')!
let familleIsolee: string | null = null

for (const [racine, { organite, membres }] of familles) {
  const bouton = document.createElement('button')
  bouton.type = 'button'
  bouton.setAttribute('aria-pressed', 'false')

  const pastille = document.createElement('span')
  pastille.className = 'pastille'
  pastille.style.background = `#${organite.couleur.toString(16).padStart(6, '0')}`
  const texte = document.createElement('span')
  texte.textContent = organite.nom
  if (membres.length > 1) {
    const compte = document.createElement('span')
    compte.style.opacity = '0.5'
    compte.textContent = ` ×${membres.length}`
    texte.appendChild(compte)
  }
  bouton.append(pastille, texte)
  bouton.addEventListener('click', () => {
    familleIsolee = familleIsolee === racine ? null : racine
    appliquerIsolement()
    for (const autre of legende.querySelectorAll('button')) {
      autre.setAttribute('aria-pressed', String(autre === bouton && familleIsolee !== null))
    }
    if (familleIsolee) ouvrirFiche(organite)
  })
  legende.appendChild(bouton)
}

/**
 * Isoler ne masque pas, ça désature.
 *
 * On garde le contexte — donc l'encombrement — tout en détachant la cible.
 * Masquer donnerait une cellule vide, exactement le mensonge qu'on combat.
 */
function appliquerIsolement(): void {
  for (const organite of vue.organites) {
    const enAvant = familleIsolee === null || organite.cle.replace(/-\d+$/, '') === familleIsolee
    organite.objet.traverse((noeud) => {
      const maillage = noeud as THREE.Mesh
      if (!maillage.isMesh) return
      const materiaux = Array.isArray(maillage.material) ? maillage.material : [maillage.material]
      for (const brut of materiaux) {
        const materiau = brut as THREE.MeshLambertMaterial
        if (materiau.userData.opaciteInitiale === undefined) {
          materiau.userData.opaciteInitiale = materiau.opacity
          materiau.userData.couleurInitiale = materiau.color.clone()
        }
        const base = materiau.userData.opaciteInitiale as number
        const couleur = materiau.userData.couleurInitiale as THREE.Color
        if (enAvant) {
          materiau.opacity = base
          materiau.color.copy(couleur)
          materiau.transparent = base < 1
        } else {
          materiau.opacity = base * 0.22
          materiau.color.copy(couleur).lerp(new THREE.Color(0x9c9384), 0.75)
          materiau.transparent = true
        }
        materiau.needsUpdate = true
      }
    })
  }
}

// ── Survol et fiche ───────────────────────────────────────────────────────
const survol = document.getElementById('survol')!
const fiche = document.getElementById('fiche')!
const ficheTitre = fiche.querySelector('h2')!
const ficheRole = fiche.querySelector('.role')!
const ficheDesc = fiche.querySelector('.desc')!
const ficheChiffres = fiche.querySelector('dl')!

let sousCurseur: Organite | null = null

function ouvrirFiche(organite: Organite): void {
  ficheTitre.textContent = organite.nom
  ficheRole.textContent = organite.role
  ficheDesc.textContent = organite.description
  ficheChiffres.replaceChildren(
    ...organite.chiffres.flatMap((c) => {
      const dt = document.createElement('dt')
      dt.textContent = c.valeur
      const dd = document.createElement('dd')
      dd.textContent = c.quoi
      return [dt, dd]
    }),
  )
  fiche.classList.add('ouverte')
}

fiche.querySelector('.fermer')!.addEventListener('click', () => fiche.classList.remove('ouverte'))

window.addEventListener('pointermove', (e) => {
  if ((e.target as HTMLElement).closest('#legende, #reglages, #fiche')) {
    survol.classList.remove('visible')
    return
  }
  const trouve = organiteSous(vue, e.clientX, e.clientY)
  sousCurseur = trouve
  if (!trouve) {
    survol.classList.remove('visible')
    document.body.style.cursor = ''
    return
  }
  document.body.style.cursor = 'pointer'
  const nom = document.createElement('b')
  nom.textContent = trouve.nom
  const role = document.createElement('span')
  role.textContent = trouve.role
  survol.replaceChildren(nom, role)
  // On décale l'étiquette pour qu'elle ne masque jamais ce qu'elle nomme.
  const x = Math.min(e.clientX + 16, window.innerWidth - survol.offsetWidth - 12)
  const y = Math.min(e.clientY + 16, window.innerHeight - survol.offsetHeight - 12)
  survol.style.left = `${x}px`
  survol.style.top = `${y}px`
  survol.classList.add('visible')
})

window.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('#legende, #reglages, #fiche')) return
  if (sousCurseur) ouvrirFiche(sousCurseur)
})

// ── Réglages ──────────────────────────────────────────────────────────────
const curseurCoupe = document.getElementById('coupe') as HTMLInputElement
curseurCoupe.addEventListener('input', () => reglerCoupe(Number(curseurCoupe.value) / 100))
reglerCoupe(Number(curseurCoupe.value) / 100)

let rotationActive = true
const boutonRotation = document.getElementById('rotation')!
boutonRotation.addEventListener('click', () => {
  rotationActive = !rotationActive
  boutonRotation.setAttribute('aria-pressed', String(rotationActive))
  boutonRotation.textContent = rotationActive ? 'Rotation' : 'Figée'
})

document.getElementById('recadrer')!.addEventListener('click', () => {
  vue.camera.position.set(5, 5, 24)
  vue.controles.target.set(0, 0, 0)
  familleIsolee = null
  appliquerIsolement()
  for (const b of legende.querySelectorAll('button')) b.setAttribute('aria-pressed', 'false')
})

// Le mouvement est réduit, pas supprimé : la préférence système est une
// demande de calme, pas une demande d'écran fixe.
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  rotationActive = false
  boutonRotation.setAttribute('aria-pressed', 'false')
  boutonRotation.textContent = 'Figée'
}

// ── Barre d'échelle ───────────────────────────────────────────────────────
const echelleTexte = document.getElementById('echelleTexte')!
const LARGEUR_BARRE_PX = 90

function majEchelle(): void {
  const distance = vue.camera.position.distanceTo(vue.controles.target)
  const hauteurVue = 2 * distance * Math.tan((vue.camera.fov * Math.PI) / 360)
  const umParPixel = hauteurVue / window.innerHeight
  const um = LARGEUR_BARRE_PX * umParPixel
  echelleTexte.textContent = um >= 1 ? `${um.toFixed(1)} µm` : `${Math.round(um * 1000)} nm`
}

// ── Boucle ────────────────────────────────────────────────────────────────
let pivotY = 0
let tempsVie = 0
let instantPrecedent = performance.now()

function boucle(): void {
  requestAnimationFrame(boucle)
  if (document.visibilityState === 'hidden') {
    instantPrecedent = performance.now()
    return
  }

  const maintenant = performance.now()
  // Borné : un onglet revenu au premier plan ne doit pas faire un bond de rotation.
  const dt = Math.min((maintenant - instantPrecedent) / 1000, 0.1)
  instantPrecedent = maintenant

  if (rotationActive) {
    pivotY += dt * 0.055
    vue.scene.rotation.y = pivotY
  }

  tempsVie += dt
  for (const f of flux) f.animer(tempsVie)

  vue.controles.update()
  majEchelle()
  vue.renderer.render(vue.scene, vue.camera)
}

boucle()

// La cellule est assemblée : on retire l'écran de chargement.
requestAnimationFrame(() => {
  document.getElementById('chargement')!.classList.add('parti')
})

// Repère de diagnostic pour les tests de bout en bout.
;(window as unknown as { __celluleReady?: boolean }).__celluleReady = true
console.info(
  `cellule assemblée : ${vue.organites.length} organites, ` +
    `${familles.size} familles, rayon ${RAYON_CELLULE} µm`,
)
