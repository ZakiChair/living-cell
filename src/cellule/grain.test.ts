import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CLE_BOITE_DE_VERITE, recenserAmas, reglerGrain } from './grain.js'
import { creerEncombrement } from './organites/encombrement.js'
import { creerMatrices } from './organites/matrices.js'
import { creerChromatineDense } from './organites/chromatineDense.js'
import { OCCUPATION_CYTOSOL } from '../noyau/densite.js'

/** Compte les instances effectivement dessinées d'un organite. */
function instancesDessinees(objet: THREE.Object3D): number {
  let total = 0
  objet.traverse((noeud) => {
    const amas = noeud as THREE.InstancedMesh
    if (amas.isInstancedMesh) total += amas.count
  })
  return total
}

/** Les dimensions que la fiche annonce à l'étudiant, en micromètres. */
function dimensionsAnnoncees(description: string): { cote: number; epaisseur: number } {
  const trouve = description.match(/dalle de (\d+) nm de côté sur (\d+) nm d'épaisseur/)
  expect(trouve, `la fiche n'annonce pas ses dimensions : « ${description.slice(0, 80)}… »`).not.toBeNull()
  return { cote: Number(trouve![1]) / 1000, epaisseur: Number(trouve![2]) / 1000 }
}

/** Volume intérieur d'un maillage fermé, en µm³ — divergence sur les triangles. */
function volumeDeGeometrie(geometrie: THREE.BufferGeometry): number {
  const plate = geometrie.index ? geometrie.toNonIndexed() : geometrie
  const p = plate.getAttribute('position')
  let six = 0
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i), ay = p.getY(i), az = p.getZ(i)
    const bx = p.getX(i + 1), by = p.getY(i + 1), bz = p.getZ(i + 1)
    const cx = p.getX(i + 2), cy = p.getY(i + 2), cz = p.getZ(i + 2)
    six += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
  }
  return Math.abs(six) / 6
}

describe('la boîte de vérité tient sa promesse', () => {
  /**
   * LE TEST QUI MANQUAIT, ET C'ÉTAIT LE PLUS IMPORTANT DU PROJET.
   *
   * La fiche de la boîte annonce « le cytoplasme à sa densité réelle : 25 % du
   * volume ». Personne ne l'avait mesuré. L'occupation réelle était de **3,9 %**
   * — faux d'un facteur 6,4 — parce que le budget d'instances était calculé avec
   * le volume d'un ribosome, 2 750 nm³, quand le peuplement livré est fait à
   * 55 % de grains de 5 nm qui en occupent 21.
   *
   * Ce test additionne le volume des géométries RÉELLEMENT semées et le divise
   * par celui de la boîte réellement construite. Aucune constante n'y intervient
   * du côté mesuré.
   */
  it('occupe vraiment le quart de son volume', () => {
    const boite = creerEncombrement().find((o) => o.cle === CLE_BOITE_DE_VERITE)!
    boite.objet.updateMatrixWorld(true)

    let volumeOccupe = 0
    let instances = 0
    boite.objet.traverse((noeud) => {
      const amas = noeud as THREE.InstancedMesh
      if (!amas.isInstancedMesh) return
      volumeOccupe += volumeDeGeometrie(amas.geometry) * amas.count
      instances += amas.count
    })

    // Le dénominateur est ce que LA FICHE annonce à l'étudiant, et non une
    // constante du module : c'est la promesse elle-même qui est mise à l'épreuve.
    const { cote, epaisseur } = dimensionsAnnoncees(boite.description)
    const occupation = volumeOccupe / (cote * cote * epaisseur)
    expect(instances).toBeGreaterThan(150_000)
    expect(
      occupation,
      `occupation mesurée ${(occupation * 100).toFixed(1)} % pour les ${OCCUPATION_CYTOSOL * 100} % ` +
        `que la fiche annonce, dans la dalle de ${(cote * 1000).toFixed(0)} × ` +
        `${(epaisseur * 1000).toFixed(0)} nm qu'elle annonce aussi`,
    ).toBeGreaterThan(OCCUPATION_CYTOSOL * 0.9)
    expect(occupation).toBeLessThan(OCCUPATION_CYTOSOL * 1.1)
  })

  /**
   * C'EST UNE DALLE, ET SON ÉPAISSEUR EST CELLE QU'ELLE ANNONCE.
   *
   * On mesure dans le repère PROPRE de la dalle : elle est inclinée pour faire
   * face à la caméra, si bien que son encombrement aligné sur les axes du monde
   * est bien plus grand que ses dimensions — 1 255 × 1 243 × 816 nm pour une
   * dalle de 1 164 × 1 164 × 200. Mesurer dans le monde ferait donc conclure à
   * un cube.
   */
  it("est bien une dalle, à l'épaisseur qu'elle annonce", () => {
    const boite = creerEncombrement().find((o) => o.cle === CLE_BOITE_DE_VERITE)!
    boite.objet.updateMatrixWorld(true)
    const { cote, epaisseur } = dimensionsAnnoncees(boite.description)

    const matrice = new THREE.Matrix4()
    const point = new THREE.Vector3()
    let maxLateral = 0
    let maxEpaisseur = 0
    boite.objet.traverse((noeud) => {
      const amas = noeud as THREE.InstancedMesh
      if (!amas.isInstancedMesh) return
      for (let i = 0; i < amas.count; i++) {
        amas.getMatrixAt(i, matrice)
        point.setFromMatrixPosition(matrice)
        maxLateral = Math.max(maxLateral, Math.abs(point.x), Math.abs(point.y))
        maxEpaisseur = Math.max(maxEpaisseur, Math.abs(point.z))
      }
    })

    // Les centres sont semés dans la dalle annoncée : la demi-étendue mesurée
    // doit en être la moitié, à un cheveu près.
    expect(maxLateral * 2).toBeCloseTo(cote, 2)
    expect(
      maxEpaisseur * 2,
      `épaisseur mesurée ${(maxEpaisseur * 2000).toFixed(0)} nm pour ${(epaisseur * 1000).toFixed(0)} annoncés`,
    ).toBeCloseTo(epaisseur, 3)
    // Une dalle, pas un cube : franchement plus large que profonde.
    expect(cote / epaisseur).toBeGreaterThan(4)
  })
})

