import { describe, expect, it } from "vitest";
import { creerEtat } from "./etatCellule.js";
import {
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";

type Systeme = ReturnType<typeof creerSystemeCellulaire>;

function heuresDurant(systeme: Systeme, heures: number) {
  for (let h = 0; h < heures; h++) avancerSystemeCellulaire(systeme, 3600);
  return systeme;
}

/**
 * PDX1, MAFA et NEUROD1 : le trio qui décide qu'une cellule est une cellule
 * bêta. Ils étaient NOMMÉS dans l'inventaire du noyau et ne commandaient
 * rien — de la décoration savante. Ils commandent maintenant la
 * transcription du gène INS, et c'est par eux que passe la
 * DÉDIFFÉRENCIATION : sous glucotoxicité, MAFA s'efface le premier, PDX1
 * quitte le noyau, et la cellule cesse d'être une cellule bêta AVANT de
 * mourir. C'est le mécanisme du diabète de type 2 que les manuels récents
 * mettent en avant : la masse bêta ne disparaît pas toujours, elle
 * s'endort.
 */
describe("le trio des facteurs commande le gène de l'insuline", () => {
  it("au repos, les trois facteurs sont présents et le gène se transcrit", () => {
    const s = heuresDurant(creerSystemeCellulaire(creerEtat()), 2);
    expect(s.expression.pdx1).toBeGreaterThan(0.7);
    expect(s.expression.mafa).toBeGreaterThan(0.7);
    expect(s.flux.transcription).toBeGreaterThan(0.005);
  });

  it("le glucose recrute les facteurs : ils tiennent plus haut chez la nourrie", () => {
    const repos = heuresDurant(creerSystemeCellulaire(creerEtat()), 2);
    const nourrie = creerSystemeCellulaire(creerEtat());
    nourrie.milieu.glucoseCible = 12;
    heuresDurant(nourrie, 2);
    // L'écart reste modeste, et c'est le fait : le glucose AJUSTE le
    // recrutement, il ne l'allume pas. Une cellule à jeun garde son
    // identité — elle la perd sur des jours d'excès, pas sur un repas
    // sauté. Exiger un ratio franc ici épinglerait une calibration.
    expect(nourrie.expression.mafa).toBeGreaterThan(repos.expression.mafa);
    expect(nourrie.expression.pdx1).toBeGreaterThan(repos.expression.pdx1);
  });

  it("sous glucotoxicité, MAFA s'efface AVANT PDX1", { timeout: 30_000 }, () => {
    const malade = creerSystemeCellulaire(creerEtat());
    malade.milieu.glucoseCible = 15;
    heuresDurant(malade, 6);
    // Les deux baissent, mais MAFA plus fort : c'est l'ordre publié.
    expect(malade.expression.mafa).toBeLessThan(0.55);
    expect(malade.expression.mafa).toBeLessThan(malade.expression.pdx1);
  });

  it("la cellule dédifférenciée transcrit moins, même en restant vivante", { timeout: 30_000 }, () => {
    const malade = creerSystemeCellulaire(creerEtat());
    malade.milieu.glucoseCible = 15;
    heuresDurant(malade, 6);
    const saine = heuresDurant(creerSystemeCellulaire(creerEtat()), 6);
    expect(malade.flux.transcription).toBeLessThan(0.75 * saine.flux.transcription);
    // Elle est encore là : la dédifférenciation n'est pas la mort.
    expect(malade.stress.viabilite).toBeGreaterThan(0.7);
  });

  it("l'identité se récupère si la glycémie revient : c'est réversible", { timeout: 30_000 }, () => {
    const s = creerSystemeCellulaire(creerEtat());
    s.milieu.glucoseCible = 15;
    heuresDurant(s, 6);
    const creux = s.expression.mafa;
    s.milieu.glucoseCible = 5;
    heuresDurant(s, 12);
    expect(s.expression.mafa).toBeGreaterThan(creux * 1.4);
  });
});
