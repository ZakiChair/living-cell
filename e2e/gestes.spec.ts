import { expect, test, type Page } from '@playwright/test'

/**
 * LES DEUX GESTES QUE LE SITE PROMET.
 *
 * Ils ont été cassés une fois, trouvés à la main, réparés — et rien ne les
 * surveillait depuis. Ces tests sont ce filet-là.
 */

/** La cellule est assemblée quand elle le dit elle-même. */
async function attendreLaCellule(page: Page): Promise<void> {
  await page.goto('/cellule.html')
  await page.waitForFunction(() => (window as any).__celluleReady === true, null, {
    timeout: 30_000,
  })
  // Une image de plus : `__celluleReady` est posé avant le premier rendu.
  await page.waitForTimeout(600)
}

/**
 * Ce que la scène occupe à l'écran : la fraction de pixels qui diffèrent du
 * fond, et leur barycentre. C'est la seule mesure qui dise si un mécanisme
 * est VISIBLE — un test unitaire n'a pas de caméra.
 */
async function empreinte(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ couverture: number; cx: number; cy: number }>((resolve) => {
        const canvas = [...document.querySelectorAll('canvas')].find(
          (c) => c.width > 600,
        ) as HTMLCanvasElement
        const gl = canvas.getContext('webgl2') as WebGL2RenderingContext
        requestAnimationFrame(() => {
          const px = new Uint8Array(canvas.width * canvas.height * 4)
          gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px)
          const fond = [px[0]!, px[1]!, px[2]!]
          let n = 0
          let total = 0
          let sx = 0
          let sy = 0
          for (let y = 0; y < canvas.height; y += 4) {
            for (let x = 0; x < canvas.width; x += 4) {
              const i = (y * canvas.width + x) * 4
              total++
              const ecart =
                Math.abs(px[i]! - fond[0]!) +
                Math.abs(px[i + 1]! - fond[1]!) +
                Math.abs(px[i + 2]! - fond[2]!)
              if (ecart > 24) {
                n++
                sx += x
                sy += y
              }
            }
          }
          resolve({
            couverture: n / total,
            cx: n ? sx / n / canvas.width : 0.5,
            cy: n ? sy / n / canvas.height : 0.5,
          })
        })
      }),
  )
}

test.describe('la page tient debout', () => {
  test('la cellule s’assemble sans une seule erreur de console', async ({ page }) => {
    const erreurs: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') erreurs.push(m.text())
    })
    page.on('pageerror', (e) => erreurs.push(String(e)))
    await attendreLaCellule(page)
    expect(erreurs, erreurs.join('\n')).toEqual([])
  })

  test('les vingt-sept mécanismes sont au panneau', async ({ page }) => {
    await attendreLaCellule(page)
    const boutons = page.locator('#flux button')
    await expect(boutons).toHaveCount(27)
  })
})

/**
 * PREMIER GESTE : cliquer un mécanisme doit le MONTRER.
 *
 * Le défaut de juillet : l'ancre était convertie en coordonnées monde une
 * seule fois, alors que la scène tourne — le mécanisme sortait du cadre en
 * trois dixièmes de seconde, avant même que la caméra ait fini d'arriver.
 * Un test qui regarde trop tôt ne voit rien : celui-ci regarde tard, et
 * deux fois.
 */
test.describe('premier geste : cliquer un mécanisme l’amène, et l’y garde', () => {
  // Fragments SANS apostrophe : le panneau les écrit droites, un test qui
  // les cherche courbes ne trouve rien — et se plaint d'un défaut inexistant.
  for (const nom of ['Cycle de Krebs', 'calcium, SNARE', 'CRISPR-Cas9']) {
    test(`« ${nom} » reste dans le cadre après cinq secondes`, async ({ page }) => {
      await attendreLaCellule(page)
      await page.locator('#flux button', { hasText: nom }).first().click()

      await page.waitForTimeout(3000)
      const arrivee = await empreinte(page)
      expect(arrivee.couverture, 'le mécanisme doit occuper le cadre').toBeGreaterThan(0.01)

      // Cinq secondes de plus : c'est là que le défaut de juillet frappait.
      await page.waitForTimeout(5000)
      const apres = await empreinte(page)
      expect(apres.couverture, 'la scène ne doit pas se vider').toBeGreaterThan(0.01)
      // Le barycentre reste dans la partie utile de la fenêtre : ni sous le
      // panneau de gauche, ni hors champ.
      expect(apres.cx).toBeGreaterThan(0.2)
      expect(apres.cx).toBeLessThan(0.95)
      expect(apres.cy).toBeGreaterThan(0.05)
      expect(apres.cy).toBeLessThan(0.95)
    })
  }
})

/**
 * SECOND GESTE : donner le brin au ribosome.
 *
 * C'est le cœur pédagogique du site — « il n'ira nulle part tout seul :
 * c'est vous qui le donnez au ribosome, et rien ne se traduit avant ». La
 * page publie les positions écran du brin et du ribosome précisément pour
 * qu'un test puisse faire ce geste sans viser au jugé.
 */
