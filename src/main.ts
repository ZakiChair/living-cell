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
import { recenserAmas, reglerGrain, CLE_BOITE_DE_VERITE } from './cellule/grain.js'
import { creerFlux } from './cellule/vie.js'
import type { Mecanisme } from './cellule/mecanismes/contrat.js'
import { creerMecanismes } from './cellule/mecanismes/tous.js'
import { creerSceneAtelier, RAYON_DEPOT } from './cellule/atelier/scene.js'
import { creerPanneauAtelier, FICHE_ATELIER } from './cellule/atelier/panneau.js'
import {
  avancerAtelier,
  creerAtelier,
  donnerAuRibosome,
  facteurAffiche,
} from './noyau/atelier.js'
import { avancerDe, creerEtat, regimeTraduction } from './noyau/etatCellule.js'

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

// ── L'atelier du gène ─────────────────────────────────────────────────────
// La cellule a désormais un ÉTAT, et l'atelier est ce qui le rend manipulable.
// Les deux vivent dans src/noyau/, testés sans GPU ; ici on ne fait que les
// brancher à la scène et à l'interface.
const etatCellule = creerEtat()
const atelier = creerAtelier()
const sceneAtelier = creerSceneAtelier()
sceneAtelier.objet.visible = false
vue.scene.add(sceneAtelier.objet)

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

  // Après avoir posé `mecanismeChoisi` : c'est lui qui décide de la profondeur
  // du fondu appliqué aux organites.
  appliquerIsolement()
}

/**
 * Dernière position monde visée, pour mesurer la dérive d'une image à l'autre.
 *
 * Viser l'ancre une seule fois au moment du clic ne suffit pas : la scène
 * continue de tourner sur elle-même, et la caméra reste où elle est. À 5,5 µm
 * de l'axe, la dérive tangentielle est de 304 nm/s ; en vue rapprochée le champ
 * fait 92 nm de haut. Le mécanisme quitte donc le cadre en 0,30 s, alors que
 * l'amortissement d'OrbitControls met deux secondes à y amener la caméra —
 * autrement dit, il en était sorti avant qu'elle n'arrive.
 */
const cibleSuivie = new THREE.Vector3()
const deriveTemp = new THREE.Vector3()

/** Ancre poursuivie, en coordonnées de la scène, ou null en vue d'ensemble. */
let ancreSuivie: THREE.Vector3 | null = null

/** Position monde d'une ancre de scène, à l'instant présent. */
function cibleMonde(ancre: THREE.Vector3, sortie: THREE.Vector3): THREE.Vector3 {
  vue.scene.updateMatrixWorld(true)
  return sortie.copy(ancre).applyMatrix4(vue.scene.matrixWorld)
}

/**
 * Fait suivre à la caméra la dérive de ce qu'on regarde.
 *
 * On applique à la caméra le MÊME déplacement qu'à la cible, et non une
 * position calculée : l'écart caméra ↔ cible reste donc intact, et l'utilisateur
 * garde son orbite, son zoom et son angle de vue. Une caméra rigidement
 * réattachée à chaque image les lui reprendrait.
 */
function suivreLaCible(): void {
  if (!ancreSuivie) return
  cibleMonde(ancreSuivie, deriveTemp).sub(cibleSuivie)
  if (deriveTemp.lengthSq() === 0) return
  cibleSuivie.add(deriveTemp)
  vue.controles.target.add(deriveTemp)
  vue.camera.position.add(deriveTemp)
}

/**
 * Pose la caméra sur une ancre de scène, à la bonne distance, et l'y garde.
 *
 * `direction` est en coordonnées de SCÈNE et sera tournée avec elle, comme
 * l'ancre. Une scène dont la disposition a un axe privilégié doit déclarer sous
 * quel angle elle se regarde : le recul par défaut convient aux mécanismes, qui
 * sont à peu près sphériques, mais pas à un plateau étiré.
 */
const RECUL_PAR_DEFAUT = new THREE.Vector3(0.5, 0.36, 0.79).normalize()

