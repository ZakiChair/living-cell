import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DUREE_ETAT, K_PAR_CYCLE, NA_PAR_CYCLE } from './pompeSodiumPotassium.js'
import { creerMecanismes } from './tous.js'

/**
 * LA POMPE Na⁺/K⁺ : CE QUE L'ANIMATION FAIT CONTRE CE QU'ELLE ANNONCE.
 *
 * Deuxième mécanisme mesuré après la chaîne respiratoire. Le critère D3 exige
 * qu'« un test échoue si le badge diverge de ce que l'animation fait
 * réellement », et la revue avait relevé ici l'écart le plus net du projet :
 * la fiche annonce « trois Na⁺ sortent, deux K⁺ entrent, par cycle » pendant
 * que la scène anime dix-huit et douze.
 *
 * CE QUE CE TEST ÉTABLIT, et qui est le point : le RAPPORT 3:2 est exact. C'est
 * lui qui fait de la pompe une pompe électrogène — trois charges sortent, deux
 * entrent — et c'est le fait pédagogiquement porteur. L'effectif absolu, lui,
 * est multiplié par six, et l'ellision le déclare.
 *
 * On COMPTE les traversées dans les matrices d'instances. Relire `NB_SODIUM` et
 * `NB_POTASSIUM` ne prouverait rien : c'est la faute que ce projet a commise
 * trois fois.
 */
describe('la pompe Na⁺/K⁺ : le compte contre la fiche', () => {
  const mecanisme = creerMecanismes().find((m) => m.cle === 'pompe-sodium-potassium')!

  /**
   * Compte les traversées complètes d'un amas d'ions sur une fenêtre donnée.
   *
   * Chaque ion parcourt la membrane de part en part puis reprend au début : une
   * traversée se lit donc comme un SAUT de position, le retour au point de
   * départ. On compte les sauts.
   */
  function compterTraversees(nom: string, secondes: number): number {
    const amas = mecanisme.objet.getObjectByName(nom) as THREE.InstancedMesh
    expect(amas?.isInstancedMesh, `l'amas « ${nom} » doit être nommé pour être mesurable`).toBe(true)

    const matrice = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const PAS = 1 / 60
    mecanisme.animer(0)

    const precedentes = new Float64Array(amas.count)
    for (let i = 0; i < amas.count; i++) {
      amas.getMatrixAt(i, matrice)
      precedentes[i] = position.setFromMatrixPosition(matrice).y
    }

    let traversees = 0
    for (let n = 1; n <= Math.round(secondes / PAS); n++) {
      mecanisme.animer(n * PAS)
      for (let i = 0; i < amas.count; i++) {
        amas.getMatrixAt(i, matrice)
        const y = position.setFromMatrixPosition(matrice).y
        // La course fait 0,44 unité ; un déplacement supérieur à la moitié en
        // une image ne peut être qu'une reprise de cycle.
        if (Math.abs(y - precedentes[i]!) > 0.22) traversees++
        precedentes[i] = y
      }
    }
    return traversees
  }

  it('est bien livré par la page', () => {
    expect(mecanisme).toBeDefined()
    expect(mecanisme.siege).toBe('Membrane plasmique')
  })

  /**
   * LE CŒUR DU TEST : le rapport, pas l'effectif.
   *
   * Trois charges sortent pour deux qui entrent. Si quelqu'un ajustait les
   * effectifs sans garder le rapport, la pompe cesserait d'être électrogène et
   * la fiche entière deviendrait fausse — c'est ce qu'elle enseigne.
   */
  it('conserve le rapport 3:2 entre sodiums sortants et potassiums entrants', () => {
    const FENETRE = DUREE_ETAT * 4 * 6 // six cycles complets
    const na = compterTraversees('sodium', FENETRE)
    const k = compterTraversees('potassium', FENETRE)

    expect(na, 'aucun sodium ne traverse').toBeGreaterThan(0)
    expect(k, 'aucun potassium ne traverse').toBeGreaterThan(0)
    expect(
      na / k,
      `${na} sodiums pour ${k} potassiums, soit ${(na / k).toFixed(2)} au lieu de ` +
        `${NA_PAR_CYCLE / K_PAR_CYCLE}`,
    ).toBeCloseTo(NA_PAR_CYCLE / K_PAR_CYCLE, 1)
  })

  /**
   * L'ÉCART D'EFFECTIF EST MESURÉ, ET IL DOIT ÊTRE DÉCLARÉ.
   *
   * La fiche dit trois et deux ; l'animation en fait six fois plus. Ce n'est pas
   * un défaut — à trois et deux, la scène ne montrerait presque rien entre deux
   * conformations — mais un étudiant qui compte les billes compte un
   * échantillon. Le test vérifie que le facteur mesuré est bien celui que
   * l'ellision annonce.
   */
  it("déclare dans son ellision le facteur d'échantillonnage qu'il applique", () => {
    const cycles = 6
    const FENETRE = DUREE_ETAT * 4 * cycles
    const na = compterTraversees('sodium', FENETRE)
    const facteur = na / cycles / NA_PAR_CYCLE

    expect(facteur, `facteur d'échantillonnage mesuré : ×${facteur.toFixed(1)}`).toBeCloseTo(6, 0)
    expect(mecanisme.ellision).toContain('multipliés par six')
    expect(mecanisme.ellision).toContain('dix-huit sodiums et douze potassiums')
  })

  it('dit dans sa fiche la stœchiométrie que le rapport respecte', () => {
    expect(mecanisme.description).toContain('trois ions sodium')
    expect(mecanisme.description).toContain('deux')
    expect(NA_PAR_CYCLE).toBe(3)
    expect(K_PAR_CYCLE).toBe(2)
  })

  /**
   * Le badge annonce un ralenti ×1 000. Un cycle de pompe dure 7 à 20 ms dans
   * la cellule ; à l'écran il dure quatre états. Le rapport doit tomber dans la
   * fourchette que la justification elle-même énonce.
   */
  it('annonce un ralenti compatible avec la durée de cycle mesurée', () => {
    expect(mecanisme.facteur).toMatch(/^ralenti/)
    const annonce = Number(mecanisme.facteur.replace(/[^\d]/g, ''))
    const cycleEcran = DUREE_ETAT * 4
    // 7 à 20 ms réels, d'après la justification affichée.
    const facteurMin = cycleEcran / 0.02
    const facteurMax = cycleEcran / 0.007
    expect(
      annonce,
      `badge ×${annonce} pour un cycle d'écran de ${cycleEcran} s, soit un ralenti ` +
        `de ${facteurMin.toFixed(0)} à ${facteurMax.toFixed(0)}`,
    ).toBeGreaterThanOrEqual(facteurMin)
    expect(annonce).toBeLessThanOrEqual(facteurMax)
  })
})
