import { describe, expect, it } from "vitest";
import { creerEtat } from "./etatCellule.js";
import {
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";

type Systeme = ReturnType<typeof creerSystemeCellulaire>;
function heuresDurant(s: Systeme, heures: number) {
  for (let h = 0; h < heures; h++) avancerSystemeCellulaire(s, 3600);
  return s;
}

/**
 * L'amyline : la seconde hormone du granule, et la seconde histoire du
 * diabète de type 2. Elle sort avec l'insuline, dans un rapport d'environ
 * un pour vingt — et l'amyline HUMAINE s'agrège en fibrilles amyloïdes, ce
 * que celle du rat ne fait pas. Des dépôts se retrouvent dans plus de neuf
 * pancréas de type 2 sur dix.
 */
describe("l'amyline s'agrège quand la cellule sur-produit", () => {
  it("une cellule au repos n'accumule pas d'agrégats", { timeout: 30_000 }, () => {
    const s = heuresDurant(creerSystemeCellulaire(creerEtat()), 8);
    expect(s.expression.amylineAgregee).toBeLessThan(0.15);
  });

  it("une cellule en hyperglycémie chronique en accumule", { timeout: 30_000 }, () => {
    const malade = creerSystemeCellulaire(creerEtat());
    malade.milieu.glucoseCible = 15;
    heuresDurant(malade, 8);
    const saine = heuresDurant(creerSystemeCellulaire(creerEtat()), 8);
    expect(malade.expression.amylineAgregee).toBeGreaterThan(
      3 * Math.max(saine.expression.amylineAgregee, 0.02),
    );
  });

  it("les agrégats installés abîment la cellule", { timeout: 30_000 }, () => {
    const malade = creerSystemeCellulaire(creerEtat());
    malade.milieu.glucoseCible = 15;
    heuresDurant(malade, 10);
    // S'ils ont dépassé le seuil, le dommage doit avoir suivi.
    if (malade.expression.amylineAgregee > 0.5) {
      expect(malade.stress.dommage).toBeGreaterThan(0.01);
    }
    expect(malade.expression.amylineAgregee).toBeGreaterThan(0.2);
  });
});
