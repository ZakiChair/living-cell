import { describe, expect, it } from "vitest";
import { creerEtat } from "./etatCellule.js";
import {
  activiteMecanisme,
  avancerSystemeCellulaire,
  creerSystemeCellulaire,
} from "./systemeCellulaire.js";

/**
 * Deux mécanismes étaient pilotés par des fils faux : la kinésine par le flux
 * RE→Golgi (qui n'est ni son carburant ni sa cargaison), l'instabilité des
 * microtubules par une lecture d'ATP sans flux déclaré. Ces tests épinglent
 * les fils réparés : des flux nommés, dérivés du modèle, avec les bons
 * comportements limites.
 */

function auRepos() {
  const systeme = creerSystemeCellulaire(creerEtat());
  avancerSystemeCellulaire(systeme, 300);
  return systeme;
}

function stimule() {
  const systeme = creerSystemeCellulaire(creerEtat());
  systeme.milieu.glucoseCible = 12;
  avancerSystemeCellulaire(systeme, 300);
  return systeme;
}

function anoxique() {
  const systeme = creerSystemeCellulaire(creerEtat());
  systeme.energie.inhibiteurs.anoxie = true;
  avancerSystemeCellulaire(systeme, 600);
  return systeme;
}

describe("le trafic des moteurs moléculaires", () => {
  it("au repos, les moteurs transportent : le flux est non nul", () => {
    expect(auRepos().flux.transportMoteur).toBeGreaterThan(0.005);
  });

  it("l'anoxie prolongée effondre le transport : sans ATP, pas de pas", () => {
    expect(anoxique().flux.transportMoteur).toBeLessThan(
      0.3 * auRepos().flux.transportMoteur,
    );
  });

  it("le glucose augmente le fret : la sécrétion ajoute sa cargaison", () => {
    expect(stimule().flux.transportMoteur).toBeGreaterThan(
      auRepos().flux.transportMoteur * 1.15,
    );
  });

  it("l'activité du mécanisme suit ce flux, bornée entre 0 et 1", () => {
    const activite = activiteMecanisme(auRepos(), "transport-moteur");
    expect(activite).toBeGreaterThan(0.1);
    expect(activite).toBeLessThanOrEqual(1);
  });
});

describe("la dynamique des microtubules", () => {
  it("au repos, la dynamique est proche de son régime plein", () => {
    const flux = auRepos().flux.dynamiqueMicrotubules;
    expect(flux).toBeGreaterThan(0.8);
    expect(flux).toBeLessThanOrEqual(1);
  });

  it("sous anoxie, elle garde un plancher : un microtubule privé de GTP s'effondre, il ne gèle pas", () => {
    const flux = anoxique().flux.dynamiqueMicrotubules;
    expect(flux).toBeGreaterThan(0.1);
    expect(flux).toBeLessThan(0.4);
  });

  it("l'activité du mécanisme est exactement ce flux", () => {
    const systeme = auRepos();
    expect(activiteMecanisme(systeme, "instabilite-dynamique")).toBeCloseTo(
      systeme.flux.dynamiqueMicrotubules,
      10,
    );
  });
});
