/**
 * L'ÉTAT ÉNERGÉTIQUE DE LA CELLULE.
 *
 * Le produit n'avait aucun état : chaque mécanisme était une fonction pure du
 * temps écoulé, sans mémoire, sans couplage, sans conservation. Rien de ce qu'on
 * demande — un compteur d'ATP qui bouge, un levier dont l'effet se propage, un
 * ribosome qui s'arrête faute d'énergie — ne peut se poser là-dessus.
 *
 * Ce module est le plus petit moteur qui rende ces trois choses vraies. TROIS
 * variables, pas trente ; un pas de temps fixe ; aucune allocation. Ce n'est pas
 * une simulation de la cellule et il ne faut pas le lire comme telle : c'est un
 * bilan énergétique à compartiments, calibré pour que l'état de repos soit
 * stationnaire et que chaque inhibiteur déplace ce stationnaire là où la
 * biologie le déplace.
 *
 * DEUX DES TROIS EFFETS SONT CONTRE-INTUITIFS, et c'est ce qui fait de ces
 * leviers un objet pédagogique plutôt que trois boutons :
 *
 * — L'oligomycine bloque l'ATP synthase, et la force proton-motrice MONTE. Les
 *   complexes continuent de pomper, et plus rien ne laisse revenir les protons.
 *   C'est la démonstration que l'énergie transite par un gradient et non par une
 *   molécule.
 * — L'ouabaïne bloque la pompe Na⁺/K⁺, et l'ATP MONTE. La pompe en consommait
 *   un quart à elle seule. Ce qui s'effondre, c'est le gradient — donc le
 *   potentiel de membrane. Bloquer une dépense n'est pas couper un revenu.
 *
 * Ces deux signes sont verrouillés par des tests : une « correction » ultérieure
 * qui les remettrait dans le sens intuitif ferait échouer la suite.
 */

/** Ce qui gouverne l'état, et que l'interface manipule. */
export interface Inhibiteurs {
  /** Plus d'oxygène : la chaîne respiratoire n'a plus d'accepteur final. */
  anoxie: boolean
  /** Oligomycine : l'ATP synthase est bloquée, les protons ne redescendent plus. */
  oligomycine: boolean
  /** Ouabaïne : la pompe Na⁺/K⁺ est bloquée. */
  ouabaine: boolean
}

export interface EtatCellule {
  /** Concentration cytosolique d'ATP, en millimolaire. */
  atp: number
  /** Force proton-motrice de la membrane interne, 1 = valeur de repos. */
  forceProtonMotrice: number
  /** Gradient Na⁺/K⁺, 1 = intact, 0 = effondré. */
  gradientNa: number
  inhibiteurs: Inhibiteurs
  /**
   * Temps réel reçu mais pas encore consommé en pas entiers, en secondes.
   *
   * Sans lui, une image plus courte que le pas ne fait avancer l'état de rien
   * ET jette son temps : à 120 images par seconde, chaque image apporte 8,3 ms
   * pour un pas de 16,7 ms, et le moteur reste GELÉ. Le reliquat doit donc
   * survivre d'une image à l'autre.
   */
  reliquat: number
}

// ── Les valeurs de repos ───────────────────────────────────────────────────

/**
 * ATP cytosolique au repos, en millimolaire.
 *
 * Source : concentration d'ATP libre dans le cytosol d'une cellule de
 * mammifère, 1 à 5 mM selon le type cellulaire et la méthode. Confiance [B].
 * On prend 3 mM, milieu de fourchette.
 */
export const ATP_REPOS = 3.0

/**
 * Le flux total d'ATP au repos, en millimolaire par seconde.
 *
 * Une cellule renouvelle la totalité de son pool d'ATP en quelques dizaines de
 * secondes — c'est ce qui fait qu'un arrêt de production se voit en moins d'une
 * minute, et c'est pour cela qu'aucune cellule ne « stocke » d'ATP. Confiance
 * [B] : on prend trente secondes de renouvellement complet.
 */
