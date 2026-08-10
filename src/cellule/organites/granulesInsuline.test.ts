import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { contexteRepos } from '../../noyau/contexte.js'
import { CENTRE_NOYAU, RAYON_CELLULE, RAYON_NOYAU } from '../contrat.js'
import { creerGranulesInsuline } from './granulesInsuline.js'

function amas(nom: string): THREE.InstancedMesh {
  const { organites } = creerGranulesInsuline()
  const trouve = organites[0]!.objet.getObjectByName(nom) as THREE.InstancedMesh
  if (!trouve?.isInstancedMesh) throw new Error(`amas « ${nom} » introuvable`)
  return trouve
}

describe("les granules d'insuline, premier organite vivant", () => {
  it('livre un organite avec cœurs cristallins et halos au même effectif', () => {
    const coeurs = amas('coeurs-cristallins')
    const halos = amas('halos-granules')
    expect(coeurs.instanceMatrix.count).toBe(halos.instanceMatrix.count)
    expect(coeurs.instanceMatrix.count).toBeGreaterThan(300)
  })

  it('aucun granule dans le noyau, aucun hors de la cellule', () => {
    const coeurs = amas('coeurs-cristallins')
    const matrice = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const fautifs: number[] = []
    for (let i = 0; i < coeurs.instanceMatrix.count; i++) {
      coeurs.getMatrixAt(i, matrice)
      position.setFromMatrixPosition(matrice)
      if (position.distanceTo(CENTRE_NOYAU) < RAYON_NOYAU + 0.15) fautifs.push(i)
      if (position.length() > RAYON_CELLULE - 0.15) fautifs.push(i)
    }
    expect(fautifs).toEqual([])
  })

  it('le compte visible suit le pool du modèle', () => {
    const granules = creerGranulesInsuline()
    const coeurs = granules.organites[0]!.objet.getObjectByName(
      'coeurs-cristallins',
    ) as THREE.InstancedMesh
    const total = coeurs.instanceMatrix.count

    granules.mettreAJour({ ...contexteRepos(), insulineGranules: 12, capaciteGranules: 12 })
    expect(coeurs.count).toBe(total)

    granules.mettreAJour({ ...contexteRepos(), insulineGranules: 6, capaciteGranules: 12 })
    expect(coeurs.count).toBe(Math.round(total / 2))

    granules.mettreAJour({ ...contexteRepos(), insulineGranules: 0, capaciteGranules: 12 })
    expect(coeurs.count).toBe(0)
  })

  it("la sécrétion vide d'abord les granules amarrés : la fin de liste est sous la membrane", () => {
    const coeurs = amas('coeurs-cristallins')
    const total = coeurs.instanceMatrix.count
    const matrice = new THREE.Matrix4()
    const position = new THREE.Vector3()
    // Les 8 derniers de la liste doivent être dans la couronne d'amarrage :
    // baisser `count` les retire en premier, comme la première phase sécrétoire.
    for (let i = total - 8; i < total; i++) {
      coeurs.getMatrixAt(i, matrice)
      expect(position.setFromMatrixPosition(matrice).length()).toBeGreaterThan(
        RAYON_CELLULE - 0.6,
      )
    }
  })
})
