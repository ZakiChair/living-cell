import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import { contexteRepos } from '../../noyau/contexte.js'
import type { ContexteCellule, MecanismeBrut } from './contrat.js'

/**
 * Le repliement dans le réticulum : BiP, PDI, et les trois ponts disulfure.
 *
 * La proinsuline qui vient de traverser Sec61 n'est qu'un fil. Ce qui en fait
 * une protéine, c'est le repliement — et pour elle, il tient à TROIS PONTS
 * DISULFURE posés entre les bonnes cystéines parmi les appariements possibles.
 * La PDI catalyse, défait, recommence ; BiP tient la chaîne le temps qu'il
 * faut. Un mauvais appariement, et la proinsuline part à la dégradation —
 * c'est un mécanisme réel de diabète : le MIDY chez l'humain (mutations du
 * gène INS), la souris Akita au laboratoire (Cys A7 perdue).
 *
 * La scène montre trois chaînes en phase décalée : deux se replient juste,
 * une se trompe et repart vers l'ERAD. La part d'échec LIT LE MODÈLE : quand
 * le stress du réticulum monte, l'atelier déborde et les échecs se multiplient.
 */

const GRAINE = 0x52455046

/** Un cycle de repliement à l'écran : 20 s pour ~10 min réelles. */
const PERIODE = 20
const CYCLE_REEL = 600

const NB_CHAINES = 3
/** 26 grains pour 86 résidus de proinsuline : un grain pour ~3 acides aminés. */
const NB_RESIDUS = 26
const ESPACE = 0.0035
/** Les trois ponts : approximations à l'échelle des grains de B7–A7, B19–A20, A6–A11. */
const PONTS: ReadonlyArray<readonly [number, number]> = [
  [2, 17],
  [6, 21],
  [16, 20],
]

// Jalons du cycle d'une chaîne.
const P_EMERGE_FIN = 0.24
const P_COMPACTE_DEB = 0.2
const P_COMPACTE_FIN = 0.52
const P_PONTS_DEB = 0.5
const P_PONTS_FIN = 0.8
const P_LIBERE = 0.86

const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const AXE_Y = new THREE.Vector3(0, 1, 0)

function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

/** Position du résidu `i` sur la chaîne TENDUE, sous son translocon. */
function tendue(i: number, ancre: THREE.Vector3, cible: THREE.Vector3): void {
  cible.set(
    ancre.x + Math.sin(i * 0.9) * 0.0022,
    ancre.y - i * ESPACE,
    ancre.z + Math.cos(i * 1.3) * 0.0022,
  )
}

/**
 * Position du résidu `i` sur la chaîne REPLIÉE : une pelote compacte dont le
 * rayon suit la vraie loi d'échelle d'une globulaire (~1,1 nm pour 30 grains).
 */
function repliee(
  i: number,
  ancre: THREE.Vector3,
  tordu: number,
  cible: THREE.Vector3,
): void {
  const angle = i * 2.4 + tordu * 2.1
  const montee = (i / NB_RESIDUS - 0.5) * 0.014
  const rayon = 0.0085 * (0.6 + 0.4 * Math.sin(i * 1.7 + tordu * 5))
  cible.set(
    ancre.x + Math.cos(angle) * rayon,
    ancre.y - NB_RESIDUS * ESPACE * 0.35 + montee,
    ancre.z + Math.sin(angle) * rayon,
  )
}

