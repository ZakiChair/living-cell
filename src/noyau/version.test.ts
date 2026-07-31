import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { VERSION_TROIS } from './version.js'

/**
 * LE GARDE-FOU DE VERSION, QUI EN EST ENFIN UN.
 *
 * Il comparait `VERSION_TROIS` à la chaîne `'0.185.1'` — une constante définie à
 * un seul endroit, confrontée à sa propre valeur recopiée. Il ne pouvait
 * échouer que si quelqu'un modifiait les deux lignes de façon incohérente,
 * c'est-à-dire jamais, et il ne lisait ni `package.json` ni `THREE.REVISION`.
 *
 * C'est le même défaut qu'un premier test de la chaîne respiratoire, écrit puis
 * réécrit dans la même séance : un test qui relit la valeur dont il dérive ne
 * prouve rien. Celui-ci confronte la constante à deux sources qu'elle ne
 * contrôle pas — la dépendance épinglée, et la bibliothèque réellement chargée.
 */
describe('garde-fou de version', () => {
  const paquet = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
  ) as { dependencies: Record<string, string>; devDependencies: Record<string, string> }

  it('épingle la même version que la dépendance déclarée', () => {
    // À l'exact, sans accent circonflexe ni tilde : les chiffres du lot 0 ont
    // été mesurés sur cette version-là et sur aucune autre.
    expect(paquet.dependencies.three).toBe(VERSION_TROIS)
  })

  it('correspond à la révision que Three.js déclare de lui-même', () => {
    // `THREE.REVISION` vaut « 185 » pour la 0.185.x : c'est la bibliothèque
    // chargée qui répond, pas un fichier de configuration.
    expect(THREE.REVISION).toBe(VERSION_TROIS.split('.')[1])
  })

  it('garde les types alignés sur la bibliothèque', () => {
    // Des types en avance sur la bibliothèque compilent et cassent à l'exécution.
    expect(paquet.devDependencies['@types/three']).toBe(VERSION_TROIS)
  })
})
