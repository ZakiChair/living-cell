import {
  ATP_REPOS,
  PART_GLYCOLYSE,
  PART_POMPE,
  avancerDe,
  consommation,
  creerEtat,
  disponibilite,
  production,
  regimeTraduction,
  type EtatCellule,
} from "./etatCellule.js";

/**
 * Modele pedagogique deterministe a compartiments d'une cellule beta humaine.
 * Les constantes agregees ne constituent ni un modele clinique, ni un outil de
 * prediction pharmacologique. Elles rendent seulement les couplages explicites.
 */

export type DestinCellulaire =
  | "homeostasie"
  | "stress_adaptatif"
  | "apoptose"
  | "necrose";

export const CLES_MECANISMES = [
  "glycolyse",
  "fermentation",
  "beta-oxydation",
  "krebs",
  "respiration",
  "genome-noyau",
  "crispr-cas9",
  "crispr-cas13",
  "replication-adn",
  "mitose",
  "transcription",
  "epissage",
  "export-nucleaire",
  "traduction-polysome",
  "translocation-sec61",
  "repliement-re",
  "transit-golgi",
  "maturation-granule",
  "transport-moteur",
  "instabilite-dynamique",
  "endocytose-clathrine",
  "exocytose-snare",
  "pompe-sodium-potassium",
  "proteasome",
  "autophagie",
  "apoptose",
  "ilot",
] as const;

export type CleMecanisme = (typeof CLES_MECANISMES)[number];

// La scène range ses clés dans des `string` : ce garde est la frontière typée
// entre ce qu'elle affiche et ce que le modèle sait mesurer.
export function estCleMecanisme(cle: string): cle is CleMecanisme {
  return (CLES_MECANISMES as readonly string[]).includes(cle);
}

export interface ProfilCellulaire {
  nom: string;
  temperatureKelvin: number;
  volumeReposPicolitre: number;
  osmolariteCible: number;
  glucoseReference: number;
  oxygeneReference: number;
  vmaxEntreeGlucose: number;
  vmaxGlycolyse: number;
  vmaxRespiration: number;
  vmaxBetaOxydation: number;
  permeabiliteNa: number;
  permeabiliteK: number;
  permeabiliteCl: number;
  fuiteNa: number;
  fuiteK: number;
  pompeNaKMax: number;
  canalCalciqueMax: number;
  extrusionCalcium: number;
  transcriptionINSMax: number;
  traductionMax: number;
  secretionMax: number;
  capaciteRE: number;
  capaciteGolgi: number;
  capaciteGranules: number;
  capaciteAntioxydante: number;
  pasInterneMax: number;
  periodeHistorique: number;
  tailleHistorique: number;
}

export interface MilieuCellulaire {
  /** Cible de perfusion vers laquelle le renouvellement ramène le glucose. */
  glucoseCible: number;
  glucoseExterne: number;
  oxygeneExterne: number;
  renouvellement: number;
  bloqueurCalcique: number;
  stressRE: number;
  /** Sulfonylurée (0 à 1) : se lie à SUR1 et FERME le canal K-ATP — sécrétion sans glucose. */
  sulfonylure: number;
  /** Diazoxide (0 à 1) : OUVRE le canal K-ATP — silence malgré le glucose. */
  diazoxide: number;
  /**
   * GLP-1 / incrétine (0 à 1) : via son récepteur et l'AMPc, AMPLIFIE
   * l'exocytose calcium-dépendante et la mobilisation des granules — mais ne
   * déclenche rien : sans calcium, multiplier zéro donne zéro. C'est la
   * sécurité des agonistes (sémaglutide) face aux sulfonylurées.
   */
  glp1: number;
  /**
   * Thapsigargine (0 à 1) : bloque la SERCA. Le réservoir calcique fuit sans
   * retour, les vagues cessent, et les chaperons de la lumière — qui
   * travaillent AU calcium — lâchent leurs clients : l'UPR s'allume. L'outil
   * classique pour montrer que le RE est un organite du calcium ET du
   * repliement, d'un seul geste.
   */
  thapsigargine: number;
  /**
   * Adrénaline (0 à 1) : le frein d'urgence. Le récepteur α2, couplé Gi,
   * inhibe la machinerie d'exocytose EN AVAL du calcium — pendant l'effort
   * ou l'hypoglycémie, une cellule pleine de calcium ne sécrète plus.
   */
  adrenaline: number;
  /**
   * Insulite auto-immune (0 à 1) : le diabète de type 1. Les lymphocytes
   * tuent les bêta ; la masse fonctionnelle fond, la sécrétion avec elle, à
   * machinerie intacte. Cinétique compressée (des mois en quelques heures).
   */
  insulite: number;
}

export interface Metabolites {
  glucose: number;
  oxygene: number;
  adp: number;
  pi: number;
  pyruvate: number;
  lactate: number;
  nadh: number;
  acidesGras: number;
}

export interface IonsCellulaires {
  sodiumInterieur: number;
  sodiumExterieur: number;
  potassiumInterieur: number;
  potassiumExterieur: number;
  chlorureInterieur: number;
  chlorureExterieur: number;
  calciumCytosolique: number;
  calciumExterieur: number;
  /** Calcium de la lumière du réticulum, en mM : des CENTAINES de fois le cytosol. */
  calciumRE: number;
  potentielMembrane: number;
  volumePicolitre: number;
  canalKATP: number;
  canalCalcique: number;
  /**
   * Activation LENTE des canaux K⁺ calcium-dépendants (KCa), 0 à 1. C'est le
   * frein différé qui fait OSCILLER la cellule stimulée : le calcium l'arme
   * en une minute, il repolarise, le calcium retombe, il se désarme — et la
   * vague repart. Une cellule bêta stimulée ne plafonne jamais, elle pulse.
   */
  kCa: number;
}

export interface ExpressionProteique {
  preArnINS: number;
  arnINSNucleaire: number;
  arnINSCytosolique: number;
  preproinsuline: number;
  proinsulineRE: number;
  proinsulineGolgi: number;
  /** Somme des deux pools ci-dessous, maintenue à chaque pas : l'affichage et les fiches lisent le total. */
  insulineGranules: number;
  /** Pool AMARRÉ à la membrane (readily releasable) : ce que la première phase vide. */
  granulesAmarres: number;
  /** Pool de RÉSERVE : mobilisé vers la membrane en quelques minutes — la deuxième phase. */
  granulesReserve: number;
  insulineSecretee: number;
  proteinesMalRepliees: number;
}

