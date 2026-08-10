import { describe, expect, it } from "vitest";
import { creerEtat } from "./etatCellule.js";
import {
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";

/**
 * Les deux leviers pharmacologiques du canal K-ATP — les plus enseignés de
 * toute l'endocrinologie :
 * - la SULFONYLURÉE (glibenclamide…) FERME le canal en se liant à SUR1 :
 *   la cellule sécrète même sans glucose. C'est le médicament historique du
 *   diabète de type 2.
 * - le DIAZOXIDE l'OUVRE : la cellule se tait même gavée de glucose. C'est
 *   le traitement de l'insulinome et des hypoglycémies congénitales.
 * Deux effets opposés sur la même protéine, et le modèle doit les produire
 * par la chaîne entière — canal, potentiel, calcium, granules.
 */

function avec(
  regler: (s: ReturnType<typeof creerSystemeCellulaire>) => void,
) {
  const systeme = creerSystemeCellulaire(creerEtat());
  regler(systeme);
  avancerSystemeCellulaire(systeme, 400);
  return systeme;
}

describe("sulfonylurée : fermer le canal, sécréter sans glucose", () => {
  it("à glucose BAS, la sulfonylurée ferme les canaux K-ATP", () => {
    const affame = avec((s) => {
      s.milieu.glucoseCible = 2;
    });
    const traite = avec((s) => {
      s.milieu.glucoseCible = 2;
      s.milieu.sulfonylure = 1;
    });
    expect(affame.ions.canalKATP).toBeGreaterThan(0.8);
    expect(traite.ions.canalKATP).toBeLessThan(0.15);
  });

  it("elle déclenche la dépolarisation, le calcium et la sécrétion malgré la faim", () => {
    const traite = avec((s) => {
      s.milieu.glucoseCible = 2;
      s.milieu.sulfonylure = 1;
    });
    const affame = avec((s) => {
      s.milieu.glucoseCible = 2;
    });
    expect(traite.ions.potentielMembrane).toBeGreaterThan(
      affame.ions.potentielMembrane + 15,
    );
    expect(traite.ions.calciumCytosolique).toBeGreaterThan(
      affame.ions.calciumCytosolique * 2,
    );
    expect(traite.expression.insulineSecretee).toBeGreaterThan(
      3 * affame.expression.insulineSecretee,
    );
  });
});

describe("diazoxide : ouvrir le canal, se taire malgré le glucose", () => {
  it("à glucose HAUT, le diazoxide garde les canaux ouverts", () => {
    const stimule = avec((s) => {
      s.milieu.glucoseCible = 15;
    });
    const traite = avec((s) => {
      s.milieu.glucoseCible = 15;
      s.milieu.diazoxide = 1;
    });
    expect(stimule.ions.canalKATP).toBeLessThan(0.2);
    expect(traite.ions.canalKATP).toBeGreaterThan(0.75);
  });

  it("il éteint la sécrétion stimulée", () => {
    const stimule = avec((s) => {
      s.milieu.glucoseCible = 15;
    });
    const traite = avec((s) => {
      s.milieu.glucoseCible = 15;
      s.milieu.diazoxide = 1;
    });
    expect(traite.expression.insulineSecretee).toBeLessThan(
      0.25 * stimule.expression.insulineSecretee,
    );
  });
});
