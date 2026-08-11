/**
 * Extraction d'une silhouette moléculaire depuis un fichier PDB.
 *
 * On ne garde que les carbones alpha : quelques centaines de points suffisent
 * à porter la forme reconnaissable d'une protéine, et c'est la silhouette qui
 * porte l'information, pas le détail atomique. Les données PDB sont en CC0.
 *
 * Le format PDB est à colonnes fixes, pas à séparateurs — découper sur les
 * espaces casse dès qu'un champ déborde sur son voisin.
 */

/**
 * Un point du SQUELETTE : carbone α d'un acide aminé, ou phosphore d'un
 * nucléotide. Un par résidu dans les deux cas — c'est ce qui rend les deux
 * familles comparables et permet de dessiner une silhouette complète.
 */
export interface AtomeCa {
  x: number
  y: number
  z: number
  chaine: string
}

export function analyserCa(texte: string): AtomeCa[] {
  const atomes: AtomeCa[] = []
  for (const ligne of texte.split('\n')) {
    if (!ligne.startsWith('ATOM')) continue
    // Colonnes 13-16 : nom de l'atome, dans le champ de quatre caractères du format.
    // Carbone α pour les protéines, PHOSPHORE pour les acides nucléiques.
    // Ne retenir que le CA donnait un ribosome SANS SON ARN — or l'ARN
    // ribosomique fait les deux tiers de sa masse, forme son cœur et porte
    // son site catalytique. La silhouette montrait la coquille protéique
    // périphérique et prétendait montrer le ribosome.
    const nomAtome = ligne.slice(12, 16).trim()
    if (nomAtome !== 'CA' && nomAtome !== 'P') continue
    atomes.push({
      x: Number.parseFloat(ligne.slice(30, 38)),
      y: Number.parseFloat(ligne.slice(38, 46)),
      z: Number.parseFloat(ligne.slice(46, 54)),
      chaine: ligne.slice(21, 22),
    })
  }
  return atomes
}

/**
 * Analyse mmCIF.
 *
 * Nécessaire, pas optionnel : au-delà de 99 999 atomes, une structure n'est
 * plus publiée au format PDB. C'est le cas du ribosome eucaryote, du
 * spliceosome et du pore nucléaire, soit les vedettes de trois des quatre lots
 * du site. Un pipeline limité au PDB échouerait précisément sur elles.
 *
 * Contrairement au PDB, le mmCIF n'a pas de colonnes fixes : l'ordre des champs
 * est déclaré par l'en-tête de la boucle `_atom_site.`, et il faut le lire.
 */
export function analyserCaMmcif(texte: string): AtomeCa[] {
  const lignes = texte.split('\n')
  const colonnes = new Map<string, number>()
  let indexColonne = 0
  let dansEntete = false
  const atomes: AtomeCa[] = []

  for (const brute of lignes) {
    const ligne = brute.trim()

    if (ligne.startsWith('_atom_site.')) {
      colonnes.set(ligne.slice('_atom_site.'.length).split(/\s/)[0]!, indexColonne++)
      dansEntete = true
      continue
    }

    if (!dansEntete) continue
    if (!ligne.startsWith('ATOM')) {
      // La boucle se termine au premier enregistrement qui n'est pas un ATOM,
      // en dehors des HETATM qu'on saute sans sortir.
      if (ligne.startsWith('HETATM')) continue
      if (ligne === '' || ligne === '#') continue
      break
    }

    const champs = ligne.split(/\s+/)
    const lire = (nom: string): string | undefined => {
      const i = colonnes.get(nom)
      return i === undefined ? undefined : champs[i]
    }

    // Carbone α (protéines) ou phosphore (acides nucléiques) : voir le
    // parseur PDB ci-dessus, même raison.
    const nomAtome = lire('label_atom_id')
    if (nomAtome !== 'CA' && nomAtome !== 'P') continue

    const x = Number.parseFloat(lire('Cartn_x') ?? '')
    const y = Number.parseFloat(lire('Cartn_y') ?? '')
    const z = Number.parseFloat(lire('Cartn_z') ?? '')
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue

    // La chaîne d'auteur est celle citée dans la littérature ; l'étiquette
    // interne ne sert que de repli.
    const chaine = lire('auth_asym_id') ?? lire('label_asym_id') ?? '?'
    atomes.push({ x, y, z, chaine })
  }

  return atomes
}

/** Centre le nuage sur l'origine et le met à l'échelle dans une sphère de rayon 1. */
export function centrerEtNormaliser(atomes: AtomeCa[]): Float32Array {
  if (atomes.length === 0) throw new Error('aucun atome à normaliser')

  let cx = 0
  let cy = 0
  let cz = 0
  for (const a of atomes) {
    cx += a.x
    cy += a.y
    cz += a.z
  }
  cx /= atomes.length
  cy /= atomes.length
  cz /= atomes.length

  let rayonMax = 0
  for (const a of atomes) {
    rayonMax = Math.max(rayonMax, Math.hypot(a.x - cx, a.y - cy, a.z - cz))
  }
  const facteur = rayonMax === 0 ? 1 : 1 / rayonMax

  const plat = new Float32Array(atomes.length * 3)
  atomes.forEach((a, i) => {
    plat[i * 3] = (a.x - cx) * facteur
    plat[i * 3 + 1] = (a.y - cy) * facteur
    plat[i * 3 + 2] = (a.z - cz) * facteur
  })
  return plat
}