function cadrerSur(
  ancre: THREE.Vector3,
  rayon: number,
  direction: THREE.Vector3 = RECUL_PAR_DEFAUT,
): void {
  ancreSuivie = ancre
  cibleMonde(ancre, cibleSuivie)
  const distance = (rayon * 1.6) / Math.tan((vue.camera.fov * Math.PI) / 360)
  // La direction suit la rotation de la scène, sans quoi l'angle de vue
  // dépendrait de l'instant du clic.
  vue.scene.updateMatrixWorld(true)
  const recul = direction
    .clone()
    .transformDirection(vue.scene.matrixWorld)
    .multiplyScalar(distance)
  vue.controles.target.copy(cibleSuivie)
  vue.camera.position.copy(cibleSuivie).add(recul)
  // De près, l'écorché ne ferait que retirer de la matière sans rien révéler.
  curseurCoupe.value = '100'
  reglerCoupe(1)
}

function allerAuMecanisme(m: Mecanisme): void {
  // Recliquer le mécanisme déjà choisi revient à la vue d'ensemble.
  if (mecanismeChoisi?.cle === m.cle) {
    mettreEnAvant(null)
    fiche.classList.remove('ouverte')
    revenirVueEnsemble()
    return
  }

  cadrerSur(m.ancre, m.rayonCadrage)
  mettreEnAvant(m)
  ouvrirFicheMecanisme(m)
}

function revenirVueEnsemble(): void {
  ancreSuivie = null
  vue.camera.position.set(5, 5, 24)
  vue.controles.target.set(0, 0, 0)
  curseurCoupe.value = '58'
  reglerCoupe(0.58)
}

// ── Le mode atelier ───────────────────────────────────────────────────────
/**
 * L'atelier est un MODE, pas un mécanisme de plus.
 *
 * Il occupe toute l'attention : les seize mécanismes et les flux d'ambiance
 * sont coupés, l'encombrement est réduit, et le panneau de gauche laisse la
 * place au sien. Un plateau de trois cents nanomètres au milieu d'une cellule
 * de vingt micromètres ne se verrait pas autrement.
 */
let atelierActif = false

const boutonAtelier = document.getElementById('ouvrirAtelier')!
boutonAtelier.addEventListener('click', () => {
  if (atelierActif) quitterAtelier()
  else entrerAtelier()
})

/** La fiche de l'atelier, avec son facteur et son ellision, comme un mécanisme. */
function ouvrirFicheAtelier(): void {
  ficheTitre.textContent = FICHE_ATELIER.titre
  ficheRole.textContent = "Enveloppe nucléaire — du gène à la protéine"
  ficheFacteur.textContent = facteurAffiche(atelier)
  ficheFacteur.style.display = ''
  ficheDesc.textContent = FICHE_ATELIER.description
  ficheNote.textContent = FICHE_ATELIER.ellision
  fiche.classList.add('ouverte')
}

const panneauAtelier = creerPanneauAtelier(atelier, etatCellule, {
  cadrer: () =>
    cadrerSur(sceneAtelier.ancre, sceneAtelier.rayonCadrage, sceneAtelier.directionCadrage),
  quitter: () => quitterAtelier(),
})
panneauAtelier.racine.hidden = true
document.getElementById('colonne')!.appendChild(panneauAtelier.racine)

function entrerAtelier(): void {
  atelierActif = true
  mettreEnAvant(null)
  familleIsolee = null
  appliquerIsolement()
  sceneAtelier.objet.visible = true
  for (const f of flux) f.objet.visible = false
  for (const m of mecanismes) m.objet.visible = false
  // Les organites sont MASQUÉS, et non estompés comme ailleurs. Le plateau
  // fait trois cents nanomètres et se tient sur l'enveloppe nucléaire : à cette
  // distance, le noyau n'est plus un contexte, c'est une paroi opaque entre la
  // caméra et le sujet. L'atelier est un plateau, et la fiche le déclare.
  for (const organite of vue.organites) organite.objet.visible = false
  if (curseurDensite) {
    curseurDensite.value = '8'
    reglerDensite(0.08)
  }
  panneauAtelier.racine.hidden = false
  panneauFlux.hidden = true
  legende.hidden = true
  boutonAtelier.setAttribute('aria-pressed', 'true')
  cadrerSur(sceneAtelier.ancre, sceneAtelier.rayonCadrage, sceneAtelier.directionCadrage)
  ouvrirFicheAtelier()
}

function quitterAtelier(): void {
  atelierActif = false
  sceneAtelier.brinTenu = null
  sceneAtelier.objet.visible = false
  for (const organite of vue.organites) organite.objet.visible = true
  panneauAtelier.racine.hidden = true
  panneauFlux.hidden = false
  legende.hidden = false
  boutonAtelier.setAttribute('aria-pressed', 'false')
  fiche.classList.remove('ouverte')
  if (curseurDensite) {
    curseurDensite.value = '100'
    reglerDensite(1)
  }
  mettreEnAvant(null)
  revenirVueEnsemble()
}