describe('le grain du cytosol', () => {
  const organites = [...creerEncombrement(), ...creerMatrices(), ...creerChromatineDense()]
  const boite = organites.find((o) => o.cle === CLE_BOITE_DE_VERITE)

  it('trouve bien la boîte de vérité parmi les organites', () => {
    expect(boite, `aucun organite ne porte la clé « ${CLE_BOITE_DE_VERITE} »`).toBeDefined()
    expect(instancesDessinees(boite!.objet)).toBeGreaterThan(100_000)
  })

  /**
   * LE TEST QUI VERROUILLE LE DÉFAUT LE PLUS GRAVE DU PRODUIT.
   *
   * La boîte de vérité était éclaircie par trois gestes de l'interface — le
   * curseur, le gros plan sur un mécanisme à 12 %, l'atelier à 8 %. Or c'est le
   * seul endroit du site où la densité est celle de la biologie, et sa fiche le
   * promet à l'étudiant.
   *
   * Ce test ne regarde PAS le contenu de l'ensemble des clés éclaircissables —
   * ce serait vérifier une constante contre elle-même. Il demande un
   * éclaircissement TOTAL et compte les instances qui restent dessinées.
   */
  it("n'ôte pas une seule instance à la boîte de vérité, même à zéro", () => {
    const avant = instancesDessinees(boite!.objet)
    const amas = recenserAmas(organites)
    reglerGrain(amas, 0)
    expect(instancesDessinees(boite!.objet)).toBe(avant)
    reglerGrain(amas, 0.08) // le réglage de l'atelier
    expect(instancesDessinees(boite!.objet)).toBe(avant)
    reglerGrain(amas, 0.12) // le réglage du gros plan sur un mécanisme
    expect(instancesDessinees(boite!.objet)).toBe(avant)
  })

  it('éclaircit bel et bien les peuplements de fond', () => {
    const amas = recenserAmas(organites)
    expect(amas.length).toBeGreaterThan(0)
    const plein = amas.reduce((s, a) => s + a.plein, 0)
    expect(plein).toBeGreaterThan(10_000)

    reglerGrain(amas, 0)
    expect(amas.reduce((s, a) => s + a.maillage.count, 0)).toBe(0)

    reglerGrain(amas, 0.5)
    const moitie = amas.reduce((s, a) => s + a.maillage.count, 0)
    expect(moitie / plein).toBeCloseTo(0.5, 2)
  })

  it('revient exactement au plein, sans perte', () => {
    const amas = recenserAmas(organites)
    const plein = amas.map((a) => a.plein)
    reglerGrain(amas, 0)
    reglerGrain(amas, 1)
    expect(amas.map((a) => a.maillage.count)).toEqual(plein)
  })

  it('borne les fractions absurdes au lieu de les propager', () => {
    const amas = recenserAmas(organites)
    reglerGrain(amas, -3)
    expect(amas.every((a) => a.maillage.count === 0)).toBe(true)
    reglerGrain(amas, 12)
    expect(amas.map((a) => a.maillage.count)).toEqual(amas.map((a) => a.plein))
  })
})
