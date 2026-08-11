import { describe, expect, it } from 'vitest'
import { creerEtat } from './etatCellule.js'
import {
  CLES_MECANISMES,
  activiteMecanisme,
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
  estCleMecanisme,
  estConditionTraitee,
  reinitialiserSystemeCellulaire,
  type SystemeCellulaire,
} from './systemeCellulaire.js'
import { creerMecanismes } from '../cellule/mecanismes/tous.js'

function protocoleExtreme(): SystemeCellulaire {
  const systeme = creerSystemeCellulaire(creerEtat())
  systeme.milieu.glucoseCible = 40
  systeme.milieu.stressRE = 1
  systeme.milieu.bloqueurCalcique = 1
  systeme.energie.inhibiteurs.anoxie = true
  systeme.energie.inhibiteurs.oligomycine = true
  systeme.energie.inhibiteurs.ouabaine = true
  // 500 s à pas interne de 0,05 s : dix mille sous-pas.
  avancerSystemeCellulaire(systeme, 500)
  return systeme
}

function chaqueNombre(objet: unknown, chemin: string, visite: (chemin: string, valeur: number) => void): void {
  if (typeof objet === 'number') return visite(chemin, objet)
  if (Array.isArray(objet)) return objet.forEach((v, i) => chaqueNombre(v, `${chemin}[${i}]`, visite))
  if (objet && typeof objet === 'object') {
    for (const [cle, valeur] of Object.entries(objet)) chaqueNombre(valeur, `${chemin}.${cle}`, visite)
  }
}

describe('la frontière scène-modèle', () => {
  it('reconnaît la clé de chacun des mécanismes de la scène', () => {
    const mecanismes = creerMecanismes()
    expect(mecanismes.length).toBeGreaterThan(0)
    for (const mecanisme of mecanismes) {
      expect(estCleMecanisme(mecanisme.cle), mecanisme.cle).toBe(true)
    }
  })

  it("rejette une clé qui n'existe pas dans le modèle", () => {
    expect(estCleMecanisme('photosynthese')).toBe(false)
  })
})

function systemeAuRepos(duree = 600) {
  const systeme = creerSystemeCellulaire(creerEtat())
  avancerSystemeCellulaire(systeme, duree)
  return systeme
}

function systemeStimule(duree = 600) {
  const systeme = creerSystemeCellulaire(creerEtat())
  systeme.milieu.glucoseCible = 12
  avancerSystemeCellulaire(systeme, duree)
  return systeme
}

describe('la boucle glucose → KATP → Vm → Ca → insuline', () => {
  it('un glucose à 12 mM ferme les canaux KATP par rapport au repos', () => {
    expect(systemeStimule().ions.canalKATP).toBeLessThan(systemeAuRepos().ions.canalKATP - 0.3)
  })

  it('un glucose à 12 mM dépolarise la membrane', () => {
    expect(systemeStimule().ions.potentielMembrane).toBeGreaterThan(
      systemeAuRepos().ions.potentielMembrane + 15,
    )
  })

  it('un glucose à 12 mM fait entrer le calcium', () => {
    // Le calcium stimulé OSCILLE (vagues SERCA/RyR) : on compare son pic sur
    // une minute au repos, pas un instantané qui peut tomber dans un creux.
    const stimule = systemeStimule()
    let pic = 0
    for (let n = 0; n < 48; n++) {
      avancerSystemeCellulaire(stimule, 5)
      pic = Math.max(pic, stimule.ions.calciumCytosolique)
    }
    expect(pic).toBeGreaterThan(3 * systemeAuRepos().ions.calciumCytosolique)
  })

  it('un glucose à 12 mM déclenche une sécrétion nettement au-dessus du bruit basal', () => {
    expect(systemeStimule().expression.insulineSecretee).toBeGreaterThan(
      5 * systemeAuRepos().expression.insulineSecretee,
    )
  })

  it('la réponse au glucose est graduée : 40 mM sécrète plus que 12 mM', () => {
    const sature = creerSystemeCellulaire(creerEtat())
    sature.milieu.glucoseCible = 40
    avancerSystemeCellulaire(sature, 600)
    expect(sature.expression.insulineSecretee).toBeGreaterThan(
      systemeStimule().expression.insulineSecretee,
    )
  })

  it('un glucose bas laisse les canaux KATP ouverts et la sécrétion basale', () => {
    const affame = creerSystemeCellulaire(creerEtat())
    affame.milieu.glucoseCible = 1
    avancerSystemeCellulaire(affame, 600)
    expect(affame.ions.canalKATP).toBeGreaterThan(0.8)
    expect(affame.expression.insulineSecretee).toBeLessThanOrEqual(
      systemeAuRepos().expression.insulineSecretee,
    )
  })

  it('le bloqueur calcique supprime la sécrétion malgré le glucose', () => {
    const bloque = creerSystemeCellulaire(creerEtat())
    bloque.milieu.glucoseCible = 12
    bloque.milieu.bloqueurCalcique = 1
    avancerSystemeCellulaire(bloque, 600)
    // La dépolarisation a lieu, mais sans entrée de calcium rien ne sort :
    // c'est l'invariant « jamais de sécrétion sans signal calcique ».
    expect(bloque.ions.calciumCytosolique).toBeLessThan(0.0002)
    expect(bloque.expression.insulineSecretee).toBeLessThan(
      0.2 * systemeStimule().expression.insulineSecretee,
    )
  })

  it("l'anoxie rouvre les canaux KATP et éteint la sécrétion malgré le glucose", () => {
    const anoxique = creerSystemeCellulaire(creerEtat())
    anoxique.milieu.glucoseCible = 12
    anoxique.energie.inhibiteurs.anoxie = true
    avancerSystemeCellulaire(anoxique, 600)
    expect(anoxique.ions.canalKATP).toBeGreaterThan(0.8)
    expect(anoxique.expression.insulineSecretee).toBeLessThan(
      0.2 * systemeStimule().expression.insulineSecretee,
    )
  })
})

