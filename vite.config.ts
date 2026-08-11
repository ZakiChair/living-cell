import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = fileURLToPath(new URL('.', import.meta.url))

// Chaque banc est une page autonome : on les déclare toutes en points d'entrée.
export default defineConfig({
  // Vitest ramasse « **/*.spec.ts » par défaut : sans cette exclusion il
  // tenterait d'exécuter les tests de bout en bout, qui importent Playwright
  // et pilotent un navigateur.
  test: { exclude: ['node_modules/**', 'dist/**', 'e2e/**'] },
  // Exposé sur le réseau local pour la mesure sur téléphone réel (tâche 10) :
  // l'émulation d'appareil du navigateur ne simule pas le GPU, donc elle ne
  // répond pas à la question posée.
  server: { host: true },
  build: {
    rollupOptions: {
      input: {
        cellule: resolve(racine, 'cellule.html'),
        sommaire: resolve(racine, 'index.html'),
        contour: resolve(racine, 'bancs/0a-contour.html'),
        dalle: resolve(racine, 'bancs/0b-dalle.html'),
      },
    },
  },
})
