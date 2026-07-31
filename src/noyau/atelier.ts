import { creerGene, type Gene } from './gene.js'

/**
 * L'ATELIER DU GÈNE : LA MACHINE À ÉTATS.
 *
 * Elle porte la chaîne de bout en bout — transcrire, coiffer, exporter, DONNER
 * LE BRIN AU RIBOSOME, traduire — et rien de sa logique ne vit dans le code 3D.
 * C'est délibéré : la règle qui donne son sens au geste demandé, « rien ne se
 * traduit tant que le brin n'a pas été déposé », doit être vérifiable par un
 * test. Écrite dans une scène Three.js, une refonte visuelle pourrait la perdre
 * sans que rien ne le signale — c'est précisément ce qui est arrivé au reste du
 * projet.
 *
 * Deux choses que ce module compte, et que rien ne comptait avant :
 *
 * 1. LES LIAISONS RICHES. Deux par nucléotide transcrit — l'incorporation d'un
 *    NTP libère un pyrophosphate, aussitôt hydrolysé —, quatre par acide aminé
 *    posé : deux pour charger l'ARN de transfert (l'ATP y part jusqu'à l'AMP),
 *    un pour eEF1A, un pour eEF2. Une chaîne B d'insuline coûte donc 180 + 120
 *    = 300 liaisons riches, un nombre entier et vérifiable.
 * 2. LES ESSAIS RATÉS. Trois à cinq ARN de transfert viennent cogner le
 *    ribosome avant le bon. Ce n'est pas du décor : cette accumulation de rejets
 *    EST le mécanisme de la fidélité.
 *
 * Ce module ne compte PAS en concentration. Un ribosome unique ne déplace pas
 * le pool d'ATP d'une cellule de 4 000 µm³ — l'effet est de l'ordre de 10⁻¹¹
 * millimolaire par seconde, et prétendre le contraire ferait mentir la jauge.
 * Le couplage va donc dans l'autre sens, qui est le vrai : la concentration
 * d'ATP GOUVERNE le régime du ribosome, et l'atelier compte ses dépenses en
 * molécules.
 */

export type Etape =
  | 'repos'
  | 'transcription'
  | 'coiffe'
  | 'export'
  | 'attente'
  | 'traduction'
  | 'termine'

/** Ce que l'étape en cours demande à l'utilisateur, ou lui raconte. */
export const LIBELLES: Record<Etape, { titre: string; sous: string }> = {
  repos: {
    titre: 'Le gène est fermé',
    sous: "Ouvrez-le pour que l'ARN polymérase vienne s'y poser.",
  },
  transcription: {
    titre: "L'ARN polymérase copie le brin",
    sous: 'Elle ouvre la double hélice sur treize paires de bases et la referme derrière elle.',
  },
  coiffe: {
    titre: 'La coiffe est posée',
    sous: "Dès le vingt-cinquième nucléotide, bien avant la fin — c'est ce qui protège le transcrit.",
  },
  export: {
    titre: "L'ARN messager franchit l'enveloppe",
    sous: "Il doit se déplier pour entrer dans le pore, tête la première, puis se replier.",
  },
  attente: {
    titre: 'Le brin attend un ribosome',
    sous: 'Donnez-le lui : rien ne se traduira tant que la petite sous-unité ne le tiendra pas.',
  },
  traduction: {
    titre: 'Le ribosome traduit',
    sous: 'Un codon à la fois, avec trois à cinq ARN de transfert rejetés avant le bon.',
  },
  termine: {
    titre: 'La protéine est libérée',
    sous: "Le ribosome a rencontré un codon stop et s'est détaché en deux sous-unités.",
  },
}

// ── Le temps ───────────────────────────────────────────────────────────────

/**
 * Le ralenti de référence, celui des deux mécanismes existants.
 *
 * L'ARN polymérase II avance à 60 nucléotides par seconde, le ribosome pose un
 * acide aminé toutes les 170 ms. À ×20, cela fait 3 nucléotides et 0,29 codon
 * par seconde d'écran — lisible.
 */
export const RALENTI_BASE = 20
/** Nucléotides par seconde d'écran, au ralenti de référence. */
const NT_PAR_SECONDE = 60 / RALENTI_BASE
/** Durée d'un codon à l'écran, au ralenti de référence, en secondes. */
export const DUREE_CODON = 0.17 * RALENTI_BASE

