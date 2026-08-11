import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import type { MecanismeBrut } from './contrat.js'

/**
 * Le transit du Golgi : COPII, maturation des citernes, glycosylation, COPI.
 *
 * Deux idées reçues tombent ici. La première : les protéines ne « sautent »
 * pas de citerne en citerne — c'est la CITERNE ENTIÈRE qui mûrit et avance,
 * cargo dedans, pendant que ses enzymes sont renvoyées en arrière par des
 * vésicules COPI. La seconde : le Golgi n'est pas un tunnel passif — à chaque
 * étage, des glycosyltransférases différentes taillent et complètent les
 * sucres du cargo.
 *
 * Le cargo est la proinsuline venue du réticulum ; elle ressortira côté trans
 * dans un granule immature, que la scène voisine fait mûrir.
 */

const GRAINE = 0x474f4c47

/** Un transit complet à l'écran : 24 s pour ~20 min réelles. */
const PERIODE = 24
const CYCLE_REEL = 1200

const NB_CITERNES = 4
/** Espacement des citernes dans la pile : un quart de micromètre, comme l'organite. */
const PAS_PILE = 0.062
const NB_CARGO_PAR_CITERNE = 9
const NB_COPII = 3
const NB_COPI = 2

const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

export function creerTransitGolgi(): MecanismeBrut[] {
  const alea = creerAlea(GRAINE)
  const groupe = new THREE.Group()
  groupe.name = 'transit-golgi'
  // Contre la face cis du Golgi, du côté que l'écorché conserve.
  groupe.position.set(2.7, -1.9, -0.7)
  groupe.rotation.set(0.15, -0.5, 0.1)

  // ── Les citernes qui mûrissent ──────────────────────────────────────────
  // Cinq positions pour quatre citernes visibles : la position 0 est le site
  // de naissance (fusion des COPII), la dernière la dissolution en granule.
  // Chaque citerne est une calotte aplatie, comme l'organite voisin.
  const matCiterne = materiauOrganite(TEINTES.golgi, { opacite: 0.5 })
  const geoCiterne = new THREE.SphereGeometry(0.11, 20, 12)
  // APLATIE SUR X, l'axe de la pile — pas sur Y. Les citernes étaient des
  // disques couchés qu'on empilait de chant : elles s'interpénétraient et la
  // pile se lisait comme une seule galette. Un Golgi s'empile
  // perpendiculairement au plan de ses citernes, et c'est par là que le
  // cargo le traverse, de la face cis à la face trans.
  geoCiterne.scale(0.18, 1, 0.72)
  const citernes: THREE.Mesh[] = []
  for (let c = 0; c < NB_CITERNES; c++) {
    const citerne = new THREE.Mesh(geoCiterne, matCiterne)
    if (c === 0) citerne.name = 'citerne-en-maturation'
    citernes.push(citerne)
    groupe.add(citerne)
  }

  // ── Le cargo, et ses sucres ─────────────────────────────────────────────
  const cargo = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0045, 0),
    materiauOrganite(TEINTES.granuleInsuline, { doubleFace: false }),
    NB_CITERNES * NB_CARGO_PAR_CITERNE,
  )
  cargo.frustumCulled = false
  groupe.add(cargo)
  // Les antennes de sucres, posées à l'étage médian : la glycosylation se voit
  // comme un satellite vert sur chaque cargo qui la reçoit.
  const sucres = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.002, 0),
    materiauOrganite(TEINTES.reticulumLisse, { doubleFace: false }),
    NB_CITERNES * NB_CARGO_PAR_CITERNE,
  )
  sucres.frustumCulled = false
  groupe.add(sucres)
  const ecartsCargo = new Float32Array(NB_CITERNES * NB_CARGO_PAR_CITERNE * 3)
  for (let i = 0; i < ecartsCargo.length; i += 3) {
    ecartsCargo[i] = (alea() - 0.5) * 0.16
    ecartsCargo[i + 1] = (alea() - 0.5) * 0.014
    ecartsCargo[i + 2] = (alea() - 0.5) * 0.1
  }

  // ── Vésicules COPII (aller) et COPI (retour) ────────────────────────────
  const copii = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.03, 0),
    materiauOrganite(TEINTES.reticulumRugueux, { opacite: 0.85 }),
    NB_COPII,
  )
  const copi = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.024, 0),
    materiauOrganite(TEINTES.vesicule, { opacite: 0.85 }),
    NB_COPI,
  )
  copii.frustumCulled = false
  copi.frustumCulled = false
  groupe.add(copii, copi)

  /** Départ des COPII : la membrane du réticulum, hors cadre à gauche. */
  const DEPART_COPII = new THREE.Vector3(-0.34, -0.05, 0.05)
  /** Le granule immature qui bourgeonne de la face trans. */
  const granuleImmature = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 14, 10),
    materiauOrganite(TEINTES.granuleInsuline, { opacite: 0.45 }),
  )
  groupe.add(granuleImmature)

  /** Position du centre d'une citerne pour une avancée `a` dans la pile (0 = naissance cis). */
  const posePile = (a: number, cible: THREE.Vector3): void => {
    // La pile est incurvée : cis large, trans resserrée, comme des bols emboîtés.
    cible.set(a * PAS_PILE - 0.1, Math.sin(a * 0.5) * 0.02, 0)
  }

  const animer = (temps: number): void => {
    const p = ((temps / PERIODE) % 1 + 1) % 1
    // Toute la pile avance d'UNE position par période : la citerne née côté
    // cis à p=0 est la citerne trans d'il y a quatre cycles.
    for (let c = 0; c < NB_CITERNES; c++) {
      const avancee = c + p
      posePile(avancee, _position)
      const citerne = citernes[c]!
      citerne.position.copy(_position)
      // Naissance : la première citerne se condense à partir des COPII.
      // Dissolution : la dernière se défait en granules côté trans.
      let ech = 1
      if (c === 0) ech = lissage(p / 0.25)
      if (c === NB_CITERNES - 1) ech = 1 - lissage((p - 0.7) / 0.3)
      citerne.scale.setScalar(Math.max(0.001, ech))

      // Le cargo voyage AVEC sa citerne — c'est la maturation cisternale.
      for (let i = 0; i < NB_CARGO_PAR_CITERNE; i++) {
        const idx = c * NB_CARGO_PAR_CITERNE + i
        const b = idx * 3
        _position.set(
          citerne.position.x + ecartsCargo[b]! * 0.6,
          citerne.position.y + ecartsCargo[b + 1]!,
          citerne.position.z + ecartsCargo[b + 2]! * 0.6,
        )
        _matrice.compose(_position, _quat.identity(), _echelle.setScalar(Math.max(0.001, ech)))
        cargo.setMatrixAt(idx, _matrice)
        // La glycosylation arrive à l'étage médian : l'antenne pousse quand la
        // citerne passe l'avancée 2, et reste ensuite.
        const glycosyle = lissage((avancee - 2) / 0.3)
        _position.y += 0.006
        _position.x += 0.003
        _matrice.compose(
          _position,
          _quat,
          _echelle.setScalar(Math.max(0.001, glycosyle * ech)),
        )
        sucres.setMatrixAt(idx, _matrice)
      }
    }
    cargo.instanceMatrix.needsUpdate = true
    sucres.instanceMatrix.needsUpdate = true

    // COPII : trois navettes du réticulum vers le site de naissance cis.
    posePile(0 + p, _position)
    for (let v = 0; v < NB_COPII; v++) {
      const q = ((p * 2 + v / NB_COPII) % 1 + 1) % 1
      _a.copy(DEPART_COPII)
      _a.lerp(_position, lissage(q))
      _a.y += Math.sin(q * Math.PI) * 0.05 + Math.sin(temps * 0.8 + v * 2.1) * 0.008
      _a.z += Math.cos(temps * 0.6 + v * 1.7) * 0.008
      const ech = 1 - lissage((q - 0.82) / 0.18)
      _matrice.compose(_a, _quat, _echelle.setScalar(Math.max(0.001, ech)))
      copii.setMatrixAt(v, _matrice)
    }
    copii.instanceMatrix.needsUpdate = true

    // COPI : le retour des enzymes, de la citerne mûre vers la jeune. C'est ce
    // recyclage qui fait qu'une citerne médiane a des enzymes médianes.
    for (let v = 0; v < NB_COPI; v++) {
      const q = ((p * 1.5 + v * 0.5) % 1 + 1) % 1
      posePile(2.6, _a)
      posePile(0.7, _b)
      _a.lerp(_b, lissage(q))
      _a.y -= 0.06 + Math.sin(q * Math.PI) * 0.03
      _a.x += Math.sin(temps * 0.7 + v * 3) * 0.006
      const ech = lissage(q / 0.12) * (1 - lissage((q - 0.85) / 0.15))
      _matrice.compose(_a, _quat, _echelle.setScalar(Math.max(0.001, ech)))
      copi.setMatrixAt(v, _matrice)
    }
    copi.instanceMatrix.needsUpdate = true

    // Le granule immature bourgeonne de la citerne trans en fin de cycle.
    posePile(NB_CITERNES - 1 + p, _position)
    const bourgeon = lissage((p - 0.6) / 0.3)
    granuleImmature.position.set(
      _position.x + 0.06 + bourgeon * 0.09,
      _position.y - bourgeon * 0.05,
      _position.z,
    )
    granuleImmature.scale.setScalar(Math.max(0.001, bourgeon * (1 - lissage((p - 0.94) / 0.06))))
    _echelle.setScalar(1)
  }

  animer(0)

  return [
    {
      cle: 'transit-golgi',
      nom: 'Golgi : citernes qui mûrissent, sucres qui s\'ajoutent',
      siege: 'Appareil de Golgi',
      ralentissement: PERIODE / CYCLE_REEL,
      observable: {
        nom: 'citerne-en-maturation',
        cycleReel: CYCLE_REEL,
        pourquoi:
          'La citerne née côté cis porte le cycle : le temps qu\'elle avance ' +
          'd\'une position dans la pile est le pas de la maturation, et quatre ' +
          'pas font le transit que le badge annonce.',
      },
      justificationFacteur:
        'Une protéine met une vingtaine de minutes à traverser le Golgi ; le ' +
        'transit tient ici en 24 s, soit un accéléré d\'environ ×50. À cette ' +
        'échelle les vésicules COPII semblent des navettes pressées : en vrai ' +
        'leur trajet dure une ou deux minutes.',
      ellision:
        'Quatre citernes au lieu de cinq à huit, et une seule pile. Les ' +
        'glycosyltransférases elles-mêmes ne sont pas dessinées : on ne voit que ' +
        'leur œuvre, l\'antenne verte qui pousse à l\'étage médian — et la ' +
        'proinsuline réelle n\'est PAS glycosylée : le cargo figuré vaut pour ' +
        'les centaines d\'autres protéines qui transitent en même temps qu\'elle. ' +
        'Les manteaux COPII et COPI sont réduits à la teinte de leur vésicule. ' +
        'Le tri de sortie — mannose-6-phosphate vers les lysosomes, granules ' +
        'vers la sécrétion régulée — est résumé au seul bourgeon du granule.',
      description:
        'Le Golgi ne fait pas passer les protéines de citerne en citerne : c\'est ' +
        'la CITERNE ENTIÈRE qui avance. Née côté cis de la fusion des vésicules ' +
        'COPII venues du réticulum, elle mûrit en avançant dans la pile, son ' +
        'cargo dedans, pendant que les vésicules COPI — orange — renvoient ses ' +
        'enzymes en arrière : une citerne médiane a des enzymes médianes parce ' +
        'que le recyclage l\'y maintient, pas parce qu\'elle est immobile. À ' +
        'chaque étage, des enzymes différentes taillent les sucres du cargo — ' +
        'l\'antenne verte qui pousse à l\'étage médian. Au bout, la face trans ' +
        'se défait en vésicules : pour la proinsuline, un GRANULE IMMATURE ' +
        'bourgeonne, et sa maturation est une autre scène.',
      objet: groupe,
      ancre: groupe.position.clone(),
      rayonCadrage: 0.4,
      couleur: TEINTES.golgi,
      animer,
    },
  ]
}