export const RENOUVELLEMENT_S = 30
export const FLUX_REPOS = ATP_REPOS / RENOUVELLEMENT_S

/**
 * Répartition du budget, en fractions de la dépense brute.
 *
 * Source : parts couramment citées du budget énergétique d'une cellule de
 * mammifère au repos — la pompe Na⁺/K⁺ en prend 20 à 30 %, la synthèse
 * protéique 20 à 30 %, le reste allant au renouvellement des membranes, au
 * transport et à la biosynthèse. Confiance [B]. Dans un neurone la pompe peut
 * monter à la moitié ; on modélise une cellule générique.
 */
export const PART_POMPE = 0.25
export const PART_TRADUCTION = 0.3
export const PART_BASE = 0.45

/**
 * Dépense BRUTE, avant l'atténuation par la disponibilité en ATP.
 *
 * Calibrée pour que la dépense nette à l'état de repos égale exactement la
 * production de repos. C'est cette égalité, et non un réglage à la main, qui
 * fait de l'état de repos un point stationnaire — une cellule qu'on laisse
 * tranquille doit y rester.
 */
const CONSTANTE_DEMI_ATP = 0.3
const DISPO_REPOS = ATP_REPOS / (ATP_REPOS + CONSTANTE_DEMI_ATP)
export const CONSO_BRUTE = FLUX_REPOS / DISPO_REPOS

/**
 * Part de la production venant de la glycolyse.
 *
 * L'oxydation complète d'un glucose rend environ 30 ATP, dont 2 par la seule
 * glycolyse — la valeur de 36 à 38 des vieux manuels ne tient plus compte du
 * coût des navettes. Confiance [A] pour l'ordre, [B] pour le chiffre exact.
 */
export const PART_GLYCOLYSE = 2 / 30
const FLUX_GLYCOLYSE_BASE = FLUX_REPOS * PART_GLYCOLYSE
const FLUX_OXPHOS_MAX = FLUX_REPOS * (1 - PART_GLYCOLYSE)

/**
 * Effet Pasteur : la glycolyse accélère quand l'ATP baisse.
 *
 * Réel, et c'est ce qui empêche une cellule privée d'oxygène de tomber à zéro.
 * Le facteur maximal retenu est 4 ; il vaut 1 quand l'ATP est à sa valeur de
 * repos. Confiance [B] sur l'amplitude.
 */
const PASTEUR_MAX = 3

/**
 * Contrôle respiratoire : la chaîne suit la demande, dans les deux sens.
 *
 * L'ADP est le substrat de l'ATP synthase. Quand le rapport ATP/ADP monte, la
 * chaîne ralentit d'elle-même — c'est ce qui donne au pool une borne haute
 * PHYSIQUE, sans quoi il faudrait un plafond arbitraire, qui serait un mensonge
 * de plus. Mais l'effet joue aussi à la baisse : quand l'ATP manque, l'ADP
 * abonde et la chaîne accélère.
 *
 * C'est la RÉSERVE RESPIRATOIRE, et elle est mesurable : une mitochondrie
 * peut tourner à une fois et demie à trois fois son régime de repos avant de
 * saturer. Confiance [B] sur le facteur, [A] sur l'existence. La borner à 1
 * interdisait toute récupération rapide après une anoxie — il fallait dix
 * minutes pour revenir au repos, contre une vingtaine de secondes ici.
 */
export const ATP_PLAFOND = 5.0
export const RESERVE_RESPIRATOIRE = 2

/** Les seuils de la traduction, en millimolaire. */
export const ATP_ARRET_TRADUCTION = 0.5
export const ATP_CONFORT_TRADUCTION = 2.0

// ── Dynamique de la force proton-motrice ───────────────────────────────────
/**
 * Constantes de la membrane interne, par seconde.
 *
 * `POMPAGE` est la vitesse à laquelle les complexes I, III et IV chargent le
 * gradient ; `SYNTHASE` celle à laquelle il se décharge à travers le rotor ;
 * `FUITE` la fuite de protons, qui est réelle et représente le cinquième environ
 * de la consommation d'oxygène au repos. `SATURATION` est la valeur que le
 * gradient atteindrait si rien ne le déchargeait — le pompage travaille contre
 * lui-même, et c'est cette saturation qui borne la montée sous oligomycine.
 */