const DUREE_COIFFE = 2.2
const DUREE_EXPORT = 4.5

/** Liaisons riches par nucléotide transcrit, et par acide aminé posé. */
export const LIAISONS_PAR_NUCLEOTIDE = 2
export const LIAISONS_PAR_ACIDE_AMINE = 4

/** Nombre d'ARN de transfert rejetés avant le bon, pour chaque codon. */
const ESSAIS_MIN = 3
const ESSAIS_MAX = 5

export interface Atelier {
  gene: Gene
  etape: Etape
  /** Nucléotides transcrits, de 0 à la longueur du gène. */
  bases: number
  /** Codons traduits, de 0 au nombre de codons. */
  codons: number
  /** Avancement dans le codon courant, de 0 à 1. */
  fractionCodon: number
  /** Liaisons riches dépensées depuis le départ, en molécules. */
  liaisons: number
  /** Multiplicateur appliqué au ralenti de référence. 1 = ralenti ×20. */
  vitesse: number
  /** Vrai quand l'utilisateur avance codon par codon. */
  pasAPas: boolean
  /** Temps passé dans l'étape courante, en secondes d'écran. */
  horloge: number
  /** ARN de transfert rejetés sur le codon courant. */
  essais: number
}

export function creerAtelier(): Atelier {
  return {
    gene: creerGene(),
    etape: 'repos',
    bases: 0,
    codons: 0,
    fractionCodon: 0,
    liaisons: 0,
    vitesse: 1,
    pasAPas: false,
    horloge: 0,
    essais: ESSAIS_MIN,
  }
}

/**
 * Le facteur temporel affiché, DÉDUIT de la vitesse effective.
 *
 * La spec exigeait qu'« un test échoue si le badge diverge de ce que l'animation
 * fait réellement » ; ce test n'a jamais existé, et c'est exactement ainsi que
 * la bêta-oxydation a fini par annoncer un accéléré pour un ralenti. Ici le
 * badge n'est pas écrit, il est calculé : il ne peut pas diverger.
 */
export function facteurAffiche(atelier: Atelier): string {
  const facteur = RALENTI_BASE / atelier.vitesse
  if (facteur >= 1.05) {
    const texte = facteur >= 10 ? facteur.toFixed(0) : facteur.toFixed(1).replace('.', ',')
    return `ralenti ×${texte}`
  }
  if (facteur <= 0.95) return `accéléré ×${(1 / facteur).toFixed(1).replace('.', ',')}`
  return 'temps réel'
}

/** Le coût total d'une chaîne, en liaisons riches. Un entier vérifiable. */
export function coutTotal(gene: Gene): number {
  return (
    gene.adn.length * LIAISONS_PAR_NUCLEOTIDE +
    gene.residus.length * LIAISONS_PAR_ACIDE_AMINE
  )
}

// ── Les gestes de l'utilisateur ────────────────────────────────────────────

/** Ouvre le gène. Ne fait rien si la chaîne est déjà lancée. */
export function ouvrirLeGene(atelier: Atelier): boolean {
  if (atelier.etape !== 'repos' && atelier.etape !== 'termine') return false
  reinitialiser(atelier)
  atelier.etape = 'transcription'
  return true
}

/**
 * LE GESTE DEMANDÉ : donner le brin d'ARN au ribosome.
 *
 * Il n'est possible qu'à l'étape « attente », et la traduction ne peut pas
 * démarrer autrement. C'est ce refus qui donne au geste sa portée : sans lui,
 * l'utilisateur regarderait une animation qui se déroule de toute façon.
 */
export function donnerAuRibosome(atelier: Atelier): boolean {
  if (atelier.etape !== 'attente') return false
  atelier.etape = 'traduction'
  atelier.horloge = 0
  atelier.fractionCodon = 0
  return true
}

/** Avance d'un codon entier, en mode pas à pas. */
export function avancerDUnCodon(atelier: Atelier): boolean {
  if (atelier.etape !== 'traduction') return false
  poserUnAcideAmine(atelier)
  return true
}

