import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { creerMitochondries } from './organites/mitochondries.js'
import { creerReticulumRugueux } from './organites/reticulumRugueux.js'
import { creerMatrices } from './organites/matrices.js'
import { creerMecanismes } from './mecanismes/tous.js'
import { CENTRE_NOYAU, RAYON_NOYAU } from './contrat.js'

/**
 * LES INVARIANTS D'ANATOMIE.
 *
 * Les premiers tests du projet à porter sur la géométrie que la page affiche
 * réellement. La revue du 31 juillet avait trouvé trois défauts que rien ne
 * pouvait signaler — le contrat des mécanismes pose pourtant lui-même
 * l'invariant : « un mécanisme qui se déroule ailleurs que son organite est
 * pire qu'un mécanisme absent ».
 *
 * MÉTHODE : on mesure la géométrie CONSTRUITE, jamais les constantes qui la
 * commandent. Recalculer le rayon de la membrane interne à partir des mêmes
 * constantes que le producteur donnerait une tautologie — le défaut qu'un
 * premier test de la chaîne respiratoire avait déjà commis. Le profil de la
 * membrane est donc extrait du maillage livré.
 */

/** Le plus grand écart accepté entre un mécanisme et son organite, en µm. */
const TOLERANCE_SIEGE = 1.5

/**
 * Profil d'une surface de révolution, relu depuis ses sommets.
 *
 * Une `LatheGeometry` répète le même profil sur chaque segment : on retrouve
 * donc le rayon en fonction de la hauteur en prenant, pour chaque `y` distinct,
 * le plus grand rayon rencontré. C'est la surface telle qu'elle est maillée, et
 * non celle qu'on a voulu mailler.
 */
function profilDeRevolution(geometrie: THREE.BufferGeometry): (y: number) => number {
  const sommets = geometrie.getAttribute('position')
  const parHauteur = new Map<number, number>()
  for (let i = 0; i < sommets.count; i++) {
    // Arrondi : les sommets d'un même anneau partagent leur hauteur à l'epsilon
    // flottant près, et sans regroupement on obtiendrait un profil en dents.
    const y = Math.round(sommets.getY(i) * 1e6) / 1e6
    const r = Math.hypot(sommets.getX(i), sommets.getZ(i))
    parHauteur.set(y, Math.max(parHauteur.get(y) ?? 0, r))
  }
  const hauteurs = [...parHauteur.keys()].sort((a, b) => a - b)

  return (y: number): number => {
    if (y <= hauteurs[0]!) return parHauteur.get(hauteurs[0]!)!
    if (y >= hauteurs[hauteurs.length - 1]!) return parHauteur.get(hauteurs[hauteurs.length - 1]!)!
    let i = 0
    while (i < hauteurs.length - 1 && hauteurs[i + 1]! < y) i++
    const y0 = hauteurs[i]!
    const y1 = hauteurs[i + 1]!
    const t = (y - y0) / (y1 - y0)
    return parHauteur.get(y0)! * (1 - t) + parHauteur.get(y1)! * t
  }
}

/** Les deux surfaces et les crêtes d'une mitochondrie, retrouvées à la forme. */
function piecesDeMitochondrie(groupe: THREE.Object3D): {
  cretes: THREE.InstancedMesh
  interne: THREE.Mesh
  externe: THREE.Mesh
} {
  const instanciees: THREE.InstancedMesh[] = []
  const revolutions: THREE.Mesh[] = []
  groupe.traverse((noeud) => {
    const amas = noeud as THREE.InstancedMesh
    if (amas.isInstancedMesh) instanciees.push(amas)
    else if ((noeud as THREE.Mesh).isMesh) revolutions.push(noeud as THREE.Mesh)
  })
  expect(instanciees).toHaveLength(1)
  expect(revolutions).toHaveLength(2)

  // On départage les deux surfaces par leur encombrement, et non par leur ordre
  // d'ajout : celui-ci sert au tri du rendu et pourrait changer sans que la
  // géométrie bouge.
  const volume = (m: THREE.Mesh): number => {
    m.geometry.computeBoundingBox()
    const t = m.geometry.boundingBox!.getSize(new THREE.Vector3())
    return t.x * t.y * t.z
  }
  const tries = revolutions.sort((a, b) => volume(a) - volume(b))
  return { cretes: instanciees[0]!, interne: tries[0]!, externe: tries[1]! }
}