export interface StressCellulaire {
  ros: number;
  stressRE: number;
  autophagie: number;
  dommage: number;
  viabilite: number;
  destin: DestinCellulaire;
  /**
   * Charge sécrétoire CHRONIQUE, 0 à 1 : l'excès de glycémie intégré avec une
   * constante de temps de ~50 minutes. C'est elle qui distingue le pic
   * post-prandial (inoffensif) de l'hyperglycémie installée (toxique) — la
   * glucotoxicité est une affaire de durée, pas de valeur.
   */
  chargeChronique: number;
}

export interface FluxCellulaires {
  entreeGlucose: number;
  glycolyse: number;
  fermentation: number;
  betaOxydation: number;
  krebs: number;
  respiration: number;
  pompeNaK: number;
  fuiteNa: number;
  fuiteK: number;
  entreeCalcium: number;
  transcription: number;
  maturation: number;
  exportNucleaire: number;
  traduction: number;
  translocationRE: number;
  transportGolgi: number;
  biogeneseGranules: number;
  secretion: number;
  endocytose: number;
  proteasome: number;
  autophagie: number;
  transportMoteur: number;
  dynamiqueMicrotubules: number;
  cycleCellulaire: number;
}

export interface PointHistorique {
  temps: number;
  serie: "temoin" | "traite";
  atpRelatif: number;
  potentielMembrane: number;
  calciumCytosolique: number;
  secretion: number;
  stress: number;
  viabilite: number;
}

export interface SystemeCellulaire {
  energie: EtatCellule;
  profil: ProfilCellulaire;
  milieu: MilieuCellulaire;
  metabolites: Metabolites;
  ions: IonsCellulaires;
  expression: ExpressionProteique;
  stress: StressCellulaire;
  flux: FluxCellulaires;
  temps: number;
  graine: number;
  historique: PointHistorique[];
  curseurHistorique: number;
  prochainEchantillon: number;
  temoinAtpRelatif: number;
  temoinPotentiel: number;
  temoinCalcium: number;
  temoinSecretion: number;
  temoinStress: number;
  temoinViabilite: number;
}

export const PROFIL_BETA_HUMAINE: Readonly<ProfilCellulaire> = Object.freeze({
  nom: "cellule beta pancreatique humaine",
  temperatureKelvin: 310.15,
  volumeReposPicolitre: 1.0,
  osmolariteCible: 300,
  glucoseReference: 5.5,
  oxygeneReference: 0.20,
  vmaxEntreeGlucose: 1.0,
  vmaxGlycolyse: 0.036,
  vmaxRespiration: 0.030,
  vmaxBetaOxydation: 0.006,
  permeabiliteNa: 0.040,
  permeabiliteK: 1.0,
  permeabiliteCl: 0.080,
  // Fuites calibrées pour que le repos ionique soit STATIONNAIRE par
  // construction : fuite = pompe de repos × 140/(gradient de repos), pour
  // 3 Na⁺ et 2 K⁺ par cycle. Les anciennes valeurs (0,010/0,008) perdaient
  // 10 mM de K⁺ par heure au repos — invisible en cinq minutes, dévastateur
  // sur la journée que le scénario du laboratoire fait vivre.
  fuiteNa: 0.0079,
  fuiteK: 0.0052,
  pompeNaKMax: 0.010,
  canalCalciqueMax: 0.0018,
  extrusionCalcium: 0.90,
  transcriptionINSMax: 0.020,
  traductionMax: 0.050,
  secretionMax: 0.025,
  capaciteRE: 1.5,
  capaciteGolgi: 2.0,
  capaciteGranules: 12.0,
  capaciteAntioxydante: 0.18,
  pasInterneMax: 0.05,
  periodeHistorique: 0.5,
  tailleHistorique: 480,
});

const EPSILON = 1e-9;
const GAZ = 8.314462618;
const FARADAY = 96485.33212;

function borner(valeur: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(valeur)) return minimum;
  return valeur < minimum ? minimum : valeur > maximum ? maximum : valeur;
}

function nombreConstante(valeur: unknown, repli: number): number {
  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : repli;
}

function lireSignal(
  fonction: unknown,
  energie: EtatCellule,
  repli: number,
): number {
  try {
    const resultat = (fonction as (etat: EtatCellule) => unknown)(energie);
    return typeof resultat === "number" && Number.isFinite(resultat)
      ? resultat
      : repli;
  } catch {
    return repli;
  }
}

function atpRelatif(energie: EtatCellule): number {
  const brut = energie as unknown as Record<string, unknown>;
  let atp = brut.atp;
  if (typeof atp !== "number") atp = brut.ATP;
  if (typeof atp !== "number") atp = brut.niveauATP;
  if (typeof atp !== "number") atp = brut.reserveATP;
  const repos = Math.max(EPSILON, nombreConstante(ATP_REPOS, 1));
  return typeof atp === "number" && Number.isFinite(atp)
    ? borner(atp / repos, 0, 4)
    : borner(lireSignal(disponibilite, energie, 1), 0, 4);
}

function bruitCentre(systeme: SystemeCellulaire): number {
  let x = systeme.graine | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  systeme.graine = x | 0;
  return ((x >>> 0) / 4294967295) * 2 - 1;
}

function inhibiteursActifs(energie: EtatCellule): boolean {
  const objet = energie as unknown as Record<string, unknown>;
  const inhibiteurs = objet.inhibiteurs;
  if (!inhibiteurs || typeof inhibiteurs !== "object") return false;
  for (const cle in inhibiteurs as Record<string, unknown>) {
    const valeur = (inhibiteurs as Record<string, unknown>)[cle];
    if (valeur === true || (typeof valeur === "number" && valeur > 0)) return true;
  }
  return false;
}

function niveauInhibiteur(energie: EtatCellule, cle: string): number {
  const objet = energie as unknown as Record<string, unknown>;
  const inhibiteurs = objet.inhibiteurs;
  if (!inhibiteurs || typeof inhibiteurs !== "object") return 0;
  const valeur = (inhibiteurs as Record<string, unknown>)[cle];
  if (valeur === true) return 1;
  return typeof valeur === "number" ? borner(valeur, 0, 1) : 0;
}

function avancerEnergie(energie: EtatCellule, dt: number): EtatCellule {
  avancerDe(energie, dt);
  return energie;
}

