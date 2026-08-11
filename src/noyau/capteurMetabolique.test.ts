import { describe, expect, it } from "vitest";
import { creerEtat } from "./etatCellule.js";
import {
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";

/**
 * Le capteur de glucose de la cellule bêta est la glucokinase, et son signal
 * est un FLUX : c'est parce que le glucose entre, est phosphorylé puis oxydé
 * que le rapport ATP/ADP monte et ferme les canaux K-ATP. Le modèle câblait ce
 * signal sur le glucose EXTERNE — la glycolyse qu'on regarde ne portait pas le
 * signal qui déclenche la sécrétion. Ces tests épinglent le trajet réel : on
 * peut désormais l'éteindre en coupant N'IMPORTE QUEL maillon de la chaîne
 * transport → glucokinase → oxydation, à glucose externe égal.
 */

function stimuleAvec(
  regler: (s: ReturnType<typeof creerSystemeCellulaire>) => void,
) {
  const systeme = creerSystemeCellulaire(creerEtat());
  systeme.milieu.glucoseCible = 12;
  regler(systeme);
  avancerSystemeCellulaire(systeme, 300);
  return systeme;
}

describe("le signal glucokinase traverse le métabolisme simulé", () => {
  it("référence : à 12 mM la chaîne intacte ferme les canaux K-ATP", () => {
    const intact = stimuleAvec(() => {});
    expect(intact.ions.canalKATP).toBeLessThan(0.35);
  });

  it("couper le transport de glucose rouvre les canaux malgré 12 mM dehors", () => {
    const sansTransport = stimuleAvec((s) => {
      s.profil = { ...s.profil, vmaxEntreeGlucose: 0 };
    });
    expect(sansTransport.ions.canalKATP).toBeGreaterThan(0.8);
    // Cumul plutôt qu'instantané : la sécrétion stimulée pulse désormais.
    expect(sansTransport.expression.insulineSecretee).toBeLessThan(
      0.2 * stimuleAvec(() => {}).expression.insulineSecretee,
    );
  });

  it("couper la glycolyse rouvre les canaux malgré 12 mM dehors", () => {
    const sansGlycolyse = stimuleAvec((s) => {
      s.profil = { ...s.profil, vmaxGlycolyse: 0 };
    });
    expect(sansGlycolyse.ions.canalKATP).toBeGreaterThan(0.8);
  });

  it("le glucose interne suit le glucose externe : le transporteur équilibre, il ne limite pas", () => {
    const repos = stimuleAvec((s) => {
      s.milieu.glucoseCible = 5.5;
    });
    const stimule = stimuleAvec(() => {});
    expect(repos.metabolites.glucose).toBeGreaterThan(0.7 * repos.milieu.glucoseExterne);
    expect(stimule.metabolites.glucose).toBeGreaterThan(0.7 * stimule.milieu.glucoseExterne);
  });

  it("la glycolyse garde sa marge : le flux stimulé dépasse nettement le flux de repos", () => {
    const repos = stimuleAvec((s) => {
      s.milieu.glucoseCible = 5.5;
    });
    const stimule = stimuleAvec(() => {});
    expect(stimule.flux.glycolyse).toBeGreaterThan(1.5 * repos.flux.glycolyse);
  });
});
