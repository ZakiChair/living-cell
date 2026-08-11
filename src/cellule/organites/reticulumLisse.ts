import * as THREE from 'three'
import {
  creerAlea,
  materiauOrganite,
  pointDansCoquille,
  TEINTES,
  type Organite,
} from '../contrat.js'

/**
 * Réticulum endoplasmique lisse.
 *
 * Le rugueux est fait de citernes empilées ; le lisse est un RÉSEAU de tubules
 * ramifiés, sans aucun ribosome. C'est cette double différence — maille contre
 * feuillet, surface nue contre surface grenue — qui doit se lire d'un coup
 * d'œil, sans étiquette.
 */

/** Centre de l'organite : en continuité du rugueux, mais plus loin du noyau. */
const CENTRE = new THREE.Vector3(-3, 3, -1)

/** Demi-axes du volume occupé : encombrement de 3,5 × 3 × 2,5 µm. */
const DEMI_AXES = new THREE.Vector3(1.75, 1.5, 1.25)

const NB_NOEUDS = 26

/** Écart visé entre nœuds, en µm : un réseau n'a pas de paquets de jonctions. */
const ECART_MINIMAL = 0.5

/** 0,045 µm de rayon = 90 nm de diamètre, dans la fourchette réelle 50-100 nm. */
const RAYON_TUBULE = 0.045

const RAYON_RENFLEMENT = 0.07

/** Graine retenue parce qu'elle donne un réseau d'un seul tenant (voir plus bas). */
const GRAINE = 4021

const AXES_REPERE = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
] as const

const matriceInstance = new THREE.Matrix4()

/** Distance au nœud déjà posé le plus proche ; +∞ si le nuage est vide. */
function distanceAuPlusProche(point: THREE.Vector3, poses: THREE.Vector3[]): number {
  let minimum = Infinity
  for (const pose of poses) minimum = Math.min(minimum, point.distanceTo(pose))
  return minimum
}

/** Nuage de nœuds réparti dans l'ellipsoïde, tirage rejeté s'il fait un paquet. */
function tirerNoeuds(alea: () => number): THREE.Vector3[] {
  const noeuds: THREE.Vector3[] = []
  for (let i = 0; i < NB_NOEUDS; i += 1) {
    let meilleur: THREE.Vector3 | null = null
    let meilleureDistance = -1
    // Le rejet est borné : les derniers nœuds n'ont plus toujours de place
    // libre, on garde alors le candidat le moins serré vu pendant les essais.
    for (let essai = 0; essai < 200; essai += 1) {
      const candidat = pointDansCoquille(alea, 0, 1).multiply(DEMI_AXES)
      const distance = distanceAuPlusProche(candidat, noeuds)
      if (distance > meilleureDistance) {
        meilleureDistance = distance
        meilleur = candidat
      }
      if (distance >= ECART_MINIMAL) break
    }
    noeuds.push(meilleur!)
  }

  // Le contrat veut l'origine au centre de l'organite : 26 tirages ne remplissent
  // pas l'ellipsoïde symétriquement, on recale donc le nuage sur son encombrement.
  const boite = new THREE.Box3().setFromPoints(noeuds)
  const decalage = boite.getCenter(new THREE.Vector3())
  for (const noeud of noeuds) noeud.sub(decalage)

  return noeuds
}

/** Arête du graphe, par indices de nœuds. */
interface Arete {
  a: number
  b: number
}

/** Chaque nœud tend 2 ou 3 liens vers ses plus proches voisins, sans doublon. */
function relierVoisins(noeuds: THREE.Vector3[], alea: () => number): Arete[] {
  const aretes: Arete[] = []
  const dejaVues = new Set<string>()
  const tousLesIndices = noeuds.map((_, indice) => indice)
  for (let i = 0; i < noeuds.length; i += 1) {
    const origine = noeuds[i]!
    const voisins = tousLesIndices
      .filter((j) => j !== i)
      .sort(
        (j, k) => origine.distanceToSquared(noeuds[j]!) - origine.distanceToSquared(noeuds[k]!),
      )
    const nbLiens = alea() < 0.45 ? 2 : 3
    for (const j of voisins.slice(0, nbLiens)) {
      const cle = i < j ? `${i}-${j}` : `${j}-${i}`
      if (dejaVues.has(cle)) continue
      dejaVues.add(cle)
      aretes.push({ a: i, b: j })
    }
  }
  return aretes
}

