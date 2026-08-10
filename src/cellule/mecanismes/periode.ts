import * as THREE from 'three'
import { contexteRepos } from '../../noyau/contexte.js'
import type { Mecanisme, MecanismeBrut } from './contrat.js'

/**
 * MESURER LA PÉRIODE D'UNE SCÈNE ANIMÉE, SANS RIEN SAVOIR D'ELLE.
 *
 * Le critère D3 exige qu'« un test échoue si le badge diverge de ce que
 * l'animation fait réellement ». Trois versions ont échoué à l'honorer, chacune
 * pour la même raison de fond : elles finissaient par relire une constante
 * d'animation au lieu de mesurer l'animation.
 *
 * La sortie est de mesurer une grandeur que le code ne peut pas maquiller : la
 * PÉRIODE du cycle, telle qu'elle apparaît dans les positions livrées. Toute
 * scène périodique laisse une signature scalaire — la somme des coordonnées de
 * tout ce qu'elle contient — qui se répète avec elle. Une autocorrélation la
 * retrouve sans savoir s'il s'agit d'un rotor, d'un ribosome ou d'une vésicule.
 *
 * Le badge devient alors vérifiable en une ligne :
 *
 *     période mesurée à l'écran ÷ durée réelle déclarée = ralentissement annoncé
 *
 * Aucune constante d'animation n'entre dans ce calcul. Le seul chiffre déclaré
 * est la durée du cycle DANS LA CELLULE, qui est une donnée de biologie et non
 * un réglage — et c'est précisément ce qu'un relecteur peut contrôler.
 */

/** Pas d'échantillonnage de la signature, en secondes d'écran. */
const PAS = 1 / 30

/**
 * Signature scalaire de la scène à un instant donné.
 *
 * On somme les coordonnées de chaque instance et de chaque maillage, pondérées
 * par leur rang. La pondération est ce qui empêche deux mouvements opposés de
 * s'annuler : sans elle, un anneau d'objets qui tourne rendrait une somme
 * constante et la scène paraîtrait immobile.
 */
function signature(objet: THREE.Object3D): number {
  const matrice = new THREE.Matrix4()
  const point = new THREE.Vector3()
  let somme = 0
  let rang = 1
  objet.traverse((noeud) => {
    const amas = noeud as THREE.InstancedMesh
    if (amas.isInstancedMesh) {
      for (let i = 0; i < amas.count; i++) {
        amas.getMatrixAt(i, matrice)
        point.setFromMatrixPosition(matrice)
        somme += (point.x + 2 * point.y + 3 * point.z) * rang
        rang = (rang % 97) + 1
      }
      return
    }
    somme += (noeud.position.x + 2 * noeud.position.y + 3 * noeud.position.z) * rang
    // Le SINUS de l'angle, et non l'angle : une rotation continue croît sans
    // borne, et une rampe noie la signature sous une tendance qui n'a pas de
    // période. Le rotor de l'ATP synthase, dont l'angle atteint des milliers de
    // radians, rendait ainsi la scène « apériodique » alors qu'elle est le seul
    // mouvement franchement cyclique du projet.
    somme +=
      (Math.sin(noeud.rotation.x) +
        2 * Math.sin(noeud.rotation.y) +
        3 * Math.sin(noeud.rotation.z)) *
      rang
    somme += (noeud.scale.x + 2 * noeud.scale.y + 3 * noeud.scale.z) * rang
    rang = (rang % 97) + 1
  })
  return somme
}

/**
 * L'objet nommé que le mécanisme désigne comme porteur de son cycle.
 *
 * On échoue bruyamment s'il est introuvable : un porteur qui a perdu son nom
 * rendrait le badge invérifiable en silence, ce qui est exactement le défaut
 * que ce dispositif existe pour empêcher.
 */
export function porteurDuCycle(mecanisme: Mecanisme | MecanismeBrut): THREE.Object3D {
  const nom = mecanisme.observable?.nom
  if (!nom) throw new Error(`${mecanisme.cle} ne désigne aucun porteur de cycle`)
  const trouve = mecanisme.objet.getObjectByName(nom)
  if (!trouve) {
    throw new Error(`${mecanisme.cle} désigne « ${nom} », introuvable dans sa scène`)
  }
  return trouve
}

/** Relève la signature d'un objet sur une fenêtre de temps. */
function releverSignature(
  mecanisme: Mecanisme | MecanismeBrut,
  cible: THREE.Object3D,
  duree: number,
): Float64Array {
  const n = Math.round(duree / PAS)
  const trace = new Float64Array(n)
  // Le harnais mesure la scène AU REPOS : le contexte stationnaire garantit
  // que la période relevée est celle du badge, pas celle d'un régime stimulé.
  const contexte = contexteRepos()
  for (let i = 0; i < n; i++) {
    mecanisme.animer(i * PAS, contexte)
    trace[i] = signature(cible)
  }
  return trace
}