/**
 * LE GESTE DEMANDÉ : saisir le brin d'ARN et le porter au ribosome.
 *
 * Le pointeur ne donne que deux coordonnées ; il faut donc choisir une surface
 * de projection. C'est un plan passant par le brin et FACE À LA CAMÉRA : le brin
 * suit ainsi le curseur exactement, quel que soit l'angle sous lequel
 * l'utilisateur a orbité la scène.
 *
 * Le seuil de dépôt est en micromètres, pas en pixels : « assez près du
 * ribosome » doit vouloir dire cinquante nanomètres, une distance biologique,
 * et non un nombre de pixels qui changerait de sens à chaque zoom.
 */
const planSaisie = new THREE.Plane()
const rayonSaisie = new THREE.Raycaster()
const pointeurSaisie = new THREE.Vector2()
const pointSaisie = new THREE.Vector3()
const posBrin = new THREE.Vector3()
const posRibosome = new THREE.Vector3()
const localTemp = new THREE.Vector3()
const inverseTemp = new THREE.Matrix4()
let saisieEnCours = false

/** Distance en pixels sous laquelle le pointeur est considéré sur le brin. */
const RAYON_PRISE_PX = 44

/** Position à l'écran d'un point monde, en pixels. */
function versEcran(monde: THREE.Vector3, sortie: THREE.Vector2): THREE.Vector2 {
  const projete = monde.clone().project(vue.camera)
  return sortie.set(
    ((projete.x + 1) / 2) * window.innerWidth,
    ((1 - projete.y) / 2) * window.innerHeight,
  )
}

const ecranTemp = new THREE.Vector2()

function brinSousPointeur(x: number, y: number): boolean {
  if (!atelierActif || atelier.etape !== 'attente') return false
  sceneAtelier.positionBrin(posBrin)
  versEcran(posBrin, ecranTemp)
  return ecranTemp.distanceTo(pointeurSaisie.set(x, y)) < RAYON_PRISE_PX
}

function deplacerBrin(x: number, y: number): void {
  // Le plan de saisie fait face à la caméra et passe par LE RIBOSOME, pas par
  // le brin. Mesuré : un plan passant par le brin transpose exactement le
  // déplacement à l'écran — à 0,7 pixel près — mais laisse le point déposé sur
  // la ligne de visée du ribosome, 38 nm devant lui. Viser juste ne suffisait
  // donc pas à déposer, et rien ne l'expliquait à l'écran.
  //
  // Poser le plan sur le ribosome fait sauter le brin d'une trentaine de
  // nanomètres en profondeur au moment où on le saisit — imperceptible sur un
  // champ de trois cents — et rend le geste exact : ce qu'on voit sur le
  // ribosome y est.
  sceneAtelier.positionRibosome(posRibosome)
  vue.camera.getWorldDirection(pointSaisie)
  planSaisie.setFromNormalAndCoplanarPoint(pointSaisie, posRibosome)

  pointeurSaisie.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1)
  rayonSaisie.setFromCamera(pointeurSaisie, vue.camera)
  if (!rayonSaisie.ray.intersectPlane(planSaisie, pointSaisie)) return

  // Le brin est positionné en coordonnées locales du plateau : c'est là que la
  // scène de l'atelier l'attend, et cela le fait tourner avec la cellule.
  sceneAtelier.objet.updateMatrixWorld(true)
  inverseTemp.copy(sceneAtelier.objet.matrixWorld).invert()
  sceneAtelier.brinTenu = localTemp.copy(pointSaisie).applyMatrix4(inverseTemp).clone()
}

function relacherBrin(): void {
  if (!saisieEnCours) return
  saisieEnCours = false
  sceneAtelier.positionBrin(posBrin)
  sceneAtelier.positionRibosome(posRibosome)
  // Assez près du ribosome : la petite sous-unité prend le brin.
  if (posBrin.distanceTo(posRibosome) < RAYON_DEPOT) donnerAuRibosome(atelier)
  sceneAtelier.brinTenu = null
}

