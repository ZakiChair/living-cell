import * as THREE from 'three'

/**
 * LES VRAIES FORMES, ENFIN BRANCHÉES.
 *
 * `src/noyau/pdb.ts` sait lire des structures cristallographiques depuis le
 * premier jour, `outils/silhouette.ts` en a produit quatre binaires — et
 * aucune scène ne les lisait. Tout le site est procédural : des sphères, des
 * capsules, des tores. Ce module ferme cet écart pour l'objet-héros du site.
 *
 * DOCTRINE GOODSELL : on ne dessine pas des atomes, on dessine une
 * SILHOUETTE. Un carbone α par acide aminé, une sphère par carbone α, un
 * rayon choisi pour que les sphères se recouvrent juste assez — la surface
 * apparaît, les détails que personne ne peut voir à cette échelle
 * disparaissent. C'est ce que fait une illustration de David Goodsell, et
 * c'est ce que la spec du site demandait.
 *
 * Le budget est le sujet : 11 725 carbones α pour un ribosome humain. À
 * 20 triangles la sphère, c'est 234 500 triangles en UN seul appel de
 * dessin — tenable pour un objet unique, intenable pour les cent cinquante
 * ribosomes d'un tapis de réticulum. D'où `pas` : on peut n'en garder qu'un
 * sur deux ou sur trois, et la silhouette tient encore.
 */

/** Une silhouette chargée : des positions normalisées dans une sphère de rayon 1. */
export interface Silhouette {
  /** Positions x,y,z aplaties, centrées, rayon maximal ramené à 1. */
  points: Float32Array
  /** Nombre de carbones α réellement présents dans le fichier. */
  nombreAtomes: number
}

/** Cache : un même code PDB n'est téléchargé et décodé qu'une fois. */
const cache = new Map<string, Promise<Silhouette>>()

/**
 * Charge une silhouette produite par `outils/silhouette.ts`.
 *
 * Le format est brut et volontairement bête : des Float32 little-endian,
 * trois par point, déjà centrés et normalisés. Pas d'en-tête — la longueur
 * du fichier donne le compte, et c'est tout ce qu'il faut savoir.
 */
export function chargerSilhouette(code: string): Promise<Silhouette> {
  const cle = code.toLowerCase()
  const enCours = cache.get(cle)
  if (enCours) return enCours
  const promesse = fetch(`assets/silhouettes/${cle}.bin`)
    .then((reponse) => {
      if (!reponse.ok) throw new Error(`silhouette ${cle} introuvable (${reponse.status})`)
      return reponse.arrayBuffer()
    })
    .then((tampon) => {
      const points = new Float32Array(tampon)
      if (points.length === 0 || points.length % 3 !== 0) {
        throw new Error(`silhouette ${cle} malformée : ${points.length} flottants`)
      }
      return { points, nombreAtomes: points.length / 3 }
    })
  cache.set(cle, promesse)
  return promesse
}

export interface OptionsSilhouette {
  /** Rayon de la molécule dans la scène, en micromètres. */
  rayon: number
  /** Matériau des billes. */
  materiau: THREE.Material
  /**
   * N'en garder qu'un sur `pas`. Un ribosome à `pas: 1` coûte 11 725
   * instances ; à 3, il en coûte 3 909 et la silhouette tient encore.
   */
  pas?: number
  /**
   * Rayon d'une bille, en fraction du rayon de la molécule. Le défaut est
   * calculé pour que les billes se recouvrent : c'est le recouvrement qui
   * fait une SURFACE plutôt qu'un nuage de points.
   */
  rayonBille?: number
}

/**
 * Construit l'amas d'instances d'une silhouette.
 *
 * Le maillage est rendu en un seul appel de dessin, quelle que soit la
 * taille de la molécule — c'est ce qui rend l'opération abordable.
 */
export function creerAmasSilhouette(
  silhouette: Silhouette,
  options: OptionsSilhouette,
): THREE.InstancedMesh {
  const pas = Math.max(1, Math.round(options.pas ?? 1))
  const retenus = Math.ceil(silhouette.nombreAtomes / pas)
  // Le recouvrement suit la densité : moins on garde de points, plus chaque
  // bille doit être grosse pour que la surface reste fermée. La racine
  // cubique vient du volume — c'est la même loi que pour un empilement.
  const rayonBille =
    options.rayonBille ?? 0.055 * Math.cbrt(pas) * Math.cbrt(11_725 / silhouette.nombreAtomes)

  const amas = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    options.materiau,
    retenus,
  )
  const matrice = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const echelle = new THREE.Vector3()
  const taille = options.rayon * rayonBille

  let indice = 0
  for (let i = 0; i < silhouette.nombreAtomes; i += pas) {
    position.set(
      silhouette.points[i * 3]! * options.rayon,
      silhouette.points[i * 3 + 1]! * options.rayon,
      silhouette.points[i * 3 + 2]! * options.rayon,
    )
    echelle.setScalar(taille)
    matrice.compose(position, rotation, echelle)
    amas.setMatrixAt(indice++, matrice)
  }
  amas.count = indice
  amas.instanceMatrix.needsUpdate = true
  amas.computeBoundingSphere()
  return amas
}

/**
 * Charge une silhouette et pose son amas dans un groupe, sans bloquer.
 *
 * Le repli est le point important : si le fichier manque ou que le réseau
 * échoue, la scène GARDE sa forme procédurale et continue de tourner. Une
 * silhouette est un gain de réalisme, jamais une dépendance dure — le site
 * doit rester lisible hors ligne, et c'est ce que ce contrat garantit.
 */
export function poserSilhouette(
  code: string,
  hote: THREE.Object3D,
  options: OptionsSilhouette,
  auSucces?: (amas: THREE.InstancedMesh) => void,
): void {
  chargerSilhouette(code)
    .then((silhouette) => {
      const amas = creerAmasSilhouette(silhouette, options)
      amas.name = `silhouette-${code.toLowerCase()}`
      hote.add(amas)
      auSucces?.(amas)
    })
    .catch((erreur) => {
      console.warn(`silhouette ${code} indisponible, forme procédurale conservée`, erreur)
    })
}
