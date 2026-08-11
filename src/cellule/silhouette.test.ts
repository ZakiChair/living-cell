import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { creerAmasSilhouette, type Silhouette } from './silhouette.js'

/** Lit un binaire de silhouette depuis le disque, comme le navigateur le ferait. */
async function lire(code: string): Promise<Silhouette> {
  const tampon = await readFile(new URL(`../../assets/silhouettes/${code}.bin`, import.meta.url))
  const points = new Float32Array(
    tampon.buffer.slice(tampon.byteOffset, tampon.byteOffset + tampon.byteLength),
  )
  return { points, nombreAtomes: points.length / 3 }
}

describe('les silhouettes cristallographiques livrées', () => {
  it('le ribosome humain porte ses onze mille sept cents carbones α', async () => {
    const ribosome = await lire('6ek0')
    expect(ribosome.nombreAtomes).toBeGreaterThan(11_000)
    expect(ribosome.nombreAtomes).toBeLessThan(12_000)
  })

  it('sont centrées et normalisées : tout tient dans la sphère unité', async () => {
    for (const code of ['6ek0', '2zxe', '1ffk', '4v6x']) {
      const s = await lire(code)
      let rayonMax = 0
      let cx = 0
      let cy = 0
      let cz = 0
      for (let i = 0; i < s.nombreAtomes; i++) {
        const x = s.points[i * 3]!
        const y = s.points[i * 3 + 1]!
        const z = s.points[i * 3 + 2]!
        expect(Number.isFinite(x + y + z), code).toBe(true)
        rayonMax = Math.max(rayonMax, Math.hypot(x, y, z))
        cx += x
        cy += y
        cz += z
      }
      // Rayon maximal exactement 1 : c'est la définition de `centrerEtNormaliser`.
      expect(rayonMax, `${code} rayon`).toBeGreaterThan(0.999)
      expect(rayonMax, `${code} rayon`).toBeLessThan(1.001)
      // Centre de masse à l'origine.
      expect(Math.abs(cx / s.nombreAtomes), `${code} centre x`).toBeLessThan(0.01)
      expect(Math.abs(cy / s.nombreAtomes), `${code} centre y`).toBeLessThan(0.01)
      expect(Math.abs(cz / s.nombreAtomes), `${code} centre z`).toBeLessThan(0.01)
    }
  })

  it('la sous-unité 50S est nettement plus petite que le ribosome entier', async () => {
    const cinquante = await lire('1ffk')
    const entier = await lire('6ek0')
    expect(cinquante.nombreAtomes).toBeLessThan(0.5 * entier.nombreAtomes)
  })
})

describe("l'amas d'instances d'une silhouette", () => {
  it('pose une instance par carbone α retenu, à l’échelle demandée', async () => {
    const ribosome = await lire('6ek0')
    const materiau = new THREE.MeshLambertMaterial()
    const amas = creerAmasSilhouette(ribosome, { rayon: 0.0125, materiau })
    expect(amas.count).toBe(ribosome.nombreAtomes)

    const matrice = new THREE.Matrix4()
    const position = new THREE.Vector3()
    let rayonMax = 0
    for (let i = 0; i < amas.count; i++) {
      amas.getMatrixAt(i, matrice)
      rayonMax = Math.max(rayonMax, position.setFromMatrixPosition(matrice).length())
    }
    // Le ribosome fait 25 nm de large : la silhouette doit tenir dans son rayon.
    expect(rayonMax).toBeGreaterThan(0.0124)
    expect(rayonMax).toBeLessThan(0.0126)
  })

  it('le pas divise le coût sans déplacer la molécule', async () => {
    const ribosome = await lire('6ek0')
    const materiau = new THREE.MeshLambertMaterial()
    const complet = creerAmasSilhouette(ribosome, { rayon: 0.0125, materiau })
    const allege = creerAmasSilhouette(ribosome, { rayon: 0.0125, materiau, pas: 3 })
    expect(allege.count).toBeCloseTo(complet.count / 3, -2)

    // Et les billes GROSSISSENT pour que la surface reste fermée : c'est ce
    // qui distingue un allègement d'une dégradation.
    const matrice = new THREE.Matrix4()
    const echelle = new THREE.Vector3()
    complet.getMatrixAt(0, matrice)
    matrice.decompose(new THREE.Vector3(), new THREE.Quaternion(), echelle)
    const tailleComplete = echelle.x
    allege.getMatrixAt(0, matrice)
    matrice.decompose(new THREE.Vector3(), new THREE.Quaternion(), echelle)
    expect(echelle.x).toBeGreaterThan(tailleComplete)
    expect(echelle.x).toBeLessThan(2 * tailleComplete)
  })

  it('un seul appel de dessin, quelle que soit la taille de la molécule', async () => {
    const ribosome = await lire('6ek0')
    const amas = creerAmasSilhouette(ribosome, {
      rayon: 0.0125,
      materiau: new THREE.MeshLambertMaterial(),
    })
    expect(amas.isInstancedMesh).toBe(true)
    // 20 triangles par bille : le budget que la scène doit assumer.
    const triangles = amas.count * 20
    expect(triangles).toBeLessThan(300_000)
  })
})
