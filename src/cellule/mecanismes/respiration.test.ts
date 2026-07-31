import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ATP_PAR_TOUR, TOURS_PAR_SECONDE_REELS } from './respiration.js'
import { creerMecanismes } from './tous.js'

/**
 * LE TEST QUE LA SPEC EXIGEAIT, ET QU'IL A FALLU ÉCRIRE TROIS FOIS.
 *
 * Critère D3 : « un test échoue si le badge diverge de ce que l'animation fait
 * réellement ». C'est par son absence que deux défauts sont passés — la chaîne
 * respiratoire fabriquait 9,4 ATP par tour là où sa fiche en annonce 3, et la
 * bêta-oxydation affichait un accéléré pour un ralenti.
 *
 * PREMIÈRE VERSION : multipliait l'effectif par la vitesse de cycle. Tautologie,
 * la vitesse étant définie comme le quotient.
 *
 * DEUXIÈME VERSION : comptait les naissances dans les matrices d'instances —
 * un vrai numérateur — mais divisait par `DUREE_TOUR`, une constante IMPORTÉE.
 * Le dénominateur restait postulé, si bien qu'un rotor mis à quatre secondes par
 * tour laissait le test vert pendant que le badge continuait d'annoncer 1,5 s.
 *
 * CELLE-CI mesure les deux : le débit dans les matrices, la période dans la
 * rotation du rotor. Aucune durée n'est relue. Et elle porte sur le mécanisme
 * LIVRÉ, badge posé, tel que la page l'affiche.
 */
describe('la chaîne respiratoire : le badge contre ce que le code fait', () => {
  const mecanisme = creerMecanismes().find((m) => m.cle === 'respiration')!

  it('est bien livré par la page, avec un badge', () => {
    expect(mecanisme, 'aucun mécanisme « respiration » dans ce que la page pose').toBeDefined()
    expect(mecanisme.facteur).toBeTruthy()
  })

  /** Fait tourner l'animation et rend le débit d'ATP et la période du rotor. */
  function mesurer(): { atpParSeconde: number; secondesParTour: number } {
    const amas = mecanisme.objet.getObjectByName('atp') as THREE.InstancedMesh
    const rotor = mecanisme.objet.getObjectByName('rotor')!
    expect(amas?.isInstancedMesh, "l'amas d'ATP doit être nommé pour être mesurable").toBe(true)
    expect(rotor, 'le rotor doit être nommé pour que sa période soit mesurable').toBeDefined()

    const matrice = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const echelle = new THREE.Vector3()
    const echelleDe = (i: number): number => {
      amas.getMatrixAt(i, matrice)
      matrice.decompose(position, rotation, echelle)
      return echelle.x
    }

    const DUREE = 30
    const PAS = 1 / 60
    mecanisme.animer(0)
    const precedentes = Array.from({ length: amas.count }, (_, i) => echelleDe(i))

    // La rotation est cumulative et non bornée à 2π : on la lit au début et à la
    // fin, et la période s'en déduit sans jamais consulter de constante.
    const angleDebut = rotor.rotation.y
    let naissances = 0
    for (let n = 1; n <= DUREE / PAS; n++) {
      mecanisme.animer(n * PAS)
      for (let i = 0; i < amas.count; i++) {
        const courante = echelleDe(i)
        // Une chute franche : la molécule précédente a disparu, une neuve part
        // de zéro. C'est la reprise du cycle, donc une naissance.
        if (precedentes[i]! - courante > 0.3) naissances++
        precedentes[i] = courante
      }
    }
    const tours = (rotor.rotation.y - angleDebut) / (Math.PI * 2)
    expect(tours, 'le rotor ne tourne pas : rien à mesurer').toBeGreaterThan(1)

    return { atpParSeconde: naissances / DUREE, secondesParTour: DUREE / tours }
  }

  /**
   * LE CŒUR DU TEST : deux grandeurs mesurées, aucune importée.
   *
   * Les anciennes valeurs — vingt-six molécules à 0,24 cycle par seconde —
   * donnaient 9,35 ATP par tour. Un rotor à quatre secondes par tour en donnerait
   * 8. Les deux échouent ici.
   */
  it('fabrique trois ATP par tour de rotor, mesuré des deux côtés', () => {
    const { atpParSeconde, secondesParTour } = mesurer()
    const parTour = atpParSeconde * secondesParTour
    expect(
      parTour,
      `mesuré ${parTour.toFixed(2)} ATP par tour (${atpParSeconde.toFixed(2)}/s, ` +
        `tour de ${secondesParTour.toFixed(2)} s) pour ${ATP_PAR_TOUR} annoncés`,
    ).toBeGreaterThan(ATP_PAR_TOUR - 0.4)
    expect(parTour).toBeLessThan(ATP_PAR_TOUR + 0.4)
  })

  /**
   * Le badge annonce un ralenti. Le seul moyen de le vérifier est de confronter
   * la période MESURÉE du rotor à sa période dans la cellule : leur rapport est
   * le facteur, et il ne peut être écrit nulle part.
   */
  it('annonce le ralenti que la période mesurée impose', () => {
    const { secondesParTour } = mesurer()
    const facteurReel = secondesParTour * TOURS_PAR_SECONDE_REELS
    expect(facteurReel).toBeCloseTo(195, 0)

    expect(mecanisme.facteur).toMatch(/^ralenti/)
    const annonce = Number(mecanisme.facteur.replace(/[^\d]/g, ''))
    // À 3 % près : le badge arrondit, il ne doit pas se tromper d'ordre.
    expect(
      Math.abs(annonce - facteurReel) / facteurReel,
      `badge « ${mecanisme.facteur} » pour un ralenti mesuré de ${facteurReel.toFixed(0)}`,
    ).toBeLessThan(0.03)
  })

  it('dit dans sa fiche le débit que le code produit', () => {
    expect(mecanisme.description).toContain('un ATP par tiers de tour')
    expect(ATP_PAR_TOUR).toBe(3)
    expect(mecanisme.justificationFacteur).toContain('130 tours par seconde')
    expect(TOURS_PAR_SECONDE_REELS).toBe(130)
  })

  /**
   * Le champ `ellision` manquait, et ce n'était pas parce que rien n'était
   * coupé — c'était l'inverse. Les effectifs sont échantillonnés, et le taire
   * laissait un étudiant qui compte les molécules conclure faux.
   */
  it('déclare que ses effectifs sont échantillonnés', () => {
    expect(mecanisme.ellision).toBeTruthy()
    expect(mecanisme.ellision).toContain('échantillonn')
  })

  it('reste au siège que sa fiche annonce', () => {
    expect(mecanisme.siege).toBe('Mitochondrie')
    expect(mecanisme.objet.children.length).toBeGreaterThan(0)
  })
})
