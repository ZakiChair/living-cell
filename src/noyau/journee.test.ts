import { describe, expect, it } from "vitest";
import { glycemieJournee } from "./journee.js";
import { creerEtat } from "./etatCellule.js";
import {
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";

describe("la glycémie d'une journée saine", () => {
  it("est à jeun la nuit, pique après chaque repas, revient entre eux", () => {
    expect(glycemieJournee(3)).toBeLessThan(5.5);
    expect(glycemieJournee(8.2)).toBeGreaterThan(8.2);
    expect(glycemieJournee(13.4)).toBeGreaterThan(9);
    expect(glycemieJournee(20)).toBeGreaterThan(8.5);
    expect(glycemieJournee(11.5)).toBeLessThan(6.5);
    expect(glycemieJournee(17.5)).toBeLessThan(6.5);
  });

  it("est continue et boucle sur elle-même", () => {
    // Borne à 1 mM par 6 minutes (10 mM/h) : les montées post-prandiales
    // réelles atteignent 8 à 10 mM/h — au-delà, la courbe mentirait.
    for (let h = 0; h < 24; h += 0.1) {
      expect(Math.abs(glycemieJournee(h + 0.1) - glycemieJournee(h))).toBeLessThan(1.0);
    }
    expect(Math.abs(glycemieJournee(0) - glycemieJournee(24))).toBeLessThan(0.01);
  });
});

describe("la cellule vit sa journée", () => {
  it("trois vagues d'insuline, et le calme nocturne retrouvé", () => {
    const systeme = creerSystemeCellulaire(creerEtat());
    const parFenetre = new Map<string, number>();
    let precedent = 0;
    // De 6 h à 6 h le lendemain, au pas de 3 minutes simulées.
    for (let h = 6; h <= 30; h += 0.05) {
      systeme.milieu.glucoseCible = glycemieJournee(h);
      avancerSystemeCellulaire(systeme, 180);
      const heure = ((h % 24) + 24) % 24;
      const fenetre =
        heure >= 13 && heure < 15 ? "dejeuner" :
        heure >= 2 && heure < 5 ? "nuit" : "";
      if (fenetre) {
        parFenetre.set(
          fenetre,
          (parFenetre.get(fenetre) ?? 0) + systeme.expression.insulineSecretee - precedent,
        );
      }
      precedent = systeme.expression.insulineSecretee;
    }
    const dejeuner = parFenetre.get("dejeuner")!;
    const nuit = parFenetre.get("nuit")!;
    // Le déjeuner sécrète plusieurs fois plus que la même durée de nuit.
    expect(dejeuner).toBeGreaterThan(3 * nuit);
    // Et la nuit n'est pas morte : la sécrétion basale existe.
    expect(nuit).toBeGreaterThan(0);
  });
});
