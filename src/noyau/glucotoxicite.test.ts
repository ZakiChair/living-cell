import { describe, expect, it } from "vitest";
import { creerEtat } from "./etatCellule.js";
import {
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";

/**
 * La glucotoxicité : le cœur cellulaire du diabète de type 2.
 *
 * Une hyperglycémie PONCTUELLE est le métier de la cellule bêta ; une
 * hyperglycémie CHRONIQUE est son poison. Sous 15 mM soutenus, la demande de
 * synthèse dépasse la capacité du réticulum : la proinsuline s'y accumule, le
 * stress monte, la traduction freine (PERK), les granules se vident plus vite
 * qu'ils ne se remplissent, et le destin bascule. Rien de tout cela n'est
 * scripté : c'est le modèle existant poussé dans son régime pathologique.
 */

// `avancerSystemeCellulaire` plafonne chaque appel à une heure simulée : les
// heures s'avancent une par une, comme elles se vivent.
function heuresDurant(systeme: ReturnType<typeof creerSystemeCellulaire>, heures: number) {
  for (let h = 0; h < heures; h++) avancerSystemeCellulaire(systeme, 3600);
  return systeme;
}

function apresChronique(heures: number) {
  const systeme = creerSystemeCellulaire(creerEtat());
  systeme.milieu.glucoseCible = 15;
  return heuresDurant(systeme, heures);
}

function auRepos(heures: number) {
  return heuresDurant(creerSystemeCellulaire(creerEtat()), heures);
}

describe("l'hyperglycémie chronique abîme la cellule — la glucotoxicité émerge du modèle", () => {
  it("après deux heures à 15 mM, le stress du réticulum est installé", () => {
    expect(apresChronique(2).stress.stressRE).toBeGreaterThan(0.25);
    expect(auRepos(2).stress.stressRE).toBeLessThan(0.15);
  });

  it("les granules s'épuisent : la sécrétion soutenue vide le pool plus vite qu'il ne se remplit", { timeout: 30_000 }, () => {
    // Trois heures, pas deux : la première heure est un transitoire — la
    // dégranulation est un fait de DURÉE, comme tout le reste de la
    // glucotoxicité. (La vraie prend des jours ; le modèle la comprime.)
    const malade = apresChronique(3);
    const repos = auRepos(3);
    expect(malade.expression.insulineGranules).toBeLessThan(
      0.6 * repos.expression.insulineGranules,
    );
  });

  it("le destin quitte l'homéostasie", () => {
    expect(apresChronique(3).stress.destin).not.toBe("homeostasie");
  });

  it("la même stimulation, COURTE, ne fait aucun de ces dégâts", () => {
    const stimule = creerSystemeCellulaire(creerEtat());
    stimule.milieu.glucoseCible = 15;
    avancerSystemeCellulaire(stimule, 600);
    expect(stimule.stress.stressRE).toBeLessThan(0.2);
    expect(stimule.stress.destin === "homeostasie" || stimule.stress.destin === "stress_adaptatif").toBe(true);
    expect(stimule.flux.secretion).toBeGreaterThan(0.002);
  });
});
