import * as THREE from 'three'
import { RAYON_CELLULE, TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import type { Mecanisme } from './contrat.js'

/**
 * La pompe sodium-potassium, et le canal juste à côté.
 *
 * Le contenu de ce mécanisme est le CONTRASTE. Une pompe fait une centaine de
 * cycles par seconde ; un canal ouvert laisse passer jusqu'à 10⁸ ions par
 * seconde, soit cent mille fois plus. Au ralenti retenu, la pompe devient un
 * mécanisme qu'on suit à l'œil, et le canal devient physiquement indessinable en
 * billes — d'où le jet continu. Ce contraste visuel encode le facteur 10⁵ sans
 * un mot de commentaire, et c'est l'erreur numéro un de toutes les
 * vulgarisations, qui animent les deux à la même cadence.
 */

const DIRECTION = new THREE.Vector3(-0.62, 0.28, 0.73).normalize()
const CENTRE = DIRECTION.clone().multiplyScalar(RAYON_CELLULE)

/** Écart entre la pompe et le canal, en unités de scène. */
const ECART = 0.3
const EPAISSEUR_MEMBRANE = 0.06

const DEHORS = 1
const DEDANS = -1

const NB_SODIUM = 18
const NB_POTASSIUM = 12
const NB_JET = 90

const TEINTE_SODIUM = 0xe69f00
const TEINTE_POTASSIUM = 0x56b4e9
const TEINTE_ATP = TEINTES.ribosome

/**
 * Les quatre conformations du cycle de Post-Albers.
 *
 * E1 ouverte vers l'intérieur lie 3 Na⁺ ; la phosphorylation par l'ATP la ferme
 * en E1-P ; elle bascule en E2-P ouverte vers l'extérieur et lâche les 3 Na⁺ en
 * liant 2 K⁺ ; la déphosphorylation la ramène en E1 et libère les 2 K⁺ dedans.
 *
 * Chaque état a son ouverture et sa largeur : la protéine doit CHANGER DE FORME
 * visiblement, sinon on a dessiné un tuyau et non un mécanisme.
 */
const ETATS = [
  { nom: 'E1', ouvertureDedans: 1, ouvertureDehors: 0, largeur: 1.0 },
  { nom: 'E1-P', ouvertureDedans: 0, ouvertureDehors: 0, largeur: 0.82 },
  { nom: 'E2-P', ouvertureDedans: 0, ouvertureDehors: 1, largeur: 1.06 },
  { nom: 'E2', ouvertureDedans: 0, ouvertureDehors: 0, largeur: 0.9 },
] as const

/** Durée d'un état à l'écran, en secondes. Quatre états font un cycle complet. */
const DUREE_ETAT = 3.2

// ── Temporaires hissés : animer() ne doit jamais allouer ───────────────────
const _position = new THREE.Vector3()
const _rotation = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)
const _matrice = new THREE.Matrix4()