test.describe('second geste : donner le brin au ribosome', () => {
  test('rien ne se traduit tant que le brin n’a pas été déposé', async ({ page }) => {
    await attendreLaCellule(page)
    await page.getByRole('button', { name: /Atelier/ }).first().click()
    await page.waitForTimeout(1500)

    // On ouvre le gène et on laisse la transcription se faire.
    await page.getByRole('button', { name: /Ouvrir le gène/ }).click()
    await page.waitForTimeout(6000)

    const avant = await page.evaluate(() => (window as any).__atelier.etat())
    expect(avant.codons, 'aucun codon traduit avant le dépôt').toBe(0)
  })

  test('déposer le brin sur le ribosome démarre la traduction', async ({ page }) => {
    await attendreLaCellule(page)
    await page.getByRole('button', { name: /Atelier/ }).first().click()
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: /Ouvrir le gène/ }).click()

    // Attendre que le brin soit prêt à être donné : le bouton s'active.
    const donner = page.getByRole('button', { name: /Donner le brin/ })
    await expect(donner).toBeEnabled({ timeout: 30_000 })

    // Le geste, à la souris, aux coordonnées que la page publie.
    const cibles = await page.evaluate(() => {
      const a = (window as any).__atelier
      return { brin: a.ecranBrin(), ribosome: a.ecranRibosome() }
    })
    await page.mouse.move(cibles.brin.x, cibles.brin.y)
    await page.mouse.down()
    // Un trajet en plusieurs pas : un saut instantané ne déclenche pas les
    // mêmes événements qu'une main qui déplace.
    for (let n = 1; n <= 12; n++) {
      await page.mouse.move(
        cibles.brin.x + ((cibles.ribosome.x - cibles.brin.x) * n) / 12,
        cibles.brin.y + ((cibles.ribosome.y - cibles.brin.y) * n) / 12,
      )
      await page.waitForTimeout(30)
    }
    await page.mouse.up()

    // Le dépôt a-t-il été reconnu ? La page publie la distance et son seuil.
    const depot = await page.evaluate(() => (window as any).__atelier.distanceDepot())
    expect(depot.distance, `distance ${depot.distance} pour un seuil de ${depot.seuil}`).toBeLessThan(
      depot.seuil,
    )

    // Et la traduction démarre : des codons sont lus.
    await page.waitForTimeout(8000)
    const apres = await page.evaluate(() => (window as any).__atelier.etat())
    expect(apres.codons, 'la traduction doit avancer après le dépôt').toBeGreaterThan(0)
  })
})

/**
 * TROISIÈME PROMESSE : le laboratoire agit sur la cellule.
 *
 * Les leviers ne servent à rien si l'interface ne les branche pas. Celui-ci
 * est le plus contre-intuitif du site, donc le plus utile à surveiller.
 */
test.describe('le laboratoire agit vraiment', () => {
  test('la sulfonylurée fait sécréter une cellule à jeun', async ({ page }) => {
    await attendreLaCellule(page)
    await page.getByRole('button', { name: 'Laboratoire' }).click()
    const bouton = page.getByRole('button', { name: /Sulfonylurée/ })
    await expect(bouton).toBeVisible()

    const lire = () =>
      page.evaluate(() => {
        const dd = [...document.querySelectorAll('.laboratoire-mesures dt')]
        const i = dd.findIndex((d) => d.textContent?.includes('Insuline sécrétée'))
        const valeurs = [...document.querySelectorAll('.laboratoire-mesures dd')]
        return Number(valeurs[i]?.textContent ?? '0')
      })

    const avant = await lire()
    await bouton.click()
    await page.waitForTimeout(6000)
    const apres = await lire()
    expect(apres, `insuline ${avant} → ${apres}`).toBeGreaterThan(avant)
  })
})

/**
 * LE PIÈGE DU BLOC CONTENEUR.
 *
 * #reglages porte un « transform » et un « backdrop-filter » : l'un comme
 * l'autre créent un bloc conteneur qui CAPTURE les descendants en
 * « position: fixed ». Un panneau posé là se croit ancré au viewport et se
 * retrouve ancré à la barre du bas — il démarre à mi-écran et déborde. Le
 * laboratoire en a souffert des semaines sans que rien ne le dise ; ses
 * derniers leviers étaient hors d'atteinte.
 */
test.describe('les panneaux flottants sont ancrés à la fenêtre', () => {
  for (const [nom, declencheur, panneau] of [
    ['laboratoire', 'Laboratoire', '#laboratoire-cellulaire'],
    ['frise des horloges', 'Horloges', '#frise-horloges'],
  ] as const) {
    test(`le panneau « ${nom} » tient dans la fenêtre`, async ({ page }) => {
      await attendreLaCellule(page)
      await page.getByRole('button', { name: declencheur, exact: true }).click()
      const boite = await page.locator(panneau).boundingBox()
      expect(boite, 'le panneau doit être visible').not.toBeNull()
      const hauteurFenetre = page.viewportSize()!.height
      // Il commence en haut, et ne déborde pas par le bas.
      expect(boite!.y).toBeLessThan(hauteurFenetre * 0.25)
      expect(boite!.y + boite!.height).toBeLessThanOrEqual(hauteurFenetre + 1)
    })
  }
})