/** Centre et normalise une trace : l'autocorrélation devient comparable. */
function centrer(trace: Float64Array): Float64Array {
  let moyenne = 0
  for (const v of trace) moyenne += v
  moyenne /= trace.length
  const centre = new Float64Array(trace.length)
  for (let i = 0; i < trace.length; i++) centre[i] = trace[i]! - moyenne
  return centre
}

export interface PeriodeMesuree {
  /** Période trouvée, en secondes d'écran. `null` si la scène n'est pas périodique. */
  secondes: number | null
  /** Force de la répétition, de 0 à 1. Sous 0,5 la période n'est pas fiable. */
  correlation: number
}

/**
 * Cherche la période d'une scène par autocorrélation de sa signature.
 *
 * ON CHERCHE UN PIC, ET NON UN MAXIMUM. C'est la distinction qui fait marcher
 * la méthode : sur une trace lisse, l'autocorrélation décroît avec le décalage,
 * si bien que retenir le plus fort ferait toujours gagner le plus petit
 * décalage — une première version rendait 0,50 s pour dix mécanismes sur seize,
 * c'est-à-dire la borne basse de sa propre plage de recherche.
 *
 * Une période, elle, se manifeste comme un maximum LOCAL : la corrélation
 * remonte quand le décalage atteint un cycle entier. On retient donc le pic le
 * plus haut, et l'on exige qu'il soit franc — sans quoi la scène est déclarée
 * apériodique plutôt que dotée d'un chiffre inventé.
 */
export function mesurerPeriode(
  mecanisme: Mecanisme | MecanismeBrut,
  minimum: number,
  maximum: number,
  cible: THREE.Object3D = porteurDuCycle(mecanisme),
): PeriodeMesuree {
  // Deux périodes et demie au moins, pour que le décalage ait de quoi mordre.
  const trace = centrer(releverSignature(mecanisme, cible, maximum * 2.5))
  const decalageMin = Math.max(1, Math.round(minimum / PAS))
  const decalageMax = Math.min(Math.round(maximum / PAS), Math.floor(trace.length / 2))

  const correlations = new Float64Array(decalageMax + 1)
  for (let d = decalageMin; d <= decalageMax; d++) {
    let produit = 0
    let normeA = 0
    let normeB = 0
    const n = trace.length - d
    for (let i = 0; i < n; i++) {
      const a = trace[i]!
      const b = trace[i + d]!
      produit += a * b
      normeA += a * a
      normeB += b * b
    }
    correlations[d] = produit / (Math.sqrt(normeA * normeB) || 1)
  }

  // Un pic doit dominer son voisinage, sinon le moindre frémissement d'une trace
  // bruitée passerait pour une période. Le voisinage est une FRACTION DU
  // CANDIDAT, et non de la borne basse de la fenêtre : dérivé de la borne, il
  // amputait le bas de la plage de recherche et pouvait exclure le fondamental.
  // Un test de mutation l'a montré — ralentir une animation de moitié laissait
  // le badge passer, parce que la vraie période tombait dans l'angle mort.
  const pics: Array<{ decalage: number; correlation: number }> = []
  for (let d = decalageMin; d <= decalageMax; d++) {
    const valeur = correlations[d]!
    const voisinage = Math.max(2, Math.round(d * 0.25))
    let domine = true
    for (let k = 1; k <= voisinage && domine; k++) {
      // Les bornes du tableau ne disqualifient pas un pic : on compare à ce qui
      // existe, sans exiger que le voisinage soit entier.
      if (d - k >= decalageMin && correlations[d - k]! > valeur) domine = false
      if (d + k <= decalageMax && correlations[d + k]! > valeur) domine = false
    }
    if (domine) pics.push({ decalage: d, correlation: valeur })
  }

  if (!pics.length) return { secondes: null, correlation: 0 }

  // ON PREND LE FONDAMENTAL, PAS LE PLUS HAUT PIC.
  //
  // Une trace périodique se répète aussi à deux, trois, cinq fois sa période :
  // ces harmoniques donnent une corrélation quasi identique, et le bruit
  // flottant suffit à les faire gagner. La glycolyse rendait ainsi 52,30 s —
  // cinq cycles exacts — au lieu de ses 10,47.
  //
  // Le remède est celui des détecteurs de hauteur : parmi les pics presque
  // aussi bons que le meilleur, on retient le PLUS PETIT. Un harmonique ne peut
  // pas être plus court que son fondamental.
  const meilleur = Math.max(...pics.map((p) => p.correlation))
  const fondamental = pics
    .filter((p) => p.correlation >= meilleur * 0.97)
    .reduce((a, b) => (a.decalage <= b.decalage ? a : b))

  return {
    secondes: meilleur >= 0.5 ? fondamental.decalage * PAS : null,
    correlation: fondamental.correlation,
  }
}
