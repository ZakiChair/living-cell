import { describe, it, expect } from 'vitest'
import { analyserCa, analyserCaMmcif, centrerEtNormaliser } from './pdb.js'

// Extrait au format PDB réel : colonnes à position fixe, pas de séparateurs.
const EXTRAIT = [
  'ATOM      1  N   MET A   1      38.428  15.115  11.334  1.00 42.15           N',
  'ATOM      2  CA  MET A   1      37.223  14.298  11.539  1.00 41.03           C',
  'ATOM      3  C   MET A   1      36.017  15.148  11.906  1.00 40.22           C',
  'ATOM      4  CA  GLY A   2      34.812  14.331  12.111  1.00 39.88           C',
  'ATOM      5  CA  ALA B   1      30.100  10.000   9.000  1.00 38.00           C',
  'HETATM  600  O   HOH A 301      20.000  20.000  20.000  1.00 30.00           O',
  'END',
].join('\n')

describe('analyse des carbones alpha', () => {
  it('ne garde que les atomes CA', () => {
    expect(analyserCa(EXTRAIT)).toHaveLength(3)
  })

  it('lit les coordonnées aux bonnes colonnes', () => {
    const [premier] = analyserCa(EXTRAIT)
    expect(premier!.x).toBeCloseTo(37.223, 3)
    expect(premier!.y).toBeCloseTo(14.298, 3)
    expect(premier!.z).toBeCloseTo(11.539, 3)
  })

  it('retient la chaîne, pour pouvoir isoler une sous-unité', () => {
    expect(analyserCa(EXTRAIT).map((a) => a.chaine)).toEqual(['A', 'A', 'B'])
  })

  it('ignore les HETATM, qui sont surtout de l’eau et des ligands', () => {
    expect(analyserCa(EXTRAIT).every((a) => a.x !== 20)).toBe(true)
  })

  it('ne confond pas un atome dont le nom contient « CA », comme le calcium', () => {
    // Le calcium est un HETATM nommé « CA » en colonnes 13-16 sans espace initial.
    // Ici on vérifie qu'un carbone bêta (CB) n'est pas pris pour un carbone alpha.
    const piege = 'ATOM     42  CB  ALA A   7      10.000  10.000  10.000  1.00 20.00           C'
    expect(analyserCa(piege)).toHaveLength(0)
  })

  it('renvoie un tableau vide sur un texte sans atome', () => {
    expect(analyserCa('END\n')).toEqual([])
  })
})

// Les structures de plus de 99 999 atomes ne sont publiées qu'en mmCIF — c'est
// le cas du ribosome eucaryote, du spliceosome et du pore nucléaire, soit les
// vedettes de trois des quatre lots. Sans ce lecteur, le pipeline échoue
// précisément sur les molécules qui comptent.
const MMCIF = [
  'data_TEST',
  '#',
  'loop_',
  '_atom_site.group_PDB',
  '_atom_site.id',
  '_atom_site.type_symbol',
  '_atom_site.label_atom_id',
  '_atom_site.label_alt_id',
  '_atom_site.label_comp_id',
  '_atom_site.label_asym_id',
  '_atom_site.Cartn_x',
  '_atom_site.Cartn_y',
  '_atom_site.Cartn_z',
  '_atom_site.auth_asym_id',
  'ATOM 1 N N . MET A 38.428 15.115 11.334 AA',
  'ATOM 2 C CA . MET A 37.223 14.298 11.539 AA',
  'ATOM 3 C C . MET A 36.017 15.148 11.906 AA',
  'ATOM 4 C CA . GLY B 34.812 14.331 12.111 BB',
  'HETATM 5 O O . HOH C 20.000 20.000 20.000 CC',
  '#',
].join('\n')

describe('analyse mmCIF des carbones alpha', () => {
  it('lit les colonnes d’après l’en-tête de boucle, pas d’après une position fixe', () => {
    const atomes = analyserCaMmcif(MMCIF)
    expect(atomes).toHaveLength(2)
    expect(atomes[0]!.x).toBeCloseTo(37.223, 3)
    expect(atomes[0]!.y).toBeCloseTo(14.298, 3)
    expect(atomes[0]!.z).toBeCloseTo(11.539, 3)
  })

  it('préfère la chaîne d’auteur, qui est celle citée dans la littérature', () => {
    expect(analyserCaMmcif(MMCIF).map((a) => a.chaine)).toEqual(['AA', 'BB'])
  })

  it('ignore les HETATM', () => {
    expect(analyserCaMmcif(MMCIF).every((a) => a.x !== 20)).toBe(true)
  })

  it('retombe sur la chaîne d’étiquette si la chaîne d’auteur manque', () => {
    const sansAuteur = MMCIF.split('\n')
      .filter((l) => l !== '_atom_site.auth_asym_id')
      .map((l) => (l.startsWith('ATOM') || l.startsWith('HETATM') ? l.replace(/ \w\w$/, '') : l))
      .join('\n')
    expect(analyserCaMmcif(sansAuteur).map((a) => a.chaine)).toEqual(['A', 'B'])
  })

  it('renvoie un tableau vide si le fichier ne contient pas de boucle atom_site', () => {
    expect(analyserCaMmcif('data_VIDE\n#\n')).toEqual([])
  })
})

describe('centrage et normalisation', () => {
  it('produit trois flottants par atome', () => {
    const plat = centrerEtNormaliser(analyserCa(EXTRAIT))
    expect(plat).toBeInstanceOf(Float32Array)
    expect(plat.length).toBe(3 * 3)
  })

  it('centre le nuage sur l’origine', () => {
    const plat = centrerEtNormaliser(analyserCa(EXTRAIT))
    let sx = 0
    for (let i = 0; i < plat.length; i += 3) sx += plat[i]!
    expect(sx / (plat.length / 3)).toBeCloseTo(0, 5)
  })

  it('fait tenir tous les atomes dans la sphère de rayon 1', () => {
    const plat = centrerEtNormaliser(analyserCa(EXTRAIT))
    let maxi = 0
    for (let i = 0; i < plat.length; i += 3) {
      maxi = Math.max(maxi, Math.hypot(plat[i]!, plat[i + 1]!, plat[i + 2]!))
    }
    expect(maxi).toBeCloseTo(1, 5)
  })

  it('refuse un nuage vide plutôt que de diviser par zéro', () => {
    expect(() => centrerEtNormaliser([])).toThrow(/aucun atome/i)
  })
})