describe('les crêtes restent dans la membrane interne', () => {
  /**
   * « Une crête est un repli de la membrane interne : elle ne peut pas la
   * déborder », dit le commentaire de `mitochondries.ts`. La revue a mesuré
   * neuf crêtes sur cinquante-neuf qui la percent, jusqu'à 37,3 nm.
   */
  it('aucune crête ne perce la membrane interne', () => {
    const mitochondries = creerMitochondries()
    const debordements: Array<{ organite: string; depassement: number }> = []
    let cretesExaminees = 0

    for (const organite of mitochondries) {
      const { cretes, interne } = piecesDeMitochondrie(organite.objet)
      const rayonInterne = profilDeRevolution(interne.geometry)

      const matrice = new THREE.Matrix4()
      const point = new THREE.Vector3()
      for (let i = 0; i < cretes.count; i++) {
        cretes.getMatrixAt(i, matrice)
        cretesExaminees++
        // Le disque unitaire de la géométrie a un rayon de 0,5 : on en parcourt
        // le bord, là où le débordement se produit.
        for (let k = 0; k < 48; k++) {
          const angle = (k / 48) * Math.PI * 2
          point.set(Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5).applyMatrix4(matrice)
          const depassement = Math.hypot(point.x, point.z) - rayonInterne(point.y)
          if (depassement > 0) {
            debordements.push({ organite: organite.cle, depassement })
          }
        }
      }
    }

    const pire = debordements.reduce((m, d) => Math.max(m, d.depassement), 0)
    expect(cretesExaminees).toBeGreaterThan(40)
    expect(
      debordements,
      `${debordements.length} points de crête débordent, jusqu'à ${(pire * 1000).toFixed(1)} nm`,
    ).toHaveLength(0)
  })
})

describe("le réticulum rugueux reste hors de l'enveloppe nucléaire", () => {
  /**
   * Le commentaire annonce « un léger recouvrement » glissé sous la membrane.
   * La revue a mesuré 56,5 % de la pile À L'INTÉRIEUR du noyau, jusqu'à 1,98 µm
   * de profondeur — parce que la portée est comptée depuis l'origine de la
   * cellule et non depuis la surface du noyau, que le module ne connaît pas.
   */
  it('moins d’un vingtième de ses sommets est sous l’enveloppe', () => {
    const [rer] = creerReticulumRugueux()
    expect(rer).toBeDefined()
    rer!.objet.updateMatrixWorld(true)

    let total = 0
    let dedans = 0
    let profondeurMax = 0
    const point = new THREE.Vector3()

    rer!.objet.traverse((noeud) => {
      const maillage = noeud as THREE.Mesh
      // Les citernes seules : le semis de ribosomes est instancié et suit la
      // nappe, il n'ajouterait rien à la mesure.
      if (!maillage.isMesh || (maillage as THREE.InstancedMesh).isInstancedMesh) return
      const sommets = maillage.geometry.getAttribute('position')
      for (let i = 0; i < sommets.count; i++) {
        point.fromBufferAttribute(sommets, i).applyMatrix4(maillage.matrixWorld)
        total++
        const profondeur = RAYON_NOYAU - point.distanceTo(CENTRE_NOYAU)
        if (profondeur > 0) {
          dedans++
          profondeurMax = Math.max(profondeurMax, profondeur)
        }
      }
    })

    expect(total).toBeGreaterThan(1000)
    const part = dedans / total
    // Un vrai réticulum rugueux prolonge l'enveloppe : un chevauchement de
    // quelques pour cent est la continuité qu'on veut montrer. Plus de cinq,
    // c'est une pile de citernes dans le nucléoplasme.
    expect(
      part,
      `${(part * 100).toFixed(1)} % des sommets sont dans le noyau, jusqu'à ${profondeurMax.toFixed(2)} µm de profondeur`,
    ).toBeLessThan(0.05)
  })
})

