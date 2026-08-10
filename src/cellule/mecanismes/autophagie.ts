import * as THREE from 'three'
import { TEINTES, creerAlea, materiauOrganite } from '../contrat.js'
import type { MecanismeBrut } from './contrat.js'

/**
 * L'autophagie : se manger soi-même pour durer.
 *
 * Une membrane naît de rien — le phagophore, une coupe à DOUBLE paroi — et
 * grandit autour d'une mitochondrie usée jusqu'à la refermer dans un
 * autophagosome. Celui-ci fusionne avec un lysosome, et le contenu est
 * démonté en briques réutilisables. C'est la voie de survie de la cellule
 * affamée ou encombrée, et pour la mitochondrie abîmée, la MITOPHAGIE est
 * le contrôle qualité qui évite les fuites d'électrons.
 */

const GRAINE = 0x4155544f

/** Un cycle à l'écran : 20 s pour ~10 min réelles (formation + fusion). */
const PERIODE = 20
const CYCLE_REEL = 600

/** La proie : un fragment de mitochondrie de 0,5 µm. */
const RAYON_PROIE = 0.25
const RAYON_PHAGOPHORE = 0.34
const NB_GRAINS_MEMBRANE = 64
const NB_LC3 = 8
const NB_DEBRIS = 14

// Jalons.
const P_CROISSANCE_FIN = 0.45
const P_FERME = 0.5
const P_FUSION = 0.68
const P_DIGERE_FIN = 0.94

const _matrice = new THREE.Matrix4()
const _position = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _echelle = new THREE.Vector3(1, 1, 1)

function lissage(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x
  return c * c * (3 - 2 * c)
}

