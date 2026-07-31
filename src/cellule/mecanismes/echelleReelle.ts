import * as THREE from 'three'
import type { Mecanisme } from './contrat.js'

/**
 * Remise des mécanismes à leur taille biologique réelle.
 *
 * Plusieurs modules ont été construits agrandis « pour qu'on les voie », et
 * c'est précisément ce qui les faisait ressembler à des planches de manuel
 * flottant dans le cytoplasme plutôt qu'à la cellule. Une chaîne respiratoire
 * de 0,8 µm n'existe pas : elle fait 150 nm. Dix enzymes de la glycolyse
 * tiennent dans 90 nm, pas dans 2,8 µm.
 *
 * La correction est automatique. On mesure l'encombrement réel de la géométrie
 * livrée, on calcule le facteur qui la ramène à sa taille vraie, et on
 * l'applique en gardant le mécanisme centré sur lui-même. Le cadrage suit :
 * s'approcher d'un mécanisme veut désormais dire descendre à l'échelle du
 * nanomètre, ce que la barre d'échelle affiche.
 */

/**
 * Encombrement réel de chaque mécanisme, en micromètres.
 *
 * C'est la plus grande dimension de la scène représentée, pas celle d'une
 * molécule isolée. Les mécanismes absents de cette table ont été construits à
 * la bonne échelle et ne sont pas touchés.
 */
const TAILLES_REELLES_UM: Record<string, number> = {
  // Quatre complexes espacés d'environ 30 nm, plus l'ATP synthase.
  respiration: 0.16,
  // Dix enzymes en chaîne, chacune de 5 à 8 nm.
  glycolyse: 0.09,
  // Le complexe pyruvate déshydrogénase fait à lui seul 30 nm.
  fermentation: 0.1,
  // Huit enzymes en anneau, chacune d'environ 8 nm.
  krebs: 0.05,
  // Quatre enzymes, et un palmitate qui ne fait que 2 nm de long.
  'beta-oxydation': 0.045,
  // Une pompe de 10 nm et un canal de 8 nm, séparés de quelques dizaines.
  'pompe-sodium-potassium': 0.06,
  // Le spliceosome fait 40 nm, mais il travaille sur une portion de transcrit.
  epissage: 0.3,
}

const _boite = new THREE.Box3()
const _taille = new THREE.Vector3()
const _centre = new THREE.Vector3()

/**
 * Ramène un mécanisme à sa taille réelle, en le laissant là où il est.
 *
 * On enveloppe la géométrie livrée dans un groupe porteur : le contenu est
 * recentré sur son propre barycentre géométrique, et c'est le groupe qui porte
 * la position et l'échelle. Sans ce recentrage, un module dont les objets sont
 * posés loin de son origine se replierait vers cette origine au lieu de rétrécir
 * sur place.
 */
export function mettreAEchelleReelle(mecanismes: Mecanisme[]): Mecanisme[] {
  return mecanismes.map((m) => {
    const cible = TAILLES_REELLES_UM[m.cle]
    if (cible === undefined) return m

    _boite.setFromObject(m.objet)
    if (_boite.isEmpty()) return m
    _boite.getSize(_taille)
    _boite.getCenter(_centre)

    const actuelle = Math.max(_taille.x, _taille.y, _taille.z)
    if (!(actuelle > 0)) return m
    const facteur = cible / actuelle
    // Déjà à la bonne taille, à 20 % près : on ne touche à rien.
    if (facteur > 0.8 && facteur < 1.25) return m

    const contenu = m.objet
    const porteur = new THREE.Group()
    porteur.name = `echelle-reelle-${m.cle}`

    // Le contenu recule de son propre centre ; le porteur reprend ce centre.
    contenu.position.sub(_centre)
    porteur.position.copy(_centre)
    porteur.add(contenu)
    porteur.scale.setScalar(facteur)

    return {
      ...m,
      objet: porteur,
      // L'ancre reste le centre géométrique : c'est là qu'il faut regarder.
      ancre: _centre.clone(),
      rayonCadrage: (cible / 2) * 1.15,
    }
  })
}