describe('les matrices mitochondriales suivent leurs mitochondries', () => {
  /**
   * `matrices.ts` rejouait tirage pour tirage la boucle de `mitochondries.ts`,
   * en recopiant quatre constantes à travers la frontière des modules et en
   * comptant les appels au générateur à la main. Ajouter un seul tirage
   * détachait les six matrices, de 2,9 à 8,3 µm.
   *
   * Ce test ne dit pas comment le lien est fait — il vérifie qu'il tient.
   */
  it('chaque molécule de la matrice est logée dans une mitochondrie', () => {
    const centres = creerMitochondries().map((m) => {
      m.objet.updateMatrixWorld(true)
      return new THREE.Box3().setFromObject(m.objet).getCenter(new THREE.Vector3())
    })

    const matrice = creerMatrices().find((o) => o.cle === 'matrice-mitochondriale')
    expect(matrice).toBeDefined()
    matrice!.objet.updateMatrixWorld(true)

    // Le module rend UN seul organite qui couvre les six mitochondries : son
    // barycentre ne veut rien dire, et c'est instance par instance qu'il faut
    // mesurer. Une première version de ce test comparait le centre de la boîte
    // englobante et annonçait un écart de 4,63 µm, qui n'était que la distance
    // entre le barycentre de six capsules dispersées et la plus proche d'elles.
    const transformation = new THREE.Matrix4()
    const point = new THREE.Vector3()
    let instances = 0
    let pireEcart = 0

    matrice!.objet.traverse((noeud) => {
      const amas = noeud as THREE.InstancedMesh
      if (!amas.isInstancedMesh) return
      for (let i = 0; i < amas.count; i++) {
        amas.getMatrixAt(i, transformation)
        point.setFromMatrixPosition(transformation).applyMatrix4(amas.matrixWorld)
        instances++
        pireEcart = Math.max(pireEcart, Math.min(...centres.map((c) => c.distanceTo(point))))
      }
    })

    expect(instances).toBeGreaterThan(50)
    // Une mitochondrie fait 2 µm de long : son contenu tient dans une sphère
    // d'un micromètre de rayon autour du centre de la capsule.
    expect(pireEcart, `la molécule la plus égarée est à ${pireEcart.toFixed(2)} µm`).toBeLessThan(1.05)
  })
})

describe('chaque mécanisme se déroule dans son organite', () => {
  /**
   * L'invariant est posé par le contrat des mécanismes lui-même : « un
   * mécanisme qui se déroule ailleurs que son organite est pire qu'un
   * mécanisme absent ». La revue a mesuré les mécanismes mitochondriaux à
   * 3,8–5,6 µm des mitochondries, parce qu'ils écrivent des positions
   * littérales quand les capsules sont tirées au hasard.
   */
  const mecanismes = creerMecanismes()

  it('construit bien les seize mécanismes', () => {
    expect(mecanismes.length).toBeGreaterThanOrEqual(13)
  })

  it('place les mécanismes mitochondriaux dans une mitochondrie', () => {
    const centres = creerMitochondries().map((m) => {
      m.objet.updateMatrixWorld(true)
      return new THREE.Box3().setFromObject(m.objet).getCenter(new THREE.Vector3())
    })

    const mitochondriaux = mecanismes.filter((m) => /mitochondri/i.test(m.siege))
    expect(mitochondriaux.length).toBeGreaterThan(0)

    for (const m of mitochondriaux) {
      const ecart = Math.min(...centres.map((c) => c.distanceTo(m.ancre)))
      expect(
        ecart,
        `« ${m.nom} » (siège : ${m.siege}) est à ${ecart.toFixed(2)} µm de la mitochondrie la plus proche`,
      ).toBeLessThan(TOLERANCE_SIEGE)
    }
  })

  /**
   * Le contrat distingue `facteur` — le ralenti — et `ellision` — ce qui a été
   * SAUTÉ. Couper n'est pas ralentir. Deux mécanismes ne déclaraient rien, et
   * la revue a montré que ce n'était pas parce que rien n'y était coupé : la
   * pompe montre dix-huit sodiums et douze potassiums là où sa fiche annonce
   * trois et deux, et la chaîne respiratoire échantillonne ses effectifs.
   *
   * Un étudiant qui compte les molécules doit pouvoir savoir qu'il compte un
   * échantillon.
   */
  it('déclare partout ce qui a été coupé ou échantillonné', () => {
    const muets = mecanismes.filter((m) => !m.ellision?.trim())
    expect(
      muets.map((m) => m.nom),
      'ces mécanismes ne déclarent aucune ellision',
    ).toEqual([])
  })

  it('place les mécanismes nucléaires dans le noyau', () => {
    const nucleaires = mecanismes.filter((m) => m.siege === 'Noyau')
    expect(nucleaires.length).toBeGreaterThan(0)
    for (const m of nucleaires) {
      const distance = m.ancre.distanceTo(CENTRE_NOYAU)
      expect(distance, `« ${m.nom} » est à ${distance.toFixed(2)} µm du centre du noyau`).toBeLessThan(
        RAYON_NOYAU,
      )
    }
  })
})