export function creerSystemeCellulaire(
  energie: EtatCellule,
  graine = 0x6d2b79f5,
): SystemeCellulaire {
  const systeme: SystemeCellulaire = {
    energie,
    profil: PROFIL_BETA_HUMAINE as ProfilCellulaire,
    milieu: {
      glucoseCible: PROFIL_BETA_HUMAINE.glucoseReference,
      glucoseExterne: PROFIL_BETA_HUMAINE.glucoseReference,
      oxygeneExterne: PROFIL_BETA_HUMAINE.oxygeneReference,
      renouvellement: 0.12,
      bloqueurCalcique: 0,
      stressRE: 0,
      sulfonylure: 0,
      diazoxide: 0,
      glp1: 0,
      thapsigargine: 0,
      adrenaline: 0,
      insulite: 0,
    },
    metabolites: {
      glucose: 2.2,
      oxygene: 0.035,
      adp: 1.0,
      pi: 2.5,
      pyruvate: 0.12,
      lactate: 0.8,
      nadh: 0.10,
      acidesGras: 0.35,
    },
    ions: {
      sodiumInterieur: 12,
      sodiumExterieur: 145,
      potassiumInterieur: 140,
      potassiumExterieur: 4.5,
      chlorureInterieur: 35,
      chlorureExterieur: 120,
      calciumCytosolique: 0.0001,
      calciumExterieur: 1.8,
      calciumRE: 0.3,
      potentielMembrane: -70,
      volumePicolitre: PROFIL_BETA_HUMAINE.volumeReposPicolitre,
      canalKATP: 0.8,
      canalCalcique: 0,
      kCa: 0,
    },
    expression: {
      preArnINS: 0.22,
      arnINSNucleaire: 0.28,
      arnINSCytosolique: 1.0,
      preproinsuline: 0.12,
      proinsulineRE: 0.45,
      proinsulineGolgi: 0.55,
      insulineGranules: 8.0,
      granulesAmarres: 0.9,
      granulesReserve: 7.1,
      insulineSecretee: 0,
      proteinesMalRepliees: 0.05,
    },
    stress: {
      ros: 0.04,
      stressRE: 0.04,
      autophagie: 0.12,
      dommage: 0,
      viabilite: 1,
      destin: "homeostasie",
      chargeChronique: 0,
    },
    flux: {
      entreeGlucose: 0,
      glycolyse: 0,
      fermentation: 0,
      betaOxydation: 0,
      krebs: 0,
      respiration: 0,
      pompeNaK: 0,
      fuiteNa: 0,
      fuiteK: 0,
      entreeCalcium: 0,
      transcription: 0,
      maturation: 0,
      exportNucleaire: 0,
      traduction: 0,
      translocationRE: 0,
      transportGolgi: 0,
      biogeneseGranules: 0,
      secretion: 0,
      endocytose: 0,
      proteasome: 0,
      autophagie: 0,
      transportMoteur: 0,
      dynamiqueMicrotubules: 0,
      cycleCellulaire: 0,
    },
    temps: 0,
    graine: graine | 0,
    historique: [],
    curseurHistorique: 0,
    prochainEchantillon: 0,
    temoinAtpRelatif: 1,
    temoinPotentiel: -70,
    temoinCalcium: 0.0001,
    temoinSecretion: 0,
    temoinStress: 0.04,
    temoinViabilite: 1,
  };
  enregistrerHistorique(systeme);
  systeme.prochainEchantillon = systeme.profil.periodeHistorique;
  return systeme;
}

export function reinitialiserSystemeCellulaire(cible: SystemeCellulaire): void {
  const energie = cible.energie;
  const graine = cible.graine;
  Object.assign(energie, creerEtat());
  const neuf = creerSystemeCellulaire(energie, graine);
  cible.profil = neuf.profil;
  cible.milieu = neuf.milieu;
  cible.metabolites = neuf.metabolites;
  cible.ions = neuf.ions;
  cible.expression = neuf.expression;
  cible.stress = neuf.stress;
  cible.flux = neuf.flux;
  cible.temps = neuf.temps;
  cible.historique = neuf.historique;
  cible.curseurHistorique = neuf.curseurHistorique;
  cible.prochainEchantillon = neuf.prochainEchantillon;
  cible.temoinAtpRelatif = neuf.temoinAtpRelatif;
  cible.temoinPotentiel = neuf.temoinPotentiel;
  cible.temoinCalcium = neuf.temoinCalcium;
  cible.temoinSecretion = neuf.temoinSecretion;
  cible.temoinStress = neuf.temoinStress;
  cible.temoinViabilite = neuf.temoinViabilite;
}

