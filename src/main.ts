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
import { creerEncombrement } from './cellule/organites/encombrement.js'
import { creerPoresNucleaires } from './cellule/organites/poresNucleaires.js'
import { creerMatrices } from './cellule/organites/matrices.js'
import { creerChromatineDense } from './cellule/organites/chromatineDense.js'
import { creerFlux } from './cellule/vie.js'
import type { Mecanisme } from './cellule/mecanismes/contrat.js'
import { creerMecanismes } from './cellule/mecanismes/tous.js'

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

// Le peuplement vient en dernier : c'est ce qui remplit le vide entre les
// organites, et le cytoplasme n'est jamais de l'eau.
poser(vue, creerEncombrement())
poser(vue, creerPoresNucleaires())
poser(vue, creerMatrices())
poser(vue, creerChromatineDense())

// ── Les mécanismes ────────────────────────────────────────────────────────
// Les trois flux d'ambiance restent : ils occupent le fond de la cellule.
const flux = creerFlux()
for (const f of flux) vue.scene.add(f.objet)

const mecanismes = creerMecanismes()
for (const m of mecanismes) vue.scene.add(m.objet)

/**
 * Panneau des mécanismes, groupés par organite.
 *
 * Neuf mécanismes dispersés dans une cellule de 20 µm seraient introuvables sans
 * cette liste : chaque entrée emmène la caméra sur place et ouvre la fiche.
 */
const panneauFlux = document.getElementById('flux')!
const titrePanneau = document.createElement('h2')
titrePanneau.textContent = 'Mécanismes'
panneauFlux.appendChild(titrePanneau)

const parSiege = new Map<string, Mecanisme[]>()
for (const m of mecanismes) {
  const liste = parSiege.get(m.siege)
  if (liste) liste.push(m)
  else parSiege.set(m.siege, [m])
}

const boutonsMecanisme = new Map<string, HTMLButtonElement>()

for (const [siege, liste] of parSiege) {
  const entete = document.createElement('div')
  entete.className = 'siege'
  entete.textContent = siege
  panneauFlux.appendChild(entete)

  for (const m of liste) {
    const bouton = document.createElement('button')
    bouton.type = 'button'
    bouton.className = 'flux'
    bouton.setAttribute('aria-pressed', 'false')

    const nom = document.createElement('b')
    nom.textContent = m.nom
    const badge = document.createElement('span')
    badge.className = 'badge'
    // Le facteur est affiché en permanence : sans lui, une animation qui montre
    // des phénomènes aux échelles incompatibles ment par omission.
    badge.textContent = m.facteur
    bouton.append(nom, badge)

    bouton.addEventListener('click', () => allerAuMecanisme(m))
    panneauFlux.appendChild(bouton)
    boutonsMecanisme.set(m.cle, bouton)
  }
}

/** Mécanisme actuellement mis en avant, ou null quand on regarde la cellule entière. */
let mecanismeChoisi: Mecanisme | null = null

/**
 * Met un mécanisme en avant et efface le reste.
 *
 * Sans ça, un mécanisme observé de près disparaît sous l'encombrement du cytosol
 * et sous les seize autres. On ne masque pas : on estompe, pour que le contexte
 * reste lisible — c'est la même règle que pour l'isolement des organites.
 */
function mettreEnAvant(choisi: Mecanisme | null): void {
  mecanismeChoisi = choisi

  for (const autre of mecanismes) {
    const enAvant = choisi === null || autre.cle === choisi.cle
    autre.objet.visible = enAvant
  }
  // Les flux d'ambiance encombrent le champ de près : on les coupe aussi.
  for (const f of flux) f.objet.visible = choisi === null

  // L'encombrement moléculaire est superbe de loin et illisible de près.
  if (curseurDensite) {
    curseurDensite.value = choisi === null ? '100' : '12'
    reglerDensite(choisi === null ? 1 : 0.12)
  }

  for (const [cle, bouton] of boutonsMecanisme) {
    bouton.setAttribute('aria-pressed', String(choisi !== null && cle === choisi.cle))
  }
}

function allerAuMecanisme(m: Mecanisme): void {
  // Recliquer le mécanisme déjà choisi revient à la vue d'ensemble.
  if (mecanismeChoisi?.cle === m.cle) {
    mettreEnAvant(null)
    fiche.classList.remove('ouverte')
    revenirVueEnsemble()
    return
  }

  // L'ancre est donnée en coordonnées de la scène, mais la scène tourne sur
  // elle-même : il faut la passer en coordonnées monde, sinon la caméra vise un
  // point que le mécanisme a quitté depuis longtemps.
  vue.scene.updateMatrixWorld(true)
  const cible = m.ancre.clone().applyMatrix4(vue.scene.matrixWorld)

  const distance = (m.rayonCadrage * 1.6) / Math.tan((vue.camera.fov * Math.PI) / 360)
  const recul = new THREE.Vector3(0.5, 0.36, 0.79).normalize().multiplyScalar(distance)
  vue.controles.target.copy(cible)
  vue.camera.position.copy(cible).add(recul)

  // De près, l'écorché ne ferait que retirer de la matière sans rien révéler.
  curseurCoupe.value = '100'
  reglerCoupe(1)

  mettreEnAvant(m)
  ouvrirFicheMecanisme(m)
}