export function creerPompeSodiumPotassium(): Mecanisme[] {
  const alea = creerAlea(11_235)
  const groupe = new THREE.Group()
  groupe.position.copy(CENTRE)
  // Le repère local a l'extérieur vers +Y : on couche donc l'axe Y sur la normale.
  groupe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), DIRECTION)

  // ── Le fragment de membrane ─────────────────────────────────────────────
  const membrane = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, EPAISSEUR_MEMBRANE, 0.6),
    materiauOrganite(TEINTES.membrane, { opacite: 0.5 }),
  )
  groupe.add(membrane)

  // ── La pompe, en trois pièces mobiles ───────────────────────────────────
  const pompe = new THREE.Group()
  pompe.position.x = -ECART / 2
  groupe.add(pompe)

  const corpsPompe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.058, EPAISSEUR_MEMBRANE * 2.1, 14, 1),
    materiauOrganite(TEINTES.proteineMembranaire),
  )
  pompe.add(corpsPompe)

  // Deux volets qui s'écartent : c'est eux qui rendent le changement de
  // conformation lisible. Un cylindre seul ne montrerait rien.
  const voletDedans = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.05, 0.05),
    materiauOrganite(0xc07000),
  )
  voletDedans.position.y = DEDANS * 0.062
  pompe.add(voletDedans)

  const voletDehors = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.05, 0.05),
    materiauOrganite(0xc07000),
  )
  voletDehors.position.y = DEHORS * 0.062
  pompe.add(voletDehors)

  // Le phosphate, visible quand la pompe est phosphorylée.
  const phosphate = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.016, 1),
    materiauOrganite(TEINTE_ATP),
  )
  phosphate.position.set(0.055, DEDANS * 0.03, 0)
  pompe.add(phosphate)

  // ── Le canal potassique, à côté ─────────────────────────────────────────
  const canal = new THREE.Group()
  canal.position.x = ECART / 2
  groupe.add(canal)

  const corpsCanal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, EPAISSEUR_MEMBRANE * 1.8, 12, 1, true),
    materiauOrganite(0x2a7fb8, { opacite: 0.75 }),
  )
  canal.add(corpsCanal)

  // Le filtre de sélectivité, l'anneau étroit qui trie les ions.
  const filtre = new THREE.Mesh(
    new THREE.TorusGeometry(0.026, 0.008, 8, 16),
    materiauOrganite(0x1d5f8a),
  )
  filtre.rotation.x = Math.PI / 2
  canal.add(filtre)

  // ── Les ions ────────────────────────────────────────────────────────────
  const sodium = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.014, 1),
    materiauOrganite(TEINTE_SODIUM),
    NB_SODIUM,
  )
  sodium.frustumCulled = false
  groupe.add(sodium)

  const potassium = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.017, 1),
    materiauOrganite(TEINTE_POTASSIUM),
    NB_POTASSIUM,
  )
  potassium.frustumCulled = false
  groupe.add(potassium)

  // Le jet du canal : des grains si serrés qu'ils se lisent comme un flux.
  const jet = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.008, 0),
    materiauOrganite(TEINTE_POTASSIUM, { opacite: 0.85 }),
    NB_JET,
  )
  jet.frustumCulled = false
  groupe.add(jet)

  const phaseJet = new Float32Array(NB_JET)
  const derveJet = new Float32Array(NB_JET * 2)
  for (let i = 0; i < NB_JET; i++) {
    phaseJet[i] = alea()
    derveJet[i * 2] = (alea() - 0.5) * 0.05
    derveJet[i * 2 + 1] = (alea() - 0.5) * 0.05
  }

  const derveIon = new Float32Array((NB_SODIUM + NB_POTASSIUM) * 2)
  for (let i = 0; i < derveIon.length; i++) derveIon[i] = (alea() - 0.5) * 0.09

  const xPompe = -ECART / 2
  const xCanal = ECART / 2

  const animer = (temps: number): void => {
    // ── Le cycle de la pompe ──────────────────────────────────────────────
    const avance = temps / DUREE_ETAT
    const indice = Math.floor(avance) % ETATS.length
    const local = avance - Math.floor(avance)
    const etat = ETATS[indice]!
    const suivant = ETATS[(indice + 1) % ETATS.length]!
    // Transition douce entre deux conformations : une protéine ne saute pas.
    const lissage = local * local * (3 - 2 * local)

    const ouvDedans = etat.ouvertureDedans + (suivant.ouvertureDedans - etat.ouvertureDedans) * lissage
    const ouvDehors = etat.ouvertureDehors + (suivant.ouvertureDehors - etat.ouvertureDehors) * lissage
    const largeur = etat.largeur + (suivant.largeur - etat.largeur) * lissage

    voletDedans.position.y = DEDANS * (0.062 + ouvDedans * 0.03)
    voletDedans.rotation.z = ouvDedans * 0.8
    voletDehors.position.y = DEHORS * (0.062 + ouvDehors * 0.03)
    voletDehors.rotation.z = -ouvDehors * 0.8
    corpsPompe.scale.set(largeur, 1, largeur)

    // Le phosphate n'est présent qu'en E1-P et E2-P, les deux états phosphorylés.
    const phosphoryle = indice === 1 || indice === 2
    phosphate.scale.setScalar(phosphoryle ? 1 : 0.001)

    // ── Trois Na⁺ sortent, deux K⁺ entrent, par cycle ────────────────────
    for (let i = 0; i < NB_SODIUM; i++) {
      const t = (temps / (DUREE_ETAT * 4) + i / NB_SODIUM) % 1
      // Le sodium monte de la matrice vers l'extérieur : il SORT.
      const y = DEDANS * 0.22 + t * 0.44
      _position.set(
        xPompe + derveIon[i * 2]! * (1 - Math.abs(0.5 - t) * 2),
        y,
        derveIon[i * 2 + 1]! * (1 - Math.abs(0.5 - t) * 2),
      )
      // Un ion à l'intérieur du canal de la pompe est resserré sur l'axe.
      _echelle.setScalar(1)
      _matrice.compose(_position, _rotation, _echelle)
      sodium.setMatrixAt(i, _matrice)
    }
    sodium.instanceMatrix.needsUpdate = true

    for (let i = 0; i < NB_POTASSIUM; i++) {
      const t = (temps / (DUREE_ETAT * 4) + 0.5 + i / NB_POTASSIUM) % 1
      // Le potassium descend : il ENTRE. Les deux gradients sont opposés, et
      // c'est ce que la pompe entretient contre la diffusion.
      const y = DEHORS * 0.22 - t * 0.44
      const j = NB_SODIUM + i
      _position.set(
        xPompe + derveIon[j * 2]! * (1 - Math.abs(0.5 - t) * 2),
        y,
        derveIon[j * 2 + 1]! * (1 - Math.abs(0.5 - t) * 2),
      )
      _echelle.setScalar(1)
      _matrice.compose(_position, _rotation, _echelle)
      potassium.setMatrixAt(i, _matrice)
    }
    potassium.instanceMatrix.needsUpdate = true

    // ── Le canal : ouverture stochastique, et un jet quand il est ouvert ──
    // Un canal dessiné ouvert en permanence est faux : l'ouverture dure
    // quelques millisecondes et se referme.
    const battement = Math.sin(temps * 1.7) + Math.sin(temps * 2.9 + 1.3)
    const ouvert = battement > -0.4
    filtre.scale.setScalar(ouvert ? 1 : 0.55)

    for (let i = 0; i < NB_JET; i++) {
      if (!ouvert) {
        _echelle.setScalar(0)
        _matrice.compose(_position, _rotation, _echelle)
        jet.setMatrixAt(i, _matrice)
        continue
      }
      // Vitesse énorme devant celle de la pompe : les grains se fondent en flux.
      const t = (temps * 2.4 + phaseJet[i]!) % 1
      _position.set(
        xCanal + derveJet[i * 2]! * (0.4 + t),
        DEHORS * 0.24 - t * 0.48,
        derveJet[i * 2 + 1]! * (0.4 + t),
      )
      _echelle.setScalar(1)
      _matrice.compose(_position, _rotation, _echelle)
      jet.setMatrixAt(i, _matrice)
    }
    jet.instanceMatrix.needsUpdate = true
  }

  animer(0)

  return [
    {
      cle: 'pompe-sodium-potassium',
      nom: 'Pompe Na⁺/K⁺ et canal potassique',
      siege: 'Membrane plasmique',
      facteur: 'ralenti ×1 000',
      justificationFacteur:
        'Un cycle de pompe prend 7 à 20 ms, ce qui devient une douzaine de secondes ' +
        "à l'écran et se suit état par état. À ce même ralenti, le canal devrait " +
        "débiter cent mille ions par seconde d'écran : il est donc physiquement " +
        'indessinable en billes, et c\'est pourquoi il est rendu en jet. Ce contraste ' +
        "n'est pas un effet de style, c'est la mesure de l'écart.",
      ellision:
        "Les EFFECTIFS sont multipliés par six : dix-huit sodiums et douze potassiums " +
        "traversent par cycle, là où la pompe réelle en déplace trois et deux. Le " +
        "rapport 3:2 est conservé — c'est lui qui fait de la pompe une pompe " +
        "électrogénique, et c'est le fait qui porte —, mais un étudiant qui compte les " +
        "billes compte un échantillon, pas un cycle. À trois et deux, la scène ne " +
        'montrerait presque rien entre deux conformations. Le jet du canal, lui, est ' +
        "coupé et non ralenti : cent mille ions par seconde d'écran ne se dessinent " +
        'pas. Une seule pompe et un seul canal sont montrés là où un micromètre carré ' +
        "de membrane en porte des centaines, et l'ATP consommé — un par cycle — est " +
        'figuré sans son cortège de phosphorylations intermédiaires.',
      description:
        'La pompe traverse quatre conformations. En E1 elle est ouverte vers ' +
        "l'intérieur et lie trois ions sodium ; l'ATP la phosphoryle et la ferme ; " +
        'elle bascule en E2-P ouverte vers le dehors, lâche le sodium et prend deux ' +
        'ions potassium ; la déphosphorylation la ramène au départ. Trois charges ' +
        'sortent, deux entrent : la pompe est électrogénique et contribue de quelques ' +
        'millivolts au potentiel de repos. Elle ne le fabrique pas, contrairement à ce ' +
        "qu'on lit partout — le potentiel de repos est un potentiel de diffusion du " +
        'potassium, rendu possible par les canaux de fuite comme celui de droite. La ' +
        "pompe, elle, entretient les gradients contre la diffusion, et c'est un travail " +
        'permanent qui coûte le tiers du budget énergétique de la cellule.',
      objet: groupe,
      ancre: CENTRE.clone(),
      rayonCadrage: 0.5,
      couleur: TEINTES.proteineMembranaire,
      animer,
    },
  ]
}
