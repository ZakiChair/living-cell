import * as THREE from 'three'

/**
 * Contrat commun à tous les organites.
 *
 * Chaque organite est un module autonome qui renvoie un groupe Three.js prêt à
 * poser dans la scène, plus les métadonnées qui alimentent l'étiquette et la
 * fiche. Le groupe porte ses propres transformations : la scène ne fait que
 * l'ajouter.
 */
export interface Organite {
  /** Identifiant stable, en minuscules sans accent : sert de clé. */
  cle: string
  /** Nom affiché à l'écran, en français. */
  nom: string
  /** Une phrase de fonction, telle qu'elle apparaît dans l'étiquette. */
  role: string
  /** Deux à quatre phrases pour la fiche détaillée. */
  description: string
  /** Le contenu 3D. Son origine est le centre de l'organite. */
  objet: THREE.Object3D
  /** Point d'ancrage de l'étiquette, en coordonnées monde. */
  ancre: THREE.Vector3
  /** Teinte de famille, reprise dans la légende. */
  couleur: number
}

/**
 * Échelle de la scène.
 *
 * 1 unité Three.js = 1 micromètre. Une cellule animale fait 20 µm, un noyau
 * 5 à 6 µm, une mitochondrie 1 à 2 µm de long, un ribosome 25 nm. Les
 * proportions sont donc vraies, et c'est ce qui rend l'image crédible : les
 * ribosomes sont bel et bien des grains à peine visibles sur le réticulum,
 * exactement comme en microscopie électronique.
 */
export const UM = 1

/** Rayon de la cellule, en micromètres. */
export const RAYON_CELLULE = 10 * UM

/**
 * ANATOMIE PARTAGÉE — la source unique des positions.
 *
 * Le centre du noyau était redéclaré à l'identique dans cinq fichiers
 * (`noyau.ts`, `poresNucleaires.ts`, `chromatineDense.ts`, `matrices.ts`,
 * `mecanismes/contrat.ts`), et `matrices.ts` documentait la recopie au lieu de
 * la supprimer. Un module qui ignore où est le noyau ne peut pas savoir qu'il
 * plante ses citernes dedans — c'est exactement ce qui est arrivé au réticulum
 * rugueux, dont 56 % se trouvait dans le nucléoplasme.
 *
 * Décalé du centre géométrique : dans une vraie cellule le noyau n'est jamais
 * pile au milieu.
 */
export const CENTRE_NOYAU = new THREE.Vector3(-1, 0.5, 0)
export const RAYON_NOYAU = 3 * UM

/**
 * Plan de coupe de l'écorché.
 *
 * UN SEUL PLAN, et une normale oblique. Le commentaire décrivait ici deux plans
 * perpendiculaires retirant un quartier, avec `clipIntersection = true` — rien
 * de tout cela n'était dans le code, et ne l'a jamais été. Le tableau
 * `PLANS_COUPE` existe pour que tous les matériaux partagent la même instance,
 * pas pour en contenir plusieurs.
 *
 * L'obliquité suffit : une coupe frontale se projetterait en disque et
 * resterait invisible, tandis que de biais elle dégage une ellipse franche qui
 * se lit en volume.
 */
export const PLAN_COUPE = new THREE.Plane(
  // Normale oblique : une coupe frontale se projetterait en disque et resterait
  // invisible. De biais, elle dégage une ellipse franche et se lit en volume.
  new THREE.Vector3(0.62, 0.3, -0.72).normalize(),
  RAYON_CELLULE,
)
export const PLANS_COUPE = [PLAN_COUPE]

/**
 * Palette Okabe-Ito, validée pour les daltonismes.
 *
 * Une teinte par famille fonctionnelle, jamais par individu. Six familles au
 * maximum sont distinguables d'un coup d'œil ; au-delà on regroupe.
 */
export const TEINTES = {
  noyau: 0x0072b2,
  membraneNucleaire: 0x005a8f,
  nucleole: 0x00456e,
  chromatine: 0x56b4e9,
  reticulumRugueux: 0x009e73,
  reticulumLisse: 0x00c78f,
  ribosome: 0xd55e00,
  golgi: 0xcc79a7,
  vesicule: 0xe69f00,
  mitochondrie: 0xd55e00,
  mitochondrieCrete: 0xa84800,
  lysosome: 0x8a5bb0,
  membrane: 0x0072b2,
  proteineMembranaire: 0xe69f00,
  cytosquelette: 0x9c9384,
  centriole: 0x6b6357,
  cytosol: 0xf2eee4,
} as const

/** Matériau standard des organites : aplats mats, sans reflet, façon planche. */
export function materiauOrganite(
  couleur: number,
  options: { opacite?: number; doubleFace?: boolean; emissif?: number } = {},
): THREE.MeshLambertMaterial {
  const materiau = new THREE.MeshLambertMaterial({
    color: couleur,
    side: options.doubleFace === false ? THREE.FrontSide : THREE.DoubleSide,
    transparent: options.opacite !== undefined && options.opacite < 1,
    opacity: options.opacite ?? 1,
    emissive: options.emissif ?? 0x000000,
  })
  // Chaque organite est tranché par les mêmes plans : l'écorché reste cohérent.
  materiau.clippingPlanes = PLANS_COUPE
  materiau.clipShadows = true
  return materiau
}

/** Petit générateur déterministe : la cellule est identique à chaque chargement. */
export function creerAlea(graine: number): () => number {
  let etat = graine >>> 0
  return () => {
    etat = (etat * 1_664_525 + 1_013_904_223) >>> 0
    return etat / 4_294_967_296
  }
}

/** Point aléatoire dans une coquille sphérique, en coordonnées cartésiennes. */
export function pointDansCoquille(
  alea: () => number,
  rayonMin: number,
  rayonMax: number,
  cible = new THREE.Vector3(),
): THREE.Vector3 {
  const u = alea() * 2 - 1
  const theta = alea() * Math.PI * 2
  const r = Math.cbrt(alea() * (rayonMax ** 3 - rayonMin ** 3) + rayonMin ** 3)
  const s = Math.sqrt(1 - u * u)
  return cible.set(r * s * Math.cos(theta), r * s * Math.sin(theta), r * u)
}
