import { describe, expect, it } from "vitest";
import { creerEtat } from "./etatCellule.js";
import {
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";
import { contexteDe, contexteRepos, type ContexteCellule } from "./contexte.js";

function systemeAuRepos() {
  const systeme = creerSystemeCellulaire(creerEtat());
  avancerSystemeCellulaire(systeme, 300);
  return systeme;
}

function systemeStimule() {
  const systeme = creerSystemeCellulaire(creerEtat());
  systeme.milieu.glucoseCible = 12;
  avancerSystemeCellulaire(systeme, 300);
  return systeme;
}

describe("le contexte cellulaire, pont en lecture seule vers les scènes", () => {
  it("au repos, le contexte dérivé rejoint le contexte de référence", () => {
    const contexte = contexteDe(systemeAuRepos());
    const repos = contexteRepos();
    expect(contexte.atp).toBeGreaterThan(0.8);
    expect(contexte.atp).toBeLessThan(1.2);
    expect(contexte.forceProtonMotrice).toBeGreaterThan(0.8);
    expect(contexte.forceProtonMotrice).toBeLessThan(1.2);
    expect(contexte.gradientNa).toBeGreaterThan(0.9);
    expect(contexte.potentielMembrane).toBeLessThan(-55);
    expect(contexte.calciumCytosolique).toBeLessThan(0.0004);
    expect(Math.abs(contexte.ouvertureKATP - repos.ouvertureKATP)).toBeLessThan(0.25);
    expect(contexte.glucoseExterne).toBeGreaterThan(4.5);
    expect(contexte.glucoseExterne).toBeLessThan(6.5);
    expect(contexte.capaciteGranules).toBe(12);
  });

  it("stimulé au glucose, le contexte change de régime, pas seulement de vitesse", () => {
    const repos = contexteDe(systemeAuRepos());
    // Le régime stimulé PULSE (vagues calciques) : on retient le pic d'une
    // minute — c'est l'instantané qui mentirait, pas la moyenne.
    const systeme = systemeStimule();
    let stimule = contexteDe(systeme);
    for (let n = 0; n < 48; n++) {
      avancerSystemeCellulaire(systeme, 5);
      const instantane = contexteDe(systeme);
      if (instantane.calciumCytosolique > stimule.calciumCytosolique) stimule = instantane;
    }
    expect(stimule.ouvertureKATP).toBeLessThan(repos.ouvertureKATP - 0.3);
    expect(stimule.potentielMembrane).toBeGreaterThan(repos.potentielMembrane + 15);
    expect(stimule.calciumCytosolique).toBeGreaterThan(repos.calciumCytosolique * 2);
    expect(stimule.secretionRelative).toBeGreaterThan(repos.secretionRelative * 3);
  });

  it("dériver le contexte ne modifie pas le système", () => {
    const systeme = systemeAuRepos();
    const avant = JSON.stringify({
      m: systeme.metabolites,
      i: systeme.ions,
      e: systeme.expression,
      f: systeme.flux,
    });
    contexteDe(systeme);
    const apres = JSON.stringify({
      m: systeme.metabolites,
      i: systeme.ions,
      e: systeme.expression,
      f: systeme.flux,
    });
    expect(apres).toBe(avant);
  });

  it("le contexte de repos et le contexte dérivé ont exactement les mêmes champs", () => {
    const repos = contexteRepos() as unknown as Record<string, number>;
    const derive = contexteDe(systemeAuRepos()) as unknown as Record<string, number>;
    expect(Object.keys(derive).sort()).toEqual(Object.keys(repos).sort());
  });

  it("chaque champ du contexte est un nombre fini", () => {
    const verifier = (contexte: ContexteCellule) => {
      for (const [cle, valeur] of Object.entries(contexte)) {
        expect(Number.isFinite(valeur), `champ ${cle}`).toBe(true);
      }
    };
    verifier(contexteRepos());
    verifier(contexteDe(systemeStimule()));
  });
});