function sousPas(systeme: SystemeCellulaire, dt: number): void {
  const p = systeme.profil;
  const m = systeme.metabolites;
  const i = systeme.ions;
  const e = systeme.expression;
  const s = systeme.stress;
  const f = systeme.flux;
  const milieu = systeme.milieu;

  systeme.energie = avancerEnergie(systeme.energie, dt);
  const atp = atpRelatif(systeme.energie);
  const prod = Math.max(0, production(systeme.energie).totale);
  const conso = Math.max(0, consommation(systeme.energie).totale);
  const bilan = borner(prod / (prod + conso + EPSILON), 0, 1);
  const partGlycolyse = borner(nombreConstante(PART_GLYCOLYSE, 0.30), 0, 1);
  const partPompe = borner(nombreConstante(PART_POMPE, 0.25), 0, 1);
  const anoxie = niveauInhibiteur(systeme.energie, "anoxie");
  const oligomycine = niveauInhibiteur(systeme.energie, "oligomycine");
  const ouabaine = niveauInhibiteur(systeme.energie, "ouabaine");
  const facteurOxygene = 1 - anoxie;
  const facteurRespiration = facteurOxygene * (1 - 0.95 * oligomycine);

  milieu.glucoseExterne = borner(
    milieu.glucoseExterne +
      dt * milieu.renouvellement * (milieu.glucoseCible - milieu.glucoseExterne),
    0,
    40,
  );
  milieu.oxygeneExterne = borner(
    milieu.oxygeneExterne +
      dt * milieu.renouvellement * (p.oxygeneReference * facteurOxygene - milieu.oxygeneExterne),
    0,
    1,
  );

  const limiteOxygeneExterne = milieu.oxygeneExterne / (0.015 + milieu.oxygeneExterne);
  const limiteOxygene = m.oxygene / (0.004 + m.oxygene);
  const limiteAdp = m.adp / (0.15 + m.adp);
  const limitePi = m.pi / (0.20 + m.pi);
  // Le transporteur de glucose est un ÉQUILIBREUR, pas une pompe : le flux suit
  // le gradient et sa capacité dépasse d'un ordre de grandeur la phosphorylation,
  // si bien que le glucose interne rejoint l'externe et que l'identité du
  // transporteur (GLUT1/3 chez l'humain, GLUT2 chez le rongeur) ne porte pas le
  // signal. Le capteur, c'est l'étape suivante.
  f.entreeGlucose =
    p.vmaxEntreeGlucose *
    (milieu.glucoseExterne - m.glucose) /
    (17 + milieu.glucoseExterne);
  // La glucokinase est le vrai capteur : demi-saturation vers 8 mM, coopérativité
  // proche de 1,7, pas d'inhibition par son produit. À glycémie de repos elle
  // tourne au tiers de sa capacité — c'est cette MARGE qui transporte le signal,
  // et que l'ancienne saturation (Km 0,2 mM) écrasait.
  const glucokinase =
    Math.pow(m.glucose, 1.7) / (Math.pow(8, 1.7) + Math.pow(m.glucose, 1.7));
  f.glycolyse = p.vmaxGlycolyse * glucokinase * (0.65 + 0.35 * partGlycolyse);
  f.fermentation = f.glycolyse * (1 - limiteOxygene) * 0.90;
  f.betaOxydation =
    p.vmaxBetaOxydation *
    (m.acidesGras / (0.25 + m.acidesGras)) *
    limiteOxygene *
    facteurOxygene;
  f.krebs = Math.min(
    (0.80 * Math.max(0, f.glycolyse - f.fermentation) + f.betaOxydation) *
      facteurRespiration,
    m.pyruvate / Math.max(dt, EPSILON) + 0.5 * f.glycolyse,
  );
  f.respiration =
    p.vmaxRespiration *
    limiteOxygeneExterne *
    limiteOxygene *
    limiteAdp *
    limitePi *
    (m.nadh / (0.06 + m.nadh)) *
    facteurRespiration;

  m.glucose = borner(m.glucose + dt * (f.entreeGlucose - f.glycolyse), 0, 45);
  milieu.glucoseExterne = borner(milieu.glucoseExterne - dt * f.entreeGlucose * 0.05, 0, 40);
  m.oxygene = borner(
    m.oxygene + dt * (0.28 * (milieu.oxygeneExterne - m.oxygene) - 0.55 * f.respiration),
    0,
    1,
  );
  milieu.oxygeneExterne = borner(milieu.oxygeneExterne - dt * f.respiration * 0.01, 0, 1);
  m.pyruvate = borner(m.pyruvate + dt * (2 * f.glycolyse - f.fermentation - f.krebs), 0, 8);
  m.lactate = borner(m.lactate + dt * (f.fermentation - 0.025 * m.lactate), 0, 30);
  m.nadh = borner(m.nadh + dt * (0.6 * f.glycolyse + 2.5 * f.krebs - 3 * f.respiration), 0, 5);
  m.pi = borner(m.pi + dt * (0.08 * conso - 0.09 * f.respiration), 0.02, 8);
  m.acidesGras = borner(m.acidesGras - dt * f.betaOxydation + dt * 0.001, 0, 4);

  // Le rapport ATP/ADP porte le signal glucokinase EN LE MESURANT SUR LE FLUX :
  // c'est la glycolyse simulée — donc le glucose entré, phosphorylé, oxydé —
  // qui ferme les canaux K-ATP, plus le glucose externe en prise directe.
  // Couper le transport, la glycolyse ou l'oxygène éteint le signal à glycémie
  // égale, et c'est vérifié par test. La capacité oxydative module le tout :
  // l'anoxie ou l'oligomycine font retomber le rapport malgré le glucose.
  const signalGlucokinase =
    f.glycolyse /
    Math.max(EPSILON, p.vmaxGlycolyse * (0.65 + 0.35 * partGlycolyse));
  const facteurEnergie = borner(0.12 + 0.88 * facteurRespiration * limiteOxygene, 0, 1);
  const rapportAtpAdp =
    3.2 * signalGlucokinase * facteurEnergie * borner(0.25 + 0.75 * atp, 0, 1.5);
  // Le stock d'ADP affiché reste cohérent avec le rapport : il monte quand la
  // charge énergétique s'effondre, il baisse quand le glucose la regonfle.
  m.adp = borner(
    m.adp + dt * 0.08 * (borner(1 / Math.max(0.15, rapportAtpAdp), 0.2, 6) - m.adp),
    0.02,
    6,
  );
  // Le canal Kir6.2/SUR1 lit l'ATP/ADP — puis la pharmacologie tranche : la
  // sulfonylurée liée à SUR1 le ferme quel que soit le métabolisme, le
  // diazoxide l'ouvre. Deux médicaments opposés sur la même protéine.
  const ouvertureMetabolique = 1 / (1 + Math.pow(rapportAtpAdp / 1.2, 4));
  i.canalKATP = borner(
    ouvertureMetabolique * (1 - 0.95 * borner(milieu.sulfonylure, 0, 1)) +
      (1 - ouvertureMetabolique) * 0.92 * borner(milieu.diazoxide, 0, 1),
    0,
    1,
  );
  // Deux familles de canaux K⁺ tirent le potentiel vers le bas : les K-ATP,
  // que le métabolisme ferme, et les KCa, que le calcium OUVRE — lentement.
  // Ce second frein, différé d'une minute, est ce qui fait pulser la cellule
  // stimulée au lieu de la laisser plafonner.
  const permeabiliteKEffective =
    p.permeabiliteK * (0.12 + 0.88 * i.canalKATP) + 0.10 * i.kCa;
  const numerateurGoldman =
    permeabiliteKEffective * i.potassiumExterieur +
    p.permeabiliteNa * i.sodiumExterieur +
    p.permeabiliteCl * i.chlorureInterieur;
  const denominateurGoldman =
    permeabiliteKEffective * i.potassiumInterieur +
    p.permeabiliteNa * i.sodiumInterieur +
    p.permeabiliteCl * i.chlorureExterieur;
  const goldman =
    (1000 * GAZ * p.temperatureKelvin / FARADAY) *
    Math.log(Math.max(EPSILON, numerateurGoldman) / Math.max(EPSILON, denominateurGoldman));
  i.potentielMembrane = borner(
    i.potentielMembrane + dt * 4 * (borner(goldman, -100, 30) - i.potentielMembrane),
    -100,
    45,
  );

  // La vraie pompe répond au sodium interne (Hill sur Na⁺, K½ ~15 mM) :
  // c'est elle qui répare les gradients après l'effort — une pompe à débit
  // fixe laisserait la cellule dépolarisée toute la nuit.
  const reponseSodium = 0.4 + 1.6 *
    (Math.pow(i.sodiumInterieur, 2) /
      (Math.pow(15, 2) + Math.pow(i.sodiumInterieur, 2)));
  f.pompeNaK =
    p.pompeNaKMax *
    partPompe *
    reponseSodium *
    borner(atp, 0, 1.5) *
    (0.7 + 0.3 * bilan) *
    (1 - ouabaine);
  f.fuiteNa = p.fuiteNa * (i.sodiumExterieur - i.sodiumInterieur) / 140;
  f.fuiteK = p.fuiteK * (i.potassiumInterieur - i.potassiumExterieur) / 140;
  i.sodiumInterieur = borner(i.sodiumInterieur + dt * (f.fuiteNa - 3 * f.pompeNaK), 1, 80);
  i.sodiumExterieur = borner(i.sodiumExterieur + dt * (3 * f.pompeNaK - f.fuiteNa) * 0.02, 80, 180);
  i.potassiumInterieur = borner(i.potassiumInterieur + dt * (2 * f.pompeNaK - f.fuiteK), 60, 180);
  i.potassiumExterieur = borner(i.potassiumExterieur + dt * (f.fuiteK - 2 * f.pompeNaK) * 0.02, 1, 20);

  const osmolariteInterne =
    i.sodiumInterieur + i.potassiumInterieur + i.chlorureInterieur + 115;
  const volumePrecedent = i.volumePicolitre;
  const volumeCible = p.volumeReposPicolitre * osmolariteInterne / p.osmolariteCible;
  i.volumePicolitre = borner(
    i.volumePicolitre + dt * 0.25 * (volumeCible - i.volumePicolitre),
    0.65 * p.volumeReposPicolitre,
    1.60 * p.volumeReposPicolitre,
  );
  const dilution = volumePrecedent / Math.max(EPSILON, i.volumePicolitre);
  i.sodiumInterieur = borner(i.sodiumInterieur * dilution, 1, 80);
  i.potassiumInterieur = borner(i.potassiumInterieur * dilution, 60, 180);
  i.chlorureInterieur = borner(i.chlorureInterieur * dilution, 5, 100);

  const activationVoltage = 1 / (1 + Math.exp(-(i.potentielMembrane + 28) / 6));
  i.canalCalcique = borner(activationVoltage * (1 - milieu.bloqueurCalcique), 0, 1);
  f.entreeCalcium =
    p.canalCalciqueMax * i.canalCalcique * Math.max(0, i.calciumExterieur - i.calciumCytosolique);
  // Le réticulum est un vrai coffre à calcium : la SERCA le remplit contre
  // trois ordres de grandeur (elle brûle de l'ATP pour ça), une fuite et le
  // CICR — le calcium qui appelle le calcium par les récepteurs de la
  // ryanodine — le rendent. Le facteur 20 est le rapport des volumes : un
  // flux cytosolique se concentre d'autant dans la lumière.
  const ca = i.calciumCytosolique;
  // La fuite passive du réticulum est réelle et permanente (le translocon
  // lui-même fuit) : la SERCA pompe sans cesse contre elle — c'est pourquoi
  // la thapsigargine vide le coffre en un quart d'heure.
  const fluxSerca =
    0.001 * borner(atp, 0, 1) * (1 - borner(milieu.thapsigargine, 0, 1)) *
    (ca * ca) / (0.0004 * 0.0004 + ca * ca);
  // Le RyR est sensibilisé par le calcium LUMINAL : un réservoir plein se
  // déclenche, un réservoir vidé se tait. C'est cette sensibilité — mesurée
  // sur le récepteur réel — qui fait du couple SERCA/RyR un oscillateur :
  // recharge lente (~2 min), décharge brève, et la vague repart.
  // L'oscillation exige que l'équilibre soit INSTABLE : le CICR cytosolique
  // est régénératif — un début de libération élève le calcium, qui ouvre le
  // récepteur davantage — et l'emballement ne s'arrête que quand le réservoir
  // est vide. La sensibilité luminale arme le système à réservoir plein.
  const sensibiliteLuminale =
    Math.pow(i.calciumRE, 6) / (Math.pow(0.4, 6) + Math.pow(i.calciumRE, 6));
  const ouvertureRyR =
    0.02 *
    (Math.pow(ca, 4) / (Math.pow(0.0008, 4) + Math.pow(ca, 4))) *
    sensibiliteLuminale;
  const fluxVidangeRE =
    (0.0005 + ouvertureRyR) * Math.max(0, i.calciumRE - ca);
  // Facteur 2, pas 10 : le rapport des volumes donnerait ×10, mais la lumière
  // est massivement TAMPONNÉE (calséquestrine, calréticuline — plus de 90 %
  // du calcium y est lié). C'est ce tampon qui fait du réservoir la variable
  // LENTE de l'oscillateur : il se vide en trente secondes, se recharge en
  // quatre minutes, et c'est la période des vagues.
  i.calciumRE = borner(i.calciumRE + dt * 2 * (fluxSerca - fluxVidangeRE), 0.02, 1.0);
  i.calciumCytosolique = borner(
    ca +
      dt *
        (f.entreeCalcium + fluxVidangeRE - fluxSerca -
          p.extrusionCalcium * Math.max(0, ca - 0.0001)),
    0.00005,
    0.02,
  );
  // Le frein KCa s'arme sur le calcium avec une minute de retard, et se
  // désarme de même : c'est ce décalage qui fabrique les vagues.
  const cibleKCa =
    Math.pow(i.calciumCytosolique, 3) /
    (Math.pow(0.0006, 3) + Math.pow(i.calciumCytosolique, 3));
  i.kCa = borner(i.kCa + dt * (1 / 55) * (cibleKCa - i.kCa), 0, 1);

  const glucoseSignal = milieu.glucoseExterne / (8 + milieu.glucoseExterne);
  const regimeImporte = borner(lireSignal(regimeTraduction, systeme.energie, atp), 0, 1);
  const transcriptionRegime = borner(0.20 + 0.75 * glucoseSignal - 0.35 * s.stressRE, 0, 1);
  const maturationRegime = borner(atp * (1 - 0.45 * s.stressRE), 0, 1);
  const exportRegime = borner(atp * (1 - 0.30 * s.dommage), 0, 1);
  const traductionRegime = borner(regimeImporte * (1 - 0.70 * s.stressRE), 0, 1);
  // Le glucose stimule DIRECTEMENT la traduction de la proinsuline —
  // dérépression traductionnelle par les UTR, ×5 à ×10 publiés en aigu ; le
  // modèle en retient un facteur ~1,7 pour rester dans sa gamme de flux.
  const stimulationTraduction =
    0.3 +
    0.9 *
      (Math.pow(milieu.glucoseExterne, 2) / (64 + Math.pow(milieu.glucoseExterne, 2)));
  f.transcription = p.transcriptionINSMax * transcriptionRegime * (1 + 0.015 * bruitCentre(systeme));
  f.maturation = 0.030 * maturationRegime * e.preArnINS;
  f.exportNucleaire = 0.025 * exportRegime * e.arnINSNucleaire;
  f.traduction =
    p.traductionMax * traductionRegime * stimulationTraduction *
    e.arnINSCytosolique / (0.4 + e.arnINSCytosolique);
  f.translocationRE = f.traduction * borner(atp * (1 - s.stressRE), 0, 1);
  f.transportGolgi = 0.035 * borner(atp, 0, 1) * e.proinsulineRE / (0.3 + e.proinsulineRE);
  // Le stress du réticulum étrangle la voie sécrétoire entière : une cellule
  // en crise fabrique moins de granules. Le trop-plein du stock, lui, est
  // écrêté par la borne de capacité — c'est la crinophagie implicite : les
  // granules excédentaires partent à la dégradation lysosomale.
  f.biogeneseGranules =
    0.028 * borner(atp, 0, 1) *
    (e.proinsulineGolgi / (0.3 + e.proinsulineGolgi)) *
    borner(1 - 2.6 * s.stressRE, 0, 1);
  const calciumHill = Math.pow(i.calciumCytosolique, 3) /
    (Math.pow(0.0007, 3) + Math.pow(i.calciumCytosolique, 3));
  // Le GLP-1 AMPLIFIE l'exocytose calcium-dépendante et la mobilisation des
  // granules (récepteur → AMPc → PKA/Epac2, non détaillés individuellement).
  // Sans calcium, multiplier zéro donne zéro : la glucose-dépendance des
  // agonistes n'est pas une règle ajoutée, elle émerge de la chaîne.
  // L'amplification est PONDÉRÉE par le calcium : Epac2 agit sur la fusion
  // que le calcium déclenche, pas sur le bruit basal — c'est ce qui rend le
  // GLP-1 incapable de provoquer une hypoglycémie.
  const incretine =
    1 + 1.3 * borner(milieu.glp1, 0, 1) * (calciumHill / (0.08 + calciumHill));
  // Seul le pool AMARRÉ peut fusionner, et il fusionne VITE : la première
  // phase de la sécrétion est sa vidange, en deux ou trois minutes.
  const CAPACITE_AMARRES = 1.2;
  // Deux facteurs que la vraie sécrétion porte toujours : la MASSE
  // fonctionnelle (l'insulite la fait fondre — chaque survivante marche,
  // il y en a juste moins) et le frein α2 de l'adrénaline, DISTAL au
  // calcium — la machinerie d'exocytose elle-même est inhibée.
  const masseFonctionnelle = borner(s.viabilite, 0, 1);
  const freinAlpha2 = 1 - 0.85 * borner(milieu.adrenaline, 0, 1);
  f.secretion =
    3.0 * p.secretionMax * calciumHill * borner(atp, 0, 1) * incretine *
    masseFonctionnelle * freinAlpha2 *
    (e.granulesAmarres / (0.35 + e.granulesAmarres));
  // La réserve rejoint la membrane bien plus lentement — transport sur
  // l'actine corticale, amorçage — et c'est ELLE qui fixe la deuxième phase :
  // un plateau sous le pic, jamais un arrêt.
  // Le recrutement est lui-même calcium-dépendant : la deuxième phase GRANDIT
  // avec le stimulus, elle ne fait pas que survivre au pic.
  // La masse et le frein α2 portent sur TOUTE la machinerie : en régime,
  // sécrétion = mobilisation (conservation), un frein sur la seule fusion
  // ne serait que transitoire. L'α2 baisse l'AMPc, qui pilote aussi le
  // recrutement ; l'insulite retire des cellules entières.
  const mobilisation =
    0.006 * masseFonctionnelle * (1 - 0.75 * borner(milieu.adrenaline, 0, 1)) *
    (0.3 + 0.7 * (calciumHill / (0.15 + calciumHill))) *
    (1 - borner(e.granulesAmarres / CAPACITE_AMARRES, 0, 1)) *
    (e.granulesReserve / (2 + e.granulesReserve)) *
    (1 + 0.8 * borner(milieu.glp1, 0, 1)) *
    borner(atp, 0, 1);
  f.endocytose = 0.35 * f.secretion * borner(atp, 0, 1);
  f.proteasome = 0.018 * borner(atp, 0, 1) * e.proteinesMalRepliees;

  // Les moteurs moléculaires ne marchent que s'il y a du fret ET de l'ATP. La
  // kinésine était pilotée par le seul flux RE→Golgi — ni son carburant ni
  // l'essentiel de sa cargaison. Son flux agrège désormais tout le trafic
  // vésiculaire : antérograde (RE→Golgi, biogenèse des granules, exocytose)
  // et rétrograde (endocytose).
  f.transportMoteur =
    borner(atp, 0, 1) *
    (f.transportGolgi + f.biogeneseGranules + f.secretion + f.endocytose);
  // La tubuline lie le GTP, pas l'ATP, mais le pool de GTP suit la charge
  // énergétique par la nucléoside-diphosphate kinase : la dynamique des
  // microtubules est donc asservie à l'ATP relatif. Le plancher n'est pas un
  // artifice de scène : privé de GTP, un microtubule cesse de pousser mais
  // continue de s'effondrer — la dynamique ralentit, elle ne gèle pas.
  f.dynamiqueMicrotubules = borner(0.15 + 0.85 * borner(atp, 0, 1), 0, 1);
  // Pas un vrai cycle cellulaire : une horloge de démonstration pour les
  // scènes de réplication et de mitose, gagée sur l'énergie (fourche et
  // fuseau consomment ATP et GTP) et sur la viabilité — une cellule qui meurt
  // ne se divise pas. Le vrai contrôle, cyclines/CDK et points de contrôle,
  // n'est pas modélisé, et les fiches des scènes le déclarent.
  f.cycleCellulaire = borner(atp, 0, 1) * s.viabilite;

  const surchargeRE = Math.max(0, e.proinsulineRE + e.proteinesMalRepliees - p.capaciteRE);
  const surchargeGolgi = Math.max(0, e.proinsulineGolgi - p.capaciteGolgi);
  e.preArnINS = borner(e.preArnINS + dt * (f.transcription - f.maturation - 0.006 * e.preArnINS), 0, 10);
  e.arnINSNucleaire = borner(e.arnINSNucleaire + dt * (f.maturation - f.exportNucleaire - 0.004 * e.arnINSNucleaire), 0, 10);
  e.arnINSCytosolique = borner(e.arnINSCytosolique + dt * (f.exportNucleaire - 0.008 * e.arnINSCytosolique), 0, 20);
  e.preproinsuline = borner(e.preproinsuline + dt * (f.traduction - f.translocationRE - 0.01 * e.preproinsuline), 0, 10);
  // Une part de la proinsuline se replie MAL — 15 à 20 % même chez une
  // cellule saine, publié — et cette part croît avec la charge sécrétoire
  // que la glycémie impose. C'est le cœur de la glucotoxicité : une
  // hyperglycémie PONCTUELLE se paie en travail, une hyperglycémie
  // CHRONIQUE se paie en protéines ratées qui saturent le réticulum.
  const fractionMalRepliee = borner(0.06 + 0.52 * s.chargeChronique, 0.06, 0.55);
  e.proinsulineRE = borner(
    e.proinsulineRE +
      dt * ((1 - fractionMalRepliee) * f.translocationRE - f.transportGolgi - 0.008 * e.proinsulineRE),
    0,
    10,
  );
  e.proinsulineGolgi = borner(e.proinsulineGolgi + dt * (f.transportGolgi - f.biogeneseGranules - 0.006 * e.proinsulineGolgi), 0, 12);
  e.granulesReserve = borner(
    e.granulesReserve + dt * (f.biogeneseGranules - mobilisation),
    0,
    p.capaciteGranules,
  );
  e.granulesAmarres = borner(
    e.granulesAmarres + dt * (mobilisation - f.secretion),
    0,
    CAPACITE_AMARRES,
  );
  e.insulineGranules = e.granulesAmarres + e.granulesReserve;
  e.insulineSecretee = borner(e.insulineSecretee + dt * f.secretion, 0, 1e6);
  e.proteinesMalRepliees = borner(
    e.proteinesMalRepliees +
      dt * (fractionMalRepliee * f.translocationRE + 0.03 * surchargeRE + 0.01 * surchargeGolgi + 0.02 * milieu.stressRE - f.proteasome),
    0,
    10,
  );

  // L'excès de glycémie s'intègre lentement : un repas passe, un diabète reste.
  s.chargeChronique = borner(
    s.chargeChronique +
      dt * (1 / 3000) * (borner((milieu.glucoseExterne - 8) / 7, 0, 1) - s.chargeChronique),
    0,
    1,
  );
  const pressionOxydante = 1.8 * f.respiration + 0.8 * f.betaOxydation + 0.25 * s.dommage;
  s.ros = borner(s.ros + dt * (pressionOxydante - p.capaciteAntioxydante * s.ros), 0, 5);
  // Les chaperons de la lumière travaillent AU calcium : un réticulum vidé
  // (thapsigargine, stress prolongé) replie mal, quel que soit le flux entrant.
  const carenceCalciumRE = Math.max(0, (0.12 - i.calciumRE) / 0.12);
  s.stressRE = borner(
    s.stressRE + dt * (0.12 * surchargeRE + 0.10 * e.proteinesMalRepliees + 0.18 * milieu.stressRE + 0.045 * carenceCalciumRE - 0.08 * s.autophagie - 0.06 * s.stressRE),
    0,
    1,
  );
  s.autophagie = borner(0.08 + 0.62 * s.stressRE + 0.25 * s.ros + 0.12 * (1 - borner(atp, 0, 1)), 0, 1);
  f.autophagie = 0.025 * s.autophagie * borner(atp, 0, 1);
  s.dommage = borner(
    s.dommage + dt * (0.055 * Math.max(0, s.ros - 0.35) + 0.045 * Math.max(0, s.stressRE - 0.45) + 0.00008 * borner(milieu.insulite, 0, 1) - 0.025 * s.autophagie * (1 - s.dommage)),
    0,
    1,
  );
  s.viabilite = borner(
    s.viabilite - dt * (0.025 * s.dommage + 0.015 * Math.max(0, s.stressRE - 0.75) + 0.020 * Math.max(0, 0.25 - atp) + 0.00012 * borner(milieu.insulite, 0, 1)),
    0,
    1,
  );
  if (s.viabilite < 0.18 || (atp < 0.12 && s.dommage > 0.72)) s.destin = "necrose";
  else if (s.viabilite < 0.48 || s.dommage > 0.72) s.destin = "apoptose";
  else if (s.stressRE > 0.28 || s.ros > 0.35 || s.dommage > 0.18) s.destin = "stress_adaptatif";
  else s.destin = "homeostasie";

  // Le temoin est une reference homeostatique lisse, pas une seconde cellule simulee.
  systeme.temoinAtpRelatif += dt * 0.25 * (1 - systeme.temoinAtpRelatif);
  systeme.temoinPotentiel += dt * 0.25 * (-70 - systeme.temoinPotentiel);
  systeme.temoinCalcium += dt * 0.25 * (0.0001 - systeme.temoinCalcium);
  systeme.temoinSecretion += dt * 0.25 * (0.001 - systeme.temoinSecretion);
  systeme.temoinStress += dt * 0.20 * (0.04 - systeme.temoinStress);
  systeme.temoinViabilite += dt * 0.10 * (1 - systeme.temoinViabilite);
  systeme.temps += dt;
}

