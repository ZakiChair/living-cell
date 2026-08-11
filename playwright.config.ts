import { defineConfig, devices } from '@playwright/test'

/**
 * Les tests de bout en bout : ce que les 300 tests unitaires ne peuvent pas dire.
 *
 * Le site promet deux GESTES — cliquer un mécanisme pour que la caméra
 * l'amène, et donner le brin d'ARN au ribosome pour que la traduction
 * démarre. Ces deux gestes étaient CASSÉS en juillet, et rien ne l'avait dit :
 * ils ont été trouvés à la main, en regardant. Un test unitaire ne peut pas
 * les voir — il n'a ni caméra, ni souris, ni horloge de rendu.
 *
 * Le port est distinct de celui du développement pour qu'une session ouverte
 * ne fausse pas la mesure ; `reuseExistingServer` reste faux pour la même
 * raison.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    /**
     * FENÊTRE RÉELLE, ET C'EST UNE NÉCESSITÉ, PAS UN CONFORT.
     *
     * En mode headless, Chromium rend en logiciel (SwiftShader) : assembler
     * les 372 000 instances de la cellule y prend si longtemps que le fil
     * principal ne traite même plus l'événement « load » — la page ne
     * finit jamais de charger. Un site dont le sujet EST le rendu ne peut
     * pas se tester sans rendu.
     */
    headless: false,
    launchOptions: { args: ['--use-angle=metal'] },
    // La cellule est une scène WebGL : sans fenêtre assez large, les
    // panneaux la recouvrent et toute mesure de cadrage ment.
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174/cellule.html',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