function revenirVueEnsemble(): void {
  vue.camera.position.set(5, 5, 24)
  vue.controles.target.set(0, 0, 0)
  curseurCoupe.value = '58'
  reglerCoupe(0.58)
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

let sousCurseur: Organite | null = null

const ficheFacteur = fiche.querySelector('.facteur') as HTMLElement
const ficheNote = fiche.querySelector('.note') as HTMLElement


/**
 * Fiche d'un mécanisme.
 *
 * Elle porte deux champs qu'une fiche d'organite n'a pas : le facteur temporel
 * avec sa justification, et l'ellision — ce qui a été sauté. Couper n'est pas
 * ralentir, et le taire ferait raconter deux histoires différentes au badge et
 * à ce qu'on voit.
 */
function ouvrirFicheMecanisme(m: Mecanisme): void {
  ficheTitre.textContent = m.nom
  ficheRole.textContent = m.siege
  ficheFacteur.textContent = m.facteur
  ficheFacteur.style.display = ''
  ficheDesc.textContent = m.description
  ficheNote.textContent = m.ellision
    ? `${m.justificationFacteur} ${m.ellision}`
    : m.justificationFacteur
  fiche.classList.add('ouverte')
}

function ouvrirFiche(organite: Organite): void {
  ficheTitre.textContent = organite.nom
  ficheRole.textContent = organite.role
  ficheFacteur.textContent = ''
  ficheFacteur.style.display = 'none'
  ficheNote.textContent = ''
  ficheDesc.textContent = organite.description
  fiche.classList.add('ouverte')
}

fiche.querySelector('.fermer')!.addEventListener('click', () => fiche.classList.remove('ouverte'))

window.addEventListener('pointermove', (e) => {
  if ((e.target as HTMLElement).closest('#legende, #reglages, #fiche, #flux')) {
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
  if ((e.target as HTMLElement).closest('#legende, #reglages, #fiche, #flux')) return
  if (sousCurseur) ouvrirFiche(sousCurseur)
})

// ── Curseur de densité ────────────────────────────────────────────────────
/**
 * Le geste signature du site.
 *
 * À 0 on a le schéma de manuel — des organites qui flottent dans du vide. À 100
 * on a la vérité : un cytoplasme saturé où 20 à 30 % du volume est occupé par des
 * macromolécules. Le curseur n'illustre pas cet arbitrage, il le rend manipulable,
 * et c'est ce qui fait comprendre au passage que le vide des manuels est une
 * décision de dessinateur, pas un fait.
 *
 * Techniquement, `InstancedMesh.count` limite le nombre d'instances dessinées sans
 * rien réallouer : le curseur ne coûte donc rien.
 */
const amasDenses: Array<{ maillage: THREE.InstancedMesh; plein: number }> = []
const CLES_DENSES = new Set([
  'boite-de-verite',
  'voile-cytosol',
  'matrice-mitochondriale',
  'ribosomes-libres',
  'nucleosomes',
  'machinerie-nucleaire',
])

for (const organite of vue.organites) {
  if (!CLES_DENSES.has(organite.cle)) continue
  organite.objet.traverse((noeud) => {
    const maillage = noeud as THREE.InstancedMesh
    if (maillage.isInstancedMesh) amasDenses.push({ maillage, plein: maillage.count })
  })
}

const curseurDensite = document.getElementById('densite') as HTMLInputElement | null
function reglerDensite(fraction: number): void {
  for (const { maillage, plein } of amasDenses) {
    maillage.count = Math.max(0, Math.round(plein * fraction))
  }
}
if (curseurDensite) {
  curseurDensite.addEventListener('input', () => reglerDensite(Number(curseurDensite.value) / 100))
}

// ── Aller à la boîte de vérité ────────────────────────────────────────────
const boiteVerite = vue.organites.find((o) => o.cle === 'boite-de-verite')
const boutonVerite = document.getElementById('verite')
if (boutonVerite && boiteVerite) {
  boutonVerite.addEventListener('click', () => {
    // Le cadrage se calcule sur la géométrie réelle, pas sur l'ancre de
    // l'étiquette : celle-ci est posée sur un bord pour que le texte ne masque
    // rien, et viser ce point laisserait la boîte hors champ.
    const boite = new THREE.Box3().setFromObject(boiteVerite.objet)
    const centre = boite.getCenter(new THREE.Vector3())
    const rayon = boite.getSize(new THREE.Vector3()).length() / 2

    // Distance qui fait tenir la sphère englobante dans le champ vertical.
    const distance = (rayon * 1.35) / Math.tan((vue.camera.fov * Math.PI) / 360)
    const recul = new THREE.Vector3(0.55, 0.42, 0.72).normalize().multiplyScalar(distance)

    vue.controles.target.copy(centre)
    vue.camera.position.copy(centre).add(recul)

    // L'écorché est rouvert : à l'intérieur de la boîte, une coupe ne ferait
    // que retirer de la matière sans rien révéler de plus.
    curseurCoupe.value = '100'
    reglerCoupe(1)
    if (curseurDensite) {
      curseurDensite.value = '100'
      reglerDensite(1)
    }
    ouvrirFiche(boiteVerite)
  })
} else if (boutonVerite) {
  boutonVerite.remove()
}

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
  revenirVueEnsemble()
  mettreEnAvant(null)
  fiche.classList.remove('ouverte')
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
  for (const m of mecanismes) m.animer(tempsVie)

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