function ajouterPoint(systeme: SystemeCellulaire, point: PointHistorique): void {
  const capacite = Math.max(2, systeme.profil.tailleHistorique * 2);
  if (systeme.historique.length < capacite) systeme.historique.push(point);
  else {
    systeme.historique[systeme.curseurHistorique] = point;
    systeme.curseurHistorique = (systeme.curseurHistorique + 1) % capacite;
  }
}

function enregistrerHistorique(systeme: SystemeCellulaire): void {
  ajouterPoint(systeme, {
    temps: systeme.temps,
    serie: "temoin",
    atpRelatif: systeme.temoinAtpRelatif,
    potentielMembrane: systeme.temoinPotentiel,
    calciumCytosolique: systeme.temoinCalcium,
    secretion: systeme.temoinSecretion,
    stress: systeme.temoinStress,
    viabilite: systeme.temoinViabilite,
  });
  ajouterPoint(systeme, {
    temps: systeme.temps,
    serie: "traite",
    atpRelatif: atpRelatif(systeme.energie),
    potentielMembrane: systeme.ions.potentielMembrane,
    calciumCytosolique: systeme.ions.calciumCytosolique,
    secretion: systeme.flux.secretion,
    stress: Math.max(systeme.stress.ros, systeme.stress.stressRE),
    viabilite: systeme.stress.viabilite,
  });
}

