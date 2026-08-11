import { expect, test } from '@playwright/test'

/**
 * LES SILHOUETTES SONT-ELLES VRAIMENT POSÉES ?
 *
 * `poserSilhouette` a un repli : si le binaire manque, la scène garde sa
 * forme procédurale et continue — sans rien dire d'autre qu'un avertissement
 * dans la console. C'est le bon comportement, et c'est exactement pour ça
 * qu'il faut vérifier en vrai que le chargement A EU LIEU : un repli
 * silencieux ressemble à s'y méprendre à un succès.
 */
test.describe('les formes cristallographiques arrivent dans la page', () => {
  for (const [code, mecanisme] of [
    ['6ek0', 'Atelier'],
    ['4oo8', 'CRISPR-Cas9'],
  ] as const) {
    test(`la silhouette ${code} est chargée et servie`, async ({ page }) => {
      const recues: Array<{ url: string; statut: number }> = []
      page.on('response', (r) => {
        if (r.url().includes('/silhouettes/')) recues.push({ url: r.url(), statut: r.status() })
      })

      await page.goto('/cellule.html')
      await page.waitForFunction(() => (window as any).__celluleReady === true, null, {
        timeout: 30_000,
      })
      await page.getByRole('button', { name: mecanisme }).first().click()
      await page.waitForTimeout(2500)

      const attendue = recues.find((r) => r.url.endsWith(`${code}.bin`))
      expect(attendue, `aucune requête pour ${code}.bin`).toBeDefined()
      expect(attendue!.statut, `${code}.bin doit être servi`).toBe(200)
    })
  }
})