describe('les invariants du système', () => {
  it('deux systèmes de même graine suivant le même protocole restent identiques', () => {
    const construire = () => {
      const systeme = creerSystemeCellulaire(creerEtat(), 42)
      avancerSystemeCellulaire(systeme, 50)
      systeme.milieu.glucoseCible = 12
      avancerSystemeCellulaire(systeme, 100)
      systeme.energie.inhibiteurs.anoxie = true
      avancerSystemeCellulaire(systeme, 50)
      return systeme
    }
    expect(JSON.stringify(construire())).toBe(JSON.stringify(construire()))
  })

  it('un protocole extrême de dix mille sous-pas laisse chaque nombre fini et borné', () => {
    const systeme = protocoleExtreme()
    chaqueNombre(systeme, 'systeme', (chemin, valeur) => {
      expect(Number.isFinite(valeur), chemin).toBe(true)
    })
    const i = systeme.ions
    expect(i.potentielMembrane).toBeGreaterThanOrEqual(-100)
    expect(i.potentielMembrane).toBeLessThanOrEqual(45)
    expect(i.calciumCytosolique).toBeGreaterThanOrEqual(0.00005)
    expect(i.calciumCytosolique).toBeLessThanOrEqual(0.02)
    expect(systeme.stress.viabilite).toBeGreaterThanOrEqual(0)
    expect(systeme.stress.viabilite).toBeLessThanOrEqual(1)
    for (const [cle, valeur] of Object.entries(systeme.expression)) {
      expect(valeur, `expression.${cle}`).toBeGreaterThanOrEqual(0)
    }
    expect(systeme.expression.insulineGranules).toBeLessThanOrEqual(systeme.profil.capaciteGranules)
  })

  it("l'historique est un anneau borné à deux fois sa taille de profil", () => {
    const systeme = protocoleExtreme()
    expect(systeme.historique.length).toBeLessThanOrEqual(2 * systeme.profil.tailleHistorique)
  })

  it('le témoin reste homéostatique même sous protocole agressif', () => {
    const systeme = protocoleExtreme()
    const temoins = systeme.historique.filter(point => point.serie === 'temoin')
    for (const point of temoins) {
      expect(point.viabilite).toBeGreaterThan(0.9)
      expect(point.potentielMembrane).toBeLessThan(-60)
    }
  })

  it('la réinitialisation ramène le protocole extrême à l’état de départ', () => {
    const systeme = protocoleExtreme()
    reinitialiserSystemeCellulaire(systeme)
    const neuf = creerSystemeCellulaire(creerEtat())
    expect(systeme.temps).toBe(0)
    expect(systeme.milieu).toEqual(neuf.milieu)
    expect(systeme.expression).toEqual(neuf.expression)
    expect(systeme.stress.destin).toBe('homeostasie')
    expect(systeme.historique.length).toBe(2)
    // Les inhibiteurs vivent dans l'état énergétique partagé : la remise à zéro
    // doit aussi les relâcher, sinon le protocole survit à son propre reset.
    expect(estConditionTraitee(systeme)).toBe(false)
  })

  it("estConditionTraitee distingue le repos d'une intervention", () => {
    const systeme = creerSystemeCellulaire(creerEtat())
    expect(estConditionTraitee(systeme)).toBe(false)
    systeme.milieu.bloqueurCalcique = 1
    expect(estConditionTraitee(systeme)).toBe(true)
  })

  it("l'activité de chacun des seize mécanismes reste dans [0, 1], au repos comme à l'extrême", () => {
    for (const systeme of [creerSystemeCellulaire(creerEtat()), protocoleExtreme()]) {
      avancerSystemeCellulaire(systeme, 10)
      for (const cle of CLES_MECANISMES) {
        const activite = activiteMecanisme(systeme, cle)
        expect(activite, cle).toBeGreaterThanOrEqual(0)
        expect(activite, cle).toBeLessThanOrEqual(1)
      }
    }
  })

  it('un pas de temps nul, négatif ou non fini ne change rien', () => {
    const systeme = creerSystemeCellulaire(creerEtat())
    avancerSystemeCellulaire(systeme, 10)
    const avant = JSON.stringify(systeme)
    avancerSystemeCellulaire(systeme, 0)
    avancerSystemeCellulaire(systeme, -5)
    avancerSystemeCellulaire(systeme, Number.NaN)
    expect(JSON.stringify(systeme)).toBe(avant)
  })
})

describe('la consigne de glucose', () => {
  it('tient dans la durée tant que le protocole la maintient', () => {
    const systeme = creerSystemeCellulaire(creerEtat())
    systeme.milieu.glucoseCible = 12
    avancerSystemeCellulaire(systeme, 120)
    expect(systeme.milieu.glucoseExterne).toBeGreaterThan(10)
  })

  it('revient vers la référence quand le protocole la relâche', () => {
    const systeme = creerSystemeCellulaire(creerEtat())
    systeme.milieu.glucoseCible = 12
    avancerSystemeCellulaire(systeme, 120)
    systeme.milieu.glucoseCible = systeme.profil.glucoseReference
    avancerSystemeCellulaire(systeme, 120)
    expect(systeme.milieu.glucoseExterne).toBeLessThan(7)
  })
})