export function avancerSystemeCellulaire(
  systeme: SystemeCellulaire,
  dt: number,
): SystemeCellulaire {
  if (!Number.isFinite(dt) || dt <= 0) return systeme;
  let restant = Math.min(dt, 3600);
  const pasMax = Math.max(0.001, systeme.profil.pasInterneMax);
  while (restant > EPSILON) {
    const pas = restant > pasMax ? pasMax : restant;
    sousPas(systeme, pas);
    restant -= pas;
    if (systeme.temps + EPSILON >= systeme.prochainEchantillon) {
      enregistrerHistorique(systeme);
      systeme.prochainEchantillon += Math.max(0.01, systeme.profil.periodeHistorique);
    }
  }
  return systeme;
}

export function activiteMecanisme(
  systeme: SystemeCellulaire,
  cle: CleMecanisme,
): number {
  const f = systeme.flux;
  const p = systeme.profil;
  switch (cle) {
    case "glycolyse": return borner(f.glycolyse / Math.max(EPSILON, p.vmaxGlycolyse), 0, 1);
    case "fermentation": return borner(f.fermentation / Math.max(EPSILON, p.vmaxGlycolyse), 0, 1);
    case "beta-oxydation": return borner(f.betaOxydation / Math.max(EPSILON, p.vmaxBetaOxydation), 0, 1);
    case "krebs": return borner(f.krebs / Math.max(EPSILON, p.vmaxRespiration), 0, 1);
    case "respiration": return borner(f.respiration / Math.max(EPSILON, p.vmaxRespiration), 0, 1);
    // Le patrimoine génétique dérive toujours : son horloge ne dépend que
    // de l'énergie disponible, jamais d'un flux — un noyau ne s'arrête pas.
    case "genome-noyau": return borner(0.25 + 0.75 * borner(atpRelatif(systeme.energie), 0, 1), 0, 1);
    // CRISPR est un OUTIL : rien dans la cellule ne le régule. Il tourne à
    // vitesse constante tant qu'il y a de quoi vivre — c'est le seul
    // mécanisme du site qui vienne du dehors.
    case "crispr-cas9":
    case "crispr-cas13": return borner(0.4 + 0.6 * borner(atpRelatif(systeme.energie), 0, 1), 0, 1);
    case "replication-adn": return borner(f.cycleCellulaire, 0, 1);
    case "mitose": return borner(f.cycleCellulaire, 0, 1);
    case "transcription": return borner(f.transcription / Math.max(EPSILON, p.transcriptionINSMax), 0, 1);
    case "epissage": return borner(f.maturation / 0.03, 0, 1);
    case "export-nucleaire": return borner(f.exportNucleaire / 0.025, 0, 1);
    case "traduction-polysome": return borner(f.traduction / Math.max(EPSILON, p.traductionMax), 0, 1);
    case "translocation-sec61": return borner(f.translocationRE / Math.max(EPSILON, p.traductionMax), 0, 1);
    // La vie d'une protéine : chaque étape suit le flux du pool qu'elle draine.
    case "repliement-re": return borner(f.translocationRE / Math.max(EPSILON, p.traductionMax), 0, 1);
    case "transit-golgi": return borner(f.transportGolgi / 0.035, 0, 1);
    case "maturation-granule": return borner(f.biogeneseGranules / 0.028, 0, 1);
    case "transport-moteur":
      // Normalisé par le trafic à pleine capacité : voies antérogrades aux
      // maxima de leurs cinétiques, sécrétion saturée et son retour membranaire.
      return borner(
        f.transportMoteur / (0.035 + 0.028 + 1.35 * p.secretionMax),
        0,
        1,
      );
    case "instabilite-dynamique": return borner(f.dynamiqueMicrotubules, 0, 1);
    case "endocytose-clathrine": return borner(f.endocytose / Math.max(EPSILON, 0.35 * p.secretionMax), 0, 1);
    case "exocytose-snare": return borner(f.secretion / Math.max(EPSILON, p.secretionMax), 0, 1);
    case "pompe-sodium-potassium": return borner(f.pompeNaK / Math.max(EPSILON, p.pompeNaKMax), 0, 1);
    case "proteasome": return borner(f.proteasome / 0.018, 0, 1);
    case "autophagie": return borner(systeme.stress.autophagie, 0, 1);
    case "ilot":
      // L'îlot bat même au repos — oscillations basales — et s'emballe avec
      // la sécrétion de la cellule qu'il entoure.
      return borner(0.25 + 0.75 * (f.secretion / Math.max(EPSILON, p.secretionMax)), 0, 1);
    case "apoptose":
      // Dans une cellule saine, la scène ne tourne PAS : l'horloge de
      // l'exécution ne démarre qu'avec le déclin de la viabilité ou le
      // verdict du modèle. C'est le seul mécanisme dont l'arrêt est le
      // comportement normal.
      return borner(
        1.4 * (1 - systeme.stress.viabilite) +
          (systeme.stress.destin === "apoptose" || systeme.stress.destin === "necrose"
            ? 0.5
            : 0),
        0,
        1,
      );
  }
}