const SATURATION_FPM = 1.3
const SYNTHASE = 0.3
const FUITE_PROTONS = 0.06
const POMPAGE = (SYNTHASE + FUITE_PROTONS) / (SATURATION_FPM - 1)

// ── Dynamique du gradient sodium/potassium ─────────────────────────────────
/**
 * La fuite dissipe le gradient en quelques minutes ; la pompe le rétablit en
 * quelques secondes. Cette asymétrie est le fait central : entretenir un
 * gradient coûte peu à chaque instant, mais sans arrêt.
 */
const FUITE_NA = 1 / 180
const POMPE_NA = 0.27
/**
 * Ce que la pompe atteindrait sans fuite.
 *
 * Déduit, et non choisi : c'est la seule valeur pour laquelle le gradient de
 * repos vaut exactement 1. Le poser à 1 tout court ferait de la restauration un
 * terme nul au repos, et le gradient se serait stabilisé à 0,98 — un état de
 * repos qui n'est pas au repos, contre lequel aucune mesure de levier ne
 * tiendrait. Même construction que la saturation de la force proton-motrice.
 */
const SATURATION_NA = 1 + FUITE_NA / POMPE_NA

/** Le pas de temps du moteur, en secondes. Fixe, et découplé de l'affichage. */
export const PAS = 1 / 60

/** Borne une valeur à un intervalle. */
function borner(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x
}

/** Une cellule au repos, tous inhibiteurs levés. */
export function creerEtat(): EtatCellule {
  return {
    atp: ATP_REPOS,
    forceProtonMotrice: 1,
    gradientNa: 1,
    inhibiteurs: { anoxie: false, oligomycine: false, ouabaine: false },
    reliquat: 0,
  }
}

/**
 * Disponibilité de l'ATP pour un travail donné, entre 0 et 1.
 *
 * Aucune réaction consommatrice ne tourne à plein régime quand son substrat
 * s'épuise. Sans ce terme, la dépense resterait constante jusqu'à ce que le pool
 * passe sous zéro, et la cellule mourrait au lieu de s'appauvrir — ce qui est
 * faux, et surtout beaucoup moins instructif.
 */
export function disponibilite(atp: number): number {
  return atp <= 0 ? 0 : atp / (atp + CONSTANTE_DEMI_ATP)
}

/**
 * Régime de la traduction, entre 0 et 1.
 *
 * C'est par ce terme que le levier « couper l'oxygène » atteint l'atelier du
 * gène : sous 0,5 mM le ribosome ne peut plus charger ses ARN de transfert, et
 * la traduction s'arrête. C'est aussi le premier poste qu'une cellule en
 * détresse sacrifie, avant la pompe.
 */
export function regimeTraduction(atp: number): number {
  return borner(
    (atp - ATP_ARRET_TRADUCTION) / (ATP_CONFORT_TRADUCTION - ATP_ARRET_TRADUCTION),
    0,
    1,
  )
}

/** Production d'ATP, en millimolaire par seconde, décomposée par voie. */
export function production(etat: EtatCellule): {
  glycolyse: number
  oxydative: number
  totale: number
} {
  const { atp, forceProtonMotrice, inhibiteurs } = etat

  // Effet Pasteur : plus l'ATP manque, plus la glycolyse tourne vite.
  const pasteur = 1 + PASTEUR_MAX * borner(1 - atp / ATP_REPOS, 0, 1)
  const glycolyse = FLUX_GLYCOLYSE_BASE * pasteur

  // Contrôle respiratoire : la chaîne ralentit quand l'ATP s'accumule, et
  // accélère quand il manque, jusqu'à sa réserve. Vaut exactement 1 au repos,
  // ce qui est la condition pour que le repos reste stationnaire.
  const controle = borner(
    (ATP_PLAFOND - atp) / (ATP_PLAFOND - ATP_REPOS),
    0,
    RESERVE_RESPIRATOIRE,
  )
  // Le gradient au-dessus de sa valeur de repos ne fabrique pas plus d'ATP : il
  // n'est au-dessus que lorsque la synthase est bloquée, donc à débit nul.
  const oxydative = inhibiteurs.oligomycine
    ? 0
    : FLUX_OXPHOS_MAX * Math.min(1, forceProtonMotrice) * controle

  return { glycolyse, oxydative, totale: glycolyse + oxydative }
}

