import { ATP_REPOS, type EtatCellule } from "./etatCellule.js";
import type { SystemeCellulaire } from "./systemeCellulaire.js";

/**
 * Le contexte cellulaire : ce que les scènes 3D ont le droit de LIRE.
 *
 * Jusqu'ici, le seul pont entre le modèle (~45 variables d'état) et les seize
 * scènes était un scalaire par mécanisme qui modulait la vitesse d'une horloge.
 * Une scène pouvait tourner plus vite ou s'arrêter — jamais changer de
 * comportement. Le rotor de l'ATP synthase ignorait la force proton-motrice
 * pourtant simulée ; les SNARE fusionnaient sans calcium ; les granules
 * n'existaient pas.
 *
 * Ce contexte est la moitié manquante du pont. Il est :
 * - EN LECTURE SEULE : les scènes lisent, seules les EDO écrivent. Une scène
 *   qui voudrait modifier l'état ne compile pas.
 * - DÉRIVÉ, jamais l'état lui-même : les grandeurs sont normalisées (1 = repos)
 *   ou dans leurs unités physiques déclarées, pour qu'une scène n'ait pas à
 *   connaître la tuyauterie interne du modèle.
 * - COMPLET PAR CONSTRUCTION : `contexteRepos()` donne les mêmes champs aux
 *   valeurs stationnaires, si bien qu'une scène se teste sans simuler.
 */
export interface ContexteCellule {
  /** ATP relatif au repos : 1 = pool de repos (3 mM), 0 = épuisé. */
  readonly atp: number;
  /** Force proton-motrice relative : 1 = repos. Monte sous oligomycine. */
  readonly forceProtonMotrice: number;
  /** Gradient Na⁺/K⁺ relatif : 1 = intact, 0 = effondré (ouabaïne). */
  readonly gradientNa: number;
  /** Potentiel de membrane en millivolts (équation de Goldman). */
  readonly potentielMembrane: number;
  /** Calcium cytosolique en millimolaires (~0,0001 au repos). */
  readonly calciumCytosolique: number;
  /** Fraction des canaux K-ATP ouverts, 0 à 1. Se ferme quand ATP/ADP monte. */
  readonly ouvertureKATP: number;
  /** Fraction des canaux calciques voltage-dépendants ouverts, 0 à 1. */
  readonly ouvertureCanalCalcique: number;
  /** Glucose du milieu en millimolaires (5,5 = glycémie de repos). */
  readonly glucoseExterne: number;
  /** Pool de granules d'insuline prêts, en unités du modèle. */
  readonly insulineGranules: number;
  /** Capacité maximale du pool de granules, pour normaliser l'affichage. */
  readonly capaciteGranules: number;
  /** Sécrétion relative à son maximum, 0 à 1. */
  readonly secretionRelative: number;
  /** Stress du réticulum, 0 à 1. */
  readonly stressRE: number;
  /** Protéines mal repliées en attente de dégradation, unités du modèle. */
  readonly proteinesMalRepliees: number;
}

const EPSILON = 1e-9;

function borner(valeur: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(valeur)) return minimum;
  return valeur < minimum ? minimum : valeur > maximum ? maximum : valeur;
}

function atpRelatif(energie: EtatCellule): number {
  return borner(energie.atp / Math.max(EPSILON, ATP_REPOS), 0, 4);
}

/**
 * Le contexte au point stationnaire : une cellule au repos, glycémie 5,5 mM.
 *
 * C'est ce que reçoivent les scènes hors simulation — bancs d'essai, harnais de
 * période, tests. Les valeurs sont celles vers lesquelles `contexteDe` converge
 * après quelques minutes simulées sans traitement.
 */
export function contexteRepos(): ContexteCellule {
  return {
    atp: 1,
    forceProtonMotrice: 1,
    gradientNa: 1,
    potentielMembrane: -70,
    calciumCytosolique: 0.0001,
    ouvertureKATP: 0.75,
    ouvertureCanalCalcique: 0,
    glucoseExterne: 5.5,
    insulineGranules: 8,
    capaciteGranules: 12,
    secretionRelative: 0.02,
    stressRE: 0.04,
    proteinesMalRepliees: 0.05,
  };
}

/**
 * Dérive le contexte du système. Lecture pure : ne modifie rien.
 *
 * Appelée une fois par image dans la boucle, puis passée à chaque scène. Le
 * coût est un objet de treize nombres — négligeable devant le rendu.
 */
export function contexteDe(systeme: SystemeCellulaire): ContexteCellule {
  const energie = systeme.energie as unknown as Record<string, unknown>;
  const fpm = energie.forceProtonMotrice;
  const gradient = energie.gradientNa;
  return {
    atp: atpRelatif(systeme.energie),
    forceProtonMotrice:
      typeof fpm === "number" && Number.isFinite(fpm) ? borner(fpm, 0, 4) : 1,
    gradientNa:
      typeof gradient === "number" && Number.isFinite(gradient)
        ? borner(gradient, 0, 2)
        : 1,
    potentielMembrane: systeme.ions.potentielMembrane,
    calciumCytosolique: systeme.ions.calciumCytosolique,
    ouvertureKATP: borner(systeme.ions.canalKATP, 0, 1),
    ouvertureCanalCalcique: borner(systeme.ions.canalCalcique, 0, 1),
    glucoseExterne: systeme.milieu.glucoseExterne,
    insulineGranules: systeme.expression.insulineGranules,
    capaciteGranules: systeme.profil.capaciteGranules,
    secretionRelative: borner(
      systeme.flux.secretion / Math.max(EPSILON, systeme.profil.secretionMax),
      0,
      1,
    ),
    stressRE: borner(systeme.stress.stressRE, 0, 1),
    proteinesMalRepliees: systeme.expression.proteinesMalRepliees,
  };
}