export function creerAutophagie(): MecanismeBrut[] {
  const alea = creerAlea(GRAINE)
  const groupe = new THREE.Group()
  groupe.name = 'autophagie'
  groupe.position.set(-1.6, -3.8, -2.0)
  groupe.rotation.set(0.15, 0.4, 0)

  // ── La proie : une petite mitochondrie dépolarisée ──────────────────────
  const proie = new THREE.Group()
  const corpsProie = new THREE.Mesh(
    new THREE.CapsuleGeometry(RAYON_PROIE * 0.55, RAYON_PROIE * 0.9, 4, 12),
    materiauOrganite(TEINTES.mitochondrie, { opacite: 0.55 }),
  )
  corpsProie.rotation.z = Math.PI / 2
  proie.add(corpsProie)
  for (let c = 0; c < 4; c++) {
    const crete = new THREE.Mesh(
      new THREE.CylinderGeometry(RAYON_PROIE * 0.4, RAYON_PROIE * 0.4, 0.015, 12),
      materiauOrganite(TEINTES.mitochondrieCrete),
    )
    crete.position.x = (c - 1.5) * RAYON_PROIE * 0.42
    crete.rotation.z = Math.PI / 2
    proie.add(crete)
  }
  groupe.add(proie)

  // ── Le phagophore : une DOUBLE membrane en coupe qui se referme ─────────
  // Deux calottes de grains : la double paroi est le fait à voir — aucune
  // autre vésicule de la cellule n'en a une.
  const membrane = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.012, 0),
    materiauOrganite(TEINTES.reticulumLisse, { doubleFace: false }),
    NB_GRAINS_MEMBRANE * 2,
  )
  membrane.frustumCulled = false
  membrane.name = 'phagophore'
  groupe.add(membrane)
  const azimuts = new Float32Array(NB_GRAINS_MEMBRANE)
  const inclinaisons = new Float32Array(NB_GRAINS_MEMBRANE)
  for (let i = 0; i < NB_GRAINS_MEMBRANE; i++) {
    azimuts[i] = alea() * Math.PI * 2
    inclinaisons[i] = alea()
  }

  // Les LC3 : les balises de la membrane autophagique, plantées dessus.
  const lc3 = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.016, 0),
    materiauOrganite(TEINTES.golgi, { doubleFace: false }),
    NB_LC3,
  )
  lc3.frustumCulled = false
  groupe.add(lc3)

  // ── Le lysosome qui arrive, et les briques qui repartent ────────────────
  const lysosome = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 10),
    materiauOrganite(TEINTES.lysosome, { opacite: 0.65 }),
  )
  groupe.add(lysosome)
  const DEPART_LYSOSOME = new THREE.Vector3(0.75, -0.3, 0.15)

  const debris = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.014, 0),
    materiauOrganite(TEINTES.cytosol, { doubleFace: false }),
    NB_DEBRIS,
  )
  debris.frustumCulled = false
  groupe.add(debris)
  const sortiesDebris: THREE.Vector3[] = []
  for (let i = 0; i < NB_DEBRIS; i++) {
    sortiesDebris.push(
      new THREE.Vector3(alea() * 2 - 1, alea() * 2 - 1, alea() * 2 - 1).normalize(),
    )
  }

  const animer = (temps: number): void => {
    const p = ((temps / PERIODE) % 1 + 1) % 1
    const croissance = lissage(p / P_CROISSANCE_FIN)
    const fusion = lissage((p - P_FUSION) / 0.1)
    const digestion = lissage((p - P_FUSION) / (P_DIGERE_FIN - P_FUSION))
    const fondu = 1 - lissage((p - P_DIGERE_FIN) / (1 - P_DIGERE_FIN))

    // La proie rapetisse à la digestion : elle redevient des briques.
    proie.scale.setScalar(Math.max(0.001, (1 - digestion * 0.97) * fondu))
    proie.rotation.y = temps * 0.05

    // Le phagophore : l'ouverture angulaire couverte croît de 25 % à 100 %.
    const couverture = 0.25 + 0.75 * croissance
    for (let i = 0; i < NB_GRAINS_MEMBRANE; i++) {
      // Inclinaison depuis le pôle : seuls les grains sous l'angle couvert existent.
      const theta = inclinaisons[i]! * Math.PI
      const visible = theta <= couverture * Math.PI ? 1 : 0.001
      const a = azimuts[i]!
      for (let paroi = 0; paroi < 2; paroi++) {
        // Le rayon PORTE le cycle : l'autophagosome se contracte pendant la
        // digestion — et c'est aussi ce que le harnais de période mesure, car
        // la signature d'un amas se lit sur les positions, pas les échelles.
        const r = (RAYON_PHAGOPHORE + paroi * 0.028) * (1 - digestion * 0.35)
        _position.set(
          Math.sin(theta) * Math.cos(a) * r,
          Math.cos(theta) * r,
          Math.sin(theta) * Math.sin(a) * r,
        )
        _matrice.compose(
          _position,
          _quat.identity(),
          _echelle.setScalar(visible * fondu * (1 - digestion * 0.4)),
        )
        membrane.setMatrixAt(paroi * NB_GRAINS_MEMBRANE + i, _matrice)
      }
    }
    membrane.instanceMatrix.needsUpdate = true

    for (let i = 0; i < NB_LC3; i++) {
      const theta = ((i + 0.5) / NB_LC3) * couverture * Math.PI
      const a = i * 2.4
      const r = RAYON_PHAGOPHORE + 0.05
      _position.set(
        Math.sin(theta) * Math.cos(a) * r,
        Math.cos(theta) * r,
        Math.sin(theta) * Math.sin(a) * r,
      )
      _matrice.compose(_position, _quat, _echelle.setScalar(fondu * (1 - fusion * 0.6)))
      lc3.setMatrixAt(i, _matrice)
    }
    lc3.instanceMatrix.needsUpdate = true

    // Le lysosome approche après la fermeture, fusionne, et ne fait plus qu'un.
    const approche = lissage((p - P_FERME) / (P_FUSION - P_FERME))
    lysosome.position.copy(DEPART_LYSOSOME).multiplyScalar(1 - approche)
    lysosome.position.addScaledVector(DEPART_LYSOSOME, -0.0)
    lysosome.scale.setScalar(
      Math.max(0.001, (1 - fusion) * fondu + fusion * fondu * 1.15),
    )

    // Les briques : acides aminés et lipides rendus au cytosol.
    for (let i = 0; i < NB_DEBRIS; i++) {
      const sortie = lissage((digestion - i / NB_DEBRIS) / 0.3)
      _position.copy(sortiesDebris[i]!).multiplyScalar(sortie * 0.6)
      const ech = sortie > 0 ? sortie * (1 - lissage((sortie - 0.7) / 0.3)) : 0.001
      _matrice.compose(_position, _quat, _echelle.setScalar(Math.max(0.001, ech)))
      debris.setMatrixAt(i, _matrice)
    }
    debris.instanceMatrix.needsUpdate = true
    _echelle.setScalar(1)
  }

  animer(0)

  return [
    {
      cle: 'autophagie',
      nom: 'Autophagie : le phagophore, LC3 et le recyclage',
      siege: 'Cytosol',
      ralentissement: PERIODE / CYCLE_REEL,
      observable: {
        nom: 'phagophore',
        cycleReel: CYCLE_REEL,
        pourquoi:
          'Le phagophore porte le cycle : sa croissance, sa fermeture et sa ' +
          'digestion prennent une dizaine de minutes dans la cellule, et c\'est ' +
          'ce trajet complet que le badge annonce.',
      },
      justificationFacteur:
        'Un autophagosome se forme et se referme en cinq à dix minutes ; le ' +
        'cycle tient ici en 20 s, soit un accéléré de ×30 sur un cycle moyen ' +
        'de dix minutes, fusion lysosomale comprise.',
      ellision:
        'Une seule proie, choisie : une mitochondrie dépolarisée — c\'est la ' +
        'mitophagie, le cas le plus lisible. La machinerie ATG qui bâtit la ' +
        'membrane (ULK1, PI3K de classe III, les systèmes de conjugaison) est ' +
        'réduite aux balises LC3 ; PINK1 et Parkin, qui désignent la proie, ne ' +
        'sont pas dessinées. Le phagophore réel naît d\'un contact avec le ' +
        'réticulum, hors cadre. Les briques rendues au cytosol sont figurées ' +
        'par quelques grains — la réalité est un flux de nutriments.',
      description:
        'Une membrane naît presque de rien et GRANDIT en coupe autour de sa ' +
        'proie : c\'est le phagophore, et sa signature est sa DOUBLE paroi — ' +
        'aucune autre vésicule de la cellule n\'en a. Balisé de LC3, il se ' +
        'referme sur une mitochondrie usée : un autophagosome. Un lysosome ' +
        'vient alors fusionner — ses hydrolases ne travaillent qu\'à pH acide, ' +
        'et c\'est lui qui l\'apporte — et la proie est démontée en briques : ' +
        'acides aminés, lipides, rendus au cytosol pour resservir. La cellule ' +
        'affamée survit en se mangeant avec méthode ; la cellule encombrée ' +
        'fait le ménage. Pour la bêta, ce ménage est vital : une mitochondrie ' +
        'qui fuit ses électrons fabrique des radicaux, et le modèle le sait — ' +
        'l\'autophagie y monte avec le stress.',
      objet: groupe,
      ancre: groupe.position.clone(),
      rayonCadrage: 0.85,
      couleur: TEINTES.lysosome,
      animer,
    },
  ]
}
