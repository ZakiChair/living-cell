/**
 * Produit un binaire de silhouette à partir d'un identifiant PDB.
 *
 * Usage : npx tsx outils/silhouette.ts 2ZXE
 *
 * Les COORDONNÉES du PDB sont sous licence CC0 : réutilisables librement, y
 * compris commercialement, sans attribution obligatoire.
 *
 * Attention en revanche aux ILLUSTRATIONS Goodsell et Molecule of the Month,
 * qui sont en CC-BY-4.0 : toute image qui devient texture, calque ou tracé de
 * référence impose une attribution dans la page livrée.
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { analyserCa, analyserCaMmcif, centrerEtNormaliser } from '../src/noyau/pdb.js'

const identifiant = process.argv[2]
if (!identifiant) {
  console.error('usage : npx tsx outils/silhouette.ts <identifiant PDB>  (exemple : 2ZXE)')
  process.exit(1)
}

const debut = Date.now()
const code = identifiant.toUpperCase()

/**
 * On tente le PDB puis on retombe sur le mmCIF.
 *
 * Au-delà de 99 999 atomes une structure n'existe plus qu'en mmCIF, et c'est
 * le cas du ribosome eucaryote, du spliceosome et du pore nucléaire. Le repli
 * n'est donc pas un confort : sans lui l'outil échoue sur les molécules
 * vedettes de trois des quatre lots.
 */
async function telecharger(): Promise<{ texte: string; format: 'pdb' | 'mmcif' }> {
  const pdb = await fetch(`https://files.rcsb.org/download/${code}.pdb`)
  if (pdb.ok) return { texte: await pdb.text(), format: 'pdb' }

  const cif = await fetch(`https://files.rcsb.org/download/${code}.cif`)
  if (cif.ok) return { texte: await cif.text(), format: 'mmcif' }

  console.error(`téléchargement impossible : ni PDB (${pdb.status}) ni mmCIF (${cif.status})`)
  process.exit(1)
}

const { texte, format } = await telecharger()
const telecharge = Date.now()

const atomes = format === 'pdb' ? analyserCa(texte) : analyserCaMmcif(texte)
if (atomes.length === 0) {
  console.error('aucun carbone alpha trouvé — structure probablement non protéique')
  process.exit(1)
}

const plat = centrerEtNormaliser(atomes)

await mkdir('assets/silhouettes', { recursive: true })
const chemin = `assets/silhouettes/${code.toLowerCase()}.bin`
await writeFile(chemin, Buffer.from(plat.buffer))

const chaines = [...new Set(atomes.map((a) => a.chaine))].sort()
console.log(`silhouette écrite    ${chemin}`)
console.log(`carbones alpha       ${atomes.length.toLocaleString('fr-FR')}`)
console.log(`chaînes              ${chaines.length} (${chaines.join(', ')})`)
console.log(`poids                ${(plat.byteLength / 1024).toFixed(1)} Ko`)
console.log(`format source        ${format} (${(texte.length / 1024 / 1024).toFixed(2)} Mo)`)
console.log(`téléchargement       ${((telecharge - debut) / 1000).toFixed(1)} s`)
console.log(`durée totale         ${((Date.now() - debut) / 1000).toFixed(1)} s`)
