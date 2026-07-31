import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = fileURLToPath(new URL('.', import.meta.url))

// Chaque banc est une page autonome : on les déclare toutes en points d'entrée.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        sommaire: resolve(racine, 'index.html'),
        contour: resolve(racine, 'bancs/0a-contour.html'),
        dalle: resolve(racine, 'bancs/0b-dalle.html'),
      },
    },
  },
})
