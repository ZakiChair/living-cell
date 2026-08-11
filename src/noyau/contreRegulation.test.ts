import { describe, expect, it } from "vitest";
import { creerEtat } from "./etatCellule.js";
import {
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";

type Systeme = ReturnType<typeof creerSystemeCellulaire>;

function minutesDurant(systeme: Systeme, minutes: number) {
  for (let m = 0; m < minutes * 4; m++) avancerSystemeCellulaire(systeme, 15);
  return systeme;
}

/**
 * L'adrénaline : le frein d'urgence. Pendant l'effort ou l'hypoglycémie, le
 * récepteur α2 (couplé Gi) coupe la sécrétion d'insuline — SANS toucher au
 * calcium : l'inhibition est DISTALE, sur la machinerie d'exocytose
 * elle-même. Une cellule pleine de calcium qui ne sécrète pas : c'est le
 * découplage que ce test épingle.
 */
describe("l'adrénaline coupe la sécrétion sans éteindre le calcium", () => {
  it("stimulée + adrénaline : le calcium reste haut, l'insuline ne sort plus", () => {
    const stimule = creerSystemeCellulaire(creerEtat());
    stimule.milieu.glucoseCible = 12;
    minutesDurant(stimule, 15);

    const freinee = creerSystemeCellulaire(creerEtat());
    freinee.milieu.glucoseCible = 12;
    freinee.milieu.adrenaline = 1;
    minutesDurant(freinee, 15);

    expect(freinee.expression.insulineSecretee).toBeLessThan(
      0.35 * stimule.expression.insulineSecretee,
    );
    // Le canal K-ATP reste fermé et le calcium moyen élevé : le frein est en aval.
    expect(freinee.ions.canalKATP).toBeLessThan(0.35);
    expect(freinee.ions.calciumCytosolique).toBeGreaterThan(0.0002);
  });
});

/**
 * L'insulite : le diabète de type 1. Des lymphocytes tuent les bêta — la
 * masse fonctionnelle fond, et la sécrétion avec elle, à machinerie INTACTE :
 * chaque cellule survivante marche parfaitement, il y en a juste de moins en
 * moins. (Cinétique compressée : des mois réels en quelques heures, déclaré.)
 */
describe("l'insulite fait fondre la masse fonctionnelle", () => {
  it("la viabilité décline et la sécrétion s'éteint proportionnellement", () => {
    const attaquee = creerSystemeCellulaire(creerEtat());
    attaquee.milieu.glucoseCible = 12;
    attaquee.milieu.insulite = 1;
    minutesDurant(attaquee, 120);

    const temoin = creerSystemeCellulaire(creerEtat());
    temoin.milieu.glucoseCible = 12;
    minutesDurant(temoin, 120);

    expect(attaquee.stress.viabilite).toBeLessThan(0.7);
    expect(temoin.stress.viabilite).toBeGreaterThan(0.9);
    expect(attaquee.expression.insulineSecretee).toBeLessThan(
      0.6 * temoin.expression.insulineSecretee,
    );
    expect(attaquee.stress.destin).not.toBe("homeostasie");
  });
});