window.addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement).closest('#legende, #reglages, #fiche, #flux, #atelier')) return
  if (!brinSousPointeur(e.clientX, e.clientY)) return
  saisieEnCours = true
  // On coupe l'orbite : sans cela, tirer le brin ferait aussi pivoter la scène.
  vue.controles.enabled = false
  deplacerBrin(e.clientX, e.clientY)
})

window.addEventListener('pointermove', (e) => {
  if (saisieEnCours) deplacerBrin(e.clientX, e.clientY)
})

window.addEventListener('pointerup', () => {
  relacherBrin()
  vue.controles.enabled = true
})

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
/**
 * Fondu appliqué aux organites quand un mécanisme est observé de près.
 *
 * Un mécanisme se déroule DANS son organite : c'est l'invariant que le contrat
 * pose, et il a fallu du travail pour l'obtenir. Mais une fois obtenu, la
 * caméra descend à trente-cinq nanomètres et se retrouve à L'INTÉRIEUR de la
 * capsule qui contient la scène. Une membrane translucide vue de dedans, avec
 * ses deux faces, remplit alors tout le cadre : la chaîne respiratoire ne
 * montrait plus qu'un aplat orange, une seule teinte sur tout le centre.
 *
 * On estompe donc les organites tant qu'un mécanisme est en avant. Ce n'est pas
 * les masquer — à 8 % ils restent lisibles comme un voile de contexte — et ça
 * ne coûte rien, puisque le fondu passe par les mêmes matériaux que
 * l'isolement de la légende.
 */
const OPACITE_ORGANITE_EN_GROS_PLAN = 0.08

/**
 * Ajuste l'opacité de chaque organite selon les DEUX états qui la commandent :
 * la famille isolée depuis la légende, et le mécanisme observé de près.
 *
 * Les deux doivent être décidés au même endroit. Deux fonctions qui écrivent
 * tour à tour dans `material.opacity` se reprendraient mutuellement leur
 * réglage, et la dernière appelée gagnerait — un couplage silencieux de plus.
 */
function appliquerIsolement(): void {
  for (const organite of vue.organites) {
    const dansLaFamille =
      familleIsolee === null || organite.cle.replace(/-\d+$/, '') === familleIsolee
    const enAvant = dansLaFamille && mecanismeChoisi === null
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
          // En gros plan sur un mécanisme, le fondu est bien plus profond : la
          // capsule qui entoure la caméra doit devenir un voile, pas un mur.
          materiau.opacity =
            base * (mecanismeChoisi === null ? 0.22 : OPACITE_ORGANITE_EN_GROS_PLAN)
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

/**
 * Le survol est GROUPÉ, pas traité au fil des événements.
 *
 * Une souris émet bien plus de sorties que l'écran n'affiche d'images : lancer
 * un rayon à chacune revenait à en jeter la majorité après les avoir payées.
 * On retient donc la dernière position et on ne teste qu'une fois par image.
 * Avec la liste blanche de `scene.ts`, c'est ce qui ramène le geste que la page
 * demande en en-tête sous le budget d'une image.
 */
let pointeurX = 0
let pointeurY = 0
let survolARecalculer = false

window.addEventListener('pointermove', (e) => {
  if ((e.target as HTMLElement).closest('#legende, #reglages, #fiche, #flux, #atelier')) {
    survol.classList.remove('visible')
    survolARecalculer = false
    sousCurseur = null
    return
  }
  pointeurX = e.clientX
  pointeurY = e.clientY
  survolARecalculer = true
})

function majSurvol(): void {
  if (!survolARecalculer) return
  survolARecalculer = false

  const trouve = organiteSous(vue, pointeurX, pointeurY)
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
  const x = Math.min(pointeurX + 16, window.innerWidth - survol.offsetWidth - 12)
  const y = Math.min(pointeurY + 16, window.innerHeight - survol.offsetHeight - 12)
  survol.style.left = `${x}px`
  survol.style.top = `${y}px`
  survol.classList.add('visible')
}

window.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('#legende, #reglages, #fiche, #flux, #atelier')) return
  // Le survol n'est calculé qu'une fois par image : un clic qui suit
  // immédiatement un déplacement doit donc réclamer son propre calcul, sinon
  // il ouvrirait la fiche de l'organite précédent.
  if (survolARecalculer) majSurvol()
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
// La règle — et surtout ce qu'elle n'a PAS le droit de toucher — vit dans
// `grain.ts`, où un test la vérifie sur la géométrie réelle. Elle était ici, et
// la boîte de vérité s'y trouvait éclaircie par trois gestes différents.
const amasDenses = recenserAmas(vue.organites)

const curseurDensite = document.getElementById('densite') as HTMLInputElement | null
function reglerDensite(fraction: number): void {
  reglerGrain(amasDenses, fraction)
}
if (curseurDensite) {
  curseurDensite.addEventListener('input', () => reglerDensite(Number(curseurDensite.value) / 100))
}

// ── Aller à la boîte de vérité ────────────────────────────────────────────
const boiteVerite = vue.organites.find((o) => o.cle === CLE_BOITE_DE_VERITE)
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
  // On n'anime que ce qui se voit. `mettreEnAvant` masque quinze mécanismes sur
  // seize dès qu'on en choisit un ; les animer quand même dépensait du budget
  // d'image exactement là où il manque — en vue rapprochée.
  for (const f of flux) if (f.objet.visible) f.animer(tempsVie)
  for (const m of mecanismes) if (m.objet.visible) m.animer(tempsVie)

  // ── L'état de la cellule, et l'atelier qu'il gouverne ────────────────────
  // Le moteur tourne EN PERMANENCE, même hors atelier : un levier tiré depuis la
  // vue d'ensemble doit avoir déjà produit son effet quand on descend voir.
  //
  // UNE SEULE HORLOGE. Le curseur de vitesse accélérait d'abord le seul
  // ribosome, la cellule restant en temps réel : à ×4 la protéine était finie
  // en vingt-cinq secondes quand l'ATP mettait quarante-cinq à s'effondrer, si
  // bien que couper l'oxygène n'arrêtait jamais rien à l'écran. La boucle
  // existait dans le code et restait invisible. Le multiplicateur porte donc
  // sur les deux, et le badge dit le facteur qui en résulte.
  avancerDe(etatCellule, dt * (atelierActif ? atelier.vitesse : 1))
  if (atelierActif) {
    avancerAtelier(atelier, dt, regimeTraduction(etatCellule.atp))
    sceneAtelier.animer(atelier, tempsVie)
    panneauAtelier.rafraichir(atelier, etatCellule)
  }

  // Avant `controles.update()` : la cible doit être à jour quand l'amortissement
  // calcule le déplacement de cette image.
  suivreLaCible()
  vue.controles.update()
  majSurvol()
  majEchelle()
  vue.renderer.render(vue.scene, vue.camera)
}

