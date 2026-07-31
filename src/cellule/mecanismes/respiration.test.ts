import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  ATP_PAR_SECONDE,
  ATP_PAR_TOUR,
  DUREE_TOUR,
  NB_ATP,
  TOURS_PAR_SECONDE_REELS,
  VITESSE_ATP,
  creerRespiration,
} from './respiration.js'

/**
 * LE TEST QUE LA SPEC EXIGEAIT DEPUIS LE DÉBUT.
 *
 * Critère D3 : « un test échoue si le badge diverge de ce que l'animation fait
 * réellement ». Ce test n'avait jamais été écrit, et c'est exactement par là que
 * deux défauts sont passés — la chaîne respiratoire fabriquait 9,4 ATP par tour
 * là où sa fiche en annonçait 3, et la bêta-oxydation affichait un accéléré pour
 * un ralenti.
 *
 * Le principe est de ne comparer que des grandeurs que le CODE produit à des
 * affirmations que l'utilisateur LIT. Un test qui relirait les mêmes constantes
 * des deux côtés ne prouverait rien.
 *
 * `creerRespiration()` ne construit que de la géométrie et des matériaux : rien
 * n'y demande de contexte graphique, et il tourne donc sous vitest.
 */
describe('la chaîne respiratoire : le badge contre ce que le code fait', () => {
  const [mecanisme] = creerRespiration()

  it('existe et porte un badge', () => {
    expect(mecanisme).toBeDefined()
    expect(mecanisme!.facteur).toBeTruthy()
  })

  /**
   * LE CŒUR DU TEST : on COMPTE ce qu'`animer` fabrique.
   *
   * Une première version de ce test multipliait le nombre de molécules par leur
   * vitesse de cycle. C'était une TAUTOLOGIE — la vitesse est définie comme le
   * débit divisé par l'effectif, si bien que le produit valait le débit quoi
   * qu'il arrive, et le test ne pouvait pas échouer. C'est le même défaut que
   * `version.test.ts`, qui compare une constante à elle-même.
   *
   * On fait donc tourner l'animation sur trente secondes d'écran et on compte
   * les naissances dans les matrices d'instances : une molécule naît quand son
   * échelle retombe brusquement, à la reprise de son cycle. Le seul lien avec
   * la stœchiométrie est alors le comportement.
   *
   * Les anciennes valeurs — vingt-six molécules à 0,24 cycle par seconde —
   * produisaient 9,4 ATP par tour au lieu de 3. Ce test les refuse.
   */
  it("fabrique exactement trois ATP par tour, mesuré sur l'animation", () => {
    const amas = mecanisme!.objet.getObjectByName('atp') as THREE.InstancedMesh
    expect(amas, "l'amas d'ATP doit être nommé pour être mesurable").toBeDefined()
    expect(amas.isInstancedMesh).toBe(true)

    const matrice = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const echelle = new THREE.Vector3()

    const echelleDe = (i: number): number => {
      amas.getMatrixAt(i, matrice)
      matrice.decompose(position, rotation, echelle)
      return echelle.x
    }

    const DUREE_MESURE = 30
    const PAS = 1 / 60
    mecanisme!.animer(0)
    const precedentes = Array.from({ length: amas.count }, (_, i) => echelleDe(i))

    let naissances = 0
    for (let n = 1; n <= DUREE_MESURE / PAS; n++) {
      mecanisme!.animer(n * PAS)
      for (let i = 0; i < amas.count; i++) {
        const courante = echelleDe(i)
        // Une chute franche : la molécule précédente a disparu, une neuve part
        // de zéro. C'est la reprise du cycle, donc une naissance.
        if (precedentes[i]! - courante > 0.3) naissances++
        precedentes[i] = courante
      }
    }

    const tours = DUREE_MESURE / DUREE_TOUR
    const parTour = naissances / tours
    // À un demi-ATP près : la fenêtre de mesure ne tombe pas sur un nombre
    // entier de cycles pour chacune des molécules.
    expect(parTour).toBeGreaterThan(ATP_PAR_TOUR - 0.5)
    expect(parTour).toBeLessThan(ATP_PAR_TOUR + 0.5)
    expect(ATP_PAR_TOUR).toBe(3)
  })

  it("garde ses constantes cohérentes entre elles", () => {
    // Complément du test précédent, et non son remplaçant : celui-ci ne prouve
    // rien sur l'animation, il vérifie seulement que la table est cohérente.
    expect(NB_ATP * VITESSE_ATP).toBeCloseTo(ATP_PAR_SECONDE, 12)
  })

  it("dit dans sa fiche ce que ce débit vaut, mot pour mot", () => {
    // La fiche affirme « un ATP par tiers de tour ». Trois par tour, donc.
    expect(mecanisme!.description).toContain('un ATP par tiers de tour')
    expect(3).toBe(ATP_PAR_TOUR)
  })

  /**
   * Le badge annonce un ralenti ×200. La seule façon de le vérifier est de
   * confronter la durée d'un tour À L'ÉCRAN à la durée d'un tour DANS LA
   * CELLULE : leur rapport est le facteur, et il ne peut pas être écrit ailleurs.
   */
  it('annonce le ralenti que la durée du tour impose', () => {
    const dureeReelle = 1 / TOURS_PAR_SECONDE_REELS
    const facteurReel = DUREE_TOUR / dureeReelle
    expect(facteurReel).toBeCloseTo(195, 0)

    const annonce = Number(mecanisme!.facteur.replace(/[^\d]/g, ''))
    expect(mecanisme!.facteur).toMatch(/^ralenti/)
    // À 3 % près : le badge arrondit, il ne doit pas se tromper d'ordre.
    expect(Math.abs(annonce - facteurReel) / facteurReel).toBeLessThan(0.03)
  })

  it('justifie son badge avec les mêmes chiffres', () => {
    expect(mecanisme!.justificationFacteur).toContain('130 tours par seconde')
    expect(TOURS_PAR_SECONDE_REELS).toBe(130)
    expect(mecanisme!.justificationFacteur).toContain('1,5 s')
    expect(DUREE_TOUR).toBe(1.5)
  })

  /**
   * Le champ `ellision` manquait, et ce n'était pas parce que rien n'était
   * coupé — c'était l'inverse. Les effectifs sont échantillonnés, et le taire
   * laissait un étudiant qui compte les molécules conclure faux.
   */
  it('déclare que ses effectifs sont échantillonnés', () => {
    expect(mecanisme!.ellision).toBeTruthy()
    expect(mecanisme!.ellision).toContain('échantillonn')
  })

  it('reste au siège que sa fiche annonce', () => {
    expect(mecanisme!.siege).toBe('Mitochondrie')
    expect(mecanisme!.objet.children.length).toBeGreaterThan(0)
  })
})