/** Consommation d'ATP, en millimolaire par seconde, décomposée par poste. */
export function consommation(etat: EtatCellule): {
  pompe: number
  traduction: number
  base: number
  totale: number
} {
  const dispo = disponibilite(etat.atp)
  const pompe = etat.inhibiteurs.ouabaine ? 0 : CONSO_BRUTE * PART_POMPE * dispo
  const traduction = CONSO_BRUTE * PART_TRADUCTION * dispo * regimeTraduction(etat.atp)
  const base = CONSO_BRUTE * PART_BASE * dispo
  return { pompe, traduction, base, totale: pompe + traduction + base }
}

/**
 * Avance l'état d'un pas.
 *
 * Intégration explicite, pas fixe. Le pas est petit devant toutes les constantes
 * de temps du modèle — la plus rapide est celle de la force proton-motrice, à
 * 2,8 s —, si bien que le schéma reste stable sans rien de plus élaboré.
 */
export function avancer(etat: EtatCellule, pas: number = PAS): void {
  const { anoxie, oligomycine, ouabaine } = etat.inhibiteurs

  // ── La force proton-motrice ─────────────────────────────────────────────
  // La chaîne charge, la synthase et la fuite déchargent. Bloquer la synthase
  // retire un terme de décharge : le gradient MONTE. C'est le point.
  const charge = anoxie ? 0 : POMPAGE * (SATURATION_FPM - etat.forceProtonMotrice)
  const decharge = (oligomycine ? FUITE_PROTONS : SYNTHASE + FUITE_PROTONS) * etat.forceProtonMotrice
  etat.forceProtonMotrice = Math.max(0, etat.forceProtonMotrice + (charge - decharge) * pas)

  // ── L'ATP ───────────────────────────────────────────────────────────────
  const entree = production(etat).totale
  const sortie = consommation(etat).totale
  etat.atp = Math.max(0, etat.atp + (entree - sortie) * pas)

  // ── Le gradient sodium/potassium ────────────────────────────────────────
  // La pompe ne travaille que si elle est libre ET si elle a de l'ATP : c'est
  // par là que l'anoxie finit par atteindre le potentiel de membrane, sans
  // qu'aucun couplage n'ait été écrit à la main.
  const efficacite = ouabaine ? 0 : disponibilite(etat.atp) / DISPO_REPOS
  const restauration = POMPE_NA * borner(efficacite, 0, 1) * (SATURATION_NA - etat.gradientNa)
  etat.gradientNa = borner(
    etat.gradientNa + (restauration - FUITE_NA * etat.gradientNa) * pas,
    0,
    1,
  )
}

/**
 * Avance de `secondes`, par pas fixes.
 *
 * L'affichage ne commande pas la physique : une image longue consomme plusieurs
 * pas, une image courte n'en consomme aucun et le reliquat s'accumule. Sans
 * cela, le comportement du modèle dépendrait de la cadence de la carte
 * graphique, ce qui est le défaut classique des simulations de navigateur.
 */
export function avancerDe(etat: EtatCellule, secondes: number): number {
  // Borné : un onglet revenu au premier plan ne doit pas faire un bond d'état.
  etat.reliquat += Math.min(Math.max(secondes, 0), 0.5)
  let pasFaits = 0
  while (etat.reliquat >= PAS) {
    avancer(etat, PAS)
    etat.reliquat -= PAS
    pasFaits++
  }
  return pasFaits
}