/** Trajet d'un tubule : un arc bombé, jamais un segment droit. */
function courbeArete(
  depart: THREE.Vector3,
  arrivee: THREE.Vector3,
  alea: () => number,
): THREE.CatmullRomCurve3 {
  const direction = new THREE.Vector3().subVectors(arrivee, depart)
  const longueur = direction.length()
  direction.divideScalar(longueur)

  // On croise avec l'axe le MOINS colinéaire à l'arête : le produit vectoriel
  // ne peut pas dégénérer, donc pas de normale NaN ni de tube invisible.
  let axeAppui = AXES_REPERE[0]
  for (const candidat of AXES_REPERE) {
    if (Math.abs(direction.dot(candidat)) < Math.abs(direction.dot(axeAppui))) axeAppui = candidat
  }
  const normale = new THREE.Vector3().crossVectors(direction, axeAppui).normalize()
  const binormale = new THREE.Vector3().crossVectors(direction, normale)

  const angle = alea() * Math.PI * 2
  const fleche = longueur * (0.1 + alea() * 0.08)
  const milieu = new THREE.Vector3()
    .addVectors(depart, arrivee)
    .multiplyScalar(0.5)
    .addScaledVector(normale, Math.cos(angle) * fleche)
    .addScaledVector(binormale, Math.sin(angle) * fleche)

  return new THREE.CatmullRomCurve3([depart, milieu, arrivee])
}

export function creerReticulumLisse(): Organite[] {
  const alea = creerAlea(GRAINE)
  const noeuds = tirerNoeuds(alea)
  const aretes = relierVoisins(noeuds, alea)

  // Un seul matériau pour tout le réseau : tubules et renflements sont la même
  // membrane continue, et le plan de coupe s'applique une fois pour toutes.
  const matiere = materiauOrganite(TEINTES.reticulumLisse)

  const groupe = new THREE.Group()
  groupe.name = 'reticulum-lisse'

  for (const arete of aretes) {
    const courbe = courbeArete(noeuds[arete.a]!, noeuds[arete.b]!, alea)
    const tube = new THREE.TubeGeometry(courbe, 10, RAYON_TUBULE, 6, false)
    groupe.add(new THREE.Mesh(tube, matiere))
  }

  // Renflements de jonction : sans eux, les carrefours seraient des angles nus.
  const renflements = new THREE.InstancedMesh(
    new THREE.SphereGeometry(RAYON_RENFLEMENT, 10, 8),
    matiere,
    noeuds.length,
  )
  let noeudHaut = noeuds[0]!
  for (let i = 0; i < noeuds.length; i += 1) {
    const noeud = noeuds[i]!
    renflements.setMatrixAt(i, matriceInstance.makeTranslation(noeud.x, noeud.y, noeud.z))
    if (noeud.y > noeudHaut.y) noeudHaut = noeud
  }
  renflements.instanceMatrix.needsUpdate = true
  groupe.add(renflements)

  groupe.position.copy(CENTRE)

  // L'étiquette part du nœud le plus haut du réseau, dégagé de quelques dixièmes
  // de micromètre. Le groupe n'est que translaté : monde = centre + local.
  const ancre = new THREE.Vector3().addVectors(CENTRE, noeudHaut).add(new THREE.Vector3(0, 0.3, 0))

  return [
    {
      cle: 'reticulumlisse',
      nom: 'Réticulum endoplasmique lisse',
      role: 'Fabrique les lipides et neutralise les toxiques.',
      description:
        "Le réticulum lisse prolonge le rugueux, mais sa membrane ne porte aucun ribosome : elle est nue, et le voisin grenu s'arrête net à la frontière. Au lieu de citernes aplaties, il forme un lacis de tubules ramifiés qui se rejoignent en carrefours renflés. Ses enzymes y assemblent les lipides des membranes et les hormones stéroïdes, et y dégradent alcool et médicaments. Il est enfin le coffre à calcium de la cellule — et dans le modèle de ce site, c'est un vrai coffre : la pompe SERCA y entasse le calcium contre trois ordres de grandeur, massivement tamponné par la calréticuline, et le récepteur de la ryanodine le relâche par vagues régénératives — le calcium qui appelle le calcium. Ce sont ces vidanges-recharges, visibles au laboratoire, qui font pulser la sécrétion d'insuline toutes les quatre minutes.",
      objet: groupe,
      ancre,
      couleur: TEINTES.reticulumLisse,
    },
  ]
}