export function reinitialiser(atelier: Atelier): void {
  atelier.etape = 'repos'
  atelier.bases = 0
  atelier.codons = 0
  atelier.fractionCodon = 0
  atelier.liaisons = 0
  atelier.horloge = 0
  atelier.essais = ESSAIS_MIN
}

// ── L'écoulement ───────────────────────────────────────────────────────────

/** Combien d'essais ratés sur ce codon : déterministe, mais irrégulier. */
function essaisPour(indice: number): number {
  return ESSAIS_MIN + ((indice * 7 + 3) % (ESSAIS_MAX - ESSAIS_MIN + 1))
}

function poserUnAcideAmine(atelier: Atelier): void {
  atelier.codons++
  atelier.liaisons += LIAISONS_PAR_ACIDE_AMINE
  atelier.fractionCodon = 0
  atelier.essais = essaisPour(atelier.codons)
  if (atelier.codons >= atelier.gene.residus.length) {
    atelier.etape = 'termine'
    atelier.horloge = 0
  }
}

/**
 * Avance l'atelier.
 *
 * `regime` vient de l'état de la cellule et vaut entre 0 et 1 : c'est par lui,
 * et par lui seul, que couper l'oxygène arrête le ribosome. À 0 tout se fige
 * sans rien casser — la chaîne reprendra où elle en était quand l'ATP remontera,
 * ce qui est bien ce que fait une cellule réoxygénée.
 */
export function avancerAtelier(atelier: Atelier, dt: number, regime: number): void {
  const allure = atelier.vitesse * Math.max(0, Math.min(1, regime))
  if (allure <= 0) return
  const pas = dt * allure
  atelier.horloge += pas

  switch (atelier.etape) {
    case 'transcription': {
      const total = atelier.gene.adn.length
      const avant = Math.floor(atelier.bases)
      atelier.bases = Math.min(total, atelier.bases + NT_PAR_SECONDE * pas)
      const franchies = Math.floor(atelier.bases) - avant
      if (franchies > 0) atelier.liaisons += franchies * LIAISONS_PAR_NUCLEOTIDE
      if (atelier.bases >= total) {
        atelier.etape = 'coiffe'
        atelier.horloge = 0
      }
      break
    }
    case 'coiffe':
      if (atelier.horloge >= DUREE_COIFFE) {
        atelier.etape = 'export'
        atelier.horloge = 0
      }
      break
    case 'export':
      if (atelier.horloge >= DUREE_EXPORT) {
        atelier.etape = 'attente'
        atelier.horloge = 0
      }
      break
    case 'traduction': {
      // En pas à pas, le temps passe et les ARN de transfert continuent de
      // cogner, mais aucun acide aminé n'est posé sans un geste.
      if (atelier.pasAPas) break
      atelier.fractionCodon += pas / DUREE_CODON
      while (atelier.fractionCodon >= 1 && atelier.etape === 'traduction') {
        atelier.fractionCodon -= 1
        poserUnAcideAmine(atelier)
      }
      break
    }
    default:
      break
  }
}

// ── Ce que l'interface lit ─────────────────────────────────────────────────

/** Le codon actuellement dans le site A, ou null hors traduction. */
export function codonCourant(atelier: Atelier): string | null {
  if (atelier.etape !== 'traduction') return null
  return atelier.gene.codons[atelier.codons] ?? null
}

/** La portion de protéine déjà assemblée. */
export function proteinePartielle(atelier: Atelier): string {
  return atelier.gene.proteine.slice(0, atelier.codons)
}

/** Avancement global de la chaîne, de 0 à 1, toutes étapes confondues. */
export function avancement(atelier: Atelier): number {
  switch (atelier.etape) {
    case 'repos':
      return 0
    case 'transcription':
      return 0.4 * (atelier.bases / atelier.gene.adn.length)
    case 'coiffe':
      return 0.4 + 0.05 * Math.min(1, atelier.horloge / DUREE_COIFFE)
    case 'export':
      return 0.45 + 0.1 * Math.min(1, atelier.horloge / DUREE_EXPORT)
    case 'attente':
      return 0.55
    case 'traduction':
      return 0.55 + 0.45 * (atelier.codons / atelier.gene.residus.length)
    case 'termine':
      return 1
  }
}