export function creerRepliementRE(): MecanismeBrut[] {
  const alea = creerAlea(GRAINE)
  const groupe = new THREE.Group()
  groupe.name = 'repliement-re'
  // Dans la lumière du réticulum rugueux, à l'écart de la scène de translocation.
  groupe.position.set(-3.7, -2.1, -1.1)
  groupe.rotation.set(0.1, 0.35, 0)

  // Le plafond : la membrane du réticulum vue de dessous, avec ses translocons.
  const membrane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.2),
    materiauOrganite(TEINTES.reticulumRugueux, { opacite: 0.45 }),
  )
  membrane.rotation.x = Math.PI / 2
  membrane.position.y = 0.02
  groupe.add(membrane)

  const matAmarre = materiauOrganite(TEINTES.proteineMembranaire)
  const ancres: THREE.Vector3[] = []
  for (let k = 0; k < NB_CHAINES; k++) {
    const ancre = new THREE.Vector3((k - 1) * 0.09, 0.016, (k % 2) * 0.02 - 0.01)
    ancres.push(ancre)
    const canal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0038, 0.003, 0.008, 10, 1, true),
      matAmarre,
    )
    canal.position.copy(ancre)
    groupe.add(canal)
  }

  // Les chaînes : la première porte le cycle du badge, et réussit toujours.
  const matChaine = materiauOrganite(TEINTES.golgi, { doubleFace: false })
  const chaines: THREE.InstancedMesh[] = []
  for (let k = 0; k < NB_CHAINES; k++) {
    const amas = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.0016, 1),
      matChaine,
      NB_RESIDUS,
    )
    amas.frustumCulled = false
    if (k === 0) amas.name = 'chaine-en-repliement'
    chaines.push(amas)
    groupe.add(amas)
  }

  // Les ponts disulfure : trois barreaux orange par chaîne, la signature de
  // l'insuline. Ils n'apparaissent qu'au passage de la PDI.
  const matPont = materiauOrganite(0xd55e00, { doubleFace: false })
  const ponts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.0008, 0.0008, 1, 5, 1, true),
    matPont,
    NB_CHAINES * PONTS.length,
  )
  ponts.frustumCulled = false
  groupe.add(ponts)

  // BiP et PDI : une paire par chaîne, pour que chaque histoire soit complète.
  const matBip = materiauOrganite(TEINTES.lysosome, { doubleFace: false })
  const matPdi = materiauOrganite(TEINTES.reticulumLisse, { doubleFace: false })
  const bips: THREE.Mesh[] = []
  const pdis: THREE.Mesh[] = []
  for (let k = 0; k < NB_CHAINES; k++) {
    const bip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0042, 1), matBip)
    const pdi = new THREE.Mesh(new THREE.IcosahedronGeometry(0.0032, 1), matPdi)
    bips.push(bip)
    pdis.push(pdi)
    groupe.add(bip, pdi)
  }

  // ── Les capteurs de l'UPR, plantés dans la membrane ─────────────────────
  // IRE1, PERK et ATF6 mesurent l'encombrement de la lumière : tant que BiP
  // les tient, ils dorment ; quand les chaînes mal repliées séquestrent BiP,
  // ils s'activent — IRE1 et PERK en DIMÉRISANT. C'est la réponse aux
  // protéines mal repliées, et elle lit ici le stress du modèle.
  const matCapteur = materiauOrganite(0xcc79a7, { doubleFace: false })
  const geoCapteur = new THREE.CylinderGeometry(0.0022, 0.0022, 0.011, 8)
  const ire1a = new THREE.Mesh(geoCapteur, matCapteur)
  const ire1b = new THREE.Mesh(geoCapteur, matCapteur)
  const perkA = new THREE.Mesh(geoCapteur, matCapteur)
  const perkB = new THREE.Mesh(geoCapteur, matCapteur)
  const atf6 = new THREE.Mesh(geoCapteur, matCapteur)
  const capteurs = [ire1a, ire1b, perkA, perkB, atf6]
  for (const capteur of capteurs) groupe.add(capteur)

  // ── Le port ERAD ────────────────────────────────────────────────────────
  // La chaîne ratée ne part pas « en ligne droite » : elle est rétrotransloquée
  // par Hrd1 et étiquetée d'ubiquitines — le protéasome, une autre scène,
  // l'attend de l'autre côté.
  const hrd1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.0032, 0.009, 10, 1, true),
    matAmarre,
  )
  hrd1.position.set(-0.155, 0.016, -0.02)
  groupe.add(hrd1)
  const NB_UBIQUITINES = 4
  const ubiquitines = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.0014, 0),
    materiauOrganite(0xd55e00, { doubleFace: false }),
    NB_UBIQUITINES,
  )
  ubiquitines.frustumCulled = false
  groupe.add(ubiquitines)

  // Phases décalées, et une graine de désordre par chaîne.
  const dephasages = [0, 0.37, 0.71]
  const desordres = [alea() * 7, alea() * 7, alea() * 7]

  const animer = (temps: number, contexte: ContexteCellule = contexteRepos()): void => {
    // Le taux d'échec lit le stress du réticulum : au repos, une chaîne sur
    // trois se trompe (et le recommencement est la norme — la PDI défait
    // autant qu'elle fait) ; sous stress, l'atelier déborde.
    const stress = contexte.stressRE
    for (let k = 0; k < NB_CHAINES; k++) {
      const p = ((temps / PERIODE + dephasages[k]!) % 1 + 1) % 1
      // La chaîne 0 porte le badge et réussit toujours ; la chaîne 2 échoue
      // toujours ; la chaîne 1 bascule avec le stress.
      const echoue = k === 2 || (k === 1 && stress > 0.3)
      const ancre = ancres[k]!
      const amas = chaines[k]!

      const emergence = lissage(p / P_EMERGE_FIN)
      const compaction = lissage((p - P_COMPACTE_DEB) / (P_COMPACTE_FIN - P_COMPACTE_DEB))
      const liberation = lissage((p - P_LIBERE) / (1 - P_LIBERE))
      const nVisibles = Math.max(2, Math.round(NB_RESIDUS * emergence))
      // Une chaîne ratée se tord AUTREMENT : même geste, mauvais résultat.
      const tordu = desordres[k]! + (echoue ? 3.7 : 0)

      for (let i = 0; i < NB_RESIDUS; i++) {
        tendue(i, ancre, _a)
        repliee(i, ancre, tordu, _b)
        _position.copy(_a).lerp(_b, compaction)
        // Libérée : la réussie part vers le Golgi (x croissant), la ratée vers
        // l'ERAD (elle redescend, dépliée à demi — le protéasome l'attend).
        if (liberation > 0) {
          if (echoue) {
            _position.x -= liberation * 0.06
            _position.y -= liberation * 0.05
          } else {
            _position.x += liberation * 0.09
            _position.z -= liberation * 0.03
          }
        }
        const visible = i < nVisibles ? 1 : 0.001
        const fondu = liberation > 0 ? Math.max(0.001, 1 - lissage((liberation - 0.55) / 0.45)) : 1
        _matrice.compose(_position, _quat.identity(), _echelle.setScalar(visible * fondu))
        amas.setMatrixAt(i, _matrice)
      }
      amas.instanceMatrix.needsUpdate = true

      // Les trois ponts, posés l'un après l'autre pendant la fenêtre PDI.
      for (const [j, paire] of PONTS.entries()) {
        const tPont = P_PONTS_DEB + (j / PONTS.length) * (P_PONTS_FIN - P_PONTS_DEB)
        // Une chaîne ratée ne reçoit que le premier pont, au mauvais endroit.
        const pose = echoue ? (j === 0 ? lissage((p - tPont) / 0.04) : 0) : lissage((p - tPont) / 0.04)
        const fondu = liberation > 0 ? Math.max(0.001, 1 - lissage((liberation - 0.55) / 0.45)) : 1
        repliee(paire[0] + (echoue ? 4 : 0), ancre, tordu, _a)
        repliee(paire[1]!, ancre, tordu, _b)
        if (liberation > 0) {
          const dx = echoue ? -0.06 : 0.09
          const dy = echoue ? -0.05 : 0
          const dz = echoue ? 0 : -0.03
          _a.x += liberation * dx
          _a.y += liberation * dy
          _a.z += liberation * dz
          _b.x += liberation * dx
          _b.y += liberation * dy
          _b.z += liberation * dz
        }
        const longueur = Math.max(1e-5, _a.distanceTo(_b))
        _position.copy(_a).lerp(_b, 0.5)
        _quat.setFromUnitVectors(AXE_Y, _b.sub(_a).divideScalar(longueur))
        _echelle.set(pose * fondu, longueur, pose * fondu)
        _matrice.compose(_position, _quat, _echelle)
        ponts.setMatrixAt(k * PONTS.length + j, _matrice)
      }

      // BiP tient la chaîne pendant la compaction, puis s'écarte.
      const prise = lissage((p - P_COMPACTE_DEB) / 0.08) * (1 - lissage((p - P_PONTS_FIN) / 0.08))
      repliee(NB_RESIDUS / 2, ancre, tordu, _a)
      bips[k]!.position.set(
        _a.x + 0.006 + Math.sin(temps * 0.7 + k * 2) * 0.01 * (1 - prise),
        _a.y + 0.004 + Math.cos(temps * 0.9 + k) * 0.012 * (1 - prise),
        _a.z + 0.005,
      )
      bips[k]!.scale.setScalar(1)

      // La PDI passe et repasse pendant la fenêtre des ponts.
      const fenetrePdi = lissage((p - P_PONTS_DEB + 0.05) / 0.08) * (1 - lissage((p - P_PONTS_FIN) / 0.08))
      const va = Math.sin(((p - P_PONTS_DEB) / (P_PONTS_FIN - P_PONTS_DEB)) * Math.PI * 3)
      pdis[k]!.position.set(
        _a.x - 0.007 - va * 0.004,
        _a.y - 0.006 + va * 0.006,
        _a.z - 0.004,
      )
      pdis[k]!.scale.setScalar(Math.max(0.35, fenetrePdi))
    }
    ponts.instanceMatrix.needsUpdate = true

    // ── L'UPR lit le stress : dormants dispersés, actifs par paires ───────
    // IRE1 et PERK dimérisent (les deux cylindres se rejoignent), ATF6 quitte
    // la membrane pour le Golgi. L'activation suit le stress du MODÈLE : le
    // levier « Stress RE » du laboratoire se voit ici.
    const activation = lissage((stress - 0.15) / 0.5)
    const ecartDimere = 0.012 * (1 - activation) + 0.0025
    ire1a.position.set(0.13 - ecartDimere / 2, 0.021, 0.05)
    ire1b.position.set(0.13 + ecartDimere / 2, 0.021, 0.05)
    perkA.position.set(0.145 - ecartDimere / 2, 0.021, -0.045)
    perkB.position.set(0.145 + ecartDimere / 2, 0.021, -0.045)
    // ATF6 part vers le Golgi quand le stress monte : il se détache et s'élève.
    atf6.position.set(0.1, 0.021 + activation * 0.03, 0.008)
    atf6.scale.setScalar(1 - 0.5 * activation)
    // Les dimères actifs pulsent : la kinase phosphoryle.
    const pulse = 1 + activation * 0.25 * Math.abs(Math.sin(temps * 2.1))
    ire1a.scale.setScalar(pulse)
    ire1b.scale.setScalar(pulse)
    perkA.scale.setScalar(pulse)
    perkB.scale.setScalar(pulse)

    // ── Les ubiquitines de l'ERAD suivent la chaîne ratée ─────────────────
    // Elles s'accrochent à mesure qu'elle passe par Hrd1, en file K48.
    const pRate = ((temps / PERIODE + dephasages[2]!) % 1 + 1) % 1
    const marquage = lissage((pRate - P_LIBERE) / (1 - P_LIBERE))
    for (let u = 0; u < NB_UBIQUITINES; u++) {
      const pose = lissage((marquage - u * 0.12) / 0.1)
      _position.set(
        ancres[2]!.x - marquage * 0.06 + 0.004 + u * 0.0028,
        ancres[2]!.y - NB_RESIDUS * ESPACE * 0.35 - marquage * 0.05 + 0.006,
        ancres[2]!.z + 0.003,
      )
      _matrice.compose(_position, _quat.identity(), _echelle.setScalar(Math.max(0.001, pose)))
      ubiquitines.setMatrixAt(u, _matrice)
    }
    ubiquitines.instanceMatrix.needsUpdate = true
    _echelle.setScalar(1)
  }

  animer(0)

  return [
    {
      cle: 'repliement-re',
      nom: 'Repliement : BiP, PDI et les trois ponts',
      siege: 'Réticulum endoplasmique rugueux',
      ralentissement: PERIODE / CYCLE_REEL,
      observable: {
        nom: 'chaine-en-repliement',
        cycleReel: CYCLE_REEL,
        pourquoi:
          "La chaîne qui réussit porte le cycle : émergence, compaction, trois ponts, départ — " +
          "c'est ce trajet complet, environ dix minutes dans le réticulum, que le badge annonce.",
      },
      justificationFacteur:
        'La proinsuline met de l’ordre de dix minutes à se replier et à recevoir ' +
        'ses ponts disulfure dans le réticulum ; le cycle tient ici en 20 s, soit ' +
        'un accéléré d’environ ×30. Le geste de la PDI, lui, est bien plus rapide ' +
        'que ça — c’est l’ATTENTE entre deux prises en charge qui domine.',
      ellision:
        'Un grain pour trois acides aminés, et des positions de cystéines ' +
        'approchées à cette échelle. La calnexine et la calréticuline, qui ' +
        'surveillent les protéines GLYCOSYLÉES, ne sont pas dessinées — la ' +
        'proinsuline n’est pas glycosylée, et c’est BiP qui la tient. Le ' +
        'glutathion qui fixe le potentiel rédox de la lumière est invisible. La ' +
        'rétrotranslocation ERAD est résumée : Hrd1 et les ubiquitines sont là, ' +
        'mais pas p97 qui tire, ni le voyage jusqu’au protéasome — sa scène ' +
        'existe, ailleurs. XBP1, l’ARN qu’IRE1 épisse une fois activé, et les ' +
        'gènes que l’UPR rallume ne sont pas montrés : on ne voit que les ' +
        'capteurs qui dimérisent et ATF6 qui part vers le Golgi. La part d’échec ' +
        'lit le stress du réticulum dans le modèle — au repos une chaîne sur ' +
        'trois, davantage quand l’atelier déborde, et le levier « Stress RE » ' +
        'du laboratoire se voit dans cette scène.',
      description:
        'Un fil n’est pas une protéine. La proinsuline qui vient de traverser ' +
        'Sec61 pend dans la lumière du réticulum ; BiP — violet — la tient le ' +
        'temps qu’elle se compacte, et la PDI — vert d’eau — vient poser ses ' +
        'TROIS PONTS DISULFURE, les barreaux orange : B7–A7, B19–A20, A6–A11. ' +
        'Parmi les quinze appariements possibles de ses six cystéines, un seul ' +
        'est le bon, et la PDI défait autant qu’elle fait. Suivez les trois ' +
        'chaînes : deux partent vers le Golgi, la troisième s’est trompée — ' +
        'mauvais pont, repliement de travers — et prend l’autre chemin, vers la ' +
        'dégradation. Chez la souris Akita, une seule cystéine mutée suffit : la ' +
        'proinsuline s’accumule, le réticulum sature, la cellule bêta meurt. Le ' +
        'repliement n’est pas un détail de fabrication, c’est là que se joue le ' +
        'diabète néonatal.',
      objet: groupe,
      ancre: groupe.position.clone(),
      // 0,11 et non 0,24 : le gate visuel a montré que les trois chaînes et
      // leurs ponts — le sujet même de la scène — étaient illisibles de loin.
      // On approche la caméra, on ne grossit pas les objets : c'est la
      // doctrine du site, et c'est la seule réponse juste.
      rayonCadrage: 0.11,
      couleur: TEINTES.reticulumRugueux,
      animer,
    },
  ]
}
