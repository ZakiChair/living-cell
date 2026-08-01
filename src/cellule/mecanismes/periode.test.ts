import { describe, expect, it } from 'vitest'
import { creerMecanismes } from './tous.js'
import { mesurerPeriode, porteurDuCycle } from './periode.js'

/**
 * LE BADGE CONTRE L'ANIMATION, POUR TOUT MÉCANISME QUI DÉSIGNE SON PORTEUR.
 *
 * Critère D3 : « un test échoue si le badge diverge de ce que l'animation fait
 * réellement ». Il a fallu quatre tentatives pour l'honorer autrement que sur un
 * ou deux mécanismes, et les trois premières ont échoué de la même façon —
 * elles finissaient par relire une constante d'animation au lieu de mesurer
 * l'animation.
 *
 * Ce qui marche : chaque mécanisme désigne l'objet qui porte son cycle et
 * déclare la durée de ce cycle DANS LA CELLULE. On mesure alors la période de
 * cet objet par autocorrélation de sa signature, et l'on vérifie que
 *
 *     période mesurée à l'écran ÷ durée réelle déclarée = ralentissement affiché
 *
 * Aucune constante d'animation n'entre dans ce calcul. Les deux seules
 * déclarations sont le NOM d'un objet et une durée de BIOLOGIE — c'est-à-dire
 * exactement ce qu'un relecteur peut contrôler, et rien qu'un développeur
 * puisse ajuster pour faire passer le test.
 */

/** Le ralentissement d'un mécanisme, premier temps si le badge en a deux. */
function ralentissementDe(m: { ralentissement: number | readonly number[] }): number {
  return Array.isArray(m.ralentissement)
    ? (m.ralentissement as readonly number[])[0]!
    : (m.ralentissement as number)
}

describe('le badge contre la période mesurée', () => {
  const mecanismes = creerMecanismes()
  const mesurables = mecanismes.filter((m) => m.observable)

  it('couvre une part substantielle des seize mécanismes', () => {
    expect(
      mesurables.length,
      `seuls ${mesurables.length} mécanismes désignent un porteur de cycle`,
    ).toBeGreaterThanOrEqual(8)
  })

  for (const m of mecanismes) {
    if (!m.observable) continue
    const { nom, cycleReel } = m.observable

    it(`${m.nom} — ${m.facteur}`, () => {
      const porteur = porteurDuCycle(m)
      expect(porteur, `« ${nom} » introuvable`).toBeDefined()

      // La fenêtre de recherche vient de la DÉCLARATION, pas de l'animation :
      // elle dit seulement où regarder. La valeur trouvée, elle, doit tomber
      // juste — doubler la vitesse d'animation la déplace et fait échouer.
      const attendue = cycleReel * ralentissementDe(m)
      // La fenêtre descend franchement sous l'attendu : c'est ce qui permet à une
      // animation devenue DEUX FOIS plus rapide d'être vue, plutôt que de tomber
      // sous la borne et de laisser le badge passer.
      const mesure = mesurerPeriode(m, attendue / 4, attendue * 2.5, porteur)

      expect(
        mesure.secondes,
        `« ${nom} » n'a pas de période franche autour de ${attendue.toFixed(2)} s ` +
          `(corrélation ${mesure.correlation.toFixed(2)})`,
      ).not.toBeNull()

      const ecart = Math.abs(mesure.secondes! - attendue) / attendue
      expect(
        ecart,
        `période mesurée ${mesure.secondes!.toFixed(2)} s pour ${attendue.toFixed(2)} s ` +
          `attendues — soit ${cycleReel} s réelles × ${ralentissementDe(m).toFixed(3)} ` +
          `annoncés par « ${m.facteur} »`,
      ).toBeLessThan(0.15)
    })
  }

  /**
   * Une durée de cycle est une donnée de biologie : elle doit être plausible.
   * Une déclaration à zéro, négative ou absurde ferait passer n'importe quoi.
   */
  it('déclare des durées de cycle plausibles', () => {
    for (const m of mesurables) {
      const { cycleReel } = m.observable!
      expect(cycleReel, `${m.cle} : cycle réel de ${cycleReel} s`).toBeGreaterThan(1e-6)
      expect(cycleReel, `${m.cle} : cycle réel de ${cycleReel} s`).toBeLessThan(86_400)
    }
  })

  /** Le porteur doit exister : sans lui le badge redevient invérifiable. */
  it('désigne un porteur qui existe vraiment dans chaque scène', () => {
    for (const m of mesurables) {
      expect(() => porteurDuCycle(m), `${m.cle} → « ${m.observable!.nom} »`).not.toThrow()
    }
  })

  /** Chaque choix de porteur est justifié : c'est ce qu'un relecteur relit. */
  it('explique pourquoi cet objet porte le cycle du badge', () => {
    const muets = mesurables.filter((m) => (m.observable!.pourquoi?.trim().length ?? 0) < 60)
    expect(muets.map((m) => m.cle), 'porteurs sans justification').toEqual([])
  })
})
