import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CLE_BOITE_DE_VERITE, recenserAmas, reglerGrain } from './grain.js'
import { creerEncombrement } from './organites/encombrement.js'
import { creerMatrices } from './organites/matrices.js'
import { creerChromatineDense } from './organites/chromatineDense.js'

/** Compte les instances effectivement dessinées d'un organite. */
function instancesDessinees(objet: THREE.Object3D): number {
  let total = 0
  objet.traverse((noeud) => {
    const amas = noeud as THREE.InstancedMesh
    if (amas.isInstancedMesh) total += amas.count
  })
  return total
}

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
