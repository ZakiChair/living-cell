import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { contexteRepos } from '../../noyau/contexte.js'
import { CYCLE_PREMIER_INTRON, creerEpissage } from './epissage.js'

/**
 * LA RELÈVE DE U1 PAR U6.
 *
 * C'est le fait central de l'épissage, et la fiche l'affirme : « U6 prenant
 * la place de U1 ». Rien ne le vérifiait — et le code le rendait même
 * fragile, en traitant U6 comme « tout ce qui n'est pas les autres ». Ces
 * tests mesurent la géométrie livrée : où sont U1 et U6 au début du cycle,
 * où sont-ils à la fin.
 */

const mecanisme = creerEpissage()[0]!

function snrnp(nom: string): THREE.Object3D {
  const trouve = mecanisme.objet.getObjectByName(nom)
  if (!trouve) throw new Error(`${nom} introuvable dans la scène`)
  return trouve
}

/** Position monde d'un snRNP après avoir avancé la scène à `temps`. */
function positionA(nom: string, temps: number): THREE.Vector3 {
  mecanisme.animer(temps, contexteRepos())
  mecanisme.objet.updateMatrixWorld(true)
  return snrnp(nom).getWorldPosition(new THREE.Vector3())
}

describe('le spliceosome nomme ses cinq acteurs', () => {
  it('les cinq snRNP sont publiés sous leur nom', () => {
    for (const nom of ['U1', 'U2', 'U4', 'U5', 'U6']) {
      expect(snrnp(nom), nom).toBeDefined()
    }
  })
})

describe('U6 prend la place de U1', () => {
  /**
   * Le fait n'est pas une distance, c'est une INVERSION : au début du cycle
   * U6 est plus près de U2 (au point de branchement) que du site 5' ; à la
   * fin, il est plus près du site 5' que de U2. Mesurer des distances
   * absolues reviendrait à épingler la mise en scène ; mesurer l'inversion
   * épingle le mécanisme.
   */
  const ECHANTILLONS = 180
  // UN cycle d'UN intron : les cinq snRNP servent les trois introns à tour
  // de rôle, et échantillonner « trente secondes » mélangeait trois
  // histoires — le premier test écrit ici s'y est laissé prendre.
  const { debut: DEBUT, duree: DUREE } = CYCLE_PREMIER_INTRON

  /** Le site 5', repéré par la position de U1 quand il y est encore posé. */
  function trajectoire() {
    const releves: Array<{ versU2: number; versSite5: number }> = []
    // U1 est posé sur le site 5' pendant tout le début du cycle : sa
    // position la plus stable sert de repère.
    const site5 = positionA('U1', DEBUT + DUREE * 0.2).clone()
    for (let n = 0; n < ECHANTILLONS; n++) {
      const t = DEBUT + (n / ECHANTILLONS) * DUREE
      const u6 = positionA('U6', t)
      const u2 = positionA('U2', t)
      releves.push({ versU2: u6.distanceTo(u2), versSite5: u6.distanceTo(site5) })
    }
    return releves
  }

  it("suit ensuite le site 5' que le lasso amène au point de branchement", () => {
    const releves = trajectoire()
    // DÉCOUVERTE de la mise à l'épreuve : après la relève, U6 se rapproche
    // de U2 — non pas qu'il lâche le site 5', mais parce que LE SITE 5'
    // LUI-MÊME MIGRE. C'est la définition du lasso : l'extrémité 5' de
    // l'intron vient se lier à l'adénosine du point de branchement, où U2
    // se tient. U6, accroché au site 5', suit forcément.
    //
    // Un repère spatial figé fait donc lire l'inverse du mécanisme : c'est
    // dans le repère du BRIN que la relève se raconte, et le premier test
    // écrit ici s'y est laissé prendre.
    const finDeCycle = releves.slice(Math.round(releves.length * 0.85))
    const rapprochement = Math.min(...finDeCycle.map((r) => r.versU2))
    expect(rapprochement).toBeLessThan(0.02)
  })

  it('U6 se rapproche vraiment du site 5\' au cours du cycle', () => {
    const releves = trajectoire()
    const debut = releves.slice(0, Math.round(ECHANTILLONS * 0.2))
    const fin = releves.slice(Math.round(ECHANTILLONS * 0.5), Math.round(ECHANTILLONS * 0.75))
    const minDebut = Math.min(...debut.map((r) => r.versSite5))
    const minFin = Math.min(...fin.map((r) => r.versSite5))
    expect(minFin).toBeLessThan(0.5 * minDebut)
  })

  it('U6 se DÉPLACE : ce n\u2019est pas un acteur immobile', () => {
    let minimum = Infinity
    let maximum = -Infinity
    const reference = positionA('U6', DEBUT)
    for (let n = 0; n < ECHANTILLONS; n++) {
      const d = positionA('U6', DEBUT + (n / ECHANTILLONS) * DUREE).distanceTo(reference)
      minimum = Math.min(minimum, d)
      maximum = Math.max(maximum, d)
    }
    expect(maximum - minimum).toBeGreaterThan(0.01)
  })
})
