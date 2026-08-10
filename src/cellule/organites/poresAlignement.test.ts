import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { SITES_PORES_ENVELOPPE } from '../contrat.js'
import { creerNoyau } from './noyau.js'
import { creerPoresNucleaires } from './poresNucleaires.js'

/**
 * Deux modules criblent la même enveloppe : le noyau pose les anneaux, les
 * pores nucléaires posent les paniers en rejouant la même spirale. Le nombre
 * de sites vivait en double, et une dérive aurait produit des paniers posés à
 * côté de leurs anneaux — deux familles de pores sur la même membrane, sans
 * qu'aucun test ne le voie. Celui-ci mesure la géométrie livrée : chaque
 * panier doit être COAXIAL à un anneau de l'enveloppe.
 */

function directionsInstances(amas: THREE.InstancedMesh): THREE.Vector3[] {
  const matrice = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const directions: THREE.Vector3[] = []
  for (let i = 0; i < amas.count; i++) {
    amas.getMatrixAt(i, matrice)
    directions.push(position.setFromMatrixPosition(matrice).clone().normalize())
  }
  return directions
}

function amasDuNoyau(): THREE.InstancedMesh {
  const groupe = creerNoyau()[0]!.objet
  let trouve: THREE.InstancedMesh | null = null
  groupe.traverse((noeud) => {
    const amas = noeud as THREE.InstancedMesh
    if (amas.isInstancedMesh && !trouve) trouve = amas
  })
  if (!trouve) throw new Error('le noyau ne livre aucun amas de pores')
  return trouve
}

describe("l'alignement des pores sur l'enveloppe", () => {
  it('le noyau sème exactement le nombre de sites du contrat', () => {
    expect(amasDuNoyau().count).toBe(SITES_PORES_ENVELOPPE)
  })

  it('chaque panier est coaxial à un anneau du noyau', () => {
    const sites = directionsInstances(amasDuNoyau())
    const groupe = creerPoresNucleaires()[0]!.objet
    const anneaux = groupe.getObjectByName('anneaux-cytoplasmiques') as THREE.InstancedMesh
    expect(anneaux?.isInstancedMesh).toBe(true)
    expect(anneaux.count).toBeLessThanOrEqual(SITES_PORES_ENVELOPPE)

    const orphelins: number[] = []
    for (const [k, direction] of directionsInstances(anneaux).entries()) {
      // cos < 1 − 1e-6 : à 3 µm de rayon, un désaxage d'un millième de radian
      // mettrait déjà le panier à 3 nm de son anneau — la superposition
      // anneau cytoplasmique / anneau nucléoplasmique exige mieux.
      const aligne = sites.some((site) => site.dot(direction) > 1 - 1e-6)
      if (!aligne) orphelins.push(k)
    }
    expect(orphelins, `paniers posés à côté de leur anneau : ${orphelins.join(', ')}`).toEqual([])
  })
})