boucle()

// La cellule est assemblée : on retire l'écran de chargement.
requestAnimationFrame(() => {
  document.getElementById('chargement')!.classList.add('parti')
})

// Repères de diagnostic pour les tests de bout en bout.
;(window as unknown as { __celluleReady?: boolean }).__celluleReady = true
/**
 * Ce qu'un test a besoin de savoir sans deviner.
 *
 * La position à l'écran du brin est la seule chose qu'un test ne peut ni
 * calculer ni lire dans le DOM : elle dépend de la caméra, de la rotation de la
 * scène et de l'étape en cours. Sans elle, vérifier le geste demandé reviendrait
 * à cliquer au jugé, ce qui ne prouve rien quand ça échoue.
 */
;(window as unknown as { __atelier?: unknown }).__atelier = {
  ecranBrin: () => {
    sceneAtelier.positionBrin(posBrin)
    versEcran(posBrin, ecranTemp)
    return { x: ecranTemp.x, y: ecranTemp.y }
  },
  ecranRibosome: () => {
    sceneAtelier.positionRibosome(posRibosome)
    versEcran(posRibosome, ecranTemp)
    return { x: ecranTemp.x, y: ecranTemp.y }
  },
  /** Distance brin ↔ ribosome en micromètres, et le seuil de dépôt. */
  distanceDepot: () => ({
    distance: sceneAtelier
      .positionBrin(posBrin)
      .distanceTo(sceneAtelier.positionRibosome(posRibosome)),
    seuil: RAYON_DEPOT,
  }),
  etat: () => ({
    etape: atelier.etape,
    codons: atelier.codons,
    liaisons: atelier.liaisons,
    atp: etatCellule.atp,
    forceProtonMotrice: etatCellule.forceProtonMotrice,
    gradientNa: etatCellule.gradientNa,
  }),
}
console.info(
  `cellule assemblée : ${vue.organites.length} organites, ` +
    `${familles.size} familles, rayon ${RAYON_CELLULE} µm`,
)
