import { describe, expect, it } from "vitest";
import { creerEtat } from "./etatCellule.js";
import {
  PROFIL_BETA_HUMAINE,
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";

/**
 * LE REPOS DÉCLARÉ DOIT ÊTRE LE REPOS TENU.
 *
 * Une cellule au repos annonce ses valeurs : 140 mM de K⁺ interne, 12 de Na⁺,
 * −70 mV. Si le modèle converge ailleurs, ces valeurs initiales sont un
 * décor : elles décrivent un état que la cellule quitte dès la première
 * minute. Le défaut est invisible sur cinq minutes de démonstration et
 * flagrant sur une journée — c'est le scénario « journée type » qui l'a
 * révélé, et ce test qui l'empêche de revenir.
 *
 * Le repos doit être stationnaire PAR CONSTRUCTION : les fuites sont
 * DÉRIVÉES du débit de pompe au repos, pas réglées à la main.
 */

function auRepos(heures: number) {
  const systeme = creerSystemeCellulaire(creerEtat());
  for (let h = 0; h < heures; h++) avancerSystemeCellulaire(systeme, 3600);
  return systeme;
}

const DEPART = {
  potassium: 140,
  sodium: 12,
  potentiel: -70,
};

describe("le repos déclaré est un point fixe", () => {
  it("les gradients ioniques tiennent leurs valeurs sur trois jours", { timeout: 30_000 }, () => {
    const s = auRepos(72);
    expect(Math.abs(s.ions.potassiumInterieur - DEPART.potassium)).toBeLessThan(2);
    expect(Math.abs(s.ions.sodiumInterieur - DEPART.sodium)).toBeLessThan(1);
  });

  it("le potentiel de repos reste celui d'une cellule bêta au repos", () => {
    const s = auRepos(24);
    // −60 à −70 mV : la fourchette publiée pour une bêta non stimulée.
    expect(s.ions.potentielMembrane).toBeLessThan(-60);
    expect(s.ions.potentielMembrane).toBeGreaterThan(-75);
  });

  it("le volume ne dérive pas : l'osmolarité de repos est celle de la consigne", () => {
    const s = auRepos(24);
    const osmolarite =
      s.ions.sodiumInterieur + s.ions.potassiumInterieur + s.ions.chlorureInterieur;
    // Le volume est le juge : s'il bouge, la dilution fausse toutes les
    // concentrations, et l'erreur se propage à tout le modèle.
    expect(Math.abs(s.ions.volumePicolitre - PROFIL_BETA_HUMAINE.volumeReposPicolitre)).toBeLessThan(
      0.02,
    );
    expect(osmolarite).toBeGreaterThan(150);
  });

  it("rien ne dérive entre le premier jour et le troisième", { timeout: 30_000 }, () => {
    const unJour = auRepos(24);
    const troisJours = auRepos(72);
    expect(
      Math.abs(troisJours.ions.potassiumInterieur - unJour.ions.potassiumInterieur),
    ).toBeLessThan(0.5);
    expect(Math.abs(troisJours.ions.potentielMembrane - unJour.ions.potentielMembrane)).toBeLessThan(
      1,
    );
  });

  it("la stimulation reste franche depuis ce repos plus bas", () => {
    const repos = auRepos(1);
    const stimule = creerSystemeCellulaire(creerEtat());
    stimule.milieu.glucoseCible = 12;
    for (let n = 0; n < 60; n++) avancerSystemeCellulaire(stimule, 30);
    // Le potentiel stimulé OSCILLE avec les vagues calciques : on retient son
    // sommet sur une période entière, jamais un instantané qui peut tomber
    // dans un creux — le piège a déjà mordu trois fois dans ce modèle.
    let sommet = stimule.ions.potentielMembrane;
    for (let n = 0; n < 48; n++) {
      avancerSystemeCellulaire(stimule, 5);
      sommet = Math.max(sommet, stimule.ions.potentielMembrane);
    }
    // 18 mV : la dépolarisation publiée va de 20 à 30, et l'enveloppe du
    // modèle en donne 20 tout rond. Une barre posée sur 20 se joue à
    // 0,05 mV — elle vérifierait la calibration, pas le fait.
    expect(sommet).toBeGreaterThan(repos.ions.potentielMembrane + 18);
    expect(stimule.ions.canalKATP).toBeLessThan(0.35);
  });
});

describe("le pool de granules respecte sa capacité déclarée", () => {
  it("amarrés et réserve tiennent ENSEMBLE dans la capacité", () => {
    const s = auRepos(24);
    expect(s.expression.insulineGranules).toBeLessThanOrEqual(
      PROFIL_BETA_HUMAINE.capaciteGranules + 1e-9,
    );
    // Et le pool amarré est bien rempli au repos : c'est lui qui fait la
    // première phase, et une cellule reposée l'a reconstitué.
    expect(s.expression.granulesAmarres).toBeGreaterThan(0.5);
  });
});