export function regimesAtelier(systeme: SystemeCellulaire): {
  transcription: number;
  maturation: number;
  export: number;
  traduction: number;
} {
  const atp = borner(atpRelatif(systeme.energie), 0, 1);
  const glucose = systeme.milieu.glucoseExterne;
  const stress = systeme.stress;
  return {
    transcription: borner(0.20 + 0.75 * glucose / (8 + glucose) - 0.35 * stress.stressRE, 0, 1),
    maturation: borner(atp * (1 - 0.45 * stress.stressRE), 0, 1),
    export: borner(atp * (1 - 0.30 * stress.dommage), 0, 1),
    traduction: borner(
      lireSignal(regimeTraduction, systeme.energie, atp) * (1 - 0.70 * stress.stressRE),
      0,
      1,
    ),
  };
}

// La presence d'un traitement est deduite sans copier ni remplacer energie.inhibiteurs.
export function estConditionTraitee(systeme: SystemeCellulaire): boolean {
  return inhibiteursActifs(systeme.energie) ||
    systeme.milieu.bloqueurCalcique > 0 ||
    systeme.milieu.stressRE > 0 ||
    systeme.milieu.sulfonylure > 0 ||
    systeme.milieu.diazoxide > 0 ||
    systeme.milieu.glp1 > 0 ||
    systeme.milieu.thapsigargine > 0 ||
    systeme.milieu.adrenaline > 0 ||
    systeme.milieu.insulite > 0;
}
